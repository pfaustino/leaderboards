/** @param {number} newValue @param {number} existingValue @param {'desc' | 'asc'} sort */
export function isBetterScore(newValue, existingValue, sort) {
  if (sort === 'asc') return newValue < existingValue;
  return newValue > existingValue;
}

/** @param {'desc' | 'asc'} sort */
export function sortValueSql(sort) {
  return sort === 'asc' ? 'ASC' : 'DESC';
}

/**
 * Keep one row per player (case-insensitive name), best sort_value per game sort.
 * @param {Array<{ player: string, value: number, meta: object | null, at: number }>} rows
 * @param {'desc' | 'asc'} sort
 */
export function dedupeScoreRows(rows, sort = 'desc') {
  const bestByPlayer = new Map();
  for (const row of rows) {
    const key = String(row.player).trim().toLowerCase();
    const prev = bestByPlayer.get(key);
    if (!prev) {
      bestByPlayer.set(key, row);
      continue;
    }
    if (isBetterScore(row.value, prev.value, sort)) {
      bestByPlayer.set(key, row);
      continue;
    }
    if (row.value === prev.value && row.at < prev.at) {
      bestByPlayer.set(key, row);
    }
  }
  const out = [...bestByPlayer.values()];
  out.sort((a, b) => {
    if (sort === 'asc') return a.value - b.value || a.at - b.at;
    return b.value - a.value || a.at - b.at;
  });
  return out;
}
