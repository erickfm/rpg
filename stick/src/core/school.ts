import type { ActionResult, GameState } from './types';
import { addKarma, addStat } from './state';
import { passTime } from './time';

export const CLASS_COST = 20;
export const EXERCISE_COST = 5;

export function study(s: GameState): ActionResult {
  const next = passTime(addKarma(addStat(s, 'intelligence', 1), 1), 120);
  return { ok: true, state: next, msg: 'Two hours in the stacks. +1 Intelligence.' };
}

export function takeClass(s: GameState): ActionResult {
  if (s.cash < CLASS_COST) return { ok: false, state: s, msg: `Tuition is $${CLASS_COST}.` };
  let next: GameState = { ...s, cash: s.cash - CLASS_COST };
  next = passTime(addStat(next, 'intelligence', 2), 180);
  return { ok: true, state: next, msg: 'A dense lecture, but it sticks. +2 Intelligence.' };
}

export function exercise(s: GameState): ActionResult {
  if (s.cash < EXERCISE_COST) return { ok: false, state: s, msg: `Gym access is $${EXERCISE_COST}.` };
  let next: GameState = { ...s, cash: s.cash - EXERCISE_COST };
  next = passTime(addStat(next, 'strength', 1), 120);
  return { ok: true, state: next, msg: 'You rack the weights like a champ. +1 Strength.' };
}
