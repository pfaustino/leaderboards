/** @param {import('@vercel/node').VercelResponse} res */
/** @param {number} status */
/** @param {Record<string, string>} cors */
/** @param {unknown} body */
export function sendJson(res, status, cors, body) {
  res.status(status);
  for (const [key, value] of Object.entries(cors)) {
    res.setHeader(key, value);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(body);
}
