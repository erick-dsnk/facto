import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as WearablesApp } from '@wearables-ui-toolkit/mrbd/App';
import '@wearables-ui-toolkit/mrbd/styles.css';
import './styles.css';
import { SearchSources, useDemoSources } from './SearchSources';
import { LiveDisplay, consumeDisplayCredentials } from './LiveDisplay';

type Stage = 'true' | 'searching' | 'false' | 'ready';
type Environment = 'lens' | 'daylight' | 'evening' | 'black';
const stages: { id: Stage; label: string }[] = [
  { id: 'true', label: 'True · Eiffel Tower' },
  { id: 'searching', label: 'Searching · Eiffel Tower' },
  { id: 'false', label: 'False · Goldfish' },
  { id: 'ready', label: 'Empty display' },
];
function normalizeStage(value: string | null): Stage {
  if (value === 'true' || value === 'supported' || value === 'context') return 'true';
  if (['searching', 'checking', 'scanning', 'detected', 'listening'].includes(value ?? '')) return 'searching';
  if (value === 'ready' || value === 'dismissed') return 'ready';
  return 'false';
}
const params = new URLSearchParams(window.location.search);
const autoDemo = params.get('demo') === '1';
const displayOnly = params.get('display') === '1';
const inspectOnly = params.get('inspect') === '1';
const initialEnvironment: Environment = ['lens', 'daylight', 'evening', 'black'].includes(params.get('env') ?? '') ? params.get('env') as Environment : 'lens';
const examples = {
  true: {
    capture: 'Read from screen', claim: ['The Eiffel Tower grows up to', '15 cm taller in summer.'],
    verdict: 'True', context: 'official site', quote: ['“The tower can grow up to 15 cm', 'as its iron expands in the heat.”'], publisher: 'toureiffel.paris',
  },
  false: {
    capture: 'Heard nearby', claim: ['Goldfish only remember things', 'for three seconds.'],
    verdict: 'False', context: '3 of 3 sources disagree', quote: ['“Goldfish can remember things', 'for months, not seconds.”'], publisher: 'Live Science',
  },
};
function Studio() {
  const [stage, setStage] = useState<Stage>(() => autoDemo ? 'searching' : normalizeStage(params.get('state')));
  const [environment, setEnvironment] = useState<Environment>(initialEnvironment);
  const [playing, setPlaying] = useState(autoDemo);
  const [searchRun, setSearchRun] = useState(0);
  // Normalize retained state too, so an already-open older simulator tab updates through HMR.
  const current = normalizeStage(stage);
  const change = (next: Stage) => {
    setStage(next);
    setSearchRun(run => run + 1);
    const url = new URL(window.location.href);
    url.searchParams.set('state', next);
    window.history.replaceState({}, '', url);
  };
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => { change('true'); setPlaying(false); }, 4200);
    return () => window.clearTimeout(timer);
  }, [playing]);
  const searching = current === 'searching';
  const sources = useDemoSources(searching, searchRun);
  const example = examples[current === 'false' ? 'false' : 'true'];
  const display = <div className="display-content" data-stage={current}><WearablesApp className="wearables-root"><div className="hud-body" aria-live="polite">{current !== 'ready' && <section className={`claim-stack ${current === 'false' ? 'outcome-false' : 'outcome-true'}`}><p className="capture-label"><span/>{example.capture}</p><p className="claim-text">{example.claim[0]}<br/>{example.claim[1]}</p><div className={`evidence-surface ${searching ? 'is-searching' : 'is-result'}`} aria-busy={searching} style={searching ? { width: `${161 + (sources.length ? 27 + (sources.length - 1) * 18 : 0)}px` } : undefined}><div className="evidence-heading"><span className="evidence-dot"/><span className="evidence-title">{searching ? 'Searching...' : example.verdict}</span>{searching ? <SearchSources sources={sources}/> : <span className="evidence-context">·&nbsp; {example.context}</span>}</div>{!searching && <div className="evidence-details"><p className="evidence-quote">{example.quote[0]}<br/>{example.quote[1]}</p><p className="evidence-publisher">{example.publisher}</p></div>}</div></section>}</div></WearablesApp></div>;
  if (displayOnly || inspectOnly) return <main className={`device-only ${inspectOnly ? 'reference-inspection' : ''}`}>{display}</main>;
  return <main className="studio"><header className="studio-header"><span>Actually <span className="prototype-label">Display prototype</span></span><a href={`?display=1&state=${current}`}>Open display ↗</a></header><div className="studio-layout"><section className="preview-section" aria-label="Glasses display preview"><div className={`device-viewport environment-${environment}`}><div className="device-overlay">{display}</div></div><p className="preview-caption">600 × 600 · Mock search progress · {environment === 'lens' ? 'Reference lens composition' : 'Additive browser preview'}</p></section><aside className="studio-controls"><label htmlFor="state">Display state</label><select id="state" value={current} onChange={event => { setPlaying(false); change(event.target.value as Stage); }}>{stages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><label htmlFor="environment">Preview background</label><select id="environment" value={environment} onChange={event => setEnvironment(event.target.value as Environment)}><option value="lens">Reference · Dark lens</option><option value="black">Black · Additive display</option><option value="daylight">Light ambient test</option><option value="evening">Dark ambient test</option></select><button className="play-button" disabled={playing} onClick={() => { change('searching'); setPlaying(true); }}>{playing ? 'Searching…' : 'Replay search → True'}</button><a className="inspection-link" href={`?inspect=1&state=${current}`}>Open reference inspection</a><p className="control-help">No buttons appear on the glasses.<br/>Use these controls to preview.</p><p className="simulator-note">Source arrivals are a timed UI demo; no live search is connected. The reference lens is an external comparison surface. The display route contains only the black additive canvas and HUD.</p></aside></div></main>;
}
const live = params.get('live') === '1';
const credentials = live ? consumeDisplayCredentials() : null;
createRoot(document.getElementById('root')!).render(live ? <LiveDisplay credentials={credentials}/> : <Studio/>);
