# Leaderboards API

Shared Vercel serverless API for global game leaderboards. One deployment, many games — each game has its own board via a `game` id and its own KPI in `value` + optional `meta`.

Live (after deploy): `https://<your-vercel-project>.vercel.app`

## Games

Register games in [`games.json`](./games.json):

- **GigaZonk** (`gigazonk`) — ranks by survival time (seconds)
- **Calamari Damacy** (`calamari-damacy`) — ranks by clear size (cm)

## API

### `GET /api/health`

Service info and registered game ids.

### `GET /api/leaderboard?game=gigazonk&limit=50`

Returns top scores for one game.

### `POST /api/score`

```json
{
  "game": "gigazonk",
  "player": "Zonker42",
  "value": 312,
  "meta": { "kills": 847, "level": 12, "character": "fox" }
}
```

Header: `X-Game-Key: <per-game secret from Vercel env WRITE_KEYS>`

## Setup

### 1. Turso database

1. [turso.tech](https://turso.tech) → create database `game-leaderboards`
2. Copy URL + read/write token
3. Local: copy `.env.example` → `.env` and fill values (see below)
4. Run schema once: `npm run init-db` (reads `.env` automatically)

**`.env` example** (create this file in the repo root — never commit it):

```env
TURSO_DATABASE_URL=libsql://game-leaderboards-pfaustino.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=your-token-from-turso-connect-tab
WRITE_KEYS={"gigazonk":"your-random-write-secret","calamari-damacy":"your-other-write-secret"}
```

### 2. Vercel

1. Import this GitHub repo as a new Vercel project named **leaderboards**
2. Environment variables (Production + Preview):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `WRITE_KEYS` — JSON, e.g. `{"gigazonk":"…","calamari-damacy":"…"}`
3. Deploy

### 3. Wire a game client

```js
const API = 'https://your-project.vercel.app';

await fetch(`${API}/api/score`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Game-Key': '<gigazonk secret>',
  },
  body: JSON.stringify({
    game: 'gigazonk',
    player: name,
    value: survivalSeconds,
    meta: { kills, level, character },
  }),
});

const board = await fetch(`${API}/api/leaderboard?game=gigazonk&limit=50`);
```

## Development

```bash
npm install
npm run check
```

Use `vercel dev` for local API testing (requires Vercel CLI + linked project).

## Adding a new game

1. Add entry to `games.json` (sort direction, max value, allowed origins)
2. Add write key to Vercel `WRITE_KEYS` JSON
3. Call API with that `game` id from the client

## License

MIT
