import { describe, expect, it } from 'vitest';
import { computeStats } from './stats.js';

const votes = (...values) => values.map((value) => ({ value }));

describe('computeStats', () => {
  it('handles an empty round', () => {
    expect(computeStats([])).toMatchObject({
      count: 0,
      numericCount: 0,
      average: null,
      min: null,
      max: null,
      spread: null,
      consensus: false,
      distribution: [],
    });
  });

  it('computes average, min/max and spread over numeric votes', () => {
    const stats = computeStats(votes('2', '3', '8'));
    expect(stats.count).toBe(3);
    expect(stats.numericCount).toBe(3);
    expect(stats.average).toBe(4.33);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(8);
    expect(stats.spread).toBe(6);
    expect(stats.consensus).toBe(false);
  });

  it('flags consensus when every vote is identical', () => {
    const stats = computeStats(votes('5', '5', '5'));
    expect(stats.consensus).toBe(true);
    expect(stats.spread).toBe(0);
    expect(stats.average).toBe(5);
  });

  it('ignores non-numeric values in the numeric stats but keeps them in the distribution', () => {
    const stats = computeStats(votes('3', '5', '?'));
    expect(stats.count).toBe(3);
    expect(stats.numericCount).toBe(2);
    expect(stats.average).toBe(4);
    expect(stats.min).toBe(3);
    expect(stats.max).toBe(5);
    expect(stats.distribution).toEqual([
      { value: '3', count: 1 },
      { value: '5', count: 1 },
      { value: '?', count: 1 },
    ]);
  });

  it('treats an all-non-numeric round as consensus when identical, with null numeric stats', () => {
    const stats = computeStats(votes('?', '?'));
    expect(stats.consensus).toBe(true);
    expect(stats.numericCount).toBe(0);
    expect(stats.average).toBeNull();
    expect(stats.spread).toBeNull();
  });

  it('orders the distribution numerically ascending with non-numerics last', () => {
    const stats = computeStats(votes('8', '3', '?', '3', '13'));
    expect(stats.distribution).toEqual([
      { value: '3', count: 2 },
      { value: '8', count: 1 },
      { value: '13', count: 1 },
      { value: '?', count: 1 },
    ]);
  });
});
