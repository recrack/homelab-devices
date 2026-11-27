export function createWasherAlertTracker(options) {
  options = options || {};
  var storage = options.storage || null;
  var now = typeof options.now === 'function' ? options.now : Date.now;
  var storageKey = typeof options.storageKey === 'string' && options.storageKey.length > 0 && options.storageKey.length <= 120 ? options.storageKey : 'home-panel-washer-alerts-v1';
  var maxAge = 24 * 60 * 60 * 1000;
  var futureAllowance = 60 * 1000;
  var seen = Object.create(null);
  var pending = [];

  function clock() {
    var value;
    try { value = now(); } catch (error) { value = Date.now(); }
    return typeof value === 'number' && isFinite(value) ? value : Date.now();
  }
  function key(value) {
    if (typeof value !== 'string' || value.length > 128 || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
    try { encodeURIComponent(value); } catch (error) { return null; }
    return value.trim();
  }
  function label(value, fallback) {
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || fallback;
  }
  function date(value) {
    if (typeof value !== 'string' || value.length > 64) return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return null;
    var valueAt = Date.parse(value);
    return isFinite(valueAt) && valueAt > 0 ? valueAt : null;
  }
  function recent(at, time) { return at !== null && at >= time - maxAge && at <= time + futureAllowance; }
  function id(deviceKey, at) { return 'washer:' + encodeURIComponent(deviceKey) + ':' + String(at); }
  function copy(item) { return { id: id(item.key, item.time), name: item.name, room: item.room, at: item.at }; }
  function copies(items) { return items.map(copy); }
  function trim(time) {
    pending = pending.sort(function (a, b) { return b.time - a.time || a.key.localeCompare(b.key); }).slice(0, 20);
    var alertKeys = Object.create(null);
    pending.forEach(function (item) { alertKeys[item.key] = true; });
    var keys = Object.keys(seen).sort(function (a, b) {
      return Number(Boolean(alertKeys[b])) - Number(Boolean(alertKeys[a])) || seen[b].observedAt - seen[a].observedAt || a.localeCompare(b);
    });
    keys.slice(100).forEach(function (deviceKey) { delete seen[deviceKey]; });
    pending = pending.filter(function (item) { return Boolean(seen[item.key]); });
  }
  function persist() {
    if (!storage) return;
    var data = {
      version: 1,
      seen: Object.keys(seen).map(function (deviceKey) { return { key: deviceKey, at: seen[deviceKey].at, observedAt: seen[deviceKey].observedAt }; }),
      pending: pending.map(function (item) { return { key: item.key, name: item.name, room: item.room, at: item.at }; })
    };
    try { storage.setItem(storageKey, JSON.stringify(data)); } catch (error) {}
  }
  function load() {
    var raw;
    var saved;
    var time = clock();
    try {
      raw = storage && storage.getItem(storageKey);
      if (typeof raw !== 'string' || raw.length > 65536) return;
      saved = JSON.parse(raw);
    } catch (error) { return; }
    if (!saved || saved.version !== 1 || !Array.isArray(saved.seen) || !Array.isArray(saved.pending)) return;
    saved.seen.slice(0, 100).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var deviceKey = key(item.key);
      if (!deviceKey || typeof item.at !== 'number' || !isFinite(item.at) || item.at < 0 || item.at > time + futureAllowance ||
        typeof item.observedAt !== 'number' || !isFinite(item.observedAt) || item.observedAt < 0 || item.observedAt > time + futureAllowance) return;
      var previous = seen[deviceKey];
      seen[deviceKey] = { at: previous ? Math.max(previous.at, item.at) : item.at, observedAt: previous ? Math.max(previous.observedAt, item.observedAt) : item.observedAt };
    });
    var ids = Object.create(null);
    saved.pending.slice(0, 100).forEach(function (item) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || item.name.length > 80 || typeof item.room !== 'string' || item.room.length > 80) return;
      var deviceKey = key(item.key);
      var at = date(item.at);
      if (!deviceKey || !seen[deviceKey] || at === null || at > time + futureAllowance || at > seen[deviceKey].at || ids[id(deviceKey, at)]) return;
      ids[id(deviceKey, at)] = true;
      pending.push({ key: deviceKey, name: label(item.name, '세탁기'), room: label(item.room, '기타'), at: new Date(at).toISOString(), time: at });
    });
    trim(time);
  }
  function observe(washers, reliable) {
    var time = clock();
    if (reliable === false || !Array.isArray(washers)) return { pending: copies(pending), added: [] };
    var added = Object.create(null);
    var batch = Object.create(null);
    trim(time);
    washers.forEach(function (washer) {
      if (!washer || typeof washer !== 'object' || typeof washer.name !== 'string' || typeof washer.room !== 'string') return;
      var deviceKey = key(washer.notificationKey);
      if (!deviceKey || (washer.completionAt !== null && typeof washer.completionAt !== 'string')) return;
      var at = date(washer.completionAt);
      if (at !== null && at > time + futureAllowance) at = null;
      if (!batch[deviceKey] || (at !== null && (batch[deviceKey].at === null || at > batch[deviceKey].at))) {
        batch[deviceKey] = { at: at, name: label(washer.name, '세탁기'), room: label(washer.room, '기타') };
      }
    });
    Object.keys(batch).forEach(function (deviceKey) {
      var washer = batch[deviceKey];
      var at = washer.at;
      var previous = seen[deviceKey];
      if (!previous) {
        seen[deviceKey] = { at: Math.max(at === null ? 0 : at, time), observedAt: time };
      } else {
        previous.observedAt = time;
        if (at !== null && at > previous.at) {
          previous.at = at;
          if (recent(at, time)) {
            var item = { key: deviceKey, name: washer.name, room: washer.room, at: new Date(at).toISOString(), time: at };
            pending.push(item);
            added[id(deviceKey, at)] = true;
          }
        }
      }
      if (Object.keys(seen).length > 100 || pending.length > 20) trim(time);
    });
    trim(time);
    persist();
    return { pending: copies(pending), added: copies(pending.filter(function (item) { return Boolean(added[id(item.key, item.time)]); })) };
  }
  function acknowledge(alertId) {
    pending = pending.filter(function (item) { return id(item.key, item.time) !== alertId; });
    persist();
    return copies(pending);
  }
  load();
  return {
    observe: observe,
    acknowledge: acknowledge,
    getPending: function () { return copies(pending); }
  };
}
