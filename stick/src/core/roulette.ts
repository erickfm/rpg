import type { ActionResult, GameState } from './types';
import type { Rng } from './rng';
import { passTime } from './time';

export const ROULETTE_CHIPS = [5, 25, 100];

export type RouletteBet =
  | { kind: 'straight'; n: number; amount: number }
  | { kind: 'red' | 'black' | 'odd' | 'even'; amount: number };

/** European wheel red numbers. */
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function numberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

export function spinWheel(rng: Rng): number {
  return Math.floor(rng() * 37); // 0..36
}

/** Total returned to the player (stake included) for a landed number. */
export function settle(bets: RouletteBet[], n: number): number {
  let total = 0;
  for (const bet of bets) {
    switch (bet.kind) {
      case 'straight':
        if (bet.n === n) total += bet.amount * 36; // 35:1 plus stake
        break;
      case 'red':
      case 'black':
        if (numberColor(n) === bet.kind) total += bet.amount * 2;
        break;
      case 'odd':
        if (n !== 0 && n % 2 === 1) total += bet.amount * 2;
        break;
      case 'even':
        if (n !== 0 && n % 2 === 0) total += bet.amount * 2;
        break;
    }
  }
  return total;
}

export interface RouletteResult {
  res: ActionResult;
  n: number;
  winnings: number;
}

export function playRoulette(s: GameState, bets: RouletteBet[], rng: Rng): RouletteResult {
  const staked = bets.reduce((sum, b) => sum + b.amount, 0);
  if (bets.length === 0 || staked <= 0 || s.cash < staked) {
    return {
      res: { ok: false, state: s, msg: 'Place your bets first.' },
      n: -1,
      winnings: 0,
    };
  }
  const n = spinWheel(rng);
  const winnings = settle(bets, n);
  let next: GameState = { ...s, cash: s.cash - staked + winnings };
  next = passTime(next, 15);
  const color = numberColor(n);
  const label = `${n} ${color}`;
  const net = winnings - staked;
  const msg =
    net > 0
      ? `${label} — you're up $${net}!`
      : net === 0
        ? `${label} — break-even.`
        : `${label} — the house takes $${-net}.`;
  return { res: { ok: true, state: next, msg }, n, winnings };
}
