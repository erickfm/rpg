import { describe, expect, it } from 'vitest';
import { DAILY_INTEREST, applyInterest, deposit, withdraw } from './bank';
import { newGame, passTime, sleep } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('the bank', () => {
  it('deposits and withdraws between cash and savings', () => {
    const d = deposit(fresh({ cash: 140 }), 100);
    expect(d.state.cash).toBe(40);
    expect(d.state.savings).toBe(100);
    const w = withdraw(d.state, 60);
    expect(w.state.cash).toBe(100);
    expect(w.state.savings).toBe(40);
  });

  it('caps transactions at the available balance', () => {
    expect(deposit(fresh({ cash: 30 }), 999).state.savings).toBe(30);
    expect(withdraw(fresh({ savings: 25 }), 999).state.cash).toBe(165);
    expect(deposit(fresh({ cash: 0 }), 50).ok).toBe(false);
    expect(withdraw(fresh({ savings: 0 }), 50).ok).toBe(false);
  });

  it('pays interest on the balance and nothing on zero', () => {
    const r = applyInterest(fresh({ savings: 1000 }));
    expect(r.savings).toBe(1000 + Math.floor(1000 * DAILY_INTEREST));
    expect(applyInterest(fresh({ savings: 0 }))).toEqual(fresh({ savings: 0 }));
  });

  it('credits interest at midnight and on sleep', () => {
    const overnight = passTime(fresh({ savings: 5000, minute: 23 * 60 }), 120);
    expect(overnight.day).toBe(2);
    expect(overnight.savings).toBe(5000 + Math.floor(5000 * DAILY_INTEREST));
    const slept = sleep(fresh({ savings: 5000 })).state;
    expect(slept.savings).toBe(5000 + Math.floor(5000 * DAILY_INTEREST));
  });
});
