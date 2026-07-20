import { describe, expect, it } from 'vitest';
import { buyProperty, deposit, repayLoan, takeLoan, withdraw } from './bank';
import { fresh } from './test-helpers';
import { deserialize, serialize } from './state';

describe('deposits', () => {
  it('caps at cash on hand / balance', () => {
    const r = deposit(fresh({ cash: 50 }), 9999);
    expect(r.state.cash).toBe(0);
    expect(r.state.bank).toBe(50);
    expect(withdraw(fresh({ bank: 30 }), 100).state.cash).toBe(130);
    expect(deposit(fresh({ cash: 0 }), 50).ok).toBe(false);
  });
});

describe('loans', () => {
  it('lends at most $1000 outstanding', () => {
    const r = takeLoan(fresh({ cash: 0 }), 800);
    expect(r.state.cash).toBe(800);
    expect(r.state.loan).toBe(800);
    expect(takeLoan(r.state, 300).ok).toBe(false);
    expect(takeLoan(r.state, 200).ok).toBe(true);
  });

  it('repays from cash, capped at the debt', () => {
    const s = fresh({ cash: 500, loan: 300 });
    const r = repayLoan(s, 9999);
    expect(r.state.loan).toBe(0);
    expect(r.state.cash).toBe(200);
  });
});

describe('properties', () => {
  it('sells the Bigger Apartment then the Castle', () => {
    const rich = fresh({ cash: 600_000 });
    const bigger = buyProperty(rich, 'bigger');
    expect(bigger.state.home).toBe('bigger');
    expect(bigger.state.cash).toBe(575_000);
    const castle = buyProperty(bigger.state, 'castle');
    expect(castle.state.home).toBe('castle');
    expect(buyProperty(castle.state, 'bigger').ok).toBe(false);
    expect(buyProperty(fresh({ cash: 100 }), 'bigger').ok).toBe(false);
  });
});

describe('save round-trip', () => {
  it('v2 survives; garbage and v1 do not', () => {
    const s = fresh({ cash: 123, karma: -5, inventory: { gun: 1 } });
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize('{"version":1,"cash":50}')).toBeNull();
    expect(deserialize('nope{')).toBeNull();
  });
});
