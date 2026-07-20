import type { ActionResult, GameState, HomeTier } from './types';

export const LOAN_LIMIT = 1000;
export const PROPERTY_PRICES: Record<Exclude<HomeTier, 'apartment'>, number> = {
  bigger: 25_000,
  castle: 500_000,
};

export function deposit(s: GameState, amount: number): ActionResult {
  const amt = Math.min(Math.floor(amount), s.cash);
  if (amt <= 0) return { ok: false, state: s, msg: 'Nothing to deposit.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash - amt, bank: s.bank + amt },
    msg: `Deposited $${amt}.`,
  };
}

export function withdraw(s: GameState, amount: number): ActionResult {
  const amt = Math.min(Math.floor(amount), s.bank);
  if (amt <= 0) return { ok: false, state: s, msg: 'Nothing to withdraw.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash + amt, bank: s.bank - amt },
    msg: `Withdrew $${amt}.`,
  };
}

/** Original feature: the bank fronts you up to $1000, at ruinous daily interest. */
export function takeLoan(s: GameState, amount: number): ActionResult {
  const amt = Math.floor(amount);
  if (amt <= 0) return { ok: false, state: s, msg: 'How much?' };
  if (s.loan + amt > LOAN_LIMIT) {
    return { ok: false, state: s, msg: `The bank will only float you $${LOAN_LIMIT - s.loan} more.` };
  }
  return {
    ok: true,
    state: { ...s, cash: s.cash + amt, loan: s.loan + amt },
    msg: `Loan approved: $${amt}. It grows 2% a day — sleep tight.`,
  };
}

export function repayLoan(s: GameState, amount: number): ActionResult {
  const amt = Math.min(Math.floor(amount), s.loan, s.cash);
  if (amt <= 0) return { ok: false, state: s, msg: 'Nothing to repay with.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash - amt, loan: s.loan - amt },
    msg: s.loan - amt === 0 ? 'Debt cleared. The teller looks disappointed.' : `Repaid $${amt}.`,
  };
}

export function buyProperty(s: GameState, tier: 'bigger' | 'castle'): ActionResult {
  const price = PROPERTY_PRICES[tier];
  if (tier === 'bigger' && s.home !== 'apartment') {
    return { ok: false, state: s, msg: 'You’ve already moved past that.' };
  }
  if (tier === 'castle' && s.home === 'castle') {
    return { ok: false, state: s, msg: 'You already own the castle.' };
  }
  if (s.cash < price) return { ok: false, state: s, msg: `That costs $${price.toLocaleString()}.` };
  const next: GameState = { ...s, cash: s.cash - price, home: tier };
  return {
    ok: true,
    state: next,
    msg:
      tier === 'castle'
        ? 'SOLD. You now live in an actual castle.'
        : 'You sign for the Bigger Apartment. More wall for your money.',
  };
}
