import type { ActionResult, GameState } from './types';
import { ownedRecords } from './goods';

/**
 * Life goals — the sandbox's soft spine. Each is a predicate over the game
 * state; completing one (first time) pays a small bonus. Finishing them all
 * is the game's "you made it" moment. Pure and deterministic.
 */

export interface Aspiration {
  id: string;
  title: string;
  hint: string;
  reward: number;
  done: (s: GameState) => boolean;
}

export const ASPIRATIONS: Aspiration[] = [
  { id: 'wheels', title: 'Trade Up', hint: 'Own a car that isn\'t the beater.', reward: 100,
    done: s => s.car !== 'beater' },
  { id: 'nest', title: 'Rainy Day Fund', hint: 'Bank $5,000 in savings.', reward: 250,
    done: s => s.savings >= 5000 },
  { id: 'crates', title: 'Vinyl Junkie', hint: 'Own three records.', reward: 60,
    done: s => ownedRecords(s).length >= 3 },
  { id: 'ladder', title: 'Company Stick', hint: 'Work 12 shifts at Datacorp.', reward: 150,
    done: s => s.shiftsWorked.office >= 12 },
  { id: 'homey', title: 'Home Sweet Home', hint: 'Get the stereo, a lamp, and a plant.', reward: 80,
    done: s => ['up_stereo', 'up_lamp', 'up_plant'].every(g => s.goods.includes(g)) },
  { id: 'settled', title: 'Made Rent', hint: 'Reach Day 14 debt-free.', reward: 120,
    done: s => s.day >= 14 && s.debt === 0 },
  { id: 'loft', title: 'Moving On Up', hint: 'Buy the Skyline Loft.', reward: 200,
    done: s => s.home === 'loft' },
];

export function isDone(s: GameState, id: string): boolean {
  return s.doneGoals.includes(id);
}

export function allDone(s: GameState): boolean {
  return ASPIRATIONS.every(a => s.doneGoals.includes(a.id));
}

export function progress(s: GameState): { done: number; total: number } {
  return { done: ASPIRATIONS.filter(a => s.doneGoals.includes(a.id)).length, total: ASPIRATIONS.length };
}

/**
 * Check for newly-satisfied goals, bank their rewards, and (if it was the
 * last one) declare victory. Returns null when nothing changed.
 */
export function checkAspirations(s: GameState): ActionResult | null {
  const fresh = ASPIRATIONS.filter(a => a.done(s) && !s.doneGoals.includes(a.id));
  if (fresh.length === 0) return null;
  const reward = fresh.reduce((sum, a) => sum + a.reward, 0);
  const doneGoals = [...s.doneGoals, ...fresh.map(a => a.id)];
  let next: GameState = { ...s, cash: s.cash + reward, doneGoals };
  const titles = fresh.map(a => `“${a.title}”`).join(', ');
  let msg = `Life goal reached: ${titles}. +$${reward}.`;
  if (ASPIRATIONS.every(a => doneGoals.includes(a.id)) && !s.wonAt) {
    next = { ...next, wonAt: next.day, messages: [...next.messages, 'You did it. Every goal, checked off. The city feels like yours now.'] };
    msg = `${titles} — and that\'s ALL of them. You\'ve made it.`;
  }
  return { ok: true, state: next, msg };
}
