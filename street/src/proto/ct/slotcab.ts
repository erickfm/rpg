// ORPHEUS CASINO — the slot machines you PULL.
//
// 2026-08-09, Erick: "i want slot to be unique and interesting. all the
// machines are identical. the slots need better shapes and a better more fun
// visual/animation for spins. i think having one of those classic levers with
// a ball handle would be good. ill source sounds but in general make the slot
// machines more fun. you can make them simpler too. less realistic, maybe
// higher winrate but fun should be optimized in the casino"
//
// So this file replaces the sit-down 2D panel machine (ct/slots.ts, which
// stays as a library — blackjack still reads CREDIT off it) with machines that
// are played IN THE WORLD: the lever with the ball handle swings, the reels
// kick, stagger to a stop, and a win strobes the topper and rains coins into
// the tray while the dollars tick straight into your wallet. No credit meter,
// no second account — cash out of the purse per pull, winnings back in.
//
// 2026-08-09, Erick: "SLOTS ARE NOT DIAGETIC locked perspective". So the way
// IN is now the same locked-perspective grammar as blackjack and roulette:
// walk up and press E, or take the stool, and the view locks ONTO THE CABINET
// — face-on with the reel glass, the pay card, the lever at the side. The
// cabinet is the interface: click the lever (or the reel glass, or the printed
// PULL region) to pull, and the session's numbers live on the machine's own
// face — the bet meter and its − / + buttons sit under the reel glass. The
// mechanism is an invisible "session pane" over each cabinet front
// (`slot-face-N`): the panel framework hangs its canvas on it (transparent
// except the printed strip, so the 3D reels, lever, topper and coins stay the
// show), locks the eye onto it, and maps clicks back into cabinet coordinates.
// ESC, [E] and LEAVE all close from every state; standing up closes it too;
// and a spin or payout in flight keeps settling into the purse through the
// world loop below, so leaving mid-payout can never strand a dollar owed.
//
// THE MATHS, enumerated (16^3 = 4,096 stop combinations, uniform draw):
//
//   RTP            94.97%     (3,890 credits back per 4,096 staked)
//   hit rate       28.6%      (nearly one pull in three pays something)
//   JACKPOT 777    150x       1 in 1,024
//   3 BELLS         40x       1 in   512
//   3 BARS          18x       1 in   152
//   3 CHERRIES      10x       1 in   171
//   ANY TWO 7s       5x       1 in    35
//   CHERRY PAIR      5x       1 in    24
//   ONE CHERRY       1x       1 in     5     (your money back — the tick-over)
//   7-7-x tease                1 in    68
//
// Against the old machine's 92.83% / 19% hit rate this is looser and livelier
// on purpose — his words license it — and the house still keeps a nickel of
// every dollar over time.
//
// THREE PERSONALITIES, one pay schedule, three stakes — so the printed cards
// differ in dollars, not in odds, and one enumeration covers the floor:
//
//   CHERRY BELLE   $2  a pull   jackpot   $300   cream + rose, round crown
//   LUCKY 7        $5  a pull   jackpot   $750   oxblood + gold upright
//   KING KACHING   $10 a pull   jackpot $1,500   the wide black-and-gold
//                                                 machine with the lit arch —
//                                                 one on the floor, three
//                                                 months of rent if it lands
//
// AUDIO HOOKS (Erick is sourcing sounds; audio wires by watching named
// objects): every moving part is named and carries userData —
//   `slot-lever-N`  the lever group; rotation.x swings on a pull, and
//                    userData.kind names the personality ('cherry' / 'seven'
//                    / 'king') so each machine can carry its own spin voice
//   `slot-hub-N-L/R` chrome hubs beside the reel window; they spin with the
//                    outer reels (the reel faces are scrolling textures, so
//                    the hubs are the part that physically rotates)
//   `slot-reel-N-0/1/2` the reel planes; userData.speed is stops/sec
//   `slot-topper-N` the topper; userData.flash is true during a win strobe
//   `slot-coins-N`  the coin burst group; visible only while coins fly
//
// RANDOMNESS: Math.random at pull time, NEVER ct/rng.ts — GOTCHAS §2, the
// seeded stream's draw order places every tree and pigeon in the world, and a
// slot machine drawing three numbers a pull would re-plant the street. Coin
// scatter is Math.random too, for the same reason ct/slots.ts spins with it.

import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { ORDER as HOOK } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import type { Panel } from './hud';

// ── the tin ──────────────────────────────────────────────────────────────────

type Sym = 'S' | 'C' | 'B' | 'L' | 'X';   // seven, cherry, bar, bell, blank

const mk = (s: string) => s.split(' ') as Sym[];
/** Three strips of 16, authored by hand. Reel 3 is the short reel: ONE seven,
 *  so two-sevens-and-a-miss (1 in 35, pays 5x) is the tease you live with.
 *  Counts per reel — R1: 2 sevens 4 cherries 3 bars 2 bells 5 blanks;
 *  R2: 2/3/3/2/6; R3: 1/2/3/2/8. The RTP block above is enumerated from
 *  exactly these arrays. */
const STRIPS: readonly (readonly Sym[])[] = [
  mk('S C B X L C B X C S X B L C X X'),
  mk('X C B S X L C X B C X L B X S X'),
  mk('X C X B X L X C B X S X L B X X'),
];
const STOPS = STRIPS[0].length;

const symAt = (reel: number, stop: number): Sym =>
  STRIPS[reel][((Math.round(stop) % STOPS) + STOPS) % STOPS];

/** Pays are per STAKE — best line only, checked best-first. */
function evaluate(a: Sym, b: Sym, c: Sym): { line: string; pays: number } | null {
  if (a === 'S' && b === 'S' && c === 'S') return { line: 'JACKPOT 777', pays: 150 };
  if (a === 'L' && b === 'L' && c === 'L') return { line: '3 BELLS', pays: 40 };
  if (a === 'B' && b === 'B' && c === 'B') return { line: '3 BARS', pays: 18 };
  if (a === 'C' && b === 'C' && c === 'C') return { line: '3 CHERRIES', pays: 10 };
  if ([a, b, c].filter((s) => s === 'S').length === 2) return { line: 'TWO 7s', pays: 5 };
  if (a === 'C' && b === 'C') return { line: 'CHERRY PAIR', pays: 5 };
  if (a === 'C') return { line: 'CHERRY', pays: 1 };
  return null;
}

/** Do the first two reels leave the third one deciding something? The cue for
 *  the anticipation crawl. Reported, never caused: all three stops are drawn
 *  before anything moves, only the PACE of showing them changes. */
const isLive = (s0: number, s1: number): boolean => {
  const a = symAt(0, s0), b = symAt(1, s1);
  if (a === 'C' && b === 'C') return true;
  return a === b && a !== 'X';
};

// ── the feel ─────────────────────────────────────────────────────────────────
// Seconds and stops-per-second, grouped so tuning means moving them together.
const FEEL = {
  spin: 15,          // stops/sec free — ~0.9 revs of a 16-stop strip, a real blur
  ramp: 0.12,
  brake: 0.30,       // constant deceleration into the stop
  bounce: 0.24,      // the clunk: overshoot the detent, get pulled back
  bounceT: 0.13,
  wantFirst: 1.05,   // when reel 1 would like to rest
  gap: 0.48,         // the stagger — the beat between reels
  hold: 1.30,        // the anticipation crawl when the third reel matters
  crawl: 3.2,
  blurAbove: 7,      // stops/sec past which the glass shows the smeared strip
  leverDown: 0.16, leverBack: 0.75,
  payPerSec: (win: number) => Math.min(300, Math.max(8, win / 1.6)),
};

// ── the cabinets ─────────────────────────────────────────────────────────────

export type SlotKind = 'cherry' | 'seven' | 'king';

interface KindSpec {
  name: string; stake: number;
  w: number; h: number; d: number;
  body: number; trim: number; deck: number;
  topper: { w: number; h: number; base: string; lit: number };
}
const KINDS: Record<SlotKind, KindSpec> = {
  cherry: {
    name: 'CHERRY BELLE', stake: 2, w: 0.62, h: 1.42, d: 0.55,
    body: 0xe4d6b4, trim: 0xb42838, deck: 0x8a2430,
    topper: { w: 0.40, h: 0.24, base: '#f2e6c8', lit: 0xffd6dc },
  },
  seven: {
    name: 'LUCKY 7', stake: 5, w: 0.62, h: 1.56, d: 0.55,
    body: 0x701a22, trim: 0xd8a83a, deck: 0x3a1014,
    topper: { w: 0.46, h: 0.28, base: '#2a1014', lit: 0xffc65a },
  },
  king: {
    name: 'KING KACHING', stake: 10, w: 0.95, h: 1.66, d: 0.60,
    body: 0x1c161a, trim: 0xe0b13e, deck: 0x2a2024,
    topper: { w: 0.88, h: 0.40, base: '#14100e', lit: 0xfff0b0 },
  },
};

/** `face` is which way the glass looks: +1 (default) is local +z, −1 is local
 *  −z — the back row of a back-to-back bank. The whole cabinet is one group
 *  rotated about its own base, so lever, tray, coins and pane all turn with
 *  it and the locked view frames the rotated face for free. */
export interface SlotSpec { kind: SlotKind; lx: number; lz: number; face?: 1 | -1 }

/** The minimum this module needs from a room. Structural on purpose: importing
 *  ct/interior.ts here would close interior → int-casino → slotcab → interior,
 *  and GOTCHAS §28 drops a module in that cycle from the BUILT bundle only. */
export interface SlotRoom {
  put: (m: THREE.Object3D, lx: number, y: number, lz: number) => THREE.Object3D;
  wx: (lx: number) => number;
  wz: (lz: number) => number;
  inside: () => boolean;
}

// ── the reel strip, drawn once ───────────────────────────────────────────────
//
// One vertical strip of 16 cells; every reel on the floor is a plane sampling
// a 3-cell window of it through RepeatWrapping, so a reel "spins" by texture
// offset and stops pixel-crisp on its detent. Cell j of the CANVAS holds strip
// index (16 - s) % 16 — reversed, so that increasing pos scrolls the symbols
// DOWNWARD past the window, which is the way a reel actually turns (and the
// same convention ct/slots.ts documents on windowAt).
const CELL = 24;
function drawSym(g: CanvasRenderingContext2D, s: Sym, y: number): void {
  const cx = CELL / 2, cy = y + CELL / 2;
  if (s === 'C') {                                     // two cherries + stems
    g.fillStyle = '#1e5a2e';
    g.fillRect(cx - 1, cy - 9, 2, 5); g.fillRect(cx - 5, cy - 6, 5, 2); g.fillRect(cx + 1, cy - 6, 5, 2);
    g.fillStyle = '#c81e28';
    g.beginPath(); g.arc(cx - 4.5, cy + 1.5, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 4.5, cy + 2.5, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff8a8a'; g.fillRect(cx - 6, cy - 1, 2, 2); g.fillRect(cx + 3, cy, 2, 2);
  } else if (s === 'B') {                              // the black BAR plate
    g.fillStyle = '#16120e'; g.fillRect(3, y + 7, CELL - 6, 10);
    g.fillStyle = '#e8c25a'; g.fillRect(4, y + 8, CELL - 8, 8);
    g.fillStyle = '#16120e';
    g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillText('BAR', cx, y + 15);
  } else if (s === 'L') {                              // the bell
    g.fillStyle = '#e0a626';
    g.fillRect(cx - 2, cy - 9, 4, 3);
    for (let i = 0; i < 7; i++) g.fillRect(cx - 2 - i, cy - 6 + i, 4 + i * 2, 1);
    g.fillRect(cx - 9, cy + 1, 18, 3);
    g.fillStyle = '#8a5a10'; g.fillRect(cx - 2, cy + 4, 4, 3);
    g.fillStyle = '#fff0b0'; g.fillRect(cx - 5, cy - 4, 2, 4);
  } else if (s === 'S') {                              // the red seven
    g.fillStyle = '#e02818';
    g.fillRect(cx - 8, cy - 9, 16, 5);
    for (let i = 0; i < 12; i++) g.fillRect(cx + 6 - Math.floor(i * 0.9) - 4, cy - 4 + i, 5, 1);
    g.fillStyle = '#ff9c84'; g.fillRect(cx - 8, cy - 9, 16, 1);
  }
  // blank: bare reel tin, nothing drawn
}
// Three crisp canvases, one per strip — the glass shows the SAME tin the maths
// draws from, which is the whole honesty of a visible reel. Plus one smeared
// strip shared by every reel at speed: past FEEL.blurAbove nothing is readable
// anyway, so a blur of strip 1 serves all three.
let STRIP_TEX: THREE.Texture[] | null = null;
let STRIP_BLUR: THREE.Texture | null = null;
function stripFor(reel: number): THREE.Texture {
  if (!STRIP_TEX) {
    STRIP_TEX = STRIPS.map((strip) => declareSurface(pixTex(CELL, CELL * STOPS, (g) => {
      g.fillStyle = '#f4efe0'; g.fillRect(0, 0, CELL, CELL * STOPS);
      g.fillStyle = '#d8d0ba';
      for (let j = 0; j < STOPS; j++) g.fillRect(0, j * CELL, CELL, 1);
      for (let j = 0; j < STOPS; j++) drawSym(g, strip[(STOPS - j) % STOPS], j * CELL);
      dither(g, CELL, CELL * STOPS, 26);
    }), 'detail'));
  }
  return STRIP_TEX[reel];
}
function stripBlur(): THREE.Texture {
  if (!STRIP_BLUR) {
    STRIP_BLUR = declareSurface(pixTex(CELL, CELL * STOPS, (g) => {
      g.fillStyle = '#f4efe0'; g.fillRect(0, 0, CELL, CELL * STOPS);
      for (let j = 0; j < STOPS; j++) {
        const s = STRIPS[0][(STOPS - j) % STOPS];
        // the symbol dragged through the cell at low alpha — what a spinning
        // reel actually looks like through the glass
        g.globalAlpha = 0.30;
        for (const dy of [-7, -3, 1, 5, 9]) drawSym(g, s, j * CELL + dy);
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(244,239,224,0.35)'; g.fillRect(0, 0, CELL, CELL * STOPS);
      dither(g, CELL, CELL * STOPS, 26);
    }), 'detail');
  }
  return STRIP_BLUR;
}

// ── one machine ──────────────────────────────────────────────────────────────

interface Reel {
  pos: number; start: number; stop: number; spinning: boolean;
  rampT: number; cruiseT: number; crawlT: number;
  dRamp: number; dCruise: number; dCrawl: number; dBrake: number;
  vEnter: number; stopT: number; bounce: number;
  mesh: THREE.Mesh; crisp: THREE.Texture; blurT: THREE.Texture; blurred: boolean;
}

interface Machine {
  kind: KindSpec; i: number;
  group: THREE.Group;
  reels: Reel[];
  lever: THREE.Group;
  /** the invisible session pane the locked view hangs its canvas on */
  pane: THREE.Mesh;
  hubs: [THREE.Mesh, THREE.Mesh];
  topper: THREE.Mesh; topperM: THREE.MeshBasicMaterial; topperLit: THREE.Color;
  /** bet multiplier, 1–3 × the cabinet's base stake — 2026-08-10: "i just
   *  want to be able to set the bet and spin ez pz" */
  bet: number;
  /** the real − and + bet caps [dn, up]: mesh, rest z, and press clock — -1
   *  idle, -2 latched by a click (the handler has no frame time), else the
   *  f.t the press began; the frame hook turns the latch into travel */
  caps: { mesh: THREE.Mesh; z: number; t: number }[];
  bulbs: THREE.MeshBasicMaterial[];      // three phase materials, chased
  winCv: HTMLCanvasElement; winTex: THREE.CanvasTexture;
  coins: THREE.Group | null; coinSeed: { a: number; v: number; s: number }[];
  state: 'idle' | 'spinning' | 'paying';
  t: number;                              // seconds since the lever went
  win: number; paid: number; payRamp: number; flashT: number;
  attractT: number; attractIx: number; nearMiss: boolean;
  msg: string;
}

const mod1 = (v: number) => ((v % 1) + 1) % 1;

/** Where a reel is at machine-time tt — a pure schedule, never integrated, so
 *  any dt lands on the same symbol (the property ct/slots.ts derives at length
 *  from GOTCHAS §30/§43). */
function posOf(r: Reel, tt: number): number {
  if (!r.spinning) return r.pos;
  const tR = r.rampT, tCr = tR + r.cruiseT, tCl = tCr + r.crawlT;
  const tB = tCl + FEEL.brake, tE = tB + FEEL.bounceT;
  if (tt <= 0) return r.start;
  if (tt < tR) return r.start + FEEL.spin * tt * tt / (2 * r.rampT);
  if (tt < tCr) return r.start + r.dRamp + FEEL.spin * (tt - tR);
  if (tt < tCl) return r.start + r.dRamp + r.dCruise + FEEL.crawl * (tt - tCr);
  const base = r.start + r.dRamp + r.dCruise + r.dCrawl;
  if (tt < tB) {
    const q = tt - tCl;
    return base + r.vEnter * q - (r.vEnter / (2 * FEEL.brake)) * q * q;
  }
  if (tt < tE) {
    const k = (tt - tB) / FEEL.bounceT;
    return base + r.dBrake - r.bounce * (1 - (1 - k) ** 2);
  }
  return base + r.dBrake - r.bounce;
}

/** Schedule a reel to rest ON `target` at or after `want` — worked backwards
 *  from the detent so the brake distance is fixed and the order of the three
 *  reels is a guarantee, not three constants that happen not to overlap. */
function schedule(r: Reel, target: number, want: number, hold: boolean, nearMiss: boolean): number {
  r.start = r.pos; r.stop = target; r.spinning = true;
  r.rampT = FEEL.ramp; r.dRamp = FEEL.spin * FEEL.ramp / 2;
  r.crawlT = hold ? FEEL.hold : 0;
  r.dCrawl = hold ? FEEL.crawl * FEEL.hold : 0;
  r.vEnter = hold ? FEEL.crawl : FEEL.spin;
  r.dBrake = r.vEnter * FEEL.brake / 2;
  r.bounce = nearMiss ? 0.5 : FEEL.bounce;   // the near-miss lands harder
  const fixed = r.dRamp + r.dCrawl + r.dBrake - r.bounce;
  const need = ((target - r.start) % STOPS + STOPS) % STOPS;
  const other = r.rampT + r.crawlT + FEEL.brake + FEEL.bounceT;
  const byDist = (fixed - need) / STOPS;
  const byTime = (fixed + (want - other) * FEEL.spin - need) / STOPS;
  const n = Math.max(0, Math.ceil(Math.max(byDist, byTime) - 1e-9));
  r.dCruise = need + n * STOPS - fixed;
  r.cruiseT = r.dCruise / FEEL.spin;
  r.stopT = other + r.cruiseT;
  return r.stopT;
}

// ── building a cabinet ───────────────────────────────────────────────────────

const bm = (c: number) => new THREE.MeshBasicMaterial({ color: c });

function payCard(ctx: CtxBuild, k: KindSpec): THREE.MeshBasicMaterial {
  // The pay table PRINTED ON THE MACHINE, in dollars at this cabinet's stake —
  // a machine that hides its odds is a machine you don't trust with $10.
  const t = declareSurface(pixTex(96, 84, (g) => {
    g.fillStyle = '#f2e6c8'; g.fillRect(0, 0, 96, 84);
    g.fillStyle = '#8a2430'; g.fillRect(0, 0, 96, 11);
    g.fillStyle = '#f2e6c8'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    // the bet is settable now (1–3 × the stake), so the card prints the
    // range and pays in MULTIPLES OF YOUR BET — honest at every bet, where
    // dollar rows were only true at 1x
    g.fillText(`BET $${k.stake}-$${k.stake * 3}`, 48, 8);
    const rows: [string, number][] = [
      ['7 7 7', 150], ['BELL BELL BELL', 40], ['BAR BAR BAR', 18],
      ['CHERRY x3', 10], ['ANY TWO 7s', 5], ['CHERRY PAIR', 5], ['ONE CHERRY', 1],
    ];
    g.font = '6px monospace';
    rows.forEach(([line, pays], i) => {
      const y = 20 + i * 9;
      g.fillStyle = i === 0 ? '#8a2430' : '#3a2a1e';
      g.textAlign = 'left'; g.fillText(line, 4, y);
      g.textAlign = 'right'; g.fillText(pays + 'x', 92, y);
    });
    g.fillStyle = '#8a6a2c'; g.fillRect(2, 13, 92, 1); g.fillRect(2, 80, 92, 1);
    dither(g, 96, 84, 18);
  }), 'sign');
  return ctx.flat(t);
}

function topperTex(k: KindSpec, kind: SlotKind): THREE.Texture {
  return declareSurface(pixTex(64, 28, (g) => {
    g.fillStyle = k.topper.base; g.fillRect(0, 0, 64, 28);
    g.textAlign = 'center';
    if (kind === 'cherry') {
      g.fillStyle = '#b42838'; g.font = 'bold 9px monospace';
      g.fillText('CHERRY', 32, 11); g.fillText('BELLE', 32, 22);
      g.fillStyle = '#c81e28';
      g.beginPath(); g.arc(8, 20, 4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(56, 20, 4, 0, Math.PI * 2); g.fill();
    } else if (kind === 'seven') {
      g.fillStyle = '#ffc65a'; g.font = 'bold 16px monospace';
      g.fillText('7 7 7', 32, 19);
      g.fillStyle = '#e02818'; g.fillRect(0, 25, 64, 3); g.fillRect(0, 0, 64, 3);
    } else {
      // 8 px, not 11 — '$1500 JACKPOT' at 11 px is 91 px of type on a 64 px
      // canvas and the first look shot read '.500 JACKPO'
      g.fillStyle = '#ffe89a'; g.font = 'bold 8px monospace';
      g.fillText('KING KACHING', 32, 10);
      g.fillStyle = '#fff0b0'; g.font = 'bold 8px monospace';
      g.fillText('$1500 JACKPOT', 32, 22);
    }
    dither(g, 64, 28, 20);
  }), 'sign');
}

/** a bet cap's printed glyph (− or +) — trim-colour plastic, convex shading,
 *  ink picked off the trim's own green channel (gold caps read best under
 *  ink, dark red ones under cream), same rule the COLLECT cap this replaces
 *  used. fillRect bars, not font glyphs, so the mark stays pixel-crisp. */
function betCapTex(k: KindSpec, up: boolean): THREE.Texture {
  const hex = '#' + k.trim.toString(16).padStart(6, '0');
  const ink = ((k.trim >> 8) & 0xff) > 0x80 ? '#14100e' : '#f2e6c8';
  return declareSurface(pixTex(24, 24, (g) => {
    g.fillStyle = hex; g.fillRect(0, 0, 24, 24);
    g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(0, 0, 24, 3);   // convex: lit crown
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 3, 24, 8);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 21, 24, 3);        // and shade
    g.fillStyle = ink;
    g.fillRect(6, 10, 12, 4);                                          // −
    if (up) g.fillRect(10, 6, 4, 12);                                  // +
    dither(g, 24, 24, 16);
  }), 'detail');
}

function buildCabinet(ctx: CtxBuild, room: SlotRoom, spec: SlotSpec, i: number): Machine {
  const k = KINDS[spec.kind];
  const g = new THREE.Group();
  const W = k.w, H = k.h, D = k.d;
  const trimM = bm(k.trim), bodyM = bm(k.body), deckM = bm(k.deck);
  const dark = bm(0x14100e);

  // body: front face carries a painted panel; a plain slab reads as a slab
  const frontT = declareSurface(pixTex(24, 48, (g2) => {
    const hex = '#' + k.body.toString(16).padStart(6, '0');
    g2.fillStyle = hex; g2.fillRect(0, 0, 24, 48);
    g2.fillStyle = 'rgba(0,0,0,0.22)'; g2.fillRect(1, 1, 22, 46);
    g2.fillStyle = hex; g2.fillRect(2, 2, 20, 44);
    g2.fillStyle = 'rgba(255,255,255,0.08)'; g2.fillRect(0, 0, 24, 1);
    g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(0, 42, 24, 6);
    dither(g2, 24, 48, 30);
  }), 'detail');
  const sideM = ctx.flat(frontT);
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
    [sideM, sideM, bm(k.trim), sideM, ctx.flat(frontT.clone()), sideM]);
  body.position.y = H / 2;
  g.add(body);
  // plinth
  const pl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.09, D + 0.05), dark);
  pl.position.y = 0.045; g.add(pl);

  // the crown: what makes the three silhouettes different across the room
  if (spec.kind === 'cherry') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, D - 0.06, 12, 1, false, 0, Math.PI), trimM);
    crown.rotation.z = Math.PI / 2; crown.rotation.y = Math.PI / 2;
    crown.position.set(0, H, 0);
    g.add(crown);
  } else if (spec.kind === 'king') {
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), trimM);
      post.position.set(sx * (W / 2 - 0.06), H + 0.22, 0); g.add(post);
    }
  }

  // the topper, lit from inside — its material colour is the win strobe
  const topT = topperTex(k, spec.kind);
  const topperM = new THREE.MeshBasicMaterial({ map: topT });
  const topper = new THREE.Mesh(new THREE.BoxGeometry(k.topper.w, k.topper.h, 0.10),
    [trimM, trimM, trimM, trimM, topperM, trimM]);
  const topY = spec.kind === 'cherry' ? H + W / 2 + k.topper.h / 2 - 0.03
    : spec.kind === 'king' ? H + 0.47 + k.topper.h / 2 : H + k.topper.h / 2 + 0.02;
  topper.position.set(0, topY, 0.02);
  topper.name = `slot-topper-${i}`;
  topper.userData.flash = false;
  g.add(topper);

  // marquee bulbs round the topper — three phase materials, chased in tick()
  const bulbs = [bm(0x7a6438), bm(0x7a6438), bm(0x7a6438)];
  const bulbGeo = new THREE.SphereGeometry(0.022, 5, 4);
  const nB = spec.kind === 'king' ? 9 : 5;
  for (let b = 0; b < nB; b++) {
    const m = new THREE.Mesh(bulbGeo, bulbs[b % 3]);
    const bx = -k.topper.w / 2 + (b / (nB - 1)) * k.topper.w;
    m.position.set(bx, topY + k.topper.h / 2 + 0.03, 0.03);
    g.add(m);
  }

  // ── the reel window ──
  //
  // 0.78 of the cabinet, not 0.72 — measured off the first look shots: a
  // standing eye at 1.62 m less than a metre from the face was looking clean
  // over the glass. At 0.78 of the taller cabinets the payline sits at
  // 1.11–1.29 m: bottom third of a standing frame, dead centre of a seated one.
  const winY = H * 0.78, reelW = 0.145, reelH = 0.30, gap = 0.015;
  const span3 = reelW * 3 + gap * 2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(span3 + 0.05, reelH + 0.05), dark);
  back.position.set(0, winY, D / 2 + 0.004); g.add(back);
  const reels: Reel[] = [];
  for (let r = 0; r < 3; r++) {
    const crisp = stripFor(r).clone();
    crisp.wrapS = THREE.ClampToEdgeWrapping; crisp.wrapT = THREE.RepeatWrapping;
    crisp.repeat.set(1, 3 / STOPS); crisp.needsUpdate = true;
    const blurT = stripBlur().clone();
    blurT.wrapS = THREE.ClampToEdgeWrapping; blurT.wrapT = THREE.RepeatWrapping;
    blurT.repeat.set(1, 3 / STOPS); blurT.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: crisp });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(reelW, reelH), mat);
    mesh.position.set((r - 1) * (reelW + gap), winY, D / 2 + 0.010);
    mesh.name = `slot-reel-${i}-${r}`;
    mesh.userData.speed = 0;
    g.add(mesh);
    reels.push({
      pos: (r * 5 + i * 3) % STOPS, start: 0, stop: 0, spinning: false,
      rampT: 0, cruiseT: 0, crawlT: 0, dRamp: 0, dCruise: 0, dCrawl: 0, dBrake: 0,
      vEnter: 0, stopT: 0, bounce: FEEL.bounce, mesh, crisp, blurT, blurred: false,
    });
  }
  // gold frame round the glass, and the payline nicks either side
  const fw = 0.02;
  for (const [bw, bh, bx, by] of [
    [span3 + 0.10, fw, 0, winY + reelH / 2 + fw / 2],
    [span3 + 0.10, fw, 0, winY - reelH / 2 - fw / 2],
    [fw, reelH + 0.10, -(span3 / 2 + fw / 2 + 0.02), winY],
    [fw, reelH + 0.10, span3 / 2 + fw / 2 + 0.02, winY],
  ] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.02), trimM);
    m.position.set(bx, by, D / 2 + 0.008); g.add(m);
  }
  for (const sx of [-1, 1]) {
    const nick = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.014, 0.02), bm(0xe02818));
    nick.position.set(sx * (span3 / 2 + 0.02), winY, D / 2 + 0.016); g.add(nick);
  }
  // the chrome hubs beside the glass — the reels' PHYSICALLY rotating part,
  // which is what an audio watcher (and the eye) gets instead of a flat plane
  const hubGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.035, 8);
  const hubM = bm(0xb8b4a8);
  const hubs: [THREE.Mesh, THREE.Mesh] = [
    new THREE.Mesh(hubGeo, hubM), new THREE.Mesh(hubGeo, hubM)];
  hubs[0].position.set(-(span3 / 2 + 0.055), winY, D / 2 + 0.002);
  hubs[1].position.set(span3 / 2 + 0.055, winY, D / 2 + 0.002);
  hubs[0].rotation.z = Math.PI / 2; hubs[1].rotation.z = Math.PI / 2;
  hubs[0].name = `slot-hub-${i}-L`; hubs[1].name = `slot-hub-${i}-R`;
  g.add(hubs[0], hubs[1]);

  // ── the win window: a live little sign over the glass ──
  const winCv = document.createElement('canvas');
  winCv.width = 64; winCv.height = 14;
  const winTex = new THREE.CanvasTexture(winCv);
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.magFilter = THREE.NearestFilter; winTex.minFilter = THREE.NearestFilter;
  const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.08),
    new THREE.MeshBasicMaterial({ map: winTex }));
  winMesh.position.set(0, winY + reelH / 2 + 0.085, D / 2 + 0.012);
  g.add(winMesh);

  // ── deck, tray ──
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.10, 0.16), deckM);
  deck.position.set(0, H * 0.52, D / 2 + 0.05); deck.rotation.x = -0.5; g.add(deck);
  const payM = payCard(ctx, k);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, W * 0.8 * 84 / 96), payM);
  card.position.set(0, H * 0.31, D / 2 + 0.006); g.add(card);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.05, 0.10), dark);
  tray.position.set(0, 0.30, D / 2 + 0.05); g.add(tray);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.05, 0.02), trimM);
  lip.position.set(0, 0.32, D / 2 + 0.10); g.add(lip);

  // ── THE BET HARDWARE. 2026-08-10, on the credit meter + COLLECT this
  // replaces: "janky ass money screen and whats the collect button? like i
  // just want to be able to set the bet and spin ez pz". COLLECT never had a
  // job — the machine pays the purse direct, the button was only a decorated
  // exit — and the cash meter duplicated the wallet HUD. Gone, both. What
  // the fascia carries now is the ONE control the game actually has, and it
  // reads as one part: a stepper centred under the reel glass — real − cap,
  // small recessed BET glass, real + cap. Same day, on the first (left-bay,
  // band-height) meter: "bet window here is too big. pls make smaller" — so
  // the glass is digit-sized now, and flanked by the caps it needs no BET
  // silkscreen: − $N + explains itself.
  const bp = bandParts(k);
  const chrome = bm(0xb8b4a8);
  const wellOf = (r: { cx: number; cy: number; w: number; h: number }): void => {
    const well = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.018, r.h + 0.018, 0.012), dark);
    well.position.set(r.cx, r.cy, D / 2 + 0.004);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.008, r.h + 0.008, 0.018), chrome);
    ring.position.set(r.cx, r.cy, D / 2 + 0.006);
    g.add(well, ring);
  };
  wellOf(bp.meter);
  // front face at +0.018, PROUD of the ring's +0.015 — the "ring" is a solid
  // chrome plate, and at +0.013 it hid the glass completely: Erick's 15:07
  // screenshot shows the meter as a bare grey slab, no glass, no dark window
  const glass = new THREE.Mesh(new THREE.BoxGeometry(bp.meter.w, bp.meter.h, 0.016), bm(0x0c0805));
  glass.position.set(bp.meter.cx, bp.meter.cy, D / 2 + 0.010);
  g.add(glass);
  const capZ = D / 2 + 0.014;   // front face at +0.024: proud of the fascia,
                                // a hair shy of the payline nicks' +0.026
  const caps = [bp.dn, bp.up].map((r, ci) => {
    wellOf(r);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, 0.020),
      [trimM, trimM, trimM, trimM, new THREE.MeshBasicMaterial({ map: betCapTex(k, ci === 1) }), trimM]);
    cap.position.set(r.cx, r.cy, capZ);
    cap.name = ci === 1 ? `slot-bet-up-${i}` : `slot-bet-dn-${i}`;
    g.add(cap);
    return { mesh: cap, z: capZ, t: -1 };
  });

  // ── THE LEVER, with the ball handle. The play verb lives here. ──
  //
  // On local +x, which IS the player's right when facing the machine — where a
  // one-armed bandit's arm has always been. It sat at −x with a comment
  // claiming that was the right hand; the locked-view calibration shot
  // (2026-08-09) measured −x landing on the SCREEN LEFT, and Erick called it:
  // "the lever is on the wrong side."
  // …and at the FRONT corner of the side, not mid-depth: at z 0.04 the body's
  // own side face hid the whole arm from the locked view's near-frontal eye
  // (the sightline crossed the side plane before it reached the ball). 0.03
  // off the corner, because the composed lock now looks dead down the
  // cabinet's axis and the KING's deep side is nearly edge-on from there —
  // any further back and his arm vanishes again.
  const leverZ = D / 2 - 0.03;
  const lever = new THREE.Group();
  lever.position.set(W / 2 + 0.05, H * 0.74, leverZ);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.12), bm(0x8a8478));
  housing.position.set(W / 2 + 0.035, H * 0.74, leverZ);   // half-buried in the side
  g.add(housing);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.34, 6), bm(0xc8c4b8));
  arm.position.y = 0.17;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), bm(0xc81e28));
  ball.position.y = 0.36;
  lever.add(arm, ball);
  // Rest at a slight back-lean: upright (−0.06) put the ball at the very top
  // edge of the composed frame and cropped it in half; −0.30 (with the old
  // mid-depth mount) hid the whole arm behind the body. −0.10 at the front
  // corner keeps the ball inside the frame on all three kinds and clear of
  // the silhouette. tickLever's `rest` is the same value.
  lever.rotation.x = -0.10;
  lever.name = `slot-lever-${i}`;
  // which personality this cabinet is — ct/audio.ts keys the per-kind spin
  // arp off this (2026-08-10, *"use them so there's sounds unique to each
  // type of machine"*): the same watched-never-imported contract as `speed`
  // and `flash` above, published where the watcher already looks.
  lever.userData.kind = spec.kind;
  g.add(lever);

  // ── the session pane — see "the locked session" below. Invisible until the
  // panel framework borrows its material; per-machine material on purpose (a
  // shared one would paint one session onto fifteen faces), shared empty map.
  const spw = paneW(k), sph = spw / PANE_RATIO;
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(spw, sph),
    new THREE.MeshBasicMaterial({ map: emptyPane(), transparent: true, depthWrite: false }));
  // symmetric about the cabinet's centreline (the lock looks dead-on the
  // axis) and reaching 0.18 past the body both sides, so the lever at +x is
  // clickable; in front of every face mesh (the payline nicks are the
  // proudest at +0.016); the lever swings in y/z, never crossing the pane
  pane.position.set(0, paneYMin(k) + sph / 2, D / 2 + 0.022);
  pane.name = `slot-face-${i}`;
  g.add(pane);

  room.put(g, spec.lx, 0, spec.lz);
  // a back-row machine faces −z: one turn of the group about its own base and
  // every child — reels, lever (still the machine's own right), pane — follows
  if (spec.face === -1) g.rotation.y = Math.PI;

  const m: Machine = {
    kind: k, i, group: g, reels, lever, hubs, pane,
    topper, topperM, topperLit: new THREE.Color(k.topper.lit),
    bet: 1, caps,
    bulbs,
    winCv, winTex, coins: null, coinSeed: [],
    state: 'idle', t: 0, win: 0, paid: 0, payRamp: 0, flashT: 0,
    attractT: 1.6 * ((i % 4) / 4), attractIx: i % 3, nearMiss: false, msg: '',
  };
  say(m, `$${k.stake} A PULL`);
  return m;
}

function say(m: Machine, text: string, hot = false): void {
  if (text === m.msg) return;
  m.msg = text;
  const g = m.winCv.getContext('2d')!;
  g.fillStyle = '#100a0c'; g.fillRect(0, 0, 64, 14);
  g.fillStyle = hot ? '#ffd24a' : '#e0533e';
  g.font = 'bold 8px monospace'; g.textAlign = 'center';
  g.fillText(text, 32, 10);
  m.winTex.needsUpdate = true;
}

// ── coins ────────────────────────────────────────────────────────────────────

function burstCoins(m: Machine): void {
  if (!m.coins) {
    m.coins = new THREE.Group();
    m.coins.name = `slot-coins-${m.i}`;
    const geo = new THREE.CylinderGeometry(0.021, 0.021, 0.006, 8);
    const gold = bm(0xe8c25a);
    for (let c = 0; c < 12; c++) m.coins.add(new THREE.Mesh(geo, gold));
    m.group.add(m.coins);
  }
  m.coinSeed = [];
  for (let c = 0; c < 12; c++) {
    m.coinSeed.push({ a: Math.random() * Math.PI * 2, v: 0.5 + Math.random() * 0.9, s: Math.random() * 0.25 });
  }
  m.coins.visible = true;
}

function tickCoins(m: Machine, sincePay: number): void {
  if (!m.coins || !m.coins.visible) return;
  const D = m.kind.d;
  let alive = false;
  m.coins.children.forEach((c, ix) => {
    const s = m.coinSeed[ix];
    const t = sincePay - s.s;
    if (t < 0) { c.visible = false; return; }
    if (t > 1.15) { c.visible = t < 2.2; alive = alive || t < 2.2;   // resting in the tray
      c.position.set(Math.cos(s.a) * 0.10, 0.335, D / 2 + 0.05 + Math.sin(s.a) * 0.02);
      c.rotation.set(0, s.a, 0); return; }
    alive = true;
    const tt = Math.min(t, 1.15);
    c.visible = true;
    // out of the mouth, up, and down into the tray
    c.position.set(
      Math.cos(s.a) * 0.06 * tt / 1.15 * 2,
      0.52 + s.v * tt - 2.6 * tt * tt,
      D / 2 + 0.02 + 0.05 * tt / 1.15,
    );
    if (c.position.y < 0.335) c.position.y = 0.335;
    c.rotation.set(tt * 7 + s.a, s.a, 0);
  });
  if (!alive && sincePay > 2.4) m.coins.visible = false;
}

// ── the locked session ───────────────────────────────────────────────────────
//
// 2026-08-09: "SLOTS ARE NOT DIAGETIC locked perspective". The same grammar
// blackjack and roulette moved to the same day: E (or the stool) locks the eye
// onto the machine, the machine's own face is the interface, LEAVE/ESC/[E]
// always leave, standing up leaves too.
//
// The surface is the SESSION PANE: one invisible plane per cabinet, covering
// the PLAYING FACE — the reel glass, the win sign over it, the readout strip
// under it — and reaching past the body on the lever's side (+x, the player's
// right), so a click "on the lever" lands on it. Its material is transparent
// with an empty map — nothing of it exists until the panel framework borrows
// it, hangs the session canvas on it, and the canvas itself is transparent
// everywhere except the printed strip, so the 3D reels, lever and coin burst
// stay the show. ONE aspect for all three personalities (the pane grows with
// the cabinet, the proportions do not), so one canvas serves the floor
// without stretching. The lock frames the pane, which is why it covers the
// playing face and NOT the whole cabinet: "then also closer disgetic
// persprective on the slots" — face in the machine, reel glass dominant, the
// pay card at the bottom edge of frame or just out of it.
//
// ⚠ The panel id is 'ct-slotcab', NOT 'ct-slots' — the retired ct/slots.ts
// panel already owns the #ct-slots DOM node, and makePanel REUSES a wrap by
// id: two specs sharing one canvas left this one painting a 168-wide layout
// onto the old 320×483 face, which is exactly the quarter-scale strip
// floating off the cabinet's edge in Erick's screenshot.

// ── THE COMPOSED FRAME ── 2026-08-10: "also the diagetic view is worse than
// the sit down view." Looked at, not assumed: the stool lock and the E lock
// were already pixel-identical, and the retired sit-down panel cannot even
// open — so the comparison is against the DESIGNED face the old panel had:
// dead-on, composed, legible. The first locked view was photographed instead:
// the pane was biased toward the lever so the camera stood 7 cm off the
// cabinet's axis, the glass sat below centre, and fov 70 at 0.7 m made the
// neighbours loom and the verticals splay. So now:
//   · the pane is SYMMETRIC about the cabinet's centreline — the eye is
//     dead-on the axis, like a face you sat down in front of;
//   · the reel glass sits a breath above frame centre, the readout band in
//     the lower third, the win sign in the upper — composed, not cropped;
//   · the lock is a TELEPHOTO: fov 50, stood off so the pane exactly fills
//     the frame height. Flat verticals, one machine, the room at the edges.

/** pane width / height — one proportion for every kind, so one canvas serves */
const PANE_RATIO = 1.04;
/** the lock's field of view; standoffFor derives the exact framing distance */
const PANE_FOV = 50;
/** the one session canvas, square texels on every kind by the shared ratio */
const SESSION_PX = { w: 250, h: 240 } as const;

const paneW = (k: KindSpec): number => k.w + 0.36;
const paneXMin = (k: KindSpec): number => -(k.w / 2 + 0.18);

/**
 * THE FRAME IS THE FACE BETWEEN THE PAY CARD AND THE WIN SIGN — derived from
 * the same numbers the geometry is built with, per kind, so the KING's tall
 * belly card cannot drift back into shot (it did: his card came up under the
 * caption, the exact collision the first pass had). Bottom edge a hair above
 * the card's top, top edge a hair over the sign, centre between them.
 */
function faceFrame(k: KindSpec): { center: number; frameH: number } {
  const cardTop = k.h * 0.31 + (k.w * 0.8 * 84 / 96) / 2;
  const signTop = k.h * 0.78 + 0.275;
  const bottom = cardTop - 0.01, top = signTop + 0.045;
  return { center: (top + bottom) / 2, frameH: top - bottom };
}
const paneYMin = (k: KindSpec): number =>
  faceFrame(k).center - paneW(k) / PANE_RATIO / 2;
/** the standoff at which fov PANE_FOV frames exactly the face */
const standoffFor = (k: KindSpec): number =>
  faceFrame(k).frameH / (2 * Math.tan((PANE_FOV / 2) * Math.PI / 180));

let PANE_TEX: THREE.Texture | null = null;
/** a 1×1 fully-transparent map — the pane while nobody is locked onto it */
function emptyPane(): THREE.Texture {
  if (!PANE_TEX) {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    PANE_TEX = new THREE.CanvasTexture(c);
  }
  return PANE_TEX;
}

interface Rect { x: number; y: number; w: number; h: number }
interface SessionLay { bet: Rect; dn: Rect; up: Rect; lever: Rect; glass: Rect }
const inR = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// ── the hardware band under the reel glass — the − / BET / + stepper.
// ONE source for buildCabinet's geometry and layFor's click rects.
//
// The band's world height scales with the pane, so every kind lands the
// SAME canvas pixels; only its centreline places the stepper now (the parts
// size themselves in bandParts, on the same scaling rule). The rule's
// origin: fixed at 0.097 m the KING's coarser face (fewest texels/metre)
// rounded to a shorter window, seg thickness floor'd to 1, and the
// 2026-08-10 QC sweep showed half-height digits swimming in a long dead
// glass while the cherry's filled its meter.
function bandOf(k: KindSpec): { yHi: number; yLo: number } {
  const yHi = k.h * 0.78 - 0.178;
  return { yHi, yLo: yHi - 0.099 * paneW(k) };
}
/** The band's three parts, world rects on the fascia: one stepper, centred
 *  on the cabinet's axis — − cap, BET glass, + cap. The caps are ONE
 *  standard part on every cabinet (the same parts-bin button on the $2 and
 *  the $10 machine, which is how 1997 cabinets were actually built). The
 *  glass is sized to its digits and nothing more — 2026-08-10, on the
 *  band-height left-bay meter this replaces: "bet window here is too big.
 *  pls make smaller". Its dims scale with the pane so every kind lands the
 *  same canvas pixels (~26×17, seg thickness 1 — same guard as bandOf's
 *  note on the KING's coarse face). */
function bandParts(k: KindSpec): { meter: BRect; dn: BRect; up: BRect } {
  const { yHi, yLo } = bandOf(k);
  const cy = (yHi + yLo) / 2;
  const bw = 0.066, bh = 0.06, gap = 0.014;
  const mw = 0.105 * paneW(k), mh = 0.066 * paneW(k);
  const off = mw / 2 + gap + bw / 2 + 0.009;    // past the caps' own rings
  return {
    meter: { cx: 0, cy, w: mw, h: mh },
    dn: { cx: -off, cy, w: bw, h: bh },
    up: { cx: off, cy, w: bw, h: bh },
  };
}
interface BRect { cx: number; cy: number; w: number; h: number }

/** Where everything sits on the session canvas, derived from the SAME numbers
 *  buildCabinet places the geometry with — the lever region is where the lever
 *  IS, per kind, not a hand-typed pixel box. Cached per personality. */
const LAYS = new Map<KindSpec, SessionLay>();
function layFor(k: KindSpec): SessionLay {
  let L = LAYS.get(k);
  if (L) return L;
  const xMin = paneXMin(k), pw = paneW(k), ph = pw / PANE_RATIO;
  const yMax = paneYMin(k) + ph;
  const X = (lx: number) => ((lx - xMin) / pw) * SESSION_PX.w;
  const Y = (ly: number) => ((yMax - ly) / ph) * SESSION_PX.h;
  // WHOLE CANVAS PIXELS — a rect on a fraction is painted antialiased, and
  // the KING's face (fewest texels per metre) showed it as fuzz on every edge
  const box = (x0: number, x1: number, yLo: number, yHi: number): Rect => {
    const x = Math.round(X(x0)), y = Math.round(Y(yHi));
    return { x, y, w: Math.round(X(x1)) - x, h: Math.round(Y(yLo)) - y };
  };
  const winY = k.h * 0.78;
  const span3 = 0.145 * 3 + 0.015 * 2;
  // the machine parts on the body under the reel glass — all REAL GEOMETRY
  // now (see THE BET HARDWARE in buildCabinet): the bet meter's rect is
  // where paintSession lights the digits behind the built glass, and the
  // − / + click rects are derived from the same bandParts the caps are
  // built with, padded a centimetre so the chrome ring presses too. The
  // stake is already silkscreened on the belly card and the attract sign,
  // so no printed PULL: the lever is the pull.
  const bp = bandParts(k);
  const pad = (r: BRect): Rect => box(r.cx - r.w / 2 - 0.012, r.cx + r.w / 2 + 0.012,
    r.cy - r.h / 2 - 0.012, r.cy + r.h / 2 + 0.012);
  L = {
    bet: box(bp.meter.cx - bp.meter.w / 2, bp.meter.cx + bp.meter.w / 2,
      bp.meter.cy - bp.meter.h / 2, bp.meter.cy + bp.meter.h / 2),
    dn: pad(bp.dn), up: pad(bp.up),
    lever: box(k.w / 2, xMin + pw - 0.005, k.h * 0.74 - 0.06, k.h * 0.74 + 0.44),
    glass: box(-span3 / 2 - 0.05, span3 / 2 + 0.05, winY - 0.17, winY + 0.17),
  };
  LAYS.set(k, L);
  return L;
}

// ── the seven-segment digits the credit window glows with ───────────────────
// Horizontal-and-vertical bars only, drawn with fillRect — the same pixel
// idiom as everything else painted in this world. Segment order: top,
// top-right, bottom-right, bottom, bottom-left, top-left, middle.
const SEG: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0], '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1], '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1], '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1], '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1], '9': [1, 1, 1, 1, 0, 1, 1],
};
/** one digit, top-left (x, y), `t` the bar thickness; 5t wide, 9t tall */
function seg7(g: CanvasRenderingContext2D, x: number, y: number, t: number,
              ch: string, color: string): void {
  const on = SEG[ch];
  if (!on) return;
  const w = 5 * t, h = 9 * t, mid = y + 4 * t;
  g.fillStyle = color;
  if (on[0]) g.fillRect(x + t, y, w - 2 * t, t);
  if (on[1]) g.fillRect(x + w - t, y + t, t, 3 * t);
  if (on[2]) g.fillRect(x + w - t, mid + t, t, 3 * t);
  if (on[3]) g.fillRect(x + t, y + h - t, w - 2 * t, t);
  if (on[4]) g.fillRect(x, mid + t, t, 3 * t);
  if (on[5]) g.fillRect(x, y + t, t, 3 * t);
  if (on[6]) g.fillRect(x + t, mid, w - 2 * t, t);
}

/** The session canvas: TRANSPARENT except what glows behind the bet meter's
 *  REAL glass (built in buildCabinet) — the world's amber seven-segment
 *  digits, the same phosphor the watch and the ATM speak. 2026-08-10, on the
 *  full-width cash meter this replaces: "janky ass money screen" — the purse
 *  already lives on the wallet HUD, so the machine's own glass shows the ONE
 *  number that is the machine's: the bet. Everything else on the fascia is
 *  geometry; nothing opaque is painted here any more. */
function paintSession(
  g: CanvasRenderingContext2D, w: number, h: number, m: Machine | null,
): void {
  g.clearRect(0, 0, w, h);
  if (!m) return;
  const k = m.kind;
  const b = layFor(k).bet;

  // a breath of backlight on the glass, the $ silkscreen, the digits — and
  // nothing else: flanked by the real − / + caps the readout explains
  // itself, and a BET legend only made the glass wider ("bet window here is
  // too big. pls make smaller"). Bar thickness comes off the window's own
  // height, and the window scales with the pane, so the KING's coarser face
  // gets the same ~26×17 px meter as the cherry (see bandOf).
  g.fillStyle = 'rgba(255,182,56,0.05)'; g.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  const t = Math.max(1, Math.floor((b.h - 6) / 9));
  const dw = 5 * t + t, dh = 9 * t;
  const y0 = Math.round(b.y + (b.h - dh) / 2);
  const xd = b.x + b.w - 4 - 2 * dw;             // two digit slots, right-aligned
  g.fillStyle = '#8a8072'; g.textAlign = 'left';
  g.font = 'bold 8px monospace'; g.fillText('$', xd - 6, y0 + dh - 1);
  const val = String(Math.min(99, k.stake * m.bet));
  for (let i = 0; i < 2; i++) {
    const x0 = xd + i * dw;
    seg7(g, x0, y0, t, '8', 'rgba(255,182,56,0.09)');
    const ch = val[val.length - 2 + i];
    if (ch !== undefined) seg7(g, x0, y0, t, ch, '#ffb638');
  }
}

/**
 * THE SEAT THIS USED TO OPEN AT. 2026-08-10: "remove chairs for all games and
 * tables in casino. it actually is just annoying." — the stools are gone from
 * ct/int-casino.ts, so NO seat carries this label any more and the seat-mode
 * grammar below is dormant: every machine is played standing, from its own
 * [E] spot. The watcher is kept, not deleted — it costs one identity check a
 * frame and means a stool that ever comes back opens its machine again with
 * zero rewiring. (The old ct/slots.ts panel listened for 'sit at the slot',
 * singular, which nothing carries either; that module stays retired as the
 * library blackjack reads CREDIT from.)
 */
export const SEAT_LABEL = 'sit at the slots';

interface SeatRow { pose: object; label: string }
interface CtWindow {
  __ct?: {
    seated: () => { x: number; z: number } | null;
    seats: () => SeatRow[];
  };
}

/** the stool pose the player is on, if it is one of ours — identity, so the
 *  dismissal latch works exactly as the tables' does */
function seatedAtSlots(): { x: number; z: number } | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  return ct.seats().find((s) => s.pose === pose)?.label === SEAT_LABEL ? pose : null;
}

// ── the floor ────────────────────────────────────────────────────────────────

export interface SlotsHandle {
  /** stake of the machine at index i, for prompts elsewhere */
  stake: (i: number) => number;
}

const ATTRACT = ['PULL ME', 'WIN BIG', 'GET LUCKY'];

/**
 * Build every machine on `specs`, wire an [E] spot to each that locks the view
 * onto the cabinet, and drive the whole bank from ONE frame hook. int-casino
 * owns the stools (labelled with SEAT_LABEL above, so taking one locks onto
 * that stool's machine); this owns everything that moves.
 */
export function buildSlots(ctx: CtxBuild, room: SlotRoom, specs: SlotSpec[]): SlotsHandle {
  const machines = specs.map((s, i) => buildCabinet(ctx, room, s, i));

  // ── the session lock ──
  let panel: Panel | null = null;
  let active: Machine | null = null;
  let mode: 'seat' | 'stand' | null = null;
  let dismissed: object | null = null;

  /** the machine a stool pose fronts — by distance, so it survives whatever
   *  transform room.wx/wz carries. Stools sit 0.95 m off their machine; the
   *  next machine over is 1.27 m, so nearest-wins is unambiguous. */
  const machineNear = (p: { x: number; z: number }): Machine | null => {
    let best: Machine | null = null, bd = 1.4;
    machines.forEach((m, i) => {
      const d = Math.hypot(room.wx(specs[i].lx) - p.x, room.wz(specs[i].lz) - p.z);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  };

  // Dynamically, the way blackjack and roulette import it — ct/hud.ts at
  // build depth would be a new edge into GOTCHAS §28's cycle territory.
  void import('./hud').then(({ makePanel }) => {
    panel = makePanel({
      // NOT 'ct-slots' — that DOM id belongs to ct/slots.ts's retired panel,
      // and makePanel reuses a wrap by id. See the ⚠ in "the locked session".
      id: 'ct-slotcab',
      w: SESSION_PX.w, h: SESSION_PX.h, scale: 2,
      chrome: 'none',
      hint: () => {
        const m = active;
        if (!m) return '';
        if (m.state !== 'idle') return '…';
        const bet = m.kind.stake * m.bet;
        return ctx.purse.cash >= bet
          ? `click the lever — $${bet} a pull · − + set the bet`
          : `slot wants $${bet}`;
      },
      draw: (g, w, h) => paintSession(g, w, h, active),
      // CLICK-ONLY (2026-08-09) with one survivor: *"maybe the spin/pull lever
      // is still space tho"* — SPACE pulls, nothing else. Escape and [E] still
      // leave, through the framework.
      key: (k) => {
        if (k === ' ' && active) { pull(active, ctx); panel?.repaint(); }
      },
      surface: {
        mesh: () => active?.pane ?? null,
        // CLOSE AND COMPOSED — "closer disgetic persprective", then "the
        // diagetic view is worse than the sit down view". The telephoto lock
        // stands off exactly far enough that the pane fills the frame height
        // (see THE COMPOSED FRAME): reel glass a breath above centre, win
        // sign upper third, readout band lower third, lever at the right
        // edge, pay card just out of frame. Derived per kind, so the KING's
        // wider face simply reads a longer step back. A getter, because the
        // framework reads this at open time and ONE panel serves the floor.
        get standoff() { return active ? standoffFor(active.kind) : 1.0; },
        fov: PANE_FOV,
        hot: (x, y) => {
          const m = active;
          if (!m) return false;
          if (m.state !== 'idle') return false;         // the bet locks while it spins
          const L = layFor(m.kind);
          return inR(L.dn, x, y) || inR(L.up, x, y) ||
            inR(L.lever, x, y) || inR(L.glass, x, y);
        },
        click: (x, y) => {
          const m = active;
          if (!m || m.state !== 'idle') return;
          const L = layFor(m.kind);
          // − / + walk the bet 1x–3x of the stake. The cap gets its press
          // travel even when clamped at the end of the range — a button
          // that does not move when clicked is the painted button all over
          // again. (No COLLECT: wins pay the purse direct, and 2026-08-10
          // Erick asked the obvious — "whats the collect button?")
          if (inR(L.dn, x, y)) { nudgeBet(m, -1); panel?.repaint(); return; }
          if (inR(L.up, x, y)) { nudgeBet(m, +1); panel?.repaint(); return; }
          if (inR(L.lever, x, y) || inR(L.glass, x, y)) {
            pull(m, ctx);
            panel?.repaint();
          }
        },
      },
      // Nothing to cash out: the machine plays straight against the purse, and
      // a spin or payout in flight keeps settling through the world loop below
      // whether anyone is watching or not — leaving mid-payout strands nothing.
      onClose: () => { dismissed = seatedAtSlots(); mode = null; },
    });
  });

  machines.forEach((m, i) => {
    const spec = specs[i];
    // the [E] spot stands on whichever side the glass looks
    const fw = spec.face ?? 1;
    const fx = room.wx(spec.lx), fz = room.wz(spec.lz + fw * (m.kind.d / 2 + 0.55));
    ctx.spot({
      x: fx, z: fz, r: 1.25,
      aimX: room.wx(spec.lx), aimZ: room.wz(spec.lz),
      obj: m.group,
      label: () => `play ${m.kind.name} — $${m.kind.stake} a pull`,
      ok: () => room.inside(),
      act: () => {
        if (panel) { active = m; mode = 'stand'; panel.open(); }
        else pull(m, ctx);   // hud not landed yet: the lever still answers
      },
    });
  });

  let lastT = -1;
  ctx.onFrame((f) => {
    // ── the seat grammar: a slot stool opens its machine, exactly as the pit
    // tables' stools do. NOT SEATED MEANS NOT OPEN holds for seat-mode only —
    // a standing session has no stool to lose, and the focus controller
    // already escapes the panel if the rig loses the lock any other way.
    if (panel) {
      const pose = seatedAtSlots();
      if (panel.isOpen()) {
        if (mode === 'seat' && pose === null) panel.close();
        else panel.repaint();
      } else {
        if (pose === null) dismissed = null;
        else if (pose !== dismissed) {
          const m = machineNear(pose);
          if (m) { active = m; mode = 'seat'; panel.open(); }
        }
      }
    }
    // `f.t` is wall time; `f.dt` is clamped for physics and a reel is not
    // physics — same note as ct/slots.ts, same clock.
    const dt = lastT < 0 ? 0 : Math.max(0, f.t - lastT);
    lastT = f.t;
    const inside = room.inside();
    for (const m of machines) {
      // the bet caps' press travel — 0.16 s down-and-back per cap
      for (const c of m.caps) {
        if (c.t === -2) c.t = f.t;
        if (c.t >= 0) {
          const q = f.t - c.t;
          c.mesh.position.z = c.z -
            (q < 0.16 ? 0.008 * Math.sin(Math.PI * q / 0.16) : 0);
          if (q >= 0.16) c.t = -1;
        }
      }
      if (m.state === 'idle') {
        if (!inside) continue;
        // attract: the little sign calls you back, offset per machine, and the
        // marquee bulbs run a lazy chase — a cabinet that is waiting for you,
        // not one that is off
        m.attractT += dt;
        if (m.attractT > 2.4) {
          m.attractT = 0; m.attractIx = (m.attractIx + 1) % (ATTRACT.length + 1);
          say(m, m.attractIx === ATTRACT.length ? `$${m.kind.stake * m.bet} A PULL`
            : ATTRACT[m.attractIx]);
        }
        const step = (Math.floor(f.t * 5) + m.i) % 3;
        m.bulbs.forEach((b, ix) => b.color.setHex(ix === step ? 0xffe89a : 0x7a6438));
        continue;
      }
      m.t += dt;
      tickLever(m);
      tickReels(m, inside);
      if (m.state === 'spinning') settleIfDone(m);
      else tickPayout(m, ctx, dt);
    }
  }, HOOK.LATE);

  return { stake: (i) => machines[i].kind.stake };
}

/** − / + on the fascia: walk the bet across 1x–3x of the cabinet's stake.
 *  Latches the cap's press travel either way; only a real change speaks. */
function nudgeBet(m: Machine, d: number): void {
  m.caps[d < 0 ? 0 : 1].t = -2;
  const b = Math.min(3, Math.max(1, m.bet + d));
  if (b === m.bet) return;
  m.bet = b;
  say(m, `BET $${m.kind.stake * b}`, true);
  m.attractT = -1.5;
}

function pull(m: Machine, ctx: CtxBuild): void {
  if (m.state !== 'idle') return;
  const stake = m.kind.stake * m.bet;
  if (ctx.purse.cash < stake) { say(m, `NEED $${stake}`); m.attractT = -1.5; return; }
  ctx.purse.cash -= stake;
  ctx.refreshWallet();
  m.state = 'spinning'; m.t = 0; m.win = 0; m.paid = 0; m.payRamp = 0;
  say(m, 'GOOD LUCK');

  // ALL THREE STOPS DRAWN NOW, before anything moves — the anticipation crawl
  // below paces the reveal of a decision already made; it never makes one.
  const s = [0, 1, 2].map(() => Math.min(STOPS - 1, Math.floor(Math.random() * STOPS)));
  const live = isLive(s[0], s[1]);
  m.nearMiss = live && !evaluate(symAt(0, s[0]), symAt(1, s[1]), symAt(2, s[2]));
  // reel time runs from the moment the lever hits the bottom of its throw
  // (posOf is asked with tt = m.t - leverDown), so the schedule is in reel time
  let prev = schedule(m.reels[0], s[0], FEEL.wantFirst, false, false);
  prev = schedule(m.reels[1], s[1], prev + FEEL.gap, false, false);
  schedule(m.reels[2], s[2], prev + FEEL.gap + (live ? FEEL.hold : 0), live, m.nearMiss);
}

function tickLever(m: Machine): void {
  const t = m.t, rest = -0.10, down = 1.35;   // rest matches the built pose
  let a = rest;
  if (t < FEEL.leverDown) {
    const k = t / FEEL.leverDown;
    a = rest + (down - rest) * k * k;                     // yanked, accelerating
  } else if (t < FEEL.leverDown + FEEL.leverBack) {
    const q = t - FEEL.leverDown;
    a = rest + (down - rest) * Math.exp(-5.5 * q) * Math.cos(8 * q);  // sprung home
  }
  m.lever.rotation.x = a;
}

function tickReels(m: Machine, inside: boolean): void {
  const kick = FEEL.leverDown;
  for (const r of m.reels) {
    const tt = m.t - kick;
    const p = posOf(r, tt);
    r.pos = p;
    const h = 1 / 120;
    const speed = r.spinning ? (posOf(r, tt + h) - posOf(r, tt - h)) / (2 * h) : 0;
    r.mesh.userData.speed = speed;
    if (!inside) continue;                        // money settles even unseen
    const mat = r.mesh.material as THREE.MeshBasicMaterial;
    const wantBlur = Math.abs(speed) > FEEL.blurAbove;
    if (wantBlur !== r.blurred) { r.blurred = wantBlur; mat.map = wantBlur ? r.blurT : r.crisp; mat.needsUpdate = true; }
    (mat.map as THREE.Texture).offset.y = mod1((p - 2) / STOPS);
  }
  // the hubs turn with the outer reels — the physically-moving part
  m.hubs[0].rotation.x = m.reels[0].pos * (Math.PI * 2 / STOPS);
  m.hubs[1].rotation.x = m.reels[2].pos * (Math.PI * 2 / STOPS);
}

function settleIfDone(m: Machine): void {
  const kick = FEEL.leverDown;
  const last = Math.max(...m.reels.map((r) => r.stopT)) + kick;
  if (m.t < last) return;
  for (const r of m.reels) { r.pos = posOf(r, m.t - kick); r.spinning = false; }
  const w = evaluate(symAt(0, m.reels[0].stop), symAt(1, m.reels[1].stop), symAt(2, m.reels[2].stop));
  if (!w) {
    m.state = 'idle'; m.attractT = m.nearMiss ? -2.4 : 1.6;
    say(m, m.nearMiss ? 'SO CLOSE' : `$${m.kind.stake * m.bet} A PULL`);
    return;
  }
  m.win = w.pays * m.kind.stake * m.bet;
  m.state = 'paying'; m.flashT = 0; m.payRamp = 0; m.paid = 0;
  m.topper.userData.flash = true;
  say(m, w.line, true);
  burstCoins(m);
}

function tickPayout(m: Machine, ctx: CtxBuild, dt: number): void {
  m.flashT += dt;
  // topper strobe + bulb chase gone frantic. The map multiplies the material
  // colour, so "off" is a drop to dark and "on" is the lit tint — a real blink,
  // not two near-whites.
  const on = Math.floor(m.flashT * 9) % 2 === 0;
  if (on) m.topperM.color.copy(m.topperLit);
  else m.topperM.color.setHex(0x504438);
  const step = Math.floor(m.flashT * 12) % 3;
  m.bulbs.forEach((b, ix) => b.color.setHex(ix === step ? 0xfff4d0 : 0xa8862f));
  tickCoins(m, m.flashT);

  // the dollars COUNT into the wallet — whole dollars only, float stays here
  if (m.paid < m.win) {
    m.payRamp = Math.min(m.win, m.payRamp + FEEL.payPerSec(m.win) * dt);
    const whole = Math.floor(m.payRamp);
    if (whole > m.paid) {
      ctx.purse.cash += whole - m.paid;
      m.paid = whole;
      ctx.refreshWallet();
      say(m, `WIN $${m.paid}`, true);
    }
    return;
  }
  if (m.flashT > Math.max(2.6, m.win > 100 ? 4.5 : 0)) {
    m.state = 'idle';
    m.topper.userData.flash = false;
    m.topperM.color.setHex(0xffffff);
    m.bulbs.forEach((b) => b.color.setHex(0x7a6438));
    if (m.coins) m.coins.visible = false;
    m.attractT = -2.0;
    say(m, `WON $${m.win}`, true);
  }
}
