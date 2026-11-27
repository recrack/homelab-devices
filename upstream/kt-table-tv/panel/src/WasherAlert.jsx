import React from 'react';

export default function WasherAlert({ notifications = [], onAcknowledge }) {
  const alert = notifications[0];
  if (!alert) return null;
  const at = new Date(alert.at);
  const time = Number.isFinite(at.getTime()) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(at) : '';
  return <aside className="washer-alert" aria-label="세탁 완료 알림">
    <div role="alert" aria-atomic="true"><p className="washer-alert-kicker">세탁 완료</p><h2>세탁이 끝났어요</h2><p className="washer-alert-detail">{alert.room ? `${alert.room} · ` : ''}{alert.name || '세탁기'}{time && <time dateTime={alert.at}>{time}</time>}</p>{notifications.length > 1 && <p className="washer-alert-more">확인할 알림 {notifications.length}개</p>}</div>
    <div className="washer-alert-actions"><span>뒤로 키로 알림 선택</span><button id="washer-alert-confirm" data-remote-key="washer-alert-confirm" type="button" onClick={() => onAcknowledge(alert.id)} aria-label="세탁 완료 알림 확인">확인</button></div>
  </aside>;
}
