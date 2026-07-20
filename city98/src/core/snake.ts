import type { Rng } from './rng';

/**
 * "Dragon's Tail" — a grid Snake, the game every 1998 device shipped with.
 * Pure and deterministic given an rng: stepping, growth, and death are all
 * unit-testable; the UI only renders state and feeds turns. Food eaten = score.
 */

export const GRID_W = 16;
export const GRID_H = 16;

export interface Cell { x: number; y: number; }
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface SnakeState {
  body: Cell[]; // head first
  dir: Dir; // last committed heading
  pending: Dir; // buffered turn, applied on the next step
  food: Cell;
  alive: boolean;
  score: number; // food eaten
  grow: number; // segments still to add
}

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** A random free cell for food — never on the snake. */
export function spawnFood(body: Cell[], rng: Rng): Cell {
  const taken = new Set(body.map(c => c.y * GRID_W + c.x));
  const free: number[] = [];
  for (let i = 0; i < GRID_W * GRID_H; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return body[0]; // board full (a win) — harmless fallback
  const idx = free[Math.floor(rng() * free.length)];
  return { x: idx % GRID_W, y: Math.floor(idx / GRID_W) };
}

export function newSnake(rng: Rng): SnakeState {
  const body: Cell[] = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }]; // heading right
  return { body, dir: 'right', pending: 'right', food: spawnFood(body, rng), alive: true, score: 0, grow: 0 };
}

/** Buffer a turn. A direct reversal onto your own neck is ignored. */
export function turnSnake(s: SnakeState, dir: Dir): SnakeState {
  if (dir === OPP[s.dir]) return s;
  return { ...s, pending: dir };
}

/** Advance one grid step. */
export function stepSnake(s: SnakeState, rng: Rng): SnakeState {
  if (!s.alive) return s;
  const dir = s.pending;
  const d = DELTA[dir];
  const head = { x: s.body[0].x + d.x, y: s.body[0].y + d.y };

  if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) {
    return { ...s, dir, alive: false };
  }
  const eat = head.x === s.food.x && head.y === s.food.y;
  // if the tail is about to vacate (not eating, not growing), it's fair game to enter
  const solid = eat || s.grow > 0 ? s.body : s.body.slice(0, s.body.length - 1);
  if (solid.some(c => c.x === head.x && c.y === head.y)) {
    return { ...s, dir, alive: false };
  }

  let body = [head, ...s.body];
  let grow = s.grow;
  let score = s.score;
  let food = s.food;
  if (eat) { grow += 1; score += 1; }
  if (grow > 0) grow -= 1;
  else body = body.slice(0, body.length - 1);
  if (eat) food = spawnFood(body, rng);

  return { body, dir, pending: dir, food, alive: true, score, grow };
}

/** Cash for a run: fun money, capped like the racer. */
export function snakePayout(score: number): number {
  return Math.min(60, score * 4);
}
