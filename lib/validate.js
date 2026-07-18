import { getGameConfig } from './games.js';

const MAX_PLAYER_LEN = 24;
const MAX_META_JSON = 2048;

/** @param {unknown} body */
export function parseScoreBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'JSON body required' };
  }
  const { game, player, value, meta } = /** @type {Record<string, unknown>} */ (body);
  if (typeof game !== 'string' || !game.trim()) {
    return { ok: false, error: 'game is required' };
  }
  const gameId = game.trim().toLowerCase();
  const cfg = getGameConfig(gameId);
  if (!cfg) return { ok: false, error: `unknown game: ${gameId}` };

  if (typeof player !== 'string' || !player.trim()) {
    return { ok: false, error: 'player is required' };
  }
  const playerName = player.trim().slice(0, MAX_PLAYER_LEN);
  if (!/^[\w\s\-.'!?]+$/u.test(playerName)) {
    return { ok: false, error: 'player name has invalid characters' };
  }

  const sortValue = Number(value);
  if (!Number.isFinite(sortValue)) {
    return { ok: false, error: 'value must be a number' };
  }
  if (sortValue < (cfg.minValue ?? 0)) {
    return { ok: false, error: 'value below minimum' };
  }
  if (sortValue > (cfg.maxValue ?? Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: 'value above maximum' };
  }

  let metaJson = null;
  if (meta != null) {
    if (typeof meta !== 'object' || Array.isArray(meta)) {
      return { ok: false, error: 'meta must be an object' };
    }
    metaJson = JSON.stringify(meta);
    if (metaJson.length > MAX_META_JSON) {
      return { ok: false, error: 'meta too large' };
    }
  }

  return {
    ok: true,
    entry: {
      gameId,
      playerName,
      sortValue,
      metaJson,
      createdAt: Date.now(),
    },
  };
}

/** @param {string} gameId */
/** @param {string | undefined} keyHeader */
export function verifyWriteKey(gameId, keyHeader) {
  const raw = process.env.WRITE_KEYS;
  if (!raw) {
    return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';
  }
  try {
    const map = JSON.parse(raw);
    const expected = map[gameId];
    if (!expected) return false;
    return typeof keyHeader === 'string' && keyHeader === expected;
  } catch {
    return false;
  }
}

/** @param {string} raw */
export function parseLimit(raw, fallback = 50) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}
