import { describe, it, expect } from 'vitest';
import { emptyScores, topScores, qualifies, addScore, TOP_N } from './highscores';

describe('qualifies', () => {
  it('rejects zero/negative and accepts onto an empty board', () => {
    const hs = emptyScores();
    expect(qualifies(hs, 'snake', 0)).toBe(false);
    expect(qualifies(hs, 'snake', -3)).toBe(false);
    expect(qualifies(hs, 'snake', 1)).toBe(true);
  });

  it('needs to beat the lowest once the board is full; ties do not count', () => {
    let hs = emptyScores();
    for (const s of [50, 40, 30, 20, 10]) hs = addScore(hs, 'gutter', 'A', s).scores;
    expect(qualifies(hs, 'gutter', 10)).toBe(false); // tie with the lowest
    expect(qualifies(hs, 'gutter', 11)).toBe(true);
    expect(qualifies(hs, 'gutter', 5)).toBe(false);
  });
});

describe('addScore', () => {
  it('sorts descending, caps at TOP_N, and reports rank', () => {
    let hs = emptyScores();
    hs = addScore(hs, 'snake', 'A', 10).scores;
    hs = addScore(hs, 'snake', 'B', 30).scores;
    const r = addScore(hs, 'snake', 'C', 20);
    hs = r.scores;
    expect(topScores(hs, 'snake').map(e => e.score)).toEqual([30, 20, 10]);
    expect(r.rank).toBe(2); // 20 slots between 30 and 10
  });

  it('drops the entry (and returns rank 0) when it does not place', () => {
    let hs = emptyScores();
    for (const s of [50, 40, 30, 20, 10]) hs = addScore(hs, 'gutter', 'A', s).scores;
    const r = addScore(hs, 'gutter', 'Z', 5);
    expect(r.rank).toBe(0);
    expect(topScores(r.scores, 'gutter')).toHaveLength(TOP_N);
    expect(topScores(r.scores, 'gutter').some(e => e.name === 'Z')).toBe(false);
  });

  it('keeps only the top N and drops the weakest', () => {
    let hs = emptyScores();
    for (const s of [50, 40, 30, 20, 10]) hs = addScore(hs, 'snake', 'A', s).scores;
    hs = addScore(hs, 'snake', 'NEW', 35).scores;
    const scores = topScores(hs, 'snake').map(e => e.score);
    expect(scores).toEqual([50, 40, 35, 30, 20]);
  });

  it('falls back to a default name and does not mutate the input', () => {
    const hs = emptyScores();
    const r = addScore(hs, 'snake', '   ', 12);
    expect(topScores(r.scores, 'snake')[0].name).toBe('YOU');
    expect(topScores(hs, 'snake')).toHaveLength(0); // original untouched
  });
});
