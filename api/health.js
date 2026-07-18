import { listGames } from '../lib/games.js';
import { sendJson } from '../lib/http.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** @type {import('@vercel/node').VercelApiHandler} */
export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204);
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
    return res.end();
  }
  if (req.method !== 'GET') {
    return sendJson(res, 405, cors, { error: 'Method not allowed' });
  }
  return sendJson(res, 200, cors, {
    ok: true,
    service: 'leaderboards',
    games: listGames(),
  });
}
