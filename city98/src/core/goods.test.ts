import { describe, expect, it } from 'vitest';
import {
  RECORDS, UPGRADES, buyGood, goodById, hasStereo, hasUmbrella, ownedRecords, owns,
} from './goods';
import { deserialize, newGame, serialize } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });
const rec = RECORDS[0];

describe('the record store', () => {
  it('buying adds the good and charges you', () => {
    const r = buyGood(fresh({ cash: 50 }), rec.id);
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(50 - rec.price);
    expect(owns(r.state, rec.id)).toBe(true);
  });

  it('refuses duplicates, unknowns, and the broke', () => {
    const owned = buyGood(fresh({ cash: 50 }), rec.id).state;
    expect(buyGood(owned, rec.id).ok).toBe(false);
    expect(buyGood(fresh({ cash: 500 }), 'nope').ok).toBe(false);
    expect(buyGood(fresh({ cash: 1 }), rec.id).ok).toBe(false);
  });

  it('tracks the record collection and the stereo separately', () => {
    let s = fresh({ cash: 500 });
    expect(hasStereo(s)).toBe(false);
    s = buyGood(s, 'up_stereo').state;
    expect(hasStereo(s)).toBe(true);
    expect(ownedRecords(s)).toHaveLength(0);
    s = buyGood(s, RECORDS[0].id).state;
    s = buyGood(s, RECORDS[2].id).state;
    expect(ownedRecords(s).map(r => r.id)).toEqual([RECORDS[0].id, RECORDS[2].id]);
  });

  it('the umbrella is a buyable upgrade you can then own', () => {
    let s = fresh({ cash: 50 });
    expect(hasUmbrella(s)).toBe(false);
    s = buyGood(s, 'up_umbrella').state;
    expect(hasUmbrella(s)).toBe(true);
  });

  it('every record maps to a real station mood', () => {
    for (const r of RECORDS) {
      expect(r.mood).toBeGreaterThanOrEqual(0);
      expect(r.mood).toBeLessThanOrEqual(3);
    }
  });

  it('goodById resolves both records and upgrades', () => {
    expect(goodById(RECORDS[0].id)?.kind).toBe('record');
    expect(goodById(UPGRADES[0].id)?.kind).toBe('upgrade');
  });

  it('goods round-trip through saves; old saves default to none', () => {
    const s = buyGood(fresh({ cash: 500 }), 'up_lamp').state;
    expect(deserialize(serialize(s))?.goods).toEqual(['up_lamp']);
    const legacy = JSON.parse(serialize(fresh()));
    delete legacy.goods;
    expect(deserialize(JSON.stringify(legacy))?.goods).toEqual([]);
  });
});
