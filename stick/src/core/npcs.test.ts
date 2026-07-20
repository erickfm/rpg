import { describe, expect, it } from 'vitest';
import {
  giveBottleToHarold, giveSmokesToPunk, giveToHarold, hotwireCar, punkDeathThreshold,
} from './npcs';
import { fresh } from './test-helpers';
import { itemCount } from './state';

describe('Homeless Harold', () => {
  it('$10 buys karma and charm', () => {
    const r = giveToHarold(fresh({ cash: 20 }));
    expect(r.state.cash).toBe(10);
    expect(r.state.karma).toBe(2);
    expect(giveToHarold(fresh({ cash: 5 })).ok).toBe(false);
  });

  it('accepts bottles', () => {
    const r = giveBottleToHarold(fresh({ inventory: { bottle: 1 } }));
    expect(itemCount(r.state, 'bottle')).toBe(0);
    expect(r.state.karma).toBe(1);
  });
});

describe('Skater Punk', () => {
  it('first pack earns the skateboard', () => {
    const r = giveSmokesToPunk(fresh({ inventory: { smokes: 1 } }));
    expect(r.state.hasSkateboard).toBe(true);
    expect(r.state.punkSmokes).toBe(1);
  });

  it('enough packs kill him: −30 karma and a detective message', () => {
    let s = fresh({ inventory: { smokes: 10 } });
    const threshold = punkDeathThreshold(s);
    expect(threshold).toBeGreaterThanOrEqual(4);
    expect(threshold).toBeLessThanOrEqual(6);
    for (let i = 0; i < threshold; i++) {
      s = giveSmokesToPunk(s).state;
    }
    expect(s.punkDead).toBe(true);
    expect(s.messages.some(m => m.includes('McHolland'))).toBe(true);
    expect(giveSmokesToPunk(s).ok).toBe(false);
  });
});

describe('the yellow car', () => {
  it('hotwires at 350 INT', () => {
    expect(hotwireCar(fresh()).ok).toBe(false);
    const smart = fresh({ stats: { strength: 1, intelligence: 350, charm: 1 } });
    expect(hotwireCar(smart).state.hasCar).toBe(true);
  });
});
