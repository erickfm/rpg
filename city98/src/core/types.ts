export type JobId = 'video' | 'office';

import type { ActiveGig } from './gigs';
import type { Appearance } from './appearance';

export interface GameState {
  version: 1;
  /** Minutes since midnight, 0..1439. One real second = one game minute. */
  minute: number;
  /** Day 1 is a Monday. */
  day: number;
  cash: number;
  /** 0..100. Low energy slows you; sleep restores it. */
  energy: number;
  /** 0..100. Low hunger (empty stomach) slows you; food restores it. */
  hunger: number;
  /** Rent owed but unpaid rolls into debt. */
  debt: number;
  shiftsWorked: Record<JobId, number>;
  /** Which car you own (see CAR_MODELS). */
  car: string;
  /** The active payphone errand, or null. */
  gig: ActiveGig | null;
  /** Owned goods (records, apartment upgrades) by id. */
  goods: string[];
  /** Bank savings balance; earns interest each midnight. */
  savings: number;
  /** Character appearance. */
  look: Appearance;
  /** Ids of completed life goals; wonAt is the day all were finished. */
  doneGoals: string[];
  wonAt: number | null;
  /** Which home you live in. */
  home: 'studio' | 'loft';
  /** Friendship counters with named citizens. */
  friends: Record<string, number>;
  /** Current story objective index (0 = not begun). */
  storyStage: number;
  /** Citizen ids whose personal favor you've completed. */
  favors: string[];
  messages: string[];
  seed: number;
}

/** Every action returns this; on failure `state` is unchanged. */
export interface ActionResult {
  ok: boolean;
  state: GameState;
  msg: string;
}
