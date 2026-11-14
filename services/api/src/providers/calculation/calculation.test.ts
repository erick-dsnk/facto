import { describe, expect, it } from 'vitest';
import { CALCULATION_URL } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { calculationEvidence, calculationResult, format } from './calculation.js';

// Friday 13 November 2026, as in the reference app's tests.
const friday = new Date(Date.UTC(2026, 10, 13, 12));
const result = (text: string) => calculationResult(text, friday);

describe('calculation', () => {
  it('S6: the claims.json calculations give the right sentences', () => {
    expect(result('100 miles is about 161 kilometres.')).toBe('100 miles = 160.93 km'); // calc-01
    expect(result('20% of 150 is 30.')).toBe('20% of 150 = 30'); // calc-02
    expect(result('1 January 2000 was a Saturday.')).toBe('1 January 2000 was a Saturday'); // calc-03
    expect(result('7 times 8 is 54.')).toBe('7 × 8 = 56'); // calc-04
    expect(result('32 degrees Fahrenheit is 10 degrees Celsius.')).toBe('32 degrees fahrenheit = 0 °C'); // calc-05
    expect(result('There are 5,280 feet in a mile.')).toBe('1 mile = 5,280 ft'); // calc-06
  });

  it('converts units', () => {
    expect(result('A kilogram is roughly 2.2 pounds')).toBe('1 kilogram = 2.2 lb');
    expect(result('100km/h equals 62 mph')).toBe('100 km/h = 62.14 mph');
    expect(result('1 week = 7 days')).toBe('1 week = 7 days');
  });

  it('works out percentages', () => {
    expect(result('30 is 20 percent of 150')).toBe('30 is 20% of 150');
    expect(result('Going from 50 to 75 is a 50% increase.')).toBe('From 50 to 75 is a 50% increase');
    expect(result('From 200 to 150 is a 25 per cent drop')).toBe('From 200 to 150 is a 25% decrease');
  });

  it('does arithmetic with × and ÷ first', () => {
    expect(result('12 x 12 = 144')).toBe('12 × 12 = 144');
    expect(result('100 divided by 4 equals 25')).toBe('100 ÷ 4 = 25');
    expect(result('2 + 3 * 4 = 14')).toBe('2 + 3 × 4 = 14');
    expect(result('10 - 7 = 3')).toBe('10 − 7 = 3');
  });

  it('finds weekdays and spans relative to the check date', () => {
    expect(result('July 4, 1776 fell on a Thursday')).toBe('4 July 1776 was a Thursday');
    expect(result('25 December 2026 will be a Monday')).toBe('25 December 2026 will be a Friday');
    expect(result('1969 was 57 years ago.')).toBe('1969 was 57 years before 2026');
    expect(result('From 1914 to 1918 is 4 years')).toBe('From 1914 to 1918 is 4 years');
    expect(result('There are 365 days between 1 January 2026 and 1 January 2027.')).toBe('There are 365 days between 1 January 2026 and 1 January 2027');
    expect(result('50 years have passed since 1976')).toBe('2026 is 50 years after 1976');
  });

  it('S6: non-calculations give nothing', () => {
    for (const text of ['Bats are blind.', 'Apollo 11 landed in 1969, 57 years ago.', '100 miles is about 161 kilograms.',
      'Mount Everest is 8,849 metres tall.', '20% of people are left-handed.', '10 divided by 0 is 5', '30 February 2000 was a Tuesday',
      '1 January 1500 was a Monday', '7 times 8', 'The answer is 42.', 'The population grew from 50 to 75, a 50% increase.', '',
      'Helsinki is the capital of Finland.', 'Goldfish only remember three seconds.']) {
      expect(result(text), text).toBeNull();
    }
  });

  it('formats numbers like the reference app', () => {
    expect(format(1716961)).toBe('1,716,961');
    expect(format(2.2e-12)).toBe('0');
    expect(format(-3.5)).toBe('−3.5');
    expect(format(0.0012341)).toBe('0.001234');
  });

  it('S1: the evidence has the placeholder url, its own publisher and the calculated mark', () => {
    const evidence = calculationEvidence('7 times 8 is 54.', friday, '2026-11-13T12:00:00.000Z')!;
    expect(evidenceSchema.parse(evidence)).toBeTruthy();
    expect(evidence).toMatchObject({ url: CALCULATION_URL, origin: 'calculation', publisher: 'Calculated by Facto', excerpt: '7 × 8 = 56 (calculated)',
      sourceGroup: 'calculation', stance: 'unrelated' });
    expect(evidence.id).toMatch(/^calculation-[0-9a-f]{16}$/);
    expect(calculationEvidence('Bats are blind.', friday, '2026-11-13T12:00:00.000Z')).toBeNull();
  });
});
