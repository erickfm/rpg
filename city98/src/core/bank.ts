import type { ActionResult, GameState } from './types';

/**
 * First Federal of the 2D World. Savings earn interest each midnight; rent
 * still comes out of cash on hand, so parking money in savings is a real
 * trade-off between safety-with-growth and having it ready to spend.
 */

export const DAILY_INTEREST = 0.008; // 0.8% a night

export function applyInterest(s: GameState): GameState {
  if (s.savings <= 0) return s;
  const earned = Math.floor(s.savings * DAILY_INTEREST);
  if (earned <= 0) return s;
  return {
    ...s,
    savings: s.savings + earned,
    messages: [...s.messages, `First Federal paid you $${earned} in interest overnight.`],
  };
}

export function deposit(s: GameState, amount: number): ActionResult {
  const amt = Math.min(Math.floor(amount), s.cash);
  if (amt <= 0) return { ok: false, state: s, msg: 'Nothing on hand to deposit.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash - amt, savings: s.savings + amt },
    msg: `Deposited $${amt}. Savings: $${(s.savings + amt).toLocaleString()}.`,
  };
}

export function withdraw(s: GameState, amount: number): ActionResult {
  const amt = Math.min(Math.floor(amount), s.savings);
  if (amt <= 0) return { ok: false, state: s, msg: 'Your savings balance is empty.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash + amt, savings: s.savings - amt },
    msg: `Withdrew $${amt}. Savings: $${(s.savings - amt).toLocaleString()}.`,
  };
}
