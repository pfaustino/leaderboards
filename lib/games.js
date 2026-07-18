import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const games = JSON.parse(readFileSync(join(__dirname, '../games.json'), 'utf8'));

/** @typedef {typeof games[string]} GameConfig */

/** @param {string} gameId */
export function getGameConfig(gameId) {
  if (!gameId || typeof gameId !== 'string') return null;
  return games[gameId] ?? null;
}

export function listGames() {
  return Object.entries(games).map(([id, cfg]) => ({
    id,
    name: cfg.name,
    sort: cfg.sort,
  }));
}

export { games };
