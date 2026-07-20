import { describe, expect, it } from 'vitest';
import { CHEAT_NAME, newGame } from './newgame';
import { maxHp } from './state';
import { mulberry32 } from './rng';

describe('newGame', () => {
  it('rolls 1d6 stats and derives HP from strength', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame('Oliver', 40, mulberry32(seed));
      for (const v of Object.values(s.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
      expect(s.hp).toBe(20 + s.stats.strength);
      expect(s.hp).toBe(maxHp(s));
      expect(s.cash).toBe(100);
      expect(s.day).toBe(1);
      expect(s.minute).toBe(8 * 60);
    }
  });

  it('honors the HEYZEUS!!!! cheat', () => {
    const s = newGame(CHEAT_NAME, null, mulberry32(1));
    expect(s.stats).toEqual({ strength: 999, intelligence: 999, charm: 999 });
    expect(s.cash).toBe(10_000);
    expect(s.dayLimit).toBeNull();
  });

  it('stores the chosen day limit', () => {
    expect(newGame('A', 15, mulberry32(1)).dayLimit).toBe(15);
    expect(newGame('A', null, mulberry32(1)).dayLimit).toBeNull();
  });
});
