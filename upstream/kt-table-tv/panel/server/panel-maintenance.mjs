import http from 'node:http';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';

export const MAINTENANCE_FRESH_MS = 120000;
const packageName = 'dev.homepanel.community';
const states = ['idle', 'checking', 'downloading', 'accepted', 'installed', 'error'];
const errors = ['download', 'installation', 'home', 'root', 'unknown'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const version = value => Number.isInteger(value) && value >= 1 && value <= 2147483647 ? value : null;
const timestamp = (value, now) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now ? value : null;

export function projectMaintenanceSummary(value, now = Date.now()) {
  const lastSeen = timestamp(value?.lastSeen, now);
  const available = value?.available === true && lastSeen !== null && version(value.versionCode) !== null;
  const errorAt = timestamp(value?.lastError?.at, now);
  return {
    available,
    online: available && value.online === true && now - Date.parse(lastSeen) < MAINTENANCE_FRESH_MS,
    lastSeen: available ? lastSeen : null,
    versionCode: available ? value.versionCode : null,
    versionName: available && typeof value.versionName === 'string' && /^\d{1,3}\.\d{1,4}(?:\.\d{1,4})?$/.test(value.versionName) ? value.versionName : null,
    state: available && states.includes(value.state) ? value.state : 'unknown',
    home: available && ['panel', 'other'].includes(value.home) ? value.home : 'unknown',
    root: available && ['ok', 'unavailable'].includes(value.root) ? value.root : 'unknown',
    bootCompleted: available && typeof value.bootCompleted === 'boolean' ? value.bootCompleted : null,
    managementEnabled: available && typeof value.managementEnabled === 'boolean' ? value.managementEnabled : null,
    verifiedBuild: available && value.verifiedBuild === true,
    lastError: errorAt && errors.includes(value.lastError?.code) ? { at: errorAt, code: value.lastError.code } : null,
  };
}

function report(value, now) {
  if (!object(value) || !Number.isInteger(value.receivedAt) || value.receivedAt < 1 || value.receivedAt * 1000 > now) return null;
  const body = value.report;
  if (!object(body) || body.schema !== 1 || body.package !== packageName || !version(body.versionCode)) return null;
  return { at: value.receivedAt * 1000, body };
}

function errorCode(reason) {
  if (typeof reason !== 'string') return 'unknown';
  if (/^(download_|release_|apk_|signature_)/.test(reason)) return 'download';
  if (/^(install_|staging_|update_|worker_)/.test(reason)) return 'installation';
  if (/^home_/.test(reason)) return 'home';
  if (/^(root_|socket_)/.test(reason)) return 'root';
  return 'unknown';
}

async function readJson(directory, name, limit = 65536) {
  let file;
  try {
    file = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > limit || info.uid !== process.getuid()) return null;
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const result = await file.read(buffer, length, buffer.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    return length <= limit ? JSON.parse(buffer.subarray(0, length).toString('utf8')) : null;
  } catch { return null; }
  finally { await file?.close().catch(() => {}); }
}

function isPrivateLanIpv4(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false;
  const parts = value.split('.').map(Number);
  if (parts.some(item => !Number.isInteger(item) || item < 0 || item > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function defaultSendReturn({ host, port }) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify({ source: 'web' }), 'utf8');
    const req = http.request({
      hostname: host,
      port,
      path: '/internal/return-home',
      method: 'POST',
      timeout: 5000,
      headers: {
        Host: `${host}:${port}`,
        'Content-Type': 'application/json',
        'Content-Length': String(payload.length),
      },
    }, res => {
      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > 2048) { req.destroy(new Error('응답이 너무 큽니다.')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('관리 서버가 복귀 요청을 거부했습니다.'));
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (parsed?.ok === true) return resolve(parsed);
        } catch {}
        reject(new Error('관리 서버 응답을 확인하지 못했습니다.'));
      });
    });
    req.on('timeout', () => req.destroy(new Error('관리 서버 응답 시간이 초과되었습니다.')));
    req.on('error', () => reject(new Error('관리 서버에 연결하지 못했습니다.')));
    req.end(payload);
  });
}

export function createPanelMaintenance({ directory, now = Date.now, sendReturn = defaultSendReturn }) {
  let lastError = null;
  return {
    async snapshot() {
      const current = now();
      const [saved, savedHome, savedStartup, catalog] = await Promise.all([
        readJson(directory, 'latest-report.json', 8192), readJson(directory, 'latest-home-report.json'),
        readJson(directory, 'latest-startup-report.json'), readJson(directory, 'known-good-catalog.json'),
      ]);
      const latest = report(saved, current);
      if (!latest || !states.includes(latest.body.status)) return projectMaintenanceSummary(null, current);
      const body = latest.body;
      let home = ['panel', 'other'].includes(body.home) ? body.home : 'unknown';
      const homeReport = report(savedHome, current), startup = report(savedStartup, current);
      if (home === 'unknown' && homeReport && homeReport.body.versionCode === body.versionCode && homeReport.at >= latest.at) {
        const resolved = homeReport.body.home?.resolved;
        if (typeof resolved === 'string' && resolved.startsWith(packageName + '/')) home = 'panel';
        else if (typeof resolved === 'string' && resolved.includes('/')) home = 'other';
      }
      const startupCurrent = startup && startup.body.versionCode === body.versionCode && startup.at >= latest.at - MAINTENANCE_FRESH_MS;
      const verification = await readJson(directory, `prepared-v${body.versionCode}/verification.json`, 8192);
      const verifiedMetadata = verification?.versionCode === body.versionCode && verification.deviceVerified === true && /^[0-9a-f]{64}$/.test(verification.sha256 || '');
      const knownGood = catalog?.schema === 1 && catalog.package === packageName && Array.isArray(catalog.artifacts) && catalog.artifacts.some(item => item?.versionCode === body.versionCode && item.verifiedOnDevice === true && /^[0-9a-f]{64}$/.test(item.sha256 || ''));
      if (body.status === 'error' && (!lastError || latest.at >= Date.parse(lastError.at))) lastError = { at: new Date(latest.at).toISOString(), code: errorCode(body.reason) };
      return projectMaintenanceSummary({
        available: true, online: true, lastSeen: new Date(latest.at).toISOString(),
        versionCode: body.versionCode, versionName: verifiedMetadata ? verification.versionName : null,
        state: body.status, home, root: body.rootStatus,
        bootCompleted: startupCurrent && ['0', '1'].includes(startup.body.startup?.properties?.['sys.boot_completed']) ? startup.body.startup.properties['sys.boot_completed'] === '1' : null,
        managementEnabled: startupCurrent ? startup.body.currentPrefs?.enabled : null,
        verifiedBuild: verifiedMetadata || knownGood, lastError,
      }, current);
    },
    async requestReturnHome() {
      const config = await readJson(directory, 'config.json', 4096);
      if (!object(config) || config.version !== 1 || config.port !== 4186 || !isPrivateLanIpv4(config.host)) {
        throw new Error('기기 관리 서버 설정이 없습니다.');
      }
      return sendReturn({ host: config.host, port: config.port });
    },
  };
}
