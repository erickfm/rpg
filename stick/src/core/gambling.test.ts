import { describe, expect, it } from 'vitest';
import { payoutFor, playSlots, SLOT_BETS } from './slots';
import { numberColor, playRoulette, settle } from './roulette';
import { throwDarts } from './bar';
import { fresh, seq } from './test-helpers';
import { mulberry32 } from './rng';

describe('slots', () => {
  it('pays the paytable', () => {
    expect(payoutFor(['7', '7', '7'], 10)).toBe(600);
    expect(payoutFor(['⭐', '⭐', '⭐'], 10)).toBe(200);
    expect(payoutFor(['🍒', '🍒', '🍒'], 10)).toBe(40);
    expect(payoutFor(['🍒', '🍒', '🍋'], 10)).toBe(10); // pair: stake back
    expect(payoutFor(['🍒', '🍋', '🔔'], 10)).toBe(0);
  });

  it('only takes listed bets the player can cover', () => {
    expect(playSlots(fresh({ cash: 3 }), 5, mulberry32(1)).res.ok).toBe(false);
    expect(playSlots(fresh(), 7 as never, mulberry32(1)).res.ok).toBe(false);
    expect(SLOT_BETS).toEqual([5, 25, 100]);
  });

  it('house edge exists but stays reasonable over many spins', () => {
    const rng = mulberry32(9);
    let net = 0;
    for (let i = 0; i < 3000; i++) {
      const r = playSlots(fresh({ cash: 100 }), 5, rng);
      net += r.payout - 5;
    }
    const rtp = 1 + net / (3000 * 5);
    expect(rtp).toBeGreaterThan(0.8);
    expect(rtp).toBeLessThan(1.02);
  });
});

describe('roulette', () => {
  it('classifies colors like a real wheel', () => {
    expect(numberColor(0)).toBe('green');
    expect(numberColor(1)).toBe('red');
    expect(numberColor(2)).toBe('black');
    expect(numberColor(32)).toBe('red');
  });

  it('settles straights at 35:1 and evens at 1:1', () => {
    expect(settle([{ kind: 'straight', n: 17, amount: 10 }], 17)).toBe(360);
    expect(settle([{ kind: 'straight', n: 17, amount: 10 }], 18)).toBe(0);
    expect(settle([{ kind: 'red', amount: 10 }], 1)).toBe(20);
    expect(settle([{ kind: 'odd', amount: 10 }], 0)).toBe(0); // zero beats the outside
    expect(
      settle(
        [
          { kind: 'red', amount: 10 },
          { kind: 'even', amount: 5 },
        ],
        12 // red and even
      )
    ).toBe(30);
  });

  it('rejects empty or uncovered bets', () => {
    expect(playRoulette(fresh(), [], mulberry32(1)).res.ok).toBe(false);
    expect(
      playRoulette(fresh({ cash: 5 }), [{ kind: 'red', amount: 100 }], mulberry32(1)).res.ok
    ).toBe(false);
  });
});

describe('darts', () => {
  it('rings pay 3x / 2x / push / lose', () => {
    expect(throwDarts(fresh({ cash: 100 }), 20, 0.99).res.state.cash).toBe(140);
    expect(throwDarts(fresh({ cash: 100 }), 20, 0.8).res.state.cash).toBe(120);
    expect(throwDarts(fresh({ cash: 100 }), 20, 0.6).res.state.cash).toBe(100);
    expect(throwDarts(fresh({ cash: 100 }), 20, 0.1).res.state.cash).toBe(80);
    expect(throwDarts(fresh({ cash: 10 }), 20, 0.9).res.ok).toBe(false);
  });
});
