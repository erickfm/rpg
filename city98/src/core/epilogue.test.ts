import { describe, it, expect } from 'vitest';
import { epilogue } from './epilogue';
import { newGame } from './sim';
import { FRIENDS_THRESHOLD } from './citizens';
import type { GameState } from './types';

const st = (over: Partial<GameState> = {}): GameState => ({ ...newGame(1), ...over });

describe('epilogue', () => {
  it('addresses the player by name and fills a full summary', () => {
    const s = st();
    s.look = { ...s.look, name: 'Rae' };
    const e = epilogue(s);
    expect(e.title).toContain('Rae');
    expect(e.lines.length).toBe(7);
    expect(e.closing.length).toBeGreaterThan(0);
  });

  it('reflects the state — home, day, records, savings', () => {
    const s = st({ day: 16, home: 'loft', savings: 5200, goods: ['rec_neon', 'rec_gravel', 'rec_midnight'] });
    const e = epilogue(s);
    expect(e.lines.some(l => l.includes('16'))).toBe(true);
    expect(e.lines.some(l => l.includes('Skyline Loft'))).toBe(true);
    expect(e.lines.some(l => l.includes('$5,200'))).toBe(true);
    expect(e.lines.some(l => l.includes('Records on the shelf — 3'))).toBe(true);
  });

  it('counts and names the friends you made', () => {
    const lonely = epilogue(st());
    expect(lonely.lines.some(l => l.includes('Friends made — 0'))).toBe(true);

    const s = st({ friends: { gloria: FRIENDS_THRESHOLD, dale: FRIENDS_THRESHOLD } });
    const e = epilogue(s);
    expect(e.lines.some(l => l.includes('Friends made — 2') && l.includes('Gloria') && l.includes('Dale'))).toBe(true);
    expect(e.closing).toContain('People wave');
  });

  it('counts favors repaid out of the total', () => {
    const s = st({ favors: ['rosa', 'gloria'] });
    expect(epilogue(s).lines.some(l => l.includes('Favors repaid — 2 of 8'))).toBe(true);
  });
});
