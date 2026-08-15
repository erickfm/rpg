import { BUILD } from './ctx';
import { hudNote, screenFading } from './hud';
import { gameOverUp } from './gameover';
import { defineItem, type ItemDef } from './inventory';
import { SMOKES } from './goods';
import { skin as bodySkin } from './body';
import { flush } from './save';
import { damage } from './health';
import { mentalHeal } from './mental';

// ══ SMOKING ═════════════════════════════════════════════════════════════════
//
// *"make it so cigarettes and food is consumable. make animations for smoking.
//  for eating. smoking should be self explanatory"*   (2026-08-10)
//
// ── THE PACK CARRIES A COUNT, AND THE MENU STAYS HONEST ────────────────────
//
// `ct/goods.ts` shipped SMOKES with NO use verb, on a stated rule: a pack is
// twenty, and a SMOKE verb that ate the whole pack in one puff would be the
// menu lying. That rule is honoured here rather than repealed. The inventory
// has no per-item state — `Purse.inv` is a count per id, nothing more — so the
// count lives in the ITEM'S IDENTITY instead: smoking a sealed pack turns it
// into `SMOKES_19`, smoking that turns it into `SMOKES_18`, and `SMOKES_1`
// consumes outright, which is the empty pack dying. This is the parcel's own
// "using a thing may turn it into another thing" machinery in `ct/bag.ts` —
// the bag takes the pack, the act returns the next id, the bag puts it back in
// the slot the pack vacated, so there is never a moment with no room for it.
//
// Two packs cannot share a count and cannot smear into each other: each is one
// unit of one id, and only the pack you smoked steps down. A part-used pack
// survives a save for the same reason — it is an ordinary declared id.
//
// ⚠ THE "NO STAT EFFECT" RULE IS REPEALED, at his word (2026-08-15): *"smokes
// hurt physical but help mental."* One cigarette is -2 physical, +4 mental —
// the classic trade, half the size of a shift's mental wear per smoke, so a
// pack is real medicine and a real habit. The hook this header once promised
// is `light()` below, exactly where it said it would be.
//
// ── THE ANIMATION ──────────────────────────────────────────────────────────
//
// First person, in the pixel grammar the watch arm and the bag established:
// its own full-viewport canvas at 3 CSS px per texel, `pointer-events:none`,
// z 8 — over the fatigue vignette (7), under the world highlight (9), the
// watch (11), every note and panel (13/14) and the fade (20). Built the way
// `ct/fatigue.ts` built its vignette without entering `ct/hud.ts`:
// getElementById-or-create, screen-space, swallowing nothing.
//
// A hand rises from the bottom of the frame holding a lit cigarette, holds it
// through a drag while the ember flares and wisps rise off the tip, lowers out
// of frame, and the exhale drifts up the screen as blocky grey puffs that
// disperse. It blocks no input, freezes nothing, and clears itself instantly
// on any fade, sleep cut or game over — the fatigue overlay's own cleanup
// discipline. SILENT: the sound library was checked (street/public/audio and
// ~/Documents/sound) and holds nothing smoking-adjacent — no lighter, no
// exhale — and a wrong sound is worse than none.

const FULL = 20;

/** one flat rectangle in the 24 x 24 icon box — the icon vocabulary. */
const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

/**
 * The opened pack, at every count. Same palette as the sealed pack in
 * `ct/goods.ts` — the lid is torn off, the mouth shows dark with the filters
 * standing in it, and the row of tips thins as the pack empties (6 tips at
 * full scaling down to 1). The NAME carries the exact number; the icon only
 * has 24 pixels and does not pretend to count to twenty.
 */
const openPackIcon = (n: number) => (g: CanvasRenderingContext2D): void => {
  box(g, '#3a322a', 6, 4, 12, 3);                    // the open mouth, dark inside
  box(g, '#d8d0c0', 6, 7, 12, 14);                   // the body, lid gone
  box(g, '#b8342a', 6, 9, 12, 5);                    // what is left of the red crown
  box(g, '#b0a898', 6, 19, 12, 2);                   // the foil showing at the base
  box(g, '#8a8478', 6, 4, 1, 17);                    // the shaded edge
  box(g, '#c8b84a', 9, 15, 6, 2);                    // the tax stripe
  const tips = Math.max(1, Math.round((n / FULL) * 6));
  for (let i = 0; i < tips; i++) box(g, '#efe8d4', 8 + i * 2, 4, 1, 2);
};

/**
 * Light one. Starts the animation, says what is left, and returns the next
 * pack down — or nothing, which `ct/bag.ts` reads as consumed outright: the
 * pack dies only when it is empty.
 */
function light(left: number): string | void {
  startSmoke();
  // *"smokes hurt physical but help mental"* — see the header. The order is
  // deliberate: the damage lands first so a 1-hp chain smoker meets the
  // consequence before the comfort.
  damage(2);
  mentalHeal(4);
  const rest = left - 1;
  hudNote(rest > 1 ? `you light one up. ${rest} left in the pack.`
    : rest === 1 ? 'you light one up. one left, and you both know it.'
    : 'the last one. you crush the empty pack.', 3000);
  flush();
  return rest > 0 ? `SMOKES_${rest}` : undefined;
}

// The nineteen part-used packs, declared at module import like everything in
// `ct/goods.ts` — painters and one closure each, nothing constructed, so the
// seeded stream never moves (GOTCHAS §2). The dropped-object model is the
// sealed pack's own: on a floor a part-used pack and a fresh one are the same
// small white box, and inventing nineteen models would say otherwise.
for (let n = 1; n < FULL; n++) {
  const d: ItemDef = {
    id: `SMOKES_${n}`,
    name: `pack of smokes (${n} left)`,
    stack: 4,
    blurb: n === 1 ? 'the cellophane is long gone. one cigarette left.'
      : `the cellophane is gone. ${n} of twenty left.`,
    icon: openPackIcon(n),
    model: SMOKES.model,
    use: { verb: 'smoke', act: () => light(n) },
  };
  defineItem(d);
}

// ── registration ────────────────────────────────────────────────────────────

/** Beside `ct/food.ts` and `ct/fatigue.ts` for their reasons: everything above
 *  ran at module import, and nothing here constructs a THREE object. */
export const ORDER = BUILD.INTERIOR + 10;      // 90

export function register(): void {
  // The sealed pack, mutated the way food.ts made the burger eatable — the
  // import IS the load-order guarantee, and this touches the one def the bag
  // reads. The "NO USE VERB" note at its declaration now points here.
  SMOKES.use = { verb: 'smoke', act: () => light(FULL) };
}

// ══ THE ANIMATION ITSELF ════════════════════════════════════════════════════

/** CSS px per texel — the bag's own scale, so the hand and the arm agree. */
const SCALE = 3;
/** rise / drag / lower, in ms. The puffs outlive all three. */
const RISE = 420, DRAG = 1150, LOWER = 450;

interface Puff {
  x: number; y: number;          // texels
  vy: number;                    // texels/s upward (negative)
  sway: number; swf: number; ph: number;
  s0: number; s1: number;        // size, start -> end
  a: number;                     // starting alpha
  t0: number; life: number;      // ms clock
}

let cv: HTMLCanvasElement | null = null;
let W = 0, H = 0;
let anim: { t0: number; exhaled: boolean; wispAt: number } | null = null;
let puffs: Puff[] = [];
let raf = 0;

function canvas(): HTMLCanvasElement | null {
  try {
    let c = document.getElementById('ct-smoke-fx') as HTMLCanvasElement | null;
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'ct-smoke-fx';
      // z 8: over the vignette (7), under every piece of HUD chrome and every
      // panel and fade — see the layer note at the top of the file.
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
  } catch { return null; }       // no DOM, no animation — the smoke still counted
}

/** Everything gone, instantly — the fade, a sleep cut and the game-over card
 *  all get a clear screen, the fatigue overlay's own rule. */
function abort(): void {
  anim = null;
  puffs = [];
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  cv?.getContext('2d')?.clearRect(0, 0, W, H);
}

function startSmoke(): void {
  if (screenFading() || gameOverUp()) return;   // nothing rises behind a fade
  if (!canvas()) return;
  // a second cigarette mid-animation restarts the gesture — one hand, one mouth
  anim = { t0: performance.now(), exhaled: false, wispAt: 0 };
  if (!raf) raf = requestAnimationFrame(step);
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

function step(): void {
  raf = 0;
  if (screenFading() || gameOverUp()) { abort(); return; }
  const g = cv?.getContext('2d');
  if (!g) { abort(); return; }
  const now = performance.now();
  g.clearRect(0, 0, W, H);

  if (anim) {
    const t = now - anim.t0;
    if (t >= RISE + DRAG + LOWER) {
      anim = null;
    } else {
      // where the hand is: 0 fully hidden below the frame, 1 fully raised
      const p = t < RISE ? easeOut(t / RISE)
        : t < RISE + DRAG ? 1
        : 1 - easeIn((t - RISE - DRAG) / LOWER);
      const dragging = t >= RISE && t < RISE + DRAG;
      const dragT = dragging ? (t - RISE) / DRAG : 0;
      drawHand(g, p, dragging, dragT, t);

      // wisps off the ember while the drag is on
      if (dragging && now >= anim.wispAt) {
        anim.wispAt = now + 130 + Math.random() * 90;
        const hx = Math.round(W * 0.58);
        puffs.push({
          x: hx + 7 + (Math.random() - 0.5) * 3, y: H - 56,
          vy: -(26 + Math.random() * 10),
          sway: 1.5 + Math.random() * 2, swf: 1.6 + Math.random(), ph: Math.random() * 6.3,
          s0: 1, s1: 2 + Math.random() * 2, a: 0.30,
          t0: now, life: 1300 + Math.random() * 500,
        });
      }
      // the exhale, as the hand starts down: the mouth is below the frame, so
      // the cloud enters from the bottom edge and drifts up the screen
      if (!anim.exhaled && t >= RISE + DRAG) {
        anim.exhaled = true;
        const n = 9 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          puffs.push({
            x: W * 0.5 + (Math.random() - 0.5) * 26, y: H + 2 + Math.random() * 6,
            vy: -(16 + Math.random() * 14),
            sway: 3 + Math.random() * 5, swf: 0.5 + Math.random() * 0.8, ph: Math.random() * 6.3,
            s0: 3 + Math.random() * 2, s1: 7 + Math.random() * 4, a: 0.42,
            t0: now, life: 2300 + Math.random() * 1100,
          });
        }
      }
    }
  }

  // the smoke, whoever breathed it
  const live: Puff[] = [];
  for (const p of puffs) {
    const u = (now - p.t0) / p.life;
    if (u >= 1) continue;
    const y = p.y + p.vy * (now - p.t0) / 1000;
    if (y < -12) continue;
    const x = p.x + Math.sin(p.ph + u * p.swf * 6.28) * p.sway;
    const s = Math.round(p.s0 + (p.s1 - p.s0) * u);
    g.globalAlpha = p.a * (1 - u);
    g.fillStyle = '#c4c0b6';
    // a stepped blob, not a circle: centre square with four shoulders
    const h = Math.max(1, s - 2);
    g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    g.fillRect(Math.round(x - s / 2 - 1), Math.round(y - h / 2), 1, h);
    g.fillRect(Math.round(x + s / 2), Math.round(y - h / 2), 1, h);
    g.fillRect(Math.round(x - h / 2), Math.round(y - s / 2 - 1), h, 1);
    g.fillRect(Math.round(x - h / 2), Math.round(y + s / 2), h, 1);
    live.push(p);
  }
  g.globalAlpha = 1;
  puffs = live;

  if (anim || puffs.length) raf = requestAnimationFrame(step);
  else g.clearRect(0, 0, W, H);
}

/**
 * The hand and the cigarette, at raise fraction `p`. Back of your own right
 * hand at the bottom of the frame, in the player's OWN skin — `ct/body.ts`'s
 * tone, the same read the watch arm takes — with the cigarette standing up
 * between the first two fingers and the ember doing the talking.
 */
function drawHand(g: CanvasRenderingContext2D, p: number, dragging: boolean,
                  dragT: number, t: number): void {
  const tone = bodySkin();
  const hx = Math.round(W * 0.58);                 // the hand's centre column
  const REACH = 46;                                // texels of hand shown at full raise
  // a slow breath-bob while it holds, one texel of it
  const bob = dragging ? Math.round(Math.sin(t / 260) * 1) : 0;
  const top = Math.round(H - REACH * p) + bob;     // y of the fist's top edge

  // the forearm, running off the bottom edge — flat, one dark flank
  g.fillStyle = tone.base;
  g.fillRect(hx - 12, top + 16, 26, H - (top + 16) + 2);
  g.fillStyle = tone.lo;
  g.fillRect(hx - 12, top + 16, 4, H - (top + 16) + 2);

  // the fist: a wider block with chamfered top corners and knuckle lines
  g.fillStyle = tone.base;
  g.fillRect(hx - 16, top + 2, 34, 16);
  g.fillRect(hx - 14, top, 30, 2);                 // the chamfer row
  g.fillStyle = tone.hi;
  g.fillRect(hx - 14, top, 30, 1);                 // light along the top edge
  g.fillStyle = tone.lo;
  g.fillRect(hx - 16, top + 2, 3, 16);             // the shaded flank
  // three finger separations, curled under the cigarette
  for (let i = 0; i < 3; i++) g.fillRect(hx - 8 + i * 8, top + 4, 1, 10);

  // the cigarette, standing out of the first gap with one texel of lean
  const cx = hx - 6, ctop = top - 13;
  g.fillStyle = '#e8e4d8';
  g.fillRect(cx, top - 7, 3, 7);                   // lower half, straight
  g.fillRect(cx - 1, ctop + 2, 3, 4);              // upper half, leaning left
  // ash collar once the drag is under way
  if (dragT > 0.35) { g.fillStyle = '#9a948a'; g.fillRect(cx - 1, ctop + 2, 3, 1); }
  // the ember: dull between pulls, flaring and flickering on the drag
  const flare = dragging ? 0.55 + 0.45 * Math.random() : 0.25;
  g.fillStyle = flare > 0.7 ? '#ff9a46' : flare > 0.45 ? '#e86a2a' : '#8a3a20';
  g.fillRect(cx - 1, ctop, 3, 2);
  if (dragging && flare > 0.8) { g.fillStyle = '#ffd28a'; g.fillRect(cx, ctop, 1, 1); }
}
