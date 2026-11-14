import { useEffect, useRef, useState } from 'react';

/** A publication or website found during retrieval, rather than the retrieval provider. */
export type SearchSource = {
  id: string;
  label: string;
  mark: string;
  color: string;
};

// Illustrative source arrivals only. A future stream can supply its own source array.
export const demoSources: readonly SearchSource[] = [
  { id: 'eiffel', label: 'toureiffel.paris', mark: 'T', color: '#a67d5d' },
  { id: 'britannica', label: 'Britannica', mark: 'B', color: '#315b9e' },
  { id: 'wikipedia', label: 'Wikipedia', mark: 'W', color: '#727783' },
  { id: 'science-museum', label: 'Science Museum', mark: 'S', color: '#53766e' },
];

/** Mock arrival timing stays outside the view, ready to be replaced with live progress. */
export function useDemoSources(searching: boolean, run: number) {
  const [sources, setSources] = useState<readonly SearchSource[]>([]);
  useEffect(() => {
    setSources([]);
    if (!searching) return;
    const timers = demoSources.map((_, index) => window.setTimeout(() => {
      setSources(demoSources.slice(0, index + 1));
    }, 280 + index * 700));
    return () => timers.forEach(window.clearTimeout);
  }, [searching, run]);
  return sources;
}

/** Keyed badges animate only newly received sites; earlier sites keep their position. */
export function SearchSources({ sources, restore = false }: { sources: readonly SearchSource[]; restore?: boolean }) {
  const restoredIds = useRef(new Set(restore ? sources.map(source => source.id) : []));
  const visible = sources.filter((source, index) => sources.findIndex(item => item.id === source.id) === index).slice(0, 4);
  return <span className="source-badges" aria-label={visible.length ? `Sources found: ${visible.map(source => source.label).join(', ')}` : 'Finding sources'}>{visible.map((source, index) => <span className={`source-badge-slot ${restoredIds.current.has(source.id) ? 'restored-source' : ''}`} key={source.id} style={{ zIndex: index + 1 }}><span className="source-badge" style={{ backgroundColor: source.color }} title={source.label}>{source.mark}</span></span>)}</span>;
}
