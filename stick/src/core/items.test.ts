import { describe, expect, it } from 'vitest';
import { buyCocaine, buyItem, useItem } from './items';
import { fresh } from './test-helpers';
import { itemCount, maxHp } from './state';

describe('buyItem', () => {
  it('charges and stocks inventory; ammo comes in fives', () => {
    const r = buyItem(fresh({ cash: 100 }), 'ammo');
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(90);
    expect(itemCount(r.state, 'ammo')).toBe(5);
  });

  it('refuses duplicate unique gear', () => {
    const s = buyItem(fresh({ cash: 1000 }), 'gun').state;
    expect(buyItem(s, 'gun').ok).toBe(false);
  });

  it('refuses when broke', () => {
    expect(buyItem(fresh({ cash: 5 }), 'smokes').ok).toBe(false);
  });
});

describe('useItem', () => {
  it('smokes trade HP for charm', () => {
    const s = fresh({ inventory: { smokes: 2 } });
    const r = useItem(s, 'smokes');
    expect(r.state.stats.charm).toBe(s.stats.charm + 1);
    expect(r.state.hp).toBe(s.hp - 10);
    expect(itemCount(r.state, 'smokes')).toBe(1);
  });

  it('smoking at 10 HP or less kills you', () => {
    const r = useItem(fresh({ hp: 10, inventory: { smokes: 1 } }), 'smokes');
    expect(r.state.dead).toBe(true);
  });

  it('snacks heal but never past max', () => {
    const hurt = fresh({ hp: 5, inventory: { nachos: 1 } });
    expect(useItem(hurt, 'nachos').state.hp).toBe(13);
    const full = fresh({ inventory: { nachos: 1 } });
    expect(useItem(full, 'nachos').ok).toBe(false);
    expect(fresh().hp).toBe(maxHp(fresh()));
  });
});

describe('buyCocaine', () => {
  it('sells at $400 a gram', () => {
    const r = buyCocaine(fresh({ cash: 2000 }), 4);
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(400);
    expect(itemCount(r.state, 'cocaine')).toBe(4);
    expect(buyCocaine(fresh({ cash: 100 }), 1).ok).toBe(false);
  });
});
