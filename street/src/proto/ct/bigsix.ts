// ORPHEUS CASINO — the BIG SIX wheel.
//
// 2026-08-10, Erick: "yea add wheel of fortune." So this is the money wheel —
// the big VERTICAL wheel that reads from clear across the floor, roulette's
// bones (stake, spin, settle) with none of roulette's table: you put chips on
// a denomination, you send the wheel, and the flapper clacks it down to an
// answer everybody in the room can see. The watching is the game, same as the
// ball next door.
//
// ─────────────────────────────────────────────────────────────────────────────
// PART ONE: THE MATHS — 24 pegs, six bets, TRUE ODDS ON EVERY NUMBER.
//
// 2026-08-11, Erick, on the first face: *"big six wheel is illegible. fix
// this, make it simpler maybe."* He was right — 54 segments across a 1.7 m
// wheel is 6.7° of arc each, and a denomination drawn in 6.7° is a scratch.
// So the wheel was REBUILT AT 24 PEGS: 15° a segment, more than double the
// width, and the numbers read from the door. Legibility beats the reference —
// a real Big Six has 54 pegs, but a real Big Six is three metres of painted
// canvas and this one is a texture.
//
// SEGMENT COUNTS *ARE* THE PROBABILITIES, so the pays were re-derived from
// scratch against the new face rather than carried over. The counts were
// chosen so that every one of them divides 24 into an exact whole-number
// price, which lets the board print TRUE ODDS on five of the six bets — the
// simplest honest thing a wheel can say, and squarely on his standing ruling
// that fun beats hold in this casino ("fun should be optimized"):
//
//   segment   count    p      pays     RTP
//   $1          8    1/3       2:1    100.0%   ┐
//   $2          6    1/4       3:1    100.0%   │ true odds, exactly — the
//   $5          4    1/6       5:1    100.0%   │ house takes nothing on any
//   $10         3    1/8       7:1    100.0%   │ number on the board
//   $20         2   1/12      11:1    100.0%   ┘
//   JOKER       1   1/24      20:1     87.5%   (true price is 23:1; the
//                                               flashiest bet keeps the most,
//                                               the floor's own ladder rule)
//
// Flat-betting every plate equally: 97.9% (was 94.1% at 54 pegs). Note $1
// pays 2:1 now, NOT the old 1:1 — at 8 of 24 that is the same zero-edge party
// bet the old 27-of-54 was, priced for the face it actually sits on. Every
// number the plates print is computed from WHEEL below, so the board cannot
// promise a price the wheel does not pay.
//
// THE DRAW IS ONE UNIFORM INTEGER IN [0, N), taken the moment you press
// SPIN, before anything moves — the five seconds of wheel are presentation of
// a decision already made, the slots' anticipation contract. Math.random,
// never ct/rng.ts (GOTCHAS §2: the seeded stream plants every tree).

import type * as THREE from 'three';
import type { Paint2D } from './slots';
import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';

/** After roulette, so the casino's games register in a stable order. */
export const ORDER = BUILD.INTERIOR + 8;

export type Seg = '1' | '2' | '5' | '10' | '20' | 'J';
export const SEG_KINDS: readonly Seg[] = ['1', '2', '5', '10', '20', 'J'];

/** The price of each bet, N to 1 — a win returns bet × (PAYS + 1). Derived
 *  from the counts in WHEEL: see the table in PART ONE. */
export const PAYS: Record<Seg, number> = {
  '1': 2, '2': 3, '5': 5, '10': 7, '20': 11, J: 20,
};

/** The physical wheel, in peg order — eight triples, each opening on an ivory
 *  $1, so the face reads as eight bright spokes with the money between them
 *  and no two like segments ever touching. The painted head, the flapper and
 *  the payout all read from THIS array and nothing else, so editing it moves
 *  the odds, the board's printed prices and the wheel you watch together. */
export const WHEEL: readonly Seg[] = [
  '1', '2', '5',
  '1', '2', '10',
  '1', '2', '20',
  '1', '2', '5',
  '1', '2', '10',
  '1', '2', 'J',
  '1', '5', '20',
  '1', '5', '10',
];
export const N = WHEEL.length;                     // 24

/** The paint of each segment — read by this module's board AND by
 *  ct/int-casino.ts's wheel-head texture, so the board's plates and the wheel
 *  they promise are one palette. */
export const SEG_LOOK: Record<Seg, { fill: string; ink: string; label: string }> = {
  '1': { fill: '#ece6d4', ink: '#16120e', label: '$1' },
  '2': { fill: '#d8a83a', ink: '#16120e', label: '$2' },
  '5': { fill: '#c8342c', ink: '#ece6d4', label: '$5' },
  '10': { fill: '#1e7c3c', ink: '#ece6d4', label: '$10' },
  '20': { fill: '#2b3f7e', ink: '#ece6d4', label: '$20' },
  J: { fill: '#16120e', ink: '#e8c25a', label: 'JOKER' },
};

export type Rng = () => number;
const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────────────────────
// PART TWO: THE WHEEL — a state machine advanced by dt, the same contract as
// the slot machine, blackjack and roulette: the wheel holds no money (every
// stake and payout moves straight through the injected Bank — the wallet, in
// the world), flush() on leaving settles anything owed, and the wheel's angle
// is a CLOSED FORM of the time since SPIN — no integration, so any dt lands
// the same peg under the flapper (GOTCHAS §30/§43).

export const PACE = {
  /** the whole ride, launch to rest — long enough to sweat, short enough
   *  to go again */
  total: 5.4,
  /** how long the result sits before the chips move */
  settle: 1.1,
  /** chips a second once they move; scaled so a 45:1 hit is seconds */
  payRate: (owed: number) => Math.max(14, owed / 2.2),
  /** revolutions of the base ride, before the landing correction */
  revs: 4,
};

/** Cubic ease-out: hard launch, dying to a stop — a hand-thrown wheel. */
const ease = (u: number): number => { const k = Math.min(1, Math.max(0, u)); return 1 - (1 - k) ** 3; };

export type Phase = 'betting' | 'spinning' | 'settle' | 'paying';

export interface WheelView {
  /** the LOGICAL wheel angle, radians: which painted angle sits under the
   *  flapper. int-casino's head is rotated to π/2 + this (see the hook). */
  readonly wheelA: number;
  /** flapper deflection, 0..1 — pegs kick it, rest lets it hang */
  readonly flap: number;
  /** wheel speed, rad/s — audio's ratchet pace, published on the head too */
  readonly speed: number;
}

export interface BigSixView {
  readonly phase: Phase;
  readonly chips: number;
  readonly bet: number;
  readonly pick: Seg;
  readonly t: number;
  readonly result: Seg | null;
  readonly won: boolean;
  readonly history: readonly Seg[];
  readonly paid: number;
  readonly staked: number;
  readonly returned: number;
  readonly says: string;
  readonly wheel: WheelView;
}

export interface Wheel {
  view(): BigSixView;
  tick(dt: number): void;
  betAdd(n: number): void;
  betClear(): void;
  pickSet(s: Seg): void;
  spin(): boolean;
  /** fund the DEFAULT bank — the headless checks' way in. The world injects
   *  the wallet as `opts.bank` and never calls this. */
  buyIn(chips: number): void;
  /** leave: settle anything owed straight to the bank — a spin in flight
   *  resolves rather than forfeits, because the draw already happened. */
  flush(): void;
  settled(): boolean;
}

/** Same Bank, same day, same quote as blackjack's and roulette's: *"i dont
 *  like this cash out buy in thing. i just want it simple"* (2026-08-10). */
export interface Bank {
  get(): number;
  add(d: number): void;
}

/** The chip rack — stack any bet a chip at a time, up to the wallet. */
export const CHIPS = [1, 5, 25, 100] as const;

export function createWheel(opts: { rng?: Rng; bank?: Bank } = {}): Wheel {
  const rng = opts.rng ?? Math.random;
  const bank: Bank = opts.bank
    ?? (() => { let n = 0; return { get: () => n, add: (d: number) => { n += d; } }; })();
  let phase: Phase = 'betting';
  let bet = 0, pick: Seg = '5';
  let t = 0, baseA = Math.PI / 2 / N;             // resting mid-segment 0
  let delta = 0, targetIx = 0;
  let result: Seg | null = null, won = false;
  let owed = 0, paid = 0, payRamp = 0, phaseT = 0;
  let staked = 0, returned = 0;
  const history: Seg[] = [];

  const angleAt = (tt: number): number =>
    phase === 'betting' ? baseA : baseA + delta * ease(Math.min(tt, PACE.total) / PACE.total);

  const speedAt = (tt: number): number => {
    if (phase !== 'spinning' || tt >= PACE.total) return 0;
    const u = tt / PACE.total;
    return delta * 3 * (1 - u) ** 2 / PACE.total;
  };

  const view = (): BigSixView => {
    const wheelA = angleAt(t);
    const speed = speedAt(t);
    // pegs sit on segment boundaries; right after one passes the flapper the
    // blade is thrown, then it falls back until the next — the clack the
    // audio builder will hang here rides `flap` returning to zero
    const pegPhase = (((wheelA / TAU) * N + 0.5) % 1 + 1) % 1;
    const flap = Math.max(0, 1 - pegPhase * 2.5) * Math.min(1, speed / 1.2);
    return {
      phase, chips: bank.get(), bet, pick, t, result, won,
      history, paid, staked, returned, says: says(),
      wheel: { wheelA, flap, speed },
    };
  };

  const says = (): string => {
    if (phase === 'betting') {
      const b = bank.get();
      if (b < 1 && bet < 1) return 'NO CASH IN YOUR POCKETS';
      if (bet < 1) return 'STACK CHIPS ON A NUMBER';
      return `${bet} ON ${SEG_LOOK[pick].label} — SPIN THE WHEEL`;
    }
    if (phase === 'spinning') return t < PACE.total * 0.6 ? 'ROUND SHE GOES' : '…';
    if (result === null) return '';
    return won ? `${SEG_LOOK[result].label} — YOU WIN ${owed}` : SEG_LOOK[result].label;
  };

  const spin = (): boolean => {
    if (phase !== 'betting') return false;
    if (bet < 1 || bank.get() < bet) return false;
    bank.add(-bet); staked += bet;
    // THE DRAW, now, before anything moves.
    targetIx = Math.min(N - 1, Math.floor(rng() * N));
    result = null; won = false; paid = 0; payRamp = 0; owed = 0;
    baseA = angleAt(t); t = 0; phase = 'spinning'; phaseT = 0;
    // land the target's CENTRE under the flapper after the base revolutions:
    // final angle ≡ targetIx/N·TAU (mod TAU), approached from below so the
    // last pegs pass slow — the flapper hesitating on the line is the show
    const want = (targetIx / N) * TAU;
    let d = (want - baseA) % TAU;
    if (d < 0) d += TAU;
    delta = PACE.revs * TAU + d;
    return true;
  };

  const endRound = (): void => {
    baseA = angleAt(t); t = 0;
    // bet = 0: every spin starts from an empty board — *"the bet after each
    // round … should reset to zero"* (2026-08-10). The PICK keeps.
    phase = 'betting'; phaseT = 0; bet = 0;
  };

  const tick = (dt: number): void => {
    if (!(dt > 0)) return;
    t += dt; phaseT += dt;
    if (phase === 'spinning') {
      if (t < PACE.total) return;
      const s = WHEEL[targetIx];
      result = s;
      won = s === pick;
      owed = won ? bet * (PAYS[s] + 1) : 0;
      history.unshift(s);
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
      // straight into the bank — the wallet — as it counts, so the HUD's
      // green tick rides the count on every win
      if (whole > paid) { bank.add(whole - paid); paid = whole; }
      if (payRamp >= owed) {
        if (owed > paid) bank.add(owed - paid);
        paid = owed; returned += owed;
        endRound();
      }
    }
  };

  return {
    view, tick, spin,
    betAdd: (n) => {
      if (phase !== 'betting' || !(n > 0)) return;
      bet = Math.min(bet + Math.floor(n), Math.max(0, bank.get()));
    },
    betClear: () => { if (phase === 'betting') bet = 0; },
    pickSet: (s) => { if (phase === 'betting' && SEG_KINDS.includes(s)) pick = s; },
    buyIn: (n) => { if (n > 0 && phase === 'betting') bank.add(Math.floor(n)); },
    flush: () => {
      // Walking away settles HONESTLY: a spin in flight resolves (the peg was
      // drawn at SPIN), a win still counting pays in full. Roulette's rule.
      if (phase === 'spinning') {
        const s = WHEEL[targetIx];
        result = s;
        won = s === pick;
        owed = won ? bet * (PAYS[s] + 1) : 0;
        history.unshift(s);
        if (history.length > 8) history.pop();
        baseA = (targetIx / N) * TAU;             // the wheel rests on its answer
      }
      const due = Math.max(0, owed - paid);
      if (due > 0) { bank.add(due); returned += due; }
      if (phase !== 'betting') { if (phase !== 'spinning') baseA = angleAt(t); t = 0; }
      phase = 'betting'; phaseT = 0; bet = 0; owed = 0; paid = 0; payRamp = 0;
    },
    settled: () => phase === 'betting',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART THREE: THE PAINT — two painters, no Math.random in either (GOTCHAS §1).
//
// `paintBoard` is the betting counter on the cabinet's fascia: six plates with
// the pays printed on them, the chip rack, the money row. Painted ONCE as the
// idle world texture (`paintBoard(g, w, h, null)`) and LIVE into the bottom of
// the session pane while you play — one painter, two moments, cannot drift.
//
// `paintWheelFace` is the head itself: N wedges in peg order, called by
// ct/int-casino.ts under pixTex (a real 2D context) to paint the cylinder cap
// the world spins. Segment i is CENTRED at canvas angle i/N·TAU — the same
// convention as roulette's head, and the hook below rotates against it.

/** The idle board canvas over the 1.55 × 0.66 m fascia plate: same 2.35
 *  aspect (§7b's same-both-ways rule), ~310 px/m. */
export const BOARD = { w: 480, h: 204 } as const;

const T = {
  felt: '#173a2c', feltLo: '#102b20', feltHi: '#215741',
  rail: '#3a2226', railHi: '#54353a',
  gold: '#d8a83a', goldLo: '#8a6a22',
  ivory: '#ece6d4', dim: '#9ab0a0', chip: '#c9a45e', win: '#fff0bc',
} as const;

/** Where everything sits on the board, exported so a check can ask rather
 *  than hand-type pixels (GOTCHAS §20). Declared once, read by the painter
 *  AND `boardHit`. */
export const LAY = {
  say: { x: 8, y: 6, w: 262, h: 18 },
  hist: { x: 280, y: 7, w: 22, h: 16, step: 25 },
  /** the six bet plates, one per segment kind, left to right */
  plates: { x: 8, y: 32, w: 74, h: 74, gap: 4 },
  bet: { x: 8, y: 118, w: 74, h: 22 },
  chips: { x: 90, y: 118, w: 38, h: 22, gap: 4 },
  clear: { x: 262, y: 118, w: 64, h: 22 },
  spin: { x: 334, y: 118, w: 66, h: 22 },
  leave: { x: 408, y: 118, w: 64, h: 22 },
  note: { x: 8, y: 158 },
} as const;

export type BoardHit =
  | { kind: 'pick'; seg: Seg }
  | { kind: 'chip'; n: number }
  | { kind: 'clear' }
  | { kind: 'spin' }
  | { kind: 'leave' };
export function boardHit(x: number, y: number): BoardHit | null {
  const p = LAY.plates;
  if (y >= p.y && y < p.y + p.h && x >= p.x) {
    const i = Math.floor((x - p.x) / (p.w + p.gap));
    if (i >= 0 && i < 6 && x - p.x - i * (p.w + p.gap) < p.w) {
      return { kind: 'pick', seg: SEG_KINDS[i] };
    }
  }
  const inBox = (b: { x: number; y: number; w: number; h: number }) =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  for (let i = 0; i < CHIPS.length; i++) {
    const bx = LAY.chips.x + i * (LAY.chips.w + LAY.chips.gap);
    if (inBox({ x: bx, y: LAY.chips.y, w: LAY.chips.w, h: LAY.chips.h })) {
      return { kind: 'chip', n: CHIPS[i] };
    }
  }
  if (inBox(LAY.clear)) return { kind: 'clear' };
  if (inBox(LAY.spin)) return { kind: 'spin' };
  if (inBox(LAY.leave)) return { kind: 'leave' };
  return null;
}

export function paintBoard(g: Paint2D, w: number, h: number, v: BigSixView | null): void {
  const s = Math.max(0.1, Math.min(w / BOARD.w, h / BOARD.h));
  g.save();
  g.fillStyle = T.felt; g.fillRect(0, 0, w, h);
  g.translate((w - BOARD.w * s) / 2, (h - BOARD.h * s) / 2);
  g.scale(s, s);

  g.fillStyle = T.felt; g.fillRect(0, 0, BOARD.w, BOARD.h);
  g.fillStyle = T.feltHi;
  g.fillRect(4, 4, BOARD.w - 8, 1); g.fillRect(4, 4, 1, BOARD.h - 8);
  g.fillRect(BOARD.w - 5, 4, 1, BOARD.h - 8);
  g.fillStyle = T.feltLo; g.fillRect(4, BOARD.h - 5, BOARD.w - 8, 1);

  // ── what the counter is saying ──
  g.fillStyle = T.feltLo; g.fillRect(LAY.say.x, LAY.say.y, LAY.say.w, LAY.say.h);
  g.fillStyle = T.feltHi; g.fillRect(LAY.say.x, LAY.say.y, LAY.say.w, 1);
  g.textAlign = 'center'; g.font = '10px monospace';
  if (v) {
    g.fillStyle = v.phase === 'settle' || v.phase === 'paying'
      ? (v.won ? T.win : T.dim) : T.dim;
    if (v.says) g.fillText(v.says, LAY.say.x + LAY.say.w / 2, LAY.say.y + 13);
  } else {
    g.fillStyle = T.dim;
    g.fillText('BIG SIX — PUT IT ON A NUMBER', LAY.say.x + LAY.say.w / 2, LAY.say.y + 13);
  }

  // ── the last eight, newest first ──
  for (let i = 0; i < 8; i++) {
    const hx = LAY.hist.x + i * LAY.hist.step;
    const seg = v?.history[i];
    if (seg === undefined) {
      g.strokeStyle = 'rgba(216,208,192,0.30)'; g.lineWidth = 1;
      g.strokeRect(hx + 0.5, LAY.hist.y + 0.5, LAY.hist.w - 1, LAY.hist.h - 1);
    } else {
      const lk = SEG_LOOK[seg];
      g.fillStyle = lk.fill; g.fillRect(hx, LAY.hist.y, LAY.hist.w, LAY.hist.h);
      g.fillStyle = lk.ink; g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText(seg === 'J' ? '★' : seg, hx + LAY.hist.w / 2, LAY.hist.y + 12);
    }
  }

  // ── the six plates: segment colour, the money, the odds, the count ──
  const p = LAY.plates;
  SEG_KINDS.forEach((seg, i) => {
    const px = p.x + i * (p.w + p.gap);
    const lk = SEG_LOOK[seg];
    g.fillStyle = T.feltLo; g.fillRect(px - 1, p.y - 1, p.w + 2, p.h + 2);
    g.fillStyle = lk.fill; g.fillRect(px, p.y, p.w, p.h - 22);
    g.fillStyle = lk.ink; g.textAlign = 'center';
    g.font = seg === 'J' ? 'bold 12px monospace' : 'bold 18px monospace';
    g.fillText(lk.label, px + p.w / 2, p.y + (seg === 'J' ? 31 : 34));
    if (seg === 'J') {                     // the joker gets his star
      g.fillStyle = T.gold; g.font = 'bold 14px monospace';
      g.fillText('★', px + p.w / 2, p.y + 15);
    }
    // the printed odds, on a dark footer plate — a wheel that hides its odds
    // is a wheel you don't put $100 on. 2026-08-11: these two lines were set
    // at 9 and 7 px and were as unreadable as the wheel face; the footer grew
    // to 26 px and the type to 10 and 9, which is the widest "PAYS 20 TO 1"
    // that still fits a 74 px plate in monospace (12 chars × 0.6 em = 72).
    g.fillStyle = '#12180f'; g.fillRect(px, p.y + p.h - 26, p.w, 26);
    g.fillStyle = T.ivory; g.font = 'bold 10px monospace';
    g.fillText(`PAYS ${PAYS[seg]} TO 1`, px + p.w / 2, p.y + p.h - 15);
    g.fillStyle = T.dim; g.font = '9px monospace';
    g.fillText(`${WHEEL.filter((x) => x === seg).length} OF ${N}`,
      px + p.w / 2, p.y + p.h - 4);
  });

  // ── the money row ──
  g.fillStyle = '#12180f'; g.fillRect(LAY.bet.x, LAY.bet.y, LAY.bet.w, LAY.bet.h);
  g.strokeStyle = T.railHi; g.lineWidth = 1;
  g.strokeRect(LAY.bet.x + 0.5, LAY.bet.y + 0.5, LAY.bet.w - 1, LAY.bet.h - 1);
  g.fillStyle = '#2c4a24'; g.font = '7px monospace'; g.textAlign = 'left';
  g.fillText('BET', LAY.bet.x + 4, LAY.bet.y + 15);
  g.fillStyle = '#7ae05a'; g.font = 'bold 12px monospace'; g.textAlign = 'right';
  g.fillText(v ? String(v.bet) : '', LAY.bet.x + LAY.bet.w - 4, LAY.bet.y + 16);

  // ── the printed verbs — live only; the idle counter keeps its baize plain ──
  const region = (b: { x: number; y: number; w: number; h: number }, label: string,
                  live: boolean) => {
    g.fillStyle = live ? T.gold : '#3c443c'; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = live ? '#f8e6ac' : '#4c544c'; g.fillRect(b.x, b.y, b.w, 2);
    g.fillStyle = live ? '#16120e' : '#6c746c';
    g.font = 'bold 10px monospace'; g.textAlign = 'center';
    g.fillText(label, b.x + b.w / 2, b.y + 15);
  };
  if (v) {
    const betting = v.phase === 'betting';
    CHIPS.forEach((n, i) => {
      const bx = LAY.chips.x + i * (LAY.chips.w + LAY.chips.gap);
      region({ x: bx, y: LAY.chips.y, w: LAY.chips.w, h: LAY.chips.h },
        String(n), betting && v.chips >= v.bet + n);
    });
    region(LAY.clear, 'CLEAR', betting && v.bet > 0);
    region(LAY.spin, 'SPIN', betting && v.bet >= 1 && v.chips >= v.bet);
    region(LAY.leave, 'LEAVE', true);
  }

  g.fillStyle = 'rgba(154,176,160,0.72)'; g.font = '9px monospace'; g.textAlign = 'left';
  g.fillText(`${N} PEGS · TRUE ODDS · CLICK THE WHEEL OR SPIN`, LAY.note.x, LAY.note.y);

  // the chip, riding the plate it is on
  if (v && v.bet >= 1) {
    const i = SEG_KINDS.indexOf(v.pick);
    const cx = p.x + i * (p.w + p.gap) + p.w / 2, cy = p.y + 22;
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.beginPath(); g.arc(cx + 1, cy + 2, 10, 0, TAU); g.fill();
    g.fillStyle = T.chip;
    g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.fill();
    g.fillStyle = T.goldLo;
    g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.arc(cx, cy, 7, 0, TAU, true); g.fill();
    g.fillStyle = '#16120e'; g.textAlign = 'center';
    g.font = `bold ${v.bet >= 100 ? 6 : 8}px monospace`;
    g.fillText(String(v.bet), cx, cy + 3);
  }

  g.restore();
}

/** The face texture's edge, px — ct/int-casino.ts paints the head at this
 *  size, so the density of the lettering is decided HERE, next to the drawing
 *  that has to be legible. 512 over a 1.64 m head is ~312 px/m, comfortably
 *  over the block's 150–200 px/m signage standard; the old 224 was 136 px/m
 *  and starved every numeral it carried. */
export const FACE = 512;

/**
 * THE HEAD ITSELF — N wedges in peg order, gold pegs on every boundary,
 * called by ct/int-casino.ts under pixTex (a REAL 2D context; wedges need
 * moveTo, which Paint2D does not carry). Segment i is CENTRED at canvas angle
 * i/N·TAU. A cylinder cap at head rotation.y = θ shows canvas angle φ at
 * local bearing θ − φ (roulette's derivation, re-used not re-derived), the
 * stand turns local +x to world UP, and the flapper hangs at world up — local
 * bearing π/2 — so the hook sets θ = π/2 + wheelA and the flapper reads
 * exactly the segment the game announces.
 *
 * WHY THE DENOMINATION LIES ALONG THE RADIUS (2026-08-11, the illegibility
 * fix). The first face set each label TANGENTIALLY — rotate(a + π/2), so the
 * string ran AROUND the ring and its width had to fit inside the wedge. A
 * wedge is 2·r·sin(π/N) wide: at 54 pegs that was ten texels at the label
 * ring for a string needing eighteen, so every label overran its neighbours
 * and the ring turned to scratches. Radial — rotate(a) — spends the string on
 * the RADIUS, which is 200 texels long, and asks the wedge only for the
 * glyph HEIGHT. At 24 pegs the narrow (inner) end of a "$10" has 35 texels of
 * room for 27 texels of ink. Labels read outward all round, so the lower half
 * hangs upside down exactly as it does on a real money wheel.
 */
export function paintWheelFace(g: CanvasRenderingContext2D, S: number): void {
  const C = S / 2;
  g.fillStyle = '#2a2018'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < N; i++) {
    const lk = SEG_LOOK[WHEEL[i]];
    const a0 = ((i - 0.5) / N) * TAU, a1 = ((i + 0.5) / N) * TAU;
    g.fillStyle = lk.fill;
    g.beginPath(); g.moveTo(C, C);
    g.arc(C, C, C * 0.96, a0, a1); g.closePath(); g.fill();
  }
  // separator lines under the lettering, so a numeral never sits on a seam
  g.strokeStyle = 'rgba(30,22,16,0.8)'; g.lineWidth = Math.max(1, S * 0.005);
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * TAU;
    g.save(); g.translate(C, C); g.rotate(a);
    g.beginPath(); g.moveTo(C * 0.22, 0); g.lineTo(C * 0.96, 0); g.stroke();
    g.restore();
  }
  // THE MONEY, big and radial — the whole point of the rebuild
  g.font = `bold ${Math.round(S * 0.075)}px monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const seg = WHEEL[i];
    const a = (i / N) * TAU;
    g.fillStyle = SEG_LOOK[seg].ink;
    g.save();
    g.translate(C, C); g.rotate(a);
    g.fillText(seg === 'J' ? '★' : SEG_LOOK[seg].label, C * 0.66, 0);
    g.restore();
  }
  // the pegs the flapper rides — one per boundary, so the clack and the
  // maths are the same N
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * TAU;
    g.fillStyle = '#e8c25a';
    g.beginPath();
    g.arc(C + Math.cos(a) * C * 0.93, C + Math.sin(a) * C * 0.93, S * 0.016, 0, TAU);
    g.fill();
  }
  // the hub
  g.fillStyle = '#8a6a22'; g.beginPath(); g.arc(C, C, C * 0.22, 0, TAU); g.fill();
  g.fillStyle = '#c9a45e'; g.beginPath(); g.arc(C, C, C * 0.18, 0, TAU); g.fill();
  g.fillStyle = '#2a2018'; g.font = `bold ${Math.round(S * 0.06)}px monospace`;
  g.fillText('777', C, C);
}

// ─────────────────────────────────────────────────────────────────────────────
// PART FOUR: THE MACHINERY AROUND IT — the slotcab pane pattern, because the
// show here is VERTICAL: the locked view hangs on a tall transparent pane
// covering the real 3D wheel (top, left clear so the head stays the show) and
// the betting counter (bottom, painted live by the same paintBoard the idle
// fascia prints). ESC, [E] and LEAVE always leave; flush() settles on close.

/** the session pane: 1.9 × 2.5 m in the world, 160 px/m both ways */
export const PANE = { w: 304, h: 400 } as const;
/** the wheel circle on the pane, canvas px — clicking it is SPIN */
export const PANE_WHEEL = { x: 152, y: 136, r: 131 } as const;
/** where the live board sits on the pane, canvas px */
export const PANE_BOARD = { x: 28, y: 290, w: 248, h: 105 } as const;

function paintPane(g: Paint2D, w: number, h: number, v: BigSixView): void {
  g.clearRect(0, 0, w, h);
  const s = Math.max(0.1, Math.min(w / PANE.w, h / PANE.h));
  g.save();
  g.translate((w - PANE.w * s) / 2, (h - PANE.h * s) / 2);
  g.scale(s, s);
  // the counter, live, in the bottom of the frame — over its own idle print
  g.save();
  g.translate(PANE_BOARD.x, PANE_BOARD.y);
  const bs = PANE_BOARD.w / BOARD.w;
  g.scale(bs, bs);
  paintBoard(g, BOARD.w, BOARD.h, v);
  g.restore();
  g.restore();
  // everything above stays TRANSPARENT: the 3D wheel is the show
}

function paneHit(x: number, y: number): BoardHit | null {
  if (Math.hypot(x - PANE_WHEEL.x, y - PANE_WHEEL.y) <= PANE_WHEEL.r) return { kind: 'spin' };
  const b = PANE_BOARD;
  if (x < b.x || x >= b.x + b.w || y < b.y || y >= b.y + b.h) return null;
  const bs = b.w / BOARD.w;
  return boardHit((x - b.x) / bs, (y - b.y) / bs);
}

/**
 * THE STANDING WAY IN — ct/int-casino.ts places the [E] spot at the wheel and
 * calls this (the same bridge as blackjack's and roulette's openTable; no
 * cycle: this module imports only ./ctx at runtime). No-op until register().
 */
let openStanding: (() => void) | null = null;
export function openWheel(): void { openStanding?.(); }

export function register(ctx: CtxBuild): void {
  let CHIP = 1;
  // THE BANK IS THE WALLET — same wiring as blackjack and roulette. SPIN
  // takes the bet straight from the purse, wins count straight back in, and
  // flush() on close settles anything owed, including a spin left mid-ride.
  const table = createWheel({
    bank: {
      get: () => Math.floor(ctx.purse.cash / CHIP + 1e-9),
      add: (d) => { ctx.purse.cash += d * CHIP; ctx.refreshWallet(); },
    },
  });
  let panel: Panel | null = null;
  let lastT = -1;
  openStanding = () => panel?.open();

  void Promise.all([import('./hud'), import('./slots')]).then(([{ makePanel }, slots]) => {
    CHIP = slots.CREDIT;               // ONE exchange rate for the whole casino
    panel = makePanel({
      id: 'ct-bigsix',
      w: PANE.w, h: PANE.h, scale: 2,
      chrome: 'none',
      hint: () => (table.view().phase === 'betting'
        ? 'chips on a number, then click the wheel · SPACE spins'
        : 'no more bets'),
      draw: (g, w, h) => paintPane(g, w, h, table.view()),
      // CLICK-ONLY with roulette's one survivor: SPACE spins, nothing else.
      key: (k) => {
        if (k === ' ') { table.spin(); panel?.repaint(); }
      },
      surface: {
        // the tall transparent pane int-casino hangs over the stand — wheel
        // in the upper frame, counter in the lower, slotcab's own trick
        mesh: () => ctx.scene.getObjectByName('bigsix-pane') ?? null,
        // fov 55 at 2.40 m frames the 2.5 m pane exactly: the whole wheel,
        // the counter, the room at the edges — standing where a punter stands
        standoff: 2.40,
        fov: 55,
        hot: (x, y) => {
          const hit = paneHit(x, y);
          if (!hit) return false;
          if (hit.kind === 'leave') return true;
          const v = table.view();
          if (v.phase !== 'betting') return false;
          if (hit.kind === 'spin') return v.bet >= 1 && v.chips >= v.bet;
          if (hit.kind === 'chip') return v.chips >= v.bet + hit.n;
          if (hit.kind === 'clear') return v.bet > 0;
          return true;
        },
        click: (x, y) => {
          const hit = paneHit(x, y);
          if (!hit) return;
          if (hit.kind === 'leave') { panel?.close(); return; }
          if (table.view().phase !== 'betting') return;
          if (hit.kind === 'spin') table.spin();
          else if (hit.kind === 'pick') table.pickSet(hit.seg);
          else if (hit.kind === 'chip') table.betAdd(hit.n);
          else if (hit.kind === 'clear') table.betClear();
          panel?.repaint();
        },
      },
      // money never pools at the counter; flush pays any win still counting
      // and resolves a spin in flight
      onClose: () => { table.flush(); },
    });
  });

  // The room's wheel head and flapper, found by NAME — which is also the
  // audio hook: the head carries userData.speed (rad/s) and the flapper
  // userData.flap (0..1), the ratchet and the clack, watched never imported.
  let head: THREE.Object3D | null | undefined;
  let flap: THREE.Object3D | null | undefined;

  ctx.onFrame((f) => {
    if (!panel) return;
    if (!panel.isOpen()) {
      lastT = -1;
    } else {
      const dt = lastT < 0 ? 0 : Math.max(0, f.t - lastT);
      lastT = f.t;
      table.tick(dt);
      panel.repaint();
    }
    if (head === undefined) head = (ctx.scene.getObjectByName('bigsix-wheel-head') ?? null) as THREE.Object3D | null;
    if (flap === undefined) flap = (ctx.scene.getObjectByName('bigsix-flapper') ?? null) as THREE.Object3D | null;
    if (head) {
      const v = table.view();
      // θ = π/2 + wheelA puts the announced segment under the flapper — the
      // derivation is on paintWheelFace. No idle drift: a Big Six rests on
      // its last answer, which is itself the sign the wheel is honest.
      head.rotation.y = Math.PI / 2 + v.wheel.wheelA;
      head.userData.speed = v.wheel.speed;
      if (flap) {
        // pegs throw the blade AGAINST the spin; it falls back until the next
        flap.rotation.x = -0.55 * v.wheel.flap;
        flap.userData.flap = v.wheel.flap;
      }
    }
  }, HOOK.LATE);

  (globalThis as unknown as Record<string, unknown>).__bigsix = {
    open: () => panel?.open(),
    close: () => panel?.close(),
    view: () => table.view(),
    buyIn: (n: number) => table.buyIn(n),
    spin: () => table.spin(),
    cash: () => ctx.purse.cash,
    chip: () => CHIP,
  };
}
