import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createWasherAlertTracker } from '../src/washer-alerts.mjs';

const storageKey = 'home-panel-washer-alerts-v1';
const start = Date.parse('2026-11-11T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const iso = at => new Date(at).toISOString();
const washer = (completionAt = null, notificationKey = 'washer-a', extra = {}) => ({ notificationKey, name: '세탁기', room: '주방', completionAt, ...extra });

function fixture(initial = null) {
  let time = start;
  let raw = initial;
  let writes = 0;
  const storage = {
    getItem(key) { assert.equal(key, storageKey); return raw; },
    setItem(key, value) { assert.equal(key, storageKey); raw = value; writes++; },
  };
  return {
    create: () => createWasherAlertTracker({ storage, now: () => time }),
    advance: delta => { time += delta; },
    now: () => time,
    raw: () => raw,
    saved: () => JSON.parse(raw),
    writes: () => writes,
  };
}

test('First observation baselines history silently and null baseline blocks later resurfaced older history', () => {
  const f = fixture();
  const tracker = f.create();
  assert.deepEqual(tracker.observe([washer(iso(start - 60000))]), { pending: [], added: [] });
  assert.equal(f.saved().seen[0].at, start);
  assert.equal(f.create().observe([washer(iso(start - 60000))]).added.length, 0);
  tracker.observe([washer(null, 'washer-b')]);
  f.advance(1000);
  assert.equal(tracker.observe([washer(iso(start - 100), 'washer-b')]).added.length, 0);
  assert.equal(tracker.observe([washer(iso(start), 'washer-b')]).added.length, 0);
  assert.equal(tracker.observe([washer(iso(start + 1000), 'washer-b')]).added.length, 1);
});

test('A genuine next completion alerts once, survives reload, and acknowledgement prevents replay', () => {
  const f = fixture();
  let tracker = f.create();
  tracker.observe([washer()]);
  f.advance(10000);
  const result = tracker.observe([washer(iso(f.now()))]);
  assert.equal(result.added.length, 1);
  assert.deepEqual(result.pending, result.added);
  assert.deepEqual(Object.keys(result.added[0]).sort(), ['at', 'id', 'name', 'room']);
  assert.equal(result.added[0].at, iso(f.now()));
  assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 0);
  assert.equal(tracker.observe([washer(null)]).pending.length, 1);
  tracker = f.create();
  assert.deepEqual(tracker.getPending(), result.pending);
  assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 0);
  assert.equal(tracker.acknowledge('unknown-id').length, 1);
  assert.deepEqual(tracker.acknowledge(result.added[0].id), []);
  tracker = f.create();
  assert.deepEqual(tracker.observe([washer(iso(f.now()))]), { pending: [], added: [] });
  f.advance(1000);
  assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 1);
});

test('Devices are independent, same-instant timezone variants deduplicate, and reordered polls never downgrade watermarks', () => {
  const f = fixture();
  const tracker = f.create();
  tracker.observe([washer(null, 'washer-a'), washer(null, 'washer-b')]);
  f.advance(1000);
  const first = tracker.observe([washer('2026-11-11T21:00:01+09:00', 'washer-b'), washer(iso(f.now()), 'washer-a')]);
  assert.equal(first.added.length, 2);
  assert.equal(new Set(first.added.map(item => item.id)).size, 2);
  const repeated = tracker.observe([washer(iso(f.now()), 'washer-b'), washer('2026-11-11T07:00:01-05:00', 'washer-a')]);
  assert.equal(repeated.added.length, 0);
  tracker.observe([washer(iso(start - 1000), 'washer-a'), washer(null, 'washer-b')]);
  assert.ok(f.saved().seen.every(item => item.at === f.now()));
  f.advance(1000);
  assert.equal(tracker.observe([washer(iso(f.now()), 'washer-a')]).added.length, 1);
  const fresh = fixture().create();
  assert.equal(fresh.observe([washer(iso(start - 1000)), washer(iso(start))]).added.length, 0);
});

test('Unreliable and malformed polls do not establish baselines, dismiss alerts or advance persisted state', () => {
  const f = fixture();
  const tracker = f.create();
  assert.deepEqual(tracker.observe([washer(iso(start))], false), { pending: [], added: [] });
  assert.equal(f.writes(), 0);
  tracker.observe([washer()]);
  f.advance(1000);
  const before = f.raw();
  assert.equal(tracker.observe([washer(iso(f.now()))], false).added.length, 0);
  assert.equal(f.raw(), before);
  assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 1);
  const after = f.raw();
  assert.equal(tracker.observe(null).pending.length, 1);
  assert.equal(tracker.observe([], false).pending.length, 1);
  assert.equal(f.raw(), after);
  assert.equal(tracker.observe([washer(null)]).pending.length, 1);
});

test('Invalid, too-old and excessively future completions are rejected without poisoning the next genuine event', () => {
  const f = fixture();
  const tracker = f.create();
  tracker.observe([washer()]);
  f.advance(2 * day);
  for (const completion of ['', 'unknown', '2026-02-31T00:00:00Z', '2026-11-13T99:00:00Z', 12, {}, false, iso(start + 1000), iso(f.now() + 60001)]) {
    assert.equal(tracker.observe([washer(completion)]).added.length, 0, String(completion));
  }
  assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 1);
  assert.equal(tracker.observe([washer(iso(f.now() + 60000))]).added.length, 1);
  assert.equal(tracker.observe([washer(iso(f.now()), '\ud800')]).added.length, 0);
  assert.equal(tracker.observe([washer(iso(f.now()), 'x'.repeat(129))]).added.length, 0);
});

test('Pending alerts persist beyond 24 hours until acknowledged and returned arrays are isolated copies', () => {
  const f = fixture();
  let tracker = f.create();
  tracker.observe([washer()]);
  f.advance(1000);
  const item = tracker.observe([washer(iso(f.now()))]).added[0];
  const copy = tracker.getPending();
  copy[0].name = 'changed';
  copy.push({ id: 'fake' });
  assert.equal(tracker.getPending().length, 1);
  assert.equal(tracker.getPending()[0].name, '세탁기');
  f.advance(3 * day);
  assert.equal(tracker.getPending().length, 1);
  assert.equal(tracker.observe([washer(null)]).pending.length, 1);
  tracker = f.create();
  assert.deepEqual(tracker.getPending(), [item]);
  assert.deepEqual(tracker.acknowledge(item.id), []);
  assert.deepEqual(f.create().getPending(), []);
});

test('Corrupt storage and storage access failures recover safely while in-memory acknowledgement still works', () => {
  for (const raw of ['{', 'null', '[]', JSON.stringify({ version: 2, seen: [], pending: [] }), 'x'.repeat(65537)]) {
    const f = fixture(raw);
    const tracker = f.create();
    assert.deepEqual(tracker.getPending(), []);
    tracker.observe([washer()]);
    f.advance(1000);
    assert.equal(tracker.observe([washer(iso(f.now()))]).added.length, 1);
  }
  let time = start;
  const tracker = createWasherAlertTracker({
    now: () => time,
    storage: { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } },
  });
  tracker.observe([washer()]);
  time += 1000;
  const item = tracker.observe([washer(iso(time))]).added[0];
  assert.ok(item.id);
  assert.deepEqual(tracker.acknowledge(item.id), []);
  assert.equal(tracker.observe([washer(iso(time))]).added.length, 0);
});

test('Loaded state accepts only bounded validated fields and cannot inject future, duplicate or untracked alerts', () => {
  const raw = JSON.stringify({
    version: 1, extraSecret: 'discard-me',
    seen: [
      { key: 'good', at: start, observedAt: start, extra: 'discard-me' },
      { key: 'future', at: start + 60001, observedAt: start },
      { key: 'bad-number', at: '123', observedAt: start },
      { key: '__proto__', at: start, observedAt: start },
    ],
    pending: [
      { key: 'good', name: '세탁기', room: '주방', at: iso(start), extraSecret: 'discard-me' },
      { key: 'good', name: '중복', room: '주방', at: iso(start) },
      { key: 'good', name: 'bad', room: '주방', at: iso(start + 1000) },
      { key: 'unknown', name: 'bad', room: '주방', at: iso(start) },
      { key: 'good', name: 'x'.repeat(81), room: '주방', at: iso(start - 1000) },
      { key: 'good', name: 'bad', room: false, at: iso(start - 1000) },
      { key: '__proto__', name: '다른 세탁기', room: '세탁실', at: iso(start) },
    ],
  });
  const f = fixture(raw);
  const tracker = f.create();
  assert.equal(tracker.getPending().length, 2);
  assert.doesNotMatch(JSON.stringify(tracker.getPending()), /discard-me|extraSecret|bad-number/);
  tracker.observe([]);
  assert.doesNotMatch(f.raw(), /discard-me|extraSecret|bad-number|future/);
  assert.equal(f.saved().seen.length, 2);
});

test('Stored device and pending counts are bounded and dismissal does not replay alerts dropped by the cap', () => {
  const f = fixture();
  const tracker = f.create();
  const washers = Array.from({ length: 120 }, (_, index) => washer(null, `device-${String(index).padStart(3, '0')}`));
  tracker.observe(washers);
  assert.equal(f.saved().seen.length, 100);
  f.advance(1000);
  const completed = washers.map(item => ({ ...item, completionAt: iso(f.now()) }));
  const result = tracker.observe(completed);
  assert.ok(result.pending.length <= 20);
  assert.ok(result.added.length <= 20);
  assert.ok(f.saved().seen.length <= 100);
  assert.ok(f.saved().pending.length <= 20);
  for (const item of tracker.getPending()) tracker.acknowledge(item.id);
  assert.deepEqual(tracker.observe(completed).pending, []);
});

test('The exact shared file runs as a standalone script without module, DOM or modern collection globals', async () => {
  const source = await readFile(new URL('../src/washer-alerts.mjs', import.meta.url), 'utf8');
  assert.match(source, /^export function createWasherAlertTracker\(options\)/);
  assert.equal((source.match(/\bexport\b/g) || []).length, 1);
  const context = { Set: undefined, Map: undefined, Promise: undefined };
  runInNewContext(source.replace(/^export /, ''), context);
  let time = start;
  const tracker = context.createWasherAlertTracker({ now: () => time });
  tracker.observe([washer()]);
  time += 1000;
  assert.equal(tracker.observe([washer(iso(time))]).added.length, 1);
});
