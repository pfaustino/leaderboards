import { getGameConfig } from '../lib/games.js';
import { insertScore } from '../lib/db.js';
import { corsHeaders } from '../lib/cors.js';
import { parseScoreBody, verifyWriteKey } from '../lib/validate.js';
import { sendJson } from '../lib/http.js';

/** @type {import('@vercel/node').VercelApiHandler} */
export default async function handler(req, res) {
  const body = req.body ?? {};
  const parsed = parseScoreBody(body);
  const cfg = parsed.ok ? getGameConfig(parsed.entry.gameId) : null;
  const cors = corsHeaders(req, cfg);

  if (req.method === 'OPTIONS') {
    res.status(204);
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, cors, { error: 'Method not allowed' });
  }

  if (!parsed.ok) {
    return sendJson(res, 400, cors, { error: parsed.error });
  }

  const writeKey = req.headers['x-game-key'];
  if (!verifyWriteKey(parsed.entry.gameId, typeof writeKey === 'string' ? writeKey : undefined)) {
    return sendJson(res, 401, cors, { error: 'invalid or missing X-Game-Key' });
  }

  try {
    await insertScore(parsed.entry);
    return sendJson(res, 201, cors, {
      ok: true,
      game: parsed.entry.gameId,
      player: parsed.entry.playerName,
      value: parsed.entry.sortValue,
    });
  } catch (err) {
    console.error('score insert failed', err);
    return sendJson(res, 500, cors, { error: 'database unavailable' });
  }
}
