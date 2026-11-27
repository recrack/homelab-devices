import React, { useId, useRef, useState } from 'react';
import AirConditionerCommandIcon from './AirConditionerCommandIcon.jsx';
import './favorites.css';

export function favoriteView(value) {
  const items = [];
  const ids = new Set();
  for (const item of (Array.isArray(value?.items) ? value.items : []).slice(0, 100)) {
    if (typeof item?.id !== 'string' || !item.id || ids.has(item.id) || item.type !== 'scene') continue;
    ids.add(item.id);
    items.push({ id: item.id, label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : '즐겨찾기', type: item.type, available: item.available === true });
  }
  const selected = [];
  for (const id of Array.isArray(value?.selected) ? value.selected : []) {
    if (selected.length >= 8) break;
    if (ids.has(id) && !selected.includes(id)) selected.push(id);
  }
  return { items, selected };
}

export function reorderFavorite(selected, id, direction) {
  const index = selected.indexOf(id), destination = index + direction;
  if (![-1, 1].includes(direction) || index < 0 || destination < 0 || destination >= selected.length) return selected.slice();
  const next = selected.slice();
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

function FavoriteSymbol({ type, label }) {
  if (type === 'scene') return <AirConditionerCommandIcon label={label} fallback={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>}/>;
  return null;
}

export function FavoritesEditor({ items, selected, onToggle, onMove, onSave, onCancel, busy = false, message = '' }) {
  const map = new Map(items.map(item => [item.id, item]));
  return <div className="favorites-editor-content">
    <p className="favorites-help">최대 8개를 고르고, 이동 버튼으로 표시 순서를 정하세요.</p>
    <div className="favorites-choices" role="group" aria-label="즐겨찾기 항목 선택">{items.map(item => {
      const chosen = selected.includes(item.id);
      return <button type="button" key={item.id} disabled={Boolean(busy) || (!chosen && selected.length >= 8)} aria-pressed={chosen} onClick={() => onToggle(item.id)} data-remote-key={`favorite-choose-${item.id}`}><span aria-hidden="true">{chosen ? '✓' : '+'}</span>{item.label}</button>;
    })}</div>
    {selected.length > 0 && <ol className="favorites-order" aria-label="즐겨찾기 표시 순서">{selected.map((id, index) => <li key={id}>
      <span className="favorite-order-number" aria-hidden="true">{index + 1}</span><span className="favorite-order-label">{map.get(id)?.label || '즐겨찾기'}</span>
      <div className="favorite-order-buttons"><button type="button" disabled={Boolean(busy) || index === 0} onClick={() => onMove(id, -1)} aria-label={`${map.get(id)?.label || '즐겨찾기'} 앞으로 이동`} data-remote-key={`favorite-earlier-${id}`}>←</button><button type="button" disabled={Boolean(busy) || index === selected.length - 1} onClick={() => onMove(id, 1)} aria-label={`${map.get(id)?.label || '즐겨찾기'} 뒤로 이동`} data-remote-key={`favorite-later-${id}`}>→</button></div>
    </li>)}</ol>}
    <div className="favorites-editor-actions"><p role="status">{message || `${selected.length}/8개 선택`}</p><div><button type="button" disabled={Boolean(busy)} onClick={onCancel} data-remote-key="favorites-cancel">취소</button><button type="button" disabled={Boolean(busy)} onClick={onSave} data-remote-key="favorites-save">{busy ? '저장 중…' : '저장'}</button></div></div>
  </div>;
}

export default function Favorites({ favorites, csrf, busy = false, onRun, onSave }) {
  const editorId = useId();
  const toggle = useRef(null);
  const savingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const view = favoriteView(favorites);
  const selected = view.selected.map(id => view.items.find(item => item.id === id));
  const blocked = !csrf || Boolean(busy) || saving;
  const close = () => {
    setEditing(false); setMessage('');
    if (typeof window !== 'undefined') window.requestAnimationFrame(() => toggle.current?.focus());
  };
  const choose = id => {
    if (blocked) return;
    setDraft(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 8 ? [...current, id] : current);
    setMessage('');
  };
  const save = async () => {
    if (blocked || savingRef.current || typeof onSave !== 'function') return;
    savingRef.current = true; setSaving(true); setMessage('');
    try {
      const clean = favoriteView({ items: view.items, selected: draft }).selected;
      if (await onSave(clean) === false) throw new Error();
      close();
    } catch { setMessage('저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <section className="favorites-panel" aria-label="리모컨 즐겨찾기">
    <div className="favorites-heading"><h3>즐겨찾기</h3><p className="favorites-heading-note"><span>한 번 누르면 바로 실행돼요.</span><span>실행 후 기기의 반응을 확인해 주세요.</span></p><button ref={toggle} type="button" className="favorites-edit" disabled={blocked || !view.items.length || typeof onSave !== 'function'} aria-expanded={editing} aria-controls={editorId} data-remote-key="favorites-edit" onClick={() => {
      if (editing) close();
      else { setDraft(view.selected.slice()); setMessage(''); setEditing(true); }
    }}>{editing ? '편집 닫기' : '편집'}</button></div>
    {selected.length ? <div className="favorites-grid">{selected.map((item, index) => <button type="button" key={item.id} className="favorite-action" disabled={blocked || editing || !item.available || typeof onRun !== 'function'} onClick={() => { if (!blocked && !editing && item.available) onRun?.(item.id); }} data-remote-key={`favorite-run-${item.id}`} aria-label={`${item.label} 실행`}>
      <span className="favorite-slot">{index + 1}</span><FavoriteSymbol type={item.type} label={item.label}/><span className="favorite-label">{item.label}</span><span className="favorite-status">{busy === item.id || busy === `favorite:${item.id}` ? '전송 중…' : !item.available ? '연결 확인' : '실행'}</span>
    </button>)}</div> : <p className="favorites-empty">{favorites ? '편집에서 자주 쓰는 기능을 골라 주세요.' : '즐겨찾기를 불러오는 중입니다.'}</p>}
    <div id={editorId} className="favorites-editor" hidden={!editing}>{editing && <FavoritesEditor items={view.items} selected={draft} onToggle={choose} onMove={(id, direction) => { if (!blocked) { setDraft(current => reorderFavorite(current, id, direction)); setMessage(''); } }} onSave={save} onCancel={close} busy={blocked} message={message}/>}</div>
  </section>;
}
