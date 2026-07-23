# Leaderboards API

Shared Vercel serverless API for global game leaderboards. One deployment, many games — each game has its own board via a `game` id and its own KPI in `value` + optional `meta`.

Live (after deploy): `https://<your-vercel-project>.vercel.app`

## Games

Register games in [`games.json`](./games.json):

- **GigaZonk** (`gigazonk`) — ranks by survival time (seconds)
- **Calamari Damacy** (`calamari-damacy`) — ranks by clear size (cm)
- **Tower of Power** (`tower-of-power`) — ranks by waves cleared

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
WRITE_KEYS={"gigazonk":"your-random-write-secret","calamari-damacy":"your-other-write-secret","tower-of-power":"your-tower-of-power-secret"}
```

### 2. Vercel

1. Import this GitHub repo as a new Vercel project named **leaderboards**
2. Environment variables (Production + Preview):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `WRITE_KEYS` — JSON, e.g. `{"gigazonk":"…","calamari-damacy":"…","tower-of-power":"…"}`
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

Register the game on the **leaderboards server first**, then wire the game client. Until this is deployed, `GET /api/leaderboard?game=<id>` returns **404 unknown game**.

### 1. Add an entry to `games.json`

Use a lowercase kebab-case `id` (this becomes the `game` query param and POST body field).

```json
"my-game": {
  "name": "My Game",
  "sort": "desc",
  "maxValue": 100,
  "minValue": 1,
  "displayMeta": ["difficulty", "crystals"],
  "allowedOrigins": [
    "http://localhost:5173",
    "https://pfaustino.github.io",
    "https://pfaustino.itch.io"
  ]
}
```

| Field | Purpose |
|-------|---------|
| `sort` | Always `"desc"` today (higher `value` ranks higher) |
| `maxValue` / `minValue` | Server rejects scores outside this range |
| `displayMeta` | Keys echoed in API rows (documentation only) |
| `allowedOrigins` | CORS — include every host that will call the API (local dev port, GitHub Pages, itch) |

**Example — Tower of Power** (`tower-of-power`):

```json
"tower-of-power": {
  "name": "Tower of Power",
  "sort": "desc",
  "maxValue": 100,
  "minValue": 1,
  "displayMeta": ["difficulty", "crystals", "victory", "outpostHp"],
  "allowedOrigins": [
    "http://localhost:5185",
    "https://pfaustino.github.io",
    "https://pfaustino.itch.io"
  ]
}
```

### 2. Add a write key in Vercel

In the leaderboards Vercel project, edit the `WRITE_KEYS` environment variable (Production **and** Preview). Add a new random secret keyed by the same game id:

```json
{
  "gigazonk": "…",
  "calamari-damacy": "…",
  "tower-of-power": "generate-a-long-random-string"
}
```

The write key is passed from game clients as the `X-Game-Key` header. It is visible in the client bundle and only deters casual spam.

### 3. Commit, push, and redeploy

```bash
git add games.json
git commit -m "Register <game-id> on the leaderboard API."
git push origin main
```

Vercel redeploys automatically on push to `main`.

### 4. Verify registration

```bash
curl https://leaderboards-opal.vercel.app/api/health
```

The response `games` array must include your new id. Then:

```bash
curl "https://leaderboards-opal.vercel.app/api/leaderboard?game=<game-id>&limit=5"
```

Should return `{ "game": "<game-id>", "rows": [] }` — not `404 unknown game`.

### 5. Wire the game client

In the game repo:

1. Copy `src/lib/globalLeaderboard.js` from an existing game (GigaZonk or Calamari Damacy) and set `LEADERBOARD_GAME_ID`.
2. Submit scores on run end via `POST /api/score` with `X-Game-Key`.
3. Fetch the board via `GET /api/leaderboard?game=<game-id>`.
4. For GitHub Pages builds, add a repo secret `VITE_LEADERBOARD_WRITE_KEY` (same value as in `WRITE_KEYS`) and pass it to `npm run build`.

See each game's `.env.example` for local dev (`VITE_LEADERBOARD_API`, `VITE_LEADERBOARD_WRITE_KEY`).

## License

MIT
