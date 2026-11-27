import React, { useEffect, useId, useState } from 'react';
import { historyChart } from './chart-series.mjs';
import './panel-insights.css';

const dateValue = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const shortTime = value => dateValue(value) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '시간 없음';
const fullTime = value => dateValue(value) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '';
const number = (value, digits = 0) => Number.isFinite(value) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(value) : '—';

function ForecastSymbol({ code }) {
  let shape = <><path d="M5 17a4 4 0 1 1 0-8 6 6 0 0 1 12-1 4.5 4.5 0 1 1 2 9Z"/></>;
  if (code === 'sunny') shape = <><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>;
  else if (code === 'clear-night') shape = <path d="M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13Z"/>;
  else if (['rainy', 'pouring', 'snowy-rainy'].includes(code)) shape = <><path d="M5 14a4 4 0 1 1 0-8 6 6 0 0 1 12-1 4.5 4.5 0 1 1 2 9"/><path d="m7 17-1 4m6-4-1 4m6-4-1 4"/></>;
  else if (['snowy', 'hail'].includes(code)) shape = <><path d="M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3m-6 16 3-3 3 3"/></>;
  else if (code === 'fog') shape = <path d="M4 6h16M2 12h20M4 18h16"/>;
  else if (['lightning', 'lightning-rainy'].includes(code)) shape = <path d="m13 2-9 12h7l-1 8L21 9h-8Z"/>;
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}

export function ForecastStrip({ forecast, stale = false }) {
  const titleId = useId();
  const items = !stale && forecast?.available === true && Array.isArray(forecast.items)
    ? forecast.items.filter(item => dateValue(item?.time)).slice(0, 8) : [];
  return <section className="insight-card forecast-strip" aria-labelledby={titleId}>
    <div className="insight-heading"><h3 id={titleId}>시간별 날씨</h3><div className="insight-heading-meta"><span>{forecast?.source || '날씨 예보'}</span>{items.length > 0 && <span>예보 기준 · {forecast?.updatedAt && dateValue(forecast.updatedAt) ? `${fullTime(forecast.updatedAt)} 수신` : '수신 시각 없음'}</span>}</div></div>
    {items.length ? <div className="forecast-hours">{items.map((item, index) => {
      const probability = Number.isFinite(item.precipitationProbability) && item.precipitationProbability >= 0 && item.precipitationProbability <= 100 ? item.precipitationProbability : null;
      const rain = Number.isFinite(item.precipitationMm) && item.precipitationMm >= 0 ? item.precipitationMm : null;
      return <article className="forecast-hour" key={`${item.time}-${index}`} tabIndex="0" data-remote-key={`forecast-${item.time}`} aria-label={`${shortTime(item.time)} 예보`}>
        <time dateTime={item.time}>{shortTime(item.time)}</time>
        <ForecastSymbol code={item.conditionCode}/>
        <span className="forecast-condition">{typeof item.condition === 'string' && item.condition ? item.condition : '상태 정보 없음'}</span>
        <strong className="forecast-temperature">{number(item.temperatureC, 1)}{Number.isFinite(item.temperatureC) && <span>°C</span>}</strong>
        <span className="forecast-rain">강수 {probability === null ? '확률 미제공' : `${number(probability)}%`}</span>
        <span className="forecast-amount">{rain === null ? '강수량 미제공' : `${number(rain, 1)} mm`}</span>
      </article>;
    })}</div> : <p className="insight-empty">{stale ? '연결이 복구되면 예보를 다시 불러옵니다.' : '시간별 예보를 아직 받지 못했어요.'}</p>}
  </section>;
}

export function EnvironmentHistory({ room, now = new Date() }) {
  const [selected, setSelected] = useState('humidity');
  const id = useId();
  const metrics = [room?.humidityEntity ? 'humidity' : null, room?.co2Entity ? 'co2' : null].filter(Boolean);
  if (!metrics.length) return null;
  const metric = metrics.includes(selected) ? selected : metrics[0];
  const name = metric === 'co2' ? 'CO₂' : '습도', unit = metric === 'co2' ? 'ppm' : '%';
  const chart = historyChart(room.histories?.[metric], { now, metric });
  const key = String(room.id || room.name || 'room');
  return <section className="environment-history" aria-label={`${room.name || '방'} 환경 기록`}>
    <div className="insight-heading"><h4 id={`${id}-heading`}>환경 변화</h4><div className="insight-heading-meta"><span>최근 24시간</span>{chart.count > 0 && <div className="history-stats"><span>최저 <strong>{number(chart.min, 1)} {unit}</strong></span><span>최고 <strong>{number(chart.max, 1)} {unit}</strong></span></div>}</div></div>
    <div className="history-tabs" role="group" aria-label="표시할 환경 기록">{metrics.map(value => <button type="button" key={value} aria-pressed={metric === value} aria-controls={`${id}-chart`} data-remote-key={`history-${key}-${value}`} onClick={() => setSelected(value)}>{value === 'co2' ? 'CO₂' : '습도'}</button>)}</div>
    <div id={`${id}-chart`} className="history-plot" aria-labelledby={`${id}-heading`}>
      {chart.count ? <>
        <svg viewBox="0 0 480 106" className="environment-chart" role="img" aria-label={`${name} 24시간 추이, 최저 ${number(chart.min, 1)} ${unit}, 최고 ${number(chart.max, 1)} ${unit}`} preserveAspectRatio="none">
          <path d="M0 10H480M0 53H480M0 96H480" className="history-grid"/>
          {chart.segments.map((segment, index) => segment.length > 1
            ? <polyline key={index} points={segment.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
            : <circle key={index} cx={segment[0].x} cy={segment[0].y} r="3" fill="currentColor"/>) }
        </svg>
        <div className="history-axis"><span>24시간 전</span><span>12시간 전</span><span>현재</span></div>
        <p className="insight-footnote">{chart.count === 1 ? '첫 기록을 받았어요. 기록이 더 쌓이면 변화를 표시합니다.' : '수신되지 않은 구간은 선으로 연결하지 않습니다.'}</p>
      </> : <p className="insight-empty">{name} 기록이 쌓이면 여기에 표시합니다.</p>}
    </div>
  </section>;
}

export function PanelNotifications({ notifications = [], onDismiss, busy = false }) {
  const id = useId();
  const items = Array.isArray(notifications) ? notifications.filter(item => typeof item?.id === 'string' && ['co2', 'connection'].includes(item.kind)).slice(0, 20) : [];
  if (!items.length) return null;
  return <section className="insight-card panel-notifications" aria-labelledby={id}>
    <div className="insight-heading"><h3 id={id}>확인이 필요해요</h3><span>{items.length}개 알림</span></div>
    <ul className="notification-list">{items.map(item => <li key={item.id} className={`panel-notification ${item.kind}`}>
      <div className="notification-copy"><span className="notification-kind">{item.kind === 'co2' ? '환기 알림' : '연결 알림'}</span><h4>{item.title}</h4><p>{item.message}</p>{dateValue(item.since) && <time dateTime={item.since}>{fullTime(item.since)}부터</time>}</div>
      <button type="button" disabled={Boolean(busy)} onClick={() => onDismiss?.(item.id)} data-remote-key={`notification-${item.id}`} aria-label={`${item.title || '알림'} 확인`}>{busy === item.id ? '처리 중…' : '확인'}</button>
    </li>)}</ul>
  </section>;
}

export const defaultAlertSettings = Object.freeze({ enabled: true, co2Threshold: 1200, co2DurationMinutes: 5, co2CooldownMinutes: 60, connectionDelaySeconds: 60 });
const settingFields = [
  { name: 'co2Threshold', label: 'CO₂ 알림 기준', unit: 'ppm', min: 600, max: 5000, step: 100 },
  { name: 'co2DurationMinutes', label: '기준을 넘은 지속 시간', unit: '분', min: 1, max: 30, step: 1 },
  { name: 'co2CooldownMinutes', label: 'CO₂ 알림의 최소 간격', unit: '분', min: 15, max: 240, step: 1 },
  { name: 'connectionDelaySeconds', label: '연결 이상 확인 대기', unit: '초', min: 30, max: 300, step: 1 },
];

export function validateAlertSettings(value) {
  if (!value || typeof value.enabled !== 'boolean') return null;
  const result = { enabled: value.enabled };
  for (const field of settingFields) {
    const raw = value[field.name];
    if (!['number', 'string'].includes(typeof raw) || (typeof raw === 'string' && !raw.trim())) return null;
    const number = Number(raw);
    if (!Number.isInteger(number) || number < field.min || number > field.max || (number - field.min) % field.step !== 0) return null;
    result[field.name] = number;
  }
  return result;
}

export function AlertSettings({ settings, onSave, busy = false }) {
  const [draft, setDraft] = useState(() => validateAlertSettings(settings) || { ...defaultAlertSettings });
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const id = useId();
  const signature = JSON.stringify(settings || null);
  useEffect(() => {
    if (!dirty) setDraft(validateAlertSettings(settings) || { ...defaultAlertSettings });
  }, [signature]);
  const update = (name, value) => { setDraft(current => ({ ...current, [name]: value })); setDirty(true); setMessage(''); };
  const save = async event => {
    event.preventDefault();
    if (busy || typeof onSave !== 'function') return;
    const valid = validateAlertSettings(draft);
    if (!valid) { setMessage('표시된 범위 안에서 숫자를 입력해 주세요.'); return; }
    try {
      const result = await onSave(valid);
      if (result === false) throw new Error();
      setDraft(valid); setDirty(false); setMessage('알림 설정을 저장했어요.');
    } catch { setMessage('저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'); }
  };
  return <section className="insight-card alert-settings" aria-labelledby={`${id}-title`}>
    <div className="insight-heading"><h3 id={`${id}-title`}>알림 설정</h3></div>
    <p className="insight-footnote">설정한 기준이 일정 시간 이어지면 알려드려요.</p>
    <form onSubmit={save}>
      <button type="button" className="alert-enabled" aria-pressed={draft.enabled} disabled={Boolean(busy)} onClick={() => update('enabled', !draft.enabled)}>알림 {draft.enabled ? '켜짐' : '꺼짐'}</button>
      <div className="alert-setting-fields">{settingFields.map(field => <label key={field.name} htmlFor={`${id}-${field.name}`}><span>{field.label}</span><div className="alert-number"><button type="button" aria-label={`${field.label} 줄이기`} disabled={Boolean(busy) || draft[field.name] <= field.min} onClick={() => update(field.name, Math.max(field.min, Number(draft[field.name]) - field.step))}>−</button><output id={`${id}-${field.name}`}>{draft[field.name]}<small>{field.unit}</small></output><button type="button" aria-label={`${field.label} 늘리기`} disabled={Boolean(busy) || draft[field.name] >= field.max} onClick={() => update(field.name, Math.min(field.max, Number(draft[field.name]) + field.step))}>＋</button></div><small>{field.min.toLocaleString('ko-KR')}–{field.max.toLocaleString('ko-KR')} {field.unit}</small></label>)}</div>
      <div className="alert-setting-actions"><p role="status">{message}</p><button type="submit" disabled={Boolean(busy) || !dirty || typeof onSave !== 'function'} data-remote-key="alert-settings-save">{busy ? '저장 중…' : '설정 저장'}</button></div>
    </form>
  </section>;
}
