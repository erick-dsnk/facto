import { useEffect, useState } from 'react';

export type ActionFeedbackKind = 'listening' | 'checking';
const feedback = {
  listening: { text: 'Listening…', duration: 1400 },
  checking: { text: 'Checking…', duration: 1100 },
} as const;

/** Brief acknowledgement; remount with an action identity to replay, never with source updates. */
export function ActionFeedback({ kind }: { kind: ActionFeedbackKind }) {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'hidden'>('visible');
  useEffect(() => {
    setPhase('visible');
    const leave = window.setTimeout(() => setPhase('leaving'), feedback[kind].duration);
    const hide = window.setTimeout(() => setPhase('hidden'), feedback[kind].duration + 140);
    return () => { window.clearTimeout(leave); window.clearTimeout(hide); };
  }, [kind]);
  if (phase === 'hidden') return null;
  return <div className={`action-feedback ${phase === 'leaving' ? 'is-leaving' : ''}`} role="status">
    <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'listening'
        ? <path d="M4 11v6m5-10v14m5-17v20m5-15v10m5-7v4"/>
        : <path d="M4 10V4h6m8 0h6v6M4 18v6h6m8 0h6v-6"/>}
    </svg>
    <span>{feedback[kind].text}</span>
  </div>;
}
