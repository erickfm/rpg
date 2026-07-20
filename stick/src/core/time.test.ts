import { describe, expect, it } from 'vitest';
import { availableWakeModes, formatClock, jumpDays, passTime, sleep } from './time';
import { fresh } from './test-helpers';
import { maxHp } from './state';

describe('passTime', () => {
  it('advances within a day', () => {
    const s = passTime(fresh(), 90);
    expect(s.day).toBe(1);
    expect(s.minute).toBe(8 * 60 + 90);
  });

  it('applies bank interest, loan interest, and stock moves at midnight', () => {
    const start = fresh({ minute: 23 * 60, bank: 1000, loan: 500 });
    const s = passTime(start, 120);
    expect(s.day).toBe(2);
    expect(s.bank).toBe(1010);
    expect(s.loan).toBe(510);
    expect(s.stockPrices).not.toEqual(start.stockPrices);
  });

  it('flags the end of the game past the day limit', () => {
    const s = jumpDays(fresh({ dayLimit: 3, day: 3 }), 1);
    expect(s.ended).toBe(true);
    expect(jumpDays(fresh({ dayLimit: null, day: 99 }), 1).ended).toBe(false);
  });
});

describe('sleep', () => {
  it('always ends the day at the mode wake time', () => {
    const early = sleep(fresh({ minute: 9 * 60 }), 'normal');
    expect(early.state.day).toBe(2);
    expect(early.state.minute).toBe(8 * 60);
  });

  it('gates alarm and caffeine modes on gear, consuming a pill', () => {
    expect(availableWakeModes(fresh())).toEqual(['normal']);
    const geared = fresh({ inventory: { alarmClock: 1, caffeine: 2 } });
    expect(availableWakeModes(geared)).toEqual(['normal', 'alarm', 'caffeine']);
    expect(sleep(fresh(), 'alarm').ok).toBe(false);
    const r = sleep(geared, 'caffeine');
    expect(r.state.minute).toBe(0);
    expect(r.state.inventory.caffeine).toBe(1);
  });

  it('restores full HP only with the Coma-Snooze bed', () => {
    const floor = sleep(fresh({ hp: 1 }), 'normal').state;
    expect(floor.hp).toBe(Math.floor(maxHp(floor) * 0.6));
    const bed = sleep(fresh({ hp: 1, furniture: ['bed'] }), 'normal').state;
    expect(bed.hp).toBe(maxHp(bed));
  });

  it('resets daily furniture use', () => {
    const s = sleep(fresh({ furniture: ['tv'], furnitureUsed: ['tv'] }), 'normal').state;
    expect(s.furnitureUsed).toEqual([]);
  });
});

describe('formatClock', () => {
  it('formats 12-hour times', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(8 * 60)).toBe('8:00 AM');
    expect(formatClock(12 * 60 + 5)).toBe('12:05 PM');
  });
});
