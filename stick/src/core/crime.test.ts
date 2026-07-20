import { describe, expect, it } from 'vitest';
import { robBank, robStore } from './crime';
import { fresh, seq } from './test-helpers';
import { itemCount } from './state';

const armed = (patch = {}) =>
  fresh({ inventory: { gun: 1, ammo: 5 }, minute: 12 * 60, ...patch });

describe('robStore', () => {
  it('needs gun, ammo, and the mid-day window', () => {
    expect(robStore(fresh({ minute: 12 * 60 }), seq(0)).ok).toBe(false);
    expect(robStore(armed({ minute: 18 * 60 }), seq(0)).ok).toBe(false);
  });

  it('success pays $100–400 and burns karma and a round', () => {
    const r = robStore(armed({ cash: 0 }), seq(0.1, 0.5));
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBeGreaterThanOrEqual(100);
    expect(r.state.cash).toBeLessThanOrEqual(400);
    expect(r.state.karma).toBe(-10);
    expect(itemCount(r.state, 'ammo')).toBe(4);
  });

  it('failure costs two days and the hardware', () => {
    const r = robStore(armed(), seq(0.9));
    expect(r.state.day).toBe(3);
    expect(itemCount(r.state, 'gun')).toBe(0);
  });
});

describe('robBank', () => {
  it('the three outcomes: score, prison, shot', () => {
    const win = robBank(armed({ cash: 0 }), seq(0.1, 0.5));
    expect(win.state.cash).toBeGreaterThanOrEqual(2000);
    expect(win.state.karma).toBe(-25);

    const jail = robBank(armed({ cash: 1000 }), seq(0.5));
    expect(jail.state.day).toBe(6);
    expect(jail.state.cash).toBe(500); // $500 fine
    expect(itemCount(jail.state, 'gun')).toBe(0);

    const beefy = { strength: 100, intelligence: 1, charm: 1 };
    const shot = robBank(armed({ hp: 100, stats: beefy }), seq(0.9));
    expect(shot.state.hp).toBe(40);
    expect(shot.state.dead).toBe(false);

    const fatal = robBank(armed({ hp: 50, stats: beefy }), seq(0.9));
    expect(fatal.state.dead).toBe(true);
  });
});
