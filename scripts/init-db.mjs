import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, '../sql/schema.sql'), 'utf8');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createClient({ url, authToken });

for (const statement of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
  await db.execute(statement);
  console.log('OK:', statement.split('\n')[0]);
}

console.log('Database ready.');
