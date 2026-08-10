import { BUILD, type CtxBuild } from './ctx';
import { defineItem, mBox, mCyl, mOf } from './inventory';
import { hudNote } from './hud';
import { riding, setRiding, rideState } from '../fp';

// ══ THE SKATEBOARD ══════════════════════════════════════════════════════════
//
// *"make it so i can give the guy smokes in the park and he gives me a
//  skateboard i can use finally"*   (2026-08-10)
// *"also wire the sounjds through to the skateboard and make a skateboard
//  under our feet like animate and what not."*   (2026-08-10, same hour)
// *"no skating indoors btw"*   (2026-08-10, the ruling)
//
// THE ITEM, ITS RIDE VERB, THE DECK YOU SEE, AND THE INDOOR RULE LIVE HERE.
// The trade that puts it in your bag is the park kid's (ct/park.ts), the
// movement is the rig's (fp.ts owns how the board rolls and publishes
// `rideState` for anything that watches it), and the wheels' SOUND is
// ct/audio.ts's, off that same published frame. `use` is a TOGGLE — RIDE
// steps on, STEP OFF steps off — and the verb string is mutated to say which,
// the way `ct/smoking.ts` mutates SMOKES: the bag paints and matches the same
// `use.verb`, so the plate can never offer the wrong one.
//
// ⚠ THE ACT RETURNS THE BOARD'S OWN ID. The bag's use machinery consumes an
// act that returns nothing — that is how eating works — and riding must not
// eat the skateboard.
//
// ── NO SKATING INDOORS ─────────────────────────────────────────────────────
//
// His ruling, three words. "Indoors" is the world's own established fact —
// every interior is built out at |x| > 100 (`ct/audio.ts` reads the same
// fact, and `apartment.ts` tests it in six places) — so RIDE refuses there
// with an honest line, and the
// per-frame guard below steps you off the moment a door teleports you inside.
// THE STEP-OFF CANNOT TRAP OR SHOVE: it only flips fp.ts's flag — no position
// is touched, the rig zeroes the momentum on the next frame, and every
// doorway is the same walk it was before the board existed.
//
// THERE IS ONE BOARD IN THE WORLD — the kid's — so `stack: 1`. NOT bulky,
// deliberately: a board rides strap-side against the bag, and taking your only
// hand for it would turn the reward into a chore.

/** the world handle, for the act's own indoor test. Set once by `register`. */
let world: CtxBuild | null = null;

const indoors = (): boolean => world !== null && Math.abs(world.player.x()) > 100;

const step = (on: boolean, note?: string): void => {
  setRiding(on);
  SKATEBOARD.use!.verb = on ? 'step off' : 'ride';
  hudNote(note ?? (on ? 'you step on the board.' : 'you step off.'), 1800);
};

const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

export const SKATEBOARD = defineItem({
  id: 'SKATEBOARD', name: 'skateboard', stack: 1,
  thick: 0.11,
  blurb: 'the kid’s board. The grip tape is worn through where his feet went.',
  // side-on in the 24 px box: kicked nose and tail, dark grip over a battered
  // red underside, and the yellowed-white wheels every 1997 wheel became
  icon: (g) => {
    box(g, '#b8342a', 3, 10, 18, 2);                                 // underside
    box(g, '#2a241c', 3, 8, 18, 2);                                  // grip tape
    box(g, '#2a241c', 1, 6, 2, 3); box(g, '#b8342a', 1, 9, 2, 2);    // nose kick
    box(g, '#2a241c', 21, 6, 2, 3); box(g, '#b8342a', 21, 9, 2, 2);  // tail kick
    box(g, '#8a8478', 6, 12, 2, 2); box(g, '#8a8478', 16, 12, 2, 2); // trucks
    box(g, '#e8e0c8', 5, 14, 4, 4); box(g, '#e8e0c8', 15, 14, 4, 4); // wheels
    box(g, '#b0a890', 6, 15, 2, 2); box(g, '#b0a890', 16, 15, 2, 2);
  },
  use: {
    verb: 'ride',
    act: () => {
      // *"no skating indoors btw"* — the refusal is readable AND said, the
      // bag's own honest-line grammar. The board stays in the bag either way.
      if (!riding() && indoors()) {
        hudNote('no skating indoors.', 2200);
        return 'SKATEBOARD';
      }
      step(!riding());
      return 'SKATEBOARD';
    },
  },
  // A REAL BOARD ON THE FLOOR: a 78 × 20 deck at wheel height, red underside,
  // grip-dark top, four yellowed wheels on grey trucks. Palette off the icon.
  model: () => {
    const wheel = (x: number, z: number) => {
      const w = mCyl(0.028, 0.03, '#e8e0c8');
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.028, z);
      return w;
    };
    return mOf(
      mBox(0.78, 0.012, 0.20, '#b8342a', 0, 0.075, 0),
      mBox(0.76, 0.004, 0.195, '#2a241c', 0, 0.083, 0),
      mBox(0.06, 0.05, 0.03, '#8a8478', -0.26, 0.045, 0),
      mBox(0.06, 0.05, 0.03, '#8a8478', 0.26, 0.045, 0),
      wheel(-0.26, -0.085), wheel(-0.26, 0.085),
      wheel(0.26, -0.085), wheel(0.26, 0.085),
    );
  },
});

// ══ THE DECK UNDER YOUR FEET ════════════════════════════════════════════════
//
// *"make a skateboard under our feet like animate and what not"*
//
// SCREEN-SPACE PIXEL PAINT, NOT GEOMETRY — the idiom `ct/smoking.ts` set for
// first-person body parts: its own full-viewport canvas at 3 CSS px per
// texel, `pointer-events:none`, z 8 (over the fatigue vignette at 7, under
// every panel and fade). Real geometry parented under the camera would clip
// the near plane, catch the street cull, and read as imported next to the
// pixel hand and the watch arm.
//
// WHAT YOU SEE is the deck's NOSE from a rider's eye — grip tape, the lit
// rails, the front truck's four bolts, the kick, and your own front shoe over
// the tail. WHAT IT DOES comes entirely off `rideState`, fp.ts's published
// frame, so the picture cannot disagree with the body:
//
//   CARVES   `lean` swings the nose sideways, more the further up the deck —
//            and past a third of full lean the low rail shows a texel of the
//            red underside, which is what a tipped deck actually shows you.
//   SPEED    a one-texel rattle off the asphalt, plus a slow half-texel pump
//            so a straight run is not a still photograph.
//   OLLIES   `airY` pops the whole deck up to 11 texels and both rails go
//            red while it is off the ground; it drops back as you land. The
//            0.12 m threshold is the audio module's own — slope flicker
//            (FALL_MIN_DROP, fp.ts) stays under it, so riding down the road's
//            crown does not levitate the picture.
//   PITCH    *"make it more diagetic, so looking up you shouldnt see a
//            skateboard, looking down you should, etc."* — the whole picture
//            rides the camera's own pitch (negative is down, fp.ts's
//            convention), sliding under the frame's bottom edge as the eye
//            comes level and back in as it drops. CONTINUOUS in pitch, so a
//            half glance shows half a deck and nothing ever pops: gone at
//            level or above, fully in by 0.7 rad down — a rider's glance,
//            about half the 1.3 rad pitch limit.

const SCALE = 3;
let cv: HTMLCanvasElement | null = null;
let W = 0, H = 0;
let shown = false;

function canvas(): HTMLCanvasElement | null {
  try {
    let c = document.getElementById('ct-board-fx') as HTMLCanvasElement | null;
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'ct-board-fx';
      c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:8;'
        + 'image-rendering:pixelated;';
      document.body.appendChild(c);
    }
    W = Math.ceil(window.innerWidth / SCALE);
    H = Math.ceil(window.innerHeight / SCALE);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    c.style.width = `${W * SCALE}px`;
    c.style.height = `${H * SCALE}px`;
    cv = c;
    return c;
  } catch { return null; }   // no DOM, no deck — the ride itself never needed it
}

const GRIP = '#2a241c', GRIP_LO = '#1c1712', GRIP_HI = '#3a332c';
const UNDER = '#b8342a', WOOD = '#b8865a', BOLT = '#8a8478';
const SHOE = '#e4e2da', SOLE = '#8f8c83';

function drawBoard(t: number): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, W, H);
  const rs = rideState();
  // seen by looking down — see PITCH in the header. 0 at level, 1 at 0.7 rad
  // down, and the slide below is a straight line between, so the deck tracks
  // the glance itself rather than snapping at a threshold.
  const seen = Math.min(1, Math.max(0, -rs.pitch / 0.7));
  if (seen <= 0) return;                          // level or up: no board in frame
  const slide = Math.round((1 - seen) * 46);
  const air = rs.airY > 0.12;
  const lift = Math.round(Math.min(rs.airY, 0.55) / 0.55 * 11);
  const rattle = !air && rs.speed > 1
    ? Math.round(Math.random() * Math.min(rs.speed / 5, 1.4)) : 0;
  const pump = rs.speed > 0.4 ? Math.round(Math.sin(t / 420)) : 0;
  const bx = W >> 1;
  const base = H + 4 + slide - lift + rattle + pump;   // the tail row, at/under frame
  const ROWS = 30, W0 = 66, W1 = 44;

  for (let r = 0; r < ROWS; r++) {
    const w = Math.round(W0 + (W1 - W0) * (r / ROWS)) & ~1;
    const x = Math.round(bx - w / 2 + rs.lean * r * 0.6);
    const y = base - r;
    if (y < 0 || y >= H) continue;
    g.fillStyle = GRIP;
    g.fillRect(x, y, w, 1);
    g.fillStyle = rs.lean > 0.33 || air ? UNDER : GRIP_LO;
    g.fillRect(x, y, 2, 1);
    g.fillStyle = rs.lean < -0.33 || air ? UNDER : GRIP_LO;
    g.fillRect(x + w - 2, y, 2, 1);
    // grip sparkle, hashed off the ROW so it does not shimmer frame to frame
    if ((r * 7 + 3) % 5 === 0) {
      g.fillStyle = GRIP_HI;
      g.fillRect(x + ((r * 13) % (w - 6)) + 3, y, 1, 1);
    }
  }
  // the nose kick: three narrowing rows past the last, the top one the bare
  // wood a kicked nose shows edge-on
  for (let k = 0; k < 3; k++) {
    const w = 40 - k * 8;
    const y = base - ROWS - k;
    if (y < 0) continue;
    const x = Math.round(bx - w / 2 + rs.lean * (ROWS + k) * 0.6);
    g.fillStyle = k === 2 ? WOOD : GRIP;
    g.fillRect(x, y, w, 1);
  }
  // the front truck's four bolts
  const boltY = base - (ROWS - 6);
  if (boltY >= 0 && boltY < H) {
    g.fillStyle = BOLT;
    const bx0 = Math.round(bx - 8 + rs.lean * (ROWS - 6) * 0.6);
    for (const dx of [0, 5, 10, 15]) g.fillRect(bx0 + dx, boltY, 1, 1);
  }
  // …and your own front shoe over the tail rows — the thing that says UNDER
  // YOUR FEET rather than "a board nearby". The trainers' own white, riding
  // every texel of lift and rattle the deck takes.
  const fy = base - 3;
  const fx = Math.round(bx - 26 + rs.lean * 3);
  if (fy - 10 < H) {
    g.fillStyle = SHOE;
    g.fillRect(fx, fy - 8, 20, 8);
    g.fillRect(fx + 2, fy - 10, 16, 2);
    g.fillStyle = SOLE;
    g.fillRect(fx, fy - 1, 20, 1);
  }
}

// ── registration ────────────────────────────────────────────────────────────
//
// The item declared itself at import, the way everything in ct/goods.ts does;
// `register` stands the guard and the painter. Nothing here constructs a THREE
// object and nothing draws from `rnd()`, so the seeded stream never moves
// (GOTCHAS §2) — the canvas is DOM, made lazily on the first ridden frame.

export const ORDER = BUILD.INTERIOR + 10;      // 90, beside ct/smoking.ts

export function register(ctx: CtxBuild): void {
  world = ctx;
  // THE SWITCH CANNOT OUTLIVE THE BOARD — OR FOLLOW IT INDOORS. Drop it,
  // fence it, sit down, or carry it through any door (every entry is a
  // teleport past |x| = 100): the first frame that finds you riding where
  // you may not steps you off, verb and all. Only the flag flips — no
  // position is touched, so no doorway can trap or shove. fp.ts stays dumb
  // on purpose: it holds the flag and this file holds the reasons.
  ctx.onFrame(() => {
    if (riding()) {
      if (indoors()) step(false, 'no skating indoors.');
      else if (ctx.player.seated() || (ctx.purse.inv[SKATEBOARD.id] ?? 0) < 1) step(false);
    }
    // the deck, drawn every ridden frame, gone the frame you are off
    if (riding()) {
      if (canvas()) { drawBoard(performance.now()); shown = true; }
    } else if (shown) {
      shown = false;
      cv?.getContext('2d')?.clearRect(0, 0, W, H);
    }
  });
}
