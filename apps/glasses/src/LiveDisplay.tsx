import { useEffect, useState } from 'react';
import { App as WearablesApp } from '@wearables-ui-toolkit/mrbd/App';
import type { DisplayCredentials } from './displayConnection';
import { createDisplayObserver, parseDisplayCredentials } from './displayConnection';
import { clearDisplay, emptyLiveModel, expireDisplay, reduceDisplay } from './liveModel';
import { SearchSources, type SearchSource } from './SearchSources';
import { ActionFeedback } from './ActionFeedback';

/** Fragment credentials are consumed once and retained only in this mounted page's memory. */
export function consumeDisplayCredentials(): DisplayCredentials | null {
  const credentials = parseDisplayCredentials(window.location.hash);
  if (window.location.hash) window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  return credentials;
}
const verdicts = { supported: 'True', contradicted: 'False', misleading: 'Misleading', insufficient_evidence: 'Unclear', speculation: 'Speculation' } as const;
export function LiveDisplay({ credentials }: { credentials: DisplayCredentials | null }) {
  const [model, setModel] = useState(emptyLiveModel);
  const [disconnected, setDisconnected] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(!!credentials);
  useEffect(() => {
    const observer = createDisplayObserver((message, sessionId) => {
      setModel(previous => reduceDisplay(previous, message, sessionId));
      setDisconnected(false);
    }, () => { setModel(clearDisplay); setDisconnected(true); });
    observer.replace(credentials);
    const repair = () => {
      const next = consumeDisplayCredentials();
      // Revoke the previous in-memory grant before any new session is rendered.
      observer.replace(null);
      setModel(emptyLiveModel());
      setDisconnected(false);
      setHasCredentials(!!next);
      observer.replace(next);
    };
    window.addEventListener('hashchange', repair);
    return () => { window.removeEventListener('hashchange', repair); observer.stop(); };
  }, [credentials]);
  const resultExpiresAt = model.state?.result?.expiresAt;
  useEffect(() => {
    const deadlines = [model.expiresAt, resultExpiresAt].filter((value): value is string => !!value).map(Date.parse);
    if (!deadlines.length) return;
    const timer = window.setTimeout(() => setModel(previous => expireDisplay(previous, Date.now())), Math.max(0, Math.min(...deadlines) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [model.expiresAt, resultExpiresAt]);
  const state = model.state;
  const result = state?.result;
  const searching = state?.phase === 'checking';
  const sources: SearchSource[] = state?.sources.map(source => ({ id: source.id, label: source.hostname, mark: source.hostname.replace(/^www\./, '').slice(0, 1).toUpperCase(), color: '#727783' })) ?? [];
  const selected = result?.evidence.filter(source => result.selectedEvidenceIds.includes(source.id)) ?? [];
  const publisher = selected[0]?.publisher || (selected[0] ? new URL(selected[0].url).hostname.replace(/^www\./, '') : '');
  const capture = !model.modeKnown ? 'Claim checked' : state?.mode === 'ocr' ? 'Read from screen' : state?.mode === 'audio' ? 'Heard nearby' : 'Submitted claim';
  const outcome = result?.verdict === 'supported' ? 'outcome-true' : result?.verdict === 'contradicted' ? 'outcome-false' : 'outcome-neutral';
  return <main className="device-only"><div className="display-content" data-live="true" data-stage={state?.phase ?? 'ready'}><WearablesApp className="wearables-root"><div className="hud-body" aria-live="polite">{state?.phase === 'checking' && state.userInitiated && !model.restored && <ActionFeedback key={`${state.requestId}:${state.claimId}:${state.revision}`} kind="checking"/>}{state ? <section key={`${state.requestId}:${state.claimId}:${state.revision}`} className={`claim-stack live-claim-stack ${outcome} ${model.restored ? 'restored-state' : ''}`}><p className="capture-label"><span/>{capture}</p><p className="claim-text live-claim-text">{state.claimText}</p><div className={`evidence-surface ${searching ? 'is-searching' : 'is-result'}`} aria-busy={searching} style={searching ? { width: `${161 + (sources.length ? 27 + (sources.length - 1) * 18 : 0)}px` } : undefined}><div className="evidence-heading"><span className="evidence-dot"/><span className="evidence-title">{searching ? 'Searching...' : result ? verdicts[result.verdict] : 'Unclear'}</span>{searching ? <SearchSources sources={sources} restore={model.restored}/> : <span className="evidence-context">·&nbsp; {selected.length ? `${selected.length} ${selected.length === 1 ? 'source' : 'sources'}` : 'Limited evidence'}</span>}</div>{!searching && result && <div className="evidence-details"><p className="evidence-quote live-evidence-quote">{result.summary}</p>{publisher && <p className="evidence-publisher live-publisher">{publisher}</p>}</div>}</div></section> : (!hasCredentials || disconnected) && <p className="live-connection-status">{hasCredentials ? 'Reconnect from companion' : 'Connect from companion'}</p>}</div></WearablesApp></div></main>;
}
