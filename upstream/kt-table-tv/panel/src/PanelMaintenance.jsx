import React from 'react';

const stateLabels = { idle: '대기 중', checking: '상태 확인 중', downloading: '업데이트 받는 중', accepted: '설치 결과 확인 중', installed: '업데이트 완료', error: '확인 필요' };
const errorLabels = { download: '업데이트 파일 수신·검증 확인 필요', installation: '앱 설치 확인 필요', home: '기본 홈 설정 확인 필요', root: '관리 연결 확인 필요', unknown: '관리 상태 확인 필요' };
const timeLabel = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

export default function PanelMaintenance({ value, now = new Date(), unreachable = false, onReturnHome = null, returnBusy = false, canReturn = false }) {
  const seen = value?.lastSeen && Date.parse(value.lastSeen);
  const known = value?.available === true && Number.isFinite(seen);
  const online = known && value.online === true && !unreachable && now.getTime() >= seen && now.getTime() - seen < 120000;
  const versionCode = Number.isInteger(value?.versionCode) ? value.versionCode : null;
  const lastError = value?.lastError;
  return <section className="panel-maintenance" aria-label="기가지니 운영 상태">
    <div className="maintenance-heading"><h3>기가지니</h3><span className={online ? 'text-mint' : 'text-muted'}>{online ? '연결됨' : known ? '연결 확인 필요' : '수신 대기'}</span></div>
    <dl className="maintenance-values">
      <div><dt>설치 앱</dt><dd>{versionCode ? `${value.versionName ? 'v' + value.versionName + ' · ' : ''}빌드 ${versionCode}` : '미확인'}</dd></div>
      <div><dt>업데이트</dt><dd>{online ? stateLabels[value.state] || '미확인' : '상태 확인 대기'}</dd></div>
      <div><dt>기본 홈 · 관리 연결</dt><dd>{online ? `${value.home === 'panel' ? '홈 패널' : value.home === 'other' ? '다른 홈' : '미확인'} · ${value.root === 'ok' ? '정상' : value.root === 'unavailable' ? '확인 필요' : '미확인'}` : '현재 상태 미확인'}</dd></div>
    </dl>
    <p className="maintenance-seen">마지막 수신 · {known ? <time dateTime={value.lastSeen}>{timeLabel(value.lastSeen)}</time> : '아직 없음'}{known && !online ? ' · 이전 기록' : ''}</p>
    {known && value.verifiedBuild && <p className="maintenance-proof">이 빌드의 기기 검증 기록 있음</p>}
    {lastError && Number.isFinite(Date.parse(lastError.at)) && <p className="maintenance-error">최근 확인한 오류 · {errorLabels[lastError.code] || errorLabels.unknown}<br/><time dateTime={lastError.at}>{timeLabel(lastError.at)}</time></p>}
    {onReturnHome && <div className="maintenance-actions"><button type="button" className="community-button" disabled={!canReturn || returnBusy} onClick={onReturnHome}>{returnBusy ? '복귀 요청 중...' : '홈 패널로 복귀'}</button></div>}
  </section>;
}
