// Arcade high-score tables — one top-N list per cabinet. Pure and immutable so
// insertion/qualification are unit-testable; the UI persists and renders them.

export type GameId = 'gutter' | 'snake';
export type HighScores = Record<GameId, ScoreEntry[]>;
export interface ScoreEntry { name: string; score: number; }

export const TOP_N = 5;
export const GAME_NAMES: Record<GameId, string> = {
  gutter: 'Gutter Racer',
  snake: "Dragon's Tail",
};

export function emptyScores(): HighScores {
  return { gutter: [], snake: [] };
}

export function topScores(hs: HighScores, game: GameId): ScoreEntry[] {
  return hs[game] ?? [];
}

/** Would this score make the board? A zero never counts; ties don't bump. */
export function qualifies(hs: HighScores, game: GameId, score: number): boolean {
  if (score <= 0) return false;
  const list = hs[game] ?? [];
  return list.length < TOP_N || score > list[list.length - 1].score;
}

/** Insert a score. Returns the new table and the 1-based rank (0 if it didn't place). */
export function addScore(
  hs: HighScores, game: GameId, name: string, score: number,
): { scores: HighScores; rank: number } {
  if (!qualifies(hs, game, score)) return { scores: hs, rank: 0 };
  const entry: ScoreEntry = { name: name.trim() || 'YOU', score };
  const list = [...(hs[game] ?? []), entry].sort((a, b) => b.score - a.score).slice(0, TOP_N);
  return { scores: { ...hs, [game]: list }, rank: list.indexOf(entry) + 1 };
}
