export function createPanelSnapshotCache(options) {
  options = options || {};
  var storage = options.storage || null;
  var now = typeof options.now === 'function' ? options.now : Date.now;
  var key = 'home-panel-snapshot-v1';
  var maxAge = 7 * 24 * 60 * 60 * 1000;
  var memory = null;

  function time() {
    var value;
    try { value = now(); } catch (error) { return null; }
    return typeof value === 'number' && isFinite(value) && value > 0 && value <= 8640000000000000 ? value : null;
  }
  function keys(value, expected) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).sort().join(',') === expected;
  }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
    var at = Date.parse(value);
    if (!isFinite(at) || at <= 0) return null;
    return new Date(at).toISOString() === value.replace(/(?::\d{2})Z$/, function (part) { return part.slice(0, -1) + '.000Z'; }) ? at : null;
  }
  function recent(at, current) {
    return at !== null && current !== null && at <= current && at >= current - maxAge;
  }
  function reading(value, low, high) {
    return typeof value === 'number' && isFinite(value) && value >= low && value <= high ? value : null;
  }
  function validate(value, current) {
    if (!keys(value, 'rooms,savedAt,schema,updatedAt') || value.schema !== 1 ||
        !recent(date(value.savedAt), current) || !recent(date(value.updatedAt), current) ||
        date(value.updatedAt) > date(value.savedAt) || !Array.isArray(value.rooms) ||
        value.rooms.length < 1 || value.rooms.length > 2) return null;
    var rooms = [], seen = {}, i, room;
    for (i = 0; i < value.rooms.length; i += 1) {
      room = value.rooms[i];
      if (!keys(room, 'co2,humidity,id,name,temperature') || (room.id !== 'living' && room.id !== 'bedroom') || typeof room.name !== 'string' || !room.name || room.name.length > 40 || /[\u0000-\u001f\u007f]/.test(room.name) || seen[room.id] ||
          (room.temperature !== null && reading(room.temperature, -60, 85) === null) ||
          (room.humidity !== null && reading(room.humidity, 0, 100) === null) ||
          (room.co2 !== null && reading(room.co2, 0, 100000) === null) ||
          (room.temperature === null && room.humidity === null && room.co2 === null)) return null;
      seen[room.id] = true;
      rooms.push({id: room.id, name: room.name, temperature: room.temperature, humidity: room.humidity, co2: room.co2, hasCo2: room.co2 !== null});
    }
    return {mode: 'cached', connected: false, serverReachable: false, rooms: rooms, savedAt: value.savedAt, updatedAt: value.updatedAt};
  }
  function load() {
    var raw = memory;
    try { if (!raw && storage) raw = storage.getItem(key); } catch (error) {}
    if (typeof raw !== 'string' || raw.length > 4096) return null;
    try { return validate(JSON.parse(raw), time()); } catch (error) { return null; }
  }
  function save(state) {
    var current = time(), rooms = [], seen = {}, i, source, room, updated;
    if (!state || state.mode !== 'live' || state.connected !== true || state.serverReachable !== true || state.error ||
        !Array.isArray(state.rooms) || !recent(date(state.updatedAt), current)) return false;
    updated = new Date(date(state.updatedAt)).toISOString();
    for (i = 0; i < state.rooms.length && i < 100; i += 1) {
      source = state.rooms[i];
      if (!source || (source.id !== 'living' && source.id !== 'bedroom') || typeof source.name !== 'string' || !source.name || source.name.length > 40 || /[\u0000-\u001f\u007f]/.test(source.name) || seen[source.id]) continue;
      room = {id: source.id, name: source.name, temperature: reading(source.temperature, -60, 85), humidity: reading(source.humidity, 0, 100),
        co2: source.hasCo2 === true ? reading(source.co2, 0, 100000) : null};
      if (room.temperature === null && room.humidity === null && room.co2 === null) continue;
      seen[source.id] = true;
      rooms.push(room);
    }
    if (!rooms.length) return false;
    memory = JSON.stringify({schema: 1, savedAt: new Date(current).toISOString(), updatedAt: updated, rooms: rooms});
    try { if (storage) storage.setItem(key, memory); } catch (error) {}
    return true;
  }
  return {save: save, load: load};
}
