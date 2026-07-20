import { describe, expect, it } from 'vitest';
import {
  CAR_MODELS, DINER_MENU, JOBS, RENT, buyCar, canWork, deserialize, eat, isSluggish,
  newGame, passTime, payDebt, serialize, sleep, weekdayName, workShift,
} from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('time and needs', () => {
  it('drains needs while the clock runs', () => {
    const s = passTime(fresh({ energy: 50, hunger: 50 }), 120);
    expect(s.energy).toBe(46);
    expect(s.hunger).toBe(42);
  });

  it('rolls days over midnight', () => {
    const s = passTime(fresh({ minute: 23 * 60 }), 120);
    expect(s.day).toBe(2);
    expect(s.minute).toBe(60);
  });

  it('flags sluggishness at low needs', () => {
    expect(isSluggish(fresh({ energy: 15 }))).toBe(true);
    expect(isSluggish(fresh({ hunger: 10 }))).toBe(true);
    expect(isSluggish(fresh())).toBe(false);
  });

  it('day 1 is Monday and day 8 is Monday again', () => {
    expect(weekdayName(1)).toBe('Monday');
    expect(weekdayName(8)).toBe('Monday');
    expect(weekdayName(6)).toBe('Saturday');
  });
});

describe('rent', () => {
  it('collects $120 on Monday rollover when you can pay', () => {
    const sunday = fresh({ day: 7, minute: 23 * 60, cash: 200 });
    const monday = passTime(sunday, 90);
    expect(monday.day).toBe(8);
    expect(monday.cash).toBe(80);
  });

  it('rolls unpaid rent into debt', () => {
    const broke = sleep(fresh({ day: 7, cash: 30 })).state;
    expect(broke.cash).toBe(30);
    expect(broke.debt).toBe(RENT);
    expect(broke.messages.at(-1)).toContain('tab');
  });

  it('payDebt pays down what you can afford', () => {
    const r = payDebt(fresh({ cash: 50, debt: 120 }));
    expect(r.state.cash).toBe(0);
    expect(r.state.debt).toBe(70);
    expect(payDebt(fresh({ debt: 0 })).ok).toBe(false);
  });
});

describe('sleep', () => {
  it('ends the day at 7 AM, rested and hungrier', () => {
    const r = sleep(fresh({ minute: 22 * 60, energy: 10, hunger: 60 }));
    expect(r.state.day).toBe(2);
    expect(r.state.minute).toBe(7 * 60);
    expect(r.state.energy).toBe(100);
    expect(r.state.hunger).toBe(35);
  });
});

describe('food', () => {
  it('meals cost money, fill you up, and take time', () => {
    const special = DINER_MENU.find(m => m.id === 'special')!;
    const r = eat(fresh({ cash: 20, hunger: 20 }), special);
    expect(r.state.cash).toBe(9);
    expect(r.state.hunger).toBeGreaterThan(80);
    expect(r.state.minute).toBeGreaterThan(fresh().minute);
    expect(eat(fresh({ cash: 1 }), special).ok).toBe(false);
    expect(eat(fresh({ hunger: 99 }), special).ok).toBe(false);
  });
});

describe('work', () => {
  it('video store shifts pay $44 for 4 hours', () => {
    const r = workShift(fresh({ minute: 10 * 60 }), 'video');
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(140 + 44);
    expect(r.state.minute).toBe(14 * 60);
    expect(r.state.shiftsWorked.video).toBe(1);
  });

  it('office keeps business hours and skips weekends', () => {
    expect(canWork(fresh({ day: 6, minute: 9 * 60 }), JOBS.office).ok).toBe(false);
    expect(canWork(fresh({ minute: 14 * 60 }), JOBS.office).ok).toBe(false);
    expect(canWork(fresh({ minute: 9 * 60 }), JOBS.office).ok).toBe(true);
    const r = workShift(fresh({ minute: 9 * 60 }), 'office');
    expect(r.state.cash).toBe(140 + 104);
  });

  it('refuses the exhausted', () => {
    expect(workShift(fresh({ minute: 10 * 60, energy: 10 }), 'video').ok).toBe(false);
  });
});

describe("Big Ray's", () => {
  it('sells with trade-in credit and swaps your car', () => {
    const r = buyCar(fresh({ cash: 700 }), 'wagon'); // 650 − 50 beater credit
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(100);
    expect(r.state.car).toBe('wagon');
  });

  it('upgrading later credits the current car', () => {
    const r = buyCar(fresh({ cash: 800, car: 'wagon' }), 'pickup'); // 1100 − 325
    expect(r.state.cash).toBe(25);
    expect(r.state.car).toBe('pickup');
  });

  it('refuses what you cannot afford, already own, or that is not for sale', () => {
    expect(buyCar(fresh({ cash: 100 }), 'sedan').ok).toBe(false);
    expect(buyCar(fresh({ car: 'sedan' }), 'sedan').ok).toBe(false);
    expect(buyCar(fresh(), 'beater').ok).toBe(false);
  });

  it('performance tiers actually differ', () => {
    expect(CAR_MODELS.sedan.top).toBeGreaterThan(CAR_MODELS.beater.top);
    expect(CAR_MODELS.wagon.accel).toBeLessThan(CAR_MODELS.sedan.accel);
  });
});

describe('saves', () => {
  it('round-trips and rejects garbage', () => {
    const s = fresh({ cash: 77, debt: 40 });
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize('junk{')).toBeNull();
    expect(deserialize('{"version":9}')).toBeNull();
  });

  it('old saves without a car get the beater', () => {
    const legacy = JSON.parse(serialize(fresh()));
    delete legacy.car;
    expect(deserialize(JSON.stringify(legacy))?.car).toBe('beater');
  });
});
