const stoppedStates = new Set(['power_off', 'power_on', 'sleep', 'initial', 'initializing', 'standby', 'end', 'complete', 'done', 'running_end', 'error']);

export function washerMinutes(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  const minutes = Math.ceil(value);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
}

export function washerRemaining(device, now, stale = false) {
  if (stale) return '수신 지연';
  if (device.available !== true) return '정보 없음';
  if (stoppedStates.has(device.state)) return '—';
  if (device.state === 'pause' || device.state === 'paused') return '일시정지';
  const end = typeof device.remainingEndAt === 'string' ? Date.parse(device.remainingEndAt) : NaN;
  const time = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(end) || !Number.isFinite(time)) return '수신 대기';
  if (end <= time) return '갱신 대기';
  return washerMinutes((end - time) / 60000);
}
