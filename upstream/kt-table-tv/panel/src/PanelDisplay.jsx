import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoIdleDelay, IDLE_STORAGE_KEY, idleMinutes, installWakeShield } from './panel-display.mjs';
import './panel-display.css';

function DisplayIcon({ clock = false }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{clock ? <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> : <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>}</svg>;
}

export default function PanelDisplay({ media = false, busy = false, now = new Date(), alertActive = false, wakeKey = '', standbyKey = 0 }) {
  const [minutes, setMinutes] = useState(() => { try { return typeof window === 'undefined' ? 0 : idleMinutes(window.localStorage.getItem(IDLE_STORAGE_KEY)); } catch { return 0; } });
  const [sleeping, setSleeping] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenBusy, setFullscreenBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const toolbar = useRef(null);
  const overlay = useRef(null);
  const standbyButton = useRef(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (wakeKey) setSleeping(false); }, [wakeKey]);
  useEffect(() => { if (standbyKey && !alertActive) setSleeping(true); }, [standbyKey]);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync(); document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    if (sleeping) return;
    let timer = null;
    const reset = () => {
      clearTimeout(timer);
      const delay = autoIdleDelay(minutes, { media, busy, hidden: document.hidden, alertActive });
      if (delay) timer = setTimeout(() => setSleeping(true), delay);
    };
    const activities = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'focusin'];
    for (const type of activities) window.addEventListener(type, reset, { passive: true, capture: true });
    document.addEventListener('visibilitychange', reset);
    reset();
    return () => {
      clearTimeout(timer);
      for (const type of activities) window.removeEventListener(type, reset, true);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [minutes, media, busy, sleeping, alertActive]);

  useEffect(() => {
    if (!sleeping) return;
    const root = toolbar.current?.closest('.app-shell');
    const focused = document.activeElement;
    const inert = root?.inert;
    const ariaHidden = root?.getAttribute('aria-hidden');
    const overflow = document.body.style.overflow;
    overlay.current?.focus({ preventScroll: true });
    if (root) { root.inert = true; root.setAttribute('aria-hidden', 'true'); }
    document.body.style.overflow = 'hidden';
    const stopShield = installWakeShield(window, () => setSleeping(false));
    return () => {
      stopShield();
      if (root) { root.inert = inert; if (ariaHidden === null) root.removeAttribute('aria-hidden'); else root.setAttribute('aria-hidden', ariaHidden); }
      document.body.style.overflow = overflow;
      const restore = focused?.isConnected && typeof focused.focus === 'function' ? focused : standbyButton.current;
      restore?.focus({ preventScroll: true });
    };
  }, [sleeping]);

  async function toggleFullscreen() {
    if (fullscreenBusy) return;
    setNotice('');
    if (!document.fullscreenElement && !document.documentElement.requestFullscreen) {
      setNotice('이 브라우저에서는 전체 화면을 사용할 수 없습니다. 브라우저의 전체 화면 메뉴를 이용해 주세요.');
      return;
    }
    setFullscreenBusy(true);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      if (alive.current) setNotice('브라우저에서 전체 화면 전환을 허용하지 않았습니다. 브라우저의 전체 화면 메뉴를 이용해 주세요.');
    } finally { if (alive.current) setFullscreenBusy(false); }
  }

  function changeIdle(event) {
    const value = idleMinutes(event.target.value);
    setMinutes(value); setNotice('');
    try { window.localStorage.setItem(IDLE_STORAGE_KEY, String(value)); }
    catch { setNotice('이 브라우저에서는 설정을 저장할 수 없어 현재 화면에만 적용합니다.'); }
  }

  const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  return <div className="panel-display" ref={toolbar}>
    <div className="panel-display-actions"><button type="button" onClick={toggleFullscreen} disabled={fullscreenBusy} aria-pressed={fullscreen}><DisplayIcon/><span>{fullscreen ? '전체 화면 종료' : '전체 화면'}</span></button><button type="button" ref={standbyButton} disabled={busy || alertActive} onClick={() => { if (!busy && !alertActive) setSleeping(true); }}><DisplayIcon clock/><span>대기 화면</span></button><label className="panel-idle-setting"><span>자동 대기 화면</span><select value={minutes} onChange={changeIdle} aria-describedby={media && minutes > 0 ? 'panel-idle-media-note' : undefined}><option value={0}>꺼짐</option><option value={5}>5분 후</option><option value={10}>10분 후</option></select></label></div>
    {media && minutes > 0 && <p className="panel-display-note" id="panel-idle-media-note">앱 화면에서는 자동 대기를 잠시 멈춥니다.</p>}
    {notice && <p className="panel-display-note panel-display-error" role="status">{notice}</p>}
    {sleeping && createPortal(<div className="panel-standby" ref={overlay} tabIndex={-1} role="dialog" aria-modal="true" aria-label="대기 화면" aria-describedby="panel-wake-hint"><time dateTime={now.toISOString()}>{time}</time><p className="panel-standby-date">{date}</p><p className="panel-wake-hint" id="panel-wake-hint">리모컨의 방향키나 확인 버튼을 누르면 돌아갑니다</p><button type="button" className="panel-wake-button" onClick={() => setSleeping(false)}>대시보드로 돌아가기</button></div>, document.body)}
  </div>;
}
