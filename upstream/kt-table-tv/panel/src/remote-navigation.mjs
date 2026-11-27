const controlsSelector = 'button,a[href],input,select,textarea,[tabindex],[role="button"],[role="link"],[contenteditable]';
const keyCodes = { 13: 'Enter', 27: 'Escape', 8: 'Backspace', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 166: 'BrowserBack' };
const keyName = event => event.key && event.key !== 'Unidentified' ? event.key : keyCodes[event.keyCode || event.which];
const center = rect => ({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });
const gap = (a1, a2, b1, b2) => Math.max(0, b1 - a2, a1 - b2);

export function directionalTarget(current, candidates, key) {
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  const origin = center(current);
  let best = null;
  let score = Infinity;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const point = center(rect);
    const major = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
    if (major <= 1) continue;
    const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
    const crossGap = horizontal ? gap(current.top, current.bottom, rect.top, rect.bottom) : gap(current.left, current.right, rect.left, rect.right);
    const majorGap = horizontal ? gap(current.left, current.right, rect.left, rect.right) : gap(current.top, current.bottom, rect.top, rect.bottom);
    const nextScore = majorGap + crossGap * 3 + major * .2 + cross * .35;
    if (nextScore < score) { score = nextScore; best = candidate; }
  }
  return best;
}

export function installRemoteNavigation(root, { onBack = () => false } = {}) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  let destroyed = false;
  let last = null;
  let restore = null;
  let internalFocus = false;
  let enterHeld = false;
  let backHeld = false;
  let activating = false;
  let clickGuard = null;
  let clickTimer = null;
  let refreshTimer = null;

  function visible(element) {
    if (!element || element.isConnected === false) return false;
    for (let node = element; node; node = node.parentElement) {
      if (node.hidden || node.inert || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    const rect = element.getBoundingClientRect();
    return element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }
  function blocked() {
    if (destroyed || !visible(root)) return true;
    return [...document.querySelectorAll('dialog[open],[aria-modal="true"]')].some(visible);
  }
  function candidates() {
    return [...root.querySelectorAll(controlsSelector)].filter(element =>
      element.tabIndex >= 0 && !element.disabled && !element.matches(':disabled') &&
      !element.closest('[aria-disabled="true"]') && !element.classList.contains('skip-link') &&
      element.getAttribute('type') !== 'hidden' && visible(element));
  }
  function nativeControl(element) {
    return Boolean(element && (element.isContentEditable || element.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),iframe,video,audio')));
  }
  function neutral(element) { return !element || element === document.body || element === document.documentElement || element === root; }
  function outside(element) { return !neutral(element) && !root.contains(element); }
  function remember(element) {
    last = { element, rect: element.getBoundingClientRect(), id: element.id, key: element.getAttribute('data-remote-key'), label: element.getAttribute('aria-label'), tag: element.tagName };
  }
  function focus(element) {
    if (!element) return false;
    internalFocus = true;
    try { element.focus({ preventScroll: true }); }
    finally { internalFocus = false; }
    if (document.activeElement !== element) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    remember(element);
    return true;
  }
  function preferred(list) {
    return list.find(element => element.matches('.room-nav button[aria-pressed="true"]')) ||
      list.find(element => element.hasAttribute('data-remote-default')) || list[0];
  }
  function focusInitial() {
    if (blocked() || !neutral(document.activeElement)) return false;
    const focused = focus(preferred(candidates()));
    if (focused) remote();
    return focused;
  }
  function restoreCandidate(list, snapshot) {
    if (list.includes(snapshot.element)) return snapshot.element;
    const matches = list.filter(element => snapshot.id ? element.id === snapshot.id : snapshot.key ? element.getAttribute('data-remote-key') === snapshot.key :
      snapshot.label ? element.tagName === snapshot.tag && element.getAttribute('aria-label') === snapshot.label : false);
    return matches.length === 1 ? matches[0] : null;
  }
  function refresh() {
    if (blocked()) { blur(); return; }
    const active = document.activeElement;
    if (outside(active) || (nativeControl(active) && !active.disabled && visible(active))) return;
    const list = candidates();
    if (restore && (active === restore.fallback || neutral(active))) {
      const original = restoreCandidate(list, restore.snapshot);
      if (original) { restore = null; focus(original); return; }
    }
    if (list.includes(active)) return;
    if (!neutral(active) && !root.contains(active)) return;
    const snapshot = restore?.snapshot || last;
    let replacement = preferred(list);
    if (snapshot) {
      const origin = center(snapshot.rect);
      replacement = list.reduce((best, item) => {
        const point = center(item.getBoundingClientRect());
        const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
        return !best || distance < best.distance ? { item, distance } : best;
      }, null)?.item;
    }
    if (replacement) {
      if (snapshot) restore = { snapshot, fallback: replacement };
      focus(replacement);
    }
  }
  function remote() { root.setAttribute('data-navigation', 'remote'); }
  function consume(event) { event.preventDefault(); event.stopPropagation(); }
  function keydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.keyCode === 229 || blocked()) return;
    const active = document.activeElement;
    if (outside(active) || outside(event.target)) return;
    const key = keyName(event);
    if (key === 'Enter' && enterHeld) { consume(event); return; }
    if (['Escape', 'BrowserBack', 'Backspace'].includes(key)) {
      if (key === 'Backspace' && nativeControl(active)) return;
      if (active?.closest('iframe,video,audio')) return;
      if (backHeld || event.repeat) { if (backHeld) consume(event); return; }
      restore = null;
      if (onBack(event) === true) { backHeld = true; remote(); consume(event); }
      return;
    }
    if (nativeControl(active)) return;
    if (key === 'Tab') { restore = null; remote(); return; }
    if (key === 'Enter') {
      if (!candidates().includes(active) || !active.matches('button,a[href],[role="button"],[role="link"]')) return;
      consume(event);
      remote();
      if (event.repeat) return;
      enterHeld = true;
      restore = null;
      clickGuard = active;
      window.clearTimeout(clickTimer);
      activating = true;
      try { active.click(); } finally { activating = false; }
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    const list = candidates();
    if (!list.length) return;
    consume(event);
    remote();
    restore = null;
    if (!list.includes(active)) { focus(preferred(list)); return; }
    focus(directionalTarget(active.getBoundingClientRect(), list.filter(element => element !== active), key));
  }
  function keyup(event) {
    const key = keyName(event);
    if (key === 'Enter' && enterHeld) {
      enterHeld = false;
      consume(event);
      clickTimer = window.setTimeout(() => { clickGuard = null; }, 0);
    }
    if (['Escape', 'BrowserBack', 'Backspace'].includes(key) && backHeld) { backHeld = false; consume(event); }
  }
  function click(event) {
    if (!activating && clickGuard && event.detail === 0 && (event.target === clickGuard || clickGuard.contains(event.target))) {
      consume(event);
      event.stopImmediatePropagation();
    }
  }
  function pointer() { root.removeAttribute('data-navigation'); restore = null; last = null; clickGuard = null; }
  function focusin(event) {
    if (internalFocus || !root.contains(event.target)) return;
    restore = null;
    remember(event.target);
  }
  function blur() { enterHeld = false; backHeld = false; clickGuard = null; }
  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 0);
  }
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('keyup', keyup, true);
  document.addEventListener('click', click, true);
  root.addEventListener('focusin', focusin);
  root.addEventListener('pointerdown', pointer, true);
  window.addEventListener('blur', blur);
  const observer = window.MutationObserver ? new window.MutationObserver(scheduleRefresh) : null;
  observer?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'aria-hidden', 'inert', 'style', 'class'] });
  focusInitial();
  return {
    focusInitial,
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      window.clearTimeout(refreshTimer);
      window.clearTimeout(clickTimer);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('keyup', keyup, true);
      document.removeEventListener('click', click, true);
      root.removeEventListener('focusin', focusin);
      root.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('blur', blur);
      root.removeAttribute('data-navigation');
    },
  };
}
