import { describe, expect, it } from 'vitest';
import { dedupeScoreRows, isBetterScore } from '../lib/scores.js';

describe('scores', () => {
  it('picks higher value for desc sort', () => {
    expect(isBetterScore(50, 40, 'desc')).toBe(true);
    expect(isBetterScore(40, 50, 'desc')).toBe(false);
  });

  it('dedupes rows by player name case-insensitively', () => {
    const rows = [
      { player: 'Prince', value: 120, meta: null, at: 100 },
      { player: 'prince', value: 160, meta: null, at: 200 },
      { player: 'Zara', value: 90, meta: null, at: 50 },
      { player: 'Prince', value: 140, meta: null, at: 150 },
    ];
    const out = dedupeScoreRows(rows, 'desc');
    expect(out).toHaveLength(2);
    expect(out[0].player).toBe('prince');
    expect(out[0].value).toBe(160);
    expect(out[1].value).toBe(90);
  });
});
