import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHost } from '../../scripts/host-check.mjs';

test('Supported POSIX hosts and WSL2 Linux home pass while Windows and old Node fail before setup', () => {
  for (const [platform, kernel] of [['darwin', 'Darwin'], ['linux', '6.8.0-generic'], ['linux', '6.6.87.2-microsoft-standard-WSL2']]) {
    assert.doesNotThrow(() => checkHost('/home/example/project', { platform, kernel, node: '22.12.0' }));
  }
  assert.throws(() => checkHost('C:\\example', { platform: 'win32', kernel: 'Windows', node: '24.0.0' }), /WSL 2/);
  for (const node of ['20.0.0', '22.11.0', 'invalid']) {
    assert.throws(() => checkHost('/home/example/project', { platform: 'linux', kernel: 'Linux', node }), /22.12/);
  }
});

test('WSL1 and Windows drive paths do not receive generated credentials', () => {
  assert.throws(() => checkHost('/home/example/project', { platform: 'linux', kernel: '4.4.0-Microsoft', node: '24.0.0' }), /WSL 1/);
  for (const path of ['/mnt/c/project', '/mnt/D/with spaces', '/mnt/c']) {
    assert.throws(() => checkHost(path, { platform: 'linux', kernel: '6.6.87-microsoft-standard-WSL2', node: '24.0.0' }), /Linux 홈/);
  }
});
