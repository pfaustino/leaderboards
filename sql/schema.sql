CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sort_value REAL NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_game_value ON scores (game_id, sort_value DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_game_created ON scores (game_id, created_at DESC);
