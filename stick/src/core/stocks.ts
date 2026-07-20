import type { ActionResult, GameState, TickerId } from './types';
import { mulberry32 } from './rng';

export const TICKERS: { id: TickerId; name: string }[] = [
  { id: 'XGEN', name: 'XGen Heavy Industries' },
  { id: 'STIK', name: 'Stick Amalgamated' },
  { id: 'DIME', name: 'Dimension Mining Co.' },
];

/** Deterministic daily move per ticker: −14%..+18%, seeded by run + day. */
function dailyFactor(seed: number, day: number, ticker: TickerId): number {
  const salt = ticker.charCodeAt(0) * 31 + ticker.charCodeAt(1);
  const r = mulberry32((seed ^ (day * 2654435761) ^ (salt * 40503)) >>> 0)();
  return 0.86 + r * 0.32;
}

export function repriceStocks(s: GameState): GameState {
  const prices = { ...s.stockPrices };
  for (const t of TICKERS) {
    prices[t.id] = Math.max(1, Math.round(prices[t.id] * dailyFactor(s.seed, s.day, t.id)));
  }
  return { ...s, stockPrices: prices };
}

export function buyStock(s: GameState, ticker: TickerId, shares: number): ActionResult {
  const cost = s.stockPrices[ticker] * shares;
  if (shares < 1) return { ok: false, state: s, msg: 'How many shares?' };
  if (s.cash < cost) return { ok: false, state: s, msg: `That’s $${cost}. Too rich for you.` };
  return {
    ok: true,
    state: {
      ...s,
      cash: s.cash - cost,
      stockOwned: { ...s.stockOwned, [ticker]: s.stockOwned[ticker] + shares },
    },
    msg: `Bought ${shares} ${ticker} at $${s.stockPrices[ticker]}.`,
  };
}

export function sellStock(s: GameState, ticker: TickerId, shares: number): ActionResult {
  if (shares < 1 || s.stockOwned[ticker] < shares) {
    return { ok: false, state: s, msg: 'You don’t hold that many shares.' };
  }
  const value = s.stockPrices[ticker] * shares;
  return {
    ok: true,
    state: {
      ...s,
      cash: s.cash + value,
      stockOwned: { ...s.stockOwned, [ticker]: s.stockOwned[ticker] - shares },
    },
    msg: `Sold ${shares} ${ticker} for $${value}.`,
  };
}
