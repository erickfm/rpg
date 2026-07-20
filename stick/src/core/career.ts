import type { ActionResult, GameState } from './types';
import { addKarma } from './state';
import { passTime } from './time';

export interface Rank {
  title: string;
  wage: number; // per hour
  intReq: number; // intelligence gate
  shiftsToPromote: number; // shifts at this rank before the next opens
  boss: string;
}

/**
 * The New Lines Inc. ladder — wages from the original; guides put entry at
 * 20 INT and the CEO's chair at 250 INT, so the gates ramp between those.
 */
export const NEWLINES_RANKS: Rank[] = [
  { title: 'Janitor',         wage: 8,   intReq: 20,  shiftsToPromote: 3, boss: 'Bob' },
  { title: 'Mail Room Clerk', wage: 10,  intReq: 45,  shiftsToPromote: 4, boss: 'Gary' },
  { title: 'Salesperson',     wage: 15,  intReq: 85,  shiftsToPromote: 5, boss: 'Frank' },
  { title: 'Executive',       wage: 25,  intReq: 140, shiftsToPromote: 6, boss: 'Sue' },
  { title: 'Vice President',  wage: 50,  intReq: 195, shiftsToPromote: 8, boss: 'Stuart' },
  { title: 'CEO',             wage: 100, intReq: 250, shiftsToPromote: Infinity, boss: 'the Board' },
];

export const SHIFT_HOURS = 6;
export const MCSTICKS_WAGE = 6;

export function isCeo(s: GameState): boolean {
  return s.jobRank === NEWLINES_RANKS.length - 1;
}

export function applyAtNewLines(s: GameState): ActionResult {
  if (s.jobRank >= 0) return { ok: false, state: s, msg: 'You already work here.' };
  if (s.stats.intelligence < NEWLINES_RANKS[0].intReq) {
    return {
      ok: false,
      state: s,
      msg: `HR looks at your resume, then at you. "Come back with ${NEWLINES_RANKS[0].intReq} intelligence."`,
    };
  }
  return {
    ok: true,
    state: { ...s, jobRank: 0, shiftsAtRank: 0 },
    msg: 'You’re hired! Bob hands you a mop. Welcome to New Lines Inc., Janitor.',
  };
}

/** A 6-hour New Lines shift; promotions check INT + shifts served. */
export function workNewLines(s: GameState): ActionResult {
  if (s.jobRank < 0) return { ok: false, state: s, msg: 'You don’t work here — apply first.' };
  const rank = NEWLINES_RANKS[s.jobRank];
  const earned = rank.wage * SHIFT_HOURS;
  let next: GameState = {
    ...s,
    cash: s.cash + earned,
    shiftsAtRank: s.shiftsAtRank + 1,
  };
  next = addKarma(next, 1); // honest work is good for the soul
  next = passTime(next, SHIFT_HOURS * 60);
  let msg = `Six hours of honest ${rank.title.toLowerCase()} work. +$${earned}.`;
  const promo = NEWLINES_RANKS[next.jobRank + 1];
  if (
    promo &&
    next.shiftsAtRank >= rank.shiftsToPromote &&
    next.stats.intelligence >= promo.intReq
  ) {
    next = { ...next, jobRank: next.jobRank + 1, shiftsAtRank: 0 };
    msg = `${rank.boss} pulls you aside — you’ve been promoted to ${promo.title}! ($${promo.wage}/h)`;
  }
  return { ok: true, state: next, msg };
}

/** McSticks Cook: no requirements, $6/h, always hiring. */
export function workMcSticks(s: GameState): ActionResult {
  const earned = MCSTICKS_WAGE * SHIFT_HOURS;
  let next: GameState = { ...s, cash: s.cash + earned };
  next = addKarma(next, 1);
  next = passTime(next, SHIFT_HOURS * 60);
  return {
    ok: true,
    state: next,
    msg: `You flip burgers until your soul smells like grease. +$${earned}.`,
  };
}
