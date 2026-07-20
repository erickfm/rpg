import type { ActionResult, GameState } from './types';
import { fmtClock } from './sim';

/**
 * Odd-job errands posted at the payphone by the park. Accept one, get a
 * destination and a deadline (a clock time later the same day), show up in
 * time, get paid. Pure and deterministic — the active gig lives on state.
 */

export interface GigTemplate {
  id: string;
  giver: string;
  /** interactable id you must reach to finish */
  dest: string;
  destName: string;
  pay: number;
  /** minutes you're given from acceptance */
  window: number;
  brief: string;
}

export const GIG_TEMPLATES: GigTemplate[] = [
  { id: 'tapes', giver: 'Video Palace', dest: 'video', destName: 'Video Palace', pay: 35, window: 90,
    brief: '"Some clown dropped the overnight returns at the wrong store. Run \'em back to Video Palace, would ya?"' },
  { id: 'coffee', giver: 'a tired voice', dest: 'diner', destName: 'the Sunrise Diner', pay: 25, window: 60,
    brief: '"I need a Big Slam and I cannot physically stand up. Get to the Sunrise and I\'ll wire you the cash. Trust me."' },
  { id: 'parts', giver: 'Big Ray', dest: 'dealer', destName: "Big Ray's Autos", pay: 45, window: 75,
    brief: '"Got a carburetor with your name on it, kid. Swing by the lot before I close and it\'s worth your while."' },
  { id: 'donuts', giver: 'the night shift', dest: 'donut', destName: 'the Donut Hut', pay: 30, window: 70,
    brief: '"Office morale emergency. We need a dozen from the Donut Hut, stat. Expensed, obviously."' },
  { id: 'gas', giver: 'a stranded driver', dest: 'gasshop', destName: 'the Gas-N-Go', pay: 40, window: 55,
    brief: '"Ran dry two blocks from the Gas-N-Go. Grab me a can and there\'s cash in it for you."' },
  { id: 'arcade', giver: 'a breathless kid', dest: 'arcade', destName: 'the Neon Dragon', pay: 20, window: 45,
    brief: '"My high score\'s about to get bumped! Get to the Neon Dragon and guard the machine! I\'ll pay!"' },
];

export interface ActiveGig {
  templateId: string;
  dest: string;
  destName: string;
  pay: number;
  giver: string;
  /** absolute deadline: whole minutes since day 1 00:00 */
  deadlineAbs: number;
}

function absMinute(s: GameState): number {
  return (s.day - 1) * 24 * 60 + s.minute;
}

/** Which gigs are on the board right now — deterministic per day, minus the active one. */
export function availableGigs(s: GameState): GigTemplate[] {
  const rng = mulberry(s.seed ^ (s.day * 2654435761));
  const shuffled = [...GIG_TEMPLATES].sort(() => rng() - 0.5);
  const count = 3;
  return shuffled.slice(0, count).filter(g => g.id !== s.gig?.templateId);
}

export function acceptGig(s: GameState, template: GigTemplate): ActionResult {
  if (s.gig) return { ok: false, state: s, msg: 'You already have a job on. Finish it first.' };
  const gig: ActiveGig = {
    templateId: template.id,
    dest: template.dest,
    destName: template.destName,
    pay: template.pay,
    giver: template.giver,
    deadlineAbs: absMinute(s) + template.window,
  };
  return {
    ok: true,
    state: { ...s, gig },
    msg: `Job on: get to ${template.destName} by ${fmtClock(gig.deadlineAbs % (24 * 60))}. $${template.pay}.`,
  };
}

/** Call when the player reaches an interactable `dest`. */
export function tryCompleteGig(s: GameState, dest: string): ActionResult | null {
  if (!s.gig || s.gig.dest !== dest) return null;
  const late = absMinute(s) > s.gig.deadlineAbs;
  const gig = s.gig;
  const cleared = { ...s, gig: null };
  if (late) {
    return { ok: false, state: cleared, msg: `You blew the deadline for the ${gig.destName} run. No pay. They're not thrilled.` };
  }
  return {
    ok: true,
    state: { ...cleared, cash: cleared.cash + gig.pay },
    msg: `Delivered on time. +$${gig.pay}. Word gets around — good word.`,
  };
}

export function abandonGig(s: GameState): ActionResult {
  if (!s.gig) return { ok: false, state: s, msg: 'You have no job to drop.' };
  return { ok: true, state: { ...s, gig: null }, msg: 'You bail on the job. The payphone judges you silently.' };
}

/** Minutes left, or negative if blown. */
export function gigTimeLeft(s: GameState): number | null {
  if (!s.gig) return null;
  return s.gig.deadlineAbs - absMinute(s);
}

// tiny local PRNG so this module stays dependency-free of render rng
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
