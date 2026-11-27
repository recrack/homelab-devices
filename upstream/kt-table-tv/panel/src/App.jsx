import React, { useCallback, useEffect, useRef, useState } from 'react';
import PanelDisplay from './PanelDisplay.jsx';
import PanelMaintenance from './PanelMaintenance.jsx';
import WasherCard from './WasherCard.jsx';
import WasherAlert from './WasherAlert.jsx';
import Favorites from './Favorites.jsx';
import WeeklyEnvironment from './WeeklyEnvironment.jsx';
import { ForecastStrip, EnvironmentHistory, PanelNotifications, AlertSettings } from './PanelInsights.jsx';
import { createPanelSnapshotCache } from './offline-snapshot.mjs';
import { createWasherAlertTracker } from './washer-alerts.mjs';
import { installRemoteNavigation } from './remote-navigation.mjs';
import './community.css';

const value = (number, digits = 0) => Number.isFinite(number) ? number.toFixed(digits) : '—';
const time = (at, date = false) => at && Number.isFinite(Date.parse(at)) ? new Intl.DateTimeFormat('ko-KR', { ...(date ? { month: 'numeric', day: 'numeric' } : {}), hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at)) : '수신 대기';
export default function App() {
  const shell = useRef(null), active = useRef(false), fetching = useRef(false), executing = useRef(false), cache = useRef(null), tracker = useRef(null), back = useRef(() => false);
  const [serverError, setServerError] = useState(false);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [room, setRoom] = useState('all'), [settings, setSettings] = useState(false), [now, setNow] = useState(new Date()), [alerts, setAlerts] = useState([]);
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const response = await fetch('/api/dashboard', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.rooms) || !Array.isArray(result.scenes)) throw new Error();
      if (!active.current) return;
      const live = result.mode === 'live' && result.connected && result.serverReachable && !result.error;
      if (live) {
        cache.current?.save({ ...result, rooms: result.rooms.map(item => ({ ...item, hasCo2: Boolean(item.co2Entity) })) });
        if (tracker.current) setAlerts(tracker.current.observe((result.devices || []).filter(item => item.kind === 'washer'), true).pending);
      } else {
        const saved = cache.current?.load();
        if (saved) { result.rooms = saved.rooms; result.updatedAt = saved.updatedAt; }
      }
      setData(result); setError(result.error || ''); setServerError(false);
    } catch { if (active.current) { setServerError(true); setError('서버 연결을 확인하세요. 마지막 수신 값을 표시합니다.'); setData(previous => previous ? { ...previous, csrfToken: '' } : previous); } }
    finally { fetching.current = false; }
  }, []);
  useEffect(() => {
    active.current = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    let storage = null; try { storage = window.localStorage; } catch {}
    cache.current = createPanelSnapshotCache({ storage }); tracker.current = createWasherAlertTracker({ storage, storageKey: 'home-panel-washer-alerts-v1' });
    setAlerts(tracker.current.getPending());
    const saved = cache.current.load(); if (saved) setData(previous => previous || { ...saved, devices: [], scenes: [] });
    refresh(); const timer = setInterval(refresh, 15000), clock = setInterval(() => setNow(new Date()), 1000);
    const navigation = installRemoteNavigation(shell.current, { onBack: event => back.current(event) });
    return () => { active.current = false; clearInterval(timer); clearInterval(clock); navigation.destroy(); };
  }, [refresh]);
  const fresh = data?.mode === 'live' && data?.connected === true && data?.serverReachable === true && !error && !data?.error && Date.parse(data.updatedAt) <= now.getTime() && now.getTime() - Date.parse(data.updatedAt) < 120000;
  async function post(path, input, key, requireLive = true) {
    if (executing.current || !data?.csrfToken || requireLive && !fresh) return false;
    executing.current = true; setBusy(key); setMessage('');
    try {
      const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrfToken }, body: JSON.stringify(input), signal: AbortSignal.timeout(25000) });
      const result = await response.json(); if (!response.ok || !result.ok) throw new Error();
      setMessage(result.message || '요청을 보냈습니다.'); return true;
    } catch { setMessage('실행 결과를 확인하지 못했습니다. 자동으로 다시 보내지 않습니다.'); setData(previous => previous ? { ...previous, csrfToken: '' } : previous); return false; }
    finally { executing.current = false; setBusy(''); refresh(); }
  }
  back.current = () => {
    if (alerts.length) { document.getElementById('washer-alert-confirm')?.focus(); return true; }
    const expanded = [...(shell.current?.querySelectorAll('button[aria-expanded="true"][aria-controls]') || [])];
    if (expanded.length) { const button = expanded.at(-1); if (!button.disabled) { button.click(); button.focus(); } return true; }
    setRoom('all'); document.getElementById('refresh')?.focus(); return true;
  };
  const rooms = data?.rooms || [], visible = room === 'all' ? rooms : rooms.filter(item => item.id === room), notifications = data?.notifications || [], co2 = notifications.find(item => item.kind === 'co2');
  return <div className="app-shell" ref={shell}>
    <aside className="sidebar"><div className="header-clock"><time>{time(now.toISOString())}</time><span>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)}</span></div><nav className="room-nav" aria-label="방 선택">{[{ id: 'all', name: '전체' }, ...rooms].map(item => <button key={item.id} className={'nav-item' + (room === item.id ? ' selected' : '')} aria-pressed={room === item.id} onClick={() => setRoom(item.id)}>{item.name}</button>)}</nav></aside>
    <main className="main-content"><header className="community-header"><div><p className="community-connection">{fresh ? 'Home Assistant 연결됨' : '연결 확인 필요'}</p><p className="text-muted">{data?.weather?.available && fresh ? `${data.weather.name} · ${data.weather.condition} · ${value(data.weather.temperatureC, 1)}°C${data.weather.source ? ` · ${data.weather.source}` : ''}` : '날씨는 기본 서울 네이버 날씨 또는 Home Assistant 설정을 사용합니다.'}</p></div><button id="refresh" className="community-button" onClick={refresh}>새로고침</button></header>
      {!data?.connected && <p className="notice"><a href="/auth/start">Home Assistant 연결</a><span>서버에서 본인 Home Assistant 계정으로 연결하세요.</span></p>}
      {!fresh && <p className="notice" role="status">{error || '현재 상태를 확인하는 중입니다.'}{data?.updatedAt ? ` 마지막 수신 · ${time(data.updatedAt, true)}` : ''}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <PanelNotifications notifications={notifications} busy={Boolean(busy)} onDismiss={id => post('/api/notifications/dismiss', { id }, 'dismiss', false)}/>
      <Favorites favorites={data?.favorites} csrf={fresh ? data.csrfToken : ''} busy={busy} onRun={id => post('/api/favorites/run', { id }, id)} onSave={selected => post('/api/favorites/settings', { selected }, 'favorites', false)}/>
      <ForecastStrip forecast={data?.forecast} stale={!fresh}/>
      <div className="community-rooms">{visible.map(item => <article key={item.id} className="room-card"><div className="card-top"><h2>{item.name}</h2><span className="room-received">{fresh ? '실시간 수신' : '마지막 수신'}</span></div><div className="community-readings"><p><small>온도</small><strong>{value(item.temperature, 1)}<span> °C</span></strong></p><p><small>습도</small><strong>{value(item.humidity)}<span> %</span></strong></p>{(item.co2Entity || item.hasCo2) && <p><small>CO₂</small><strong>{value(item.co2)}<span> ppm</span></strong></p>}</div><div className="community-actions">{['on', 'off'].map(action => { const configured = data?.roomConfig?.find(selected => selected.id === item.id)?.scenes?.[action]; const scene = data?.scenes?.find(selected => selected.entityId === configured); return <button className="community-button" key={action} disabled={!fresh || !scene?.available || !data?.csrfToken || Boolean(busy)} onClick={() => post('/api/scenes/run', { entityId: configured }, item.id + action)}>{action === 'on' ? '⏻ 켜기' : '⏻ 끄기'}</button>; })}</div><EnvironmentHistory room={item} now={now}/></article>)}</div>
      <WeeklyEnvironment weekly={data?.weekly} roomId={room} stale={!fresh}/>
      <div className="community-rooms">{(data?.devices || []).filter(item => item.kind === 'washer').map(item => <WasherCard key={item.entityId} device={item} now={now} stale={!fresh}/>)}</div>
      <section className="operations-card"><h2>운영 상태</h2><div className="integration-row"><span>Home Assistant</span><span>{fresh ? '연결됨' : '연결 대기'}</span></div><PanelMaintenance value={data?.maintenance} now={now} unreachable={serverError} onReturnHome={() => post('/api/panel-maintenance/return-home', {}, 'return-home', false)} returnBusy={busy === 'return-home'} canReturn={Boolean(data?.csrfToken) && !busy && !serverError}/></section>
      <button className="community-button" aria-expanded={settings} aria-controls="notification-settings" onClick={() => setSettings(open => !open)}>알림 설정</button>{settings && <div id="notification-settings"><AlertSettings settings={data?.alertSettings} busy={Boolean(busy) || !data?.csrfToken} onSave={settings => post('/api/alert-settings', { settings }, 'settings', false)}/></div>}
      <PanelDisplay now={now} busy={Boolean(busy)} alertActive={alerts.length > 0 || Boolean(co2)} wakeKey={alerts[0]?.id || co2?.id || ''}/>
      <p className="text-muted">방향키 이동 · 확인 선택 · 뒤로 상단 / 장면 실행 후 실제 기기 상태를 확인하세요.</p>
    </main>
    <WasherAlert notifications={alerts} onAcknowledge={id => setAlerts(tracker.current?.acknowledge(id) || [])}/>
  </div>;
}
