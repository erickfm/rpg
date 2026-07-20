import { describe, expect, it } from 'vitest';
import { deal, handValue, hit, newDeck, stand, type BjState } from './blackjack';
import { mulberry32 } from './rng';

const C = (rank: number) => ({ rank, suit: 0 });

describe('handValue', () => {
  it('counts one ace as 11 when safe', () => {
    expect(handValue([C(1), C(13)])).toBe(21);
    expect(handValue([C(1), C(1), C(9)])).toBe(21);
    expect(handValue([C(1), C(9), C(9)])).toBe(19);
    expect(handValue([C(13), C(12), C(2)])).toBe(22);
  });
});

describe('deck', () => {
  it('has 52 unique cards', () => {
    const deck = newDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck.map(c => `${c.rank}-${c.suit}`)).size).toBe(52);
  });
});

describe('deal / play invariants', () => {
  it('deals 2 cards each from a 52-card deck', () => {
    const s = deal(mulberry32(42), 10);
    expect(s.player.length).toBe(2);
    expect(s.dealer.length).toBe(2);
    expect(s.deck.length).toBe(48);
  });

  it('always-stand policy: dealer finishes at 17+ and payouts are legal', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = deal(mulberry32(seed), 10);
      if (s.phase === 'player') s = stand(s);
      expect(s.phase).toBe('done');
      expect(s.result).not.toBeNull();
      if (s.result === 'win' || s.result === 'push' || s.result === 'lose') {
        expect(handValue(s.dealer)).toBeGreaterThanOrEqual(17);
      }
      expect([0, 10, 20, 25]).toContain(s.payout);
    }
  });

  it('always-hit policy: busting zeroes the payout', () => {
    for (let seed = 1; seed <= 50; seed++) {
      let s = deal(mulberry32(seed), 10);
      let guard = 0;
      while (s.phase === 'player' && guard++ < 20) s = hit(s);
      expect(s.phase).toBe('done');
      if (handValue(s.player) > 21) {
        expect(s.result).toBe('bust');
        expect(s.payout).toBe(0);
      }
    }
  });

  it('a natural pays 3:2', () => {
    let found: BjState | null = null;
    for (let seed = 1; seed <= 2000 && !found; seed++) {
      const s = deal(mulberry32(seed), 10);
      if (s.result === 'blackjack') found = s;
    }
    expect(found).not.toBeNull();
    expect(found!.payout).toBe(25); // 10 back + 15 winnings
  });
});
