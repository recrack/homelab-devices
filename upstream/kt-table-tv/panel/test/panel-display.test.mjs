import test from 'node:test';
import assert from 'node:assert/strict';
import { autoIdleDelay, idleMinutes, installWakeShield } from '../src/panel-display.mjs';

test('Automatic standby defaults off, accepts only configured delays, and leaves media and active actions alone', () => {
  for (const value of [null, undefined, '', 'invalid', '5minutes', -1, 100000]) assert.equal(idleMinutes(value), 0);
  assert.equal(autoIdleDelay('5'), 300000);
  assert.equal(autoIdleDelay(10), 600000);
  assert.equal(autoIdleDelay(0), 0);
  for (const state of [{ media: true }, { busy: true }, { hidden: true }, { alertActive: true }]) assert.equal(autoIdleDelay(5, state), 0);
});

function fixture() {
  const target = new EventTarget();
  let woke = 0;
  let timer;
  const stop = installWakeShield(target, () => woke++, { schedule: callback => { timer = callback; return 1; }, cancel: () => { timer = null; } });
  let underlying = 0;
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) target.addEventListener(type, () => underlying++);
  return {
    emit(type, values = {}) { const event = new Event(type, { cancelable: true }); Object.assign(event, values); target.dispatchEvent(event); return event; },
    wakeCount: () => woke,
    passed: () => underlying,
    finish: () => timer?.(),
    stop,
  };
}

test('The complete waking touch and following generated click are consumed before controls become interactive', () => {
  const f = fixture();
  assert.equal(f.emit('pointerdown', { pointerId: 1 }).defaultPrevented, true);
  assert.equal(f.wakeCount(), 0);
  f.emit('pointerup', { pointerId: 1 });
  assert.equal(f.wakeCount(), 1);
  f.stop();
  f.emit('click');
  assert.equal(f.passed(), 0);
  f.finish();
  f.emit('click');
  assert.equal(f.passed(), 1);
});

test('Held keys and multi-touch finish before waking, with no input reaching underlying controls', () => {
  const keyboard = fixture();
  keyboard.emit('keydown', { code: 'Enter' });
  keyboard.emit('keydown', { code: 'Enter' });
  assert.equal(keyboard.wakeCount(), 0);
  keyboard.emit('keyup', { code: 'Enter' });
  keyboard.emit('click');
  assert.equal(keyboard.wakeCount(), 1);
  assert.equal(keyboard.passed(), 0);
  keyboard.finish();
  const touch = fixture();
  touch.emit('pointerdown', { pointerId: 1 });
  touch.emit('pointerdown', { pointerId: 2 });
  touch.emit('pointerup', { pointerId: 1 });
  assert.equal(touch.wakeCount(), 0);
  touch.emit('pointerup', { pointerId: 2 });
  assert.equal(touch.wakeCount(), 1);
  assert.equal(touch.passed(), 0);
  touch.finish();
});

test('Closing standby without waking removes input interception', () => {
  const f = fixture();
  f.stop();
  f.emit('click');
  assert.equal(f.passed(), 1);
  assert.equal(f.wakeCount(), 0);
});

test('A completion alert waking standby consumes an in-progress key or pointer release before restoring controls', () => {
  for (const [down, up, values] of [['keydown', 'keyup', { code: 'Space' }], ['pointerdown', 'pointerup', { pointerId: 2 }]]) {
    const f = fixture();
    f.emit(down, values);
    f.stop();
    f.emit(up, values);
    f.emit('click');
    assert.equal(f.passed(), 0);
    assert.equal(f.wakeCount(), 0);
    f.finish();
    f.emit('click');
    assert.equal(f.passed(), 1);
  }
});

test('Releasing the key that opened standby does not immediately wake it', () => {
  const f = fixture();
  f.emit('keyup', { keyCode: 13 });
  f.emit('pointerup', { pointerId: 1 });
  f.emit('mouseup');
  assert.equal(f.wakeCount(), 0);
  f.emit('keydown', { keyCode: 13 });
  f.emit('keyup', { keyCode: 13 });
  assert.equal(f.wakeCount(), 1);
  f.emit('click');
  assert.equal(f.passed(), 0);
  f.finish();
});
