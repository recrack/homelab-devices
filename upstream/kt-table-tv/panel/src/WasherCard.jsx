import React from 'react';
import { washerMinutes, washerRemaining } from './washer.mjs';

function received(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '기록 없음';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

export default function WasherCard({ device, now = new Date(), stale = false }) {
  const current = !stale && device.available === true;
  const status = stale ? '수신 지연' : current ? device.statusLabel || '상태 확인 필요' : '상태 확인 필요';
  const total = current ? washerMinutes(device.totalMinutes) : null;
  const energy = current && Number.isFinite(device.energyMonthKwh) && device.energyMonthKwh >= 0 ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(device.energyMonthKwh) : null;
  const count = current && Number.isInteger(device.cycleCount) && device.cycleCount >= 0 ? device.cycleCount.toLocaleString('ko-KR') : null;
  const remote = !current ? '정보 없음' : device.remoteStart === true ? '준비됨' : device.remoteStart === false ? '꺼짐' : '—';
  const notification = device.lastNotification;
  const hasNotification = typeof notification?.label === 'string' && notification.label && typeof notification.at === 'string' && Number.isFinite(Date.parse(notification.at));

  return <article className={`washer-card${current ? '' : ' unavailable'}`} tabIndex={0} aria-label={`${device.name || '세탁기'} 상태`}>
    <div className="washer-heading">
      <div className="washer-identity"><span className="washer-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 7h16M7 4.5h1m2 0h1"/><circle cx="12" cy="14" r="4.5"/><path d="M8 14c3-3 5 3 8 0"/></svg></span>
      <div><h3>{device.name || '세탁기'}</h3><p>{device.room || '공통'} · LG ThinQ</p></div></div>
      <div className="washer-summary"><span className={`washer-status${current && device.state === 'error' ? ' error' : ''}`} role="status">{status}</span><div className="washer-header-notes">
        <p className="washer-received">{stale ? '마지막 수신' : '수신'} · {received(device.updatedAt)}</p>
        {hasNotification && <p className="washer-notification">최근 알림 · {notification.label}<time dateTime={notification.at}>{received(notification.at)}</time></p>}
      </div></div>
    </div>
    <div className="washer-readings">
      <div><span className="washer-label">남은 시간 · 예상</span><p className="washer-time">{washerRemaining(device, now, stale)}</p>{total !== null && <small>전체 {total}</small>}</div>
      <div><span className="washer-label">원격 시작</span><p className="washer-ready">{remote}</p></div>
    </div>
    <dl className="washer-stats"><div><dt>이번 달 사용량</dt><dd>{energy === null ? '정보 없음' : <>{energy}<span> kWh</span></>}</dd></div><div><dt>사용 횟수</dt><dd>{count === null ? '정보 없음' : <>{count}<span>회</span></>}</dd></div></dl>
  </article>;
}
