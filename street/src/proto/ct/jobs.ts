import * as THREE from 'three';
import { makePanel, hudNote, screenFade, type Panel } from './hud';
import { pixTex, declareSurface, dither } from './paint';
import { jobChance, stat } from './stats';
import { registerSlice } from './save';
import { boardStandoff } from './shop';
import { makeSigPad, paintBackspace, type SigPad } from './signature';
import { workMinutesLeft, workStretch } from './fatigue';
import type { CtxBuild } from './ctx';
import type { Room } from './interior';

// ══ JOBS — THE APPLICATION ON THE WALL, THE PUNCH CLOCK BESIDE IT ═══════════
//
// *"need to be able to submit job application at all of the shops. with
//  varying degrees of int needed"*   (2026-08-09)
//
// …and then he used the first pass (a HELP WANTED column on the counter
// board) and re-shaped it, verbatim:
//
// *"so instead of help wanted being an option i just want a little section of
//  the interior to have an application. similar to loan app. diagetic in that
//  way. then apply if you get a job theres a clock in station that you can
//  'work' at. it's like [E] sleep. just [E] work. at the clock in part of the
//  interior. each place you work has this. each shift is 8 hrs long. on the
//  app it states the hourly wage."*   (2026-08-09)
//
// So a job is TWO OBJECTS ON A WALL, not a line on a menu:
//
//   THE APPLICATION   a clipboard under a HELP WANTED card. [E] leans you
//                     onto the paper — the bank's loan form's own grammar
//                     (`int-bank.ts`: the overlay is not a screen standing in
//                     for the paper, it IS the paper) — and the sheet states
//                     the POSITION and the HOURLY WAGE, his explicit spec.
//                     SIGN AND SUBMIT rolls `jobChance(reqInt)` once, on
//                     `Math.random` — a hiring is luck, never the seeded
//                     build stream. Hired or rejected, the paper says so in
//                     its own voice; a rejection tapes a POSITION FILLED slip
//                     over the form for REAPPLY_DAYS, so the never-zero
//                     chance cannot be brute-forced by leaning on [E].
//
//   THE TIME CLOCK    a punch clock and its card rack. The prompt is one
//                     word — `[E] work`, like `[E] sleep` — it answers only
//                     where you are hired, and a shift is EIGHT HOURS:
//                     the screen fades, the clock snaps forward the shift
//                     (the college's fade + snap), and hourly × hours lands
//                     in cash at punch-out.
//
//                     …and punching the clock again straight after a shift
//                     keeps you working — another stretch, paid the same
//                     hourly — until the fatigue system settles the argument.
//                     Still one working day per calendar day: walk away for
//                     more than an hour and the clock will not take your card
//                     again until tomorrow.
//
//                     THE SHOP'S HOURS ARE NOT THIS FILE'S BUSINESS ANY MORE.
//                     They were, for a day: *"i want to be able to work longer
//                     as long as the business is open"* (2026-08-10) put a gate
//                     here that cut a shift short at closing time and refused
//                     the card while the shop was dark. The gate moved to the
//                     DOOR on 2026-08-11 — *"if were in we can always work"* —
//                     so being at this clock already means the shop let you in,
//                     and a shift is a full shift. See `ct/hours.ts`.
//
// ONE TABLE, ONE BUILDER. `jobStation()` below builds the whole wall section
// — card, clipboard, form, punch clock, rack, both [E] spots — so an interior
// contributes one call with a wall position, and the config never scatters
// into eleven rooms. One job at a time: taking a new one quits the old.
//
// ── THE WAGES, AGAINST THE RULER ────────────────────────────────────────────
//
// Rent is $500 a season = $17.86 a day; subsistence eating ~$5.50, the barn
// ~$14 (shop.ts's own table). Eight hours at the bottom rung ($3.75–4.25/hr,
// which is also honestly 1997 minimum-wage money) covers a day's rent and
// food with a few dollars left; the college's $10.00/hr pays ~4.5× the
// bodega. The BANK — his "highest" tier — has no row in this table yet
// because its teller window is bespoke; when it hires it slots in at
// ~$12/hr and req INT 10, and nothing else changes.
export const REAPPLY_DAYS = 3;
export const SHIFT_HOURS = 8;

export interface JobDef {
  /** the position, as the application prints it */
  title: string;
  /** the INT the position wants — `jobChance`'s reqInt, 1…10 */
  reqInt: number;
  /** dollars an hour — the number the application states */
  hourly: number;
  /** how the notes name the employer — 'the barn', 'the hotel' */
  at: string;
}

/**
 * THE ONE TABLE, keyed by the shop ids `shopCounter` already coined.
 *
 * ⚠ THE INT COLUMN WAS RAISED WHOLESALE — *"make int required much more for
 * all jobs. lowest int to get a job is 5"* (2026-08-09). The floor is 5 and
 * the whole ladder moved up with it, ending at 10, so the spread still means
 * something. The consequence is deliberate: a fresh average character (INT 5)
 * qualifies for the bottom rung ONLY, and everything above runs through the
 * never-zero small chance — or through the community college, which is now
 * the ladder between the rungs. Wages did not move; the same money just
 * wants a sharper head.
 */
export const JOBS: Record<string, JobDef> = {
  'ct-shop-bodega':  { title: 'COUNTER CLERK',     reqInt: 5,  hourly: 3.75,  at: 'the bodega' },
  'ct-shop-burger':  { title: 'GRILL CREW',        reqInt: 5,  hourly: 4.00,  at: 'the barn' },
  'ct-shop-video':   { title: 'REWIND CLERK',      reqInt: 6,  hourly: 4.25,  at: 'the hut' },
  'ct-shop-thrift':  { title: 'FLOOR CLERK',       reqInt: 6,  hourly: 5.00,  at: 'the thrift store' },
  'ct-shop-diner':   { title: 'LINE COOK',         reqInt: 7,  hourly: 5.50,  at: 'the diner' },
  'ct-shop-gym':     { title: 'DESK TRAINER',      reqInt: 7,  hourly: 6.00,  at: 'the gym' },
  'ct-shop-pawn':    { title: 'COUNTER MAN',       reqInt: 8,  hourly: 6.50,  at: 'the pawn shop' },
  'ct-shop-sleep':   { title: 'MATTRESS SALESMAN', reqInt: 8,  hourly: 7.25,  at: 'the showroom' },
  'ct-shop-volt':    { title: 'FLOOR SALESMAN',    reqInt: 9,  hourly: 7.75,  at: 'VOLT VILLAGE' },
  'ct-shop-hotel':   { title: 'NIGHT CLERK',       reqInt: 9,  hourly: 8.50,  at: 'the hotel' },
  'ct-shop-college': { title: 'ADJUNCT TUTOR',     reqInt: 10, hourly: 10.00, at: 'the college' },
};

// ── the employment record — module state, saved as a slice ─────────────────
//
// `hiredAt` is a JOBS key or null; `lastShiftDay` is the one-working-day gate
// (GLOBAL, one body); `lastOutMin` is when that day's last stretch ended, so
// punching straight back in reads as STAYING ON rather than a second shift;
// `noAskUntil[shop]` is the first day that shop's slip comes off the form.
// NEW GAME needs no line anywhere: the state lives only in the `ct-save`
// blob, which `ct/newgame.ts` wipes whole — stats.ts's rule.
let hiredAt: string | null = null;
let lastShiftDay = -1;
let lastOutMin = -1;
let noAskUntil: Record<string, number> = {};

registerSlice('jobs', {
  capture: () => ({ hiredAt, lastShiftDay, lastOutMin, noAskUntil: { ...noAskUntil } }),
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
    // absent in every save older than opening hours — -1 is "never", not 0,
    // so an old save cannot read midnight of day zero as a punch-out
    if (typeof o.lastOutMin === 'number' && Number.isFinite(o.lastOutMin)) {
      lastOutMin = o.lastOutMin;
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

// ══ THE ANSWER IS ON THE PAPER ═══════════════════════════════════════════════
//
// *"i dont like in general the little non diagetic tips here. just give the
//  response in the view the player is already on. and be honest. \"we need
//  someone sharper\" is funny and good. add more. you can be mean and direct
//  lol. bonus if you make it different based on the location so like in the
//  diner \"come back when you learn how to\" count/write/spell, etc"*
//    (2026-08-09)
//
// SO NO `hudNote` LEAVES THIS APPLICATION. Hired is the HIRED stamp the sheet
// already gets; rejected is the shop's own words written on the POSITION
// FILLED slip, and the slip is the whole message. Two pools per shop, both in
// blunt 1997 shopkeeper voice, mean about your COMPETENCE and never about the
// person:
//
//   `sharp`   drawn when your INT is under the position's bar — the meaner
//             ones, and how "varying degrees of int needed" is discovered
//   `turned`  drawn when you qualified and the dice still said no — the
//             position went to somebody, and the somebody is always a little
//             bit of a racket
//
// The chosen line is SESSION state; over a reload the slip falls back to a
// pick seeded off the cooldown day, so it never goes blank and the save
// format does not change shape for a joke.
interface RejectPool { sharp: string[]; turned: string[] }
const FALLBACK: RejectPool = {
  sharp: ['"WE NEED SOMEBODY SHARPER."'],
  turned: ['"WE WENT WITH SOMEBODY ELSE."'],
};
const REJECT: Record<string, RejectPool> = {
  'ct-shop-bodega': {
    sharp: ['"COME BACK WHEN YOU CAN MAKE CHANGE FOR A TEN."',
            '"WE NEED SOMEBODY WHO CAN COUNT NICKELS."',
            '"WE NEED SOMEBODY SHARPER."'],
    turned: ['"MY COUSIN WANTED THE SHIFTS."',
             '"WE WENT WITH SOMEBODY ELSE."'],
  },
  'ct-shop-burger': {
    sharp: ['"YOU\'D BURN WATER."',
            '"THE FRYER OUTSMARTED THE LAST GUY LIKE YOU."'],
    turned: ['"WE HIRED SOMEBODY WITH THEIR OWN HAIRNET."',
             '"CORPORATE SENT A NEPHEW."'],
  },
  'ct-shop-video': {
    sharp: ['"THE ALPHABET GOES A TO Z. STUDY UP."',
            '"COME BACK WHEN YOU KNOW WHICH END REWINDS."'],
    turned: ['"WE WENT WITH A MEMBER. GET A CARD."',
             '"THE POSITION REWOUND ITSELF. TRY LATER."'],
  },
  'ct-shop-thrift': {
    sharp: ['"YOU FOLDED THE TEST SHIRT INTO A BALL."',
            '"WE NEED SOMEBODY WHO CAN READ A PRICE TAG."'],
    turned: ['"THE CHURCH LADIES OUTVOTED ME."',
             '"WE WENT WITH SOMEBODY ELSE."'],
  },
  'ct-shop-diner': {
    // the flavour he named, verbatim shape: come back when you learn how to…
    sharp: ['"COME BACK WHEN YOU CAN COUNT."',
            '"YOU CAN\'T SPELL \'EGGS\'. IT\'S ON THE MENU."',
            '"COME BACK WHEN YOU LEARN HOW TO WRITE A TICKET."'],
    turned: ['"THE MORNING GIRL\'S BROTHER NEEDED WORK."'],
  },
  'ct-shop-gym': {
    sharp: ['"YOU GOT WINDED FILLING OUT THE FORM."',
            '"WE OPEN AT SIX. YOU DON\'T LOOK LIKE A SIX."'],
    turned: ['"WE WENT WITH A GUY WHO CAN SPOT."'],
  },
  'ct-shop-pawn': {
    sharp: ['"YOU PRICED THE FAKE ROLEX AT $400. IT\'S $12."',
            '"COME BACK WHEN YOU KNOW GOLD FROM BRASS."'],
    turned: ['"MY BROTHER-IN-LAW GOT IT. DON\'T ASK."'],
  },
  'ct-shop-sleep': {
    sharp: ['"YOU CALLED A QUEEN A KING. TWICE."',
            '"WE NEED A CLOSER. YOU\'RE A BROWSER."'],
    turned: ['"WE PROMOTED FROM WITHIN. IT\'S A COT GUY."'],
  },
  'ct-shop-volt': {
    sharp: ['"YOU POINTED AT THE MICROWAVE AND SAID \'COMPUTER\'."',
            '"COME BACK WHEN YOU KNOW RAM FROM A ROM."'],
    turned: ['"WE NEED SOMEBODY CERTIFIED. YOU\'RE NOT."'],
  },
  'ct-shop-hotel': {
    // funny on purpose against the fatigue system — nights are the job
    sharp: ['"YOU YAWNED IN THE INTERVIEW. IT\'S A NIGHT JOB."',
            '"COME BACK WHEN YOU CAN STAY UP PAST TEN."'],
    turned: ['"THE OWNER\'S SON TAKES NIGHTS NOW."'],
  },
  'ct-shop-college': {
    sharp: ['"WE READ YOUR ESSAY. THE ENGLISH DEPT IS STILL LAUGHING."',
            '"COME BACK WHEN \'A LOT\' IS TWO WORDS."'],
    turned: ['"IT WENT TO A GRAD STUDENT WHO WORKS FOR CREDIT."'],
  },
};

/** this session's slip lines, by shop — see the note above */
const slipLine: Record<string, string> = {};
/** the one line the HIRED sheet adds when you walked off another job for it */
let quitNote: string | null = null;

/** what the slip says at this shop right now — the session's pick, or a
 *  stable seeded one after a reload (never blank, never random per frame) */
function lineFor(shopId: string): string {
  if (slipLine[shopId]) return slipLine[shopId];
  const pool = (REJECT[shopId] ?? FALLBACK).turned;
  return pool[(Math.abs(noAskUntil[shopId] ?? 0) + shopId.length) % pool.length];
}

/** what the form should look like right now, at one shop */
type FormState =
  | { kind: 'open' }
  | { kind: 'filled'; wait: number; line: string }   // the slip, its words, days left
  | { kind: 'hired'; note: string | null };

function formState(ctx: CtxBuild, shopId: string): FormState {
  if (hiredAt === shopId) return { kind: 'hired', note: quitNote };
  const wait = (noAskUntil[shopId] ?? 0) - dayNow(ctx);
  return wait > 0
    ? { kind: 'filled', wait, line: lineFor(shopId) }
    : { kind: 'open' };
}

// ── the application, decided — ON THE PAPER, see the pools above ────────────
function submitApplication(ctx: CtxBuild, shopId: string): void {
  const job = JOBS[shopId];
  if (Math.random() < jobChance(job.reqInt)) {
    quitNote = hiredAt && hiredAt !== shopId
      ? `${JOBS[hiredAt].at.toUpperCase()} CAN KEEP THE APRON`
      : null;
    hiredAt = shopId;
  } else {
    noAskUntil[shopId] = dayNow(ctx) + REAPPLY_DAYS;
    const p = REJECT[shopId] ?? FALLBACK;
    const pool = stat('int') < job.reqInt ? p.sharp : p.turned;
    slipLine[shopId] = pool[Math.floor(Math.random() * pool.length)];
  }
}

// ── the shift ───────────────────────────────────────────────────────────────
//
// The college's own arithmetic for time passing at a fixture: `screenFade`
// with the clock SNAPPED in the dark middle (`overSeconds: 0`), 140/90/170,
// because the world going by is the same event wherever it happens.
//
// LENGTH IS `min(8 hours, time until close)` — *"i want to be able to work
// longer as long as the business is open"* — and "longer" is punching the
// clock AGAIN when the stretch ends: within an hour of clocking out the card
// goes straight back in the throat and you work on, so a 6 AM start at the
// gym can run to the 10 PM shutters in two punches, and a 24-hour diner will
// keep taking the card until the fatigue system objects. What it refuses is a
// SECOND shift — walk away for more than the hour and it is tomorrow's clock.
/** how long after clocking out the card still counts as staying on, minutes */
const STAY_ON_MIN = 60;

// ══ AND THE BODY GETS A VOTE ═════════════════════════════════════════════════
//
// *"then if were in we can always work. but you also can work yourself to
//  death/passing out."*   (2026-08-11)
//
// Both halves of that sentence live in `workShift` below. The clock NEVER
// refuses you for being tired — the only refusals left in it are the shop's
// (closed, closing up) and the calendar's (a shift already worked today). What
// the body does instead is CAP THE STRETCH: `ct/fatigue.ts`'s
// `workMinutesLeft()` is how many minutes of work is left in you, and the card
// comes back out of the throat the moment that runs out. Punch in with two
// hours in you and you get a two-hour stretch, two hours' pay, and the floor.
//
// The collapse itself is not built here and must not be: it is the pass-out
// `ct/fatigue.ts` has owned since 2026-08-08 — eight hours gone, 1–10% of the
// cash off you while you are out, a tenth of max health, and you wake wherever
// you last slept. It fires by itself on the frame after this stretch ends,
// because the stretch ended exactly where the margin did. Nothing modal is
// involved anywhere in it, at either end.
//
// The one thing this file owes is that you can FEEL it coming. Two places, and
// both are things you were already reading: the `[E]` prompt on the clock says
// so before you commit, and the punch-out receipt says so after. Everything
// else is the vignette closing in, which is the body's own gauge and not this
// module's business.

/** minutes of work left below which the clock's own prompt warns you */
const SPENT_MIN = 60;

/** what the receipt adds about the state you clocked out in — nothing at all
 *  until the margin is short, and nothing when the floor is about to answer
 *  for itself. `left` is projected: the shift's wear lands during the fade. */
function bodyTail(mins: number): string {
  const left = workMinutesLeft() - mins;
  if (left <= 0) return '';                    // the collapse says it better
  if (left <= SPENT_MIN) return '. you are asleep on your feet.';
  if (left <= 4 * 60) return ". your hands won't hold still.";
  return '';
}

/** '8 hours', '4 hours 30 minutes' — the shift the way the note says it */
function fmtShift(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  const hs = h === 0 ? '' : h === 1 ? '1 hour' : `${h} hours`;
  const ms = m === 0 ? '' : `${m} minutes`;
  return hs && ms ? `${hs} ${ms}` : hs || ms;
}

function workShift(ctx: CtxBuild, shopId: string): void {
  const job = JOBS[shopId];
  const now = ctx.clock.now().totalMin;
  const d = dayNow(ctx);
  // ── THE CLOCK NO LONGER KEEPS THE SHOP'S HOURS ───────────────────────────
  //
  // *"then if were in we can always work."*   (2026-08-11)
  //
  // Two refusals stood here and both are gone. This used to turn you away when
  // the shop was shut, and then cut the shift down to `minsUntilClose` and
  // refuse outright with "closing up — come back tomorrow" if that left under
  // a quarter of an hour. All of it was written when the DOOR did not lock and
  // the services had to hold the line instead.
  //
  // The door holds it now (`ct/hours.ts`, `ct/hours-doors.ts`), so you cannot
  // be standing at this clock unless the shop let you in — and the user's rule
  // for once you are in is the sentence above. A shift is a full shift. Nobody
  // is ejected at closing time and nobody is short-changed for punching in at
  // ten to six.
  //
  // WHAT IS LEFT IS THE SHOP'S OTHER RULE, which has nothing to do with hours:
  // one shift a day, unless you are staying on straight off the last one.
  const stayingOn = lastOutMin >= 0 && now - lastOutMin <= STAY_ON_MIN;
  if (lastShiftDay === d && !stayingOn) {
    hudNote('you have already worked a shift today');
    return;
  }
  // THE SHOP'S HALF is now one number: the shift it advertises on its own
  // application form. Nothing about the clock on the wall shortens it.
  const shopMins = SHIFT_HOURS * 60;
  // THE BODY'S HALF — see the block above. Floored at one minute so that
  // "you can always work" stays literally true right up to the collapse.
  const mins = Math.max(1, Math.min(shopMins, Math.floor(workMinutesLeft())));
  lastShiftDay = d;
  lastOutMin = now + mins;
  // Declared BEFORE the fade starts, so the jump it snaps through is charged
  // as time on your feet instead of being credited as a night's sleep.
  workStretch(mins, job.at);
  void screenFade({
    mid: () => ctx.clock.advance(mins, { overSeconds: 0 }),
    outMs: 140, holdMs: 90, inMs: 170,
  });
  // to the cent: a 4½-hour stretch at $5.50 is $24.75, not $24.749999…
  const pay = Math.round(job.hourly * mins * 100 / 60) / 100;
  ctx.purse.cash += pay;
  ctx.refreshWallet();
  hudNote(`${fmtShift(mins)} at ${job.at} — $${pay.toFixed(2)}, cash${bodyTail(mins)}`);
}

// ══ THE FORM, PAINTED ════════════════════════════════════════════════════════
//
// ONE PAINTER, TWO SURFACES — shop.ts's board rule, kept for the same reason:
// the sheet on the clipboard and the sheet you lean onto are the same piece
// of paper. The only thing the view has that the wall cannot is the wash
// under SIGN AND SUBMIT while your pointer is on it.
//
// The paper is cut at 1000 px/m off its own plane (the loan form's SHEET_PPM,
// and BUILDER-BRIEF §7b's same-both-ways rule): 0.22 × 0.30 m → 220 × 300.
const SHEET_W_M = 0.22, SHEET_H_M = 0.30;
const PPM = 1000;
const SHEET_W = Math.round(SHEET_W_M * PPM), SHEET_H = Math.round(SHEET_H_M * PPM);
/**
 * THE FOOT OF THE SHEET SIGNS NOW — *"i want to sign similar to game start
 * for job app."* (2026-08-09). The mechanic is `ct/signature.ts`'s, one copy
 * for every paper; what is declared here is only this sheet's geometry, and
 * it is DECLARED ONCE and read by the painter AND the hit test (the loan
 * form's BOX rule), so nothing can look pressable and do nothing:
 *
 *   SIG      the blank you draw in, over the rule at its foot
 *   CLR      the ⌫ in the blank's top-right corner, up once there is ink —
 *            clears to re-sign (`paintBackspace`; it replaced a red VOID at
 *            his word, 2026-08-10). Inside the pad, so it is asked FIRST.
 *   SUBMIT   up once the ink counts (`SIG_MIN`) — rolls the application
 *            exactly as SIGN AND SUBMIT's click used to
 */
const SIG = { x0: 24, y0: 210, x1: 196, y1: 246 };
const SIG_MIN = 50;
const SUBMIT = { x: 116, y: 256, w: 80, h: 32 };
const CLR = { x: 176, y: 210, w: 20, h: 16 };
const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const INK = '#2e2a24', DIM = '#6a6458', RED = '#8a2c22', PAPER = '#ece7d6';
/** the applicant's ballpoint — the same blue every signing paper inks in */
const BIRO = '#2b3f7e';

/** greedy word wrap against the current font — the slip's lines are written
 *  by eleven different shopkeepers and none of them measured first */
function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (!cur || g.measureText(t).width <= maxW) cur = t;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

function paintForm(
  g: CanvasRenderingContext2D, W: number, H: number,
  job: JobDef, state: FormState, hover: boolean, pad?: SigPad,
): void {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 3, W, 3);
  g.textBaseline = 'middle';
  // the letterhead
  g.textAlign = 'center';
  g.fillStyle = INK; g.font = 'bold 17px monospace';
  g.fillText('APPLICATION', W / 2, 24);
  g.fillStyle = DIM; g.font = 'bold 10px monospace';
  g.fillText('FOR EMPLOYMENT', W / 2, 41);
  g.fillStyle = RED; g.fillRect(14, 52, W - 28, 2);
  // ── the block he specified: the position, and the HOURLY wage ────────────
  const row = (label: string, val: string, y: number, em = false): void => {
    g.textAlign = 'left'; g.font = 'bold 11px monospace'; g.fillStyle = DIM;
    g.fillText(label, 18, y);
    g.textAlign = 'right';
    g.fillStyle = em ? RED : INK;
    g.font = em ? 'bold 13px monospace' : 'bold 11px monospace';
    g.fillText(val, W - 18, y);
  };
  row('POSITION', job.title, 70);
  row('WAGE', `$${job.hourly.toFixed(2)} / HR`, 89, true);
  // "OR LONGER" is the application stating the overtime rule: shifts run past
  // eight hours now, for as long as the shop is open — see `workShift`
  row('SHIFT', `${SHIFT_HOURS} HRS OR LONGER`, 108);
  g.fillStyle = 'rgba(70,62,50,0.35)'; g.fillRect(14, 121, W - 28, 1);
  // the fields a 1997 form asks for — printed furniture, ruled and labelled
  const field = (label: string, y: number): void => {
    g.textAlign = 'left'; g.fillStyle = DIM; g.font = '8px monospace';
    g.fillText(label, 18, y - 10);
    g.fillStyle = 'rgba(70,62,50,0.55)'; g.fillRect(18, y, W - 36, 1);
  };
  field('NAME', 148); field('ADDRESS', 176); field('LAST POSITION', 204);
  // your biro on the name line — the form is filled in; what's left is to sign
  g.strokeStyle = 'rgba(40,44,92,0.60)'; g.lineWidth = 1.4;
  g.beginPath();
  for (let i = 0; i < 46; i++) {
    const x = 24 + i * 1.6;
    const y = 143 + Math.sin(i * 1.1) * 2.4 + Math.sin(i * 0.31) * 1.4;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();

  if (state.kind === 'hired') {
    // the rubber stamp, skewed the way a hand stamps
    g.save();
    g.translate(W / 2, 172); g.rotate(-0.14);
    g.globalAlpha = 0.85;
    g.strokeStyle = RED; g.lineWidth = 4; g.strokeRect(-74, -26, 148, 52);
    g.fillStyle = RED; g.font = 'bold 30px monospace'; g.textAlign = 'center';
    g.fillText('HIRED', 0, 1);
    g.restore();
    g.fillStyle = DIM; g.font = 'bold 10px monospace'; g.textAlign = 'center';
    g.fillText('REPORT TO THE TIME CLOCK', W / 2, 256);
    // …and if you walked off another payroll for this one, the sheet says so —
    // the strip used to; the paper is the message now
    if (state.note) {
      g.font = 'bold 8px monospace';
      g.fillText(state.note, W / 2, 272);
    }
  } else if (state.kind === 'filled') {
    // ── THE SLIP IS THE WHOLE MESSAGE — see the pools above ────────────────
    // The shop's own words, in the shop's own red, taped over the fields at a
    // working angle. No strip line repeats it; there is nothing to repeat.
    g.save();
    g.translate(W / 2, 170); g.rotate(0.05);
    g.fillStyle = '#f4efdc'; g.fillRect(-92, -34, 184, 68);
    g.strokeStyle = 'rgba(70,62,50,0.45)'; g.lineWidth = 1; g.strokeRect(-92, -34, 184, 68);
    g.fillStyle = RED; g.font = 'bold 10px monospace'; g.textAlign = 'center';
    const lines = wrapText(g, state.line, 168);
    lines.forEach((ln, i) => g.fillText(ln, 0, -18 + i * 12));
    g.fillStyle = DIM; g.font = 'bold 9px monospace';
    g.fillText(`ASK AGAIN IN ${state.wait} DAY${state.wait === 1 ? '' : 'S'}`, 0, 24);
    // the tape
    g.fillStyle = 'rgba(220,214,190,0.8)';
    g.fillRect(-100, -40, 30, 12); g.fillRect(70, 28, 30, 12);
    g.restore();
  } else {
    // ── SIGN IT — the pen's blank, see `SIG` ───────────────────────────────
    g.fillStyle = 'rgba(70,62,50,0.55)';
    g.fillRect(SIG.x0, 244, SIG.x1 - SIG.x0, 1);
    g.textAlign = 'left'; g.fillStyle = DIM; g.font = '8px monospace';
    g.fillText('APPLICANT', 70, 264);
    // the ⌫ once there is ink to clear; SUBMIT once the ink counts. Neither
    // is drawn before it is live — the sheet's own no-dead-buttons rule.
    if (pad && !pad.blank()) paintBackspace(g, CLR.x + 4, CLR.y + 3, RED);
    if (pad?.signed()) {
      if (hover) { g.fillStyle = 'rgba(138,44,34,0.12)'; g.fillRect(SUBMIT.x, SUBMIT.y, SUBMIT.w, SUBMIT.h); }
      g.strokeStyle = RED; g.lineWidth = 2;
      g.strokeRect(SUBMIT.x, SUBMIT.y, SUBMIT.w, SUBMIT.h);
      g.fillStyle = RED; g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText('SUBMIT', SUBMIT.x + SUBMIT.w / 2, SUBMIT.y + SUBMIT.h / 2 + 1);
    }
    // the ink, last, so the pen lies over the print
    pad?.paint(g, BIRO);
  }
  dither(g, W, H, Math.round((W * H) / 1400));
}

// ══ THE STATION — ONE CALL PER INTERIOR ══════════════════════════════════════
//
// A ~1.5 m section of wall: HELP WANTED card over the clipboard on the left,
// the punch clock and its card rack on the right. The caller hands over a
// LOCAL wall position (the section's centre, on the wall face like a sign)
// and which way the wall looks; everything else — geometry, the form panel,
// both [E] spots — is built here, once, for all eleven shops.
//
// Nothing stands proud of the wall by more than 0.13 m, so the section needs
// no collider and cannot pinch a lane — it is wall furniture, like a sign.

export interface StationAt {
  /** the section's centre, LOCAL, on the wall face (proud like a sign) */
  x: number; z: number;
  /** which way the wall looks into the room; 0 faces +z, like `room.sign` */
  rotY?: number;
}

export function jobStation(ctx: CtxBuild, room: Room, shopId: string, at: StationAt): void {
  const job = JOBS[shopId];
  if (!job) {
    console.warn(`[jobs] no position in the table for '${shopId}' — building nothing.`);
    return;
  }
  const rotY = at.rotY ?? 0;
  // the wall's outward normal and its rightward tangent, off rotY alone
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  const tx = Math.cos(rotY), tz = -Math.sin(rotY);
  /** local coords `along` the wall and `proud` of it */
  const lx = (along: number, proud: number) => at.x + tx * along + nx * proud;
  const lz = (along: number, proud: number) => at.z + tz * along + nz * proud;
  const APP = -0.40, CLK = 0.30, RACK = 0.66;   // the three columns, along the wall

  // ── HELP WANTED, the card that names the section ──────────────────────────
  const cardT = declareSurface(pixTex(64, 18, (g) => {
    g.fillStyle = '#f0e9d2'; g.fillRect(0, 0, 64, 18);
    g.fillStyle = RED; g.fillRect(0, 0, 64, 2); g.fillRect(0, 16, 64, 2);
    g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = RED; g.fillText('HELP WANTED', 32, 9);
    dither(g, 64, 18, 6);
  }), 'sign');
  room.sign(cardT, 0.46, 0.13, lx(APP, 0.015), 1.86, lz(APP, 0.015), rotY);

  // ── the clipboard, and the paper on it ────────────────────────────────────
  const boardM = new THREE.MeshBasicMaterial({ color: 0x6a4a2a });
  const clipM = new THREE.MeshBasicMaterial({ color: 0x8a8f93 });
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.42, 0.018), boardM);
  cb.rotation.y = rotY;
  const cbMesh = room.put(cb, lx(APP, 0.02), 1.44, lz(APP, 0.02));
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.030), clipM);
  clip.rotation.y = rotY;
  room.put(clip, lx(APP, 0.028), 1.63, lz(APP, 0.028));
  // THE SHEET — the same painter the panel uses, at the same canvas size,
  // shop.ts's one-painter rule: the paper cannot say one thing on the wall
  // and another in your hands. (The wall copy is painted at build in the
  // blank OPEN state; the slip and the stamp are session state, read at
  // panel size, where you read them.)
  const sheetT = declareSurface(pixTex(SHEET_W, SHEET_H, (g) =>
    paintForm(g, SHEET_W, SHEET_H, job, { kind: 'open' }, false)), 'sign');
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W_M, SHEET_H_M), ctx.flat(sheetT));
  sheet.rotation.y = rotY;
  const sheetMesh = room.put(sheet, lx(APP, 0.032), 1.42, lz(APP, 0.032));

  // ── the panel: you lean onto the paper, the loan form's grammar ───────────
  //
  // THE PEN IS `ct/signature.ts`'s — one pad per station, cleared on every
  // open so each application is signed fresh. The panel's `click` is really
  // mousedown (`ct/hud.ts`'s gate), which is exactly what a pen wants.
  let panel: Panel | null = null;
  let hover = false;
  const pad = makeSigPad(SIG, SIG_MIN);
  const roll = (): void => {
    submitApplication(ctx, shopId);
    pad.clear();               // the sheet under the stamp or slip is a fresh one
    panel?.repaint();
  };
  const open = (): void => {
    if (!panel) {
      panel = makePanel({
        id: `ct-job-${shopId.slice('ct-shop-'.length)}`,
        w: SHEET_W, h: SHEET_H, chrome: 'none',
        hint: () => {
          const s = formState(ctx, shopId);
          if (s.kind === 'hired') return 'yours already — ESC  step back';
          if (s.kind === 'filled') return 'ESC  step back';
          return pad.signed()
            ? 'SUBMIT it   ·   ENTER   ·   ESC  step back'
            : 'sign on the line   ·   ENTER  signs for you   ·   ESC  step back';
        },
        draw: (g, W, H) => paintForm(g, W, H, job, formState(ctx, shopId), hover, pad),
        // ENTER SIGNS AND SUBMITS — the keyboard's whole path, auto-scrawling
        // first if the line is blank. The no-trap rule outranks the flourish.
        key: (k) => {
          if (k !== 'enter' || formState(ctx, shopId).kind !== 'open') return;
          if (!pad.signed()) pad.autoScrawl();
          roll();
        },
        surface: {
          mesh: () => sheetMesh,
          // a reading distance off a vertical sheet at chest height — derived
          // from the sheet's own metres, not typed (shop.ts's boardStandoff)
          standoff: boardStandoff({ wM: SHEET_W_M, hM: SHEET_H_M, fov: 45, riseM: 0 }),
          fov: 45,
          hot: (x, y) => {
            if (formState(ctx, shopId).kind !== 'open') return false;
            return (x >= SIG.x0 && x < SIG.x1 && y >= SIG.y0 && y <= SIG.y1)
              || (pad.signed() && inRect(SUBMIT, x, y))
              || (!pad.blank() && inRect(CLR, x, y));
          },
          move: (x, y) => {
            if (pad.move(x, y)) { panel?.repaint(); return; }
            const h = formState(ctx, shopId).kind === 'open'
              && pad.signed() && inRect(SUBMIT, x, y);
            if (h !== hover) { hover = h; panel?.repaint(); }
          },
          // mousedown, by the gate's own dispatch: void, submit, or pen down
          click: (x, y) => {
            if (formState(ctx, shopId).kind !== 'open') return;
            if (!pad.blank() && inRect(CLR, x, y)) { pad.clear(); panel?.repaint(); return; }
            if (pad.signed() && inRect(SUBMIT, x, y)) { roll(); return; }
            if (pad.down(x, y)) panel?.repaint();
          },
          up: () => { pad.up(); },
        },
        onOpen: () => { hover = false; pad.clear(); },
        onClose: () => { hover = false; pad.up(); },
      });
    }
    panel.open();
  };
  ctx.spot({
    x: room.wx(lx(APP, 0.75)), z: room.wz(lz(APP, 0.75)),
    aimX: room.wx(lx(APP, 0)), aimZ: room.wz(lz(APP, 0)),
    r: 0.9, obj: cbMesh,
    ok: room.inside,
    label: () => 'apply',
    act: open,
  });

  // ── the punch clock ────────────────────────────────────────────────────────
  const steelM = new THREE.MeshBasicMaterial({ color: 0x74787c });
  const bodyM = new THREE.MeshBasicMaterial({ color: 0x2e3134 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.12), bodyM);
  body.rotation.y = rotY;
  const clockMesh = room.put(body, lx(CLK, 0.06), 1.55, lz(CLK, 0.06));
  // the dome bell on top — the thing that makes it a punch clock at a glance
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.035, 10), steelM);
  room.put(bell, lx(CLK, 0.06), 1.75, lz(CLK, 0.06));
  // a REAL face, on the kit, so it tells the time like every clock in town
  room.clock({ lx: lx(CLK, 0.125), y: 1.60, lz: lz(CLK, 0.125), r: 0.075, rotY });
  // the card throat, under the face
  const throat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.03), steelM);
  throat.rotation.y = rotY;
  room.put(throat, lx(CLK, 0.125), 1.44, lz(CLK, 0.125));
  // the rack of time cards beside it — painted, one plane, read at arm's length
  const rackT = declareSurface(pixTex(40, 60, (g) => {
    g.fillStyle = '#5a4228'; g.fillRect(0, 0, 40, 60);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 58, 40, 2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const x = 5 + c * 17, y = 5 + r * 14;
      g.fillStyle = '#3a2c1c'; g.fillRect(x - 1, y + 5, 15, 6);      // the pocket
      g.fillStyle = c === 0 && r === 1 ? '#e8e2cc' : '#d8d2ba';      // the cards
      g.fillRect(x, y, 13, 9);
      g.fillStyle = 'rgba(70,62,50,0.5)'; g.fillRect(x + 2, y + 2, 9, 1);
    }
    dither(g, 40, 60, 10);
  }), 'detail');
  const rack = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.36), ctx.flat(rackT));
  rack.rotation.y = rotY;
  room.put(rack, lx(RACK, 0.02), 1.50, lz(RACK, 0.02));

  // [E] work — one word, like sleep, and only where you are on the payroll.
  // It says nothing about opening hours any more: the door you came through
  // already settled that, and *"if were in we can always work"* (ct/hours.ts).
  ctx.spot({
    x: room.wx(lx(CLK, 0.75)), z: room.wz(lz(CLK, 0.75)),
    aimX: room.wx(lx(CLK, 0)), aimZ: room.wz(lz(CLK, 0)),
    r: 0.9, obj: clockMesh,
    ok: () => room.inside() && hiredAt === shopId,
    // …and when there is under an hour of work left in you the prompt says so
    // BEFORE you press it — the one warning you get while you can still act on
    // it. It never refuses; it only tells you what the stretch will be.
    label: () => (workMinutesLeft() <= SPENT_MIN ? 'work — you can barely stand' : 'work'),
    act: () => workShift(ctx, shopId),
  });
}
