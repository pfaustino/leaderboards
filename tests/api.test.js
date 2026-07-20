import { describe, expect, it } from 'vitest';
import { getGameConfig } from '../lib/games.js';
import { isAllowedOrigin } from '../lib/cors.js';
import { parseScoreBody, parseLimit, verifyWriteKey } from '../lib/validate.js';

describe('games', () => {
  it('loads gigazonk config', () => {
    const cfg = getGameConfig('gigazonk');
    expect(cfg?.name).toBe('GigaZonk');
    expect(cfg?.sort).toBe('desc');
  });

  it('loads calamari-damacy config', () => {
    const cfg = getGameConfig('calamari-damacy');
    expect(cfg?.name).toBe('Calamari Damacy');
    expect(cfg?.sort).toBe('desc');
    expect(cfg?.minValue).toBe(1);
  });

  it('rejects unknown games', () => {
    expect(getGameConfig('not-a-game')).toBeNull();
  });
});

describe('cors', () => {
  it('allows localhost and itch/github pages', () => {
    const cfg = getGameConfig('gigazonk');
    expect(isAllowedOrigin('http://localhost:5174', cfg)).toBe(true);
    expect(isAllowedOrigin('https://pfaustino.itch.io', cfg)).toBe(true);
    expect(isAllowedOrigin('https://pfaustino.github.io', cfg)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', cfg)).toBe(false);
  });

  it('allows calamari localhost port', () => {
    const cfg = getGameConfig('calamari-damacy');
    expect(isAllowedOrigin('http://localhost:5173', cfg)).toBe(true);
  });
});

describe('validate', () => {
  it('parses a valid gigazonk score', () => {
    const result = parseScoreBody({
      game: 'gigazonk',
      player: 'Zonker',
      value: 120,
      meta: { kills: 50, level: 8 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.gameId).toBe('gigazonk');
      expect(result.entry.sortValue).toBe(120);
    }
  });

  it('parses a valid calamari-damacy score', () => {
    const result = parseScoreBody({
      game: 'calamari-damacy',
      player: 'Prince',
      value: 160,
      meta: { objects: 42, stage: 'Harbor', mode: 'size' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.gameId).toBe('calamari-damacy');
      expect(result.entry.sortValue).toBe(160);
    }
  });

  it('rejects values above game max', () => {
    const result = parseScoreBody({
      game: 'gigazonk',
      player: 'Zonker',
      value: 99999,
    });
    expect(result.ok).toBe(false);
  });

  it('clamps leaderboard limit', () => {
    expect(parseLimit('10')).toBe(10);
    expect(parseLimit('500')).toBe(100);
    expect(parseLimit(undefined)).toBe(50);
  });

  it('verifyWriteKey respects WRITE_KEYS env', () => {
    const prev = process.env.WRITE_KEYS;
    process.env.WRITE_KEYS = JSON.stringify({ gigazonk: 'sekrit' });
    expect(verifyWriteKey('gigazonk', 'sekrit')).toBe(true);
    expect(verifyWriteKey('gigazonk', 'nope')).toBe(false);
    process.env.WRITE_KEYS = prev;
  });
});
