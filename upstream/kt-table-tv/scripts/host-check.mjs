import { release } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkHost(project, { platform = process.platform, kernel = release(), node = process.versions.node } = {}) {
  const [major, minor] = node.split('.').map(Number);
  if (!Number.isInteger(major) || major < 22 || major === 22 && minor < 12) throw new Error('Node.js 22.12 이상을 먼저 설치하세요.');
  if (!['darwin', 'linux'].includes(platform)) throw new Error('Windows에서는 WSL 2 Ubuntu의 Linux Node.js로 실행하세요. Windows용 Node.js는 지원하지 않습니다.');
  if (platform === 'linux' && /microsoft/i.test(kernel)) {
    if (!/wsl2|microsoft-standard/i.test(kernel)) throw new Error('WSL 1은 지원하지 않습니다. WSL 2 Ubuntu를 사용하세요.');
    if (/^\/mnt\/[a-z](?:\/|$)/i.test(resolve(project))) throw new Error('프로젝트를 WSL의 Linux 홈 폴더에 두세요. Windows 드라이브의 /mnt 경로에는 인증정보를 저장하지 않습니다.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { checkHost(resolve(fileURLToPath(new URL('..', import.meta.url)))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
