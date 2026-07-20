import type { GameState } from './types';

// Save-slot bookkeeping: three independent lives, each in its own localStorage
// key. Pure helpers so the naming + slot summaries are testable; main.ts does
// the actual reading/writing.

export const SLOT_COUNT = 3;
export const SAVE_PREFIX = 'city98-save';
export const LEGACY_KEY = 'city98-save'; // the old single-save key, migrated to slot 1

export function slotKey(slot: number): string {
  return `${SAVE_PREFIX}-${slot}`;
}

export interface SlotSummary {
  slot: number;
  empty: boolean;
  name: string;
  day: number;
  cash: number;
  home: string;
}

/** A one-line summary of what's in a slot, for the title screen. */
export function summarize(slot: number, s: GameState | null): SlotSummary {
  if (!s) return { slot, empty: true, name: '', day: 0, cash: 0, home: 'studio' };
  return { slot, empty: false, name: s.look.name, day: s.day, cash: s.cash, home: s.home };
}
