import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dedupeAllGames } from '../lib/db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return false;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  return true;
}

const hadEnvFile = loadDotEnv();
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Missing TURSO_DATABASE_URL and/or TURSO_AUTH_TOKEN.');
  if (!hadEnvFile) {
    console.error('Create .env from .env.example, then re-run: npm run dedupe-scores');
  }
  process.exit(1);
}

const removed = await dedupeAllGames();
console.log(`Removed ${removed} duplicate score row(s).`);
