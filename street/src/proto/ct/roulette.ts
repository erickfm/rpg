// ORPHEUS CASINO — the roulette wheel.
//
// 2026-08-09, Erick: "there should be black jack and roulette as table games…
// fun should be optimized in the casino." So this is roulette with the fat
// trimmed and the show kept: FOUR SIMPLE BETS — red/black, odd/even, one
// straight number — and a wheel you WATCH: the ball whips round the rim
// against the spin, dies, drops, bounces twice and rides its pocket home.
// The watching is the game; everything else is one keypress.
//
// ─────────────────────────────────────────────────────────────────────────────
// PART ONE: THE MATHS — which for roulette fits on a napkin, and that napkin
// is the whole reason the game is here as the slots' counterweight.
//
//   EUROPEAN SINGLE-ZERO wheel, 37 pockets. The American double-zero eats
//   5.26% of every bet; the single zero eats 2.70%. Fun-positive, his call.
//
//   RTP 97.30% on EVERY bet this table offers — that is the elegance of
//   roulette and it is exact, not tuned:
//     red/black/odd/even   pay 1:1    win 18/37 of spins
//     straight number      pays 35:1  win  1/37 of spins
//   (18/37)·2 = (1/37)·36 = 36/37 = 0.97297…
//
//   Against the slots' 94.97% and blackjack's 99.55% the floor now runs a
//   proper ladder: the flashiest game keeps the most, the game that rewards
//   knowing what you are doing keeps the least.
//
// THE DRAW IS ONE UNIFORM INTEGER IN [0, 37), taken the moment you press
// SPIN, before anything moves — the five seconds of ball are presentation of
// a decision already made, exactly the slots' anticipation contract. And it
// is Math.random, never ct/rng.ts (GOTCHAS §2: the seeded stream's draw order
// plants every tree in the world).

import type * as THREE from 'three';
import type { Paint2D } from './slots';
import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';

/** After blackjack, so the casino's games register in a stable order. */
export const ORDER = BUILD.INTERIOR + 7;

/**
 * THE SEAT THIS OPENS AT. ct/int-casino.ts puts four stools round the west
 * pit table and IMPORTS this constant for their label — the same bridge, and
 * the same one-authoring rule, as blackjack's SEAT_LABEL (see that docstring
 * for why a label and not a callback). No cycle: this module imports only
 * ./ctx at runtime, and ./hud + ./slots dynamically, never the casino.
 */
export const SEAT_LABEL = 'sit at the roulette wheel';

/** The physical wheel's pocket ring, in EUROPEAN WHEEL ORDER — the order the
 *  numbers actually sit round a single-zero wheel, so the painted wheel is
 *  the real object and a near-miss neighbour is the true neighbour. */
export const WHEEL: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const POCKETS = WHEEL.length;                       // 37

/** The red numbers, as printed on every layout since the 1800s. */
export const REDS: ReadonlySet<number> = new Set(
  [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type BetKind = 'red' | 'black' | 'odd' | 'even' | 'number';
export const BET_KINDS: readonly BetKind[] = ['red', 'black', 'odd', 'even', 'number'];

/** Does pocket `n` win a bet? Zero beats every outside bet — that is the
 *  house's whole 2.7%. */
export function wins(kind: BetKind, pick: number, n: number): boolean {
  if (kind === 'number') return n === pick;
  if (n === 0) return false;
  if (kind === 'red') return REDS.has(n);
  if (kind === 'black') return !REDS.has(n);
  if (kind === 'odd') return n % 2 === 1;
  return n % 2 === 0;
}

/** Total returned to the rail on a win, INCLUDING the stake. */
export const payout = (kind: BetKind, bet: number): number =>
  kind === 'number' ? bet * 36 : bet * 2;

export type Rng = () => number;

// ─────────────────────────────────────────────────────────────────────────────
// PART TWO: THE TABLE — a state machine advanced by dt, same contract as the
// slot machine and the blackjack table: chips exist between sitting down and
// standing up, cashOut always empties the rail, a bet already spinning is
// gone. Everything the wheel does is a CLOSED FORM of the time since SPIN —
// no integration, so any dt lands the ball in the same place (GOTCHAS §30/§43).

export const PACE = {
  /** the whole show, press to rest */
  total: 6.0,
  /** ball leaves the rim and starts falling toward the pockets */
  drop: 3.4,
  /** ball is IN its pocket from here, riding the wheel */
  lock: 4.9,
  /** how long the result sits before the chips move */
  settle: 1.2,
  /** chips a second once they move; scaled up so a 35:1 hit is seconds, not a
   *  minute — the count is the celebration, not a delay */
  payRate: (owed: number) => Math.max(14, owed / 2.2),
};

/** Wheel angle in revolutions at t seconds after SPIN: eases from fast to a
 *  lazy cruise and never stops — a roulette wheel is always turning. */
const wheelRev = (t: number): number =>
  0.30 * t + (1.05 - 0.30) * 1.9 * (1 - Math.exp(-t / 1.9));

/** The ball's base run, in revolutions, OPPOSITE the wheel: launched hard,
 *  dying exponentially toward a slow terminal roll. */
const ballRev = (t: number): number =>
  -(0.45 * t + (3.1 - 0.45) * 1.35 * (1 - Math.exp(-t / 1.35)));

const TAU = Math.PI * 2;
const smooth = (u: number): number => { const k = Math.min(1, Math.max(0, u)); return k * k * (3 - 2 * k); };

export type Phase = 'betting' | 'spinning' | 'settle' | 'paying';

export interface WheelView {
  /** wheel rotation, radians */
  readonly wheelA: number;
  /** ball angle, radians, absolute (same frame as wheelA) */
  readonly ballA: number;
  /** ball's radial position, 1 at the rim to 0 in the pocket */
  readonly ballR: number;
}

export interface TableView {
  readonly phase: Phase;
  readonly chips: number;
  readonly bet: number;
  readonly kind: BetKind;
  readonly pick: number;              // the straight number, 0..36
  readonly t: number;                 // seconds since SPIN (this round)
  readonly result: number | null;     // the pocket, once phase >= settle
  readonly won: boolean;
  readonly history: readonly number[];
  readonly paid: number;
  readonly staked: number;
  readonly returned: number;
  readonly says: string;
  readonly wheel: WheelView;
}

export interface Table {
  view(): TableView;
  tick(dt: number): void;
  betBy(d: number): void;
  /** move the bet-kind selector */
  kindBy(d: number): void;
  kindSet(k: BetKind): void;
  /** change the straight number */
  pickBy(d: number): void;
  /** put the chip ON a number — the layout's own verb, for a clicked cell */
  pickSet(n: number): void;
  spin(): boolean;
  buyIn(chips: number): void;
  cashOut(): number;
  settled(): boolean;
}

const BETS = [1, 2, 5, 10, 25];

export function createTable(opts: { rng?: Rng } = {}): Table {
  const rng = opts.rng ?? Math.random;
  let phase: Phase = 'betting';
  let chips = 0, betIx = 1, kindIx = 0, pick = 17;
  let t = 0, wheelBase = 0;           // wheel angle carries over between rounds
  let result: number | null = null, won = false;
  let ballCorrection = 0, pocketIx = 0;
  let owed = 0, paid = 0, payRamp = 0, phaseT = 0;
  let staked = 0, returned = 0;
  const history: number[] = [];

  /** where the wheel is pointing right now, radians — keeps turning idly so
   *  the room's wheel head never freezes */
  const wheelA = (): number => wheelBase + (phase === 'spinning' || phase === 'settle'
    ? wheelRev(t) * TAU : 0.12 * TAU * t + 0);

  // Between rounds t keeps advancing (see tick) so the idle wheel drifts;
  // wheelBase absorbs the angle at each transition so nothing jumps.

  const view = (): TableView => {
    let ballA: number, ballR: number;
    const wA = wheelA();
    if (phase === 'spinning' || phase === 'settle' || phase === 'paying') {
      const tt = Math.min(t, PACE.total);
      if (tt >= PACE.lock || phase !== 'spinning') {
        // riding home in its pocket
        ballA = wA + (pocketIx / POCKETS) * TAU;
        ballR = 0;
      } else {
        ballA = ballRev(tt) * TAU + ballCorrection * smooth(tt / PACE.lock);
        const k = smooth((tt - PACE.drop) / (PACE.lock - PACE.drop));
        // two dying bounces on the way down — the sound Erick will hang here
        const bounce = tt > PACE.drop
          ? Math.abs(Math.sin((tt - PACE.drop) * 11)) * Math.exp(-2.6 * (tt - PACE.drop)) * 0.25
          : 0;
        ballR = 1 - k + bounce;
      }
    } else {
      ballA = wA + (pocketIx / POCKETS) * TAU;    // resting where it last landed
      ballR = 0;
    }
    return {
      phase, chips, bet: BETS[betIx], kind: BET_KINDS[kindIx], pick,
      t, result, won, history, paid, staked, returned, says: says(),
      wheel: { wheelA: wA, ballA, ballR },
    };
  };

  const says = (): string => {
    if (phase === 'betting') {
      if (chips < BETS[betIx]) return 'BUY IN TO PLAY';
      const k = BET_KINDS[kindIx];
      return `${BETS[betIx]} ON ${k === 'number' ? `NUMBER ${pick}` : k.toUpperCase()} — SPIN THE WHEEL`;
    }
    if (phase === 'spinning') return t < PACE.drop ? 'NO MORE BETS' : '…';
    if (result === null) return '';
    const colour = result === 0 ? 'GREEN' : REDS.has(result) ? 'RED' : 'BLACK';
    return won ? `${colour} ${result} — YOU WIN ${owed}` : `${colour} ${result}`;
  };

  const spin = (): boolean => {
    if (phase !== 'betting') return false;
    const bet = BETS[betIx];
    if (chips < bet) return false;
    chips -= bet; staked += bet;
    // THE DRAW, now, before anything moves.
    pocketIx = Math.min(POCKETS - 1, Math.floor(rng() * POCKETS));
    result = null; won = false; paid = 0; payRamp = 0; owed = 0;
    wheelBase = wheelA(); t = 0; phase = 'spinning'; phaseT = 0;
    // Solve the ball's final correction: at lock it must sit over pocketIx in
    // the wheel's frame. Base run minus requirement, folded to (−π, π] so the
    // fix is invisible inside five revolutions of decay.
    const need = wheelBase + wheelRev(PACE.lock) * TAU + (pocketIx / POCKETS) * TAU;
    const base = ballRev(PACE.lock) * TAU;
    let d = (need - base) % TAU;
    if (d <= -Math.PI) d += TAU; else if (d > Math.PI) d -= TAU;
    ballCorrection = d;
    return true;
  };

  const tick = (dt: number): void => {
    if (!(dt > 0)) return;
    t += dt; phaseT += dt;
    if (phase === 'spinning') {
      if (t < PACE.total) return;
      const n = WHEEL[pocketIx];
      result = n;
      won = wins(BET_KINDS[kindIx], pick, n);
      owed = won ? payout(BET_KINDS[kindIx], BETS[betIx]) : 0;
      history.unshift(n);
      if (history.length > 8) history.pop();
      phase = 'settle'; phaseT = 0;
      return;
    }
    if (phase === 'settle') {
      if (phaseT < PACE.settle) return;
      if (owed <= 0) { endRound(); return; }
      phase = 'paying'; payRamp = 0; paid = 0;
      return;
    }
    if (phase === 'paying') {
      payRamp = Math.min(owed, payRamp + PACE.payRate(owed) * dt);
      const whole = Math.min(owed, Math.floor(payRamp));
      chips += whole - paid; paid = whole;
      if (payRamp >= owed) {
        chips += owed - paid; paid = owed; returned += owed;
        endRound();
      }
      return;
    }
  };

  const endRound = (): void => {
    wheelBase = wheelA(); t = 0;
    phase = 'betting'; phaseT = 0;
  };

  return {
    view, tick, spin,
    betBy: (d) => { if (phase === 'betting') betIx = Math.max(0, Math.min(BETS.length - 1, betIx + d)); },
    kindBy: (d) => { if (phase === 'betting') kindIx = (kindIx + d + BET_KINDS.length) % BET_KINDS.length; },
    kindSet: (k) => { if (phase === 'betting') kindIx = Math.max(0, BET_KINDS.indexOf(k)); },
    pickBy: (d) => { if (phase === 'betting') { pick = (pick + d + POCKETS) % POCKETS; kindIx = BET_KINDS.indexOf('number'); } },
    pickSet: (n) => { if (phase === 'betting' && n >= 0 && n < POCKETS) { pick = n; kindIx = BET_KINDS.indexOf('number'); } },
    buyIn: (n) => { if (n > 0 && phase === 'betting') chips += Math.floor(n); },
    cashOut: () => {
      // Whatever is ON THE RAIL always comes back, whenever you stand up. A
      // bet already spinning is gone — same contract as both other games.
      const n = chips; chips = 0;
      if (phase !== 'betting') { wheelBase = wheelA(); t = 0; }
      phase = 'betting'; owed = 0; paid = 0; payRamp = 0; result = null;
      return n;
    },
    settled: () => phase === 'betting',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART THREE: THE BAIZE — a pure function of (view, cash), painted small and
// scaled up, no Math.random anywhere (GOTCHAS §1: the paint layer's dither is
// why screenshots cannot be diffed; this panel CAN be).
//
// 2026-08-09: *"blackjack and roulettte need to be diagetic similar to all the
// other locked perspective UIs."* So this canvas is no longer a picture of a
// roulette table — it is the TABLETOP, hung on the `roulette-felt` mesh
// ct/int-casino.ts names for it, viewed from a lock straight down. The table
// is seen SIDE-ON: printed layout at the left (the foot, where you sit), the
// REAL 3D wheel standing at the right — the painter draws only its apron ring
// and leaves the show to the world's own wheel head, which PART FOUR turns.
// The layout is where chips go, his exact bet set: click a number, RED/BLACK/
// ODD/EVEN, then click the wheel itself to send the ball. `paintTable(g, w,
// h, null)` is the same baize with nothing live on it — the world texture, so
// printed and played are one painter.

/** The tabletop canvas: 480 × 292 over the 1.94 × 1.18 m felt is the same
 *  aspect (1.644) at ~247 px/m — BUILDER-BRIEF §7b's same-both-ways rule. */
export const FELT = { w: 480, h: 292 } as const;

const T = {
  felt: '#1e5a3e', feltLo: '#17462f', feltHi: '#2a6d4c',
  rail: '#3a2226', railHi: '#54353a',
  red: '#c8342c', black: '#16120e', green: '#1e7c3c',
  gold: '#d8a83a', goldLo: '#8a6a22',
  ivory: '#ece6d4', ink: '#e8e2d0', dim: '#9ab0a0',
  chip: '#c9a45e', win: '#fff0bc',
} as const;

/**
 * Where everything sits on the baize, exported so a check can ask rather than
 * hand-type pixels (GOTCHAS §20). `wheel` is the footprint of the REAL wheel's
 * wooden rim (r 0.46 m at 0.57 m from the mesh centre, in canvas px) — the
 * painter keeps clear of it and the click handler reads "on the wheel" from
 * it. Declared once, read by the painter AND `feltHit` (the loan form's rule).
 */
export const LAY = {
  wheel: { x: 381, y: 146, r: 114 },
  /** the 0 cell, then 12 rows × 3 columns, n = 3·row + col + 1 */
  grid: { x: 14, y: 50, colW: 40, rowH: 19, zeroY: 30, zeroH: 16 },
  /** RED / BLACK / ODD / EVEN, stacked */
  outside: { x: 142, y: 30, w: 110, h: 58, gap: 4 },
  say: { x: 8, y: 6, w: 244, h: 18 },
  hist: { x: 262, y: 6, w: 24, h: 16, step: 26 },
  chips: { x: 262, y: 264, w: 104, h: 24 },
  betDown: { x: 374, y: 264, w: 20, h: 24 },
  bet: { x: 398, y: 264, w: 50, h: 24 },
  betUp: { x: 452, y: 264, w: 20, h: 24 },
} as const;

/** What a click at (x, y) on the baize means. One table of regions for the
 *  painter and the pointer both — a spot that looks pressable and does
 *  nothing is the fault this shape exists to prevent. */
export type FeltHit =
  | { kind: 'bet'; bet: BetKind }
  | { kind: 'pick'; n: number }
  | { kind: 'spin' }
  | { kind: 'betBy'; d: 1 | -1 };
export function feltHit(x: number, y: number): FeltHit | null {
  // the wheel IS the spin button — the ray lands on the felt under it, so a
  // click "on the wheel" arrives here even though the head is its own mesh
  if (Math.hypot(x - LAY.wheel.x, y - LAY.wheel.y) <= LAY.wheel.r) return { kind: 'spin' };
  const gd = LAY.grid;
  if (x >= gd.x && x < gd.x + 3 * gd.colW - 2) {
    if (y >= gd.zeroY && y < gd.zeroY + gd.zeroH) return { kind: 'pick', n: 0 };
    if (y >= gd.y && y < gd.y + 12 * gd.rowH) {
      const r = Math.floor((y - gd.y) / gd.rowH);
      const c = Math.min(2, Math.floor((x - gd.x) / gd.colW));
      return { kind: 'pick', n: r * 3 + c + 1 };
    }
  }
  const o = LAY.outside;
  if (x >= o.x && x < o.x + o.w) {
    for (let i = 0; i < 4; i++) {
      const oy = o.y + i * (o.h + o.gap);
      if (y >= oy && y < oy + o.h) {
        return { kind: 'bet', bet: (['red', 'black', 'odd', 'even'] as const)[i] };
      }
    }
  }
  const inBox = (b: { x: number; y: number; w: number; h: number }) =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  if (inBox(LAY.betDown)) return { kind: 'betBy', d: -1 };
  if (inBox(LAY.betUp)) return { kind: 'betBy', d: 1 };
  return null;
}

export function paintTable(g: Paint2D, w: number, h: number, v: TableView | null, cash?: number): void {
  const s = Math.max(0.1, Math.min(w / FELT.w, h / FELT.h));
  g.save();
  g.fillStyle = T.felt; g.fillRect(0, 0, w, h);
  g.translate((w - FELT.w * s) / 2, (h - FELT.h * s) / 2);
  g.scale(s, s);

  // the baize, with a printed border line where the wood begins
  g.fillStyle = T.felt; g.fillRect(0, 0, FELT.w, FELT.h);
  g.fillStyle = T.feltHi;
  g.fillRect(4, 4, FELT.w - 8, 1); g.fillRect(4, 4, 1, FELT.h - 8);
  g.fillRect(FELT.w - 5, 4, 1, FELT.h - 8);
  g.fillStyle = T.feltLo; g.fillRect(4, FELT.h - 5, FELT.w - 8, 1);

  // ── the wheel's apron: a darker well and a gold ring where the real wheel
  //    stands. The wheel itself is the world's, turned by PART FOUR. ──
  g.fillStyle = T.feltLo;
  g.beginPath(); g.arc(LAY.wheel.x, LAY.wheel.y, LAY.wheel.r + 3, 0, TAU); g.fill();
  g.fillStyle = T.goldLo;
  g.beginPath(); g.arc(LAY.wheel.x, LAY.wheel.y, LAY.wheel.r + 3, 0, TAU);
  g.arc(LAY.wheel.x, LAY.wheel.y, LAY.wheel.r + 1, 0, TAU, true); g.fill();

  // ── the printed layout: 0 over a 12 × 3 grid, big enough to click ──
  const gd = LAY.grid;
  const cellW = gd.colW - 2, gridW = 3 * gd.colW - 2;
  g.fillStyle = T.green; g.fillRect(gd.x, gd.zeroY, gridW, gd.zeroH - 2);
  g.fillStyle = T.ivory; g.font = 'bold 10px monospace'; g.textAlign = 'center';
  g.fillText('0', gd.x + gridW / 2, gd.zeroY + 11);
  for (let n = 1; n <= 36; n++) {
    const r = Math.floor((n - 1) / 3), c = (n - 1) % 3;
    const cx = gd.x + c * gd.colW, cy = gd.y + r * gd.rowH;
    g.fillStyle = REDS.has(n) ? T.red : T.black;
    g.fillRect(cx, cy, cellW, gd.rowH - 2);
    g.fillStyle = T.ivory; g.font = 'bold 10px monospace';
    g.fillText(String(n), cx + cellW / 2, cy + 13);
  }
  g.fillStyle = T.dim; g.font = '8px monospace';
  g.fillText('STRAIGHT UP PAYS 35:1', gd.x + gridW / 2, gd.y + 12 * gd.rowH + 9);

  // ── the even-money boxes ──
  const OUTS: { bet: BetKind; label: string }[] = [
    { bet: 'red', label: 'RED' }, { bet: 'black', label: 'BLACK' },
    { bet: 'odd', label: 'ODD' }, { bet: 'even', label: 'EVEN' },
  ];
  OUTS.forEach((o, i) => {
    const oy = LAY.outside.y + i * (LAY.outside.h + LAY.outside.gap);
    g.fillStyle = T.feltLo;
    g.fillRect(LAY.outside.x, oy, LAY.outside.w, LAY.outside.h);
    g.strokeStyle = 'rgba(216,208,192,0.55)'; g.lineWidth = 1;
    g.strokeRect(LAY.outside.x + 0.5, oy + 0.5, LAY.outside.w - 1, LAY.outside.h - 1);
    const mx = LAY.outside.x + LAY.outside.w / 2;
    if (o.bet === 'red' || o.bet === 'black') {
      // the colour diamond a real layout prints, stacked from fillRects the
      // way the card pips are — Paint2D has no lineTo
      g.fillStyle = o.bet === 'red' ? T.red : T.black;
      for (let i2 = 0; i2 < 8; i2++) {
        const half = i2 < 4 ? i2 * 3 + 2 : (7 - i2) * 3 + 2;
        g.fillRect(mx - half, oy + 8 + i2 * 3, half * 2, 3);
      }
      g.fillStyle = T.ivory; g.font = 'bold 11px monospace'; g.textAlign = 'center';
      g.fillText(o.label, mx, oy + 44);
    } else {
      g.fillStyle = T.ivory; g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText(o.label, mx, oy + 30);
    }
    g.fillStyle = T.dim; g.font = '8px monospace';
    g.fillText('PAYS 1 TO 1', mx, oy + LAY.outside.h - 6);
  });

  // ── the last eight, printed by the wheel, newest first ──
  for (let i = 0; i < 8; i++) {
    const hx = LAY.hist.x + i * LAY.hist.step;
    const n = v?.history[i];
    if (n === undefined) {
      g.strokeStyle = 'rgba(216,208,192,0.30)'; g.lineWidth = 1;
      g.strokeRect(hx + 0.5, LAY.hist.y + 0.5, LAY.hist.w - 1, LAY.hist.h - 1);
    } else {
      g.fillStyle = n === 0 ? T.green : REDS.has(n) ? T.red : T.black;
      g.fillRect(hx, LAY.hist.y, LAY.hist.w, LAY.hist.h);
      g.fillStyle = T.ivory; g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText(String(n), hx + LAY.hist.w / 2, LAY.hist.y + 12);
    }
  }

  // ── what the table is saying ──
  g.fillStyle = T.feltLo; g.fillRect(LAY.say.x, LAY.say.y, LAY.say.w, LAY.say.h);
  g.fillStyle = T.feltHi; g.fillRect(LAY.say.x, LAY.say.y, LAY.say.w, 1);
  g.textAlign = 'center'; g.font = '9px monospace';
  if (v) {
    g.fillStyle = v.phase === 'settle' || v.phase === 'paying'
      ? (v.won ? T.win : T.dim) : T.dim;
    const CHIP_HINT = 1;
    const line = (v.phase === 'betting' && v.chips < v.bet
      && cash !== undefined && cash < CHIP_HINT) ? 'NO CASH IN YOUR POCKETS' : v.says;
    if (line) g.fillText(line, LAY.say.x + LAY.say.w / 2, LAY.say.y + 13);
  } else {
    g.fillStyle = T.dim;
    g.fillText('EUROPEAN ROULETTE — SINGLE ZERO', LAY.say.x + LAY.say.w / 2, LAY.say.y + 13);
  }

  // ── meters and the bet chips, let into the felt by the wheel ──
  const meter = (mx: number, mw: number, label: string, val: string, lit: boolean) => {
    g.fillStyle = '#12180f'; g.fillRect(mx, LAY.chips.y, mw, LAY.chips.h);
    g.strokeStyle = T.railHi; g.lineWidth = 1;
    g.strokeRect(mx + 0.5, LAY.chips.y + 0.5, mw - 1, LAY.chips.h - 1);
    g.fillStyle = '#2c4a24'; g.font = '7px monospace'; g.textAlign = 'left';
    g.fillText(label, mx + 4, LAY.chips.y + 16);
    g.fillStyle = lit ? T.win : '#7ae05a';
    g.font = 'bold 12px monospace'; g.textAlign = 'right';
    g.fillText(val, mx + mw - 4, LAY.chips.y + 17);
  };
  meter(LAY.chips.x, LAY.chips.w, 'CHIPS', v ? String(v.chips) : '', v?.phase === 'paying');
  meter(LAY.bet.x, LAY.bet.w, 'BET', v ? String(v.bet) : '', false);
  const pm = (b: { x: number; y: number; w: number; h: number }, label: string, live: boolean) => {
    g.fillStyle = live ? T.gold : '#3c443c'; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = live ? T.black : '#6c746c';
    g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText(label, b.x + b.w / 2, b.y + 17);
  };
  pm(LAY.betDown, '−', !!v && v.phase === 'betting');
  pm(LAY.betUp, '+', !!v && v.phase === 'betting');

  // ── THE WORLD COPY STOPS HERE ──
  if (!v) { g.restore(); return; }

  // the chip, sitting ON the bet it is riding — the layout is where chips go
  const chip = (cx: number, cy: number) => {
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.beginPath(); g.arc(cx + 1, cy + 2, 9, 0, TAU); g.fill();
    g.fillStyle = T.chip;
    g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
    g.fillStyle = T.goldLo;
    g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.arc(cx, cy, 6, 0, TAU, true); g.fill();
    g.fillStyle = T.black; g.font = 'bold 8px monospace'; g.textAlign = 'center';
    g.fillText(String(v.bet), cx, cy + 3);
  };
  if (v.kind === 'number') {
    if (v.pick === 0) chip(gd.x + gridW / 2, gd.zeroY + gd.zeroH / 2 - 1);
    else {
      const r = Math.floor((v.pick - 1) / 3), c = (v.pick - 1) % 3;
      chip(gd.x + c * gd.colW + cellW / 2, gd.y + r * gd.rowH + gd.rowH / 2 - 1);
    }
  } else {
    const i = OUTS.findIndex((o) => o.bet === v.kind);
    chip(LAY.outside.x + LAY.outside.w - 18,
      LAY.outside.y + i * (LAY.outside.h + LAY.outside.gap) + LAY.outside.h / 2);
  }

  g.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// PART FOUR: THE MACHINERY AROUND IT — deliberately near-identical to
// ct/blackjack.ts's, which was deliberately near-identical to ct/slots.ts's.
// Third game, same ninety lines: K's panel, K's pockets, the seat opens it,
// ESC and standing up always leave cleanly with the rail cashed out.

interface SeatRow { pose: object; label: string }
interface CtWindow { __ct?: { seated: () => object | null; seats: () => SeatRow[] } }

function seatedAtWheel(): object | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  return ct.seats().find((s) => s.pose === pose)?.label === SEAT_LABEL ? pose : null;
}

export function register(ctx: CtxBuild): void {
  const table = createTable();
  let panel: Panel | null = null;
  let lastT = -1;
  let dismissed: object | null = null;
  let CHIP = 1;

  const cashOut = () => {
    const n = table.cashOut();
    if (n <= 0) return;
    ctx.purse.cash += n * CHIP;
    ctx.refreshWallet();
  };
  const buyIn = () => {
    if (!table.settled()) return;
    const spend = Math.min(20, ctx.purse.cash);          // a twenty, at a table
    const chips = Math.floor(spend / CHIP);
    if (chips <= 0) return;
    ctx.purse.cash -= chips * CHIP;
    ctx.refreshWallet();
    table.buyIn(chips);
  };

  void Promise.all([import('./hud'), import('./slots')]).then(([{ makePanel }, slots]) => {
    CHIP = slots.CREDIT;               // ONE exchange rate for the whole casino
    panel = makePanel({
      // ON THE BAIZE ITSELF. 2026-08-09: *"blackjack and roulettte need to be
      // diagetic similar to all the other locked perspective UIs."* The canvas
      // hangs on the `roulette-felt` mesh — the whole tabletop, seen side-on
      // from the lock: layout left, the REAL wheel standing at the right,
      // turned by the hook below. `faceYaw` is −π/2 because the felt is
      // horizontal and says nothing about heading (the drawer's rule): −x is
      // the avenue-side seats' own facing, and it puts the wheel at the
      // screen's right hand, which is where a table crew stands it.
      id: 'ct-roulette',
      w: FELT.w, h: FELT.h, scale: 2,
      chrome: 'none',
      hint: () => (table.view().phase === 'betting'
        ? (ctx.purse.cash < CHIP
          ? 'click a bet, then the wheel · arrows bet · C cash out'
          : 'click a bet, then the wheel · arrows bet · I buy in $20 · C cash out')
        : 'no more bets'),
      draw: (g, w, h) => paintTable(g, w, h, table.view(), ctx.purse.cash),
      key: (k) => {
        if (k === ' ' || k === 'enter') table.spin();
        else if (k === 'arrowleft') table.kindBy(-1);
        else if (k === 'arrowright') table.kindBy(1);
        else if (k === 'arrowup') table.pickBy(1);
        else if (k === 'arrowdown') table.pickBy(-1);
        else if (k === '+' || k === '=') table.betBy(1);
        else if (k === '-') table.betBy(-1);
        else if (k === 'r') table.kindSet('red');
        else if (k === 'b') table.kindSet('black');
        else if (k === 'o') table.kindSet('odd');
        else if (k === 'e') table.kindSet('even');
        else if (k === 'i') buyIn();
        else if (k === 'c') cashOut();
        panel?.repaint();
      },
      surface: {
        mesh: () => ctx.scene.getObjectByName('roulette-felt') ?? null,
        // the eye clamps to 1.75 m over the floor (`poseFor`); 0.92 above the
        // 0.83 m felt lands on the clamp, and fov 70 is what frames a 1.94 m
        // table from there — a wide look, which is what standing over a
        // roulette table is
        standoff: 0.92,
        fov: 70,
        faceYaw: -Math.PI / 2,
        hot: (x, y) => table.view().phase === 'betting' && feltHit(x, y) !== null,
        click: (x, y) => {
          if (table.view().phase !== 'betting') return;
          const hit = feltHit(x, y);
          if (!hit) return;
          if (hit.kind === 'spin') table.spin();
          else if (hit.kind === 'bet') table.kindSet(hit.bet);
          else if (hit.kind === 'pick') table.pickSet(hit.n);
          else table.betBy(hit.d);
          panel?.repaint();
        },
      },
      onClose: () => { dismissed = seatedAtWheel(); cashOut(); },
    });
  });

  // The room's OWN wheel head turns with the game — found by NAME, which is
  // also the audio hook. Looked up lazily and once: the casino builds before
  // this registers, and a missing head must cost one search, not one a frame.
  let head: THREE.Object3D | null | undefined;
  let ball: THREE.Object3D | null | undefined;

  ctx.onFrame((f) => {
    if (!panel) return;
    const seat = seatedAtWheel();
    // NOT SEATED MEANS NOT OPEN, unconditionally — the blackjack table's
    // hard-won rule (its register has the two-line trap this avoids, written
    // out in full). An open panel eats keydown for the whole world.
    if (seat === null) {
      dismissed = null;
      if (panel.isOpen()) panel.close();
      lastT = -1;
    } else if (!panel.isOpen()) {
      lastT = -1;
      if (seat !== dismissed) { lastT = f.t; panel.open(); }
    } else {
      const dt = lastT < 0 ? 0 : Math.max(0, f.t - lastT);
      lastT = f.t;
      table.tick(dt);
      panel.repaint();
    }

    // the world's wheel: idle drift always, the game's own angle while it
    // runs. The head's pockets are painted in WHEEL order with pocket i
    // centred at canvas angle i/37·TAU, and a cylinder cap samples canvas
    // angle φ at world bearing atan2(x, z) = −φ, so rotating the head to
    // π/2 − wheelA puts the ball — placed at (cos a, sin a) below — exactly
    // over the pocket the game drew. Derived, and then LOOKED at: the ball
    // rides its number home, which since the diegetic move is the only wheel
    // the player watches (the painted panel wheel is gone).
    if (head === undefined) head = (ctx.scene.getObjectByName('roulette-wheel-head') ?? null) as THREE.Object3D | null;
    if (ball === undefined) ball = (ctx.scene.getObjectByName('roulette-ball') ?? null) as THREE.Object3D | null;
    if (head) {
      const v = panel.isOpen() ? table.view() : null;
      head.rotation.y = v ? Math.PI / 2 - v.wheel.wheelA : f.t * 0.25;
      if (ball && v) {
        // 0.155 m is the middle of the painted pocket band; 0.37 is out on
        // the chrome bowl, where a launched ball actually runs
        const r = 0.155 + (0.37 - 0.155) * Math.min(1, v.wheel.ballR);
        ball.position.x = head.position.x + Math.cos(v.wheel.ballA) * r;
        ball.position.z = head.position.z + Math.sin(v.wheel.ballA) * r;
        ball.position.y = 1.00;
      }
    }
  }, HOOK.LATE);

  (globalThis as unknown as Record<string, unknown>).__roulette = {
    open: () => panel?.open(),
    close: () => panel?.close(),
    view: () => table.view(),
    buyIn: (n: number) => table.buyIn(n),
    spin: () => table.spin(),
    cash: () => ctx.purse.cash,
    chip: () => CHIP,
    seatLabel: SEAT_LABEL,
  };
}
