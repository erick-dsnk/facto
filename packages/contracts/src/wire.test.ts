import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceSpan, textInputSchema } from './index.js';
import { claimResultSchema, eventEnvelopeSchema } from './wire.js';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
describe('version 1 golden contracts', () => {
  it('uses Unicode scalar offsets across an emoji and currency sign', () => {
    const input = textInputSchema.parse(fixture('text-unicode'));
    const result = claimResultSchema.parse(fixture('result-manual-supported'));
    expect(sliceSpan(input.text, result.sourceSpan)).toBe(result.checkedText);
    expect(input.text.slice(result.sourceSpan.start, result.sourceSpan.end)).not.toBe(result.checkedText);
    expect(result.sourceSpan).toEqual({ start: 23, end: 55 });
  });
  it.each(['result-manual-supported', 'result-manual-insufficient', 'result-automatic-silent'])('validates %s', name => {
    expect(claimResultSchema.safeParse(fixture(name)).success).toBe(true);
  });
  it('validates results and waiting inside events', () => {
    const events = fixture('events') as unknown[];
    expect(events.every(e => eventEnvelopeSchema.safeParse(e).success)).toBe(true);
    expect(eventEnvelopeSchema.safeParse(fixture('event-waiting')).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...(events[1] as object), payload: {} }).success).toBe(false);
  });
  it('validates the capture.request event added compatibly to version 1', () => {
    const capture = fixture('event-capture-request') as Record<string, unknown>;
    expect(eventEnvelopeSchema.safeParse(capture).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...capture, payload: {} }).success).toBe(false);
  });
  it('rejects invented citations and spans that do not select the checked text', () => {
    const result = claimResultSchema.parse(fixture('result-manual-supported'));
    expect(claimResultSchema.safeParse({ ...result, selectedEvidenceIds: ['invented'] }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...result, sourceSpan: { start: 23, end: 53 } }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...result, evidence: [], selectedEvidenceIds: [] }).success).toBe(false);
  });
  it('bounds input in Unicode code points without silently truncating', () => {
    const input = textInputSchema.parse(fixture('text-unicode'));
    expect(textInputSchema.safeParse({ ...input, text: '🙂'.repeat(800) }).success).toBe(true);
    expect(textInputSchema.safeParse({ ...input, text: '🙂'.repeat(801) }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, context: ['a'.repeat(601), 'b'.repeat(600)] }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, text: '  ' }).success).toBe(false);
  });
});
