const statusLabels = {
  cool_down: '냉각 중', error: '오류', end: '세탁 완료', rinse_hold: '헹굼 대기', drying: '건조 중',
  running: '세탁 중', spinning: '탈수 중', steam_softening: '스팀 유연 중', sleep: '대기',
  refreshing: '리프레시 중', rinsing: '헹굼 중', detecting: '세탁물 감지 중', reserved: '예약 대기',
  initial: '준비', pause: '일시 정지', power_off: '전원 꺼짐', power_on: '전원 켜짐',
  initializing: '초기화 중', standby: '대기', paused: '일시 정지', complete: '세탁 완료', done: '세탁 완료', running_end: '세탁 완료',
};
const progressing = new Set(['cool_down', 'drying', 'running', 'spinning', 'steam_softening', 'refreshing', 'rinsing', 'detecting']);
const currentCycle = new Set([...progressing, 'pause', 'paused', 'reserved', 'rinse_hold']);
const notificationLabels = { error_during_washing: '세탁 중 오류 알림', washing_is_complete: '세탁 완료 알림' };
const enabled = entry => !entry.disabled_by && !entry.hidden_by;

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  return value;
}
function number(state) {
  if (typeof state?.state !== 'string' || !state.state.trim()) return null;
  const value = Number(state.state);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function bounded(value, fallback) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || fallback : fallback;
}

export function washerSummaries(states, registry, devices, areas, entries) {
  const stateMap = new Map(states.map(state => [state.entity_id, state]));
  const areaMap = new Map(areas.map(area => [area.area_id, area.name]));
  const entityIds = new Set();
  const washers = [];
  for (const device of [...devices].sort((a, b) => a.id.localeCompare(b.id))) {
    if (typeof device.model !== 'string' || !/(?:^|[\s(])DEVICE_WASHER(?:[\s)]|$)/i.test(device.model)) continue;
    const attached = registry.filter(entry => entry.device_id === device.id);
    const related = attached.filter(entry => entry.platform === 'lg_thinq').sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    if (!related.length) continue;
    for (const entry of attached) entityIds.add(entry.entity_id);
    const selectedEntry = (key, domain) => related.find(entry => entry.translation_key === key && entry.entity_id.startsWith(`${domain}.`) && enabled(entry));
    const current = selectedEntry('current_state', 'sensor');
    if (!current) continue;
    const selected = (key, domain = 'sensor') => stateMap.get(selectedEntry(key, domain)?.entity_id);
    const status = stateMap.get(current.entity_id);
    const linkedEntries = entries.filter(entry => entry.domain === 'lg_thinq' && (current.config_entry_id ? entry.entry_id === current.config_entry_id : device.config_entries?.length ? device.config_entries.includes(entry.entry_id) : true));
    const integrationReady = linkedEntries.some(entry => entry.state === 'loaded');
    const state = typeof status?.state === 'string' ? status.state.slice(0, 80) : 'unknown';
    const available = integrationReady && Object.hasOwn(statusLabels, state) && status?.attributes?.restored !== true;
    const remain = selected('remain');
    const total = selected('total');
    const remote = selected('remote_control_enabled', 'binary_sensor');
    const count = number(selected('cycle_count'));
    const energy = selected('energy_usage_this_month');
    const energyValue = number(energy);
    const completion = selected('notification', 'event');
    const completionAt = integrationReady && completion?.attributes?.event_type === 'washing_is_complete' && completion.attributes.restored !== true ? timestamp(completion.state) : null;
    const remoteActive = available && !['power_off', 'sleep', 'standby'].includes(state);
    const events = ['notification', 'error'].map(key => {
      const event = selected(key, 'event');
      const at = timestamp(event?.state);
      const type = event?.attributes?.event_type;
      if (!at || typeof type !== 'string' || !type || ['unknown', 'unavailable'].includes(type)) return null;
      const label = key === 'notification' && Object.hasOwn(notificationLabels, type) ? notificationLabels[type] :
        key === 'error' && Array.isArray(event.attributes.event_types) && event.attributes.event_types.includes(type) ? '세탁기 오류 알림' : null;
      return label ? { label, at } : null;
    }).filter(Boolean).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const updatedAt = [status, remain, total, remote].map(item => timestamp(item?.last_updated)).filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
    washers.push({
      kind: 'washer', entityId: current.entity_id, name: bounded(device.name_by_user || device.name, '세탁기'),
      room: bounded(areaMap.get(current.area_id || device.area_id), '기타'), platform: 'LG ThinQ', state,
      available, controllable: false, statusLabel: available ? statusLabels[state] : '연결 확인 필요',
      remainingEndAt: available && progressing.has(state) && remain?.attributes?.device_class === 'timestamp' ? timestamp(remain.state) : null,
      totalMinutes: available && currentCycle.has(state) && total?.attributes?.unit_of_measurement === 'min' ? number(total) : null,
      remoteStart: remoteActive && ['on', 'off'].includes(remote?.state) ? remote.state === 'on' : null,
      cycleCount: available && Number.isSafeInteger(count) ? count : null,
      energyMonthKwh: available && energyValue !== null ? energy?.attributes?.unit_of_measurement === 'Wh' ? energyValue / 1000 : energy?.attributes?.unit_of_measurement === 'kWh' ? energyValue : null : null,
      lastNotification: events[0] || null, completionAt, updatedAt,
    });
  }
  return { washers, entityIds };
}
