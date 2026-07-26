import * as THREE from 'three';
import { pixTex, dither , declareSurface} from './paint';

// ═══════════════════════════════ MASONRY DENSITY ═══════════════════════════
//
// ONE density for every wall in the world, and the texels are SQUARE. This is
// `ct/tex-ground.ts`'s pattern applied to the vertical surfaces: the painter is
// told the surface's REAL EXTENT IN METRES and derives its canvas from that,
// instead of each function inventing a canvas size and letting the stretch onto
// the mesh decide what px/m it ended up at.
//
// What it was before (measured from source, not eyeballed — notes/A-density.md):
//   facadeTex     8.00 px/m across  ·  10.94–11.17 up   (varies with FLOOR COUNT)
//   shopfrontTex  8.00 px/m across  ·  12.38 up
//   resGroundTex  8.00 px/m across  ·  10.00 up
//   …and 10.67 across on any building under 8 m, because of a `Math.max(64, …)`
//   clamp. Five different vertical densities, texels 1.38:1 anisotropic, and
//   brick courses landing at 0.404 m / 0.448 m / 0.451 m / 0.457 m depending on
//   which building you were standing in front of. That is the whole of seam
//   pattern #1, and findings 3, 7, 12 and 13 are instances of it.
//
// Two rules make the bond continuous across a party wall:
//
//   1. ONE density. A painter may use an INTEGER MULTIPLE of it when it carries
//      fine content (the shopfront has to render a shop's name), because an
//      integer multiple keeps texels square AND keeps the course grid
//      commensurate — a 0.5 m course is 4 px at 1× and 8 px at 2×, landing on
//      exactly the same world lines either way.
//   2. Courses are phased off WORLD Y, never off the mesh's own top edge. Two
//      neighbours of different heights are otherwise out of phase even at
//      identical density (seam pattern #2).
//
/** texels per metre for masonry, both axes. The world's documented density. */
const WALL_PPM = 8;
/** one brick course in metres — 4 texels at 1×, so it survives mipmapping */
const COURSE_M = 0.5;
/** perp (vertical) joint pitch, and the stagger: half-lap every other course */
const PERP_M = 1.125;
/** storey pitch — the REAL one, the same 2.4 m `ct/street.ts` builds the box
 *  from, so a painted window band sits on an actual floor instead of drifting
 *  (it used to paint 2.53 m storeys onto 2.4 m ones) */
export const FLOOR_M = 2.4;
/** brick skirt between the shopfront band and the lowest window sill */
const SKIRT_M = 2.4;
/** the non-storey part of the upper wall: cornice + parapet + skirt. This and
 *  FLOOR_M must stay EXACTLY in step with the box `ct/street.ts` builds
 *  (`3.4 + floors * 2.4`) or the texture is drawn for a wall of the wrong
 *  height and every metre-derived feature in it is scaled by the error. */
const WALL_BASE_M = 3.4;
export const wallHeight = (floors: number) => WALL_BASE_M + floors * FLOOR_M;
/** default datum: the top of a shop's ground-floor band, which is where all
 *  but one upper wall on the block starts. Pass the real one for the odd
 *  building out (No. 227 sits on ENTRANCE.BAND_H) and its courses line up too. */
const DEFAULT_BASE_Y = 4.2;

/**
 * THE one place a masonry canvas is sized. Hand it the real extent of the
 * surface in metres and it hands back the canvas, the converter, and the
 * course grid — so a painter never sees a px/m at all.
 *
 * This exists because the first version of pattern #1 fixed the three painters
 * in THIS file and left five more in `ct/street.ts` and `ct/civic.ts` deriving
 * their own. Closing 4 of 10 instances made the other 6 *worse*, because their
 * neighbours had been tidied and they had not. The defect was never that a
 * painter computed density badly — it is that any painter computed it at all.
 *
 * `mult` is an INTEGER multiple of WALL_PPM, for surfaces that carry fine
 * content (text, one-texel stone arrises). Integer keeps texels square and the
 * course grid commensurate: a 0.5 m course is 4 px at 1× and 8 px at 2×,
 * landing on the same world lines either way.
 */
export function masonry(wMeters: number, hMeters: number, baseY: number, mult = 1) {
  const ppm = WALL_PPM * mult;
  const W = Math.max(1, Math.round(wMeters * ppm));
  const H = Math.max(1, Math.round(hMeters * ppm));
  return {
    W, H, ppm,
    /** metres → texels on this surface. At least 1, so a thin line survives. */
    m: (v: number) => Math.max(v > 0 ? 1 : 0, Math.round(v * ppm)),
    /** metres → texels as a raw (possibly 0) count, for offsets */
    at: (v: number) => Math.round(v * ppm),
    /** the brick bond, phased off world Y so it crosses a party wall in step */
    courses: (g: CanvasRenderingContext2D) => courses(g, W, H, hMeters, baseY, ppm),
    /**
     * Paint it. The canvas size is not the caller's to choose.
     *
     * The texture is STAMPED with what it is and at what density. The audit's
     * `density.mjs` cannot answer pattern #1 because its filter is geometric —
     * foliage, ground decals and signage all end up in a net meant for masonry,
     * and no amount of shape-guessing separates them. This is the same answer
     * `userData.mod` gave for ownership: the module that knows declares, and
     * the tool outside stops inferring.
     *
     * The DECLARED ppm is the useful half. Pattern #1 says every masonry face
     * is painted at one density; an auditor measuring px/m off the geometry is
     * re-deriving a number this function already knows, and can only ever catch
     * disagreement between its own arithmetic and mine. With this it can read
     * the intent and check the mesh against it, which is the actual assertion.
     */
    paint: (draw: (g: CanvasRenderingContext2D) => void) => {
      const t = pixTex(W, H, draw);
      t.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H };
      // and say what it IS, not only how dense it is — see declareSurface().
      // Everything masonry() paints is brick by definition, so this one is free.
      t.userData.surface = 'brick';
      return t;
    },
  };
}

/** lay horizontal course lines on the WORLD-Y grid across a canvas of `hM`
 *  metres whose bottom edge sits at world `baseY`. Returns nothing; draws. */
function courses(g: CanvasRenderingContext2D, W: number, H: number, hM: number, baseY: number, ppm: number) {
  const perp = Math.max(1, Math.round(PERP_M * ppm));
  // first course line at or above baseY, walked up in world metres so the
  // bond continues onto whatever is built next door
  const k0 = Math.ceil(baseY / COURSE_M);
  for (let k = k0; (k * COURSE_M - baseY) <= hM; k++) {
    const yW = k * COURSE_M - baseY;              // metres up from the canvas bottom
    const y = Math.round(H - yW * ppm);           // canvas y (0 = top)
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, y, W, 1);
    // perps sit between two course lines and half-lap on alternate courses
    const yb = Math.round(H - (yW - COURSE_M) * ppm);
    const off = (k % 2) ? 0 : Math.round(perp / 2);
    for (let x = off; x < W; x += perp) g.fillRect(x, y, 1, yb - y);
  }
}

/**
 * The upper wall: brick, a window band per storey, a cornice at the roofline.
 *
 * `wMeters` × `hMeters` are the REAL dimensions of the face this paints, and
 * every feature below is expressed in metres and converted once. `baseY` is the
 * world height of the wall's bottom edge — the course datum.
 *
 * `minCols` floors the window count: a 2 m canted bay is one window wide, not
 * none and not two. `sill0` is the height of the lowest sill above the face's
 * own foot — the default suits a wall that starts at its shopfront band, and
 * the bodega's corner pier passes its own because that face runs all the way
 * to the ground and still has to line its windows up with the elevation.
 */
/** Where the windows are on a residential facade, and which of them are lit.
 *  ONE authority, because two painters now need it: `facadeTex` cuts the
 *  openings and `facadeLitTex` paints the light coming out of them. If each
 *  computed the grid itself, the light would drift off the holes it is
 *  shining through the first time either one changed. */
function facadeWindows(
  brick: string, floors: number, wMeters = 12,
  hMeters = wallHeight(floors), baseY = DEFAULT_BASE_Y, minCols = 2,
  sill0 = SKIRT_M, variant = 0, pct = 19,
) {
  const surf = masonry(wMeters, hMeters, baseY);
  const { W, H, ppm } = surf;
  const m = (v: number) => Math.round(v * ppm);          // metres → texels
  const WIN_W = 1.5, WIN_H = 1.5, BAY_M = 2.75, SILL_M = 0.2, MARGIN_M = 1.0;
  // Which windows are lit. This used to be `(f * 7 + c * 3) % 5 === 0`, which
  // is a linear congruence in storey and column: every storey up shifts the
  // lit column by a fixed amount, so the lit windows can only ever land on
  // diagonals. The user read it as a pattern before reading it as a bug —
  // "all the lighting on the windows goes up and to the right".
  //
  // A hash with a proper avalanche has no such structure. Seeded per building
  // off its brick, width and height so two neighbours do not light alike.
  // NOTE: deliberately not the shared rnd() stream — drawing from that here
  // would shift every tree height and pigeon downstream (GOTCHAS §2).
  let seed = 0x811c9dc5;
  for (let i = 0; i < brick.length; i++) seed = Math.imul(seed ^ brick.charCodeAt(i), 0x01000193) >>> 0;
  seed = Math.imul(seed ^ Math.round(wMeters * 8), 0x01000193) >>> 0;
  seed = Math.imul(seed ^ Math.round(hMeters * 8), 0x01000193) >>> 0;
  const litAt = (f: number, c: number) => {
    // `variant` picks a DIFFERENT set of rooms off the same grid. Multiplied,
    // not added, so variant 0 mixes in nothing and stays the set this block
    // has always had.
    let h = (seed ^ Math.imul(f + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b)
      ^ Math.imul(variant, 0xc2b2ae35)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) % 100 < pct;
  };
  // window bays: as many as fit at BAY_M pitch inside a margin each end.
  //
  // FENCEPOST, and it was in the world for months because it looked like a
  // style rather than a bug. `n` windows at BAY_M pitch span
  // `(n-1) * BAY_M + WIN_W` — the last bay's trailing gap is not part of the
  // run. Counting whole BAYS instead:
  //
  //   · dropped a window that fits, on NINE of the block's nineteen fronts
  //   · centred the run on `cols * BAY_M`, which is 1.25 m longer than the
  //     run really is, so EVERY facade sat 0.625 m left of centre and the
  //     right-hand end carried exactly BAY_M - WIN_W more blank brick
  //
  // Uniform across the block, which is why nobody read it as wrong; but on
  // THRIFT (12.5 m, three windows) it left 2.13 m of brick at one end and
  // 3.38 m at the other, and the user read that as the facade being "chopped
  // off at points". A composition that terminates in the middle of nothing is
  // what that phrase describes.
  const spanOf = (n: number) => (n - 1) * BAY_M + WIN_W;
  let cols = Math.max(minCols, Math.floor((wMeters - 2 * MARGIN_M - WIN_W) / BAY_M) + 1);
  // …but never more than the wall can hold. `minCols` asks for two windows on
  // a narrow front so it does not read as a blind wall — on the 1.4 m returns
  // and slivers that also come through here it was laying them at negative x
  // and drawing them straight off the edge of the canvas. A window cut by the
  // end of the wall is the same complaint as a sign cut by a door, and it is
  // the honest fix to admit a 1.4 m pier has no window on it.
  const EDGE_M = 0.3;
  while (cols > 0 && spanOf(cols) > wMeters - 2 * EDGE_M) cols--;
  const runM = spanOf(cols);                           // what the windows ACTUALLY span
  const slack = (wMeters - 2 * MARGIN_M - runM) / 2;
  // f and c travel with each cell. They cost nothing here and they are the only
  // way anything outside can ask "are the lit windows a LATTICE again?" — the
  // user's original report was diagonal stripes, and a lattice is a property of
  // (floor, column), not of pixels. Recovering them from a painted canvas means
  // re-deriving the layout this function already is the authority for.
  const cells: { x: number; y: number; lit: boolean; f: number; c: number }[] = [];
  for (let f = 0; f < floors; f++) {
    // storey f counted from the BOTTOM, so a 4- and a 5-storey neighbour
    // share every window band they both have (seam finding 7)
    const sill = sill0 + f * FLOOR_M;                   // metres above the wall's foot
    const y = Math.round(H - (sill + WIN_H) * ppm);     // canvas y of the window head
    for (let c = 0; c < cols; c++) {
      cells.push({ x: m(MARGIN_M + slack + c * BAY_M), y, lit: litAt(f, c), f, c });
    }
  }
  // The run's own extents, published rather than left to be re-derived. The
  // fencepost above survived because the only way to ask "is this composition
  // centred?" was to re-do the arithmetic that was wrong — so the painter says
  // where its windows START and END, and scripts/facade-run.mjs checks the
  // brick left over at each end is the same. See A-density-stamp.md: whoever
  // knows, says.
  const runX0 = cols ? m(MARGIN_M + slack) : 0;
  const runX1 = cols ? m(MARGIN_M + slack + (cols - 1) * BAY_M) + m(WIN_W) : W;
  return {
    surf, W, H, m, cells, cols, runX0, runX1,
    winW: m(WIN_W), winH: m(WIN_H), sillT: m(SILL_M),
  };
}

export function facadeTex(
  brick: string, floors: number, wMeters = 12,
  hMeters = wallHeight(floors), baseY = DEFAULT_BASE_Y, minCols = 2,
  sill0 = SKIRT_M,
): THREE.Texture {
  const { surf, W, H, m, cells, cols, runX0, runX1, winW, winH, sillT } =
    facadeWindows(brick, floors, wMeters, hMeters, baseY, minCols, sill0);
  const CORNICE_M = 0.5, CORNICE_SHADE_M = 0.2;
  const tex = surf.paint((g) => {
    g.fillStyle = brick;
    g.fillRect(0, 0, W, H);
    surf.courses(g);
    g.fillStyle = '#8a7a62';
    g.fillRect(0, 0, W, m(CORNICE_M));
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, m(CORNICE_M), W, m(CORNICE_SHADE_M));
    // Every window is painted DARK, with no exceptions. The light that used to
    // be baked in here is `facadeLitTex`, on its own sheet, so that at four in
    // the afternoon the block is not still lit up for a party.
    for (const { x, y } of cells) {
      g.fillStyle = '#1a1c22';
      g.fillRect(x - 1, y - 1, winW + 2, winH + 2);
      g.fillStyle = '#2e3a46';
      g.fillRect(x, y, winW, winH);
      g.fillStyle = '#48586a';
      g.fillRect(x + Math.round(winW / 2) - 1, y, Math.max(1, m(0.35)), winH);
      g.fillStyle = '#9a8a72';
      g.fillRect(x - 1, y + winH + 1, winW + 2, sillT);
    }
    // grime streaks and grain, both per SQUARE METRE — they used to be a flat
    // count per canvas, so a 6 m shop got the same 500 specks as an 18 m block
    g.fillStyle = 'rgba(0,0,0,0.16)';
    const streaks = Math.max(2, Math.round(wMeters * 0.42));
    for (let k = 0; k < streaks; k++) {
      g.fillRect(Math.floor(Math.random() * W), 0, 2, Math.floor(H * Math.random()));
    }
    dither(g, W, H, Math.round(wMeters * hMeters * 3.2));
  });
  // The DARK sheet publishes its run too, not only the lit one. The narrow
  // returns and piers never get a lit sheet, and they are exactly the walls
  // where the run can fall off the end — so stamping only the lit half would
  // leave scripts/facade-run.mjs blind to the case it most needs to see.
  // No `lit` key at all, rather than an empty one: this sheet has no lit
  // information by construction, and handing window-lattice an empty array
  // would put 24 unjudgeable sheets into its "too small to judge" count and
  // make its own coverage line lie.
  tex.userData.windows = { floors, cols, runX0, runX1, W };
  return tex;
}

/** The light in the windows `facadeTex` just cut, on its own TRANSPARENT sheet
 *  so it can be faded up and down instead of being baked on at noon. Same
 *  Takes the same brick/floors/width as `facadeTex` and lines up with it texel
 *  for texel. `variant` picks a different set of rooms off the same grid and
 *  `pct` how many of them — one sheet per time of day, cross-faded.
 *
 *  Nothing but the glass is drawn: no brick, no cornice, no sill. A window
 *  that is not lit contributes no pixels at all, which is what lets the whole
 *  sheet be faded out to nothing at midday and leave the dark facade behind. */
export function facadeLitTex(
  brick: string, floors: number, wMeters = 12,
  o: { variant?: number; pct?: number } = {},
): THREE.Texture {
  const { surf, m, cells, winW, winH, cols, runX0, runX1, W } = facadeWindows(
    brick, floors, wMeters, wallHeight(floors), DEFAULT_BASE_Y, 2, SKIRT_M,
    o.variant ?? 0, o.pct ?? 19,
  );
  // Publish the lit GRID, not just the pixels. The user reported lit windows
  // forming diagonal stripes, because the choice was `(f*7 + c*3) % 5 === 0` —
  // a linear congruence, which is a lattice and not a scatter. It is fixed, and
  // nothing would notice if it came back: from outside, lit windows are bright
  // rectangles in a canvas and the (floor, column) structure is invisible.
  // scripts/window-lattice.mjs is the consumer.
  const litGrid = cells.filter((k) => k.lit).map((k) => [k.f, k.c]);
  const litTex = surf.paint((g) => {
    for (const { x, y, lit } of cells) {
      if (!lit) continue;
      g.fillStyle = '#c9a45e';
      g.fillRect(x, y, winW, winH);
      g.fillStyle = '#8a6a3a';                          // the room falls off toward the cill
      g.fillRect(x, y + winH - m(0.6), winW, m(0.6));
    }
  });
  // `cols` comes from the layout, not from `Math.max` over the cells: a wall
  // too narrow for a window has no cells at all, and Math.max of nothing is
  // -Infinity.
  litTex.userData.windows = { floors, cols, lit: litGrid, runX0, runX1, W };
  return litTex;
}

/** the shop ground-floor band, in metres. TALLER than the residential one
 *  (ENTRANCE.BAND_H): a commercial ground floor genuinely is, and when they
 *  shared 3.2 m the glazing came out 1.92 m — shorter than a doorway, which
 *  is what made every shop on the block read undersized. */
export const SHOP_BAND_H = 4.2;

/** How far a shopfront's RELIEF stands proud of its facade at WALKING height,
 *  in metres — the number a collider has to reserve and not one centimetre
 *  more.
 *
 *  The pieces are `JAMB` 0.12, `CILL` 0.11 and `PLINTH` 0.09; the deepest is
 *  the jamb. `CORNICE` 0.20 and `BED` 0.13 are deeper but they sit up at the
 *  fascia, three-and-a-half metres up, where nobody walks.
 *
 *  It exists because `ct/street.ts` was reserving a flat 0.30 m in front of
 *  every facade on the block for "projecting doorcases and stallrisers" —
 *  written before the relief was built, and 0.18 m more than the relief
 *  actually needs. `notes/lane-audit.md` measured what that cost: the sacred
 *  2 m walking lane was 1.70 m everywhere, permanently, against collision
 *  that corresponded to no geometry. */
export const WALK_PROJECTION = 0.12;

/** Ground-floor bands run at 2× masonry density: they are the surfaces that
 *  have to render TEXT and one-texel stone arrises, and a shop's name at
 *  0.65 m of letter height is 5 texels at 1× — unreadable. An integer multiple
 *  keeps the texels square and keeps the course grid commensurate, so the
 *  brick either side of the fascia still lands on the same world lines as the
 *  wall above. Exported so `ct/street.ts`'s corner bay uses the same one. */
export const SHOP_MULT = 2;

/**
 * WHERE THE SHOPFRONT ACTUALLY IS — the published geometry of a frontage.
 *
 * The interiors were hand-typing offsets beside the painter's own numbers
 * (`ct/int-burger.ts` `at: -3.6`, `ct/int-diner.ts` `at: -2.6`) and nothing
 * connected them, so of course they disagreed and the auditor measured it
 * twice. That is the masonry-density pattern again: the defect is not that
 * something computes the position badly, it is that TWO things compute it.
 *
 * So this is the one authority. `frontageOf()` returns the layout in metres;
 * the painters below convert it to texels to draw, and the interiors read the
 * same object to place a door. Neither restates the other. If a door moves, it
 * moves here and both ends follow.
 *
 * Distances run along the frontage from its LEFT edge as the painter's canvas
 * sees it (u = 0), which is the same direction `wMeters` measures. Heights run
 * up from the pavement. `doorOffsetM` is the same fact expressed the way the
 * int-*.ts rooms already write it: signed metres from the frontage CENTRE,
 * negative to the left. Use whichever suits; they cannot disagree.
 */
/**
 * Where a frontage sits in the world. `uDir` is the ONE piece of handedness in
 * the system, and it is measured off the mesh rather than assumed: a west
 * facade's canvas u runs along -z, an east facade's along +z, a side-street
 * one along -x. That is not a quirk. A room and its facade are the two faces
 * of one wall, so their handedness is opposite by construction.
 */
export interface Placement {
  /** the world axis the frontage runs along */
  axis: 'x' | 'z';
  /** its extent on that axis */
  loWorld: number; hiWorld: number;
  /** the facade plane on the OTHER axis, and which way is outdoors */
  facePos: number; outward: 1 | -1;
  /** which world direction canvas u increases in, along `axis` */
  uDir: 1 | -1;
}

/**
 * The frontage in CANVAS space — metres from u = 0, the painters' own terms.
 *
 * DEPRECATED outside this file, and the migration it was waiting on is DONE.
 *
 * The positional fields are LOCAL OFFSETS, and local offsets are exactly what
 * let the tax office's interior door and its facade door disagree: each side
 * authored its own number in its own space and the mirror between them
 * travelled as an assumption. `frontageWorld()` is the replacement.
 *
 * This used to say the fields stay "so that migrating `ct/interior.ts` is a
 * choice F makes rather than a build I broke — see BLOCKED-A.md", and that
 * pointer had gone dead: `BLOCKED-A.md` was deleted when the block cleared
 * (`notes/A-relief.md`) and nothing replaced the sentence, so the stated reason
 * for keeping a deprecated shape survived the reason itself. A citation to a
 * file that is not there is worse than no citation — the reader cannot tell
 * whether the constraint still holds or merely outlived its note.
 *
 * It does not hold. `ct/interior.ts` imports `frontageOf`, `frontageWorld` and
 * `alongU` and nothing else; NO module outside this file imports `Frontage`,
 * so the positional fields have no external consumer left. Verify in one line
 * before trusting that:
 *
 *     grep -rn "import {[^}]*Frontage[^W]" src/proto/
 *
 * The interface stays because `Layout` extends it and `frontageOf` returns
 * that — it is this file's own shape now, not a compatibility shim.
 */
export interface Frontage {
  /** full width of the shopfront, metres */
  frontageM: number;
  doorWidthM: number;
  /** stallriser height above the pavement, metres */
  stallriserH: number;
  /** fascia band height, metres */
  fasciaH: number;
  /** underside of the fascia, metres above the pavement */
  fasciaBottomM: number;
  /** the glazing's vertical extent, metres above the pavement. glazingBottomM
   *  is the window sill height — the `sill:` the int-*.ts rooms hand-type. */
  glazingBottomM: number;
  glazingTopM: number;
}

/**
 * What `layoutOf` works in: the painter's own local metres along the frontage.
 *
 * These four used to be ON `Frontage`, marked `@deprecated`, and read by
 * `ct/interior.ts` — which is how the same fact came to be authored twice and
 * how the mirror ended up applied twice on the DINER. They are internal now:
 * the painter needs local metres to lay a canvas out, and nothing outside this
 * file has any business with them. Outside, a position is a WORLD coordinate
 * (`frontageWorld`) converted with `alongU`, and there is no second way to do
 * it.
 */
interface Layout extends Frontage {
  doorCentreM: number;
  doorOffsetM: number;
  glazingStartM: number;
  glazingEndM: number;
}

/** the per-character band geometry, in metres. One row per painter below.
 *
 *  RESIZED. The complaint was that every shop on the block read undersized:
 *  1.92 m of glass, shorter than the doorway beside it. The band went to 4.2 m
 *  for it and the glass only reached 2.03, because the stallriser underneath
 *  was eating 0.58 m — over half a metre of painted board under every window.
 *
 *  The item asked for three numbers that cannot all be true at once: a 0.90 m
 *  fascia, a 0.35 m stallriser and 2.70 m of glass need 4.64 m of a band the
 *  same item fixes at 4.20. Something had to give, and the user's own words
 *  were "about 4.2 m" for the band, so the band is what I kept. The glass is
 *  bought instead out of the two gaps nobody asked to be that wide: the brick
 *  margin above the fascia and the shadow gap under it.
 *
 *      default, before   0.16 margin  0.90 fascia  0.26 gap  ->  2.03 glass
 *      default, after    0.10         0.90         0.18      ->  2.40 glass
 *
 *  `sg` is now `gi + 0.35` on every row, which is the item's stallriser held
 *  exactly — and it SHOULD be uniform. A stallriser is a standard height off
 *  the pavement; it is the fascia that varies by character, and it still does.
 *
 *      glass, after:  tax 2.48   pawn 2.38   default 2.40
 *                     thrift 2.37   diner 2.32   burger 2.28
 *
 *  All six clear 2.25 m, against 1.92 when the user complained — a quarter
 *  taller, and every one of them now taller than the door it stands beside. */
const BANDS = {
  //            fascia y/h   opening inset  opening top gap  glazing inset  sill gap  door w
  default: { fy: 0.10, fh: 0.90, ox: 0.40, og: 0.18, gi: 0.22, sg: 0.57, dw: 1.05 },
  burger:  { fy: 0.09, fh: 1.05, ox: 0.40, og: 0.16, gi: 0.22, sg: 0.57, dw: 1.15 },
  tax:     { fy: 0.12, fh: 0.78, ox: 0.40, og: 0.20, gi: 0.22, sg: 0.57, dw: 1.10 },
  diner:   { fy: 0.10, fh: 1.00, ox: 0.35, og: 0.18, gi: 0.20, sg: 0.55, dw: 1.05 },
  thrift:  { fy: 0.11, fh: 0.92, ox: 0.35, og: 0.20, gi: 0.20, sg: 0.55, dw: 1.05 },
  pawn:    { fy: 0.10, fh: 0.92, ox: 0.40, og: 0.18, gi: 0.22, sg: 0.57, dw: 1.05 },
} as const;
type Character = keyof typeof BANDS;

/** which character a named shop wears — the same dispatch shopfrontTex uses */
function characterOf(name: string): Character {
  if (name === 'DINER') return 'diner';
  if (name === 'THRIFT') return 'thrift';
  if (name === 'BURGER BARN') return 'burger';
  if (name.startsWith('A-1 TAX')) return 'tax';
  if (name === 'PAWN') return 'pawn';
  return 'default';
}

/** the diner's stainless, hoisted out of `dinerFront` because the MOULDINGS
 *  need the same value and two copies is how they drifted apart. */
const DINER_STEEL = '#9aa0a4';

/** the gap between the diner's glass-block panel and its glazing — a real
 *  pier, wide enough to read as one at 16 px/m. `layoutOf` sets the glazing
 *  span from it and `dinerFront` paints the block against the same number, so
 *  there is no second place that decides where the block ends. */
const DINER_PIER = 0.25;

/**
 * WHAT COLOUR THIS SHOP'S JOINERY IS — the projecting cornice, bed mould and
 * cill that `shopfrontRelief` stands off the wall.
 *
 * `ct/street.ts` passes the ROSTER colour, and for four of the six characters
 * that is also the colour their painter puts on the fascia, so the mouldings
 * belong to the band they frame. `dinerFront` is the exception: it never
 * receives `awning` at all and paints stainless from a constant, so the diner
 * wore a mustard-brown cornice and cill around a steel front — measured at a
 * 170° hue gap where five of the seven fronts measure 0-1°
 * (`scripts/A-diner-relief-palette.mjs`, and `notes/A-diner-facade-look.md`
 * has the table). It is the single most visible thing wrong with the front the
 * user keeps coming back to.
 *
 * The fix is not to pass a different colour in from `ct/street.ts`. It is the
 * same argument as the frontage descriptor one file over: **the painter is
 * the thing that knows what its fascia is made of**, so it publishes that, and
 * nobody outside gets to guess. That also keeps this repair inside the file
 * that owns shopfronts rather than spending the cross-file mandate on it.
 *
 * `null` means "the roster colour is right for this one" — which is the
 * answer for every character except the diner, and saying so explicitly is
 * what stops the next painter inheriting the accident silently.
 *
 * A-1 TAX reads as a mismatch on the same measurement (175°) and is
 * DELIBERATELY left alone. Its navy is the shop's identity colour and its
 * cream band is a cloth banner hung on the brick, not a fascia — navy joinery
 * under a cloth banner is coherent, nobody has complained about it, and
 * GOTCHAS 23 is explicit that a defect being real is not the same as it
 * mattering. Recorded rather than churned.
 */
function joineryOf(name: string, rosterTrim: string): string {
  return characterOf(name) === 'diner' ? DINER_STEEL : rosterTrim;
}

/**
 * Where the door sits along the glazed span, 0…1, DETERMINISTIC per building.
 * Only the block default varies; the five characters place their door by
 * design (the diner's is at the far end past the glass block, the thrift's is
 * hard left, the tax office's is three-quarters along). The default hashes off
 * the shop NAME, so it is stable across reloads and across both consumers —
 * which it already was, and this is the same hash, moved not changed.
 */
function doorFrac(name: string): number {
  let sd = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) sd = Math.imul(sd ^ name.charCodeAt(i), 0x01000193) >>> 0;
  sd = Math.imul(sd ^ 0x9e3779b1, 0x01000193) >>> 0;
  return 0.18 + ((sd >>> 8) % 5) * 0.16;
}

/** THE published geometry of a shopfront. Painters draw from it; rooms read it. */
/** the painter's OWN layout, before any room has spoken. Private: the only
 *  caller that wants it is registerFrontage(), building the fallback. */
function layoutOf(name: string, wMeters: number): Layout {
  const k = characterOf(name);
  const B = BANDS[k];
  const ow = wMeters - 2 * B.ox;                       // the opening cut in the brick
  let glazingStartM = B.ox + B.gi;
  let glazingEndM = glazingStartM + (ow - 2 * B.gi);
  // The diner spends one end on a glass-block panel, so its glazing — and
  // therefore its door — starts past it.
  //
  // WHICH end is decided by where the ROOM put the door, not by a constant.
  // It used to be always the low-u end, chosen back when this painter also
  // chose the door and put it at the far end. The room now declares the door
  // at the OTHER end, and nothing re-derived the block against it: measured,
  // the door's left 0.44 m hung over the block, and the two abutted with a
  // 0.06 m gap, so the left 3.1 m of the front read as one pale slab with a
  // scratch in it. `notes/A-diner-facade-look.md` has the colour runs.
  //
  // That is GOTCHAS 33's shape exactly — a thing with a side was placed by
  // copying, and nothing recomputed which way it should face when its
  // neighbour moved. So derive it, and it keeps working if the room moves
  // again.
  if (k === 'diner') {
    const bw = Math.min(2.2, ow * 0.22);
    // Undeclared keeps the old geometry EXACTLY: this is also the fallback a
    // shop with no room behind it gets, and it should not move because the
    // diner happens to have one.
    const declared = declaredAlongU(name, wMeters);
    const blockLow = declared === null ? true : declared > wMeters / 2;
    if (blockLow) {
      glazingStartM = B.ox + 0.2 + bw + DINER_PIER;
      glazingEndM = B.ox + ow - 0.2;
    } else {
      glazingStartM = B.ox + 0.2;
      glazingEndM = B.ox + ow - 0.2 - bw - DINER_PIER;
    }
  }
  const gw = glazingEndM - glazingStartM;
  const dw = B.dw;
  // door LEFT edge along the glazing, by character
  const dx =
    k === 'burger' ? glazingStartM + gw * 0.5 - dw / 2 :
    k === 'tax' ? glazingStartM + gw * 0.72 :
    k === 'diner' ? glazingEndM - dw - 0.15 :
    k === 'thrift' ? glazingStartM + 0.2 :
    k === 'pawn' ? glazingEndM - dw - 0.2 :
    glazingStartM + (gw - dw) * doorFrac(name);
  const doorCentreM = dx + dw / 2;
  // the band runs SHOP_BAND_H tall; the stallriser is what is left under the
  // glazing once the fascia, the opening's head gap and the sill gap are taken
  const oy = B.fy + B.fh + B.og;                       // metres down to the opening
  const gh = (SHOP_BAND_H - oy - 0.05) - B.sg;         // glazing height
  const stallriserH = SHOP_BAND_H - (oy + B.gi + gh) - 0.05;
  return {
    frontageM: wMeters,
    doorCentreM,
    doorOffsetM: doorCentreM - wMeters / 2,
    doorWidthM: dw,
    glazingStartM,
    glazingEndM,
    stallriserH,
    fasciaH: B.fh,
    fasciaBottomM: SHOP_BAND_H - B.fy - B.fh,
    glazingBottomM: stallriserH + 0.05,
    glazingTopM: SHOP_BAND_H - oy - B.gi,
  };
}

// ═════════════════ WHERE A SHOPFRONT IS, IN THE WORLD ══════════════════════
//
// Standing inside the tax office the door is on your right; step out, turn
// round, and it must be on the left of the facade. A room and its facade are
// the two faces of ONE WALL, so their handedness is opposite by construction —
// and nothing knew that, because each side authored its own offset in its own
// local space and the mirror between them was carried around as an assumption.
//
// So positions are published in WORLD COORDINATES on the axis the roster lays
// buildings out along: world z for a main-block shop, world x for a side-street
// one. Then the painter converts world → texel column, a room converts world →
// its own local space applying whatever mirror its facing implies, and an [E]
// spot uses the number as it stands. Three consumers, one number, the mirror
// happening once inside each rather than travelling between them. A room later
// flipped to face the other way keeps working, which left/right bookkeeping
// never gives you.

/**
 * The frontage as its consumers should see it: the painter's layout, with the
 * door moved to wherever the ROOM put it.
 *
 * This distinction is not academic. Once a room declares, `layoutOf().
 * doorCentreM` is no longer where the door IS — it is where the painter would
 * have put one had nobody told it otherwise. A consumer reading that and
 * believing it is the door is the same two-places-disagree bug this whole
 * mechanism exists to end, reintroduced through a stale field. So the public
 * function answers the question people actually ask.
 *
 * Safe to call once the street has built; before that there is no placement to
 * resolve a world coordinate against and it returns the plain layout, which is
 * what registerFrontage() wants anyway.
 */
export function frontageOf(name: string, wMeters: number): Layout {
  const L = layoutOf(name, wMeters);
  const along = declaredAlongU(name, wMeters);
  if (along === null) return L;
  return { ...L, doorCentreM: along, doorOffsetM: along - wMeters / 2 };
}

export interface FrontageWorld extends Placement {
  frontageM: number;
  /** DOOR CENTRE IN WORLD COORDINATES on `axis`. Not an offset, not a side. */
  doorWorld: number;
  doorWidthM: number;
  /** the glazed span in world coordinates, lo <= hi whatever uDir is */
  glazingLoWorld: number;
  glazingHiWorld: number;
  /**
   * Did a ROOM tell us where its door is, or did the painter fall back to its
   * own layout?
   *
   * The fallback is correct behaviour — most shopfronts have no room behind
   * them and nothing to ask. It is also SILENT, and that is the problem: when a
   * room exists but its declaration never arrives, the facade gets a door
   * wherever the painter would have put it while the room has one somewhere
   * else, which is the user's original complaint. GOLDEN ACES is in exactly
   * that state today — ct/int-casino.ts is in an import cycle with ct/doors.ts,
   * so its DOOR is skipped (scripts/doors-declared.mjs).
   *
   * Nothing could see the difference from outside. Now it can.
   */
  doorDeclared: boolean;
  stallriserH: number;
  fasciaH: number;
  fasciaBottomM: number;
  glazingBottomM: number;
  glazingTopM: number;
}

// ── WHO DECIDES WHERE THE DOOR IS ──────────────────────────────────────────
//
// The ROOM does. Not this file.
//
// This was the wrong way round first time and it produced the thing the user
// objected to: the facade was made the authority, so the tax office's ROOM got
// swapped to match the painting. What they asked for, twice, was "make the
// exteriors match the interiors".
//
// It is also right on the merits, which is worth writing down so nobody flips
// it back. A room is hand-built furniture — a counter, a desk, a walking route
// — all of which depend on where the door is. A facade door is one x position
// in a texture. When two things must agree, move the cheap one.
//
// So: `ct/int-*.ts` calls declareDoorWorld() at MODULE scope. interior.ts glob-
// imports the rooms eagerly and crosstown.ts imports interior.ts, so every
// declaration is in before buildStreet runs and the painter can read it while
// it paints. The register below holds the placement; the map above it holds
// what the rooms said.
const DECLARED = new Map<string, number>();

/**
 * A room states where ITS door is, in WORLD coordinates on the frontage's
 * axis — world z for a main-block shop, world x for a side-street one.
 *
 * Call it at module scope. The facade will be painted with its door here, and
 * the [E] spot put here, whatever either of them would have chosen alone.
 */
export function declareDoorWorld(name: string, doorWorld: number): void {
  DECLARED.set(name, doorWorld);
}

const FRONTAGES = new Map<string, FrontageWorld>();

/** the door the ROOM asked for, as canvas metres from u = 0, or null if the
 *  room has not spoken (or the frontage is not placed yet). Clamped onto the
 *  frontage so a bad number cannot paint a door into the neighbour. */
function declaredAlongU(name: string, wMeters: number): number | null {
  const d = DECLARED.get(name); const p = FRONTAGES.get(name);
  if (d === undefined || !p) return null;
  const along = p.uDir > 0 ? d - p.loWorld : p.hiWorld - d;
  return Math.min(Math.max(along, 0.9), wMeters - 0.9);
}

/** canvas metres from u = 0 → a world coordinate on the frontage axis */
const toWorld = (p: Placement, alongU: number) =>
  p.uDir > 0 ? p.loWorld + alongU : p.hiWorld - alongU;

export function registerFrontage(name: string, wMeters: number, p: Placement): FrontageWorld {
  // THE PLACEMENT GOES IN FIRST, and the order is load-bearing. `layoutOf`
  // now asks `declaredAlongU` which end the diner's glass block belongs on,
  // and that cannot resolve a world coordinate without a placement to resolve
  // it against. Built before this line, the diner's layout silently takes the
  // undeclared fallback — which is the old, wrong side — while the painter,
  // running later with the placement in hand, takes the right one. Two
  // answers, no error, and the published glazing span would describe a front
  // nobody paints.
  FRONTAGES.set(name, { ...p, frontageM: wMeters } as FrontageWorld);   // so declaredAlongU can resolve
  const L = layoutOf(name, wMeters);
  const a = toWorld(p, L.glazingStartM), b = toWorld(p, L.glazingEndM);
  // the room's number wins; the painter's own layout is only the fallback for
  // a shop that has no room behind it
  const along = declaredAlongU(name, wMeters);
  const f: FrontageWorld = {
    ...p,
    frontageM: wMeters,
    doorWorld: along === null ? toWorld(p, L.doorCentreM) : toWorld(p, along),
    doorDeclared: along !== null,
    doorWidthM: L.doorWidthM,
    glazingLoWorld: Math.min(a, b),
    glazingHiWorld: Math.max(a, b),
    stallriserH: L.stallriserH,
    fasciaH: L.fasciaH,
    fasciaBottomM: L.fasciaBottomM,
    glazingBottomM: L.glazingBottomM,
    glazingTopM: L.glazingTopM,
  };
  FRONTAGES.set(name, f);
  // test affordance, same spirit as crosstown.ts's `scene: () => scene`: this
  // is the shared contract three consumers depend on, so it has to be readable
  // from outside to be checkable at all.
  // Published WITH the name. The array was the values alone, so a tool could
  // see that seven frontages disagreed about handedness and could not say which
  // seven — and an unnamed finding is one nobody picks up. The map is keyed by
  // name; carrying it costs nothing and it is the only thing here a reader
  // cannot derive.
  (globalThis as Record<string, unknown>).__frontages =
    [...FRONTAGES.entries()].map(([name, f]) => ({ name, ...f }));
  return f;
}

/** THE shared answer to "where is this shop's door?" — the room's number when
 *  a room has given one. Null before the street has built. */
export function frontageWorld(name: string): FrontageWorld | null {
  const f = FRONTAGES.get(name);
  return f && f.doorWorld !== undefined ? f : null;
}

/** the door's canvas position for a painter: what the ROOM said, else the
 *  painter's own layout. This is the single line that flips the authority. */
export function doorAlongU(name: string, wMeters: number, fallbackM: number): number {
  return declaredAlongU(name, wMeters) ?? fallbackM;
}

/** world coordinate on the frontage axis → 0..1 across the canvas. The mirror,
 *  applied once, here, for anything that needs to draw ON the facade. */
/**
 * A world coordinate on this frontage → METRES along u from the painter's
 * u = 0 edge. The exact inverse of the private `toWorld`.
 *
 * This is where handedness lives, and it is the reason it exists here rather
 * than at each call site. `uDir` is MEASURED off the mesh uv; `fr.side` in
 * ct/interior.ts is assumed from which side of the street a building sits on,
 * and for the DINER those two disagree. A consumer that converts with `side`
 * applies the mirror twice — measured: it replaces the diner's window with a
 * solid panel. Anyone converting a world coordinate on a frontage should call
 * this and not roll their own.
 *
 * `uAt` below is this over the frontage width, for anyone who wants 0..1. It
 * was the only exported form for a long time and had ZERO consumers, because
 * the one caller that wanted it needed metres and hand-rolled them instead —
 * which is how the mirror got applied twice in the first place.
 */
export function alongU(f: FrontageWorld, world: number): number {
  return f.uDir > 0 ? world - f.loWorld : f.hiWorld - world;
}

export function uAt(f: FrontageWorld, world: number): number {
  return alongU(f, world) / f.frontageM;
}

/**
 * THE ROOM BEHIND THE GLASS.
 *
 * The bodega's doorway is a real hole — `ct/street.ts` gives the bay front
 * `alphaTest: 0.5` and punches the opening out of the texture, which is the
 * right call and makes the door read as a way in rather than a painted panel.
 * Measured: 861 of that panel's 3015 texels are discarded. But the bay is a
 * PLANE with nothing behind it, and the sidewalk is one surface that runs from
 * the kerb straight on under the buildings — so through the hole you see
 * pavement, and the shop has a pavement for a floor.
 *
 * The fix is not to close the hole again. It is to put a room behind it.
 *
 * Dark, but never black: a black rectangle is the "glass is a black hole"
 * complaint that the depth work was fixing. What sells a room at a glance is
 * three horizontal facts — a lit ceiling, something at counter height, a floor
 * in shadow — and a back wall to stop the eye. This is a painted suggestion,
 * not builder F's real interiors; a shop window has never needed more.
 */
export function shopInteriorTex(name: string, wMeters: number, hMeters: number): THREE.Texture {
  const surf = masonry(wMeters, hMeters, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  // varied off the name so fifteen backings are not one backing fifteen times
  let sd = 0x9e3779b1;
  for (let i = 0; i < name.length; i++) sd = Math.imul(sd ^ name.charCodeAt(i), 0x01000193) >>> 0;
  const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
  const BACK = '#2f2822', CEIL = '#6d5a3e', COUNTER = '#4a3f33', FLOOR = '#1d1916';
  const STOCK = ['#4a4034', '#3d4450', '#54413a', '#3f4a3a', '#4a3a48'];
  return surf.paint((g) => {
    g.fillStyle = BACK; g.fillRect(0, 0, W, H);
    // ceiling: the only bright thing in here, and it falls off downward
    g.fillStyle = CEIL; g.fillRect(0, 0, W, m(0.3));
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(109,90,62,${0.20 - i * 0.024})`;
      g.fillRect(0, m(0.3) + i * m(0.12), W, m(0.12));
    }
    // a back wall a shade off the room, so the box has a far side
    g.fillStyle = '#352d26'; g.fillRect(0, m(1.0), W, m(1.5));
    // shelving along the back — uneven, because stock is
    for (let sy = m(1.15); sy < m(2.4); sy += m(0.62)) {
      g.fillStyle = '#3e352c'; g.fillRect(0, sy, W, m(0.07));
      for (let x = m(0.2); x < W - m(0.3); x += m(0.5)) {
        if (r() < 0.25) continue;
        g.fillStyle = STOCK[Math.floor(r() * STOCK.length)];
        const hh = m(0.22) + Math.round(r() * m(0.2));
        g.fillRect(x, sy - hh, m(0.3), hh);
      }
    }
    // counter edge at the height a counter is, catching the ceiling light
    const cy = m(2.55);
    g.fillStyle = COUNTER; g.fillRect(0, cy, W, m(0.12));
    g.fillStyle = 'rgba(180,160,120,0.22)'; g.fillRect(0, cy, W, m(0.04));
    g.fillStyle = '#241f1a'; g.fillRect(0, cy + m(0.12), W, m(0.5));
    // floor, darkest, so the eye reads depth downward
    g.fillStyle = FLOOR; g.fillRect(0, H - m(0.9), W, m(0.9));
    dither(g, W, H, Math.round(wMeters * hMeters * 3));
  });
}

/**
 * THE SHOPFRONT IN THREE DIMENSIONS — the part shading cannot do.
 *
 * `reveal()`/`proud()` make a painted plane read as built, and at 16 px/m that
 * is the right answer for a 50 mm lip. But a fascia genuinely stands off the
 * wall by 150–200 mm, and no amount of shading gives you the thing you see
 * when you walk PAST a shop rather than stand square to it: the sign edge
 * catching light down the street, the stallriser stepping out at your shin,
 * the glass sitting back behind its jambs. That is silhouette, and silhouette
 * needs geometry.
 *
 * These are MOULDINGS, not slabs, and deliberately so: a solid projecting
 * fascia box would cover the painted sign, and a solid stallriser would cover
 * its panels. A real shopfront frames its fascia with a cornice above and a
 * bed-mould below, and its glass with jambs and a cill. Framing gives the
 * depth without hiding the art the painter just put there.
 *
 * Everything derives from `frontageOf()`, so the relief lands exactly on the
 * painted features rather than beside them — the same single-authoring the
 * descriptor exists for.
 *
 * DEPTH BUDGET: nothing here projects more than 0.30 m, because
 * `ct/street.ts` already reserves that — its footprint colliders start at
 * `FACE - 0.3`. So this adds no collision and needs no collider change.
 * If a future piece wants to project further, that is a conversation with
 * whoever owns the collision, not a bigger number here.
 */
export function shopfrontRelief(o: {
  scene: THREE.Scene;
  name: string;
  wMeters: number;
  /** the shop's fascia colour, so the cornice belongs to its sign */
  trim: string;
  /** centre of the frontage, ON the facade plane */
  x: number; z: number;
  /** the same rotation litSheets is handed: local +x runs along the frontage,
   *  local +z points out at the street */
  rotY: number;
}): void {
  // Publish where this frontage actually is, while we still have the placement
  // in hand. rotY tells us the axis, the outward normal and — the only piece of
  // handedness in the system — which way canvas u runs. Those four values were
  // MEASURED off the meshes' uv attribute, not assumed: a west facade's u runs
  // along -z, an east facade's along +z, a side-street one along -x.
  const half = o.wMeters / 2;
  const R = ((o.rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const near = (a: number) => Math.abs(R - a) < 0.01;
  const place: Placement | null =
    near(Math.PI / 2) ? { axis: 'z', loWorld: o.z - half, hiWorld: o.z + half, facePos: o.x, outward: 1, uDir: -1 }
    : near(Math.PI * 1.5) ? { axis: 'z', loWorld: o.z - half, hiWorld: o.z + half, facePos: o.x, outward: -1, uDir: 1 }
    : near(0) ? { axis: 'x', loWorld: o.x - half, hiWorld: o.x + half, facePos: o.z, outward: 1, uDir: 1 }
    : near(Math.PI) ? { axis: 'x', loWorld: o.x - half, hiWorld: o.x + half, facePos: o.z, outward: -1, uDir: -1 }
    : null;
  if (place) registerFrontage(o.name, o.wMeters, place);
  // …AND ONLY THEN ask what the frontage looks like. `frontageOf` was called
  // at the top of this function, before the registration below it, so it could
  // never see a room's declaration — `declaredAlongU` needs a placement to
  // resolve a world coordinate against and there was none yet.
  //
  // That was harmless while the diner's glass block sat on a fixed end,
  // because the declared and undeclared layouts differed only in the door and
  // nothing here reads the door. It stopped being harmless the moment the
  // block's END became a function of the declaration: the mouldings would have
  // framed the glazing where the painter USED to put it, at the other end of
  // the shop from the glass the painter actually draws. One mesh fewer and 165
  // textures repainted in the fingerprint, which is how it was caught.
  const F = frontageOf(o.name, o.wMeters);
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.z);
  g.rotation.y = o.rotY;
  o.scene.add(g);

  const CORNICE = 0.20, BED = 0.13, JAMB = 0.12, CILL = 0.11, PLINTH = 0.09;
  // NOTE: `WALK_PROJECTION` below is derived from these. If you deepen
  // anything here that sits below head height, deepen that too or the
  // collider stops matching the geometry.
  const RECESS = 0.45;                 // how far back the room sits
  const along = (mFromLeft: number) => mFromLeft - half;   // frontage metres → local x
  // Separate material instances on purpose: ct/props.ts's dimWorld() grades a
  // material ONCE, by the elevation of the first mesh it sees wearing it. Share
  // one between the cornice and the plinth and the whole set gets graded as if
  // it lived at whichever height came first.
  // NOT `o.trim` directly — the painter decides what its own joinery is made
  // of. See joineryOf(): ct/street.ts hands us the roster colour, which is
  // right for every character but the diner.
  const tint = new THREE.Color(joineryOf(o.name, o.trim) || '#4a4034');
  const mat = (c: THREE.Color | number) => new THREE.MeshBasicMaterial({ color: c });
  const put = (w: number, h: number, d: number, x: number, y: number, m: THREE.Material) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    box.position.set(x, y, d / 2);          // sits ON the plane, projecting out
    g.add(box);
    return box;
  };

  // ── the room behind the glass ─────────────────────────────────────────────
  //
  // Set back and OPAQUE, covering the whole band including the door light.
  // On a solid-box shopfront this is hidden behind the front face and costs one
  // plane; the moment anyone cuts a real opening in that face — which is
  // exactly what happened to the bodega bay — there is already a room behind it
  // rather than a view of the pavement running on under the building.
  const room = new THREE.Mesh(
    new THREE.PlaneGeometry(o.wMeters, SHOP_BAND_H),
    new THREE.MeshBasicMaterial({ map: shopInteriorTex(o.name, o.wMeters, SHOP_BAND_H) }));
  room.position.set(0, SHOP_BAND_H / 2, -RECESS);
  g.add(room);

  // ── the fascia, framed rather than covered ────────────────────────────────
  const fTop = F.fasciaBottomM + F.fasciaH;
  put(o.wMeters, 0.10, CORNICE, 0, fTop + 0.05, mat(tint.clone().multiplyScalar(0.72)));
  put(o.wMeters, 0.07, BED, 0, F.fasciaBottomM - 0.035, mat(tint.clone().multiplyScalar(0.55)));

  // ── the glass reveal: jambs each side and a head over, so the glazing
  //    reads as set back behind a frame rather than flush with the brick ─────
  const dark = 0x332e28;
  const gL = along(F.glazingStartM), gR = along(F.glazingEndM);
  const gH = F.glazingTopM - F.glazingBottomM;
  const gMid = (F.glazingBottomM + F.glazingTopM) / 2;
  put(0.14, gH + 0.12, JAMB, gL - 0.07, gMid, mat(dark));
  put(0.14, gH + 0.12, JAMB, gR + 0.07, gMid, mat(dark));
  put(gR - gL + 0.28, 0.13, JAMB, (gL + gR) / 2, F.glazingTopM + 0.06, mat(dark));

  // ── the stallriser: a cill where it meets the glass, a plinth at the
  //    pavement. The step you catch with your shin. ──────────────────────────
  put(o.wMeters, 0.09, CILL, 0, F.stallriserH + 0.02, mat(tint.clone().multiplyScalar(0.45)));
  put(o.wMeters, 0.12, PLINTH, 0, 0.06, mat(0x2a2620));

  // ── A PROJECTING BLADE, on the one front that earns it ────────────────────
  //
  // The last item on the user's own list of what a better facade means:
  // "signage that is a made object: a projecting blade, a hand-painted board,
  // applied letters with a shadow". The thrift store has the painted board and
  // all four have the applied letters. Nobody had built the blade.
  //
  // I had this filed as blocked on the 0.30 m depth budget, and that was wrong.
  // The budget is about things you can WALK INTO — the note above says so, and
  // the sprite tree in this file already settles the case: "the crown is WIDER
  // than the walk on purpose… it clears head height, and collision is
  // trunk-only, so the sidewalk stays as walkable as it was — the crown is
  // allowed to be generous because you walk UNDER it." A blade hung at fascia
  // height is that same case: its underside is at 2.6 m, a metre clear of a
  // standing player, and it adds no collider because nothing can reach it.
  // A real one overhangs the pavement; that IS the feature.
  //
  // Selected by name, the same dispatch shopfrontTex uses — the shopfront
  // system decides how a named shop looks, and giving another shop a blade is
  // a change here and nowhere else.
  if (o.name === 'DINER') {
    const PROJ = 0.95, TALL = 1.55, FOOT = 2.45;   // underside 2.45 m: walk under it
    const bx = along(o.wMeters * 0.17);
    // THE BRACKET FIRST, and spanning the FULL projection. My first attempt
    // hung the plate off a stub arm reaching half way, which put the whole
    // bracket behind the plate when you stand square to the shop — and a blade
    // is edge-on from there, so all you saw was a pale stick floating in front
    // of the brick. The user has already called out a floating sign on this
    // block once ("the sign up top is completely floating"); shipping a second
    // one would be the same fault with my name on it.
    const armM = mat(tint.clone().multiplyScalar(0.5));
    put(0.09, 0.09, PROJ, bx, FOOT + TALL + 0.05, armM);          // top arm, wall to tip
    put(0.09, 0.34, 0.09, bx, FOOT + TALL + 0.05 - 0.21, armM);   // the drop at the wall
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, TALL, PROJ),
      new THREE.MeshBasicMaterial({ map: bladeTex(PROJ, TALL) }));
    blade.position.set(bx, FOOT + TALL / 2, PROJ / 2);
    g.add(blade);
  }
}

/**
 * The face of a projecting blade sign: enamel plate, a COFFEE CUP on it.
 *
 * IT SAID "EAT" AND IT COULD NOT BE READ. The user: it "reads as a T and some
 * loose strokes and the user cannot tell what it is". They gave two candidates
 * and the arithmetic settles which:
 *
 *   plate canvas   masonry(0.95, 1.55) at 16 px/m  ->  15 x 25 TEXELS
 *   border         2 rows top and bottom            ->  ~19 rows for 3 letters
 *   font           m(0.5) = 8 px, centres at 7/12/17 -> 5 px apart, 8 px tall
 *
 * Every letter overlapped its neighbours by about three pixels. Shrinking the
 * font to fit gives roughly three pixels of ink per glyph, which is mush — so
 * three stacked letters DO NOT FIT on this plate at any size, and saying so is
 * the honest answer rather than tuning the leading and hoping.
 *
 * NOT the other candidate, and I checked that one first because it is the
 * documented landmine (GOTCHAS 10, and it shipped mirrored on the casino and
 * the hotel). This blade is a BoxGeometry, not a DoubleSide plane: a box gives
 * every face its own correctly-oriented UVs, so it reads the same walking north
 * and walking south. Verified by walking past it in both directions and reading
 * it from each side, not by reasoning about the geometry — which is exactly the
 * mistake I made twice this session.
 *
 * So: a symbol, as the user proposed. A cup reads at any density where three
 * stacked letters do not, the fascia beside it already says DINER so the blade
 * does not have to carry the name, and a coffee cup on a blade IS the 1997
 * diner vocabulary. Laid out in whole texels off W and H — at fifteen pixels
 * wide, a fraction of a texel is the difference between a cup and a smudge.
 */
function bladeTex(wM: number, hM: number): THREE.Texture {
  const surf = masonry(wM, hM, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  // PLATE was #e8e0cc and the sign would not go dark. props.ts decides what
  // carries its own light by LOOKING at the sheet — bright AND chromatic,
  // `mx > 199 && mx - mn > 26` over 8% of texels — because a lit window and
  // dark brick are both colour-white and keep everything in the texture. That
  // cream is 232 max with a chroma of 28: it cleared the neon test by two
  // points, so an enamel plate was graded as a light source and stayed the
  // brightest thing on a night street.
  //
  // The heuristic is right and my colour was wrong for what I meant. This one
  // is chroma 25 — the same cream to look at, and honestly not a light. The
  // user asked for "the unilluminated stuff darker… it should feel scarier at
  // night", and a sign that ignores the sunset is the opposite of that.
  const PLATE = '#ddd6c4', INK = '#b8302a', EDGE = '#8a7f6a';
  return surf.paint((g) => {
    g.fillStyle = EDGE; g.fillRect(0, 0, W, H);
    g.fillStyle = PLATE; g.fillRect(m(0.06), m(0.06), W - m(0.12), H - m(0.12));
    g.fillStyle = INK;                                     // the enamel border
    g.fillRect(m(0.14), m(0.14), W - m(0.28), Math.max(1, m(0.07)));
    g.fillRect(m(0.14), H - m(0.14) - m(0.07), W - m(0.28), Math.max(1, m(0.07)));
    // THE CUP, in whole texels off the plate's own size. Everything below is
    // a fraction of W or H rounded once, so the shape survives the plate being
    // resized instead of drifting into a smudge.
    const cx = Math.round(W / 2);
    const cw = Math.max(5, Math.round(W * 0.47));        // body width
    const bx0 = cx - Math.round(cw / 2);
    const bodyY = Math.round(H * 0.36);
    const bodyH = Math.max(4, Math.round(H * 0.20));
    g.fillStyle = INK;
    // steam: two wisps at different heights, so they rise rather than read as
    // a pair of bars. They stop two rows short of the cup — the GAP is what
    // makes them steam.
    const sTop = Math.round(H * 0.14);
    g.fillRect(cx - 3, sTop, 1, bodyY - sTop - 2);
    g.fillRect(cx + 2, sTop + 1, 1, bodyY - sTop - 3);
    // the body, and a row under it that is narrower: a cup tapers, a box does
    // not, and one row is the whole difference at this size
    g.fillRect(bx0, bodyY, cw, bodyH);
    g.fillRect(bx0 + 1, bodyY + bodyH, cw - 2, 1);
    // THE HANDLE, with one texel of plate between it and the body. Drawn hard
    // against the body first and it merged into one blob — at fifteen pixels
    // wide the silhouette is the whole signal, and a handle you cannot see a
    // gap beside is not a handle.
    const hgx = bx0 + cw + 1, hy = bodyY + 1;
    g.fillRect(hgx, hy, 2, 1);
    g.fillRect(hgx + 1, hy + 1, 1, bodyH - 4);
    g.fillRect(hgx, hy + bodyH - 3, 2, 1);
    // The saucer: wider than the body, which is the other half of reading as
    // crockery — but NARROWER THAN THE BORDER BARS. At W*0.80 it came out 12
    // texels against the border's 11 and read as a third horizontal stripe on a
    // plate that already has two. Sized off the BODY instead, and tucked one
    // row under it so it belongs to the cup rather than floating below it.
    const sw = cw + 2;
    g.fillRect(cx - Math.round(sw / 2), bodyY + bodyH + 1, sw, 2);
    // weather: it has hung outside for thirty years
    dither(g, W, H, Math.round(wM * hM * 5));
  });
}

export function shopfrontTex(brick: string, name: string, awning: string, wMeters = 12): THREE.Texture {
  // Characters are selected HERE, by name, not by a `front:` flag in
  // ct/street.ts's roster. The shopfront system decides how a named shop
  // looks — that is the boundary the consolidation drew — so giving another
  // shop a character is a change in this file and nowhere else. (BURGER BARN,
  // PAWN and A-1 TAX still come in through the roster flag; both routes work,
  // and the flag can retire whenever D is next in that file.)
  if (name === 'DINER') return dinerFront(brick, name, wMeters);
  if (name === 'THRIFT') return thriftFront(brick, name, awning, wMeters);
  const surf = masonry(wMeters, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  // The block default. It should NOT have a character — a barber, a deli and
  // a laundry are supposed to be quiet next to the four that do. What it must
  // be is BUILT: an opening cut into brick with a reveal, a fascia and a
  // stallriser that stand off the wall, glazing divided into bays, and
  // something behind the glass. It was none of those; it was four painted
  // stripes, which is why the whole block read flat and not just the specials.
  //
  // Each shop varies a little off its own name so fifteen of these in a row
  // are not fifteen copies: how far the door sits along the front, how many
  // bays, how bright the room behind. Hashed, not rnd() — see facadeTex.
  // The door position is NOT decided here any more — frontageOf() owns it, and
  // ct/int-*.ts reads the same object. What is left local is the cosmetic
  // variation that no room needs to know about.
  const F = frontageOf(name, wMeters);
  let sd = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) sd = Math.imul(sd ^ name.charCodeAt(i), 0x01000193) >>> 0;
  const vary = (n: number) => { sd = Math.imul(sd ^ 0x9e3779b1, 0x01000193) >>> 0; return (sd >>> 8) % n; };
  const BAND_MAX = 12, BAND_INSET = 0.5;
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    // the band's foot IS world y = 0, so its courses are the datum the wall
    // above continues from — same 0.5 m spacing, same lines
    surf.courses(g);
    // fascia: a signboard fixed to the brick, so it throws a shadow
    const B = BANDS.default;
    const fy = m(B.fy), fh = m(B.fh);
    const bandW = Math.min(W - m(2 * BAND_INSET), m(BAND_MAX)), bandX = Math.round((W - bandW) / 2);
    proud(g, surf, bandX, fy, bandW, fh, awning);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(bandX, fy + fh - m(0.16), bandW, m(0.16));
    g.font = `bold ${m(0.6)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillText(name, W / 2 + 1, fy + fh / 2 + 1);
    g.fillStyle = '#f2ead0'; g.fillText(name, W / 2, fy + fh / 2);
    // the opening, set back from the brick face
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#211d18'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, '#38302a');
    // WHERE THE DOOR IS, before the room behind the glass is dressed.
    //
    // The shelf and its stock used to be drawn straight across the glazing and
    // the doorcase stamped over the top, so on every quiet shop on the block
    // the shelf ran INTO the door and a jar was cut in half by it. That is the
    // thrift store's chopped "50c" card, in the painter that does ten shops
    // rather than one — the user's own guess that this would reach the
    // neighbours, since they share these painters.
    const dcM = doorAlongU(name, wMeters, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    const dL = dx - m(0.07), dR = dx + dw + m(0.07);
    const runs = ([[gx, Math.min(dL, gx + gw)], [Math.max(dR, gx), gx + gw]] as [number, number][])
      .filter(([a, c]) => c - a >= m(0.6));
    // a room behind: lit ceiling, a shelf run at chest height, dark floor.
    // Three bands is all it takes to stop the glass reading as a black hole.
    // The ceiling and the floor DO run the full width — they are the room, and
    // a room continues behind its own door. The shelf is furniture and stops.
    const warm = ['#c9a45e', '#b8a06a', '#c2a862'][vary(3)];
    g.fillStyle = warm; g.fillRect(gx, gy, gw, m(0.26));
    g.fillStyle = 'rgba(201,164,94,0.22)'; g.fillRect(gx, gy + m(0.26), gw, m(0.5));
    for (const [a, c] of runs) {
      g.fillStyle = '#4a3f33'; g.fillRect(a, gy + m(1.35), c - a, m(0.12));       // shelf
      g.fillStyle = '#2b241e';
      for (let x = a + m(0.2); x + m(0.36) <= c - m(0.1); x += m(0.7)) {          // stock on it
        g.fillRect(x, gy + m(1.35) - m(0.3) - (vary(3) * m(0.06)), m(0.36), m(0.3) + vary(3) * m(0.06));
      }
    }
    g.fillStyle = '#241e19'; g.fillRect(gx, gy + gh - m(0.42), gw, m(0.42));      // floor
    // transom over the glazing, then the bars that divide it
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(gx, gy + m(0.98), gw, Math.max(1, m(0.09)));
    g.fillStyle = HI; g.fillRect(gx, gy + m(1.07), gw, 1);
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wMeters / 3.4)), '#3e372f');
    // the door, somewhere along the front rather than always dead centre —
    // where the ROOM says its door is, resolved above so the display could be
    // dressed around it
    g.fillStyle = '#3e372f'; g.fillRect(dL, gy, dR - dL, gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.95), '#38302a');
    g.fillStyle = '#4a4034'; g.fillRect(dx, gy + gh - m(0.83), dw, m(0.83));      // its panel
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.83), dw, m(0.06));
    g.fillStyle = '#8a7a52'; g.fillRect(dx + dw - m(0.2), gy + m(1.45), m(0.08), m(0.26));
    // stallriser, panelled, and grubby where the pavement reaches it
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#4a4034');
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = ox + m(1.1); x < ox + ow - m(0.9); x += m(1.5)) g.fillRect(x, ry + m(0.1), Math.max(1, m(0.1)), rh - m(0.16));
    g.fillStyle = 'rgba(28,24,18,0.30)'; g.fillRect(ox, H - m(0.14), ow, m(0.14));
    dither(g, W, H, Math.round(wMeters * SHOP_BAND_H * 5));
  });
}

// ═══════════════════════ SHOPFRONT DEPTH VOCABULARY ═══════════════════════
//
// What separates a shopfront that reads as BUILT from one that reads as
// wallpaper is depth — and at 16 px/m depth is not geometry. A 50 mm fascia
// lip is a third of a texel; modelling it would be invisible. It is SHADING,
// and it has to be consistent or it reads as noise.
//
// Light in this world falls from above and slightly LEFT — the convention
// resGroundTex's doorcase and facadeTex's sills already use. So:
//
//   a recess     head dark · cill lit · LEFT jamb dark · right jamb lit
//   a projection top edge lit · a cast shadow on whatever it overhangs
//
// Composing every front from these also stops them drifting apart again,
// which is what put this on the queue: change the vocabulary once and all
// four move together.
// Exported for ct/street.ts's bodega corner bay (builder D, BLOCKED-D.md).
// The whole point of a shared vocabulary is that the corner follows it instead
// of inventing a second one, and module-private helpers made that impossible —
// D's only options were to add these exports inside my live mandate, or to
// copy them, which is the second vocabulary the brief forbids.
//
// These are values and pure draw calls: no state, no signature that depends on
// anything here. Safe to call from any painter in any file.
export const HI = 'rgba(255,255,255,0.20)';
export const SH = 'rgba(0,0,0,0.30)';
const DP = 'rgba(0,0,0,0.55)';

interface Band { m: (v: number) => number; W: number; H: number }

/** the shopfront opening, set back from the brick it is cut into */
export function reveal(g: CanvasRenderingContext2D, s: Band, x: number, y: number, w: number, h: number) {
  const d = Math.max(1, s.m(0.15));
  g.fillStyle = DP; g.fillRect(x, y, w, d);                     // head, casting down
  g.fillStyle = SH; g.fillRect(x, y + d, d, h - d);             // left jamb, turned from the light
  g.fillStyle = HI; g.fillRect(x + w - d, y + d, d, h - d);     // right jamb, turned into it
  g.fillStyle = HI; g.fillRect(x, y + h - d, w, d);             // cill
}

/** a band standing proud of the wall: lit along the top, casting underneath */
export function proud(g: CanvasRenderingContext2D, s: Band, x: number, y: number, w: number, h: number, fill: string) {
  const d = Math.max(1, s.m(0.09));
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  g.fillStyle = HI; g.fillRect(x, y, w, d);
  g.fillStyle = DP; g.fillRect(x, y + h, w, d);                 // the shadow it throws
}

/** plate glass: a raking sky reflection off the top-left, and the dark of the
 *  room behind. Never a flat black rectangle — that is the tell. */
export function glazed(g: CanvasRenderingContext2D, s: Band, x: number, y: number, w: number, h: number, room: string) {
  g.fillStyle = room; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(150,172,190,0.18)';                       // sky, raking across
  for (let i = 0; i < h; i++) {
    const run = Math.round(w * 0.42 * (1 - i / h));
    if (run > 0) g.fillRect(x, y + i, run, 1);
  }
  g.fillStyle = 'rgba(180,200,215,0.10)'; g.fillRect(x, y, w, Math.max(1, s.m(0.1)));
}

/** upright glazing bars. Real shopfronts are divided; one sheet reads as a hole. */
export function mullions(g: CanvasRenderingContext2D, s: Band, x: number, y: number, w: number, h: number, bays: number, col: string) {
  const t = Math.max(1, s.m(0.07));
  for (let i = 1; i < bays; i++) {
    const mx = x + Math.round((w * i) / bays);
    g.fillStyle = col; g.fillRect(mx, y, t, h);
    g.fillStyle = SH; g.fillRect(mx + t, y, 1, h);
  }
}

// ── three shopfronts that are NOT the block default ─────────────────────
//
// Everything else on the street wears shopfrontTex, which is the right
// neutral for a barber or a deli. These three are characters, and the
// spread between them is the point: the fast-food place is the loudest
// thing on the block, the tax office is the least designed, and the
// pawnshop is the most defended. All three keep the block's 8 px/m and the
// same band heights as shopfrontTex, so they line up with their neighbours.
// All three are now written in METRES like everything else here. The
// bandSurf()/ox/oy scaffolding that re-based their legacy texel coordinates
// onto a correctly dense canvas during the density work is gone with them —
// it was always meant to be temporary, and there is nothing left using it.
// 1997 fast food: saturated brand colours, a fascia twice the usual depth,
// and more glass than anyone else because you are supposed to see in.
/**
 * BURGER BARN — plastic and backlit plexi, the loudest thing on the block.
 *
 * RED AND BEIGE, asked for twice. It ran red + mustard for three "fixes"
 * because the mustard was spread over four separate fills and nobody found
 * them all; they are now the two constants below and nowhere else.
 *
 * The character is that everything is a moulded plastic part bolted on: a
 * light box rather than a painted board, a plexi menu strip, a kick rail that
 * has been scuffed by trolleys and feet since it went up.
 */
export const burgerFront = (brick: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf('BURGER BARN', wM);
  const RED = '#c8302a', BEIGE = '#e6dcc6', PLASTIC = '#b8ada0';
  // The room behind is DIM. A shopfront lit as bright as the sky reads as a
  // cream slab — which is what the first pass did. Glass is dark, and the
  // lit things inside it (the ceiling, the menu box) are what you see.
  const ROOM = '#4a3c2e', CEIL = '#c9a45e', FLOOR = '#2e2620';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // the light box: a plastic tray standing off the brick, lit from inside,
    // so its face is FLAT and even and its edges are hard — the opposite of
    // the painted board on the thrift shop
    const B = BANDS.burger;
    const fy = m(B.fy), fh = m(B.fh);
    proud(g, surf, 0, fy, W, fh, RED);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, fy + m(0.1), W, m(0.5));  // even internal glow
    g.fillStyle = BEIGE; g.fillRect(0, fy + fh - m(0.14), W, m(0.14));              // trim rail
    g.fillStyle = BEIGE; g.font = `bold ${m(0.62)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillText('BURGER BARN', W / 2 + 1, fy + fh / 2 + 1);
    g.fillStyle = BEIGE; g.fillText('BURGER BARN', W / 2, fy + fh / 2);
    // the opening, set back from the brick
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#2a2622'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, ROOM);
    // the room reads in three horizontal zones — lit ceiling, the furniture
    // you can pick out against it, dark floor. That structure is what makes a
    // window look INTO something instead of being a panel of paint.
    // The door is resolved BEFORE the room is dressed. The backlit menu box ran
    // the full width of the glazing and the door was stamped over it, so the
    // brightest object on this frontage was cut in half by a door leaf — the
    // same fault as the thrift store's price card, and just as visible, because
    // a lit menu is the one thing anyone looks at on a burger barn.
    const dcM = doorAlongU('BURGER BARN', wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    const runs = ([[gx, Math.min(dx, gx + gw)], [Math.max(dx + dw, gx), gx + gw]] as [number, number][])
      .filter(([a, c]) => c - a >= m(0.8));
    g.fillStyle = CEIL; g.fillRect(gx, gy, gw, m(0.34));                            // strip lights on the ceiling
    g.fillStyle = 'rgba(201,164,94,0.35)'; g.fillRect(gx, gy + m(0.34), gw, m(0.5)); // its spill
    g.fillStyle = FLOOR; g.fillRect(gx, gy + gh - m(0.5), gw, m(0.5));              // floor, in shadow
    // THE MENU IS AN OBJECT OVER THE COUNTER, NOT A RIBBON ACROSS THE WINDOW.
    //
    // It used to be `bw2 = (c - a) - 0.6` — the whole run — so on a 16 m
    // frontage the brightest surface in the world was a seven-metre unbroken
    // band of #f2ead0, twice. Measured against every shop on the street at
    // 13:30: burger barn 234 against a sky at 149, when nothing else on the
    // block clears 85. A backlit menu IS a light source and should read as
    // one; what it should not be is the length of the shop.
    //
    // A real one is three or four lit panels bolted over the counter. So:
    // bounded to 4.2 m, anchored at the run's DOOR-SIDE end because that is
    // where the counter is, and split into panels with dark stiles between so
    // it reads as made rather than as a stripe. The tone comes down to 210 —
    // still plainly lit, still `mx > 199` with chroma 41 so ct/props.ts keeps
    // grading it as self-lit and it stays on after dark, which is the point of
    // a backlit menu.
    const MENU = '#ddd2b4';
    for (const [a, c] of runs) {
      const doorSide = Math.abs(c - dx) < Math.abs(a - dx);       // which end faces the door
      const span = Math.min(m(4.2), (c - a) - m(0.6));
      const bx = doorSide ? c - m(0.3) - span : a + m(0.3);
      const bw2 = span;
      g.fillStyle = MENU; g.fillRect(bx, gy + m(0.45), bw2, m(0.42));              // backlit menu panels
      g.fillStyle = '#3a332a';                                                      // stiles between panels
      for (let k = 1; k < 3; k++) {
        g.fillRect(bx + Math.round((bw2 * k) / 3), gy + m(0.45), Math.max(1, m(0.07)), m(0.42));
      }
      g.fillStyle = RED;
      for (let x = bx + m(0.25); x + m(0.55) <= bx + bw2 - m(0.2); x += m(1.1)) {
        g.fillRect(x, gy + m(0.54), m(0.55), m(0.1));
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx, gy + m(0.87), bw2, m(0.1)); // its underside
      // booths: dark against the lit ceiling, at human scale, with the gap
      // between each pair reading as an aisle
      for (let x = a + m(0.5); x + m(1.6) <= c - m(0.2); x += m(2.3)) {
        g.fillStyle = '#241c16';
        g.fillRect(x, gy + m(1.15), m(0.95), m(1.35));                              // seat back
        g.fillRect(x + m(1.05), gy + m(1.5), m(0.55), m(1.0));                      // table + far seat
        g.fillStyle = 'rgba(201,164,94,0.22)';                                      // rim light off the ceiling
        g.fillRect(x, gy + m(1.15), m(0.95), m(0.08));
      }
    }
    // transom rail over the glazing, between the lit menu and the booths.
    // Plastic trim, because that is what this whole front is made of — the one
    // built feature it was missing against the shop next door that is supposed
    // to be the plain one.
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(gx, gy + m(1.02), gw, Math.max(1, m(0.09)));
    g.fillStyle = PLASTIC; g.fillRect(gx, gy + m(1.11), gw, 1);
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 3.2)), PLASTIC);
    // the door, in its own reveal, with a push bar — resolved above so the
    // room could be dressed around it
    g.fillStyle = '#3a3630'; g.fillRect(dx, gy, dw, gh);
    glazed(g, surf, dx + m(0.1), gy + m(0.12), dw - m(0.2), gh - m(0.24), '#cbbfa6');
    g.fillStyle = PLASTIC; g.fillRect(dx + m(0.15), gy + m(1.15), dw - m(0.3), m(0.1));  // push bar
    g.fillStyle = SH; g.fillRect(dx + m(0.15), gy + m(1.25), dw - m(0.3), 1);
    // stallriser: a plastic kick rail, scuffed where feet and trolleys reach
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#8a3a24');
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < Math.round(wM * 1.6); i++) {
      const sx = ox + Math.floor(Math.random() * (ow - m(0.4)));
      g.fillRect(sx, ry + rh - m(0.16) - Math.floor(Math.random() * m(0.12)), m(0.2), m(0.06));
    }
    g.fillStyle = 'rgba(30,24,20,0.28)'; g.fillRect(ox, H - m(0.12), ow, m(0.12));  // road dirt at the foot
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};
/**
 * THE PAWNSHOP — the most defended thing on the street.
 *
 * Character is layers: goods behind glass behind a steel grille, and the
 * grille is what you actually see first. That layering is the depth here —
 * a lit shelf at the back, dim glass over it, then bars in front casting onto
 * both. A hand-painted board, because nobody has spent money on this frontage
 * since the balls went up.
 */
export const pawnFront = (brick: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf('PAWN', wM);
  const BOARD = '#6a5a3a', GOLD = '#c9a45e', STEEL = '#40453f';
  const GOODS = ['#8a3a2e', '#c9a45e', '#3a5a8a', '#8a8378', '#4a7a3a', '#7a3a6a', '#a8a29a'];
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // hand-painted board, brush-streaked along its length
    const B = BANDS.pawn;
    const fy = m(B.fy), fh = m(B.fh);
    proud(g, surf, m(0.25), fy, W - m(0.5), fh, BOARD);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let x = m(0.25); x < W - m(0.25); x += m(0.28)) if ((x / m(0.28)) % 3 < 1) g.fillRect(x, fy, m(0.14), fh);
    g.font = `bold ${m(0.5)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillText('PAWN', W * 0.42 + 1, fy + fh / 2 + 1);
    g.fillStyle = '#e8dcc0'; g.fillText('PAWN', W * 0.42, fy + fh / 2);
    g.font = `bold ${m(0.3)}px monospace`;
    g.fillStyle = '#c9bfa0'; g.fillText('LOANS  GOLD  TOOLS', W * 0.72, fy + fh / 2 + m(0.06));
    // the three balls, hung off the board so they cast onto it
    const bx0 = m(1.0), by0 = fy + fh * 0.5, br = m(0.19);
    for (const [ox2, oy2] of [[0, -0.28], [0.42, -0.28], [0.21, 0.14]] as [number, number][]) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(bx0 + m(ox2) + 1, by0 + m(oy2) + 1, br, br, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = GOLD;
      g.beginPath(); g.ellipse(bx0 + m(ox2), by0 + m(oy2), br, br, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(bx0 + m(ox2) - br * 0.3, by0 + m(oy2) - br * 0.3, br * 0.35, br * 0.35, 0, 0, Math.PI * 2); g.fill();
    }
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#1d1a16'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, '#2b2622');
    // ONE bulb over a shelf of pledged goods — instruments, tools, a guitar
    // neck. Dim, because nothing in here is a display, it is storage.
    g.fillStyle = '#8a7a4e'; g.fillRect(gx, gy, gw, m(0.18));
    g.fillStyle = 'rgba(138,122,78,0.20)'; g.fillRect(gx, gy + m(0.18), gw, m(0.4));
    let sd = 0x51a3f7;
    const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    // two shelves, both crowded — a pawnshop window is inventory, not display
    for (const sy of [gy + m(1.15), gy + m(2.25)]) {
      g.fillStyle = '#3e372c'; g.fillRect(gx, sy, gw, m(0.1));
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(gx, sy + m(0.1), gw, m(0.1));      // under the shelf
      for (let x = gx + m(0.3); x < gx + gw - m(0.4); x += m(0.58)) {
        const hgt = m(0.4) + Math.round(r() * m(0.45));
        g.fillStyle = GOODS[Math.floor(r() * GOODS.length)];
        g.fillRect(x, sy - hgt, m(0.34), hgt);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, sy - hgt, m(0.34), m(0.06));
      }
    }
    for (let x = gx + m(0.4); x < gx + gw - m(0.5); x += m(0.85)) {                   // stacked on the floor
      const hgt = m(0.3) + Math.round(r() * m(0.4));
      g.fillStyle = GOODS[Math.floor(r() * GOODS.length)];
      g.fillRect(x, gy + gh - m(0.35) - hgt, m(0.4), hgt);
    }
    g.fillStyle = '#211d19'; g.fillRect(gx, gy + gh - m(0.35), gw, m(0.35));          // floor
    // the grille, IN FRONT of the glass — a separate plane, so it gets its own
    // highlight and throws its own shadow onto everything behind it
    for (let x = gx + m(0.2); x < gx + gw - m(0.05); x += m(0.46)) {
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + 1, gy, Math.max(1, m(0.07)), gh);
      g.fillStyle = STEEL; g.fillRect(x, gy, Math.max(1, m(0.07)), gh);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, gy, 1, gh);
    }
    for (const yy of [gy + m(0.55), gy + m(1.75), gy + gh - m(0.4)]) {                // horizontal rails
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(gx, yy + 1, gw, Math.max(1, m(0.08)));
      g.fillStyle = STEEL; g.fillRect(gx, yy, gw, Math.max(1, m(0.08)));
    }
    // door, barred to match, with a heavy kick plate
    // where the ROOM says its door is, falling back to this painter's own
    // layout only if no room has spoken for this frontage
    const dcM = doorAlongU('PAWN', wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = '#332c24'; g.fillRect(dx - m(0.07), gy, dw + m(0.14), gh);
    g.fillStyle = '#4a4034'; g.fillRect(dx, gy + gh - m(0.9), dw, m(0.9));
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.9), dw, m(0.06));
    g.fillStyle = GOLD; g.fillRect(dx + dw - m(0.2), gy + m(1.5), m(0.08), m(0.28));
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#3a3020');
    g.fillStyle = 'rgba(26,22,16,0.34)'; g.fillRect(ox, H - m(0.16), ow, m(0.16));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 5));
  });
};
// the tax office: no sign worth the name, just a banner cable-tied over the
// brick and paper taped inside the glass. The least designed thing here.
/**
 * A-1 TAX SERVICE — the least designed thing on the block, and deliberately.
 *
 * Its character is that nobody ever commissioned a shopfront: a vinyl banner
 * cable-tied over the brick, vertical blinds permanently half-shut, one piece
 * of gold-leaf lettering applied by somebody who did know what they were
 * doing, and a strip light on all day. The depth is all in the blinds — a
 * plane of them behind glass is the whole read.
 */
export const taxFront = (brick: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf('A-1 TAX', wM);
  // BLIND was #cfd2c8 — luma 209 against a 149 sky, the brightest large
  // surface on the block after the burger barn's menu. Set by measurement now,
  // not by eye: see the comment on the blind run below.
  const NAVY = '#2c4a7a', GOLD = '#b89a4e', BLIND = '#7d8178', ALU = '#8f938f';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // the banner: cloth, so it sags and its edges are soft — no light box
    const by0 = m(0.2), bh = m(0.78), bx0 = m(0.45), bw = W - m(0.9);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(bx0, by0 + bh - m(0.06), bw, m(0.2));  // shadow on brick
    g.fillStyle = '#d8d2c4'; g.fillRect(bx0, by0, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(bx0, by0 + bh - m(0.14), bw, m(0.14)); // the sag
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const gx of [bx0 + m(0.12), bx0 + bw - m(0.18)]) {                             // grommets
      g.fillRect(gx, by0 + m(0.1), m(0.09), m(0.09));
      g.fillRect(gx, by0 + bh - m(0.2), m(0.09), m(0.09));
    }
    // Screen-printed on cloth, so the letters sit ON the banner rather than IN
    // it: a soft light bleed above and the ink below. The brief's words were
    // "applied letters with a shadow — not text stamped on a band", and this
    // was the one sign of the four that was flat text with nothing under it.
    // Bleed rather than a hard drop shadow, because this is a cloth banner and
    // not the diner's steel or the burger barn's plexi — the same reason its
    // stallriser gets grooves and the diner's gets flutes.
    g.font = `bold ${m(0.5)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText('A-1 TAX SERVICE', W / 2, by0 + bh / 2 - 1);
    g.fillStyle = 'rgba(20,26,44,0.35)';
    g.fillText('A-1 TAX SERVICE', W / 2, by0 + bh / 2 + 1);
    g.fillStyle = NAVY;
    g.fillText('A-1 TAX SERVICE', W / 2, by0 + bh / 2);
    // the opening
    const B = BANDS.tax;
    const ox = m(B.ox), oy = by0 + bh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#232019'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, '#3a4038');
    // VERTICAL BLINDS, half shut — but not across the whole window, and not
    // brighter than the sky.
    //
    // Measured against every other shopfront on the street, this front was the
    // outlier and it was the outlier twice over: the slat tone came out at
    // luma 209 against a daylight sky at 149, and one tone covered 46.8% of
    // the band's mid rows. Nothing else on the block is above 85. A wall of
    // even pale stripes at that brightness reads as a barcode, which is what
    // it looked like from the pavement.
    //
    // Both halves are wrong for the same physical reason: outside is BRIGHTER
    // than inside. A slat lit by an office fluorescent, seen from a sunlit
    // street, is a mid grey — the paleness was painting it as if it were lit
    // from the camera's side. And a blind that is "permanently half-shut" is
    // never drawn evenly across a 12 m window; one panel is always pulled
    // back, which is also where the depth comes from.
    const step = m(0.22);
    // The drawn-back panel goes at the end FURTHEST FROM THE DOOR, derived
    // rather than fixed, so it keeps working if the room moves its door —
    // the same lesson the diner's glass block taught two commits ago.
    const dcM = doorAlongU('A-1 TAX', wM, F.doorCentreM);
    const openLow = m(dcM) > gx + gw / 2;
    const openW = Math.min(m(2.6), gw * 0.24);
    const oX0 = openLow ? gx : gx + gw - openW;
    const oX1 = oX0 + openW;
    // what you see where they are pulled back: a desk under the window, a
    // chair behind it, a filing cabinet, and the strip light on the ceiling
    g.fillStyle = '#2e3330'; g.fillRect(oX0, gy, openW, gh);
    g.fillStyle = '#5a5f52'; g.fillRect(oX0, gy, openW, m(0.22));                     // lit ceiling
    g.fillStyle = '#463d31'; g.fillRect(oX0 + m(0.2), gy + m(1.5), openW - m(0.4), m(0.14));  // desk top
    g.fillStyle = '#241f1a'; g.fillRect(oX0 + m(0.3), gy + m(1.64), openW - m(0.6), m(0.7));  // its shadow side
    g.fillStyle = '#3a3f42'; g.fillRect(oX0 + m(0.45), gy + m(0.95), m(0.5), m(0.55));        // chair back
    g.fillStyle = '#4a463c'; g.fillRect(oX1 - m(0.75), gy + m(0.75), m(0.55), m(1.5));        // filing cabinet
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 1; k < 4; k++) g.fillRect(oX1 - m(0.75), gy + m(0.75) + k * m(0.37), m(0.55), Math.max(1, m(0.05)));
    for (let x = gx; x < gx + gw; x += step) {
      if (x + step > oX0 && x < oX1) continue;                 // pulled back here
      const lean = (Math.floor((x - gx) / step) % 5 === 0) ? m(0.05) : 0;
      // slats do not all hang at one angle; a few catch the light and a few
      // are edge-on, which is what stops the run reading as a printed pattern
      const turn = Math.floor((x - gx) / step) % 7;
      g.fillStyle = turn === 3 ? '#6d7168' : turn === 6 ? '#8b8f84' : BLIND;
      g.fillRect(x, gy, Math.max(1, step - m(0.07)), gh);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + step - m(0.09) + lean, gy, Math.max(1, m(0.06)), gh);
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(gx, gy, gw, m(0.5));           // strip light above them
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(gx, gy + gh - m(0.45), gw, m(0.45)); // floor shadow below
    g.fillStyle = ALU; g.fillRect(gx, gy + m(0.62), gw, m(0.09));                     // the blind head rail
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 4.2)), ALU);
    // gold leaf on the glass — the one piece of real signwriting here
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.font = `bold ${m(0.42)}px serif`;
    g.fillText('REFUNDS', gx + gw * 0.5 + 1, gy + m(1.5) + 1);
    g.fillStyle = GOLD; g.fillText('REFUNDS', gx + gw * 0.5, gy + m(1.5));
    g.fillStyle = 'rgba(184,154,78,0.5)'; g.fillRect(gx + gw * 0.5 - m(0.9), gy + m(1.75), m(1.8), m(0.06));
    // paper taped inside the glass, off square
    const notes = ['E-FILE', 'FAST', 'WALK-IN'];
    g.font = `bold ${m(0.26)}px monospace`;
    notes.forEach((n, i) => {
      const nx = gx + m(0.5) + i * Math.round((gw - m(1.4)) / 3), ny = gy + m(2.0) + (i % 2) * m(0.4);
      g.fillStyle = '#f2ead0'; g.fillRect(nx, ny, m(1.1), m(0.5));
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(nx, ny + m(0.5), m(1.1), m(0.06));
      g.fillStyle = 'rgba(255,255,255,0.35)';                                          // tape at the corners
      g.fillRect(nx - m(0.05), ny - m(0.05), m(0.2), m(0.12));
      g.fillRect(nx + m(0.95), ny - m(0.05), m(0.2), m(0.12));
      g.fillStyle = '#8a2c22'; g.fillText(n, nx + m(0.55), ny + m(0.28));
    });
    // aluminium door, its own reveal, kick plate scuffed
    // where the ROOM says its door is — resolved ONCE, up at the blind run,
    // because the drawn-back panel is placed relative to it and two calls
    // would be two chances to disagree
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = ALU; g.fillRect(dx - m(0.08), gy, dw + m(0.16), gh);
    g.fillStyle = SH; g.fillRect(dx - m(0.08), gy, m(0.08), gh);
    glazed(g, surf, dx, gy + m(0.15), dw, gh - m(0.9), '#3a4038');
    g.fillStyle = BLIND; g.fillRect(dx, gy + m(0.15), dw, gh - m(0.9));
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(dx, gy + m(0.15), dw, gh - m(0.9));
    // the door's transom, landing on the blind head rail that already runs
    // across the glazing at 0.62 — the horizontals run through, so the door
    // belongs to the frontage instead of sitting on it
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(dx, gy + m(0.62), dw, Math.max(1, m(0.08)));
    g.fillStyle = ALU; g.fillRect(dx, gy + m(0.70), dw, 1);
    g.fillStyle = '#6e726e'; g.fillRect(dx, gy + gh - m(0.75), dw, m(0.75));           // kick plate
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.75), dw, m(0.06));
    g.fillStyle = GOLD; g.fillRect(dx + dw - m(0.22), gy + m(1.5), m(0.08), m(0.3));   // handle
    // stallriser: painted board, PANELLED, grubby at the pavement.
    // The panelling is the gap the user's facade request is really about — the
    // block default has had a panelled stallriser all along and the three
    // fronts the user named by name did not, so the shops that are supposed to
    // have a character were carrying LESS built detail than the quiet barber
    // next door. Grooves rather than the default's, because this is a painted
    // timber board and that one is not.
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#6a665e');
    g.fillStyle = 'rgba(0,0,0,0.24)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.6));
    for (let i = 1; i < panels; i++) {
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.1), Math.max(1, m(0.08)), rh - m(0.2));
    }
    g.fillStyle = 'rgba(30,26,20,0.30)'; g.fillRect(ox, H - m(0.16), ow, m(0.16));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};

/**
 * THE DINER — chrome, glass block and vinyl. The one front on the block with
 * any 1950s left in it, forty years on and grubby with it.
 *
 * Character: everything is a MADE metal part — a stainless fascia with
 * horizontal flutes, a glass-block panel at one end that glows and shows
 * nothing, a counter with stools you can read through the glass, and a chrome
 * kick rail that is the only genuinely shiny thing at street level.
 */
const dinerFront = (brick: string, nm: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf(nm, wM);
  // STEEL is DINER_STEEL, hoisted to module scope so shopfrontRelief's
  // mouldings and this fascia cannot drift to different greys.
  const STEEL = DINER_STEEL, STEEL_D = '#6e747a', CREAM = '#e8e2d2', VINYL = '#8a2f34';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // stainless fascia, fluted — horizontal lines are what read as pressed
    // metal rather than painted board, and they cost two texels each
    const B = BANDS.diner;
    const fy = m(B.fy), fh = m(B.fh);
    proud(g, surf, 0, fy, W, fh, STEEL);
    for (let y = fy + m(0.12); y < fy + fh - m(0.1); y += m(0.16)) {
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, y, W, 1);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y + 1, W, 1);
    }
    g.fillStyle = STEEL_D; g.fillRect(0, fy + fh - m(0.16), W, m(0.16));
    // applied letters: a shadow under them is what makes them sit ON the metal
    g.font = `bold ${m(0.58)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillText(nm, W / 2 + m(0.06), fy + fh / 2 + m(0.08));
    g.fillStyle = VINYL; g.fillText(nm, W / 2, fy + fh / 2);
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#26221c'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    // THE GLASS BLOCK SITS WHERE THE GLAZING IS NOT, and the glazing span is
    // `layoutOf`'s. This used to recompute the block's position and width from
    // scratch — a second place deciding the same fact — and when the room
    // declared its door at the block's end, the block did not know. Reading
    // the published span instead means the two cannot disagree: whichever end
    // is left over IS the block.
    const gy = oy + m(B.gi), gh = oh - m(B.sg);
    const gx = m(F.glazingStartM), gw = m(F.glazingEndM - F.glazingStartM);
    const blockLow = F.glazingStartM > B.ox + 0.5;      // glazing starts late => block precedes it
    const bx0 = blockLow ? ox + m(0.2) : gx + gw + m(DINER_PIER);
    const bx1 = blockLow ? gx - m(DINER_PIER) : ox + ow - m(0.2);
    // THE BLOCK WAS BRIGHTER THAN THE SKY. #b9c4c2 measures luma 203 against a
    // daylight sky at about 163, so a panel that is supposed to be translucent
    // glass read as a lit slab — the single brightest thing on the street, on a
    // block whose whole palette is muted 1997. Moving it to the far end fixed
    // where it was; it did not fix what it looked like, and walking up from the
    // thrift the same white wall was simply waiting at the other end.
    //
    // This is glass block seen from OUTSIDE on an overcast afternoon: green-grey,
    // darker than the sky, lighter at the head where it catches more of it.
    // The value here is MEASURED, not chosen: `scripts/A-diner-block-vs-sky.mjs`
    // reads the block's modal tone off this canvas and the sky off the scene
    // background, and the base colour was set until the first is below the
    // second. My first attempt at it was reasoned rather than measured — I
    // picked a base at luma 151 against a sky I assumed was 163, and the real
    // numbers were a 169 block against a 149 sky, because the per-cell
    // highlight and the room glow below both lift the modal tone well above
    // the base fill. It was still the brightest thing on the street and I
    // would have committed it saying otherwise.
    const BLOCK = '#6f7b76';
    g.fillStyle = BLOCK; g.fillRect(bx0, gy, bx1 - bx0, gh);
    // it is lit from the room behind, so the light falls off downward
    for (let i = 0; i < gh; i++) {
      g.fillStyle = `rgba(206,216,210,${0.12 * (1 - i / gh)})`;
      g.fillRect(bx0, gy + i, bx1 - bx0, 1);
    }
    for (let y = gy; y < gy + gh; y += m(0.42)) {
      for (let x = bx0; x < bx1; x += m(0.42)) {
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, m(0.36), m(0.36));
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + m(0.36), m(0.42), m(0.05));
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + m(0.36), y, m(0.05), m(0.42));
      }
    }
    // grime, heaviest at the foot where the pavement throws it up. Nothing on
    // this street is clean and the block was the one surface pretending to be.
    g.fillStyle = 'rgba(58,54,44,0.20)'; g.fillRect(bx0, gy + gh - m(0.5), bx1 - bx0, m(0.5));
    g.fillStyle = 'rgba(58,54,44,0.12)'; g.fillRect(bx0, gy + gh - m(0.95), bx1 - bx0, m(0.45));
    // THE PIER between block and glazing, so the two panels are separated by
    // something rather than butting up. Two bright neutrals 0.06 m apart read
    // as one slab with a scratch in it, which is what the user was looking at.
    {
      const px = blockLow ? bx1 : gx + gw;
      g.fillStyle = '#2a2620'; g.fillRect(px, gy, m(DINER_PIER), gh);
      g.fillStyle = SH; g.fillRect(px, gy, Math.max(1, m(0.06)), gh);
      g.fillStyle = HI; g.fillRect(px + m(DINER_PIER) - Math.max(1, m(0.06)), gy, Math.max(1, m(0.06)), gh);
    }
    // the window: counter, stools, a row of booths behind
    glazed(g, surf, gx, gy, gw, gh, '#3a2f26');
    g.fillStyle = '#d8b46a'; g.fillRect(gx, gy, gw, m(0.3));                       // warm ceiling
    g.fillStyle = 'rgba(216,180,106,0.28)'; g.fillRect(gx, gy + m(0.3), gw, m(0.55));
    g.fillStyle = CREAM; g.fillRect(gx, gy + m(1.55), gw, m(0.16));                // the counter top
    g.fillStyle = STEEL_D; g.fillRect(gx, gy + m(1.71), gw, m(0.12));
    // UNDER THE COUNTER. This was one flat #1e1a16 across the whole glazing —
    // 7.8 m of it on a 12 m front, the largest single tone on the shop and the
    // third thing measurably wrong with it. It is still dark, because it is the
    // shadow under a counter and a diner window IS dark below the worktop; what
    // it now has is the two things that live down there.
    g.fillStyle = '#1e1a16'; g.fillRect(gx, gy + m(1.83), gw, m(0.55));
    // the counter's own base, kicked back so its toe is in deeper shadow
    g.fillStyle = '#241f19'; g.fillRect(gx, gy + m(1.83), gw, m(0.26));
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(gx, gy + m(2.24), gw, m(0.14));
    // and the chrome foot rail, which is the one thing that catches light under
    // there — it is what makes the row of stools read as a counter you sit at
    g.fillStyle = STEEL_D; g.fillRect(gx, gy + m(2.06), gw, Math.max(1, m(0.09)));
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(gx, gy + m(2.06), gw, 1);
    for (let x = gx + m(0.45); x < gx + gw - m(0.3); x += m(0.85)) {               // stools
      g.fillStyle = VINYL; g.fillRect(x, gy + m(1.34), m(0.34), m(0.22));
      g.fillStyle = STEEL; g.fillRect(x + m(0.13), gy + m(1.56), m(0.08), m(0.5));
      // the pedestal below the seat, and the shadow it drops on the floor
      g.fillStyle = '#15120f'; g.fillRect(x + m(0.13), gy + m(2.15), m(0.08), m(0.23));
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + m(0.04), gy + m(2.33), m(0.26), m(0.05));
    }
    g.fillStyle = '#2a221c';                                                        // booths at the back
    for (let x = gx + m(0.3); x < gx + gw - m(0.6); x += m(1.9)) g.fillRect(x, gy + m(0.85), m(1.1), m(0.5));
    g.fillStyle = 'rgba(216,180,106,0.2)';
    for (let x = gx + m(0.3); x < gx + gw - m(0.6); x += m(1.9)) g.fillRect(x, gy + m(0.85), m(1.1), m(0.06));
    // transom bar over the glazing, set just above the booth backs. Steel,
    // because on this front everything is steel — the same feature the block
    // default has always had, in this shop's own material.
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(gx, gy + m(0.78), gw, Math.max(1, m(0.08)));
    g.fillStyle = STEEL; g.fillRect(gx, gy + m(0.86), gw, 1);
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 3.6)), STEEL_D);
    // door, half-glazed, with a chrome push plate
    // where the ROOM says its door is, falling back to this painter's own
    // layout only if no room has spoken for this frontage
    const dcM = doorAlongU(nm, wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = STEEL_D; g.fillRect(dx - m(0.07), gy, dw + m(0.14), gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(1.0), '#3a2f26');
    // a transom over the door, ON THE SAME LINE as the glazing's. The brief
    // asks for the transom; the alignment is the part that makes it read —
    // a shopfront's horizontals run through, and a door bar at its own
    // arbitrary height is what makes a door look pasted onto a frontage.
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(dx, gy + m(0.78), dw, Math.max(1, m(0.08)));
    g.fillStyle = STEEL; g.fillRect(dx, gy + m(0.86), dw, 1);
    // THE LEAF ITSELF. Its bottom 0.85 m was one flat fill of STEEL with a
    // cream stripe on it, which from the pavement read as a pale grey slab —
    // the weakest thing left on this front after the glass block moved, and
    // conspicuous because it sits dead centre of what you walk up to.
    //
    // An aluminium diner door is not a panel, it is a FRAME: two stiles, a
    // lock rail, a kick plate that has been kicked, and a push bar you can see
    // is a bar. All of that is horizontal banding at 16 px/m, which is exactly
    // what this density can carry — unlike the three stacked letters that had
    // to come off the blade sign.
    const bot = gy + gh - m(0.85);
    g.fillStyle = STEEL; g.fillRect(dx, bot, dw, m(0.85));
    g.fillStyle = HI; g.fillRect(dx, bot, dw, m(0.07));                            // lock rail, lit on top
    g.fillStyle = STEEL_D; g.fillRect(dx, bot + m(0.07), dw, m(0.05));             // and its shadow
    // the stiles: the frame either side, darker than the panel between them
    g.fillStyle = STEEL_D; g.fillRect(dx, gy + m(0.12), Math.max(1, m(0.1)), gh - m(0.12));
    g.fillStyle = STEEL_D; g.fillRect(dx + dw - Math.max(1, m(0.1)), gy + m(0.12), Math.max(1, m(0.1)), gh - m(0.12));
    // kick plate — scuffed, and grubbier at the very bottom where feet reach
    g.fillStyle = '#83888b'; g.fillRect(dx + m(0.06), gy + gh - m(0.42), dw - m(0.12), m(0.36));
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(dx + m(0.06), gy + gh - m(0.42), dw - m(0.12), 1);
    g.fillStyle = 'rgba(34,30,26,0.28)'; g.fillRect(dx + m(0.06), gy + gh - m(0.16), dw - m(0.12), m(0.10));
    // the push bar, across the leaf at hand height, with the shadow that makes
    // it stand off rather than be painted on
    g.fillStyle = CREAM; g.fillRect(dx + m(0.1), gy + m(1.15), dw - m(0.2), m(0.09));
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(dx + m(0.1), gy + m(1.24), dw - m(0.2), m(0.05));
    for (const sx of [dx + m(0.12), dx + dw - m(0.18)]) {                          // its two brackets
      g.fillStyle = STEEL_D; g.fillRect(sx, gy + m(1.10), m(0.06), m(0.19));
    }
    // hours card taped inside the glass, small and off-centre like every one
    g.fillStyle = '#e8e2d2'; g.fillRect(dx + m(0.16), gy + m(0.98), m(0.34), m(0.13));
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx + m(0.16), gy + m(1.11), m(0.34), m(0.03));
    // chrome kick rail — the shiniest thing at street level, and dulled at the
    // very bottom where the pavement throws grit at it
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, STEEL);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(ox, ry + m(0.06), ow, m(0.08));
    // FLUTED, which is what a diner's stainless kick rail actually is — and it
    // is this front's answer to the default's panelled stallriser rather than a
    // copy of it. A flat chrome slab was the laziest surface on the block.
    g.fillStyle = 'rgba(30,26,22,0.20)';
    for (let x = ox + m(0.18); x + m(0.05) < ox + ow - m(0.1); x += m(0.24)) {
      g.fillRect(x, ry + m(0.12), Math.max(1, m(0.05)), rh - m(0.26));
    }
    g.fillStyle = STEEL_D; g.fillRect(ox, ry + rh - m(0.14), ow, m(0.14));
    g.fillStyle = 'rgba(30,26,22,0.34)'; g.fillRect(ox, H - m(0.14), ow, m(0.14));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};

/**
 * THE THRIFT STORE — handwritten card and a window with too much in it.
 *
 * The opposite of the burger barn in every way: nothing here was ordered from
 * a catalogue. A painted board that has faded unevenly, price cards taped up
 * at angles, a window crammed to the glass with mismatched stock, and tape
 * over a crack nobody is going to fix.
 */
const thriftFront = (brick: string, nm: string, awning: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf(nm, wM);
  const BOARD = awning || '#7a5a2c', CARD = '#e4dcc4', INK = '#3a3026';
  const STOCK = ['#7a6a52', '#5a6a72', '#8a5a4a', '#6a7a5a', '#7a5a6a', '#8a7a52'];
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // a painted board, sun-bleached unevenly across its length
    const B = BANDS.thrift;
    const fy = m(B.fy), fh = m(B.fh);
    const bx0 = m(0.25), bw = W - m(0.5);
    proud(g, surf, bx0, fy, bw, fh, BOARD);
    // the bleaching is stepped across the board's OWN width — stepping across
    // the canvas at a fixed pitch overruns onto the brick whenever the board
    // is not a whole number of steps, which is the same fragment-at-the-end
    // fault as the window run above.
    const bleach = Math.max(4, Math.round(bw / m(0.5)));
    for (let i = 0; i < bleach; i++) {
      const x0 = bx0 + Math.round((bw * i) / bleach), x1 = bx0 + Math.round((bw * (i + 1)) / bleach);
      g.fillStyle = `rgba(228,220,196,${0.05 + 0.09 * Math.abs(Math.sin(x0 * 0.021))})`;
      g.fillRect(x0, fy, x1 - x0, fh);
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(m(0.25), fy + fh - m(0.1), W - m(0.5), m(0.1));
    g.font = `bold ${m(0.55)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillText(nm, W / 2 + 1, fy + fh / 2 + 1);
    g.fillStyle = CARD; g.fillText(nm, W / 2, fy + fh / 2);
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#221e18'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, '#332b24');
    // WHERE THE DOOR IS, decided BEFORE the window is dressed.
    //
    // This used to be the last thing painted, stamped over a finished display —
    // which chopped the "50c" card in half and cut the clothes rail through the
    // middle of a hanger. The user's words were "chopped off at points", and a
    // sign cut mid-word by something drawn after it is exactly that. So the
    // doorcase is measured first and the display is dressed in the glass EITHER
    // SIDE of it: nothing is drawn where something else will cover it.
    const dcM = doorAlongU(nm, wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    const dL = dx - m(0.07), dR = dx + dw + m(0.07);          // the doorcase, outside edges
    const runs = ([[gx, Math.min(dL, gx + gw)], [Math.max(dR, gx), gx + gw]] as [number, number][])
      .filter(([a, b]) => b - a >= m(0.6));                   // too narrow to dress is not a run
    const wide = runs.length
      ? runs.reduce((p, c) => (c[1] - c[0] > p[1] - p[0] ? c : p))
      : [gx, gx + gw] as [number, number];

    // CROWDED: racks at the back, furniture and boxes stacked to the glass.
    // The crowding is the character — a tidy thrift window is a lie.
    g.fillStyle = '#c9a45e'; g.fillRect(gx, gy, gw, m(0.22));                        // one bare bulb's worth
    g.fillStyle = 'rgba(201,164,94,0.16)'; g.fillRect(gx, gy + m(0.22), gw, m(0.45));
    g.fillStyle = '#2a2420'; g.fillRect(gx, gy + gh - m(0.28), gw, m(0.28));         // floor
    let seed = 0x2f6a1b;
    const r = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    // GARMENTS. The gap between hangers is counted in TEXELS, not asked for in
    // metres: m(0.30) and m(0.34) BOTH round to 5 px at 16 px/m, so the step
    // equalled the width and the rail came out as one unbroken stripe of
    // colour. That is most of why this window read as painted on rather than
    // stocked — a rounding loss, not a taste.
    const cw2 = Math.max(3, m(0.26)), cstep = cw2 + Math.max(1, m(0.06));
    for (const [a, b] of runs) {
      g.fillStyle = '#4a4038'; g.fillRect(a, gy + m(0.44), b - a, m(0.07));          // the rail itself
      for (let x = a + 2; x + cw2 <= b - 2; x += cstep) {
        const hgt = m(0.9) + Math.round(r() * m(0.35));
        g.fillStyle = STOCK[Math.floor(r() * STOCK.length)];
        g.fillRect(x, gy + m(0.5), cw2, hgt);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, gy + m(0.5), 1, hgt);        // the fold beside it
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + cw2 - 1, gy + m(0.5), 1, hgt);
      }
      for (let x = a + m(0.2); x + m(0.45) <= b - m(0.1); x += m(0.95)) {            // stacked stock below
        const bh2 = m(0.4) + Math.round(r() * m(0.5));
        const bw2 = Math.min(m(0.45) + Math.round(r() * m(0.3)), b - m(0.1) - x);
        g.fillStyle = STOCK[Math.floor(r() * STOCK.length)];
        g.fillRect(x, gy + gh - m(0.25) - bh2, bw2, bh2);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, gy + gh - m(0.25) - bh2, bw2, m(0.06));
      }
    }
    // The price cards are LAID OUT here and drawn further down, so the
    // mannequin can be stood in the gap between two of them. A card taped over
    // its head would hide the only silhouette in the window — which is the
    // same fault as the door chopping the "50c", one layer up.
    const cards: [number, number, string][] = [[0.06, 0.26, '50c'], [0.44, 0.10, 'ALL 1$'], [0.86, 0.34, 'SALE']];
    const cdw = m(1.3), cdh = m(0.6);
    const span = (wide[1] - wide[0]) - cdw - m(0.3);
    const cardX = cards.map(([fx]) => Math.round(wide[0] + m(0.15) + span * fx));
    // A MANNEQUIN, turned away from the glass. The one thing in this window
    // that is a figure and not a rectangle, and the brief asked for it by name.
    // Built as stacked slabs that step sideways going up, which is how you
    // read "at an angle" at 16 px/m — a rotation would just alias.
    {
      // the middle of the widest clear stretch between cards, measured rather
      // than picked: a hand-chosen fraction goes stale the moment a card moves
      const busy = cardX.map((x) => [x, x + cdw]).sort((p, q) => p[0] - q[0]);
      let bestA = wide[0], bestB = wide[0], cur = wide[0];
      for (const [a, b] of [...busy, [wide[1], wide[1]]]) {
        if (a - cur > bestB - bestA) { bestA = cur; bestB = a; }
        cur = Math.max(cur, b);
      }
      const mx = Math.round((bestA + bestB) / 2);
      const foot = gy + gh - m(0.26), coat = '#cbbc9c', skin = '#a98b66';
      const slab = (top: number, hh: number, ww: number, off: number, col: string) => {
        g.fillStyle = col;
        g.fillRect(mx - Math.round(ww / 2) + off, top, ww, hh);
      };
      const t = (v: number) => foot - m(v);
      // clear the rail and the hangers behind it: a figure standing IN FRONT
      // of the rack, not another shape in the middle of it
      g.fillStyle = '#241f1a';
      g.fillRect(mx - m(0.36), t(1.78), m(0.76), m(1.78));
      slab(t(0.80), m(0.80), m(0.50), 0, coat);                 // skirt, widest at the hem
      slab(t(1.10), m(0.30), m(0.40), 1, coat);                 // waist
      slab(t(1.36), m(0.26), m(0.46), 2, coat);                 // chest and shoulders
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(mx - m(0.23) + 2, t(1.36), Math.max(1, m(0.06)), m(0.26));
      slab(t(1.44), m(0.08), m(0.14), 3, skin);                 // neck
      slab(t(1.66), m(0.22), m(0.22), 3, skin);                 // head
      g.fillStyle = 'rgba(0,0,0,0.30)';                          // the stand it is bolted to
      g.fillRect(mx - 1, t(0.80) + m(0.80), Math.max(1, m(0.07)), m(0.26));
    }
    // hand-lettered price cards taped INSIDE the glass, none of them straight.
    // Laid out above; drawn here, along the DISPLAY RUN and clamped to it, so
    // no card can slide under the doorcase and be read as half a word.
    g.font = `bold ${m(0.3)}px monospace`;
    for (let i = 0; i < cards.length; i++) {
      const [, fy2, txt] = cards[i];
      if (span < 0) break;
      const cx = cardX[i];
      const cy = gy + Math.round((gh - cdh - m(0.4)) * fy2);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx + m(0.06), cy + m(0.08), cdw, cdh);
      g.fillStyle = CARD; g.fillRect(cx, cy, cdw, cdh);
      g.fillStyle = 'rgba(255,255,255,0.30)';                                        // tape, one corner only
      g.fillRect(cx - m(0.06), cy - m(0.06), m(0.28), m(0.14));
      g.fillStyle = INK; g.fillText(txt, cx + cdw / 2, cy + cdh / 2);
    }
    // price stickers stuck straight on the glass, the way a shop with no
    // window dresser does it
    for (let i = 0; i < 7; i++) {
      const sx = Math.round(wide[0] + m(0.2) + r() * ((wide[1] - wide[0]) - m(0.5)));
      const sy = gy + m(0.3) + Math.round(r() * (gh - m(1.0)));
      g.fillStyle = '#e8dfc2'; g.fillRect(sx, sy, m(0.22), m(0.16));
      g.fillStyle = INK; g.fillRect(sx + 1, sy + 1, Math.max(1, m(0.08)), 1);
    }
    // TRANSOM over the glazing, then the bars that divide it. The block
    // default has had a transom all along; this front — one of the four the
    // user asked to be BETTER than the default — did not, and that gap is the
    // "lazy" half of the complaint stated exactly.
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(gx, gy + m(0.98), gw, Math.max(1, m(0.09)));
    g.fillStyle = HI; g.fillRect(gx, gy + m(1.07), gw, 1);
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 4.5)), '#4a4038');
    // Tape over a crack, nobody is fixing it. It now STARTS on the transom and
    // DIES on the cill — both ends used to stop in open glass, which is a
    // feature cut rather than terminated.
    g.strokeStyle = 'rgba(226,220,204,0.5)'; g.lineWidth = Math.max(1, m(0.07));
    g.beginPath();
    const kx = wide[0] + (wide[1] - wide[0]) * 0.34;
    g.moveTo(kx, gy + m(1.02));
    g.lineTo(kx + m(0.4), gy + gh * 0.6);
    g.lineTo(kx + m(0.15), gy + gh);
    g.stroke();
    // ── the doorcase: a transom light over the leaf, and a handle ────────────
    g.fillStyle = '#4a4038'; g.fillRect(dL, gy, dR - dL, gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.95), '#332b24');
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(dx, gy + m(0.62), dw, Math.max(1, m(0.07)));
    g.fillStyle = HI; g.fillRect(dx, gy + m(0.69), dw, 1);
    g.fillStyle = '#5a4e42'; g.fillRect(dx, gy + gh - m(0.8), dw, m(0.8));
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.8), dw, m(0.06));
    g.fillStyle = '#8a7a52'; g.fillRect(dx + dw - m(0.22), gy + m(1.5), m(0.08), m(0.26));
    // OPEN, hung on the glass, because a thrift store tells you so on a card
    g.fillStyle = CARD; g.fillRect(dx + m(0.18), gy + m(0.86), m(0.66), m(0.3));
    g.fillStyle = INK; g.fillRect(dx + m(0.24), gy + m(0.97), m(0.54), Math.max(1, m(0.07)));
    // ── the stallriser: panelled and grubby, not a flat slab ─────────────────
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#5e5142');
    g.fillStyle = 'rgba(0,0,0,0.26)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.5));
    for (let i = 1; i < panels; i++) {
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.1), Math.max(1, m(0.09)), rh - m(0.2));
    }
    g.fillStyle = 'rgba(28,24,18,0.34)'; g.fillRect(ox, H - m(0.2), ow, m(0.2));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 5));
  });
};

// one 64px tile ≈ 3.4 m × 4.5 m of road; callers pass the plane size in
// metres so the grain stays square instead of smearing on wide/short planes.
export function asphaltTex(wMeters = 10, dMeters = 134): THREE.Texture {
  const t = pixTex(64, 64, (g) => {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 64, 64);
    dither(g, 64, 64, 900);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(4, 60); g.lineTo(30, 30); g.lineTo(28, 8); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.random() * 60, Math.random() * 60, 4, 3);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, Math.round(wMeters / 3.4)), Math.max(1, Math.round(dMeters / 4.5)));
  return declareSurface(t, 'ground');
}

// the sprite tree — a painted cutout that turns to face you, Quake-style.
//
// The crown is WIDER than the walk on purpose: a real street tree's canopy
// overhangs the kerb and the road. It clears head height, and collision is
// trunk-only, so the sidewalk stays as walkable as it was — the crown is
// allowed to be generous because you walk *under* it.
export const TREE_W = 60;   // texels; × TREE_PX(0.05) = 3.0 m of sprite

// TWO HARD LIMITS, both learned the hard way — keep them when tuning:
//
//  1. Painted canopy half-width must stay under 1.45 m. The trunk sits at
//     x = ±5.4 and the building facade is at x = ±7.0, so anything wider
//     punches into the wall and the crown gets clipped (this is what "the
//     tree in front of ARCADE is cut off" was).
//  2. Crown bottom must stay above ~2.2 m so you walk under it. The crown
//     occupies texels 0…(cy+RY), so H must be at least (cy+RY)+44.
//
// Hence a crown that is WIDE but SHALLOW — a broad shallow canopy, which is
// also what a limbed-up street tree actually looks like. Making it rounder
// either eats head height or hits the wall.
export function treeSprite(v: number, H = 96): THREE.Texture {
  let s = Math.imul(v + 1, 2654435761) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const PAL = [
    ['#2e5a30', '#25482a', '#3f7038'],
    ['#425c2e', '#364c26', '#527038'],
    ['#38562f', '#2a4326', '#4a6c36'],
    ['#2b5236', '#22412c', '#3a6a42'],
  ][v % 4];
  const cx = TREE_W / 2;
  const cy = 20 + Math.floor(r() * 5);          // crown centre, high on the sprite
  const RX = 23 + Math.floor(r() * 7);          // 1.15–1.45 m: wide…
  const RY = 16 + Math.floor(r() * 6);          // …but shallow, so heads clear it
  const lobes = 5 + Math.floor(r() * 3);
  return declareSurface(pixTex(TREE_W, H, (g) => {
    // trunk runs from inside the crown to the ground, so no gap ever shows
    const tTop = cy + RY - 4;
    g.fillStyle = '#4a3626'; g.fillRect(cx - 3, tTop, 6, H - tTop);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx - 3, tTop, 2, H - tTop);

    // A crown is ONE IRREGULAR MASS, not a bunch of balls. The previous
    // version drew separate round clumps and it read as broccoli — "this is
    // not toon town". Depth comes from SHADING INSIDE the mass and from a
    // RAGGED OUTLINE, never from readable circles.
    const DARK = PAL[1], MID = PAL[0], LIT = PAL[2];
    const ell = (x: number, y: number, rx: number, ry: number, col: string) => {
      g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    };
    // one branch reaching up inside, glimpsed through the gaps
    g.fillStyle = '#4a3626'; g.fillRect(cx - 1, cy - 2, 2, RY + 3);

    // base mass
    ell(cx, cy, RX, RY, MID);
    // heavily OVERLAPPING bulges just inside the rim — they deform the
    // silhouette without ever reading as separate blobs
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + r() * 0.5;
      const d = 0.72 + r() * 0.20;
      ell(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d,
          RX * (0.26 + r() * 0.12), RY * (0.28 + r() * 0.13), MID);
    }
    // Ragged edge: bite notches out of the OUTLINE so it is never smooth.
    //
    // These used to be centred at 0.94R–1.16R, and a notch of up to 3.2 px
    // radius centred at 0.94R reaches well inside the crown — so the pass
    // that was meant to rough up the silhouette was punching alpha-0 through
    // the mass. board() uses alphaTest 0.5, a hard cutout, so every one of
    // those was a hole you could read a window through. Centres now start AT
    // the full radius, which keeps the silhouette ragged and leaves the
    // interior alone. More of them, and more varied, to make up the liveliness.
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 + r() * 0.32;
      const d = 1.0 + r() * 0.14;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d,
                1 + r() * 2.4, 1 + r() * 2.2, 0, 0, Math.PI * 2);
      g.fill();
    }
    // The three "real sky holes, well inside the mass" that used to sit here
    // at 0.25R–0.60R are gone. They were the DEEPEST holes — measured as far
    // in as 0.41R — and they are the ones you read brick through. Sky between
    // branches is a fair thing to want, but at 60 px across a crown it lands
    // as a couple of wrong-coloured specks, not as sky. The gaps in the rim
    // carry that job now.
    g.restore();

    // shading INSIDE the mass — an uneven underside in shadow, an uneven
    // top catching light. Irregular boundaries, so no band ever reads as a
    // stripe and no patch ever reads as a ball.
    for (let i = 0; i < 9; i++) {
      const t = (i / 8) - 0.5;
      ell(cx + t * RX * 1.5, cy + RY * (0.42 + r() * 0.22), RX * 0.30, RY * 0.26, DARK);
    }
    for (let i = 0; i < 7; i++) {
      const t = (i / 6) - 0.55;
      ell(cx + t * RX * 1.2, cy - RY * (0.40 + r() * 0.18), RX * 0.26, RY * 0.20, LIT);
    }

    // A LOWER TUFT — a small bushel further down the trunk, offset to one
    // side. The side branch carrying it is deliberately NOT drawn: the eye
    // infers it, and drawing a twig at this texel size just makes a smudge.
    // Not every tree gets one, and a few get two, so the row down the block
    // does not repeat.
    const tufts = r() < 0.30 ? 0 : (r() < 0.78 ? 1 : 2);
    for (let t = 0; t < tufts; t++) {
      const side = r() < 0.5 ? -1 : 1;
      const ty = cy + RY + 9 + Math.floor(r() * 7) + t * 11;
      // Hug the trunk. At the old offset (0.34-0.60 of RX) a tuft's inner
      // edge could sit ~11 texels clear of the trunk and read as a bush
      // hovering in mid-air. This range guarantees it always overlaps.
      const tx = cx + side * (RX * (0.15 + r() * 0.15));
      const trx = RX * (0.23 + r() * 0.10), try_ = RY * (0.21 + r() * 0.09);
      ell(tx, ty, trx, try_, MID);
      ell(tx + side * trx * 0.3, ty + try_ * 0.35, trx * 0.62, try_ * 0.6, DARK);
      ell(tx - side * trx * 0.25, ty - try_ * 0.4, trx * 0.5, try_ * 0.42, LIT);
      // Same ragged treatment as the crown so it belongs to the same tree —
      // INCLUDING the rim constraint, which the crown got and this did not.
      //
      // The user's report was "tree looks transparent in parts that probably
      // shouldn't be transparent", and the crown's notches were duly moved out
      // to `1.0 + r() * 0.14` so they only bite the outline. These were left at
      // 0.92, and a tuft is SMALL: at trx ≈ 8 texels a notch centred at 0.92
      // with its own radius of up to 2.2 reaches 5.2 texels in, well inside the
      // shape, and punches alpha-0 straight through it. Same bug, same fix, one
      // object smaller — which is exactly why it survived the first pass.
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + r() * 0.4;
        g.beginPath();
        g.ellipse(tx + Math.cos(a) * trx * (1.0 + r() * 0.14),
                  ty + Math.sin(a) * try_ * (1.0 + r() * 0.14),
                  0.9 + r() * 1.3, 0.9 + r() * 1.2, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      // a few leaf specks so it reads as foliage, not a green pebble
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random();
        g.fillStyle = Math.random() < 0.5 ? 'rgba(206,224,148,0.45)' : 'rgba(12,28,12,0.35)';
        g.fillRect(Math.floor(tx + Math.cos(a) * rr * trx * 0.85),
                   Math.floor(ty + Math.sin(a) * rr * try_ * 0.85), 2, 2);
      }
    }

    // fine leaf speckle, kept inside the crown
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random();
      g.fillStyle = Math.random() < 0.5 ? 'rgba(206,224,148,0.50)' : 'rgba(12,28,12,0.40)';
      g.fillRect(Math.floor(cx + Math.cos(a) * rr * RX * 0.92),
                 Math.floor(cy + Math.sin(a) * rr * RY * 0.92), 2, 2);
    }

    // SEAL ANY ENCLOSED TRANSPARENT REGION. The queue offered two fixes for
    // the see-through crowns — constrain the notches to the rim, or re-fill
    // the interior afterwards — and only the first was done. It is not
    // sufficient, and the reason is geometric rather than a missed case:
    // moving a notch centre out to 1.0R still lets a notch up to 3.4 texels
    // across eat into the rim, and the overlapping bulges either side of it
    // can close that bay off. A bite that gets sealed at its mouth IS a hole,
    // however conservatively it was aimed. Measured after the rim fix, with
    // the tufts corrected too: 303 enclosed texels still spread over all 11
    // crowns.
    //
    // Ragged and holed are not a matter of degree, they are a matter of
    // TOPOLOGY: a bite is connected to the outside and a hole is not. So flood
    // the outside and fill whatever it cannot reach. The silhouette keeps
    // every notch; only the pockets close. ~6k texels a sprite, at build time.
    {
      const im = g.getImageData(0, 0, TREE_W, H);
      const d = im.data, N = TREE_W * H;
      const out = new Uint8Array(N);
      const st: number[] = [];
      for (let x = 0; x < TREE_W; x++) { st.push(x, x + (H - 1) * TREE_W); }
      for (let y = 0; y < H; y++) { st.push(y * TREE_W, TREE_W - 1 + y * TREE_W); }
      while (st.length) {
        const i = st.pop() as number;
        if (out[i] || d[i * 4 + 3] !== 0) continue;
        out[i] = 1;
        const x = i % TREE_W, y = (i / TREE_W) | 0;
        if (x > 0) st.push(i - 1);
        if (x < TREE_W - 1) st.push(i + 1);
        if (y > 0) st.push(i - TREE_W);
        if (y < H - 1) st.push(i + TREE_W);
      }
      // MID, so a sealed pocket reads as the mass it was cut out of. The
      // speckle above has already run, so these come back plain — which is
      // right: they are small, and a filled pocket that is also the only
      // speckle-free patch would just be a different artefact.
      const [mr, mg, mb] = [MID.slice(1, 3), MID.slice(3, 5), MID.slice(5, 7)]
        .map((h) => parseInt(h, 16));
      for (let i = 0; i < N; i++) {
        if (d[i * 4 + 3] !== 0 || out[i]) continue;
        d[i * 4] = mr; d[i * 4 + 1] = mg; d[i * 4 + 2] = mb; d[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    }
  }), 'foliage');
}

// the pit replaces a 2×2 block of sidewalk slabs: concrete rim at slab
// tone, joint shadows on the edges, soil inset — it FITS the grid
export function treePitTex(): THREE.Texture {
  return declareSurface(pixTex(38, 38, (g) => {
    g.fillStyle = '#84817a'; g.fillRect(0, 0, 38, 38);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 38, 1); g.fillRect(0, 37, 38, 1);
    g.fillRect(0, 0, 1, 38); g.fillRect(37, 0, 1, 38);
    g.fillStyle = '#3e2f20'; g.fillRect(4, 4, 30, 30);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(4, 4, 30, 2); // soil sits low
    for (let i = 0; i < 80; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#4a3826' : '#30241a';
      g.fillRect(4 + Math.floor(Math.random() * 29), 5 + Math.floor(Math.random() * 28), 2, 1);
    }
  }), 'ground');
}

// ── the entrance bay ──────────────────────────────────────────────────────
// The span of residential ground floor reserved for the front door and its
// furniture. resGroundTex keeps the window rhythm OUT of it and paints a
// narrow stone doorcase in the middle; ct/apartment.ts hangs the door,
// transom, buzzer and stoop inside it. Both sides read these same numbers —
// that is the whole point of the constant.
//
// Before this existed the windows tiled at a fixed pitch straight down the
// middle of the facade and the entrance props were positioned independently,
// so the buzzer sat on a window pane and the nameplate ran behind the door
// frame with its last letter clipped off. Nothing knew about anything else.
//
// Datum: y is metres above the base of the ground-floor band (the shop box
// spans world y 0…3.2, so these are world heights too). The sidewalk top is
// at y = KERB_H = 0.14. Widths are metres either side of the door centreline.
//
// COUPLING, and it is load-bearing: the bay is centred on the BUILDING, so
// ct/apartment.ts's DOOR_Z must equal the residential building's centre z.
// It does (No. 227 is 18 m wide with its centre at z = -44, laid out by
// ct/street.ts's EAST roster). Move the building and the door moves with it.
export const ENTRANCE = {
  /** reserved span, centred on the building: no window may enter it. The
   *  brick runs straight through — reserving the span is a LAYOUT act, not
   *  a paint act. (It was briefly painted as one big pale stone panel. It
   *  read as a blank slab pasted onto the building; the brick belongs.)
   *  4 m, down from 5: the nameplate that used to need the extra room is
   *  gone, and only the narrow buzzer panel hangs on the brick now. */
  BAY_W: 4.0,
  /** the dark doorway opening — 14 texels at 8 px/m */
  OPEN_W: 1.75,
  /** the limestone doorcase, outer edge to outer edge: a narrow frame that
   *  hugs the door and transom, 3 texels of stone down each side */
  CASE_W: 2.5,
  /** opening head and threshold; the threshold is the top of the stoop */
  OPEN_TOP: 2.9,
  OPEN_BOT: 0.3,
  /** centre of the buzzer panel, offset from the door centreline — out on
   *  the brick, clear of the doorcase, well inside the reserved span */
  FURN_C: 1.55,
  /** the ground-floor band's height — what converts metres to texels */
  BAND_H: 3.2,
} as const;

// residential ground floor — brick continues to the street, barred windows
// built into the wall (stone lintel over, stone sill under), no shop band:
// the walk-up's own face. The middle of the facade is given over to the
// stone entrance bay; the windows are laid out symmetrically in the two
// panels either side of it and never enter it.
//
// Pass bayW = 0 for a residential ground floor with no street door — the
// window rhythm then runs evenly across the whole width.
export function resGroundTex(brick: string, wMeters = 12, bayW = ENTRANCE.BAY_W): THREE.Texture {
  // same 2× masonry density as the shopfront band it sits in line with — this
  // face carries the doorcase's stone arrises and the window bars, which are
  // one-texel features, so it earns the extra multiple the same way
  const surf = masonry(wMeters, ENTRANCE.BAND_H, 0, SHOP_MULT);
  const { W, H, ppm } = surf;
  const ppmX = ppm, ppmY = ppm;
  const m = (v: number) => Math.round(v * ppm);        // metres → texels
  /** metres DOWN from the top of the band → canvas y */
  const ty = (v: number) => Math.round(v * ppm);
  // limestone that reads as STONE against brick, not as bare canvas: warm,
  // a shade darker than the kerb so it never goes near white, and the same
  // family as the window sills facadeTex uses on the floors above (#9a8a72)
  const STONE = '#8b8272', STONE_HI = '#9a9080', STONE_LO = '#6b6355', DARK = '#141820';
  // the bay, snapped to whole texels and forced symmetric (bx1 = W - bx0) so
  // its jambs line up with the door ct/apartment.ts hangs between them
  const bay = Math.min(Math.round(W * 0.55), Math.round(bayW * ppmX));
  const hasBay = bayW > 0 && bay >= 8;
  const bx0 = hasBay ? Math.round((W - bay) / 2) : -1, bx1 = W - bx0;
  // window rhythm: as many as fit the panel with at least a pier's worth of
  // brick between them and at each end, then spread the slack evenly
  const winW = Math.max(6, Math.round(1.5 * ppmX));
  const pierMin = Math.max(4, Math.round(1.0 * ppmX));
  const panel = (x0: number, x1: number): number[] => {
    const span = x1 - x0;
    const n = Math.floor((span - pierMin) / (winW + pierMin));
    if (n < 1) return [];
    const pier = (span - n * winW) / (n + 1);
    return Array.from({ length: n }, (_, i) => Math.round(x0 + pier * (i + 1) + winW * i));
  };
  const wins = hasBay ? [...panel(0, bx0), ...panel(bx1, W)] : panel(0, W);
  // window opening, in metres down from the band's top edge
  const LINT_Y = 0.6, LINT_H = 0.2, REV_Y = 0.8, REV_H = 1.4;
  const GLASS_Y = 0.9, GLASS_H = 1.2, SILL_Y = 2.2, SILL_H = 0.2;
  const BAR_PITCH = 0.375;   // security bars, on a real pitch not a texel count
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    // this band's foot is world y = 0 too, so it shares the shopfront band's
    // course lines along the block and the wall above continues them
    surf.courses(g);
    for (const wx of wins) {
      g.fillStyle = STONE; g.fillRect(wx - 1, ty(LINT_Y), winW + 2, m(LINT_H));   // lintel
      g.fillStyle = STONE_HI; g.fillRect(wx - 1, ty(LINT_Y), winW + 2, 1);
      g.fillStyle = DARK; g.fillRect(wx, ty(REV_Y), winW, m(REV_H));              // reveal
      g.fillStyle = '#3a4450'; g.fillRect(wx + 1, ty(GLASS_Y), winW - 2, m(GLASS_H)); // glass
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(wx + 1, ty(GLASS_Y), m(0.38), m(GLASS_H));
      // bars on a 0.375 m pitch — a real security-bar spacing, and now it does
      // not change with the canvas the way a fixed 3-texel step did
      g.fillStyle = '#1a1c22';
      for (let bx = wx + m(0.25); bx < wx + winW - 1; bx += m(BAR_PITCH)) g.fillRect(bx, ty(GLASS_Y), Math.max(1, m(0.06)), m(GLASS_H));
      g.fillStyle = STONE; g.fillRect(wx - 1, ty(SILL_Y), winW + 2, m(SILL_H));   // sill
      g.fillStyle = STONE_HI; g.fillRect(wx - 1, ty(SILL_Y), winW + 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(wx - 1, ty(SILL_Y + SILL_H), winW + 2, 1);
    }
    if (hasBay) {
      // The doorcase: a NARROW limestone frame hugging the door and transom,
      // three texels of stone down each side and a lintel over the head —
      // the way a real walk-up dresses its entrance. The brick either side of
      // it is untouched; all the reserved span does is keep windows away.
      const cx0 = Math.round(W / 2 - (ENTRANCE.CASE_W / 2) * ppmX), cx1 = W - cx0;
      const ox0 = Math.round(W / 2 - (ENTRANCE.OPEN_W / 2) * ppmX), ox1 = W - ox0;
      const oy0 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_TOP) * ppmY);
      const oy1 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_BOT) * ppmY);
      g.fillStyle = STONE; g.fillRect(cx0, 0, cx1 - cx0, H);
      // jamb stones, stacked — coursed only inside the two narrow uprights
      g.fillStyle = STONE_LO;
      for (let y = m(COURSE_M); y < H; y += m(COURSE_M)) {   // stone courses on the brick's grid
        g.fillRect(cx0, y, ox0 - cx0, 1); g.fillRect(ox1, y, cx1 - ox1, 1);
      }
      g.fillStyle = STONE_HI;                                            // lit outer arris
      g.fillRect(cx0, 0, 1, H); g.fillRect(ox1, oy0, 1, H - oy0);
      g.fillStyle = 'rgba(0,0,0,0.16)';                                  // shaded inner arris
      g.fillRect(ox0 - 1, oy0, 1, H - oy0); g.fillRect(cx1 - 1, 0, 1, H);
      g.fillStyle = STONE_HI; g.fillRect(cx0, 0, cx1 - cx0, 1);          // lintel top
      // one-texel shadow joint where stone meets brick: a built joint, never
      // a gap you can see the background through
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.fillRect(cx0 - 1, 0, 1, H); g.fillRect(cx1, 0, 1, H);
    }
    dither(g, W, H, Math.round(wMeters * ENTRANCE.BAND_H * 6));
    // The doorway is punched AFTER the grain, and is the only thing that is.
    // dither() sprays white specks over the whole texture; inside the black
    // reveal around the door leaf one white texel is the brightest thing in
    // frame and reads as a stuck pixel. Nothing in a doorway catches light.
    if (hasBay) {
      const ox0 = Math.round(W / 2 - (ENTRANCE.OPEN_W / 2) * ppmX), ox1 = W - ox0;
      const oy0 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_TOP) * ppmY);
      const oy1 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_BOT) * ppmY);
      g.fillStyle = DARK; g.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
      g.fillStyle = 'rgba(0,0,0,0.45)';                                  // shadow cast into it
      g.fillRect(ox0, oy0, 1, oy1 - oy0); g.fillRect(ox0, oy0, ox1 - ox0, 1);
    }
  });
}

export function hydrantSprite(): THREE.Texture {
  return declareSurface(pixTex(32, 48, (g) => {
    g.fillStyle = '#8a2c22';
    g.fillRect(12, 14, 8, 30);
    g.fillRect(8, 22, 16, 6);
    g.fillStyle = '#a83a2e';
    g.fillRect(12, 14, 3, 30);
    g.fillRect(11, 10, 10, 6);
    g.fillStyle = '#6a2018';
    g.fillRect(13, 44, 7, 2);
    dither(g, 32, 48, 60);
  }), 'detail');
}

export function pigeonSprite(): THREE.Texture {
  return declareSurface(pixTex(24, 24, (g) => {
    g.fillStyle = '#6a6e78';
    g.beginPath(); g.arc(12, 15, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4e58';
    g.beginPath(); g.arc(17, 10, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a45e';
    g.fillRect(20, 10, 3, 1);
    g.fillStyle = '#3a3e46';
    g.fillRect(6, 13, 6, 4);
  }), 'detail');
}

export function payphoneTex(): THREE.Texture {
  return declareSurface(pixTex(32, 64, (g) => {
    g.fillStyle = '#2c4a7a'; g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText('PHONE', 16, 9);
    g.fillStyle = '#8a8e94'; g.fillRect(2, 12, 28, 52);
    g.fillStyle = '#141820'; g.fillRect(6, 16, 20, 26);
    g.fillStyle = '#1c1e24'; g.fillRect(10, 46, 12, 14);
    dither(g, 32, 64, 60);
  }), 'detail');
}

// ── street litter ──────────────────────────────────────────────────────────
// Sparse gutter debris. Deliberately small and few: the note was "just trying
// to add detail and realism. dont go over board."

// A crushed can, drawn TOP-DOWN because it lies on the road as a flat decal.
// It must NOT be a billboard: billboards rotate to face the camera, so a can
// drawn in side view stands up on end as a flat card the moment you look down
// at it. Anything lying on the ground gets drawn from above.
export function canTopTex(v: number): THREE.Texture {
  const cols = ['#b8342a', '#2c6a8a', '#c9a02a', '#4a7a3a'];
  const c = cols[v % cols.length];
  return declareSurface(pixTex(24, 14, (g) => {
    // A can this size is only ~10 screen pixels, so the SILHOUETTE has to do
    // all the work: hard dark outline all round, label band centred with
    // equal aluminium ends, ribbing to say "cylinder". Without the outline it
    // read as an unidentifiable yellow-and-white wedge.
    g.fillStyle = '#16181c'; g.fillRect(1, 2, 22, 10);            // outline
    g.fillStyle = '#c2c6ca'; g.fillRect(2, 3, 20, 8);             // bare aluminium
    g.fillStyle = c; g.fillRect(7, 3, 10, 8);                     // label, centred
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillRect(2, 3, 20, 1);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(2, 10, 20, 1);
    g.fillStyle = '#8f9296';                                      // end rims
    g.fillRect(2, 3, 1, 8); g.fillRect(4, 3, 1, 8);
    g.fillRect(19, 3, 1, 8); g.fillRect(21, 3, 1, 8);
    g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(11, 3, 1, 8);    // crush crease
    g.fillStyle = 'rgba(0,0,0,0.40)'; g.fillRect(3, 12, 18, 1);   // contact shadow
  }), 'detail');
}

// Paper trash: flyers, handbills, folded sheets — gone soft and grey in the
// wet. Not "a newspaper": the note was "like paper. like flyers and stuff.
// folded paper trash wet from rain".
// Gutter paper is NOT newsprint-white. It has been rained on, walked on and
// ground into the road; it sits only a little lighter than wet asphalt.
export function paperTex(v: number): THREE.Texture {
  return declareSurface(pixTex(22, 16, (g) => {
    const k = v % 4;
    if (k === 0) {          // flyer, headline block + columns, half soaked
      g.fillStyle = '#8f8b7e'; g.fillRect(1, 1, 20, 14);
      g.fillStyle = '#5f5c52'; g.fillRect(1, 9, 20, 6);           // wet half, darker
      g.fillStyle = '#4e4c46'; g.fillRect(3, 3, 14, 3);           // headline bar
      for (let y = 8; y < 14; y += 2) g.fillRect(3, y, 9, 1);
    } else if (k === 1) {   // folded in half — a crease and a lifted edge
      g.fillStyle = '#8a8579'; g.fillRect(2, 3, 18, 11);
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(10, 3, 1, 11); // fold crease
      g.fillStyle = '#6f6b60'; g.fillRect(11, 3, 9, 11);          // far leaf in shade
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(2, 13, 18, 1);
    } else if (k === 2) {   // pulpy, soaked through, edges gone dark and curled
      g.fillStyle = '#6e6a5f'; g.fillRect(2, 2, 18, 12);
      g.fillStyle = '#4e4b43'; g.fillRect(2, 2, 18, 3);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(2, 11, 18, 3);
      g.fillStyle = '#5c584f'; g.fillRect(5, 6, 12, 3);
    } else {                // torn handbill, one ragged edge
      g.fillStyle = '#8b8578'; g.fillRect(3, 2, 16, 12);
      g.fillStyle = '#636057'; g.fillRect(3, 2, 3, 12);
      g.fillStyle = '#54524c'; for (let y = 5; y < 13; y += 3) g.fillRect(7, y, 9, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, 13, 16, 1);
    }
    dither(g, 22, 16, 20);
  }), 'detail');
}

// nondescript flattened scraps — wrappers, cup, cardboard
export function scrapTex(v: number): THREE.Texture {
  return declareSurface(pixTex(14, 12, (g) => {
    const pal = [['#c9c2b2', '#a09884'], ['#8a6a4a', '#6a4f38'], ['#c0b0a0', '#93857a']][v % 3];
    g.fillStyle = pal[0]; g.fillRect(2, 3, 10, 7);
    g.fillStyle = pal[1]; g.fillRect(2, 8, 10, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, 10, 10, 1);
    dither(g, 14, 12, 14);
  }), 'detail');
}
