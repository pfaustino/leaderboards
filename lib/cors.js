/** @param {string | undefined} origin */
/** @param {import('./games.js').GameConfig | null} gameConfig */
export function isAllowedOrigin(origin, gameConfig) {
  if (!origin) return false;
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.endsWith('.itch.io') || origin.endsWith('.itch.zone')) return true;
  if (origin.includes('.github.io')) return true;
  const allowed = gameConfig?.allowedOrigins ?? [];
  return allowed.includes(origin);
}

/** @param {import('@vercel/node').VercelRequest} req */
/** @param {import('./games.js').GameConfig | null} gameConfig */
export function corsHeaders(req, gameConfig) {
  const origin = req.headers.origin;
  const allow = isAllowedOrigin(origin, gameConfig);
  return {
    'Access-Control-Allow-Origin': allow && origin ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Game-Key',
    'Vary': 'Origin',
  };
}

/** @param {import('@vercel/node').VercelResponse} res */
/** @param {Record<string, string>} headers */
export function applyCors(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}
