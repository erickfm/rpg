import { describe, it, expect } from 'vitest';
import { slotKey, summarize, SLOT_COUNT, LEGACY_KEY } from './saves';
import { newGame } from './sim';

describe('save slots', () => {
  it('has three distinctly-keyed slots, separate from the legacy key', () => {
    expect(SLOT_COUNT).toBe(3);
    const keys = new Set([slotKey(1), slotKey(2), slotKey(3)]);
    expect(keys.size).toBe(3);
    expect(keys.has(LEGACY_KEY)).toBe(false); // legacy key won't collide with a slot
    expect(slotKey(1)).toBe('city98-save-1');
  });

  it('summarizes an empty slot', () => {
    const s = summarize(2, null);
    expect(s).toEqual({ slot: 2, empty: true, name: '', day: 0, cash: 0, home: 'studio' });
  });

  it('summarizes an occupied slot from its state', () => {
    const state = { ...newGame(1), day: 5, cash: 320, home: 'loft' as const };
    state.look = { ...state.look, name: 'Rae' };
    const s = summarize(1, state);
    expect(s).toMatchObject({ slot: 1, empty: false, name: 'Rae', day: 5, cash: 320, home: 'loft' });
  });
});
