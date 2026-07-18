import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  }
  if (!client) {
    client = createClient({ url, authToken });
  }
  return client;
}

/** @param {{ gameId: string, playerName: string, sortValue: number, metaJson: string | null, createdAt: number }} entry */
export async function insertScore(entry) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO scores (game_id, player_name, sort_value, meta, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [entry.gameId, entry.playerName, entry.sortValue, entry.metaJson, entry.createdAt],
  });
}

/** @param {string} gameId */
/** @param {number} limit */
export async function fetchTopScores(gameId, limit) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT player_name, sort_value, meta, created_at
          FROM scores
          WHERE game_id = ?
          ORDER BY sort_value DESC, created_at ASC
          LIMIT ?`,
    args: [gameId, limit],
  });
  return result.rows.map((row) => ({
    player: String(row.player_name),
    value: Number(row.sort_value),
    meta: row.meta ? JSON.parse(String(row.meta)) : null,
    at: Number(row.created_at),
  }));
}
