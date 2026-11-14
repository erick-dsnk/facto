import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import { retainAlternateEvidence } from './alternate-evidence.js';

const checkedText = 'The Meridian bridge opened in 1889.';
const source = (id: string, excerpt: string): Evidence => ({ id, url: `https://${id}.org/record`,
  title: 'Bridge register', publisher: null, publishedAt: '2026-11-14', retrievedAt: '2026-11-14T10:00:00Z',
  contentBasis: 'highlight', excerpt, sourceGroup: `${id}.org`, echoGroup: null, sourceRole: 'unknown',
  directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null });
const quote = 'The Meridian bridge opened in 1889.';
const context = `Register M-17. ${quote} However, public access began in 1890; the earlier date describes a private ceremony. Keeper: Municipal Archive.`;
const oldPage = (): Evidence => ({ ...source('alpha', context), contentBasis: 'page_text' });
const narrowed = (page: Evidence, excerpt = quote): Evidence => ({ ...page, contentBasis: 'highlight', excerpt, retrievedAt: '2026-11-14T10:00:05Z' });
const judgment = (records: Evidence[]): AssessedJudgment => ({ checkedText, label: 'insufficient_evidence',
  probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 },
  evidence: records.map(record => ({ ...record, sourceRole: 'primary', directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true,
    stance: 'supports', stanceProbability: .99 })), selectedEvidenceIds: [], misleadingReason: null,
  sourceAssessments: Object.fromEntries(records.map((record, index) => [record.id, { contentBasis: 'original_record', confidence: .99 - index * .01 }])),
  claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [] });

describe('exact contained highlight retention', () => {
  it('keeps the original contiguous context, contrary sentence, provenance and retrieval time without semantic promotion', () => {
    const page = oldPage();
    const retained = retainAlternateEvidence([page], [narrowed(page)], checkedText, judgment([page]));
    expect(retained).toHaveLength(1);
    expect(retained[0]).toMatchObject({ excerpt: context, contentBasis: 'page_text', retrievedAt: page.retrievedAt,
      sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null });
    expect(page.excerpt.includes(retained[0].excerpt)).toBe(true);
  });

  it.each(['page_text', 'noncontained', 'inverse', 'equal'] as const)('keeps replacement behavior for %s incoming material', variant => {
    const page = oldPage();
    const addition = narrowed(page, variant === 'noncontained' ? 'The Meridian bridge opened in 1890, not 1889.'
      : variant === 'inverse' ? `${context} A new archival correction follows.` : variant === 'equal' ? context : quote);
    if (variant === 'page_text') addition.contentBasis = 'page_text';
    const retained = retainAlternateEvidence([page], [addition], checkedText, judgment([page]));
    expect(retained[0]).toMatchObject({ excerpt: addition.excerpt, contentBasis: addition.contentBasis, retrievedAt: addition.retrievedAt });
  });

  it.each(['title', 'publisher', 'publishedAt', 'sourceGroup'] as const)('does not preserve the old variant after %s changes', field => {
    const page = oldPage();
    const addition = { ...narrowed(page), [field]: field === 'publishedAt' ? '2026-11-15' : 'Revised source identity' };
    const retained = retainAlternateEvidence([page], [addition], checkedText, judgment([page]));
    expect(retained[0]).toMatchObject({ excerpt: quote, contentBasis: 'highlight', retrievedAt: addition.retrievedAt });
  });

  it('matches Unicode and whitespace exactly rather than normalizing noncontained text', () => {
    const page = { ...oldPage(), excerpt: 'Archive İZMİR 🦉. First visitor crossing; public access followed later.' };
    const exact = narrowed(page, 'İZMİR 🦉');
    expect(retainAlternateEvidence([page], [exact], checkedText, judgment([page]))[0].excerpt).toBe(page.excerpt);
    for (const excerpt of ['I\u0307ZMİR 🦉', 'İZMİR  🦉']) {
      const changed = narrowed(page, excerpt);
      expect(retainAlternateEvidence([page], [changed], checkedText, judgment([page]))[0].excerpt).toBe(excerpt);
    }
  });

  it('counts the preserved old quote against the same two old reservations', () => {
    const pages = [oldPage(), { ...source('bravo', 'Independent ledger dates public crossing to the preceding winter.'), contentBasis: 'page_text' as const },
      { ...source('charlie', 'Engineering diary describes a separate civic ceremony in early spring.'), contentBasis: 'page_text' as const }];
    const incoming = [narrowed(pages[0]), ...Array.from({ length: 5 }, (_, i) => source(`new-${i}`, `${checkedText} Topical gardening entry ${i}.`))];
    const retained = retainAlternateEvidence(pages, incoming, checkedText, judgment(pages));
    expect(retained).toHaveLength(6);
    expect(retained.filter(record => pages.some(page => page.id === record.id))).toHaveLength(2);
    expect(retained.find(record => record.id === 'alpha')?.excerpt).toBe(context);
    expect(retained.filter(record => record.id.startsWith('new-'))).toHaveLength(4);
  });

  it('keeps a raw incoming copy bridge in the full-version dependence graph', () => {
    const shared = Array.from({ length: 20 }, (_, i) => `shared${i}`).join(' ');
    const page = { ...oldPage(), excerpt: `${Array.from({ length: 70 }, (_, i) => `prior${i}`).join(' ')} ${shared}` };
    const witness = source('charlie', `${shared} ${Array.from({ length: 20 }, (_, i) => `fresh${i}`).join(' ')}`);
    const incoming = [narrowed(page, shared), witness, ...Array.from({ length: 4 }, (_, i) => source(`noise-${i}`, `Unrelated orchard catalogue ${i}.`))];
    const retained = retainAlternateEvidence([page], incoming, checkedText, judgment([page]));
    expect(retained.filter(record => ['alpha', 'charlie'].includes(record.id)).length).toBeLessThanOrEqual(1);
    expect(retained.length).toBeLessThanOrEqual(6);
    if (retained.some(record => record.id === 'alpha')) expect(retained.find(record => record.id === 'alpha')?.excerpt).toBe(page.excerpt);
  });

  it('does not hide an existing conflict witness when an agreeing snippet omits the contrary context', () => {
    const page = oldPage();
    const counter = source('counter', 'Independent inspection ledger explicitly dates the first public crossing to 1890.');
    const initial = judgment([page, counter]);
    initial.evidence[1].stance = 'contradicts';
    const retained = retainAlternateEvidence([page, counter], [narrowed(page), source('new', 'New independent catalogue.')], checkedText, initial);
    expect(retained.map(record => record.id)).toEqual(expect.arrayContaining(['alpha', 'counter']));
    expect(retained.find(record => record.id === 'alpha')?.excerpt).toBe(context);
  });
});
