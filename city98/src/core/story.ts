import type { ActionResult, GameState } from './types';
import { owns, addItem } from './goods';

/**
 * "The Lost Pressing" — a small linear story that ties the record shop and
 * the named citizens together. storyStage indexes the CURRENT objective
 * (0 = not begun). Pure and testable: state predicates auto-advance the
 * "fetch" stages; talking to the right citizen advances the "deliver" ones.
 */

export type StageKind = 'own' | 'talk';

export interface Stage {
  n: number;
  kind: StageKind;
  /** item id for 'own', citizen id for 'talk' */
  need: string;
  objective: string;
  /** cash paid when this stage completes */
  reward: number;
  advance: string; // message shown on completion
}

export const STAGES: Stage[] = [
  { n: 1, kind: 'own', need: 'rec_static', reward: 0,
    objective: 'Find a rare pressing of “Basement Static” at Spin City Records.',
    advance: 'You track down the record. Marcus is going to lose it.' },
  { n: 2, kind: 'talk', need: 'marcus', reward: 60,
    objective: 'Bring “Basement Static” to Marcus.',
    advance: 'Marcus cradles the record like a newborn. "You found it. You actually found it." +$60.' },
  { n: 3, kind: 'talk', need: 'gloria', reward: 30,
    objective: 'Marcus says Gloria knew the band. Go ask Gloria about the B-side.',
    advance: 'Gloria smiles at a memory. "The drummer married my cousin. Small city." +$30.' },
];

export const STORY_LAST = STAGES.length;

export function currentStage(s: GameState): Stage | null {
  if (s.storyStage < 1 || s.storyStage > STAGES.length) return null;
  return STAGES[s.storyStage - 1];
}

export function storyObjective(s: GameState): string | null {
  if (s.storyStage === 0) return null;
  if (s.storyStage > STORY_LAST) return 'The Lost Pressing — complete.';
  return currentStage(s)?.objective ?? null;
}

/** Begin the thread the first time you befriend Marcus. */
export function beginStory(s: GameState): GameState {
  if (s.storyStage !== 0) return s;
  return {
    ...s,
    storyStage: 1,
    messages: [...s.messages, 'Marcus mentioned he\'s been hunting a lost record for years. Maybe you can help.'],
  };
}

function complete(s: GameState, stage: Stage): ActionResult {
  let next: GameState = { ...s, storyStage: s.storyStage + 1, cash: s.cash + stage.reward };
  // handing the record to Marcus consumes it
  if (stage.n === 2) next = addItem(next, 'rec_static', -1) ?? next;
  if (next.storyStage > STORY_LAST) {
    next = { ...next, messages: [...next.messages, 'The Lost Pressing: finished. Marcus calls you "good people" now. It sticks.'] };
    return { ok: true, state: next, msg: `${stage.advance} The story\'s complete — you\'re one of the neighborhood now.` };
  }
  return { ok: true, state: next, msg: stage.advance };
}

/** Auto-advance 'own' stages after any state change. Returns null if nothing. */
export function checkStory(s: GameState): ActionResult | null {
  const stage = currentStage(s);
  if (!stage || stage.kind !== 'own') return null;
  if (owns(s, stage.need)) return complete(s, stage);
  return null;
}

/** Advance a 'talk' stage when you speak to the right citizen. */
export function deliverStory(s: GameState, citizenId: string): ActionResult | null {
  const stage = currentStage(s);
  if (!stage || stage.kind !== 'talk' || stage.need !== citizenId) return null;
  // stage 2 requires you actually still hold the record
  if (stage.n === 2 && !owns(s, 'rec_static')) {
    return { ok: false, state: s, msg: 'Marcus: "You said you found it! Bring the record, not the story."' };
  }
  return complete(s, stage);
}
