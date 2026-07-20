import { describe, expect, it } from 'vitest';
import {
  AP_CAP, ENEMIES, playerMove, resolveFight, startFight, unlockedMoves,
} from './combat';
import { fresh, seq } from './test-helpers';
import { mulberry32 } from './rng';

describe('move unlocks', () => {
  it('gates moves by strength', () => {
    expect(unlockedMoves(fresh()).map(m => m.id)).toEqual(['punch']);
    const strong = fresh({ stats: { strength: 300, intelligence: 1, charm: 1 } });
    expect(unlockedMoves(strong).map(m => m.id)).toEqual(['punch', 'kick', 'fireball', 'pure']);
  });
});

describe('fights', () => {
  it('weak characters draw drunkards', () => {
    const f = startFight(fresh(), seq(0.1));
    expect(f.enemy.id).toBe('drunkard');
    expect(f.playerHp).toBe(fresh().hp);
  });

  it('AP spends and refreshes with a cap', () => {
    const s = fresh({ stats: { strength: 50, intelligence: 1, charm: 1 }, hp: 70 });
    let f = startFight(s, seq(0.1));
    expect(f.ap).toBe(2);
    const t = playerMove(s, f, 'kick', seq(0.5, 0.5, 0.5));
    if (!t.fight.done) expect(t.fight.ap).toBe(2); // 2 − 2 + 2
    const t2 = playerMove(s, t.fight, 'punch', seq(0.5, 0.5, 0.5));
    if (!t2.fight.done) expect(t2.fight.ap).toBeLessThanOrEqual(AP_CAP);
  });

  it('rejects unaffordable moves without consuming the turn', () => {
    const s = fresh({ stats: { strength: 300, intelligence: 1, charm: 1 } });
    const f = startFight(s, seq(0.1));
    const t = playerMove(s, f, 'pure', seq(0.5));
    expect(t.fight).toEqual(f);
    expect(t.events[0]).toContain('Not enough AP');
  });

  it('a full fight ends in victory or death, and resolves correctly', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      const s = fresh({ stats: { strength: 40, intelligence: 1, charm: 1 }, hp: 60, cash: 0 });
      let f = startFight(s, rng);
      let guard = 0;
      while (!f.done && guard++ < 100) {
        f = playerMove(s, f, f.ap >= 2 && s.stats.strength >= 30 ? 'kick' : 'punch', rng).fight;
      }
      expect(f.done).toBe(true);
      const r = resolveFight(s, f, rng);
      if (f.won) {
        expect(r.state.cash).toBeGreaterThanOrEqual(f.enemy.walletMin);
        expect(r.state.cash).toBeLessThanOrEqual(f.enemy.walletMax);
        expect(r.state.stats.strength).toBe(40 + f.enemy.strReward);
        expect(r.state.karma).toBe(s.karma - 2);
        expect(r.state.dead).toBe(false);
      } else {
        expect(r.state.dead).toBe(true);
      }
    }
  });

  it('enemy tiers escalate', () => {
    expect(ENEMIES.map(e => e.hp)).toEqual([15, 45, 100, 220]);
  });
});
