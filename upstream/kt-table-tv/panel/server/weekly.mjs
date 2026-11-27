const HOUR = 3600000;
const DAY = 24 * HOUR;
const SEOUL_OFFSET = 9 * HOUR;
const KINDS = ['temperature', 'humidity', 'co2'];
const UNITS = { temperature: '°C', humidity: '%', co2: 'ppm' };
const sensor = value => typeof value === 'string' && /^sensor\.[a-z0-9_]+$/.test(value);
const rounded = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const safeName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : '';

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number), at = Date.parse(value);
  return Number.isFinite(at) && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && hour <= 23 && minute <= 59 && second <= 59 ? at : null;
}

function reading(value, unit, kind) {
  if (!(typeof value === 'number' || typeof value === 'string' && value.trim())) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (kind === 'temperature') return unit === '°C' ? number : unit === '°F' ? (number - 32) * 5 / 9 : null;
  if (kind === 'humidity') return unit === '%' && number >= 0 && number <= 100 ? number : null;
  return kind === 'co2' && typeof unit === 'string' && unit.trim().toLowerCase() === 'ppm' && number >= 0 ? number : null;
}

function emptyMetric(kind) {
  return { available: false, unit: UNITS[kind], average: null, min: null, max: null, samples: 0,
    coverageHours: 0, coveragePercent: 0, availableDays: 0,
    ...(kind === 'co2' ? { aboveThresholdHours: null, aboveThresholdPercent: null, peakHours: [] } : {}) };
}

export function weeklyWindow(end) {
  if (!Number.isFinite(end)) throw new Error('Invalid summary time');
  return { start: Math.floor((end + SEOUL_OFFSET) / DAY) * DAY - SEOUL_OFFSET - 6 * DAY, end };
}

export function summarizeWeeklyMetric(rows, kind, { start, end, co2Threshold = 1200, maxGapMs = HOUR }) {
  const empty = emptyMetric(kind);
  if (!KINDS.includes(kind) || !Array.isArray(rows) || rows.length > 100000 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(maxGapMs) || maxGapMs <= 0) return empty;
  let unit;
  const points = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (Object.hasOwn(row, 'attributes')) unit = row.attributes?.unit_of_measurement;
    const at = timestamp(row.last_updated ?? row.last_changed);
    if (at === null || at < start || at > end) continue;
    points.set(at, { at, value: reading(row.state, unit, kind) });
  }
  const ordered = [...points.values()].sort((a, b) => a.at - b.at);
  const valid = ordered.filter(point => point.value !== null);
  if (!valid.length) return empty;
  let duration = 0, integral = 0, above = 0;
  const days = new Set(), hours = Array.from({ length: 24 }, () => ({ duration: 0, integral: 0 }));
  for (let i = 0; i < ordered.length; i++) {
    const point = ordered[i];
    if (point.value === null) continue;
    const until = Math.min(end, ordered[i + 1]?.at ?? end, point.at + maxGapMs);
    if (until <= point.at) continue;
    const span = until - point.at;
    duration += span; integral += point.value * span;
    if (kind === 'co2' && point.value >= co2Threshold) above += span;
    for (let at = point.at; at < until;) {
      const next = Math.min(until, (Math.floor((at + SEOUL_OFFSET) / HOUR) + 1) * HOUR - SEOUL_OFFSET);
      const hour = new Date(at + SEOUL_OFFSET).getUTCHours(), segment = next - at;
      days.add(Math.floor((at + SEOUL_OFFSET) / DAY));
      hours[hour].duration += segment; hours[hour].integral += point.value * segment;
      at = next;
    }
  }
  if (!duration) return { ...empty, samples: valid.length };
  const extremes = valid.reduce((result, point) => ({ min: Math.min(result.min, point.value), max: Math.max(result.max, point.value) }), { min: Infinity, max: -Infinity });
  const result = { available: true, unit: UNITS[kind], average: rounded(integral / duration),
    min: rounded(extremes.min), max: rounded(extremes.max), samples: valid.length,
    coverageHours: rounded(duration / HOUR), coveragePercent: rounded(duration / (end - start) * 100), availableDays: days.size };
  if (kind === 'co2') {
    result.aboveThresholdHours = rounded(above / HOUR);
    result.aboveThresholdPercent = rounded(above / duration * 100);
    result.peakHours = hours.map((bucket, hour) => ({ hour, average: bucket.duration ? rounded(bucket.integral / bucket.duration) : null, coverageHours: rounded(bucket.duration / HOUR), duration: bucket.duration }))
      .filter(bucket => bucket.duration >= HOUR / 2).sort((a, b) => b.average - a.average || a.hour - b.hour).slice(0, 3)
      .map(({ duration: _duration, ...bucket }) => bucket);
  }
  return result;
}

export class WeeklyEnvironment {
  constructor({ ha, now = Date.now }) { this.ha = ha; this.now = now; this.cache = null; }

  async summarize(data, { co2Threshold = 1200 } = {}) {
    const threshold = Number.isFinite(co2Threshold) && co2Threshold >= 600 && co2Threshold <= 5000 ? co2Threshold : 1200;
    const rooms = (Array.isArray(data?.rooms) ? data.rooms : []).slice(0, 30).filter(room => typeof room?.id === 'string');
    const sensors = [...new Set(rooms.flatMap(room => KINDS.map(kind => room[`${kind}Entity`])).filter(sensor))].sort();
    const window = weeklyWindow(this.now());
    const base = { available: false, updatedAt: null, start: new Date(window.start).toISOString(), end: new Date(window.end).toISOString(),
      days: 7, timeZone: 'Asia/Seoul', co2Threshold: threshold, maxGapMinutes: 60,
      rooms: rooms.map(room => ({ id: room.id, name: safeName(room.name) || room.id, metrics: Object.fromEntries(KINDS.map(kind => [kind, emptyMetric(kind)])) })) };
    if (!sensors.length || sensors.length > 90) return base;
    const key = JSON.stringify([sensors, window.start]);
    let cache = this.cache;
    if (!cache || cache.key !== key || !cache.pending && (this.now() >= cache.expires || cache.value?.end > window.end)) {
      cache = { key, expires: 0, value: null, pending: null }; this.cache = cache;
      cache.pending = Promise.resolve().then(async () => {
        const params = new URLSearchParams({ filter_entity_id: sensors.join(','), end_time: new Date(window.end).toISOString(), significant_changes_only: '0', skip_initial_state: '1' });
        const response = await this.ha.json(`/api/history/period/${new Date(window.start).toISOString()}?${params}`, { signal: AbortSignal.timeout(20000) });
        if (!Array.isArray(response) || response.length > sensors.length) throw new Error('Weekly history unavailable');
        const byEntity = new Map();
        for (const rows of response) {
          if (!Array.isArray(rows) || !rows.length) continue;
          const id = rows[0]?.entity_id;
          if (!sensors.includes(id) || rows.length > 100000 || rows.some(row => row?.entity_id && row.entity_id !== id)) continue;
          byEntity.set(id, rows);
        }
        cache.value = { byEntity, ...window }; cache.expires = this.now() + 15 * 60000;
      }).catch(() => { cache.value = null; cache.expires = this.now() + 60000; }).finally(() => { cache.pending = null; });
    }
    if (cache.pending) await cache.pending;
    if (!cache.value) return base;
    const { byEntity, start, end } = cache.value;
    const summaries = rooms.map(room => ({ id: room.id, name: safeName(room.name) || room.id, metrics: Object.fromEntries(KINDS.map(kind => [kind,
      summarizeWeeklyMetric(byEntity.get(room[`${kind}Entity`]) || [], kind, { start, end, co2Threshold: threshold }),
    ])) }));
    return { ...base, available: summaries.some(room => KINDS.some(kind => room.metrics[kind].available)), updatedAt: new Date(end).toISOString(),
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), rooms: summaries };
  }
}
