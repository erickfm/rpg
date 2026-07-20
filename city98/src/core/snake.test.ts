import { describe, it, expect } from 'vitest';
import {
  newSnake, stepSnake, turnSnake, spawnFood, snakePayout, GRID_W, GRID_H,
  type SnakeState, type Cell,
} from './snake';
import { mulberry32 } from './rng';

const onBody = (body: Cell[], c: Cell) => body.some(b => b.x === c.x && b.y === c.y);

describe('newSnake', () => {
  it('starts a 3-long snake heading right with food off its body', () => {
    const s = newSnake(mulberry32(1));
    expect(s.body).toHaveLength(3);
    expect(s.dir).toBe('right');
    expect(s.alive).toBe(true);
    expect(onBody(s.body, s.food)).toBe(false);
  });
});

describe('stepSnake movement', () => {
  it('advances the head and drops the tail (length unchanged)', () => {
    const s = newSnake(mulberry32(5));
    const n = stepSnake(s, mulberry32(5));
    expect(n.body[0]).toEqual({ x: 9, y: 8 });
    expect(n.body).toHaveLength(3);
  });

  it('dies against a wall', () => {
    let s: SnakeState = { body: [{ x: 15, y: 8 }, { x: 14, y: 8 }, { x: 13, y: 8 }], dir: 'right', pending: 'right', food: { x: 0, y: 0 }, alive: true, score: 0, grow: 0 };
    s = stepSnake(s, mulberry32(1));
    expect(s.alive).toBe(false);
  });

  it('grows and scores when it eats, with fresh food off the body', () => {
    const rng = mulberry32(9);
    let s = newSnake(rng);
    // put food right in front of the head
    s = { ...s, food: { x: 9, y: 8 } };
    const n = stepSnake(s, mulberry32(3));
    expect(n.score).toBe(1);
    expect(n.body).toHaveLength(4); // grew by one
    expect(onBody(n.body, n.food)).toBe(false);
  });

  it('dies running into its own body', () => {
    // a hook shape; turning down drives the head into a non-tail segment
    const body: Cell[] = [
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 },
    ];
    const s: SnakeState = { body, dir: 'left', pending: 'down', food: { x: 0, y: 0 }, alive: true, score: 0, grow: 0 };
    const n = stepSnake(s, mulberry32(1));
    expect(n.alive).toBe(false);
  });

  it('lets the head follow into the vacating tail cell', () => {
    const body: Cell[] = [
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 },
    ];
    // moving into (5,6) which is the tail — legal, the tail moves away
    const s: SnakeState = { body, dir: 'left', pending: 'down', food: { x: 0, y: 0 }, alive: true, score: 0, grow: 0 };
    const n = stepSnake(s, mulberry32(1));
    expect(n.alive).toBe(true);
  });
});

describe('turnSnake', () => {
  it('ignores a direct reversal', () => {
    const s = newSnake(mulberry32(2)); // heading right
    expect(turnSnake(s, 'left').pending).toBe('right');
    expect(turnSnake(s, 'up').pending).toBe('up');
  });
});

describe('spawnFood + payout', () => {
  it('is deterministic for a seed and never lands on the snake', () => {
    const body: Cell[] = [{ x: 8, y: 8 }, { x: 7, y: 8 }];
    const a = spawnFood(body, mulberry32(42));
    const b = spawnFood(body, mulberry32(42));
    expect(a).toEqual(b);
    expect(onBody(body, a)).toBe(false);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThan(GRID_W);
    expect(a.y).toBeLessThan(GRID_H);
  });

  it('pays 4 per food, capped at 60', () => {
    expect(snakePayout(0)).toBe(0);
    expect(snakePayout(5)).toBe(20);
    expect(snakePayout(100)).toBe(60);
  });
});
