export const IDLE_STORAGE_KEY = 'genie-panel-idle-minutes-v1';

export function idleMinutes(value) {
  return ['0', '5', '10'].includes(String(value)) ? Number(value) : 0;
}

export function autoIdleDelay(minutes, { media = false, busy = false, hidden = false, alertActive = false } = {}) {
  return media || busy || hidden || alertActive ? 0 : idleMinutes(minutes) * 60000;
}

export function installWakeShield(target, onWake, { schedule = setTimeout, cancel = clearTimeout } = {}) {
  const events = ['pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel', 'keydown', 'keyup', 'click', 'contextmenu', 'wheel'];
  const held = new Set();
  let woke = false;
  let timer = null;
  let stopped = false;
  function remove() {
    if (stopped) return;
    stopped = true;
    if (timer !== null) cancel(timer);
    for (const type of events) target.removeEventListener(type, intercept, { capture: true });
    target.removeEventListener('blur', reset, { capture: true });
  }
  function reset() {
    held.clear();
    if (woke) remove();
  }
  function wake() {
    if (woke || held.size) return;
    woke = true;
    timer = schedule(remove, 350);
    onWake();
  }
  function intercept(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    const type = event.type;
    if (woke) {
      if (type === 'pointerup' || type === 'pointercancel') held.delete(`p:${event.pointerId}`);
      else if (type === 'mouseup') held.delete('mouse');
      else if (type === 'keyup') held.delete(`k:${event.code || event.key || event.keyCode || event.which}`);
      else if (type === 'touchend' || type === 'touchcancel') for (const touch of event.changedTouches || []) held.delete(`t:${touch.identifier}`);
      if (!held.size && timer === null) timer = schedule(remove, 350);
      return;
    }
    if (type === 'pointerdown') held.add(`p:${event.pointerId}`);
    else if (type === 'mousedown') held.add('mouse');
    else if (type === 'keydown') held.add(`k:${event.code || event.key || event.keyCode || event.which}`);
    else if (type === 'touchstart') for (const touch of event.changedTouches || []) held.add(`t:${touch.identifier}`);
    else if (type === 'pointerup' || type === 'pointercancel') { if (held.delete(`p:${event.pointerId}`)) wake(); }
    else if (type === 'mouseup') { if (held.delete('mouse')) wake(); }
    else if (type === 'keyup') { if (held.delete(`k:${event.code || event.key || event.keyCode || event.which}`)) wake(); }
    else if (type === 'touchend' || type === 'touchcancel') {
      let matched = false;
      for (const touch of event.changedTouches || []) matched = held.delete(`t:${touch.identifier}`) || matched;
      if (matched) wake();
    }
    else if (type === 'click') wake();
  }
  for (const type of events) target.addEventListener(type, intercept, { capture: true, passive: false });
  target.addEventListener('blur', reset, true);
  return () => { if (!woke) { if (held.size) woke = true; else remove(); } };
}
