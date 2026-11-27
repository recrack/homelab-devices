import React,{useState} from 'react';
import './weekly-routines.css';

const metrics=[['temperature','온도','°C',1],['humidity','습도','%',1],['co2','CO₂','ppm',0]];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const reading=(value,digits)=>finite(value)?Number(value.toFixed(digits)).toLocaleString('ko-KR'):'—';
export function WeeklyMetric({name,metric,unit,digits=1,threshold}) {
  const valid=metric?.available===true&&metric.unit===unit&&finite(metric.average)&&finite(metric.coverageHours)&&metric.coverageHours>0;
  if(!valid)return <div className="weekly-metric"><h4>{name}</h4><p className="weekly-missing">집계할 기록 없음</p></div>;
  const coverage=finite(metric.coveragePercent)?Math.max(0,Math.min(100,metric.coveragePercent)):0;
  const days=Number.isInteger(metric.availableDays)?Math.max(0,Math.min(7,metric.availableDays)):0;
  const peaks=Array.isArray(metric.peakHours)?metric.peakHours.filter(item=>Number.isInteger(item?.hour)&&item.hour>=0&&item.hour<24&&finite(item.average)&&item.coverageHours>=0.5).slice(0,3):[];
  return <div className="weekly-metric"><h4>{name}</h4><p className="weekly-average"><span>평균</span><strong>{reading(metric.average,digits)}</strong><small>{unit}</small></p><p className="weekly-range">최저 {reading(metric.min,digits)} · 최고 {reading(metric.max,digits)} {unit}</p><p className="weekly-coverage">기록 확인 {days}/7일 · {reading(metric.coverageHours,1)}시간 ({reading(coverage,1)}%)</p>{unit==='ppm'&&finite(threshold)&&<p className="weekly-exceed">{reading(threshold,0)} ppm 이상 {reading(metric.aboveThresholdHours,1)}시간{finite(metric.aboveThresholdPercent)?' · 집계 시간의 '+reading(metric.aboveThresholdPercent,1)+'%':''}</p>}{unit==='ppm'&&peaks.length>0&&<p className="weekly-peaks">평균이 높은 시간대 · {peaks.map(item=>String(item.hour).padStart(2,'0')+'시').join(', ')}<span>한국 시간 · 기록이 있는 구간 기준</span></p>}</div>;
}

export default function WeeklyEnvironment({weekly,roomId='all',stale=false}) {
  const [expanded,setExpanded]=useState(false);
  const rooms=Array.isArray(weekly?.rooms)?weekly.rooms.filter(room=>(roomId==='all'||room.id===roomId)&&metrics.some(([key])=>room.metrics?.[key]?.available===true)):[];
  const available=!stale&&weekly?.available===true&&rooms.length>0;
  return <section className="weekly-environment" aria-labelledby="weekly-title"><div className="weekly-heading"><h2 id="weekly-title">최근 7일 환경</h2><p className="weekly-note weekly-summary">{stale?'연결이 복구되면 주간 기록을 다시 확인합니다.':available?'실제로 기록된 구간의 온도·습도·CO₂를 요약합니다.':'집계할 기록을 기다리고 있어요.'}</p><button type="button" aria-expanded={expanded} aria-controls="weekly-environment-details" onClick={()=>setExpanded(value=>!value)}>{expanded?'요약 접기':'요약 보기'}</button></div>{expanded&&<div id="weekly-environment-details">{available&&<><div className="weekly-rooms">{rooms.map(room=><article key={room.id} tabIndex={0} className="weekly-room" data-remote-key={'weekly-'+room.id}><h3>{room.name}</h3><div className="weekly-metrics">{metrics.filter(([key])=>room.metrics?.[key]).map(([key,name,unit,digits])=><WeeklyMetric key={key} name={name} metric={room.metrics[key]} unit={unit} digits={digits} threshold={weekly.co2Threshold}/>)}</div></article>)}</div><p className="weekly-note">평균은 기록이 유지된 시간으로 계산해요. 각 값은 최대 1시간까지만 반영하며, 기록이 없는 시간은 제외합니다. 높은 시간대만으로 환기 여부를 판단하지 않습니다.</p></>}</div>}</section>;
}
