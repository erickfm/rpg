import type { Rng } from './rng';

export interface Card {
  rank: number; // 1 (ace) .. 13 (king)
  suit: number; // 0..3
}

export type BjResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface BjState {
  deck: Card[];
  player: Card[];
  dealer: Card[];
  bet: number;
  phase: 'player' | 'done';
  result: BjResult | null;
  payout: number; // total returned to the player, stake included
}

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }
  return deck;
}

export function shuffle(deck: Card[], rng: Rng): Card[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** Best hand total: one ace counts as 11 when that doesn't bust. */
export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 1) {
      aces++;
      total += 1;
    } else {
      total += Math.min(c.rank, 10);
    }
  }
  if (aces > 0 && total + 10 <= 21) total += 10;
  return total;
}

const isNatural = (hand: Card[]) => hand.length === 2 && handValue(hand) === 21;

export function deal(rng: Rng, bet: number): BjState {
  const deck = shuffle(newDeck(), rng);
  const draw = () => deck.pop() as Card;
  const player = [draw(), draw()];
  const dealer = [draw(), draw()];
  const base: BjState = { deck, player, dealer, bet, phase: 'player', result: null, payout: 0 };
  if (isNatural(player)) {
    if (isNatural(dealer)) return { ...base, phase: 'done', result: 'push', payout: bet };
    return { ...base, phase: 'done', result: 'blackjack', payout: bet + Math.floor(bet * 1.5) };
  }
  if (isNatural(dealer)) return { ...base, phase: 'done', result: 'lose', payout: 0 };
  return base;
}

export function hit(s: BjState): BjState {
  if (s.phase !== 'player') return s;
  const deck = s.deck.slice();
  const player = [...s.player, deck.pop() as Card];
  const next: BjState = { ...s, deck, player };
  const value = handValue(player);
  if (value > 21) return { ...next, phase: 'done', result: 'bust', payout: 0 };
  if (value === 21) return stand(next);
  return next;
}

export function stand(s: BjState): BjState {
  if (s.phase !== 'player') return s;
  const deck = s.deck.slice();
  const dealer = s.dealer.slice();
  while (handValue(dealer) < 17) dealer.push(deck.pop() as Card);
  const dv = handValue(dealer);
  const pv = handValue(s.player);
  let result: BjResult;
  let payout: number;
  if (dv > 21 || pv > dv) {
    result = 'win';
    payout = s.bet * 2;
  } else if (pv === dv) {
    result = 'push';
    payout = s.bet;
  } else {
    result = 'lose';
    payout = 0;
  }
  return { ...s, deck, dealer, phase: 'done', result, payout };
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardLabel(c: Card): string {
  return `${RANKS[c.rank - 1]}${SUITS[c.suit]}`;
}

export function handLabel(hand: Card[], hideHole = false): string {
  return hand.map((c, i) => (hideHole && i === 0 ? '??' : cardLabel(c))).join(' ');
}
