import * as THREE from 'three';
import type { AABB } from '../fp';
import { type Look, HOLD_DROP_M, HOLD_X, citizenAtlas, citizenPlane, sectorAt, viewAt } from './citizens';
import { ROAD_HALF, rnd } from './rng';
import { buildNet, STRAY, type Activity, type Net } from './crowd-net';
import { ORDER, type CtxBuild } from './ctx';
import { pixTex } from './paint';

// ── the crowd: who is on the block, and how they walk it ───────────────────
//
// Split out of crosstown.ts, which was carrying both the cast and the walking
// sim inline. `ct/citizens.ts` is the ATLAS — it paints one person's sprite
// sheet and is shared by three modules, so it stays desk-owned. This file is
// the SIM: the cast list, the steering, the prop avoidance and the politeness
// rules about the player. Nothing here is called from anywhere else.
//
// Lifted verbatim in the split — same cast, same numbers, same order of
// construction, so every texture and position comes back identical.

/** What the crowd needs from the world that the build context does not carry. */
export interface CrowdOpts {
  /** Solid things people steer AROUND. Read live every frame, so the list may
   *  still be appended to after the crowd is built.
   *
   *  ⚠ "parked cars, and the moving cruiser's box" WAS WRONG AND IT COST A
   *  DIAGNOSIS (item 207). It reads as "moving traffic is not in here, except
   *  the cruiser", and the desk built a lead on exactly that. **Every moving
   *  vehicle is in this list**: `crosstown.ts:615` registers them and
   *  `traffic.ts:236/308` rewrite their extents every frame. So a citizen
   *  pinned by a car is NOT pinned because the car is invisible to steering —
   *  the car is visible, and the seven candidates in `walk()` simply have
   *  nowhere forward to go.
   *
   *  Since item 198 this is also most of the world's static geometry, not a
   *  handful of props: `solid()` and `obstacle()` became one function, moving
   *  **359 of 508 static player colliders** into this list. Anything tuned
   *  against the old, much sparser set is tuned against a world that is gone. */
  citAvoid: AABB[];
  /** register a person's footprint as solid to the PLAYER. People are not in
   *  `citAvoid`, so they phase each other but never a tree. */
  solid: (b: AABB) => void;
  /** the lamplight registry — people walk through the pools too */
  lit: (root: THREE.Object3D) => void;
  /** the side street's dimensions, for laying out the walkable network — they
   *  live in crosstown.ts, not in ct/rng.ts */
  SIDE_Z0: number; SIDE_Z1: number; SIDE_X1: number;
}

// Six of them, and no two are the same person recoloured. Each carries its
// own height, build, skin, hair shape, garment and walking speed. Build is
// a SILHOUETTE change in the atlas (torso and shoulder width), separate
// from the mesh scale, so the tall ones aren't just the short ones blown up.
//
// Skin runs the full range you'd actually see on a city street, and hair is
// matched to it the way it falls in life rather than assigned at random.
// Everyone is painted by the same routine with the same shading.
interface Person {
  look: Look; hs: number; ws: number; sp: number;
}
const CAST: Person[] = [
  // tall, broad, long coat, close-cropped hair
  { look: { jacket: '#3a4a63', pants: '#2b2f36', skin: '#6b4226', hair: '#141014', fit: 'coat', cut: 'crop', build: 1 },
    hs: 1.09, ws: 1.07, sp: 1.55 },
  // small and quick, ball cap, hair tied back under it
  { look: { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e', fit: 'cap', accent: '#8a3a2e', cut: 'tied', build: -1 },
    hs: 0.91, ws: 0.94, sp: 1.72 },
  // unhurried, long hair, dress
  { look: { jacket: '#3f5a46', pants: '#3f5a46', skin: '#c9946a', hair: '#241a10', fit: 'dress', cut: 'long', build: 0 },
    hs: 0.97, ws: 0.99, sp: 0.68 },
  // heavy-set, hood up, ambling
  { look: { jacket: '#5c5266', pants: '#2b2f36', skin: '#4a2c1a', hair: '#141014', fit: 'hoodie', cut: 'short', build: 1 },
    hs: 1.05, ws: 1.10, sp: 0.86 },
  // slight, older, bald, brisk
  { look: { jacket: '#6a5a3a', pants: '#23262c', skin: '#f0c8a0', hair: '#b8b2a6', fit: 'plain', cut: 'bald', build: -1 },
    hs: 0.94, ws: 0.92, sp: 1.34 },
  // average everything, long dark hair, steady pace
  { look: { jacket: '#37505e', pants: '#2b2f36', skin: '#8d5a34', hair: '#1c1410', fit: 'plain', cut: 'long', build: 0 },
    hs: 1.02, ws: 1.00, sp: 1.08 },
];
// Stride is tied to speed, and so is cadence — but each only by the ROOT of
// it, because a walker who doubles their pace does not double both. Longer
// legs also cover more ground, so height feeds in. Without this a fast
// walker just cycles the same short steps quicker, which reads as skating.
const strideFor = (sp: number, hs: number) =>
  Math.max(2, Math.min(5, Math.round(3.2 * Math.sqrt(sp) * hs)));

// ── HOW TALL IS THE PERSON IN FRONT OF YOU ────────────────────────────────
//
// *"make people different heights pls."*
//
// MEASURED FIRST (`scripts/probes/w63-heights.mjs`, against the running world),
// because the answer changed what this fix is:
//
//     crowd walkers            6, all six heights distinct, 0.91 … 1.09
//     citizenSprite figures   26, SIX distinct drawn heights, and 16 of the 26
//                                 are the SAME 1.900 m — the untouched default
//
// So the six here were never the problem. **Twenty of the world's twenty-six
// people are placed by `citizenSprite()` from shop and interior modules, and
// most of those callers pass no `h` at all**, which is why he sees a crowd of
// one height. That fix is in `ct/citizens.ts` and ten `int-*.ts` files, none of
// which this item names — reported rather than reached for (BUILDER-BRIEF §9).
//
// What IS in this file is the six on the street, and two things are wrong with
// them:
//
//   1. **±9% is a narrow band and it sits LOW.** Measured figure heights (see
//      H_SPREAD_UP below): 1.51 m to 1.78 m — everybody between 5'0" and 5'10",
//      and nobody tall.
//   2. **`hs` belongs to the CAST MEMBER, not to the person.** Six roles, six
//      heights, forever — and the moment anything instances a role twice you get
//      two identical people.
//
/**
 * ⚠ `hs` IS NOT A HEIGHT IN METRES, AND THAT MISLED ME FIRST TIME ROUND.
 *
 * `citizenPlane` is 1.9 m tall and the PERSON is not: four empty rows sit under
 * the shoe and there is headroom above the hair. Measured — every atlas read
 * back and its opaque rows counted, `scripts/probes/w63-figure-rows.mjs` —
 * **the painted figure is 55 or 56 rows of 64, so 1.633–1.662 m at `hs` 1.**
 *
 *     hs 0.91  ->  1.51 m        hs 1.09  ->  1.78 m       (as authored)
 *
 * So the street was NOT full of tall people, which is what I had assumed from
 * the 1.805–1.976 m the plane reports. It was full of people between 5'0" and
 * 5'10", which is a narrow band sitting LOW. A first cut that widened the
 * deviation symmetrically by 1.45 put the shortest walker at **1.434 m** — a
 * ten-year-old on the pavement, and exactly what this item's row warns against.
 * The probe is what caught it; the plane height would have hidden it.
 *
 * So the widening is ASYMMETRIC: mostly upward, because that is the end the
 * street was missing. A real pavement runs about 1.50 m to 1.90 m.
 */
/** how far each cast member's deviation above 1 is stretched: 1.09 -> 1.14, so
 *  the tallest walker reaches about 1.86 m */
const H_SPREAD_UP = 1.55;
/** …and below 1, barely: the shortest was already 1.51 m and there is nowhere
 *  much to go without inventing a child */
const H_SPREAD_DOWN = 1.10;
/** Width follows height, but people of one height are not one shape, so it
 *  widens less than the height does. Symmetric — nothing about the authored
 *  widths sits wrong. */
const W_SPREAD = 1.20;
/** …and then each PERSON differs from their role. Small on purpose: it is there
 *  so no two figures in a frame can be identical, not to fight the cast. */
const H_JITTER = 0.032;
const W_JITTER = 0.030;
/** how much of a person's height jitter shows up in their width — correlated,
 *  not locked. Scaling height alone is what makes a sprite look stretched. */
const W_FOLLOWS_H = 0.55;
/**
 * ITS OWN STREAM, NOT `ct/rng.ts`'s.
 *
 * GOTCHAS §2: there is ONE seeded `rnd()` and its ORDER is load-bearing —
 * inserting a draw at BUILD time shifts every tree height and every pigeon
 * position downstream. This file's own note at the activity picker says its
 * `rnd()` "runs at RUNTIME only, never during the build", and this runs during
 * the build, so it cannot use it. Same move `ct/int-library.ts` makes for its
 * terminal screens, for the same reason.
 *
 * Seeded and therefore REPRODUCIBLE: the same six people every load, so a probe
 * can assert on them and `fp` still has a stable world to fingerprint.
 */
const hrnd = (() => {
  let s = 0x51ed270b;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
})();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** the finished scale for ONE person: their role, widened, then themselves */
function bodyScale(p: Person): { hs: number; ws: number } {
  const jh = (hrnd() - 0.5) * 2 * H_JITTER;
  const jw = (hrnd() - 0.5) * 2 * W_JITTER;
  // 0.90 is a floor in METRES wearing a scale's clothes: 0.90 x 1.662 = 1.50 m,
  // which is a short adult. Anything under it is a child, and there are no
  // children in this cast — `build` and the garments are all adult silhouettes,
  // so a scaled-down adult would read as a doll rather than as a kid.
  const hs = clamp(1 + (p.hs - 1) * (p.hs >= 1 ? H_SPREAD_UP : H_SPREAD_DOWN) + jh, 0.90, 1.19);
  // 1.12 is the ceiling because the collider is a fixed ±0.25 m box (see the
  // spawn below) and a body drawn wider than the box it carries is a person you
  // can walk through the edge of. The widest cast member is 1.10 before jitter.
  const ws = clamp(1 + (p.ws - 1) * W_SPREAD + jh * W_FOLLOWS_H + jw, 0.86, 1.12);
  return { hs, ws };
}

interface Citizen {
  mesh: THREE.Mesh; tex: THREE.Texture; lane: number; home: number; z: number;
  dir: number; sp: number; ph: number; box: AABB; stuck: number; ghost: boolean;
  anim: number; cad: number;
  /** the rest of the route, as node indices; empty means "needs a plan" */
  route: number[];
  /** the node last reached, -1 before the first plan */
  at: number;
  /** seconds still to spend standing here, doing `doing` */
  wait: number;
  doing: Activity;
  /** how long something has been in the way — the passing rule's timer */
  jam: number;
  /** where this trip started, and where a double-back should head for */
  was: number; back: number;
  /** this trip's lateral bias across the walk */
  bias: number;
  /** this frame's movement, which is what the sprite's facing comes off now */
  vx: number; vz: number;
  /** index in the cast — the deterministic tie-break when two of them meet */
  id: number;
  /** the lateral offset COMMITTED to, so a pass is not re-decided every frame */
  pick: number;
  /** the smoothed heading the sprite is drawn from, and the view sector it is
   *  holding — both exist to stop a walker twitching, see the frame hook */
  head: number; sector: number;
  /** the last position known to be legal, and how long we have been illegal —
   *  the crowd's half of what ct/fp.ts does for the player rig */
  good: { x: number; z: number }; stuckT: number;
  /** GIVING GROUND to a vehicle: seconds still committed to stepping backwards,
   *  and metres given up in this episode. The commitment is the anti-oscillation
   *  latch (`c.pick` is sticky for the same reason); the budget is what stops a
   *  walker retreating down the block if the car never leaves. */
  backing: number; gave: number;
  /** the umbrella billboard, how far it is open (0 furled … 1 up), and the
   *  height of this person's painted head — the canopy hangs off that, so a
   *  short walker's umbrella is not floating over a tall one's */
  umb: THREE.Mesh; umbOpen: number; figTop: number;
  /** does this person own an umbrella at all — see `UMB_SHARE`. Fixed for the
   *  run, so nobody gains or loses one walking in and out of view. */
  owns: boolean;
  /** the same figure with a hand up, and which sheet is on the mesh now */
  texUp: THREE.Texture; holding: boolean;
  /** what the sprite is currently showing — for the feet check, see `views` */
  view?: { col: number; mirror: boolean; yaw: number; moving: boolean } }

export interface Crowd {
  /** test affordance: every person's painted sprite sheet (scripts/people.mjs) */
  atlases: () => string[];
  /** test affordance: who is on the block, how big and how fast */
  people: () => { sp: number; cad: number; hs: number; ws: number; footY: number }[];
  /** where everybody is standing right now. Read by ct/traffic.ts, which will
   *  not drive through a person — so this has to be live positions, not the
   *  build-time cast. */
  /** test affordance: where each person is AND what they are doing, because
   *  x/z alone cannot tell a citizen waiting 20 s for the 42 from one jammed
   *  against a crossing — and "pedestrians pile up and get stuck" is exactly
   *  that distinction. `wait` is the errand timer, `doing` the errand, `jam`
   *  the seconds this walker has been unable to make progress. */
  walkers: () => { x: number; z: number; wait: number; doing: string; jam: number; ghost: boolean }[];
  /** test affordance: which atlas column each person is showing and whether it
   *  is mirrored, with the billboard's yaw and their direction of travel. This
   *  is what makes "does the painted toe point the way they walk" checkable —
   *  the profile column is asymmetric now, so the mirror matters and a
   *  screenshot of one angle cannot answer it (scripts/feet-check.mjs). */
  views: () => { vx: number; vz: number; col: number; mirror: boolean; yaw: number;
    moving: boolean; doing: string; to: string }[];
  /** Paint an arbitrary Look and hand back the sheet as a data URL. This is how
   *  notes/CITIZEN-STYLE.md's contact sheet is generated — an agent needs to SEE
   *  the range of people the atlas makes, not read adjectives about them. */
  paint: (look: Look) => string;
  /** test affordance: route between two named nodes of the walkable network, so
   *  a probe can assert the graph CONNECTS rather than waiting to observe a trip
   *  that depends on a random destination draw (scripts/crowd-net.mjs) */
  /** test affordance: a route BETWEEN TWO NAMED NODES, and the edges it walks.
   *  `road` on an edge is what "cross at the crossing, and only at the
   *  crossing" comes to, and until now it was unreadable from outside — an
   *  audit could see that nobody was stranded at the side street's east end
   *  but not that the edge there is flagged, which is a different claim. */
  netRoute: (fromId: string, toId: string) => {
    hops: number; len: number;
    edges: { from: string; to: string; road: boolean; half: number; len: number }[];
    crossings: number;
  } | null;
}

export function buildCrowd(ctx: CtxBuild, o: CrowdOpts): Crowd {
  const { scene, sidewalkY } = ctx;
  const net = buildNet(o);
  const citizens: Citizen[] = [];

  // ── UMBRELLAS ────────────────────────────────────────────────────────────
  //
  // *"give people umbrellas if they're out walking and it rains."*
  //
  // A PROP BESIDE THE ATLAS, NOT A SIXTH VIEW IN IT — and that is a deliberate
  // reading of CITIZEN-STYLE.md rather than a shortcut around it. The rule there
  // is that a PERSON must come from the atlas, because four cardboard people got
  // into this world hand-drawn beside it. An umbrella is not a person, and it has
  // the one property that makes the atlas unnecessary: **a canopy is a dome, so
  // it presents the same silhouette from every horizontal angle.** The five
  // painted views exist because a body does not.
  //
  // It composes correctly for free. The citizen sprite is a billboard turned to
  // the camera each frame, and this is a billboard at the same position given the
  // same rotation — so the two stack exactly like a 2D overlay, at every angle,
  // including the mirrored half of the sheet. Painting it into the atlas instead
  // would have meant repainting six canvases on every weather change and a `Look`
  // field that ten interior callers would have to learn to leave alone.
  //
  // DENSITY IS THE ATLAS'S, DERIVED (BUILDER-BRIEF §7b). The citizen sheet is
  // FW = 32 texels across a 0.95 m plane = 33.7 px/m. This is 32 texels across a
  // 0.95 m plane. An umbrella at a different resolution from the hand holding it
  // is exactly the kind of seam the user finds by eye.
  // 1.14 m across at 38 texels = 33.3 px/m, against the citizen sheet's
  // FW/0.95 = 33.7. An umbrella whose pixels are a fifth bigger than the pixels
  // of the hand holding it is precisely the seam BUILDER-BRIEF §7b is about, and
  // a first cut at 0.95 m / 32 px read as a HAT rather than a brolly — a canopy
  // has to be wider than the shoulders it is keeping dry.
  const UMB_M = 1.14, UMB_PX = 38;
  /** muted, 1997, and no two of the six alike — indexed, never drawn from
   *  `rnd()`: that stream's ORDER is load-bearing (GOTCHAS 2) and one extra
   *  draw here would re-grain every texture built after the crowd. */
  const UMB_CANOPY = ['#23262c', '#33414f', '#3d3a2c', '#4a2c2c', '#2d3f36', '#40384a'];
  // Rows are FRACTIONS of UMB_PX, not literals. The first cut hard-coded them
  // for a 32 px sheet, so changing the canopy's size would have silently moved
  // the hem into the wearer's face — which is the fault it already had.
  // 0.37 -> 0.46. *"umbrella looks so janky."* At 0.37 the dome was 13 rows for
  // 36 texels of width — an aspect of 0.36, which is a PLATE. Photographed at
  // 4 m (`shots/w110-umb-before-0-4m.png`) it reads as a flat dark brim and not
  // as a canopy, and no amount of hem scalloping rescues a silhouette that
  // shallow. 17 rows takes the aspect to 0.47, which is about what a real
  // 8-rib canopy does. It costs the shaft two rows and the shaft has plenty.
  const UMB_HEM = Math.round(UMB_PX * 0.46);     // last row of canopy
  /** metres a row — and a texel here is a texel on the citizen sheet, 0.030
   *  against 0.0297, which is the density match derived above. Everything
   *  below converts between the two sheets with that. */
  const UMB_ROW_M = UMB_M / UMB_PX;
  /**
   * HOW FAR THE HEM CLEARS THE CROWN — 0.10 -> 0.30, and this is the change
   * that does most of the work.
   *
   * *"umbrella looks so janky."* (2026-08-03.) The previous fix widened the
   * canopy, on the reading that *"a canopy has to be wider than the shoulders
   * it is keeping dry"* — true, and it did not cure it, because WIDTH was
   * never what made it a hat. **HEIGHT IS.** A hat sits ON the head; an
   * umbrella floats above it on a stick, and the thing your eye actually reads
   * is the DAYLIGHT in between.
   *
   * At 0.10 m there was no daylight to read. Photographed at 1.6, 4 and 8 m in
   * rain (`shots/w110-umb-before-0-*.png`): at 4 m — normal walking distance,
   * which is the distance the item is judged at — the 10 cm gap is **1.4° of
   * arc, about 12 screen px**, and both the hair and the canopy are dark, so
   * the two silhouettes fuse into one dark mass sitting on the shoulders. The
   * shaft that should have separated them is ONE texel of `#4a4a52` drawn
   * straight down over dark brown hair, so it contributed nothing.
   *
   * 0.30 m puts a clear third of a metre of sky between crown and hem, and —
   * this is the part that matters more than the number — **it moves the shaft
   * off the head and into open air**, where a one-texel dark line against the
   * street reads immediately. Nothing about the shaft's drawing changed.
   *
   * A LOOKED-AT VALUE, AND SAID SO. There is no quantity in this file it can
   * be derived from: it is how much air a person reads as "held above", and
   * the only instrument for that is the frame. Do not dress it up in a formula
   * — the constant next door in `ct/hud.ts` spent a session wearing one that
   * was arithmetically wrong. Before/after frames are `shots/w110-umb-*.png`.
   *
   * (Hoisted above `umbrellaTex` from further down the file: the handle's row
   * is DERIVED from it and has to be in scope.)
   *
   * 0.30 -> 0.24. *"people still hold umbrellas a bit weird"* (2026-08-05) —
   * and the frame shows a canopy hanging in its own patch of sky. The reasoning
   * above still holds: daylight between crown and hem is what stops it reading
   * as a hat. But 0.30 m was chosen when the only thing crossing that daylight
   * was a ONE-TEXEL shaft that contributed nothing (its own words), so the gap
   * had to carry the whole read on its own and was set as wide as it could be.
   * The shaft below is two texels and two tones now and carries its half, so
   * the gap can come back to what an umbrella actually clears a head by —
   * 8 texels of air is still an unmistakable gap, and 6 cm less of it is 6 cm
   * less of the float the report is about.
   */
  const UMB_CLEAR = 0.24;
  /**
   * WHERE THE HANDLE IS — TAKEN FROM THE HAND THAT HOLDS IT, not chosen.
   *
   * *"citizens hold their umbrella weird please fix this"* (2026-08-04.) It was
   * `0.79 · UMB_PX` = row 30, and the atlas painted the fist 20 cm HIGHER than
   * that: the hand closed on bare shaft up beside the canopy while the wooden
   * crook hung unheld by the citizen's eyes. Two numbers, in two files, each
   * citing the other in a comment, drifted apart exactly as comments do.
   *
   * So it is imported now. `HOLD_DROP_M` is how far the fist sits below the
   * painted figure's top; the hem sits `UMB_CLEAR` above that same top; so the
   * handle belongs `UMB_CLEAR + HOLD_DROP_M` = 0.63 m below the hem — which is
   * also, not by coincidence, the shaft length of a real stick umbrella.
   */
  const UMB_GRIP = UMB_HEM + Math.round((UMB_CLEAR + HOLD_DROP_M) / UMB_ROW_M);
  /**
   * AND THE SHAFT LEANS OUT TO MEET IT.
   *
   * The other half of "weird", and the half that only appears once the hand
   * comes down: a shaft drawn straight down the sprite's centre line runs
   * through the citizen's face. It always did — at the old grip row it merely
   * stopped at the forehead instead of passing the chin.
   *
   * The fist is `HOLD_X` texels outboard on the citizen sheet, and a texel
   * there is a texel here, so the shaft's foot goes to the same column.
   *
   * THE CANOPY STAYS CENTRED. A dome centred over the head is the silhouette
   * that reads as shelter, and it is what the last two items on this prop were
   * spent getting right — so the shaft tilts under it rather than the whole
   * umbrella sliding sideways. That is also what a real one held out to one
   * side does: 6 texels across the shaft's 21 is about 16°.
   */
  const UMB_LEAN = HOLD_X;
  /**
   * TALLER THAN IT IS WIDE, and only now.
   *
   * The canopy's proportions are still fractions of the WIDTH, so the dome is
   * texel-for-texel the one item 271 landed. These extra rows are shaft and
   * handle: a square 38-row sheet had 8 rows under the hem, and the handle now
   * needs 19 of them plus its crook. Same `UMB_ROW_M` density throughout, so
   * nothing about the canopy's scale moves.
   *
   * 6 -> 8 rows of tail, because the crook moved BELOW the fist instead of
   * being painted over it — see the handle.
   */
  const UMB_PXH = UMB_GRIP + 8;
  const UMB_MH = UMB_PXH * UMB_ROW_M;
  const umbrellaTex = (canopy: string) => pixTex(UMB_PX, UMB_PXH, (g) => {
    const cx = UMB_PX / 2, top = 2, wide = UMB_PX / 2 - 1;
    g.clearRect(0, 0, UMB_PX, UMB_PXH);
    const halfAt = (y: number) =>
      2 + (wide - 2) * Math.sqrt(Math.max(0, (y - top) / (UMB_HEM - top)));
    // the dome, drawn row by row so its edge stays a hard pixel step rather
    // than an anti-aliased arc that NearestFilter would only fight
    g.fillStyle = canopy;
    for (let y = top; y <= UMB_HEM; y++) {
      const hw = Math.round(halfAt(y));
      g.fillRect(cx - hw, y, hw * 2, 1);
    }
    // ribs: ONE texel each. The canopy is 12 rows tall, and a 2-texel band on
    // something this size reads as an AREA rather than as shading — the same
    // mistake CITIZEN-STYLE.md records against faces.
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (const f of [-0.72, -0.26, 0.26, 0.72]) {
      for (let y = top + 2; y <= UMB_HEM; y++) {
        const hw = halfAt(y);
        g.fillRect(cx + Math.round(f * hw), y, 1, 1);
      }
    }
    // ── FORM, so the dome is not a flat cut-out ──────────────────────────
    //
    // *"umbrella looks so janky."* The canopy was ONE flat colour with four
    // one-texel ribs, and a shape with no light on it has no volume — at 4 m
    // that is most of why it read as a hat rather than as something arched
    // over a head. Two broad areas, not bands: the sun in this world comes
    // from the RIGHT (the same reading `ct/hud.ts` uses for the wrist), so the
    // right flank catches it and the left falls away.
    //
    // AND THESE ARE AREAS ON PURPOSE, which is the opposite of the rule two
    // comments up. That rule is about RIBS — a rib is a line, and a 2-texel
    // line stops being one. Shading is not a line, and drawing it one texel at
    // a time is what left the canopy flat.
    const flank = (from: number, to: number, style: string) => {
      g.fillStyle = style;
      for (let y = top + 1; y <= UMB_HEM; y++) {
        const hw = halfAt(y);
        const a = Math.round(from * hw), c2 = Math.round(to * hw);
        g.fillRect(cx + Math.min(a, c2), y, Math.abs(c2 - a), 1);
      }
    };
    flank(0.40, 1.0, 'rgba(255,255,255,0.09)');   // lit flank
    flank(-1.0, -0.44, 'rgba(0,0,0,0.16)');       // shadowed flank
    // …AND THE UNDERSIDE. A canopy is a shell: from eye level you see the last
    // of its inner face turning away from you, and that face gets no sky at
    // all. Without it the hem was a hard bright edge, which is exactly the
    // silhouette of a brim.
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = UMB_HEM - 1; y <= UMB_HEM; y++) {
      const hw = Math.round(halfAt(y));
      g.fillRect(cx - hw, y, hw * 2, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.10)';      // a little sky on the crown
    g.fillRect(cx - 4, top + 1, 8, 1);
    // A SCALLOPED HEM, so it reads as fabric stretched between those ribs —
    // AND IT MUST BE THE LAST THING DRAWN ON THE CANOPY. It cuts holes with
    // `clearRect`, so any shading painted after it fills the notches back in
    // with a translucent pixel. It used to sit above the crown highlight and
    // the flanks below would have quietly undone it.
    for (const f of [-0.88, -0.5, 0.5, 0.88]) {
      g.clearRect(cx + Math.round(f * halfAt(UMB_HEM)) - 1, UMB_HEM, 2, 1);
    }
    // ── THE SHAFT: TWO TEXELS WIDE, AND TWO TONES ────────────────────────
    //
    // *"people still hold umbrellas a bit weird"* (2026-08-05) — and what the
    // frame actually shows is a canopy with NO STICK UNDER IT. It was one texel
    // of `#4a4a52`: 3 cm, about a screen pixel and a half at the distance the
    // item is judged from, in a value that sits squarely between the wet road,
    // the brick and the dark coats it passes in front of. The note on UMB_CLEAR
    // above had already said so in passing — *"the shaft that should have
    // separated them is ONE texel … so it contributed nothing"* — and then went
    // and widened the gap instead of the shaft. A canopy with nothing visible
    // holding it up is a canopy that floats, which is the report.
    //
    // Two texels, and the two are DIFFERENT VALUES on purpose. A single-value
    // line has to be either darker or lighter than what is behind it, and this
    // one run crosses sky, brick, road and the wearer's own coat. A dark column
    // beside a light one carries its own contrast against all four, which is
    // the same trick the dome's lit and shadowed flanks are.
    //
    // A row at a time, so the lean is a hard staircase rather than an arc
    // NearestFilter would only fight; the same way the dome above is drawn.
    const shaftAt = (y: number) =>
      cx + Math.round(UMB_LEAN * (y - UMB_HEM) / (UMB_GRIP - UMB_HEM));
    g.fillStyle = '#3a3a42';
    g.fillRect(cx, 0, 1, top);                   // the spike above the dome
    for (let y = UMB_HEM + 1; y <= UMB_GRIP + 1; y++) {
      g.fillStyle = '#3a3a42'; g.fillRect(shaftAt(y), y, 1, 1);
      g.fillStyle = '#7c7c88'; g.fillRect(shaftAt(y) + 1, y, 1, 1);
    }
    // ── AND A CROOK THE HAND IS ABOVE, NOT BURIED IN ─────────────────────
    //
    // It started AT `UMB_GRIP` — the very rows the atlas paints the fist on —
    // and this billboard is drawn 6 cm in FRONT of the person, so the handle
    // was painted straight over the hand holding it. Reconciling the two
    // numbers in the last item got them to the same PLACE and that turned out
    // to be the problem: at the same place, the front one wins, and all that
    // was left to read was a 3-texel brown blob where a hand should be.
    //
    // The fist is three rows deep centred on the grip, so the wood starts two
    // rows below it and hangs clear: hand on the shaft, handle under the hand.
    // Two texels thick like the shaft, because a crook thinner than the stick
    // it ends reads as a fray. It still hooks back INBOARD, toward the body —
    // the way a crook faces on an umbrella carried out to one side.
    const gx = shaftAt(UMB_GRIP), hy = UMB_GRIP + 2;
    g.fillStyle = '#6b4526';
    g.fillRect(gx, hy, 2, 4);                    // the wood, straight down
    g.fillRect(gx - 3, hy + 3, 5, 2);            // …turning in at the bottom
    g.fillRect(gx - 3, hy + 1, 2, 3);            // …and back up, closing the C
    g.fillStyle = 'rgba(0,0,0,0.25)';            // lit from the right, as the dome is
    g.fillRect(gx + 1, hy, 1, 4);
  });
  // WHERE THE HEM LANDS IS THE WHOLE THING, and the first cut got it wrong: it
  // put the hem 2.7 cm BELOW the crown, so the canopy sat ON the head and the
  // whole thing read as a mushroom cap rather than an umbrella. Photographed
  // before it was believed — shots/w96-umbrella-*.png.
  //
  // So the offset is DERIVED from where the hem is in the sheet instead of being
  // a lift chosen by eye. `citizenPlane` is 1.9 m tall and the painted figure
  // fills 56 of its 64 rows (CITIZEN-STYLE.md), so the crown is 1.9 · 56/64 · hs.
  const FIG_TOP = 1.9 * (56 / 64);
  /** hem's distance below the plane's top edge, in metres */
  const UMB_HEM_M = UMB_HEM * UMB_ROW_M;
  const umbGeo = new THREE.PlaneGeometry(UMB_M, UMB_MH);
  /** raise at, and lower below — two thresholds, not one. See the frame hook. */
  const UMB_UP = 0.12, UMB_DOWN = 0.05;
  /**
   * HOW MANY OF THE BLOCK OWN ONE — *"not everyone should have an umbrella like
   * half of everyone maybe"* (2026-08-05). One number to tune.
   */
  const UMB_SHARE = 0.5;
  /**
   * …AND WHO. A PROPERTY OF THE PERSON, FIXED FOR THE RUN.
   *
   * The obvious version — roll for it when the rain starts — is the one thing
   * this must not be: the same walker would come back from the far end of the
   * block with an umbrella they did not leave with, and a shower that eased and
   * returned would re-deal the whole street. So it is a pure function of `id`,
   * which is the walker's index in CAST and never changes.
   *
   * NO DRAW FROM `rnd()`. That stream's ORDER is load-bearing (GOTCHAS 2) and
   * every texture built after the crowd would re-grain if this consumed from
   * it — the same reason `UMB_CANOPY` is indexed rather than sampled. This is a
   * hash of the id instead, so the draw count is exactly what it was.
   *
   * AND THE SHARE IS EXACT, by RANK rather than by threshold. Six people is a
   * small enough sample that `hash(id) < 0.5` can easily come out 2 or 5 of 6;
   * sorting the cast by the hash and taking the first half gives three, and
   * gives `round(n · UMB_SHARE)` for any cast this grows to. Arbitrary but
   * fixed, which is the whole requirement.
   */
  const umbKey = (id: number) => {
    let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const umbOwners = new Set(
    CAST.map((_, i) => i)
      .sort((a, b) => umbKey(a) - umbKey(b))
      .slice(0, Math.round(CAST.length * UMB_SHARE)));

  CAST.forEach((p, i) => {
    // THE PERSON'S OWN SIZE, not the role's — and it is worked out BEFORE the
    // atlas is painted, because stride is drawn into the sprite sheet and a
    // walker whose legs swing to a height they are not is the "skating" fault
    // the note on `strideFor` describes.
    const { hs, ws } = bodyScale(p);
    const tex = citizenAtlas({ ...p.look, stride: strideFor(p.sp, hs) });
    tex.repeat.set(1 / 5, 1 / 2);
    // ── AND THE SAME PERSON WITH A HAND UP ───────────────────────────────
    //
    // Item 271 fixed the canopy and named what it could not reach: *"both arms
    // still hang at the sides, so nobody appears to be holding the thing."*
    //
    // A SECOND SHEET, not a second field on the live mesh. The pose is painted
    // into the atlas — that is where arms live — and an atlas is baked once,
    // so a pose that changes with the weather has to be a second bake and a map
    // swap. It costs one 160 × 128 canvas per walker, which is the same price
    // this loop already pays for the first one.
    //
    // NO `rnd()` DRAW IS ADDED. That stream's ORDER is load-bearing (GOTCHAS 2)
    // and one extra draw here would re-grain every texture built after the
    // crowd; `citizenAtlas` takes all its colour from the `Look` and never
    // touches the shared LCG, so painting it twice moves nothing.
    //
    // …AND ONLY FOR THE HALF WHO OWN ONE. A walker with no umbrella never swaps
    // sheets, so the second bake is a canvas painted to be never sampled. The
    // rest fall back to `tex`, which is the atlas's ordinary arms-down pose —
    // the one the whole world already uses and the only one it had before this
    // prop existed. They walk the block in the rain unsheltered, which is what
    // half a street does.
    const owns = umbOwners.has(i);
    let texUp = tex;
    if (owns) {
      texUp = citizenAtlas({ ...p.look, stride: strideFor(p.sp, hs), holdUp: true });
      texUp.repeat.set(1 / 5, 1 / 2);
    }
    // the geometry is translated so the origin is at the FEET, so scaling
    // height never lifts anyone off the pavement or sinks them into it
    const geo = citizenPlane();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(ws, hs, 1);
    // home lanes sit in the clear strip between the kerb props and the wall
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 1.05 + (i % 3) * 0.17);
    const z = 4 - i * 16; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    o.lit(mesh);             // people walk through the pools too
    // ±0.25, not ±0.30: bodies read the tiniest bit too wide to slip past.
    // With the rig's 0.36 m radius that puts the gap needed to squeeze by a
    // person at 0.61 m instead of 0.72 m.
    const box: AABB = { minX: lane - 0.25, maxX: lane + 0.25, minZ: z - 0.25, maxZ: z + 0.25 };
    o.solid(box);            // people are solid — the box follows them
    // …and an umbrella, furled until it rains. NOT registered with `o.lit` and
    // NOT given a collider: it is above head height, so lamplight pooling on it
    // would light a surface no lamp can reach, and a collider on it would let a
    // canopy shove the player.
    const umb = new THREE.Mesh(umbGeo, new THREE.MeshBasicMaterial({
      // …and no canvas at all for the half who do not own one: the mesh stays
      // so every walker is the same shape of record, but it never turns visible
      // and there is nothing to sample. The colour is still indexed off `i`, so
      // the owners keep the spread of canopies they had.
      map: owns ? umbrellaTex(UMB_CANOPY[i % UMB_CANOPY.length]) : null,
      // alphaTest ALONE. Setting `transparent` as well is GOTCHAS 22, and it is
      // also why the open/shut is done with SCALE rather than a fade: opacity
      // needs `transparent`, and the pair of them is the documented fault.
      alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    umb.visible = false;
    scene.add(umb);
    citizens.push({
      umb, umbOpen: 0, figTop: FIG_TOP * hs, texUp, holding: false, owns,
      mesh, tex, lane, home: lane, z, dir: i % 2 ? 1 : -1, sp: p.sp,
      ph: i * 1.3, box, stuck: 0, ghost: false, anim: i * 1.3,
      cad: 5 * Math.sqrt(p.sp) / hs,     // cadence: long legs swing slower
      route: [], at: -1, wait: 0, doing: 'none', jam: 0, bias: 0, vx: 0, vz: 0,
      was: -1, back: -1, id: i, pick: 0, head: i % 2 ? 0 : Math.PI, sector: -1,
      good: { x: lane, z }, stuckT: 0, backing: 0, gave: 0,
    });
  });

  // is a citizen's footprint clear of every solid PROP (trees, cars, …)?
  // (the player isn't in this set — people phase the player, never props)
  const clearAt = (x: number, z: number) =>
    !o.citAvoid.some((a) => x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ);
  /** …and clear of everybody ELSE. The old sim never checked this: people
   *  walked straight through one another, which is the one thing the brief
   *  called a non-negotiable. A candidate position is only taken if it is clear
   *  of props AND of every other body, so overlapping is impossible rather than
   *  merely discouraged — the first cut here paused and then squeezed through
   *  after 0.8 s, which is walking through somebody politely. */
  const clearOfPeople = (x: number, z: number, self: Citizen) =>
    !citizens.some((q) => q !== self && !q.ghost && Math.hypot(q.lane - x, q.z - z) < 0.46);

  // ── WHICH OBSTACLES WILL GO AWAY IF YOU WAIT? ───────────────────────────
  //
  // Backing off a TREE is not patience, it is a walker reversing down the
  // street. Backing off a car is what the user asked for. Nothing in the AABB
  // itself says which is which — `citAvoid` is one flat list, and since item 198
  // it is most of the world's static geometry (359 of 508 player colliders) with
  // the handful of vehicle boxes mixed in.
  //
  // So the list is not asked what a box IS, it is watched for what a box DOES: a
  // box seen at two different positions has moved, and only a vehicle ever does.
  // That is a fact this module can establish for itself, without importing
  // traffic's internals or trusting a flag somebody has to remember to set.
  //
  // IT MUST BE "HAS EVER MOVED", NOT "MOVED THIS FRAME" — and that distinction
  // is the whole point. The case this exists for is a taxi DWELLING at the kerb,
  // which by definition is not moving right now. A frame-to-frame test would go
  // blind at exactly the moment the walker needs it. Vehicles are parked off the
  // map at x = 999 (ct/traffic.ts:221) and driven in, so one is marked the
  // instant it reaches the block and stays marked.
  const boxAt = new Map<AABB, { x: number; z: number }>();
  const movers = new Set<AABB>();
  const trackMovers = () => {
    for (const a of o.citAvoid) {
      const was = boxAt.get(a);
      if (!was) { boxAt.set(a, { x: a.minX, z: a.minZ }); continue; }
      if (was.x !== a.minX || was.z !== a.minZ) { was.x = a.minX; was.z = a.minZ; movers.add(a); }
    }
  };
  /** the MOVING obstacle covering this spot, if any — same footprint `clearAt`
   *  refuses on, so "this candidate failed" and "a vehicle is why" agree. */
  const moverAt = (x: number, z: number) => {
    for (const a of movers) {
      if (x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ) return a;
    }
    return null;
  };

  // ── being somewhere illegal, and leaving ────────────────────────────────
  //
  // The sim could only ever REFUSE motion: every candidate position was tested
  // and a blocked walker simply stood. That is fine until it is standing
  // somewhere it should not be, and then nothing recovers it — which is the pair
  // frozen on the carriageway either side of a parked car.
  //
  // ct/fp.ts solved exactly this for the player rig, so this is that solution
  // with the crowd's own numbers rather than a second invention: the minimum
  // translation out of a box (the smallest of the four axis escapes, which for an
  // AABB is the shortest way out), eased rather than snapped so a walker resting
  // legally against a wall is never shoved, and a last-known-good fallback when
  // the push keeps cancelling.
  const CIT_R = 0.28;          // the same footprint clearAt tests with
  const UNSTICK = 1.4;         // m/s — walk out, do not teleport
  const PATIENCE = 1.2;        // s of getting nowhere before falling back
  /** Push out of a box — and PREFER THE PAVEMENT when there is a choice.
   *
   *  The plain minimum translation is what F's `fp.ts` does for the rig, and it
   *  is right for a capsule that may stand anywhere. A citizen may NOT stand
   *  anywhere: it belongs on the 2 m walk. Pushing it out of a car parked at
   *  the kerb by the shortest route pushes it INTO THE ROAD about half the
   *  time, because the shortest way out of a kerbside box is usually
   *  roadward — and the queue's diagnosis of the user's shot is exactly that,
   *  "a walker shoved off the kerb to get round a bin is a bug in the
   *  avoidance, not in the graph".
   *
   *  So all four exits are scored, not just measured: the cost is how far the
   *  push is PLUS how far it leaves you from the line you were walking. A
   *  slightly longer push that keeps you on the pavement wins.
   */
  const escapeFrom = (c: AABB, x: number, z: number,
    /** the walk line to stay near: the edge being walked, if there is one */
    line?: { ax: number; az: number; bx: number; bz: number }) => {
    const left = x - (c.minX - CIT_R);
    const right = (c.maxX + CIT_R) - x;
    const back = z - (c.minZ - CIT_R);
    const front = (c.maxZ + CIT_R) - z;
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) return null;   // outside
    const opts = [{ dx: -left, dz: 0 }, { dx: right, dz: 0 },
      { dx: 0, dz: -back }, { dx: 0, dz: front }];
    if (!line) {
      const d = Math.min(left, right, back, front);
      if (d === left) return opts[0];
      if (d === right) return opts[1];
      if (d === back) return opts[2];
      return opts[3];
    }
    const offLine = (px: number, pz: number) => {
      const vx = line.bx - line.ax, vz = line.bz - line.az;
      const L2 = vx * vx + vz * vz;
      const t = L2 < 1e-9 ? 0
        : Math.max(0, Math.min(1, ((px - line.ax) * vx + (pz - line.az) * vz) / L2));
      return Math.hypot(px - (line.ax + t * vx), pz - (line.az + t * vz));
    };
    let best = opts[0], bestCost = Infinity;
    for (const o2 of opts) {
      // 1.4 weights "stay on the walk" above "move the least". Below about 1
      // the shortest push still wins next to a kerbside car, which is the
      // case this exists for.
      const cost = Math.hypot(o2.dx, o2.dz) + 1.4 * offLine(x + o2.dx, z + o2.dz);
      if (cost < bestCost) { bestCost = cost; best = o2; }
    }
    return best;
  };
  /** push a citizen out of anything it is inside, and if that gets nowhere put it
   *  back on the last node it legally stood on */
  const unstick = (c: Citizen, dt: number) => {
    // the line this walker should be on, so a push can prefer to keep it there
    const la = c.at >= 0 ? net.nodes[c.at] : null;
    const lb = c.route.length ? net.nodes[c.route[0]] : null;
    const line = la && lb ? { ax: la.x, az: la.z, bx: lb.x, bz: lb.z }
      : la ? { ax: la.x, az: la.z, bx: la.x, bz: la.z } : undefined;
    let px = 0, pz = 0;
    for (const b of o.citAvoid) {
      const e = escapeFrom(b, c.lane, c.z, line);
      if (e) { px += e.dx; pz += e.dz; }
    }
    if (px === 0 && pz === 0) {                 // legal: remember it
      c.good.x = c.lane; c.good.z = c.z;
      c.stuckT = 0;
      return;
    }
    c.stuckT += dt;
    const len = Math.hypot(px, pz);
    if (len > 1e-6) {
      const step = Math.min(len, UNSTICK * dt);
      c.lane += (px / len) * step;
      c.z += (pz / len) * step;
    }
    if (c.stuckT > PATIENCE) {
      // Back to the last node we know is legal — a node, not just the last
      // position, because a walker shoved off the kerb wants to be back ON the
      // pavement network, not a metre further along the gutter.
      const home = c.at >= 0 ? net.nodes[c.at] : null;
      const to = home && !o.citAvoid.some((b) => escapeFrom(b, home.x, home.z, undefined))
        ? { x: home.x, z: home.z } : c.good;
      c.lane = to.x; c.z = to.z;
      c.route = []; c.pick = 0; c.stuckT = 0;   // and re-plan from there
    }
  };

  /** seconds of getting nowhere before a walker stops waiting and goes round */
  const JAM_GIVE_UP = 2.0;
  // ── giving ground, and the four numbers that bound it ────────────────────
  /** s of getting nowhere before a walker will step BACK. Longer than a frame
   *  or two of ordinary jostling, shorter than JAM_GIVE_UP, so the escalation
   *  stays ordered: stand, go round, give ground, reroute. */
  const BACK_AFTER = 0.35;
  /** s the widened look-ahead below survives after the last walled frame. This
   *  is the anti-oscillation latch and it is the SECOND one I had to write: the
   *  first latched the RETREAT, which was useless, because what needed latching
   *  was the decision to stop advancing. */
  const BACK_HOLD = 0.6;
  /** Extra metres of look-ahead once a walker is already giving way — a Schmitt
   *  trigger, and without it this rule jitters instead of yielding.
   *
   *  MEASURED, not guessed. With a single threshold a walker parked itself at
   *  x = -3.18 with the taxi's box edge 3.53 m away and vibrated there for 65
   *  seconds: at 3.53 m the wall test did not fire so it stepped forward, at
   *  3.40 m it did so it stepped back, jam pinned at 0.38 s and 21 direction
   *  reversals. It never "stood still" for a single sample, so a stand-timer
   *  read it as perfectly healthy — the trace is what showed it
   *  (scripts/probes/w96-watch-the-retreat.mjs). Engaging at BACK_LOOK and only
   *  releasing at BACK_LOOK + this makes yielding a decision the walker holds
   *  until the car has actually gone. */
  const BACK_HYST = 1.6;
  /** retreat at a fraction of walking pace: nobody walks backwards at a stride */
  const BACK_RATE = 0.7;
  /** m of ground one episode may give up. The road is 10 m wide, so this is
   *  enough to get off a crossing and back to the kerb it was entered from, and
   *  not enough to walk anybody down the block if the car never leaves. */
  const BACK_MAX = 2.5;
  /** m of route ahead scanned for a vehicle. MUST EXCEED `BACK_MAX`, and that
   *  is not a taste call — it is the whole difference between giving way and
   *  oscillating. The first cut tested ONE point, at `t + step`. A walker that
   *  had retreated even a few centimetres found that point clear, stepped
   *  forward into the car again, was blocked again, and retreated again: a limit
   *  cycle at the box's edge. It measured as a triumph — nobody stood for more
   *  than 0.9 s and 21.78 m of ground was "given" — while walker-frames in the
   *  roadway went from 592 to 5787, i.e. the crowd now LIVED in the road,
   *  shuttling. Scanning past the retreat budget means the car is still in sight
   *  when the walker has backed off as far as it will go, so it waits there
   *  instead of walking back into it. */
  const BACK_LOOK = 3.4;
  /** Is a vehicle across the way ahead with NO lateral room to pass it?
   *
   *  Every offset the placement search would try is scanned, not just the
   *  committed one, so this cannot suppress a manoeuvre that would have worked:
   *  if any lane of the walk is clear the answer is no, and the ordinary "go
   *  round it" search runs untouched. It says yes only when a walker is
   *  genuinely walled in — which on a 2.6 m crossing with a 2.3 m car across it
   *  is the real case. */
  const vehicleWall = (A: { x: number; z: number }, dx: number, dz: number,
    rx: number, rz: number, t: number, half: number, pick: number, look: number) => {
    if (!movers.size) return false;                 // no vehicle anywhere: free
    for (const off of [pick, 0, half * 0.9, -half * 0.9]) {
      const o2 = Math.max(-half, Math.min(half, off));
      let hit = false;
      for (let u = 0.25; u <= look; u += 0.3) {
        if (moverAt(A.x + dx * (t + u) + rx * o2, A.z + dz * (t + u) + rz * o2)) { hit = true; break; }
      }
      if (!hit) return false;                       // this lane is clear: go round
    }
    return true;
  };

  // ── having somewhere to be ──────────────────────────────────────────────
  //
  // A destination and a reason for it. The old sim gave everybody the same
  // errand — walk to the end of the block, turn round — which is why varying
  // their speeds did not make the street feel any more alive: six people doing
  // one thing at six paces is still six people doing one thing.
  //
  // Weighted so most trips are just a walk somewhere, with the errands
  // sprinkled in; `rnd()` here runs at RUNTIME only, never during the build.
  const WAIT: Record<Activity, [number, number]> = {
    window: [5, 12],      // stop and look in
    door: [4, 8],         // hesitate in a doorway
    bench: [12, 25],      // wait for the 42
    corner: [1.5, 4],     // pause at the kerb before crossing
    none: [0.5, 2.5],     // even a plain stretch gets a beat, so nobody pivots
  };
  const plan = (c: Citizen) => {
    const from = c.at >= 0 ? c.at : net.nearest(c.lane, c.z);
    if (c.back >= 0 && c.back !== from) {              // double back
      c.route = net.route(from, c.back).slice(1);
      c.was = from; c.at = from; c.back = -1;
      c.bias = (rnd() - 0.5) * 2 * STRAY;
      if (c.route.length) return;
    }
    c.was = from;
    // pick somewhere that is not where we already are, biased toward the marked
    // errands — and every so often turn straight round and double back, which
    // is the one thing a shortest path will never do on its own
    // Mostly somewhere NEARBY and mostly somewhere with a reason to go: real
    // pedestrians potter about locally, and it is arrivals that produce the
    // stopping and looking, so long treks across the whole block have to be the
    // minority or nobody is ever seen doing anything.
    const here = net.nodes[from];
    let to = from;
    for (let tries = 0; tries < 10 && to === from; tries++) {
      const wantAct = rnd() < 0.75;
      // A quarter of trips ignore the local radius. That share is load-bearing
      // in BOTH directions and was tuned twice: too few long trips and the side
      // street empties out (nobody routes round the corner at all), too many and
      // everybody is permanently in transit and the errands stop showing,
      // because a cross-block walk takes the best part of a minute.
      const local = rnd() < 0.85 ? 26 : 1e9;          // metres, as the crow flies
      const pool = net.nodes
        .map((n, i) => ({ n, i }))
        .filter(({ n, i }) => i !== from && (!wantAct || n.act)
          && Math.hypot(n.x - here.x, n.z - here.z) < local)
        .map(({ i }) => i);
      if (pool.length) to = pool[Math.floor(rnd() * pool.length)];
    }
    c.route = net.route(from, to).slice(1);
    c.at = from;
    if (!c.route.length) c.route = [net.adj[from][Math.floor(rnd() * net.adj[from].length)].to];
    // a personal lateral bias, redrawn each trip, so the same person does not
    // always hug the same side of the walk
    c.bias = (rnd() - 0.5) * 2 * STRAY;
  };
  /** Blocked here: take another path, rather than waiting for the world to
   *  clear. The node we cannot reach is struck out of the graph FOR THIS
   *  WALKER, and the same destination is re-routed around it — which is the
   *  whole point. Clearing the route and re-planning (what this used to do)
   *  runs Dijkstra over an unchanged graph and returns the identical path
   *  through the identical blockage, so the walker walks back into it and jams
   *  again; that loop is the pile-up not dispersing once it forms.
   *
   *  If there is no way round — a dead-end shopfront, the closed east end — the
   *  fallback is to give up on this errand and pick a new one, which is at
   *  least motion. */
  const reroute = (c: Citizen) => {
    c.jam = 0;
    const blocked = c.route[0];
    const dest = c.route[c.route.length - 1];
    const from = c.at >= 0 ? c.at : net.nearest(c.lane, c.z);
    if (blocked === undefined || dest === undefined) { c.route = []; return; }
    const alt = net.route(from, dest, new Set([blocked]));
    if (alt.length > 1 && alt[1] !== blocked) {
      c.route = alt.slice(1);
      c.at = from;
      c.pick = c.bias;                 // the committed offset failed with it
    } else {
      c.route = [];                    // no way round: somewhere else to be
    }
  };

  const arrive = (c: Citizen) => {
    const act = net.nodes[c.at]?.act ?? 'none';
    const [lo, hi] = WAIT[act];
    c.wait = lo + rnd() * (hi - lo);
    c.doing = act;
    // …and sometimes, having got there, turn straight round and go back the way
    // you came. A shortest path will never do that on its own, and it is the
    // thing that stops the block reading as a conveyor belt.
    c.back = rnd() < 0.22 ? c.was : -1;
  };

  // citizens: ping-pong the block, show the correct painted angle. They are
  // SOLID and politely halt a step short of you — but if held up against you
  // for a beat (stuck timer), they give up and squeeze through, going
  // non-solid only until they're clear, then solid again. So they never
  // wall you in for good, and never become permanently uncollidable.
  //
  // LATE: the crowd reads the world's finished state — including the moving
  // car's box, which the traffic pass writes at the end of the frame.
  ctx.onFrame(({ dt, px, pz }) => {
    trackMovers();          // which boxes have been seen in two places — vehicles
    for (const c of citizens) {
      if (c.backing > 0) c.backing = Math.max(0, c.backing - dt);
      const dist = Math.hypot(px - c.lane, pz - c.z);
      if (dist < 1.05) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
      if (!c.ghost && c.stuck > 1.4) c.ghost = true;       // fed up → push past YOU
      if (c.ghost && dist > 1.4) { c.ghost = false; c.stuck = 0; } // clear → solid again
      const holding = dist < 1.0 && !c.ghost;              // standing a step short of you
      // ── the plan ────────────────────────────────────────────────────────
      // Everybody is on their way SOMEWHERE and does something when they get
      // there. Planned at runtime, never at build: a rnd() draw while the world
      // is being constructed would shift every tree height and parked car after
      // it (GOTCHAS §2).
      if (!c.route.length) plan(c);
      let moving = !holding && c.wait <= 0;
      if (c.wait > 0) c.wait -= dt;
      let vx = 0, vz = 0;
      if (moving && c.route.length) {
        // ── walk the current edge ─────────────────────────────────────────
        //
        // The position is kept ON THE EDGE plus a lateral offset, rather than
        // by nudging it sideways each frame. The first cut did the latter and
        // the nudges ACCUMULATED — there was nothing pulling anybody back to
        // the line, so a few seconds of prop avoidance walked people off the
        // kerb and into the roadway. Measuring the offset from the edge makes
        // straying off the walk impossible by construction.
        const ai = c.at >= 0 ? c.at : c.route[0];
        const A = net.nodes[ai];
        const B = net.nodes[c.route[0]];
        let dx = B.x - A.x, dz = B.z - A.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        const rx = -dz, rz = dx;                       // to the right of travel
        // where we are along the edge, and how far off its line
        const t = (c.lane - A.x) * dx + (c.z - A.z) * dz;
        // somebody in the way? Slow, and after a beat pass on YOUR right — a
        // rule both parties apply, so a head-on meeting resolves instead of
        // deadlocking.
        const ahead = citizens.find((q) => q !== c
          && Math.hypot(q.lane - (c.lane + dx * 0.7), q.z - (c.z + dz * 0.7)) < 0.62);
        // `jam` is time spent GETTING NOWHERE, and it used to be time spent
        // with anybody ahead at all — which counted a perfectly good follow at
        // matched pace as a jam. It is now set below, once we know whether this
        // frame actually moved.
        // ── who gives way ─────────────────────────────────────────────────
        //
        // ASYMMETRIC, on purpose. Both-bear-right is symmetric, and a symmetric
        // rule is what makes two walkers in a lane too narrow for two abreast
        // each step aside into the other's new path, every frame, for as long as
        // they are near each other — the back-and-forth in the report.
        //
        // But only a HEAD-ON meeting needs anybody to stand. Treating a walker
        // you have merely caught up with as a conflict was my first cut and it
        // starved the block: everybody spent their time waiting instead of
        // walking, nobody completed a long trip, and the side street emptied.
        // Catching somebody up is a FOLLOW — match their pace and stay behind.
        //
        // And the tie-break alternates by PAIR PARITY rather than always
        // favouring the higher id. Fixed for any given pair, so it cannot
        // oscillate; different across pairs, so no one walker is the one who
        // always gives way (id 0 yielded to all five of the others, which is
        // how the starvation showed up).
        let held = false, follow = 0;
        if (ahead) {
          // SOMEBODY PARKED IS NOT SOMEBODY TO NEGOTIATE WITH. This is the
          // pile-up. Giving way is for two people who both want to move; a
          // citizen standing at a window for twelve seconds, or hesitating in a
          // doorway for eight, is furniture. The old test could not tell them
          // apart — a stopped walker read as `theirs <= 1e-4`, i.e. as a
          // head-on meeting — so one of the pair stood for as long as the other
          // one's errand lasted, and whoever came up behind THEM stood too. Six
          // people and two errands is all it takes.
          //
          // The user's diagnosis is the fix: the walk logic should allow people
          // to walk around things. A parked walker is a thing to walk around,
          // so we neither hold nor follow — we fall through to the offset search
          // below, which is already the "go round it" manoeuvre.
          const parked = ahead.wait > 0;
          const mine = Math.hypot(c.vx, c.vz), theirs = Math.hypot(ahead.vx, ahead.vz);
          const headOn = mine > 1e-4 && theirs > 1e-4
            && (c.vx * ahead.vx + c.vz * ahead.vz) / (mine * theirs) < 0;
          if (parked) {
            // nothing: go round
          } else if (headOn || theirs <= 1e-4) {
            const lowerYields = (c.id + ahead.id) % 2 === 0;
            held = lowerYields ? c.id < ahead.id : c.id > ahead.id;
            // …but not for ever. A yield is meant to last the second it takes
            // the other one to pass. If it has not resolved in JAM_GIVE_UP, the
            // rule has failed for this pair and standing longer will not fix it.
            if (c.jam > JAM_GIVE_UP * 0.5) held = false;
          } else {
            follow = theirs / dt;                     // their speed, to match
          }
        }
        const step = held ? 0 : Math.min(c.sp, follow || c.sp) * dt;
        // try the intended offset first, then wider — prop avoidance and
        // passing are the same manoeuvre. Never wider than the walk allows.
        // STICKY: whatever offset worked last frame is tried first, and a new
        // one is only searched for — and then COMMITTED — when it stops working.
        // Re-deriving the choice from scratch every frame is the other half of
        // the oscillation: the candidate list is ordered, so a walker would
        // snap back to its preferred side the instant that side cleared, which
        // is the moment the other walker had just moved out of it.
        // How wide is what we are walking on? A walk is narrow; a crossing is
        // as wide as its stripes, and the candidates spread to fill it, so
        // people cross abreast in lanes instead of single file through a node.
        const half = net.halfOf(ai, c.route[0]);
        const k = half / STRAY;
        const want = (ahead ? Math.max(0.3, c.bias) : c.bias) * k;
        // A vehicle across the way with no room to pass it: do not advance into
        // it at all. Suppressing the forward search — rather than letting it run
        // and retreating only when it fails — is what stops the walker stepping
        // back into the car the moment its own retreat clears the next 0.3 m.
        // A walker already giving way looks FURTHER ahead before it will call the
        // way clear, so resuming is a decision about the car having gone rather
        // than about a centimetre of geometry. `c.backing` is re-stamped on every
        // walled frame, standing or retreating, so the widened look survives the
        // whole yield and not just the frames with motion in them.
        const walled = vehicleWall(A, dx, dz, rx, rz, t, half, c.pick,
          c.backing > 0 ? BACK_LOOK + BACK_HYST : BACK_LOOK);
        if (walled) c.backing = BACK_HOLD;
        let placed = false;
        for (const off of walled ? [] : [c.pick, want, want + 0.4 * k, want - 0.8 * k, 0,
          want + 0.8 * k, want - 0.4 * k]) {
          const o2 = Math.max(-half, Math.min(half, off));
          const nt = t + step;
          const nx = A.x + dx * nt + rx * o2;
          const nz2 = A.z + dz * nt + rz * o2;
          if (clearAt(nx, nz2) && clearOfPeople(nx, nz2, c)) {
            vx = nx - c.lane; vz = nz2 - c.z;
            c.lane = nx; c.z = nz2;
            c.pick = o2;                              // committed until it fails
            placed = true;
            break;
          }
        }
        // ── GIVING GROUND: the one manoeuvre this loop never had ──────────
        //
        // The user, twice: *"people still get stuck. they should back up and
        // allow the car to pass."* Every candidate above advances by `t + step`
        // — only the lateral offset varies — so a walker whose way is covered by
        // something wider than the lane could stand, or after JAM_GIVE_UP
        // reroute FROM WHERE IT STANDS, and if the obstacle still covers that
        // spot the new route's first step is blocked too. Measured on the
        // shipped world with a taxi parked on the crossing: 10 blocked
        // episodes, 10 of them pinned, longest stand 5.6 s, and **0.00 m of
        // ground given in every one** (scripts/probes/w96-dwell-pin.mjs).
        //
        // The retreat runs BACK ALONG THE ROUTE EDGE, not down a raw heading.
        // That is what keeps it safe: the edge is the crossing the walker
        // stepped onto, so backing up walks it back toward the kerb it came
        // from rather than sideways into the traffic lane. `clearAt` and
        // `clearOfPeople` vet the candidate exactly as they do a forward one,
        // so a retreat can no more end up inside a wall or inside another
        // walker than a step can.
        //
        // ONLY FROM SOMETHING THAT WILL LEAVE — see `movers` above.
        let gaveGround = false;
        // `walled` already suppresses the forward step, so jam climbs from zero
        // the moment the way is blocked and BACK_AFTER is a genuine delay: a
        // walker pauses, and only then gives ground. It does not need `backing`
        // in the condition — that is the look-ahead's latch, not this one.
        if (walled && c.gave < BACK_MAX && c.jam > BACK_AFTER) {
          const bstep = Math.min(c.sp * BACK_RATE * dt, BACK_MAX - c.gave);
          for (const off of [c.pick, 0, c.pick + 0.4 * k, c.pick - 0.4 * k]) {
            const o2 = Math.max(-half, Math.min(half, off));
            const nt = t - bstep;                    // ← BACKWARDS. The whole item.
            const nx = A.x + dx * nt + rx * o2;
            const nz2 = A.z + dz * nt + rz * o2;
            if (clearAt(nx, nz2) && clearOfPeople(nx, nz2, c)) {
              vx = nx - c.lane; vz = nz2 - c.z;
              c.lane = nx; c.z = nz2;
              c.pick = o2;
              c.gave += bstep;
              c.backing = BACK_HOLD;                 // latched: cannot chatter
              gaveGround = placed = true;
              break;
            }
          }
        }
        // ── did this frame actually get anywhere? ─────────────────────────
        //
        // THE ESCAPE HATCH USED TO LIVE INSIDE `!placed`, AND THAT IS WHY
        // PEOPLE STUCK FOR EVER. A held walker sets step = 0, so the very first
        // candidate offset — its own current position — is clear, `placed` goes
        // true, and the re-plan below was never reached. Its jam timer counted
        // up the whole time: the watch that found this measured one walker at
        // 29.8 s of a 60 s minute, standing, with `placed` true every frame.
        //
        // So progress is measured, not inferred from which branch we fell down.
        // An escalation, not a single rule: give way for half a second, then
        // stop giving way and try to go ROUND (the offset search), and only if
        // that is still getting nowhere take a different path entirely. Firing
        // the last two together would reroute a walker on the very frame it
        // first tried to step round somebody, which throws away the cheap fix.
        //
        // RETREATING IS NOT PROGRESS, and forcing that is what keeps the ladder
        // ordered. If giving ground reset the jam timer, a walker would retreat
        // for ever against a car that never leaves instead of escalating to
        // `reroute`; zeroing it bounds this rule's worst case at BACK_MAX metres
        // and JAM_GIVE_UP seconds, after which the walker takes another path
        // exactly as it does today.
        const got = gaveGround ? 0 : Math.hypot(vx, vz);
        if (got < c.sp * dt * 0.35) {
          c.jam += dt;
          if (c.jam > JAM_GIVE_UP) reroute(c);
        } else {
          c.jam = Math.max(0, c.jam - dt * 2);
          c.gave = 0; c.backing = 0;        // walking again: the episode is over
        }
        // ── ARRIVING IS MEASURED ALONG THE EDGE, NOT AS THE CROW FLIES ────
        //
        // THIS WAS MY BUG AND IT IS THE ONE THAT PUT PEOPLE IN THE ROAD.
        // The test used to be `hypot(B - position) < 0.45`. That works only
        // while a walker stays near the edge's centre line, and I then gave
        // crossings 1.3 m of lateral offset so people could cross abreast. A
        // walker committed to a wide lane is NEVER within 0.45 m of the node
        // it is heading for, so it never arrives — it walks straight past B
        // and on along the edge's direction for ever, out into the
        // carriageway and off the end of the block, until a collider stops it
        // dead. That is "these people are stuck": they are not stuck at all,
        // they have overshot and been halted by the first thing they hit.
        //
        // Found by direction, not by guessing: the escapees were travelling
        // (-0.21, -0.96), and the side crossing n-bodega -> s-win1 runs
        // (-0.26, -0.96).
        //
        // Projecting onto the edge makes arrival independent of how far off
        // the line somebody is walking, which is the property the lateral
        // offset needs and the euclidean test never had.
        const tNow = (c.lane - A.x) * dx + (c.z - A.z) * dz;
        if (tNow >= len - 0.45) {
          // COMING OFF A CROSSING, COME BACK TO THE WALK. Arriving by
          // projection means a walker can reach the node while still 1.3 m off
          // the line, which is fine mid-route — the next edge just starts from
          // its own projection — but at a DESTINATION it would stand there,
          // and a crossing's 1.3 m off the line is the middle of the road.
          // So the perpendicular offset is clamped back to a walk's width the
          // moment the node is reached.
          const off = (c.lane - B.x) * rx + (c.z - B.z) * rz;
          const keep = Math.max(-STRAY, Math.min(STRAY, off));
          if (off !== keep) {
            c.lane += (keep - off) * rx;
            c.z += (keep - off) * rz;
            c.pick = keep;
          }
          c.at = c.route.shift()!;
          if (!c.route.length) arrive(c);              // that was the destination
          // …or stop HERE, part way, if this spot is worth stopping at. Waiting
          // only at destinations made stops rare and clustered: a trip across
          // the block takes the best part of a minute, so six people were
          // walking 95% of the time and the errands never showed. Pausing en
          // route is also just what people do — you pass a window and stop at
          // it without that window being where you were going.
          else if (net.nodes[c.at].act && rnd() < 0.35) arrive(c);
        }
      }
      // resolve an illegal position rather than merely refusing to move into
      // one — never leave a walker standing somewhere it should not be
      unstick(c, dt);
      c.vx = vx; c.vz = vz;
      if (c.ghost) {
        c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
      } else {
        c.box.minX = c.lane - 0.25; c.box.maxX = c.lane + 0.25;
        c.box.minZ = c.z - 0.25; c.box.maxZ = c.z + 0.25;
      }
      c.mesh.position.set(c.lane, sidewalkY, c.z);
      c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
      // ── up it goes ────────────────────────────────────────────────────
      //
      // HYSTERESIS, because the rain does not switch — `updateRain` eases
      // `rainLevel` toward its target at dt·0.6, so it CROSSES any single
      // threshold slowly, and six umbrellas flickering on the way in and out of
      // a shower is the one way this can look worse than no umbrellas at all.
      // Raise at UMB_UP, lower only below UMB_DOWN.
      //
      // The value is the world's own published one. `ct/props.ts:2389` writes
      // `rainHeavy = rainLevel · stormNow` for exactly this reason — its comment
      // says re-deriving "how heavy is it right now" from a material's alpha is
      // how an earlier reading came out wrong — so this reads that rather than
      // inventing a second opinion about the weather.
      const rainNow = (scene.userData.rainHeavy as number) ?? 0;
      // …and only for the half who own one (`UMB_SHARE`). Gated HERE rather
      // than at `c.umb.visible`, because `holding` — the raised-arm sheet — is
      // derived from visibility below, and a walker with no umbrella putting a
      // hand up to hold nothing is a worse frame than either end of this item.
      const wantUmb = !c.owns ? 0
        : rainNow > UMB_UP ? 1 : rainNow < UMB_DOWN ? 0 : c.umbOpen;
      c.umbOpen += (wantUmb - c.umbOpen) * Math.min(1, dt * 5);
      c.umb.visible = c.umbOpen > 0.02;
      // ── AND THE HAND GOES UP WITH IT ─────────────────────────────────
      //
      // DERIVED FROM THE UMBRELLA ITSELF, not from a second reading of the
      // weather. `c.umb.visible` IS the umbrella's open-ness, one line above —
      // so the arm cannot drift out of step with the thing it is holding, and
      // there is no second threshold to tune. Rain hysteresis, the storm ramp
      // and the 0.02 floor are all already inside it.
      //
      // A MAP SWAP, not a redraw: both sheets were baked at construction and
      // this only chooses. `needsUpdate` because three caches the material's
      // program against what it was compiled with, and the cost is once per
      // change of weather rather than once per frame.
      if (c.umb.visible !== c.holding) {
        c.holding = c.umb.visible;
        const mat = c.mesh.material as THREE.MeshBasicMaterial;
        mat.map = c.holding ? c.texUp : c.tex;
        mat.needsUpdate = true;
      }
      if (c.umb.visible) {
        // Same position and the SAME billboard rotation as the person, so the
        // two stack as a 2D overlay at every angle — that is the whole reason
        // this can be one dome instead of five painted views.
        // NUDGED TOWARD THE CAMERA, and it is not cosmetic: the shaft runs down
        // through the same space as the torso, and two billboards at the same
        // position are coplanar — which pair draws in front is then undefined
        // and flickers as the camera moves. 6 cm along the view direction puts
        // the umbrella reliably in front of the person holding it.
        const ox = px - c.lane, oz = pz - c.z;
        const oL = Math.hypot(ox, oz) || 1;
        c.umb.position.set(c.lane + (ox / oL) * 0.06,
          sidewalkY + c.figTop + UMB_CLEAR + UMB_HEM_M - UMB_MH / 2,
          c.z + (oz / oL) * 0.06);
        c.umb.rotation.y = c.mesh.rotation.y;
        // opening, not fading: see the material's comment on GOTCHAS 22
        c.umb.scale.set(c.umbOpen, c.umbOpen, 1);
      }
      // Facing follows the ACTUAL direction of travel — it used to be
      // atan2(0, dir), which only knew ±z, and was wrong the moment somebody
      // turned the corner. But the RAW per-frame velocity is not a heading: it
      // carries every lateral correction the avoidance makes, so feeding it
      // straight to the sprite is the third source of twitching. Ease toward it
      // instead, and keep the last heading while standing still so a halted
      // person does not snap round to face +z.
      if (Math.hypot(c.vx, c.vz) > 1e-4) {
        const want = Math.atan2(c.vx, c.vz);
        let d = want - c.head;
        while (d > Math.PI) d -= 2 * Math.PI;         // by the short way round
        while (d < -Math.PI) d += 2 * Math.PI;
        c.head += d * Math.min(1, dt * 7);
      }
      c.dir = c.head;
      const camAng = Math.atan2(px - c.lane, pz - c.z);
      // ── view hysteresis ───────────────────────────────────────────────
      //
      // Rounding the heading to one of 8 sectors switches view at the exact
      // midpoint, so a heading sitting on a boundary flips between two painted
      // columns every frame and the whole person reads as twitching. Hold the
      // current sector until the heading is clearly past the boundary — a fifth
      // of a sector, 9° — so crossing it is a decision rather than a coin flip.
      const sPos = sectorAt(camAng - c.dir);
      if (c.sector < 0) c.sector = Math.round(sPos) % 8;
      let away = sPos - c.sector;
      while (away > 4) away -= 8;
      while (away < -4) away += 8;
      if (Math.abs(away) > 0.7) c.sector = ((Math.round(sPos) % 8) + 8) % 8;
      const [col, mirror] = viewAt(c.sector);
      // ── AND THE UMBRELLA MIRRORS WITH THE PERSON ──────────────────────
      //
      // NEW, AND ONLY BECAUSE THE SHAFT LEANS. A dome is symmetric, so for
      // four of the eight facings this sprite could be drawn either way round
      // and nobody could tell — which is the whole argument for it being one
      // prop instead of five painted views. A leaning shaft is not symmetric:
      // it points at the raised arm, that arm is the +x one on the painted
      // sheet, and `viewAt` mirrors the sheet for the far four sectors. Left
      // alone, half the block would hold an umbrella that leans away into the
      // empty hand.
      //
      // Same repeat/offset flip the citizen sheet takes below, on the
      // umbrella's own texture — each walker was given their own by
      // `umbrellaTex`, so this is not shared state. The canopy's lit flank
      // mirrors with it, which is correct: the person's shading mirrors too,
      // and the two agreeing about the sun is what that comment asked for.
      const umbMap = (c.umb.material as THREE.MeshBasicMaterial).map;
      if (umbMap) {
        umbMap.repeat.x = mirror ? -1 : 1;
        umbMap.offset.x = mirror ? 1 : 0;
      }
      // feet only stride while actually walking; stand still (feet together)
      // when halted, so a stopped person isn't marching in place
      if (moving) c.anim += dt * c.cad;   // per-person cadence, see strideFor
      const row = moving ? Math.floor(c.anim) % 2 : 0;
      // THE LIVE SHEET, not `c.tex`. Since the umbrella swaps the mesh's map
      // between the two bakes, writing the view onto `c.tex` unconditionally
      // would leave whichever sheet is actually on screen frozen on the column
      // and frame it wore when the rain started — a walker who turns a corner
      // under an umbrella and keeps facing the old way.
      const t = c.holding ? c.texUp : c.tex;
      t.repeat.x = mirror ? -1 / 5 : 1 / 5;
      t.offset.x = mirror ? (col + 1) / 5 : col / 5;
      t.offset.y = row === 0 ? 0.5 : 0;
      c.view = { col, mirror, yaw: c.mesh.rotation.y, moving };
    }
  }, ORDER.LATE);

  return {
    atlases: () => citizens.map((c) => (c.tex.image as HTMLCanvasElement).toDataURL()),
    people: () => citizens.map((c) => ({
      sp: c.sp, cad: c.cad, hs: c.mesh.scale.y, ws: c.mesh.scale.x,
      footY: c.mesh.position.y,
    })),
    // `gave` is metres of ground given up to a vehicle in the CURRENT episode,
    // published so a probe can tell "the walker got out of the way" from "the
    // walker happened to drift" — the two look identical in a position trace,
    // and the first cut of w96-dwell-pin.mjs scored a normal crossing as a 3.93 m
    // retreat for exactly that reason.
    walkers: () => citizens.map((c) => ({ x: c.lane, z: c.z, wait: +c.wait.toFixed(2),
    // `umb` is how far this person's umbrella is up, 0 furled … 1 open. Published
    // because there is no weather readout on `__ct` at all and `crosstown.ts` is
    // held by another item, so without this the only way to ask "did the
    // umbrellas go up?" is to look at a picture — and a picture cannot be a
    // regression test.
      doing: c.doing, jam: +c.jam.toFixed(2), ghost: !!c.ghost, gave: +c.gave.toFixed(3),
      // …and WHICH SHEET IS ON THE MESH. `umb` says the canopy is up; this says
      // the person is holding it. They are meant to be the same answer, and a
      // probe that can only see one of them cannot prove that.
      umb: +c.umbOpen.toFixed(2), holding: c.holding })),
    // the DIRECTION OF TRAVEL, not a ±1 axis code: since the crowd routes over
    // a graph, people walk east and west too, and the feet check has to compare
    // the painted toe against an arbitrary heading
    paint: (look) => {
      const t = citizenAtlas(look);
      return (t.image as HTMLCanvasElement).toDataURL();
    },
    netRoute: (fromId, toId) => {
      const a = net.nodes.findIndex((n) => n.id === fromId);
      const b = net.nodes.findIndex((n) => n.id === toId);
      if (a < 0 || b < 0) return null;
      const r = net.route(a, b);
      let len = 0;
      for (let i = 0; i + 1 < r.length; i++) {
        len += Math.hypot(net.nodes[r[i]].x - net.nodes[r[i + 1]].x,
          net.nodes[r[i]].z - net.nodes[r[i + 1]].z);
      }
      // ── THE EDGES, SO AN OUTSIDE TEST CAN READ A ROAD FLAG ─────────────
      //
      // The auditor could not verify the east-end crossing fix and said so
      // rather than passing it: "window.__ct.netRoute exposes no net, nodes or
      // edges, so an outside test cannot read an edge's road flag.
      // Behaviourally nothing is stranded at that end, which is consistent
      // with the fix and not evidence of it — the flag governs lateral
      // allowance, not whether anyone gets stuck." That is exactly right, and
      // it is my affordance that was too thin.
      //
      // Added to the RETURN rather than as a new `__ct` entry on purpose:
      // `crosstown.ts` is DESK-owned and already wires `netRoute` through, so
      // widening what it answers needs no edit to a file that is not mine.
      // `hops` and `len` are untouched, so existing callers are unaffected.
      const step = [];
      for (let i = 0; i + 1 < r.length; i++) {
        const [u, v] = [r[i], r[i + 1]];
        step.push({ from: net.nodes[u].id, to: net.nodes[v].id,
          road: net.isCrossing(u, v),
          half: +net.halfOf(u, v).toFixed(2),
          len: +Math.hypot(net.nodes[u].x - net.nodes[v].x,
            net.nodes[u].z - net.nodes[v].z).toFixed(2) });
      }
      return { hops: r.length, len, edges: step,
        crossings: step.filter((e) => e.road).length };
    },
    views: () => citizens.map((c) => ({
      vx: c.vx, vz: c.vz, col: c.view?.col ?? -1, mirror: !!c.view?.mirror,
      yaw: c.view?.yaw ?? 0, moving: !!c.view?.moving,
      doing: c.wait > 0 ? c.doing : 'walking',
      to: c.route.length ? net.nodes[c.route[c.route.length - 1]].id : '-',
    })),
  };
}
