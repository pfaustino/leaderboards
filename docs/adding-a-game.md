# Runbook: Add a leaderboard to a new game (autonomous, no dashboard)

> **What this replaces:** the old flow required a human to open the Vercel dashboard,
> copy the current `WRITE_KEYS` JSON, hand-edit it, and paste it back. This runbook
> is the **agent-autonomous** flow: everything is done from the CLI/API, exactly as
> was done for **Bullet Hell** (the agent never touched the dashboard, and the game
> owner never pasted a write key).
>
> **Key prerequisites:**
> - The **Vercel CLI** (`vercel`) must be installed **and authenticated** as the
>   owner of the leaderboards project. Install once: `npm i -g vercel`, then
>   `vercel login` (a browser flow done once by a human).
> - Only **one human step exists in this flow**: that first `vercel login`.

---

## TL;DR (the whole flow)

1. **Server:** add `games.json` entry → commit → push (auto-deploys).
2. **Key:** read existing keys + build the merged JSON (from verified keys on disk, not dashboard).
3. **Deploy env:** `vercel` CLI/API → PATCH `WRITE_KEYS` with the complete merged JSON (Production + Preview).
4. **Redeploy** the server so the new env takes effect.
5. **Verify** live via the API: new game writes 201; existing games still 200 (`updated:false`).

---

## Step 0 — Prerequisites (one-time)

```bash
npm i -g vercel
vercel login        # browser flow, one-time human step
vercel whoami       # → pfaustino
```

> The Vercel CLI auth token lives at `%APPDATA%\xdg.data\com.vercel.cli\auth.json`
> (Windows) and is used by the REST API calls in this runbook. `vercel env pull`
> **masks sensitive values as `SENSITIVE`** — you cannot read the real key values
> from the CLI. That's fine: you don't need to read them.

---

## Step 1 — Register the game on the server

Edit `games.json` in the leaderboards repo:

```json
"my-game": {
  "name": "My Game",
  "sort": "desc",
  "maxValue": 100,
  "minValue": 1,
  "displayMeta": ["level", "kills"],
  "allowedOrigins": [
    "http://localhost:5173",
    "https://pfaustino.github.io",
    "https://pfaustino.itch.io"
  ]
}
```

- `sort` is always `"desc"` today.
- `maxValue`/`minValue` bound the single sort `value`.
- `allowedOrigins` — include **every host** that will call the API (local dev port, GitHub Pages, itch). `http://localhost:*` and `.github.io` / `.itch.io` are auto-allowed, but list the specific dev port anyway.
- For **composite scoring** (rank by multiple fields, like Bullet Hell's wave → time → kills), encode dominance into `value` client-side: `value = wave * 1e9 + time * 1e4 + kills` with `maxValue = Number.MAX_SAFE_INTEGER`. Reference implementation: Bullet Hell's `LEADERBOARD.computeScore()` in `game_v3.js`.

Commit + push — Vercel auto-redeploys:

```bash
git add games.json
git commit -m "Register my-game on the leaderboard API."
git push origin main
```

Then set up the DB schema check + registration test (see the existing pattern in `tests/api.test.js`).

---

## Step 2 — Verify the game is live (no key needed)

```bash
curl https://leaderboards-opal.vercel.app/api/health
# → games array must include "my-game"

curl "https://leaderboards-opal.vercel.app/api/leaderboard?game=my-game&limit=5"
# → {"game":"my-game","rows":[]}  (NOT 404 unknown game)
```

This is the **only server-side step** — the API is now serving the empty board.

---

## Step 3 — Add the write key (fully autonomous via Vercel API)

The API validates the `X-Game-Key` header against `WRITE_KEYS`, a **JSON object**
mapping game id → secret. The current value is **not readable** (Vercel masks
sensitive env values from CLI + REST), so **never try to read-then-edit**. Instead:

1. **Collect the current known keys** for existing games. They're usually in each
   game repo's local `.env` (gitignored) or in the deployed client bundle (search
   for `pick-any-long-random-secret` or the API base). Verify each against the live
   API **before** touching anything (zero-pollution probes below).

2. **Generate a random key** for the new game:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **PATCH the `WRITE_KEYS` env var** with the **complete merged JSON** — all
   existing games' verified keys + the new game's key. This is a **full replace**,
   but because it's the complete value, "replace" is safe (no append semantics
   needed). The env var id comes from listing env:

   ```bash
   # (Windows PowerShell examples — adjust for your shell)
   $auth = Get-Content "$env:APPDATA\xdg.data\com.vercel.cli\auth.json" -Raw | ConvertFrom-Json
   $tok = $auth.token
   $h = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }

   # find project id + env id
   $proj = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects" -Headers $h | ? name -eq leaderboards
   $envs = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$($proj.id)/env" -Headers $h
   $writeKeys = $envs.envs | ? key -eq WRITE_KEYS

   # PATCH — body is just {value: <full merged JSON>} (no type field!)
   $merged = '{"gigazonk":"<existing>","calamari-damacy":"<existing>","tower-of-power":"<existing>","my-game":"<new-key>"}'
   Invoke-RestMethod -Method Patch -Uri "https://api.vercel.com/v9/projects/$($proj.id)/env/$($writeKeys.id)" `
     -Headers $h -Body (@{ value = $merged } | ConvertTo-Json)
   ```

   > **Gotcha:** do **not** include a `type` field in the PATCH body — it causes 400.
   > The PATCH response returns `value: ""` for sensitive vars (masked) — that's normal.

4. **Redeploy** so the running server picks up the new env:
   ```bash
   cd <leaderboards repo>
   vercel deploy --prod --project leaderboards --yes
   ```

---

## Step 4 — Verify live (zero-pollution probes)

The API has **no probe/delete endpoint**, so verify with **skipped writes**:
POST a value that is **worse than an existing player's best** with a player name
that already exists → the server returns `200 {updated:false}` **without inserting
a row**. That proves the key is valid without polluting the board.

```bash
# For each existing game + your new game (use an existing player + low value):
curl -s -X POST https://leaderboards-opal.vercel.app/api/score \
  -H "Content-Type: application/json" -H "X-Game-Key: <key>" \
  -d '{"game":"gigazonk","player":"Pritrix","value":5,"meta":{}}'
# → 200 {"ok":true,...,"updated":false}  = key VALID, nothing inserted

# For the NEW game (empty board): a real write returns 201 and is visible:
curl -s -X POST https://leaderboards-opal.vercel.app/api/score \
  -H "Content-Type: application/json" -H "X-Game-Key: <new-key>" \
  -d '{"game":"my-game","player":"verify-test","value":1,"meta":{}}'
# → 201 {"ok":true,...,"updated":true}

curl "https://leaderboards-opal.vercel.app/api/leaderboard?game=my-game&limit=5"
# → row present
```

> The 201 test write **stays on the live board** (no delete endpoint + Turso creds
> are masked). Label it clearly (e.g. player `key-verify-test`) so a human can
> remove it from the Turso dashboard later if desired.

---

## Step 5 — Wire the game client

1. Copy the leaderboard object from an existing game (Bullet Hell's `LEADERBOARD`
   in `game_v3.js` is the reference: composite score, modal, Local/Global tabs,
   name prompt, quit-save, auto-submit).
2. The client needs the API base + write key at **build time via env**:
   - Dev: local `.env` with `VITE_LEADERBOARD_API=...` + `VITE_LEADERBOARD_WRITE_KEY=<key>`.
   - GitHub Pages: repo secret + workflow env injection into `npm run build`.
   - Vercel: project env var in the game's own project.
3. Submit on **run end (death AND quit)** — auto-submit if a name exists, prompt
   otherwise (Bullet Hell's A3 behavior).
4. **No key = read-only/offline fallback** (show local best only). Ship that
   default first so the game never breaks if the key is missing.

---

## Gotchas & hard-won lessons

- **Vercel masks all sensitive env values** — from `vercel env pull` AND the REST
  API (`GET /env` returns `value:""`). You **cannot** read the current `WRITE_KEYS`.
  Plan around write-only access (that's why the PATCH is a full-value replace built
  from **verified** keys, not read-modify-write).
- **`vercel env pull` prints `SENSITIVE` for sensitive vars** (11 chars) — do not
  mistake that for the real value (a probe would 401/400 against the placeholder).
- **PATCH body must be `{value}` only** — adding `type` → 400.
- **GitHub Actions secrets are write-only** — you can't read a game's key from
  `gh secret list` either. But the key is **visible in the deployed client bundle**
  (it's meant to be, per the README), so it's retrievable from the game's Pages/
  deployed JS if needed.
- **GigaZonk's live key is the literal placeholder** `pick-any-long-random-secret`
  (verified against the live API). Its Pages bundle ships it. Don't assume all
  existing games have real secrets.
- **Windows Turso CLI doesn't exist** — the official `turso-cli` has no Windows
  releases; `npm i -g turso` is the SQLite shell, not the CLI. DB access is via
  `@libsql/client` (already a dep) with creds from Vercel env (masked).
- **Dev-server persistence:** when running the game's dev server from an agent,
  start it detached (`Start-Process cmd /c "npm run dev > dev-server.log 2>&1"`)
  or it dies when the tool call times out.
- **Duplicate DOM ids break rendering silently:** the leaderboard list must have a
  unique id per container (game-over panel vs modal) — `getElementById` returns the
  first match, so a hidden duplicate leaves the visible one stuck on "Loading…".