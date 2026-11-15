/**
 * Plain prose from MediaWiki markup by pattern alone (port of the reference app's Wikitext and HTMLText).
 * Templates, tables, references and file links go; links keep their label. Good enough to find the
 * passages that bear on a claim, not to display a page. Every scan is linear, so unclosed markup stays fast.
 */
export function wikitextPlain(wikitext: string): string {
  let text = removeComments(wikitext);
  text = removeRefs(text);
  text = removeBalanced(text, '{{', '}}');
  text = removeBalanced(text, '{|', '|}');
  text = links(text);
  // Bounded, so an unclosed bracket cannot make each match scan the rest of the page.
  text = text.replace(/\[https?:\/\/[^\s\]]{1,500} ([^\]\n]{0,300})\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\]\n]{0,500}\]/g, '');
  text = text.replace(/'{2,}/g, '');
  text = text.replace(/__[A-Z]+__/g, '');
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('=')) continue;
    lines.push(line.replace(/^[*#:;]+\s*/, ''));
  }
  return htmlText(lines.join('\n'));
}

/** Drops `<!-- … -->`; an unclosed comment runs to the end. */
export function removeComments(text: string): string {
  let out = '';
  let index = 0;
  for (;;) {
    const open = text.indexOf('<!--', index);
    if (open < 0) return out + text.slice(index);
    out += text.slice(index, open);
    const close = text.indexOf('-->', open + 4);
    if (close < 0) return out;
    index = close + 3;
  }
}

/** Drops `<ref …/>` and `<ref …>…</ref>`, but not `<references>`. An unclosed reference runs to the end. */
/** Case-insensitive `indexOf` that keeps offsets into the original text (lowercasing can change string length). */
function findInsensitive(text: string, needle: string, from: number): number {
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'gi');
  pattern.lastIndex = from;
  return pattern.exec(text)?.index ?? -1;
}

export function removeRefs(text: string): string {
  let out = '';
  let index = 0;
  for (;;) {
    const open = findInsensitive(text, '<ref', index);
    if (open < 0) return out + text.slice(index);
    const after = open + 4;
    const next = text[after];
    if (next === undefined || !(next === '>' || next === '/' || /\s/.test(next))) {
      out += text.slice(index, after);
      index = after;
      continue;
    }
    out += text.slice(index, open);
    const tagEnd = text.indexOf('>', after);
    if (tagEnd < 0) return out;
    if (text[tagEnd - 1] === '/') { index = tagEnd + 1; continue; }
    const close = findInsensitive(text, '</ref>', tagEnd);
    if (close < 0) return out;
    index = close + 6;
  }
}

/** Drops every `open`…`close` span, nested ones included. An unclosed span runs to the end. */
export function removeBalanced(text: string, open: string, close: string): string {
  let out = '';
  let depth = 0;
  let index = 0;
  while (index < text.length) {
    if (depth === 0) {
      const next = text.indexOf(open, index);
      if (next < 0) return out + text.slice(index);
      out += text.slice(index, next);
      depth = 1;
      index = next + open.length;
      continue;
    }
    const nextOpen = text.indexOf(open, index);
    const nextClose = text.indexOf(close, index);
    if (nextClose < 0 && nextOpen < 0) return out;
    if (nextOpen >= 0 && (nextClose < 0 || nextOpen < nextClose)) { depth++; index = nextOpen + open.length; }
    else { depth--; index = nextClose + close.length; }
  }
  return out;
}

/** File and category namespaces in the editions people read most. */
const droppedNamespaces = new Set([
  'file', 'image', 'media', 'category', 'datei', 'bild', 'kategorie', 'fichier', 'catégorie', 'archivo', 'imagen',
  'categoría', 'immagine', 'categoria', 'plik', 'kategoria', 'bestand', 'categorie', 'fișier', 'imagine',
]);

/** A file or category link is dropped, as is any other prefixed link without its own label; a title with a colon keeps its label. */
function label(inner: string): string {
  const parts = inner.split('|');
  const target = parts[0] ?? '';
  const colon = target.indexOf(':');
  if (colon > 0 && !target.slice(0, colon).includes(' ')) {
    if (droppedNamespaces.has(target.slice(0, colon).toLowerCase()) || parts.length === 1) return '';
  }
  return (parts.at(-1) ?? '').trim();
}

/** `[[Target|label]]` as its label, `[[Target]]` as its target, innermost first so a caption's own links do not break its file link. */
export function links(text: string): string {
  let current = text;
  for (let round = 0; round < 5; round++) {
    let changed = false;
    current = current.replace(/\[\[([^[\]\n]{0,1000})\]\]/g, (_, inner: string) => { changed = true; return label(inner); });
    if (!changed) break;
  }
  return current;
}

const droppedElements = ['script', 'style', 'noscript', 'template', 'svg', 'head', 'nav', 'footer', 'iframe', 'button', 'select'];
const blocks = ['p', 'div', 'br', 'li', 'ul', 'ol', 'tr', 'td', 'th', 'table', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'header', 'main', 'aside', 'dd', 'dt', 'figcaption'];
const openPattern = new RegExp(`<!--|<(${droppedElements.join('|')})(?=[\\s/>])[^>]*>`, 'gis');
const blockPattern = new RegExp(`</?(${blocks.join('|')})(?=[\\s/>])[^>]*>`, 'gis');
const named: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', deg: '°', middot: '·', eacute: 'é', egrave: 'è', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä', times: '×',
};

function dropElements(html: string): string {
  let out = '';
  let position = 0;
  while (position < html.length) {
    openPattern.lastIndex = position;
    const open = openPattern.exec(html);
    if (!open) break;
    out += html.slice(position, open.index) + ' ';
    const after = open.index + open[0].length;
    if (!open[1]) {
      const close = html.indexOf('-->', after);
      position = close < 0 ? html.length : close + 3;
    } else {
      const close = findInsensitive(html, `</${open[1]}>`, after);
      if (close < 0) return out;
      const end = html.indexOf('>', close);
      position = end < 0 ? html.length : end + 1;
    }
  }
  return out + html.slice(position);
}

function decodeEntity(name: string): string | undefined {
  const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : name.startsWith('#') ? parseInt(name.slice(1), 10) : NaN;
  if (!Number.isNaN(code)) return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : undefined;
  return named[name];
}

/** Plain text from HTML by pattern alone: one paragraph per line, whitespace collapsed, empty lines dropped. */
export function htmlText(html: string): string {
  let text = dropElements(html);
  text = text.replace(blockPattern, '\n');
  text = text.replace(/<[^<>]*>/g, '');
  text = text.replace(/&(#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (match, name: string) => decodeEntity(name.toLowerCase()) ?? match);
  text = text.replace(/\[(\d{1,3}|citation needed|note \d+)\]/gi, '');
  // Invisible format characters can hide text from a reader.
  text = text.replace(/\p{Cf}/gu, '');
  return text.split(/\r?\n/).map(line => line.split(/\s+/u).filter(Boolean).join(' ')).filter(Boolean).join('\n');
}
