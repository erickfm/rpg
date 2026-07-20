import { describe, expect, it } from 'vitest';
import { busTrip, canBoard, CITIES } from './trade';
import { fresh, seq } from './test-helpers';
import { itemCount } from './state';

const earlyBird = (patch = {}) => fresh({ minute: 0, cash: 5000, ...patch });

describe('bus trips', () => {
  it('only board before 6 AM', () => {
    expect(canBoard(fresh({ minute: 8 * 60 }))).toBe(false);
    expect(busTrip(fresh({ minute: 8 * 60 }), 'detroit', seq(0)).ok).toBe(false);
    expect(canBoard(fresh({ minute: 0 }))).toBe(true);
  });

  it('with nothing to sell the day is simply wasted', () => {
    const r = busTrip(earlyBird({ cash: 200 }), 'detroit', seq(0));
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(100);
    expect(r.state.day).toBe(2);
    expect(r.state.minute).toBe(8 * 60);
  });

  it('over 50 grams means a bust: 6 days gone, everything confiscated', () => {
    const r = busTrip(earlyBird({ inventory: { cocaine: 51, gun: 1, ammo: 5 } }), 'vegas', seq(0));
    expect(itemCount(r.state, 'cocaine')).toBe(0);
    expect(itemCount(r.state, 'gun')).toBe(0);
    expect(r.state.day).toBe(7);
    expect(r.state.karma).toBe(-15);
  });

  it('unarmed dealers get robbed', () => {
    const r = busTrip(earlyBird({ inventory: { cocaine: 5 } }), 'detroit', seq(0.5));
    expect(r.state.cash).toBe(0);
    expect(itemCount(r.state, 'cocaine')).toBe(0);
  });

  it('a successful sale prices per gram within the city range', () => {
    const s = earlyBird({
      inventory: { cocaine: 10, gun: 1, ammo: 5, bottle: 2 },
      stats: { strength: 250, intelligence: 1, charm: 1 },
    });
    // rolls: strength check skipped (str≥200), success roll, price roll
    const r = busTrip(s, 'vegas', seq(0.01, 0.5));
    const vegas = CITIES.find(c => c.id === 'vegas')!;
    const cashAfterFare = 5000 - vegas.fare;
    const haul = r.state.cash - cashAfterFare;
    const perGram = (haul - 2 * 45) / 10;
    expect(perGram).toBeGreaterThanOrEqual(vegas.priceMin);
    expect(perGram).toBeLessThanOrEqual(vegas.priceMax);
    expect(itemCount(r.state, 'cocaine')).toBe(0);
    expect(r.state.karma).toBe(-5);
    expect(r.state.cityVisits.vegas).toBe(1);
  });

  it('repeat visits and the cell phone raise the success chance', () => {
    const base = earlyBird({
      inventory: { cocaine: 1, gun: 1, ammo: 1 },
      stats: { strength: 250, intelligence: 1, charm: 1 },
    });
    // 0.52 fails the base 40% Vegas roll...
    const fail = busTrip(base, 'vegas', seq(0.52, 0.99));
    expect(itemCount(fail.state, 'cocaine')).toBe(1);
    // ...but succeeds with a cell phone (+10%)
    const phone = busTrip(
      { ...base, inventory: { ...base.inventory, cellPhone: 1 } },
      'vegas',
      seq(0.45, 0.5)
    );
    expect(itemCount(phone.state, 'cocaine')).toBe(0);
  });
});
