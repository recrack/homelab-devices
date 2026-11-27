const HOUR = 3600000;
const DAY = 24 * HOUR;
const conditions = {
  'clear-night': '맑은 밤', cloudy: '흐림', fog: '안개', hail: '우박', lightning: '천둥·번개',
  'lightning-rainy': '뇌우', partlycloudy: '구름 조금', pouring: '강한 비', rainy: '비',
  snowy: '눈', 'snowy-rainy': '눈·비', sunny: '맑음', windy: '바람', 'windy-variant': '흐리고 바람', exceptional: '특이 기상',
};
const entity = (value, domain) => typeof value === 'string' && new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(value);
const finite = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const label = value => typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || 'Home Assistant' : 'Home Assistant';

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || month < 1 || month > 12 || day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  return milliseconds;
}

export function forecastItems(rows, attributes = {}) {
  if (!Array.isArray(rows)) return [];
  const items = new Map();
  for (const row of rows.slice(0, 1000)) {
    const at = timestamp(row?.datetime);
    if (at === null || items.has(at)) continue;
    const temperature = finite(row.temperature), rain = finite(row.precipitation), probability = finite(row.precipitation_probability);
    const conditionCode = Object.hasOwn(conditions, row.condition) ? row.condition : null;
    const temperatureC = temperature === null ? null : attributes.temperature_unit === '°C' ? temperature : attributes.temperature_unit === '°F' ? (temperature - 32) * 5 / 9 : null;
    const precipitationMm = rain === null || rain < 0 ? null : attributes.precipitation_unit === 'mm' ? rain : attributes.precipitation_unit === 'in' ? rain * 25.4 : null;
    const precipitationProbability = probability !== null && probability >= 0 && probability <= 100 ? probability : null;
    if (!conditionCode && temperatureC === null && precipitationMm === null && precipitationProbability === null) continue;
    items.set(at, { time: new Date(at).toISOString(), conditionCode, condition: conditionCode ? conditions[conditionCode] : null,
      temperatureC, precipitationMm, precipitationProbability });
  }
  return [...items.entries()].sort((a, b) => a[0] - b[0]).map(([, item]) => item);
}

function historyValue(value, unit, kind) {
  const number = finite(value);
  if (number === null) return null;
  if (kind === 'temperature') return unit === '°C' ? number : unit === '°F' ? (number - 32) * 5 / 9 : null;
  if (kind === 'humidity') return unit === '%' && number >= 0 && number <= 100 ? number : null;
  return typeof unit === 'string' && unit.trim().toLowerCase() === 'ppm' && number >= 0 ? number : null;
}

export function compactHistory(points, start, end, limit = 288) {
  if (points.length <= limit) return points;
  const bucketCount = Math.floor(limit / 4), width = Math.max(1, (end - start) / bucketCount);
  const buckets = new Map();
  for (const point of points) {
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((Date.parse(point.time) - start) / width)));
    const bucket = buckets.get(index) || [];
    bucket.push(point); buckets.set(index, bucket);
  }
  const result = [];
  for (const bucket of buckets.values()) {
    if (bucket.some(point => point.value === null)) {
      result.push({ time: bucket[0].time, value: null });
      if (bucket.length > 1) result.push({ time: bucket.at(-1).time, value: null });
      continue;
    }
    const selected = new Set([bucket[0], bucket.at(-1), bucket.reduce((a, b) => a.value < b.value ? a : b), bucket.reduce((a, b) => a.value > b.value ? a : b)]);
    result.push(...[...selected].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)));
  }
  return result;
}

export function historySeries(series, kind, start, end) {
  if (!Array.isArray(series)) return [];
  let unit;
  const points = new Map();
  for (const row of series) {
    if (!row || typeof row !== 'object') continue;
    if (row.attributes && Object.hasOwn(row.attributes, 'unit_of_measurement')) unit = row.attributes.unit_of_measurement;
    const at = timestamp(row.last_changed ?? row.last_updated);
    if (at === null || at < start || at > end) continue;
    points.set(at, { time: new Date(at).toISOString(), value: historyValue(row.state, unit, kind) });
  }
  const ordered = [...points.entries()].sort((a, b) => a[0] - b[0]).map(([, point]) => point);
  return compactHistory(ordered, start, end);
}

export class PanelInsights {
  constructor({ ha, now = Date.now }) {
    this.ha = ha;
    this.now = now;
    this.forecastCache = null;
    this.historyCache = null;
  }

  async cached(slot, key, ttl, request) {
    let cache = this[slot];
    if (cache?.key === key) {
      if (cache.pending) return cache.pending;
      if (this.now() < cache.expires) return cache.value;
    }
    cache = { key, value: null, expires: 0, pending: null };
    this[slot] = cache;
    cache.pending = Promise.resolve().then(request).then(value => {
      cache.value = value;
      cache.expires = this.now() + ttl;
      return value;
    }).catch(() => {
      cache.value = null;
      cache.expires = this.now() + 60000;
      return null;
    }).finally(() => { cache.pending = null; });
    return cache.pending;
  }

  async forecast(data, { weatherEntityId, weatherAttributes } = {}) {
    const source = label(data?.weather?.source);
    const empty = { available: false, source, updatedAt: null, items: [] };
    if (!entity(weatherEntityId, 'weather') || data?.weather?.available !== true) return empty;
    const result = await this.cached('forecastCache', weatherEntityId, 15 * 60000, async () => {
      const [attributes, response] = await Promise.all([
        weatherAttributes ? Promise.resolve(weatherAttributes) : this.ha.json(`/api/states/${weatherEntityId}`).then(state => {
          if (state?.entity_id !== weatherEntityId || ['unknown', 'unavailable'].includes(state.state)) throw new Error('Forecast unavailable');
          return state.attributes;
        }),
        this.ha.json('/api/services/weather/get_forecasts?return_response', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: weatherEntityId, type: 'hourly' }),
        }),
      ]);
      const rows = response?.service_response?.[weatherEntityId]?.forecast;
      if (!Array.isArray(rows)) throw new Error('Forecast unavailable');
      return { items: forecastItems(rows, attributes || {}), updatedAt: new Date(this.now()).toISOString() };
    });
    if (!result) return empty;
    const hour = Math.floor(this.now() / HOUR) * HOUR;
    const items = result.items.filter(item => { const at = Date.parse(item.time); return at >= hour && at < hour + DAY; }).slice(0, 8);
    return items.length ? { available: true, source, updatedAt: result.updatedAt, items } : empty;
  }

  async histories(data) {
    const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
    const sensors = new Map();
    for (const room of rooms) for (const kind of ['temperature', 'humidity', 'co2']) {
      const id = room[`${kind}Entity`];
      if (entity(id, 'sensor')) sensors.set(id, kind);
    }
    const empty = () => Object.fromEntries(rooms.filter(room => typeof room.id === 'string').map(room => [room.id, { temperature: [], humidity: [], co2: [] }]));
    if (!sensors.size) return empty();
    const key = JSON.stringify([...sensors].sort((a, b) => a[0].localeCompare(b[0])));
    const result = await this.cached('historyCache', key, 5 * 60000, async () => {
      const end = this.now(), start = end - DAY;
      const params = new URLSearchParams({ filter_entity_id: [...sensors.keys()].sort().join(','), end_time: new Date(end).toISOString(), minimal_response: '', significant_changes_only: '0' });
      const response = await this.ha.json(`/api/history/period/${new Date(start).toISOString()}?${params}`);
      if (!Array.isArray(response)) throw new Error('History unavailable');
      const series = new Map();
      for (const rows of response) {
        if (!Array.isArray(rows) || !rows.length) continue;
        const id = rows[0]?.entity_id;
        if (!sensors.has(id) || rows.some(row => row?.entity_id && row.entity_id !== id)) continue;
        series.set(id, historySeries(rows, sensors.get(id), start, end));
      }
      return series;
    });
    if (!result) return empty();
    const cutoff = this.now() - DAY;
    return Object.fromEntries(rooms.filter(room => typeof room.id === 'string').map(room => [room.id, Object.fromEntries(['temperature', 'humidity', 'co2'].map(kind =>
      [kind, (result.get(room[`${kind}Entity`]) || []).filter(point => Date.parse(point.time) >= cutoff)]))]));
  }

  async enrich(data, options = {}) {
    const [forecast, histories] = await Promise.all([this.forecast(data, options), this.histories(data)]);
    return { forecast, histories };
  }
}
