import { describe, expect, it } from 'vitest';
import { buyFurniture, useFurniture } from './home';
import { eatMeal } from './food';
import { fresh } from './test-helpers';

describe('Fine Line Furnishings', () => {
  it('the starter apartment only fits the bed', () => {
    const r = buyFurniture(fresh({ cash: 1000 }), 'bed');
    expect(r.ok).toBe(true);
    expect(buyFurniture(r.state, 'tv').ok).toBe(false);
    const bigger = fresh({ cash: 10_000, home: 'bigger', furniture: ['bed'] });
    expect(buyFurniture(bigger, 'tv').ok).toBe(true);
  });

  it('castle holds all eight pieces', () => {
    let s = fresh({ cash: 50_000, home: 'castle' });
    for (const id of ['bed', 'tv', 'computer', 'freezer', 'satellite', 'treadmill', 'encyclopedia', 'minibar'] as const) {
      const r = buyFurniture(s, id);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(s.furniture).toHaveLength(8);
  });

  it('daily-use furniture works once per day', () => {
    const s = fresh({ furniture: ['treadmill'], home: 'castle' });
    const once = useFurniture(s, 'treadmill');
    expect(once.state.stats.strength).toBe(s.stats.strength + 1);
    expect(useFurniture(once.state, 'treadmill').ok).toBe(false);
  });
});

describe('McSticks menu', () => {
  it('heals by the menu, more with the Deep Freeze', () => {
    const beefy = { strength: 100, intelligence: 1, charm: 1 };
    const hungry = fresh({ hp: 1, cash: 100, stats: beefy });
    expect(eatMeal(hungry, 'fries').state.hp).toBe(21);
    const frozen = fresh({ hp: 1, cash: 100, stats: beefy, furniture: ['freezer'], home: 'castle' });
    expect(eatMeal(frozen, 'fries').state.hp).toBe(31);
    expect(eatMeal(fresh({ cash: 0 }), 'triple').ok).toBe(false);
  });
});
