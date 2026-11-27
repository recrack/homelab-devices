const DAY = 24 * 60 * 60 * 1000;

export function historyChart(series, { now = Date.now(), metric = 'humidity', width = 480, height = 106 } = {}) {
  const end = now instanceof Date ? now.getTime() : now;
  const start = end - DAY;
  const points = new Map();
  if (!Number.isFinite(end)) return { segments: [], min: null, max: null, count: 0, start: null, end: null };
  for (const item of (Array.isArray(series) ? series : []).slice(-2048)) {
    const time = typeof item?.time === 'string' ? Date.parse(item.time) : NaN;
    if (!Number.isFinite(time) || time < start || time > end) continue;
    const valid = Number.isFinite(item.value) && item.value >= 0 && (metric !== 'humidity' || item.value <= 100);
    points.set(time, valid ? item.value : null);
  }
  const ordered = [...points].sort((a, b) => a[0] - b[0]);
  const values = ordered.filter(([, value]) => value !== null).map(([, value]) => value);
  if (!values.length) return { segments: [], min: null, max: null, count: 0, start, end };
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * .15, metric === 'co2' ? 20 : 1);
  const low = Math.max(0, min - padding), high = max + padding;
  const segments = [];
  let current = [];
  for (const [time, value] of ordered) {
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push({ time, value, x: (time - start) / DAY * width, y: 8 + (high - value) / (high - low) * (height - 16) });
  }
  if (current.length) segments.push(current);
  return { segments, min, max, count: values.length, start, end };
}
