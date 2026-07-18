import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Load `.env` from repo root (Node does not do this automatically). */
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

const schema = readFileSync(join(root, 'sql/schema.sql'), 'utf8');
const hadEnvFile = loadDotEnv();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL and/or TURSO_AUTH_TOKEN.');
  if (!hadEnvFile) {
    console.error('Create .env from .env.example in the leaderboards folder, then re-run.');
  } else {
    console.error('Check .env — both variables must be set (no quotes needed around the token).');
  }
  process.exit(1);
}

const db = createClient({ url, authToken });

for (const statement of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
  await db.execute(statement);
  console.log('OK:', statement.split('\n')[0]);
}

console.log('Database ready.');
