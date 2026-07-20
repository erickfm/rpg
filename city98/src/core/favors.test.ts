import { describe, it, expect } from 'vitest';
import { favorActive, favorAsk, completeFavor, activeFavor, activeFavorObjectives, FAVORS } from './favors';
import { newGame } from './sim';
import { FRIENDS_THRESHOLD } from './citizens';
import type { GameState } from './types';

const base = (over: Partial<GameState> = {}): GameState => ({ ...newGame(1), ...over });
const friendOf = (id: string) => ({ friends: { [id]: FRIENDS_THRESHOLD } });

describe('favor availability', () => {
  it('is inactive until you are the citizen\'s friend', () => {
    expect(favorActive(base(), 'gloria')).toBe(false);
    expect(favorActive(base({ friends: { gloria: 1 } }), 'gloria')).toBe(false);
    expect(favorActive(base(friendOf('gloria')), 'gloria')).toBe(true);
  });

  it('offers the Tier 1 favor first and shows its ask while unmet', () => {
    const s = base(friendOf('gloria'));
    expect(activeFavor(s, 'gloria')?.id).toBe('gloria');
    expect(favorAsk(s, 'gloria')).toContain('$500');
    const met = base({ ...friendOf('gloria'), savings: 800 });
    expect(favorAsk(met, 'gloria')).toBeNull(); // condition already met
  });
});

describe('completeFavor + tiers', () => {
  it('pays out Tier 1, records it, and cannot repeat it', () => {
    const s = base({ ...friendOf('rosa'), goods: ['up_umbrella'], cash: 10 });
    const r = completeFavor(s, 'rosa');
    expect(r).not.toBeNull();
    expect(r!.state.cash).toBe(40); // 10 + 30
    expect(r!.state.favors).toContain('rosa');
    expect(completeFavor(r!.state, 'rosa')).toBeNull(); // condition for tier 2 not met yet
  });

  it('gates Tier 2 behind Tier 1', () => {
    // friend + tier-2 condition met, but tier 1 not done → still offers tier 1
    const s = base({ ...friendOf('gloria'), savings: 3000 });
    expect(activeFavor(s, 'gloria')?.id).toBe('gloria');
  });

  it('unlocks Tier 2 once Tier 1 is done', () => {
    const s = base({ friends: { gloria: FRIENDS_THRESHOLD }, favors: ['gloria'], savings: 800 });
    const f = activeFavor(s, 'gloria');
    expect(f?.id).toBe('gloria2');
    expect(favorAsk(s, 'gloria')).toContain('twenty-five hundred'); // tier-2 ask, unmet at $800
    const rich = base({ friends: { gloria: FRIENDS_THRESHOLD }, favors: ['gloria'], savings: 2600, cash: 0 });
    const r = completeFavor(rich, 'gloria');
    expect(r!.state.favors).toContain('gloria2');
    expect(r!.state.cash).toBe(80);
    expect(activeFavor(r!.state, 'gloria')).toBeNull(); // both tiers done
  });

  it('keys each citizen\'s tiers to the right state', () => {
    expect(completeFavor(base({ ...friendOf('marcus'), favors: ['marcus'], goods: ['rec_neon', 'rec_gravel', 'rec_midnight', 'rec_static'] }), 'marcus')?.state.favors).toContain('marcus2');
    expect(completeFavor(base({ ...friendOf('rosa'), favors: ['rosa'], home: 'loft' }), 'rosa')?.state.favors).toContain('rosa2');
    expect(completeFavor(base({ ...friendOf('dale'), favors: ['dale'], car: 'sedan' }), 'dale')?.state.favors).toContain('dale2');
    expect(completeFavor(base({ ...friendOf('dale'), favors: ['dale'], car: 'wagon' }), 'dale')).toBeNull(); // wagon isn't the Regalia
  });

  it('has two tiers for each of the four citizens', () => {
    for (const c of ['gloria', 'marcus', 'rosa', 'dale']) {
      expect(FAVORS.filter(f => f.citizen === c)).toHaveLength(2);
    }
  });
});

describe('activeFavorObjectives', () => {
  it('lists the current offer per citizen and marks met ones', () => {
    const s = base({ friends: { gloria: FRIENDS_THRESHOLD, rosa: FRIENDS_THRESHOLD }, savings: 500 });
    const objs = activeFavorObjectives(s);
    expect(objs).toHaveLength(2);
    expect(objs.some(o => o.startsWith('✓ ') && o.includes('$500'))).toBe(true); // gloria met
    expect(objs.some(o => o.startsWith('• '))).toBe(true); // rosa unmet
  });
});
