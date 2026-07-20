import type { ActionResult, GameState } from './types';
import { addKarma, addStat } from './state';
import { passTime } from './time';

export const BEER_COST = 10;

/** Straight from the wiki: beer is +2 charm and bad karma. */
export function drinkBeer(s: GameState): ActionResult {
  if (s.cash < BEER_COST) return { ok: false, state: s, msg: `A mug is $${BEER_COST}.` };
  let next: GameState = { ...s, cash: s.cash - BEER_COST };
  next = addStat(next, 'charm', 2);
  next = addKarma(next, -1);
  next = passTime(next, 30);
  return { ok: true, state: next, msg: 'Liquid confidence. +2 Charm.' };
}

export interface DartsResult {
  res: ActionResult;
  ring: 'bullseye' | 'inner' | 'outer' | 'miss';
  winnings: number; // total returned, stake included
}

/**
 * Drunken darts: the UI supplies `aim` in 0..1 from a timing bar.
 * Bullseye pays 3×, inner ring 2×, outer ring returns the stake.
 */
export function throwDarts(s: GameState, bet: number, aim: number): DartsResult {
  if (bet < 1 || s.cash < bet) {
    return {
      res: { ok: false, state: s, msg: 'Cover your bet first.' },
      ring: 'miss',
      winnings: 0,
    };
  }
  let ring: DartsResult['ring'];
  let mult: number;
  if (aim >= 0.93) {
    ring = 'bullseye';
    mult = 3;
  } else if (aim >= 0.75) {
    ring = 'inner';
    mult = 2;
  } else if (aim >= 0.5) {
    ring = 'outer';
    mult = 1;
  } else {
    ring = 'miss';
    mult = 0;
  }
  const winnings = bet * mult;
  let next: GameState = { ...s, cash: s.cash - bet + winnings };
  next = passTime(next, 20);
  const msgs: Record<DartsResult['ring'], string> = {
    bullseye: `BULLSEYE! The bar goes quiet. +$${winnings - bet}.`,
    inner: `Inner ring — not bad for a drunk. +$${winnings - bet}.`,
    outer: 'Outer ring. Your money comes back, your dignity doesn’t.',
    miss: `You hit the wall. −$${bet}.`,
  };
  return { res: { ok: true, state: next, msg: msgs[ring] }, ring, winnings };
}
