import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

const token = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const random = () => randomBytes(32).toString('hex');
const failure = () => new Error('Invalid private panel credentials');

export function validLegacyAuth(value, origin) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'csrf,expires,launchToken,origin,session,version' &&
    value.version === 1 && value.origin === origin && token(value.launchToken) &&
    token(value.session) && token(value.csrf) && Number.isSafeInteger(value.expires) && value.expires >= 0;
}

async function readPrivateJson(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) || info.nlink !== 1 || info.size > 4096) throw failure();
    return JSON.parse(await handle.readFile({ encoding: 'utf8' }));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw failure();
  } finally {
    await handle?.close();
  }
}

export async function writePrivateJson(path, value) {
  const temporary = join(dirname(path), `.${basename(path)}.${random()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(JSON.stringify(value) + '\n');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
  } catch {
    throw new Error('Panel credential persistence failed');
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}

export async function loadLegacyAuth(path, origin) {
  const saved = await readPrivateJson(path);
  if (saved !== undefined) {
    if (!validLegacyAuth(saved, origin)) throw failure();
    return saved;
  }
  const created = { version: 1, origin, launchToken: random(), session: random(), csrf: random(), expires: 0 };
  await writePrivateJson(path, created);
  return created;
}

export async function loadDeviceToken(path, origin) {
  const saved = await readPrivateJson(path);
  if (saved === undefined) return null;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) ||
      Object.keys(saved).sort().join(',') !== 'origin,token,version' ||
      saved.version !== 1 || saved.origin !== origin || !token(saved.token)) throw failure();
  return saved.token;
}
