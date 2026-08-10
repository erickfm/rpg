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
      return `BET: ${k === 'number' ? `NUMBER ${pick}` : k.toUpperCase()} — SPACE SPINS`;
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
// PART THREE: THE FELT — a pure function of (view, cash), painted small and
// scaled up, no Math.random anywhere (GOTCHAS §1: the paint layer's dither is
// why screenshots cannot be diffed; this panel CAN be).

export const FELT = { w: 320, h: 256 } as const;

const T = {
  felt: '#1e5a3e', feltLo: '#17462f', feltHi: '#2a6d4c',
  rail: '#3a2226', railHi: '#54353a',
  wood: '#2e1e20',
  red: '#c8342c', black: '#16120e', green: '#1e7c3c',
  gold: '#d8a83a', goldLo: '#8a6a22',
  ivory: '#ece6d4', ink: '#e8e2d0', dim: '#9ab0a0',
  chip: '#c9a45e', win: '#fff0bc',
} as const;

const CX = 92, CY = 104, RIM = 80, POCKET_R = 56, HUB_R = 26;
const BALL_RIM = 72, BALL_POCKET = 46;

/** The bet board's five rows, exported so the check (and a curious probe) can
 *  ask where a row is instead of hand-typing pixels (GOTCHAS §20). */
export const BOARD = { x: 188, y: 26, w: 116, rowH: 22 } as const;

export function paintTable(g: Paint2D, w: number, h: number, v: TableView, cash?: number): void {
  const s = Math.max(0.1, Math.min(w / FELT.w, h / FELT.h));
  g.save();
  g.fillStyle = T.rail; g.fillRect(0, 0, w, h);
  g.translate((w - FELT.w * s) / 2, (h - FELT.h * s) / 2);
  g.scale(s, s);

  g.fillStyle = T.rail; g.fillRect(0, 0, FELT.w, FELT.h);
  g.fillStyle = T.felt; g.fillRect(6, 6, FELT.w - 12, 196);
  g.fillStyle = T.feltHi; g.fillRect(6, 6, FELT.w - 12, 1);
  g.fillStyle = T.feltLo; g.fillRect(6, 201, FELT.w - 12, 1);

  // ── the wheel ──
  g.fillStyle = T.wood;
  g.beginPath(); g.arc(CX, CY, RIM + 8, 0, TAU); g.fill();
  g.fillStyle = T.gold;
  g.beginPath(); g.arc(CX, CY, RIM + 2, 0, TAU); g.fill();
  g.fillStyle = T.black;
  g.beginPath(); g.arc(CX, CY, RIM - 2, 0, TAU); g.fill();
  // pockets, turning with the wheel
  for (let i = 0; i < POCKETS; i++) {
    const a0 = v.wheel.wheelA + (i / POCKETS) * TAU - Math.PI / POCKETS;
    const n = WHEEL[i];
    // '#26201c' first — which vanished into the disc behind it, and the look
    // shot read as an all-red wheel. A black pocket has to be its own object.
    g.fillStyle = n === 0 ? T.green : REDS.has(n) ? T.red : '#34303a';
    g.beginPath(); g.moveTo(CX, CY);
    g.arc(CX, CY, POCKET_R + 14, a0, a0 + TAU / POCKETS); g.closePath(); g.fill();
  }
  // the track band the ball runs on
  g.fillStyle = '#3a3230';
  g.beginPath(); g.arc(CX, CY, POCKET_R + 15, 0, TAU);
  g.arc(CX, CY, POCKET_R + 22, 0, TAU, true); g.fill();
  // hub: gold, carrying the last result
  g.fillStyle = T.goldLo; g.beginPath(); g.arc(CX, CY, HUB_R + 2, 0, TAU); g.fill();
  g.fillStyle = T.gold; g.beginPath(); g.arc(CX, CY, HUB_R, 0, TAU); g.fill();
  const shown = v.result ?? v.history[0];
  if (shown !== undefined) {
    g.fillStyle = shown === 0 ? T.green : REDS.has(shown) ? T.red : T.black;
    g.beginPath(); g.arc(CX, CY, HUB_R - 6, 0, TAU); g.fill();
    g.fillStyle = T.ivory; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(String(shown), CX, CY + 5);
  }
  // the ball
  const br = BALL_POCKET + (BALL_RIM - BALL_POCKET) * Math.min(1, v.wheel.ballR);
  const bx = CX + Math.cos(v.wheel.ballA) * br, by = CY + Math.sin(v.wheel.ballA) * br;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.arc(bx + 1, by + 2, 4, 0, TAU); g.fill();
  g.fillStyle = T.ivory;
  g.beginPath(); g.arc(bx, by, 4, 0, TAU); g.fill();

  // ── the last eight, top left, newest first ──
  v.history.forEach((n, i) => {
    const hx = 14 + i * 16;
    g.fillStyle = n === 0 ? T.green : REDS.has(n) ? T.red : T.black;
    g.fillRect(hx, 12, 13, 11);
    g.fillStyle = T.ivory; g.font = 'bold 6px monospace'; g.textAlign = 'center';
    g.fillText(String(n), hx + 6.5, 20);
  });

  // ── the bet board ──
  g.fillStyle = T.feltLo; g.fillRect(BOARD.x - 6, BOARD.y - 8, BOARD.w + 12, 5 * BOARD.rowH + 44);
  g.fillStyle = T.gold; g.font = 'bold 8px monospace'; g.textAlign = 'center';
  g.fillText('PAYS', BOARD.x + BOARD.w - 20, BOARD.y - 0.5);
  BET_KINDS.forEach((k, i) => {
    const ry = BOARD.y + 6 + i * BOARD.rowH;
    const sel = k === v.kind;
    g.fillStyle = sel ? T.gold : T.felt;
    g.fillRect(BOARD.x, ry, BOARD.w, BOARD.rowH - 4);
    if (sel) { g.fillStyle = T.win; g.fillRect(BOARD.x, ry, BOARD.w, 1); }
    const label = k === 'number' ? `NUMBER ${v.pick}` : k.toUpperCase();
    g.font = 'bold 8px monospace'; g.textAlign = 'left';
    // a colour chip in front of RED and BLACK so the rows read at a glance
    if (k === 'red' || k === 'black') {
      g.fillStyle = k === 'red' ? T.red : T.black;
      g.fillRect(BOARD.x + 5, ry + 5, 8, 8);
    }
    g.fillStyle = sel ? T.black : T.ink;
    g.fillText(label, BOARD.x + (k === 'red' || k === 'black' ? 18 : 6), ry + 12);
    g.textAlign = 'right';
    g.fillStyle = sel ? '#5a3c08' : T.dim;
    g.fillText(k === 'number' ? '35:1' : '1:1', BOARD.x + BOARD.w - 4, ry + 12);
  });
  g.fillStyle = T.dim; g.font = '6px monospace'; g.textAlign = 'center';
  g.fillText('←→ BET   ↑↓ NUMBER', BOARD.x + BOARD.w / 2, BOARD.y + 5 * BOARD.rowH + 16);
  g.fillText('ZERO IS THE HOUSE’S', BOARD.x + BOARD.w / 2, BOARD.y + 5 * BOARD.rowH + 26);

  // ── what the table is saying ──
  g.fillStyle = T.rail; g.fillRect(22, 206, FELT.w - 44, 14);
  g.fillStyle = T.railHi; g.fillRect(22, 206, FELT.w - 44, 1);
  g.textAlign = 'center'; g.font = '7px monospace';
  g.fillStyle = v.phase === 'settle' || v.phase === 'paying'
    ? (v.won ? T.win : T.dim) : T.dim;
  const CHIP_HINT = 1;
  const line = (v.phase === 'betting' && v.chips < v.bet
    && cash !== undefined && cash < CHIP_HINT) ? 'NO CASH IN YOUR POCKETS' : v.says;
  if (line) g.fillText(line, FELT.w / 2, 216);

  // ── meters, same grammar as the blackjack felt ──
  const meter = (mx: number, mw: number, label: string, val: string, lit: boolean) => {
    g.fillStyle = '#12180f'; g.fillRect(mx, 224, mw, 20);
    g.strokeStyle = T.railHi; g.lineWidth = 1;
    g.strokeRect(mx + 0.5, 224.5, mw - 1, 19);
    g.fillStyle = '#2c4a24'; g.font = '6px monospace'; g.textAlign = 'left';
    g.fillText(label, mx + 4, 232);
    g.fillStyle = lit ? T.win : '#7ae05a';
    g.font = 'bold 10px monospace'; g.textAlign = 'right';
    g.fillText(val, mx + mw - 4, 241);
  };
  meter(22, 130, 'CHIPS', String(v.chips), v.phase === 'paying');
  meter(160, 66, 'BET', String(v.bet), false);
  meter(232, 66, 'PAID', String(v.paid), v.phase === 'paying');

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
      // FRAMELESS, like the other two — paintTable draws the whole rail.
      id: 'ct-roulette',
      w: FELT.w, h: FELT.h, scale: 2,
      chrome: 'none',
      hint: () => (table.view().phase === 'betting'
        ? (ctx.purse.cash < CHIP
          ? 'SPACE spin · arrows bet · C cash out'
          : 'SPACE spin · arrows bet · I buy in $20 · C cash out')
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

    // the world's wheel: idle drift always, the game's own angle while it runs
    if (head === undefined) head = (ctx.scene.getObjectByName('roulette-wheel-head') ?? null) as THREE.Object3D | null;
    if (ball === undefined) ball = (ctx.scene.getObjectByName('roulette-ball') ?? null) as THREE.Object3D | null;
    if (head) {
      const v = panel.isOpen() ? table.view() : null;
      head.rotation.y = v ? -v.wheel.wheelA : f.t * 0.25;
      if (ball && v) {
        const r = 0.13 + (0.30 - 0.13) * Math.min(1, v.wheel.ballR);
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
