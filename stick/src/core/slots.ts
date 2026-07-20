import type { ActionResult, GameState } from './types';
import type { Rng } from './rng';
import { passTime } from './time';

export const SLOT_BETS = [5, 25, 100];

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7'] as const;
const WEIGHTS = [5, 4, 3, 2, 1];
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);

export type SlotSymbol = (typeof SYMBOLS)[number];

const TRIPLE_PAYOUT: Record<SlotSymbol, number> = {
  '7': 60,
  '⭐': 20,
  '🔔': 10,
  '🍋': 6,
  '🍒': 4,
};

function pick(rng: Rng): SlotSymbol {
  let r = rng() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r < 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

export function payoutFor(reels: SlotSymbol[], bet: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return bet * TRIPLE_PAYOUT[a];
  if (a === b || b === c || a === c) return bet; // any pair: stake back
  return 0;
}

export interface SlotsResult {
  res: ActionResult;
  reels: SlotSymbol[];
  payout: number;
}

export function playSlots(s: GameState, bet: number, rng: Rng): SlotsResult {
  if (!SLOT_BETS.includes(bet) || s.cash < bet) {
    return {
      res: { ok: false, state: s, msg: 'You can’t cover that bet.' },
      reels: [],
      payout: 0,
    };
  }
  const reels = [pick(rng), pick(rng), pick(rng)];
  const payout = payoutFor(reels, bet);
  let next: GameState = { ...s, cash: s.cash - bet + payout };
  next = passTime(next, 10);
  const face = reels.join(' ');
  const msg =
    payout > bet
      ? `${face} — pays $${payout}!`
      : payout === bet
        ? `${face} — push, stake returned.`
        : `${face} — the machine thanks you.`;
  return { res: { ok: true, state: next, msg }, reels, payout };
}
