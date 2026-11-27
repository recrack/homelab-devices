import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { isIPv4 } from 'node:net';

const failure = () => new Error('Invalid private panel network configuration');

function privateIPv4(value) {
  if (typeof value !== 'string' || !isIPv4(value)) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function validateLegacyNetwork(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'device,host,version' || value.version !== 1 ||
      !privateIPv4(value.host) || (value.device !== null && !privateIPv4(value.device)) ||
      value.host === value.device) throw failure();
  return Object.freeze({ version: 1, host: value.host, device: value.device });
}

function privateFile(info) {
  return info.isFile() && info.uid === process.getuid() && !(info.mode & 0o077) &&
    info.nlink === 1 && info.size <= 4096;
}

export async function loadLegacyNetwork(path) {
  let before;
  try { before = await lstat(path); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Run the setup launcher for your operating system first.');
    throw failure();
  }
  let handle;
  try {
    if (!privateFile(before)) throw failure();
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await handle.stat();
    if (!privateFile(info) || info.dev !== before.dev || info.ino !== before.ino) throw failure();
    return validateLegacyNetwork(JSON.parse(await handle.readFile({ encoding: 'utf8' })));
  } catch { throw failure(); } finally { await handle?.close(); }
}
