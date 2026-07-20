import { describe, expect, it } from 'vitest';
import { HOMES, buyHome, homeDef, homeRoom } from './housing';
import { deserialize, newGame, serialize } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('housing', () => {
  it('starts in the studio', () => {
    expect(fresh().home).toBe('studio');
    expect(homeDef(fresh()).room).toBe('home');
    expect(homeRoom(fresh())).toBe('home');
  });

  it('buys the loft for cash and moves you in', () => {
    const r = buyHome(fresh({ cash: 4000 }), 'loft');
    expect(r.ok).toBe(true);
    expect(r.state.home).toBe('loft');
    expect(r.state.cash).toBe(4000 - HOMES.loft.price);
    expect(homeRoom(r.state)).toBe('loft');
  });

  it('refuses without the down payment, or if already owned', () => {
    expect(buyHome(fresh({ cash: 100 }), 'loft').ok).toBe(false);
    expect(buyHome(fresh({ cash: 9999, home: 'loft' }), 'loft').ok).toBe(false);
    expect(buyHome(fresh({ cash: 9999 }), 'studio').ok).toBe(false);
  });

  it('home tier round-trips through saves; old saves default to studio', () => {
    const s = buyHome(fresh({ cash: 9999 }), 'loft').state;
    expect(deserialize(serialize(s))?.home).toBe('loft');
    const legacy = JSON.parse(serialize(fresh()));
    delete legacy.home;
    expect(deserialize(JSON.stringify(legacy))?.home).toBe('studio');
  });
});
