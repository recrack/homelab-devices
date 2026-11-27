import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isIPv4 } from 'node:net';

export function privateIPv4(value) {
  if (typeof value !== 'string' || !isIPv4(value)) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
export function validateSetup(input) {
  if (!input || input.schema !== 1 || !privateIPv4(input.server?.address) || !privateIPv4(input.device?.address) || input.server.address === input.device.address || input.server.port !== 4173 || input.server.legacyPort !== 4181) throw new Error('서버와 CT1105-SB의 서로 다른 사설 IPv4 주소가 필요합니다.');
  const url = new URL(input.homeAssistant?.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Home Assistant의 기본 http/https 주소를 입력하세요.');
  if (!Array.isArray(input.rooms) || input.rooms.length !== 2) throw new Error('방 이름 두 개가 필요합니다.');
  const names = new Set(), scenes = new Set();
  const rooms = input.rooms.map((room, index) => {
    if (room?.id !== ['living', 'bedroom'][index] || typeof room.name !== 'string' || !room.name.trim() || room.name.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(room.name) || names.has(room.name.trim())) throw new Error('서로 다른 방 이름을 입력하세요.');
    names.add(room.name.trim());
    const selected = {};
    for (const action of ['on', 'off']) {
      const id = room.scenes?.[action];
      if (id != null && (typeof id !== 'string' || !/^scene\.[a-z0-9_]{1,120}$/.test(id) || scenes.has(id))) throw new Error('장면은 중복 없는 scene. 형식의 엔티티 ID로 입력하세요.');
      selected[action] = id || null;
      if (id) scenes.add(id);
    }
    return { id: room.id, name: room.name.trim(), scenes: selected };
  });
  let weather = { source: 'naver', location: '서울' };
  if (input.weather != null) {
    if (typeof input.weather !== 'object' || Array.isArray(input.weather)) throw new Error('날씨 설정 형식이 올바르지 않습니다.');
    const source = input.weather.source === undefined ? 'naver' : input.weather.source;
    if (!['naver', 'ha'].includes(source)) throw new Error('날씨 출처는 naver 또는 ha만 지원합니다.');
    if (source === 'ha') {
      weather = { source: 'ha', location: null };
    } else {
      const rawLocation = input.weather.location == null ? '서울' : input.weather.location;
      if (typeof rawLocation !== 'string' || !rawLocation.trim() || rawLocation.trim().length > 40 || /[\u0000-\u001f\u007f<>&"'\\]/.test(rawLocation)) {
        throw new Error('날씨 지역명을 올바르게 입력하세요.');
      }
      weather = { source: 'naver', location: rawLocation.trim() };
    }
  }
  return { schema: 1, server: { address: input.server.address, port: 4173, legacyPort: 4181 }, device: { address: input.device.address }, homeAssistant: { url: url.origin }, rooms, weather };
}
export async function readPrivateJson(path, maximum = 65536) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || info.uid !== process.getuid() || info.nlink !== 1 || info.mode & 0o077 || info.size > maximum) throw new Error('설정 파일의 소유자와 비공개 권한을 확인하세요.');
    return JSON.parse(await file.readFile('utf8'));
  } finally { await file?.close(); }
}
export async function loadSetup(path) { return validateSetup(await readPrivateJson(path)); }
export function sceneCatalog(config) {
  return config.rooms.flatMap(room => ['on', 'off'].filter(action => room.scenes[action]).map(action => ({ id: room.id + '-' + action, type: 'scene', entity: room.scenes[action], label: room.name + ' ' + (action === 'on' ? '켜기' : '끄기') })));
}
