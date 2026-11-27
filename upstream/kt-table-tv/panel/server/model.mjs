import { washerSummaries } from './washer.mjs';

const missing = new Set(['unknown', 'unavailable', 'none', '']);
export const isAvailable = state => !!state && !missing.has(state.state);
export function numeric(state) {
  if (!isAvailable(state) || typeof state.state !== 'string' || !state.state.trim()) return null;
  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}
function co2Ppm(state) {
  const unit = state?.attributes?.unit_of_measurement;
  if (typeof unit !== 'string' || unit.trim().toLowerCase() !== 'ppm') return null;
  const value = numeric(state);
  return value !== null && value >= 0 ? value : null;
}
const label = s => s.attributes?.friendly_name || s.entity_id;
function sceneTimestamp(value) {
  if(typeof value!=='string')return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match||!Number.isFinite(Date.parse(value)))return null;
  const [,year,month,day,hour,minute,second]=match.map(Number);
  if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)return null;
  return value;
}
const weatherConditions = {
  'clear-night': '맑은 밤', cloudy: '흐림', fog: '안개', hail: '우박', lightning: '천둥·번개',
  'lightning-rainy': '뇌우', partlycloudy: '구름 조금', pouring: '강한 비', rainy: '비',
  snowy: '눈', 'snowy-rainy': '눈·비', sunny: '맑음', windy: '바람', 'windy-variant': '흐리고 바람', exceptional: '특이 기상',
};
function weatherText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || fallback : fallback;
}
export function selectedWeatherState(states, entityMap) {
  const candidates = states.filter(state => {
    const entry = entityMap.get(state.entity_id);
    return state.entity_id.startsWith('weather.') && !entry?.disabled_by && !entry?.hidden_by && entry?.entity_category == null;
  }).sort((a, b) => Number(Object.hasOwn(weatherConditions, b.state)) - Number(Object.hasOwn(weatherConditions, a.state)) || a.entity_id.localeCompare(b.entity_id));
  return candidates[0] || null;
}
function weatherSummary(states, entityMap) {
  const state = selectedWeatherState(states, entityMap);
  if (!state) return null;
  const available = Object.hasOwn(weatherConditions, state.state);
  const raw = state.attributes?.temperature;
  let temperatureC = null;
  if (available && (typeof raw === 'number' || (typeof raw === 'string' && raw.trim())) && Number.isFinite(Number(raw))) {
    const unit = state.attributes?.temperature_unit;
    if (unit === '°C') temperatureC = Number(raw);
    else if (unit === '°F') temperatureC = (Number(raw) - 32) / 9 * 5;
  }
  const name = weatherText(state.attributes?.friendly_name, '날씨');
  const platform = entityMap.get(state.entity_id)?.platform;
  const source = platform === 'met' ? 'MET Norway' : platform === 'open_meteo' ? 'Open-Meteo' : weatherText(state.attributes?.friendly_name, 'Home Assistant');
  return {
    available, conditionCode: available ? state.state : null, condition: available ? weatherConditions[state.state] : null,
    temperatureC, name, source,
    updatedAt: typeof state.last_updated === 'string' && state.last_updated.length <= 64 ? sceneTimestamp(state.last_updated) : null,
  };
}
export function buildDashboard(states, registry = [], devices = [], areas = [], entries = [], config = { rooms: [] }) {
  const configuredScenes = new Set(config.rooms.flatMap(room => Object.values(room.scenes)).filter(Boolean));
  const entityMap = new Map(registry.map(e => [e.entity_id, e]));
  const deviceMap = new Map(devices.map(d => [d.id, d]));
  const areaMap = new Map(areas.map(a => [a.area_id, a.name]));
  const roomAreas = new Map(areas.map(a => [a.name, a]));
  const { washers, entityIds: washerEntities } = washerSummaries(states, registry, devices, areas, entries);
  function roomFor(s) {
    const entry = entityMap.get(s.entity_id);
    const device = deviceMap.get(entry?.device_id);
    const area = areaMap.get(entry?.area_id || device?.area_id);
    if (area) return area;
    return '기타';
  }
  const sceneStates=states.filter(s=>{
    const entry=entityMap.get(s.entity_id);
    return configuredScenes.has(s.entity_id)&&!entry?.disabled_by&&!entry?.hidden_by;
  });
  const isCo2Sensor = s => {
    const entry = entityMap.get(s.entity_id);
    return s.entity_id.startsWith('sensor.') && s.attributes?.device_class === 'carbon_dioxide' &&
      entry?.entity_category == null && !entry?.disabled_by && !entry?.hidden_by;
  };
  const relevant = states.filter(s => {
    if(s.entity_id.startsWith('scene.') || s.entity_id.startsWith('weather.') || washerEntities.has(s.entity_id))return false;
    const platform = entityMap.get(s.entity_id)?.platform;
    return isCo2Sensor(s) || ['tuya', 'smartthings'].includes(platform) ||
      ['light', 'switch', 'fan', 'climate'].includes(s.entity_id.split('.')[0]) ||
      (['temperature', 'humidity'].includes(s.attributes?.device_class) &&
        entityMap.get(s.entity_id)?.entity_category == null && !entityMap.get(s.entity_id)?.disabled_by);
  });
  const names = config.rooms.map(room => room.name);
  const rooms = names.map(name => {
    const sensors = relevant.filter(s => roomFor(s) === name);
    const find = type => {
      const selected = roomAreas.get(name)?.[`${type}_entity_id`];
      if (selected) return sensors.find(s => s.entity_id === selected && s.attributes?.device_class === type &&
        !entityMap.get(s.entity_id)?.disabled_by && !entityMap.get(s.entity_id)?.hidden_by);
      return sensors.find(s => s.attributes?.device_class === type && isAvailable(s)) || sensors.find(s => s.attributes?.device_class === type);
    };
    const temp = find('temperature'), humidity = find('humidity');
    const temperatureDevice = deviceMap.get(entityMap.get(temp?.entity_id)?.device_id);
    const co2Sensors = sensors.filter(isCo2Sensor);
    const co2 = co2Sensors.find(s => co2Ppm(s) !== null) || co2Sensors[0];
    let temperature = numeric(temp);
    if (temperature !== null && temp.attributes?.unit_of_measurement === '°F') temperature = (temperature - 32) * 5 / 9;
    return { id: config.rooms.find(room => room.name === name).id, name, temperature, humidity: numeric(humidity), temperatureEntity: temp?.entity_id || null, humidityEntity: humidity?.entity_id || null,
      temperatureSource: temp ? temperatureDevice?.name_by_user || temperatureDevice?.name || label(temp) : null,
      co2: co2Ppm(co2), co2Entity: co2?.entity_id || null, co2ReportedAt: co2?.last_reported || co2?.last_updated || null,
      updatedAt: [temp?.last_updated, humidity?.last_updated, co2?.last_updated].filter(Boolean).sort().at(-1) || null, history: [] };
  });
  return { rooms, weather: weatherSummary(states, entityMap), scenes:sceneStates.map(s=>({entityId:s.entity_id,name:label(s),room:config.rooms.find(room => Object.values(room.scenes).includes(s.entity_id))?.name || roomFor(s),platform:entityMap.get(s.entity_id)?.platform || 'homeassistant',
    available:s.state!=='unavailable',lastTriggered:sceneTimestamp(s.state)})), devices: relevant.map(s => {
    const domain = s.entity_id.split('.')[0];
    const kind = ['fan', 'light', 'switch'].includes(domain) ? domain : domain === 'device_tracker' ? 'tracker' : 'sensor';
    const available = isAvailable(s);
    return { entityId: s.entity_id, name: label(s), room: roomFor(s), platform: entityMap.get(s.entity_id)?.platform || domain,
      kind, state: s.state, available, controllable: available && ['fan', 'light', 'switch'].includes(domain) };
  }).concat(washers), integrations: ['tuya', 'smartthings', 'lg_thinq'].map(domain => {
    const matching = entries.filter(e => e.domain === domain);
    const status = matching.some(e => e.state === 'loaded') ? 'connected' : matching.length ? 'error' : 'unknown';
    return { name: domain === 'tuya' ? 'Tuya Smart' : domain === 'smartthings' ? 'SmartThings' : 'LG ThinQ', status };
  }) };
}
export function sceneRequestEntityId(body) {
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'entityId')||typeof body.entityId!=='string'||!/^scene\.[a-z0-9_]+$/.test(body.entityId))throw new Error('실행할 장면을 다시 선택해 주세요.');
  return body.entityId;
}
export function validateSceneRun(body,scenes) {
  const entityId=sceneRequestEntityId(body);
  if(!Array.isArray(scenes)||!scenes.some(scene=>scene.entityId===entityId&&scene.available===true))throw new Error('지금 실행할 수 없는 장면입니다. 연결 상태를 확인하고 목록을 새로고침해 주세요.');
  return {entityId};
}
export function validateControl(body, states) {
  if (!body || typeof body.entityId !== 'string' || !['turn_on', 'turn_off'].includes(body.action)) throw new Error('지원하지 않는 제어 요청입니다.');
  const domain = body.entityId.split('.')[0];
  if (!['fan', 'light', 'switch'].includes(domain)) throw new Error('이 종류의 기기는 아직 제어할 수 없습니다.');
  const state = states.find(s => s.entity_id === body.entityId);
  if (!isAvailable(state)) throw new Error('기기가 연결되어 있지 않습니다.');
  return {domain, action:body.action, entityId:body.entityId};
}
