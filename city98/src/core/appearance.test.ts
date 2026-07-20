import { describe, expect, it } from 'vitest';
import {
  HAIR_COLORS, SHIRT_COLORS, cycleHair, cycleShirt, cycleSkin, defaultAppearance, setName,
} from './appearance';
import { deserialize, newGame, serialize } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('character appearance', () => {
  it('a new character has a default look', () => {
    expect(fresh().look).toEqual(defaultAppearance());
  });

  it('cycling wraps around each palette', () => {
    let s = fresh();
    const start = s.look.shirt;
    for (let i = 0; i < SHIRT_COLORS.length; i++) s = cycleShirt(s).state;
    expect(s.look.shirt).toBe(start); // full loop returns home
    s = cycleShirt(fresh({ look: { ...fresh().look, shirt: 0 } }), -1).state;
    expect(s.look.shirt).toBe(SHIRT_COLORS.length - 1); // wraps backwards
  });

  it('hair and skin cycle independently of shirt', () => {
    const s = cycleHair(cycleSkin(fresh()).state).state;
    expect(s.look.hair).toBe((defaultAppearance().hair + 1) % HAIR_COLORS.length);
    expect(s.look.shirt).toBe(defaultAppearance().shirt);
  });

  it('names are trimmed, capped, and non-empty', () => {
    expect(setName(fresh(), '  Rex  ').state.look.name).toBe('Rex');
    expect(setName(fresh(), 'x'.repeat(40)).state.look.name).toHaveLength(16);
    expect(setName(fresh(), '   ').ok).toBe(false);
  });

  it('the look round-trips through saves; old saves get a default', () => {
    const s = setName(cycleShirt(fresh()).state, 'Jo').state;
    expect(deserialize(serialize(s))?.look).toEqual(s.look);
    const legacy = JSON.parse(serialize(fresh()));
    delete legacy.look;
    expect(deserialize(JSON.stringify(legacy))?.look).toEqual(defaultAppearance());
  });
});
