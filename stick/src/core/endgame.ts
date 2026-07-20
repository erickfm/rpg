import type { ActionResult, GameState } from './types';
import { isCeo } from './career';

export const TITLE_STAT_REQ = 800;
export const PRESIDENT_CASH = 200_000;
export const DICTATOR_CASH = 500_000;

function baseRequirementsMet(s: GameState): boolean {
  return (
    s.stats.strength >= TITLE_STAT_REQ &&
    s.stats.intelligence >= TITLE_STAT_REQ &&
    s.stats.charm >= TITLE_STAT_REQ &&
    s.home === 'castle' &&
    isCeo(s)
  );
}

export function presidentAvailable(s: GameState): boolean {
  return baseRequirementsMet(s) && s.karma >= 1 && s.cash >= PRESIDENT_CASH;
}

export function dictatorAvailable(s: GameState): boolean {
  return baseRequirementsMet(s) && s.karma <= -1 && s.cash >= DICTATOR_CASH;
}

/** Call after each sleep: leaves the campaign phone message once. */
export function checkTitleOffer(s: GameState): GameState {
  if (s.titleOffered || s.title !== 'none') return s;
  if (!presidentAvailable(s) && !dictatorAvailable(s)) return s;
  return {
    ...s,
    titleOffered: true,
    messages: [
      ...s.messages,
      'Campaign HQ: "The 2D World has noticed you. Come by your castle war room — it’s time to run for the top job."',
    ],
  };
}

export function runForOffice(s: GameState, office: 'president' | 'dictator'): ActionResult {
  if (office === 'president') {
    if (!presidentAvailable(s)) return { ok: false, state: s, msg: 'The people aren’t ready. Neither, honestly, are you.' };
    return {
      ok: true,
      state: { ...s, cash: s.cash - PRESIDENT_CASH, title: 'president' },
      msg: 'The campaign costs $200,000 and every favor you’ve got — and you WIN. President of the 2D World!',
    };
  }
  if (!dictatorAvailable(s)) return { ok: false, state: s, msg: 'Your grip on this world isn’t tight enough yet.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash - DICTATOR_CASH, title: 'dictator' },
    msg: '$500,000 buys a lot of loyalty. The 2D World kneels. All hail the Dictator.',
  };
}

export interface Ending {
  id: string;
  title: string;
  blurb: string;
}

export function evaluateEnding(s: GameState): Ending {
  if (s.dead) {
    return { id: 'dead', title: 'Deceased', blurb: s.deathCause ?? 'The 2D World forgets quickly.' };
  }
  if (s.title === 'president') {
    return { id: 'president', title: 'President of the 2D World', blurb: 'Hail to the chief. The best ending there is.' };
  }
  if (s.title === 'dictator') {
    return { id: 'dictator', title: 'Dictator of the 2D World', blurb: 'Feared, obeyed, alone at the top.' };
  }
  const worth = s.cash + s.bank - s.loan;
  const { strength, intelligence, charm } = s.stats;
  if (worth >= 1_000_000) {
    return { id: 'millionaire', title: 'Stick Millionaire', blurb: `Net worth $${worth.toLocaleString()}. Money isn’t everything, but it’s most things.` };
  }
  if (strength >= 500 && intelligence >= 500 && charm >= 500) {
    return { id: 'renaissance', title: 'Renaissance Stick', blurb: 'Strong, brilliant, and charming. The full package.' };
  }
  if (worth >= 100_000) {
    return { id: 'mobile', title: 'Upwardly Mobile', blurb: 'Comfortable, respected, occasionally invited to things.' };
  }
  if (s.karma >= 60) {
    return { id: 'saint', title: 'Local Saint', blurb: 'Broke, maybe. Beloved, definitely.' };
  }
  if (s.karma <= -60) {
    return { id: 'menace', title: 'Menace to the 2D World', blurb: 'Parents whisper your name to frighten children.' };
  }
  return { id: 'average', title: 'Average Stick', blurb: 'You lived. You worked. You occasionally won at slots.' };
}
