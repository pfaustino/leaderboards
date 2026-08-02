import { createClient } from '@libsql/client';
import { isBetterScore, sortValueSql } from './scores.js';

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
async function insertScoreRow(entry) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO scores (game_id, player_name, sort_value, meta, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [entry.gameId, entry.playerName, entry.sortValue, entry.metaJson, entry.createdAt],
  });
}

/**
 * @param {{ gameId: string, playerName: string, sortValue: number, metaJson: string | null, createdAt: number }} entry
 * @param {{ uniquePlayer?: boolean, sort?: 'desc' | 'asc' }} cfg
 * @returns {Promise<'inserted' | 'skipped'>}
 */
export async function submitScore(entry, cfg = {}) {
  const uniquePlayer = cfg.uniquePlayer !== false;
  const sort = cfg.sort === 'asc' ? 'asc' : 'desc';

  if (!uniquePlayer) {
    await insertScoreRow(entry);
    return 'inserted';
  }

  const db = getDb();
  const valueOrder = sortValueSql(sort);
  const existing = await db.execute({
    sql: `SELECT sort_value FROM scores
          WHERE game_id = ? AND LOWER(player_name) = LOWER(?)
          ORDER BY sort_value ${valueOrder}, created_at ASC
          LIMIT 1`,
    args: [entry.gameId, entry.playerName],
  });

  if (existing.rows.length > 0) {
    const best = Number(existing.rows[0].sort_value);
    if (!isBetterScore(entry.sortValue, best, sort)) {
      return 'skipped';
    }
    await db.execute({
      sql: `DELETE FROM scores WHERE game_id = ? AND LOWER(player_name) = LOWER(?)`,
      args: [entry.gameId, entry.playerName],
    });
  }

  await insertScoreRow(entry);
  return 'inserted';
}

/** @deprecated Use submitScore */
export async function insertScore(entry) {
  await insertScoreRow(entry);
}

/** @param {string} gameId @param {number} limit @param {{ uniquePlayer?: boolean, sort?: 'desc' | 'asc' }} cfg */
export async function fetchTopScores(gameId, limit, cfg = {}) {
  const db = getDb();
  const uniquePlayer = cfg.uniquePlayer !== false;
  const sort = cfg.sort === 'asc' ? 'asc' : 'desc';
  const valueOrder = sortValueSql(sort);

  const sql = uniquePlayer
    ? `SELECT player_name, sort_value, meta, created_at
       FROM (
         SELECT player_name, sort_value, meta, created_at,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(player_name)
             ORDER BY sort_value ${valueOrder}, created_at ASC
           ) AS rn
         FROM scores
         WHERE game_id = ?
       )
       WHERE rn = 1
       ORDER BY sort_value ${valueOrder}, created_at ASC
       LIMIT ?`
    : `SELECT player_name, sort_value, meta, created_at
       FROM scores
       WHERE game_id = ?
       ORDER BY sort_value ${valueOrder}, created_at ASC
       LIMIT ?`;

  const result = await db.execute({ sql, args: [gameId, limit] });
  return result.rows.map((row) => ({
    player: String(row.player_name),
    value: Number(row.sort_value),
    meta: row.meta ? JSON.parse(String(row.meta)) : null,
    at: Number(row.created_at),
  }));
}

/** Remove duplicate rows, keeping each player's best score per game. */
export async function dedupeAllGames() {
  const db = getDb();
  const games = await db.execute({
    sql: 'SELECT DISTINCT game_id FROM scores',
    args: [],
  });

  let removed = 0;
  for (const row of games.rows) {
    const gameId = String(row.game_id);
    const before = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM scores WHERE game_id = ?',
      args: [gameId],
    });
    await db.execute({
      sql: `DELETE FROM scores
            WHERE game_id = ?
            AND id NOT IN (
              SELECT id FROM (
                SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY LOWER(player_name)
                    ORDER BY sort_value DESC, created_at ASC
                  ) AS rn
                FROM scores
                WHERE game_id = ?
              )
              WHERE rn = 1
            )`,
      args: [gameId, gameId],
    });
    const after = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM scores WHERE game_id = ?',
      args: [gameId],
    });
    removed += Number(before.rows[0].n) - Number(after.rows[0].n);
  }
  return removed;
}
