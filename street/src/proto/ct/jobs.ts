import { hudNote, screenFade } from './hud';
import { jobChance, stat } from './stats';
import { registerSlice } from './save';
import type { CtxBuild } from './ctx';
import type { ShopColumn } from './shop';

// ══ JOBS — THE APPLICATION, THE POSITION, THE SHIFT ═════════════════════════
//
// *"need to be able to submit job application at all of the shops. with
//  varying degrees of int needed"*   (2026-08-09)
//
// The rule this was waiting for already exists: `ct/stats.ts`'s `jobChance()`,
// built to his earlier spec — INT gates the good jobs, you ALWAYS have a small
// chance, CHA nudges both lines. This module is the job-giver that rule was
// written for, and it is ONE table keyed by the id every `shopCounter` already
// carries. `ct/shop.ts` appends `jobColumn()` to the counter panel, so every
// business in town takes an application off the same card and NO interior file
// holds a line of job config — which is also what keeps this change out of
// rooms other builders are standing in.
//
// ── THE LOOP, MINIMUM AND HONEST ────────────────────────────────────────────
//
//   APPLY          one roll of `jobChance(reqInt)`, on `Math.random` — a
//                  hiring is luck, never the seeded build stream (rng.ts is
//                  for the WORLD being the same twice, not for dice).
//   HIRED          one job at a time. Taking a new one quits the old — no
//                  ceremony, the old shop just stops offering you shifts.
//   WORK A SHIFT   once a day, at your employer's counter: the screen fades,
//                  the clock advances the shift (the college's own
//                  fade + snap pattern), and the wage lands in cash.
//   REJECTED       told plainly, and the shop keeps your name on file for
//                  REAPPLY_DAYS — the never-zero chance cannot be
//                  brute-forced by leaning on [E].
//
// ── THE WAGES, AGAINST THE RULER ────────────────────────────────────────────
//
// Rent is $500 a season = $17.86 a day; subsistence eating is ~$5.50 and the
// barn ~$14 (shop.ts's own table). So the bottom rung pays ~$30 — a day's rent
// and food with a few dollars left, which is what a grill job is — and the top
// of this table pays ~$80. The BANK, his "highest" tier (INT 8+), has no
// `shopCounter` yet; when its teller learns to take an application it slots
// into this table at ~$100 and nothing else changes.
export const REAPPLY_DAYS = 3;

export interface JobDef {
  /** the position, as the help-wanted card prints it */
  title: string;
  /** the INT the position wants — `jobChance`'s reqInt, 1…10 */
  reqInt: number;
  /** dollars, cash, at the end of a shift */
  wage: number;
  /** how long a shift runs, in game hours */
  hours: number;
  /** how the notes name the employer — 'the barn', 'the hotel' */
  at: string;
}

/** THE ONE TABLE, keyed by `ShopSpec.id`. A counter whose id is not here
 *  simply has no card — add a row and the shop is hiring. */
export const JOBS: Record<string, JobDef> = {
  'ct-shop-burger':  { title: 'GRILL CREW',        reqInt: 2, wage: 32, hours: 6, at: 'the barn' },
  'ct-shop-bodega':  { title: 'COUNTER CLERK',     reqInt: 2, wage: 30, hours: 6, at: 'the bodega' },
  'ct-shop-video':   { title: 'REWIND CLERK',      reqInt: 3, wage: 34, hours: 6, at: 'the hut' },
  'ct-shop-thrift':  { title: 'FLOOR CLERK',       reqInt: 4, wage: 40, hours: 6, at: 'the thrift store' },
  'ct-shop-diner':   { title: 'LINE COOK',         reqInt: 4, wage: 44, hours: 7, at: 'the diner' },
  'ct-shop-gym':     { title: 'DESK TRAINER',      reqInt: 5, wage: 48, hours: 7, at: 'the gym' },
  'ct-shop-pawn':    { title: 'COUNTER MAN',       reqInt: 5, wage: 52, hours: 7, at: 'the pawn shop' },
  'ct-shop-sleep':   { title: 'MATTRESS SALESMAN', reqInt: 6, wage: 58, hours: 8, at: 'the showroom' },
  'ct-shop-volt':    { title: 'FLOOR SALESMAN',    reqInt: 6, wage: 62, hours: 8, at: 'VOLT VILLAGE' },
  'ct-shop-hotel':   { title: 'NIGHT CLERK',       reqInt: 7, wage: 68, hours: 8, at: 'the hotel' },
  'ct-shop-college': { title: 'ADJUNCT TUTOR',     reqInt: 8, wage: 80, hours: 8, at: 'the college' },
};

// ── the employment record — module state, saved as a slice ─────────────────
//
// `hiredAt` is a JOBS key or null; `lastShiftDay` is the one-shift-a-day gate
// (GLOBAL, one body — the gym gates per machine, a payroll gates per person);
// `noAskUntil[shop]` is the first day that shop will look at you again.
// NEW GAME needs no line anywhere: the state lives only in the `ct-save`
// blob, which `ct/newgame.ts` wipes whole — stats.ts's own rule.
let hiredAt: string | null = null;
let lastShiftDay = -1;
let noAskUntil: Record<string, number> = {};

registerSlice('jobs', {
  capture: () => ({ hiredAt, lastShiftDay, noAskUntil: { ...noAskUntil } }),
  restore: (v: unknown) => {
    const o = v as Record<string, unknown>;
    if (!o || typeof o !== 'object') return;
    // BY NAME AND VALIDATED, stats.ts's restore rule: a corrupt blob cannot
    // hire you somewhere that does not exist.
    if (typeof o.hiredAt === 'string' && o.hiredAt in JOBS) hiredAt = o.hiredAt;
    else if (o.hiredAt === null) hiredAt = null;
    if (typeof o.lastShiftDay === 'number' && Number.isFinite(o.lastShiftDay)) {
      lastShiftDay = o.lastShiftDay;
    }
    if (o.noAskUntil && typeof o.noAskUntil === 'object') {
      noAskUntil = {};
      for (const [k, d] of Object.entries(o.noAskUntil as Record<string, unknown>)) {
        if (k in JOBS && typeof d === 'number' && Number.isFinite(d)) noAskUntil[k] = d;
      }
    }
  },
});

const dayNow = (ctx: CtxBuild): number => Math.floor(ctx.clock.now().totalMin / 1440);

// ── the application ─────────────────────────────────────────────────────────
//
// Returns TRUE whether they take you or not — the SERVICE is the application
// being considered, and it happened either way. That matters mechanically: a
// true return is what makes the counter repaint, and a rejection changes the
// card (to NO VACANCY) exactly as much as a hiring changes it (to STAFF).
// Nothing is charged either way; the line's price is 0.
function apply(ctx: CtxBuild, shopId: string): boolean {
  const job = JOBS[shopId];
  if (Math.random() < jobChance(job.reqInt)) {
    const old = hiredAt && hiredAt !== shopId ? JOBS[hiredAt] : null;
    hiredAt = shopId;
    hudNote(old
      ? `you're hired — ${job.title.toLowerCase()}, $${job.wage} a shift. ${old.at} can keep the apron`
      : `you're hired — ${job.title.toLowerCase()}, $${job.wage} a shift`);
  } else {
    noAskUntil[shopId] = dayNow(ctx) + REAPPLY_DAYS;
    // told plainly, in period voice — and the unqualified case says what was
    // missing, because "varying degrees of int needed" is a thing the player
    // has to be able to discover.
    hudNote(stat('int') < job.reqInt
      ? `"we need somebody sharper." they keep your name on file`
      : `they went with somebody else — ask again in a few days`);
  }
  return true;
}

// ── the shift ───────────────────────────────────────────────────────────────
//
// The college's own arithmetic for time passing at a counter: `screenFade`
// with the clock SNAPPED in the dark middle (`overSeconds: 0`), 140/90/170,
// because the world going by is the same event wherever it happens. The wage
// goes into the purse HERE and `buy()`'s own `refreshWallet` picks it up —
// same order the till uses, one layer along.
function workShift(ctx: CtxBuild, shopId: string): boolean {
  const job = JOBS[shopId];
  const d = dayNow(ctx);
  if (lastShiftDay === d) {
    hudNote('you have already worked today — the next shift is tomorrow');
    return false;
  }
  lastShiftDay = d;
  void screenFade({
    mid: () => ctx.clock.advance(job.hours * 60, { overSeconds: 0 }),
    outMs: 140, holdMs: 90, inMs: 170,
  });
  ctx.purse.cash += job.wage;
  hudNote(`${job.hours} hours at ${job.at} — $${job.wage}, cash`);
  return true;
}

/**
 * THE CARD ON THE COUNTER — one extra column for `shopCounter`'s panel, or
 * null for a business with no position in the table. Its words ARE the state:
 * HELP WANTED while they'd see you, NO VACANCY while your rejection is fresh,
 * STAFF once the job is yours.
 *
 * ⚠ MEMOIZED BY STATE, NOT REBUILT PER PAINT. The counter's hover and flash
 * washes compare `StockLine`s BY IDENTITY (`hover === c.line`, shop.ts), and
 * its `move` handler repaints whenever the line under the pointer is a
 * different OBJECT — a card that minted fresh lines every call would repaint
 * on every mouse move and never hold a hover wash. So the column is rebuilt
 * only when what it says would change, and identical state returns the
 * identical objects.
 */
const cardCache = new Map<string, { sig: string; col: ShopColumn }>();

export function jobColumn(ctx: CtxBuild, shopId: string): ShopColumn | null {
  const job = JOBS[shopId];
  if (!job) return null;
  const wait = hiredAt === shopId ? 0 : (noAskUntil[shopId] ?? 0) - dayNow(ctx);
  const sig = hiredAt === shopId ? 'staff' : wait > 0 ? `wait${wait}` : 'open';
  const hit = cardCache.get(shopId);
  if (hit && hit.sig === sig) return hit.col;
  let col: ShopColumn;
  if (sig === 'staff') {
    col = {
      head: 'STAFF', lines: [
        { name: 'WORK A SHIFT', price: 0, tag: `$${job.wage}`, serve: () => workShift(ctx, shopId) },
      ],
    };
  } else if (wait > 0) {
    col = {
      head: 'HELP WANTED', lines: [
        { name: job.title, price: 0, tag: 'NO VACANCY', serve: () => {
          hudNote(`they have your application — come back in ${wait} day${wait === 1 ? '' : 's'}`);
          return false;
        } },
      ],
    };
  } else {
    col = {
      head: 'HELP WANTED', lines: [
        { name: job.title, price: 0, tag: `$${job.wage}/DAY`, serve: () => apply(ctx, shopId) },
      ],
    };
  }
  cardCache.set(shopId, { sig, col });
  return col;
}
