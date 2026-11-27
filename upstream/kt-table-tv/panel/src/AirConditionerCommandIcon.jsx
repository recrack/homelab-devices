import React from 'react';

export default function AirConditionerCommandIcon({ label, size = 26, fallback = null }) {
  const command = typeof label === 'string' ? /(?:^|\s)에어컨\s*(켜기|끄기)$/.exec(label.trim())?.[1] : null;
  if (!command) return fallback;
  return <svg className="ac-command-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="10" rx="3"/><path d="M6 7h12M5 10h14"/>
    {command === '켜기' ? <path d="M7 16v2a2 2 0 0 1-2 2m7-4v5m5-5v2a2 2 0 0 0 2 2"/> : <><circle cx="17" cy="18" r="5"/><path d="m13.5 14.5 7 7"/></>}
  </svg>;
}
