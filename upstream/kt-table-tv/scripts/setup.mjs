import { mkdir, chmod, lstat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { validateSetup, loadSetup, readPrivateJson } from '../panel/server/config.mjs';
import { writePrivateJson } from '../panel/server/legacy-auth.mjs';
import { checkHost } from './host-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fresh = () => randomBytes(32).toString('hex');
const validToken = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
async function optional(path) { try { return await readPrivateJson(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid()) throw new Error('설정 폴더가 올바르지 않습니다.');
  await chmod(path, 0o700);
  const protectedInfo = await lstat(path);
  if (protectedInfo.mode & 0o077) throw new Error('이 파일시스템은 비공개 폴더 권한을 적용하지 못합니다. Linux 홈 폴더 또는 macOS 볼륨을 사용하세요.');
}
export async function initialize(project, input) {
  const config = validateSetup(input), runtime = resolve(project, 'runtime'), legacy = resolve(runtime, 'legacy');
  await privateDirectory(runtime); await privateDirectory(legacy);
  const previous = await optional(resolve(runtime, 'setup.json'));
  const device = await optional(resolve(legacy, 'device.json'));
  const auth = await optional(resolve(legacy, 'auth.json'));
  if (device && (device.version !== 1 || !validToken(device.token))) throw new Error('기존 기기 인증 파일이 유효하지 않습니다. 새 키로 덮어쓰지 않았습니다.');
  if (auth && (auth.version !== 1 || !['launchToken', 'session', 'csrf'].every(key => validToken(auth[key])) || !Number.isSafeInteger(auth.expires))) throw new Error('기존 인증 파일이 유효하지 않습니다. 새 키로 덮어쓰지 않았습니다.');
  const origin = `http://${config.server.address}:4181`;
  await writePrivateJson(resolve(legacy, 'device.json'), { version: 1, origin, token: device?.token || fresh() });
  await writePrivateJson(resolve(legacy, 'auth.json'), { version: 1, origin, launchToken: auth?.launchToken || fresh(), session: auth?.session || fresh(), csrf: auth?.csrf || fresh(), expires: auth?.expires || 0 });
  await writePrivateJson(resolve(legacy, 'network.json'), { version: 1, host: config.server.address, device: config.device.address });
  await writePrivateJson(resolve(runtime, 'setup.json'), config);
  return { config, changedAddress: Boolean(previous && (previous.server?.address !== config.server.address || previous.device?.address !== config.device.address)) };
}

async function main() {
  checkHost(root);
  let previous; try { previous = await loadSetup(resolve(root, 'runtime/setup.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const args = process.argv.slice(2), flags = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--(?:ha-url|host|device|room-one|room-two|scene-one-on|scene-one-off|scene-two-on|scene-two-off)$/.test(args[i]) || args[i + 1] === undefined) throw new Error('설정 인수를 확인하세요.');
    flags[args[i].slice(2)] = args[i + 1];
  }
  const cli = args.length > 0, prompt = cli ? null : createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (key, label, current = '', optionalValue = false) => {
    if (Object.hasOwn(flags, key)) return flags[key] === '-' ? null : flags[key];
    if (cli) return current || (optionalValue ? null : '');
    const answer = (await prompt.question(`${label}${current ? ` [${current}]` : ''}${optionalValue ? ' (생략 Enter, 기존 값 삭제 -)' : ''}: `)).trim();
    return answer === '-' && optionalValue ? null : answer || current || null;
  };
  try {
    console.log('CT1105-SB 홈 패널 · 처음 연결 설정\n방 이름은 Home Assistant의 영역 이름과 똑같이 적으세요. 장면은 없어도 시작할 수 있습니다.');
    const input = { schema: 1, homeAssistant: { url: await ask('ha-url', 'Home Assistant 주소', previous?.homeAssistant.url) }, server: { address: await ask('host', '패널 서버 사설 IPv4 주소', previous?.server.address), port: 4173, legacyPort: 4181 }, device: { address: await ask('device', 'CT1105-SB 사설 IPv4 주소', previous?.device.address) }, rooms: [] };
    for (let i = 0; i < 2; i++) {
      const key = i ? 'two' : 'one', old = previous?.rooms[i];
      input.rooms.push({ id: i ? 'bedroom' : 'living', name: await ask('room-' + key, `방 ${i + 1} 이름`, old?.name), scenes: { on: await ask('scene-' + key + '-on', `방 ${i + 1} 켜기 장면 엔티티 ID`, old?.scenes.on, true), off: await ask('scene-' + key + '-off', `방 ${i + 1} 끄기 장면 엔티티 ID`, old?.scenes.off, true) } });
    }
    const result = await initialize(root, input);
    console.log('설정 완료. 기존 인증 키는 보존하고, 첫 실행이면 새 키를 만들었습니다.');
    if (result.changedAddress) console.log('주소가 변경되었습니다. 서버를 다시 시작하고 Android 앱도 다시 빌드하세요.');
    console.log('macOS는 Start.command, Linux/WSL은 Start.sh로 시작한 뒤 http://localhost:4173 에서 Home Assistant 연결을 누르세요.');
  } finally { prompt?.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
