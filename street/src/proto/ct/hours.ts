import type { CtxBuild } from './ctx';

// ══ OPENING HOURS — ONE TABLE FOR THE WHOLE STREET ═══════════════════════════
//
// *"i want to be able to work longer as long as the business is open. also
//  lets give businesses reasonable hours. some businesses can have late hours
//  or even 24 hours but it just has to kinda make sense"*   (2026-08-10)
//
// So hours are a FACT ABOUT A BUSINESS, stated once, and everything reads it:
// the shop counter stops serving after close (`ct/shop.ts`), the punch clock
// takes no card while the shop is dark and cuts a shift at closing time
// (`ct/jobs.ts`), and a card by every door posts the hours
// (`ct/hours-cards.ts`) — which is where a 1997 customer would look.
//
// ⚠ THIS MODULE IMPORTS NOTHING AT RUNTIME, deliberately. shop.ts and jobs.ts
// read it, every `int-*.ts` imports those, and `ct/doors.ts` eagerly globs
// `int-*.ts` — so a runtime edge from here toward doors.ts would close the
// cycle GOTCHAS §28 warns about and drop rooms from the BUILT BUNDLE ONLY.
// The card hanger, which genuinely needs doors.ts, lives in its own module
// (`ct/hours-cards.ts`, which nothing imports) for exactly this reason.
//
// DOORS DO NOT LOCK. A locked door is a wall with a handle, and a door that
// shuts behind you is a cousin of the panel you cannot close — the worst bug
// this project ships. Closed means the SERVICES refuse, in their own words,
// and the prompt says when to come back.

export interface BizHours {
  /** roster name — the key `ct/doors.ts` already answers for, so the door
   *  card can hang itself without asking anyone */
  building: string;
  /** the counter / punch-clock key, `ct-shop-*` — absent where the interior
   *  keeps its own hours (the bank's `shut()`) or has no gated counter
   *  (the casino, the tax office) */
  shop?: string;
  /** opening hour 0–23 and closing hour 1–24, on the game clock.
   *  `open: 0, close: 24` is round-the-clock; close < open wraps midnight. */
  open: number;
  close: number;
}

/**
 * THE TABLE. "It just has to kinda make sense" is the whole spec, so every
 * row is an argument, not a number:
 */
export const HOURS: BizHours[] = [
  // ── never close — where 1997 keeps the lights on ──────────────────────────
  { building: 'BODEGA', shop: 'ct-shop-bodega', open: 0, close: 24 },
  { building: 'DINER', shop: 'ct-shop-diner', open: 0, close: 24 },
  // the hotel's one job IS "NIGHT CLERK" — a front desk that closed at night
  // would be hiring for a position it does not have
  { building: 'HOTEL ORPHEUS', shop: 'ct-shop-hotel', open: 0, close: 24 },
  // a casino that closed would be admitting something
  { building: 'SEVENS', open: 0, close: 24 },
  // ── late ──────────────────────────────────────────────────────────────────
  { building: 'BURGER BARN', shop: 'ct-shop-burger', open: 10, close: 24 },
  // the whole business model is a tape and a walk home after dark
  { building: 'VIDEO HUT', shop: 'ct-shop-video', open: 10, close: 24 },
  // "WE OPEN AT SIX. YOU DON'T LOOK LIKE A SIX." — the gym's own rejection
  // slip (jobs.ts) fixed its opening hour before this table existed
  { building: 'CROSSTOWN FITNESS', shop: 'ct-shop-gym', open: 6, close: 22 },
  // night classes are what a community college is FOR
  { building: 'COMMUNITY COLLEGE', shop: 'ct-shop-college', open: 8, close: 21 },
  { building: 'VOLT VILLAGE', shop: 'ct-shop-volt', open: 10, close: 21 },
  // ── daytime ───────────────────────────────────────────────────────────────
  { building: 'THRIFT', shop: 'ct-shop-thrift', open: 9, close: 18 },
  { building: 'PAWN', shop: 'ct-shop-pawn', open: 9, close: 19 },
  { building: 'SLEEP CENTER', shop: 'ct-shop-sleep', open: 10, close: 19 },
  { building: 'A-1 TAX', open: 9, close: 18 },
  // ⚠ 9–16 RESTATES `int-bank.ts`'s OPEN_H/CLOSE_H — its `shut()` predates
  // this table and stays its own. Change one, change both: the card by the
  // door and the loan desk must not disagree about banker's hours.
  { building: 'FIRST FEDERAL', open: 9, close: 16 },
];

// The church, the library and the jail have no row ON PURPOSE: they are not
// businesses, nothing inside them takes money at a counter, and a posted-hours
// card that nothing enforces would be the sign lying. Street trade (the
// dealer, the ATM) keeps no hours either — one because he would not post them,
// the other because that is what an ATM is for.

const BY_KEY = new Map<string, BizHours>();
for (const h of HOURS) {
  BY_KEY.set(h.building, h);
  if (h.shop) BY_KEY.set(h.shop, h);
}

/** the row for a shop id or roster name, or undefined — and undefined means
 *  UNGATED: a business with no row keeps the door it always had */
export const hoursFor = (key: string): BizHours | undefined => BY_KEY.get(key);

const allDay = (h: BizHours): boolean => h.close - h.open >= 24;

function openAt(h: BizHours, totalMin: number): boolean {
  if (allDay(h)) return true;
  const m = ((totalMin % 1440) + 1440) % 1440;
  const a = h.open * 60, b = (h.close % 24) * 60;
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

/** is this business serving right now — unknown keys are always open */
export function openNow(ctx: Pick<CtxBuild, 'clock'>, key: string): boolean {
  const h = BY_KEY.get(key);
  return !h || openAt(h, ctx.clock.now().totalMin);
}

/** whole minutes until the shutters come down — Infinity where they never do.
 *  0 when already closed, so `min(shift, this)` can never pay a ghost hour. */
export function minsUntilClose(ctx: Pick<CtxBuild, 'clock'>, key: string): number {
  const h = BY_KEY.get(key);
  if (!h || allDay(h)) return Infinity;
  const now = ctx.clock.now().totalMin;
  if (!openAt(h, now)) return 0;
  const m = ((now % 1440) + 1440) % 1440;
  const b = (h.close % 24) * 60;
  return Math.floor(b > m ? b - m : 1440 - m + b);
}

/** an hour the way a hand-lettered card writes it: '9 AM', '10 PM', 'NOON',
 *  'MIDNIGHT' — nobody paints '12 AM' on a door and means it */
export function fmtHour(hr: number): string {
  const h = ((hr % 24) + 24) % 24;
  if (h === 0) return 'MIDNIGHT';
  if (h === 12) return 'NOON';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** when this business opens next, lowercase, for a prompt line —
 *  `closed — opens at 9 am`. Meaningless for a 24-hour row, which is fine:
 *  a row that never closes never gets asked. */
export const opensLabel = (key: string): string =>
  fmtHour(BY_KEY.get(key)?.open ?? 0).toLowerCase();
