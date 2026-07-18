import { getGameConfig } from '../lib/games.js';
import { fetchTopScores } from '../lib/db.js';
import { corsHeaders } from '../lib/cors.js';
import { parseLimit } from '../lib/validate.js';
import { sendJson } from '../lib/http.js';

/** @type {import('@vercel/node').VercelApiHandler} */
export default async function handler(req, res) {
  const gameId = typeof req.query.game === 'string' ? req.query.game.trim().toLowerCase() : '';
  const cfg = getGameConfig(gameId);
  const cors = corsHeaders(req, cfg);

  if (req.method === 'OPTIONS') {
    res.status(204);
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
    return res.end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, cors, { error: 'Method not allowed' });
  }

  if (!cfg) {
    return sendJson(res, 404, cors, { error: 'unknown game' });
  }

  const limit = parseLimit(req.query.limit);

  try {
    const rows = await fetchTopScores(gameId, limit);
    return sendJson(res, 200, cors, {
      game: gameId,
      name: cfg.name,
      sort: cfg.sort,
      rows,
    });
  } catch (err) {
    console.error('leaderboard fetch failed', err);
    return sendJson(res, 500, cors, { error: 'database unavailable' });
  }
}
