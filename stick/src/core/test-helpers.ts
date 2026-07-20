import type { GameState } from './types';
import { mulberry32, type Rng } from './rng';
import { newGame } from './newgame';

/** Deterministic fresh character for tests. */
export function fresh(patch: Partial<GameState> = {}): GameState {
  const s = newGame('Testy', 40, mulberry32(7));
  return { ...s, ...patch };
}

/** Rng stub that plays back a fixed sequence (repeats the last value). */
export function seq(...vals: number[]): Rng {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
}
