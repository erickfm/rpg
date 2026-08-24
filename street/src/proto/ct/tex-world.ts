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
/**
 * SOOTED BRICK — the world's one bond, at a much lower key.
 *
 * Asked for by C, for the light well in `ct/apartment.ts`: that wall paints a
 * private 32x32 tile at a guessed 1.15 m repeat because `masonry()` had no way
 * to do a dark wall, and C will drop the private tile once this exists. The
 * request was precise about what it does and does not fix — the well's stripe
 * fault was an overlay painted ON TOP of a correct bond, not a bond error — so
 * this is about getting the well onto the world's one density, not about that
 * bug.
 *
 * The missing piece was never the brick colour, which a caller could always
 * fill for itself. It was the JOINT. `courses()` hard-coded
 * `rgba(0,0,0,0.22)`, and on a wall painted at a third of the street's key a
 * black joint is both invisible and backwards: soot settles on the exposed
 * brick FACES, and the recessed mortar keeps some of its lime, so pointing in a
 * tenement well reads LIGHTER than the brick around it. Painting it darker is
 * why a low-key wall done with the shared bond has always looked wrong, and
 * why anyone trying it goes back to a private tile.
 *
 * So the joint is now an argument, defaulted to exactly what every existing
 * caller already got, and this is the sooted preset over the top of it.
 *
 *     const s = masonry(wM, hM, baseY);
 *     const tex = s.paint((g) => { sootedBrick(g, s); ...streaks, stains... });
 *
 * The caller still owns everything above the bond — the well's streaking and
 * its dark far window are C's and are not moved here.
 */
export function sootedBrick(
  g: CanvasRenderingContext2D,
  surf: { W: number; H: number; courses: (g: CanvasRenderingContext2D, joint?: string) => void },
  base = '#3a2a25',
) {
  g.fillStyle = base;
  g.fillRect(0, 0, surf.W, surf.H);
  // pale, and weak — pointing seen through soot is a hint of a line, not a
  // grid. At 0.14 it survives on a #3a2a25 field and disappears on a lit one,
  // which is the right way round for a wall nothing shines on.
  surf.courses(g, 'rgba(198,188,170,0.14)');
}

/**
 * THE ROUNDING RULE, ruled by the desk on 2026-07-25 and published here as that
 * ruling asked: **fix the DENSITY, accept a fractional canvas rounded to whole
 * texels.**
 *
 * Density is the invariant this world is authored against — 8 px/m walls,
 * 32 px/m ground, 19-27 px/m interior floors — and the canvas is only where
 * that density happens to land. So `ppm` is held exactly and `W`/`H` absorb
 * the remainder. Never the other way round: nudging the density to make a
 * canvas come out whole is what breaks a bond across a party wall, because the
 * neighbour nudged differently.
 *
 * H shipped the vehicle density pass on this rule (every vertical face on
 * every vehicle at 32 px/m with square texels) and the desk confirmed H's rule
 * rather than mine so that landed, user-visible work would not be re-done to
 * satisfy a helper. Measured, this helper already rounded that way — no change
 * was needed, only the writing-down.
 *
 * WHAT THE REMAINDER COSTS, measured across all 210 masonry textures:
 *
 *     achieved density == declared exactly   38 of 210
 *     worst drift                            0.211 px/m  (0.95 m face at 16 -> 15 px)
 *     worst drift as a share of declared     1.79%
 *
 * I FIRST WROTE THAT THIS ENDANGERED `scripts/density.mjs`, whose tolerance is
 * 2%, and that was wrong. That check compares METRES TO METRES —
 * `|face/repeat - wMeters| / wMeters` — and canvas rounding does not appear in
 * that expression at all, so it contributes exactly nothing to it and no face
 * can be pushed red by rounding however unlucky. I took the claim from
 * density.mjs's own comment, which says its 2% "absorbs the canvas rounding
 * masonry() does"; that comment is wrong in the same way and is corrected in
 * the same commit as this.
 *
 * `ppmW`/`ppmH` are still worth stamping, for the reason that survives: `ppm`
 * is what was ASKED FOR and they are what the whole-texel canvas ACHIEVED, so
 * anything measuring real density off a mesh has the intended and the achieved
 * value side by side instead of inferring one from the other. That is a
 * smaller claim than the one I made and it is the true one.
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
    courses: (g: CanvasRenderingContext2D, joint?: string) => courses(g, W, H, hMeters, baseY, ppm, joint),
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
      // `ppm` is what was ASKED FOR; `ppmW`/`ppmH` are what the whole-texel
      // canvas actually ACHIEVED. They differ by up to 1.79% purely from the
      // rounding the desk's ruling requires. Anything measuring real density
      // off a mesh now has the intended and the achieved value side by side
      // rather than inferring one from the other.
      //
      // NOT because density.mjs is at risk from it — I claimed that and it is
      // false; see the docstring above. That check compares metres to metres
      // and rounding cannot reach it.
      t.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H,
                             ppmW: W / wMeters, ppmH: H / hMeters };
      // and say what it IS, not only how dense it is — see declareSurface().
      // Everything masonry() paints is brick by definition, so this one is free.
      t.userData.surface = 'brick';
      return t;
    },
  };
}

/** lay horizontal course lines on the WORLD-Y grid across a canvas of `hM`
 *  metres whose bottom edge sits at world `baseY`. Returns nothing; draws. */
function courses(g: CanvasRenderingContext2D, W: number, H: number, hM: number, baseY: number, ppm: number,
                 joint = 'rgba(0,0,0,0.22)') {
  const perp = Math.max(1, Math.round(PERP_M * ppm));
  // first course line at or above baseY, walked up in world metres so the
  // bond continues onto whatever is built next door
  const k0 = Math.ceil(baseY / COURSE_M);
  for (let k = k0; (k * COURSE_M - baseY) <= hM; k++) {
    const yW = k * COURSE_M - baseY;              // metres up from the canvas bottom
    const y = Math.round(H - yW * ppm);           // canvas y (0 = top)
    g.fillStyle = joint;
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
  // A showroom is MOSTLY GLASS — that is the whole silhouette of the type, and
  // it is what tells you from across the road that the thing inside is meant to
  // be looked at. So the smallest opening inset on the block (0.30 against the
  // default 0.40), the shallowest sill gap (0.44 against 0.57) so the glass runs
  // nearly to the pavement the way a plate-glass showroom does, and a fascia in
  // between the tax office's banner and the burger barn's box.
  mattress: { fy: 0.10, fh: 0.86, ox: 0.30, og: 0.16, gi: 0.20, sg: 0.44, dw: 1.10 },
  // An electronics shop is a showroom too — the stock is lit and you are meant
  // to look at it — so it borrows the mattress row's shallow sill gap rather
  // than the default 0.57. TVs are stacked from low down; 0.57 of stallriser
  // cuts the bottom row off at the knees.
  electro: { fy: 0.10, fh: 0.92, ox: 0.32, og: 0.16, gi: 0.20, sg: 0.44, dw: 1.05 },
  // The video shop keeps the standard sg = gi + 0.35. Its stock is racked at
  // chest height against the back wall, so it gains nothing from low glass —
  // what it wants is a DEEP fascia, because the sign is the whole shop.
  video: { fy: 0.09, fh: 1.02, ox: 0.38, og: 0.18, gi: 0.22, sg: 0.57, dw: 1.05 },
  // The college is CIVIC, not retail: the fascia band is a cast-stone frieze
  // with the name incised in it, the "glazing" is four sash windows either
  // side of a doorcase, and the door is a 1.2 m double leaf — wider than any
  // shop's because an evening class arrives two abreast. Everything else is
  // the default band so the relief mouldings frame it like its neighbours.
  college: { fy: 0.10, fh: 0.92, ox: 0.40, og: 0.18, gi: 0.22, sg: 0.57, dw: 1.2 },
} as const;
type Character = keyof typeof BANDS;

/** which character a named shop wears — the same dispatch shopfrontTex uses */
function characterOf(name: string): Character {
  if (name === 'DINER') return 'diner';
  if (name === 'THRIFT') return 'thrift';
  if (name === 'BURGER BARN') return 'burger';
  if (name.startsWith('A-1 TAX')) return 'tax';
  if (name === 'PAWN') return 'pawn';
  if (name === 'SLEEP CENTER') return 'mattress';
  if (name === 'VOLT VILLAGE') return 'electro';
  if (name === 'VIDEO HUT') return 'video';
  if (name === 'COMMUNITY COLLEGE') return 'college';
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
    // dead centre, because a campus entrance is AXIAL: the courtyard gate,
    // the path and the doorcase are one line (ct/college-yard.ts walks it)
    k === 'college' ? glazingStartM + gw * 0.5 - dw / 2 :
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

/**
 * WIDTH IS NOT A CONTRACT. `frontageM` is how wide the FACADE is. It is not a
 * size a room has to match, and nothing here asks it to.
 *
 * The desk ruled this on 2026-07-25 (GOTCHAS 45) after enforcing dimensional
 * equality the user never asked for, which cost the bodega, the casino and the
 * hotel their depth — three rooms he then sent back for being cramped. His
 * words: *"by matching the exterior i really mean in general positioning. no
 * one is going to take a ruler and measure the width of the inner and outer"*
 * and *"you can make it wider than it actually is outside too."*
 *
 * What must match is the door's SITUATION — which side it is on. This
 * descriptor delivers that through `alongU()`, a position along the frontage
 * that a room converts into its own local space at its own scale, so the door
 * keeps its side and its proportion whatever width the room takes.
 *
 * Measured, and rooms already exercise it — 0 of 6 match their frontage:
 *
 *     bodega  8.8 m room against a  6.05 m frontage   145%
 *     burger 14.8              16                      93%
 *     pawn   13.8              15                      92%
 *     tax    11.8              13                      91%
 *     thrift 11.3            12.5                      90%
 *     diner  10.8              12                      90%
 *
 * So this needed no change for the ruling; it is written down because the
 * failure the ruling corrects is somebody reading `frontageM` as a target and
 * "fixing" a room to match it. It is a fact about the facade, and rooms are
 * free of it. TAKE THE ROOM YOU NEED.
 */
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
   * else, which is the user's original complaint. SEVENS is in exactly
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
 * DEPTH BUDGET — and the reason it is safe is NOT the one this comment used to
 * give. It said "nothing here projects more than 0.30 m, because ct/street.ts
 * already reserves that — its footprint colliders start at FACE - 0.3". I
 * repeated that for a whole session without checking it. Measured:
 *
 *     footprint collider starts   0.12 m out from the facade plane
 *     deepest relief piece        0.20 m  (the CORNICE)
 *
 * So the deepest pieces DO reach past the collider, and the 0.30 figure is not
 * the reserve. What actually makes this safe is HEIGHT, exactly as the blade
 * sign below argues for itself:
 *
 *     PLINTH  0.09 deep at y 0.06        within the 0.12 collider
 *     CILL    0.11      at y ~0.37       within
 *     JAMB    0.12      at glazing       exactly at the edge
 *     BED     0.13      at y ~3.1        past it, and over your head
 *     CORNICE 0.20      at y ~4.15       past it, and well over your head
 *
 * Every piece a walking player can reach is inside the collider; every piece
 * that exceeds it is above head height. That is a real invariant and it is the
 * one to preserve — so the rule for a new piece is not "keep it under 0.30 m",
 * it is **keep it within 0.12 m if a body can reach it, and any depth you like
 * above about 2.5 m**. GOTCHAS 9: the 2 m walk lane is sacred, and a number
 * quoted from memory is not a clearance.
 *
 * NOT FULLY VERIFIED: the same probe read RADIO's deepest piece as 0.61 m,
 * which no constant here can produce. Three earlier versions of that probe were
 * wrong (they swept in building shells, the 126 m pavement plane, and mouldings
 * from the far side of the street), so I do not trust the outlier and have not
 * filed it as a fault. Worth a look by someone building the probe properly.
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
  const CORNICE_H = 0.10;
  // The top of the projecting cornice — the highest, deepest thing on the
  // frontage, and the ceiling anything else hung on this wall has to clear.
  // Published as a name because the blade below hangs OFF it; two numbers that
  // had to agree by hand is exactly how the blade ended up inside it.
  const corniceTop = fTop + CORNICE_H;
  put(o.wMeters, CORNICE_H, CORNICE, 0, corniceTop - CORNICE_H / 2, mat(tint.clone().multiplyScalar(0.72)));
  put(o.wMeters, 0.07, BED, 0, F.fasciaBottomM - 0.035, mat(tint.clone().multiplyScalar(0.55)));

  // ── THE BOARD ITSELF, at four times the band's density ────────────────────
  //
  // A shop's name is the one thing on this street that has to be READ from the
  // far pavement, and all fifteen of them were being painted onto the 16 px/m
  // brick canvas: a 0.6 m letter is six texels of ink, which is the blur the
  // mattress store got called out for. So the board leaves the wall the same
  // way the Sleep Center's paper did — `fasciaArt` draws it here at 64 px/m,
  // and the painted one underneath, drawn by the same function from the same
  // numbers, is what shows if this plane ever fails to build.
  //
  // 0.03 m PROUD IS IN THE CLEAR, and the geometry above says why: the cornice
  // is 0.20 deep but sits entirely ABOVE `fTop`, the bed mould is 0.13 deep but
  // sits entirely BELOW `F.fasciaBottomM`, and the plane spans exactly between
  // them. It is 3.2 m up, so nothing can walk into it either.
  //
  // NOT the college — `ct/college-yard.ts` already hangs its own frieze plane
  // at this density over that band, and two planes in one place is a z-fight.
  fascia: {
    if (o.name === 'COMMUNITY COLLEGE') break fascia;
    const PX = WALL_PPM * SHOP_MULT;                   // the painted band's density
    const mm = (v: number) => Math.max(v > 0 ? 1 : 0, Math.round(v * PX));
    const bd = fasciaBoardPx(o.name, Math.round(o.wMeters * PX), mm);
    // measured back off the PAINTED canvas's texel grid, so the plane's edges
    // land on the boundaries the painter drew to rather than a fraction beside
    // them and leave a blurred sliver showing round the crisp board
    const bwM = bd.w / PX, bx0M = bd.x / PX;
    const fyM = SHOP_BAND_H - F.fasciaBottomM - F.fasciaH;
    const topM = SHOP_BAND_H - mm(fyM) / PX, fhM = mm(F.fasciaH) / PX;
    // a shell too narrow to carry a board gets none, rather than a one-texel
    // canvas stretched over a negative-width plane
    if (bwM < 0.6 || fhM <= 0) break fascia;
    const doorM = doorAlongU(o.name, o.wMeters, F.doorCentreM) - bx0M;
    const board = sheet(bwM, fhM, (gg, WW, HH) => {
      const s2: Band = { W: WW, H: HH, m: (v) => Math.max(v > 0 ? 1 : 0, Math.round(v * FASCIA_PPM)) };
      fasciaArt(gg, s2, { x: 0, y: 0, w: WW, h: HH, name: o.name, trim: o.trim, doorX: doorM * FASCIA_PPM });
    }, { taped: false, ppm: FASCIA_PPM });
    board.position.set(bx0M + bwM / 2 - half, topM - fhM / 2, 0.03);
    // …and say whether it is a LIGHT or a PAINTED BOARD, rather than leaving
    // props.ts's texture heuristic to decide it from the livery. See LIT_FASCIAS.
    signNight(board, LIT_FASCIAS.has(o.name), o.name);
    g.add(board);
  }

  // ── the glass reveal: jambs each side and a head over, so the glazing
  //    reads as set back behind a frame rather than flush with the brick ─────
  const dark = 0x332e28;
  const gL = along(F.glazingStartM), gR = along(F.glazingEndM);
  const gH = F.glazingTopM - F.glazingBottomM;
  const gMid = (F.glazingBottomM + F.glazingTopM) / 2;
  put(0.14, gH + 0.12, JAMB, gL - 0.07, gMid, mat(dark));
  put(0.14, gH + 0.12, JAMB, gR + 0.07, gMid, mat(dark));
  put(gR - gL + 0.28, 0.13, JAMB, (gL + gR) / 2, F.glazingTopM + 0.06, mat(dark));

  // ── the paper taped inside the glass ──────────────────────────────────────
  // Selected by name, the same dispatch the blade below uses. It is here rather
  // than in the painters because a sign that has to be READ cannot live on a
  // 16 px/m masonry canvas — the note above `sleepWindowSigns` has the numbers.
  // The Sleep Center was first; the other four had the same disease and the
  // same overpainting faults on top of it.
  if (o.name === 'SLEEP CENTER') sleepWindowSigns(g, F, half);
  else if (o.name === 'A-1 TAX') taxWindowSigns(g, F, half);
  else if (o.name === 'VOLT VILLAGE') voltWindowSigns(g, F, half, o.wMeters);
  else if (o.name === 'VIDEO HUT') videoWindowSigns(g, F, half);
  else if (o.name === 'THRIFT') thriftWindowSigns(g, F, half);
  else if (o.name === 'CROSSTOWN FITNESS') gymWindowSigns(g, F, half);

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
  // allowed to be generous because you walk UNDER it." A blade hung over the
  // fascia is that same case: its underside is at 4.36 m, well clear of a
  // standing player, and it adds no collider because nothing can reach it.
  // A real one overhangs the pavement; that IS the feature.
  //
  // Selected by name, the same dispatch shopfrontTex uses — the shopfront
  // system decides how a named shop looks, and giving another shop a blade is
  // a change here and nowhere else.
  //
  // IT HUNG THROUGH THE FASCIA, AND IT HUNG LOW. *"sign is clipping here and a
  // bit low imo"* — and the thing it was clipping is this frontage's OWN
  // projecting joinery, which on the diner is stainless and reads as a metal
  // canopy over the shop. At FOOT 2.45 the plate ran 2.45 → 4.00 m, straight
  // through the BED mould (3.03 → 3.10 m, 0.13 m proud) and on up the fascia to
  // stop 5 mm under the cornice's underside. Two solids sharing a volume, and
  // the top arm threading a 5 mm slot: from the pavement it read as a sign
  // buried in the awning beside it.
  //
  // There is no room to fix that where it stood. Between the mould's top and
  // the cornice's underside is 1.00 m of clear wall and the plate is 1.55 m
  // tall, so anything short of shrinking the sign — which is the artwork, not
  // the placement — has to leave the band. Under the mould means a 1.48 m
  // underside, which is the complaint made worse. So it goes ABOVE, onto the
  // brick, which is where a projecting sign on a building with a fascia is
  // actually bolted.
  //
  // DERIVED OFF `corniceTop`, not typed. The cornice is the deepest thing on
  // this wall and the only one the blade can foul; hanging the blade off its
  // published top means moving the fascia moves the sign with it. The brick it
  // lands on is blank by construction: `facadeTex` puts the first storey's cill
  // SKIRT_M = 2.4 m above the wall's foot, so the plate and its arm sit inside
  // that skirt with 0.59 m of brick still over them.
  if (o.name === 'DINER') {
    const CLEAR = 0.16;                            // brick between cornice and plate
    const PROJ = 0.95, TALL = 1.55, FOOT = corniceTop + CLEAR;   // underside 4.36 m
    // ON THE PARTY LINE WITH THE THRIFT. *"can you put the coffee sign at the
    // border between shops border?"* (2026-08-24). It hung 17% along the
    // frontage — 2 m into the diner's own brick — and the diner's one
    // shop-to-shop border is the low-u edge (u = 0, world z −56, THRIFT on the
    // other side; the high-u end is the park). Centred on the seam, the way a
    // corner blade is actually bolted, so the plate straddles the line by half
    // its 0.08 m thickness. Height is untouched and stays safe by arithmetic:
    // the thrift's corniceTop is 0.01 m LOWER than the diner's (BANDS: fy+fh
    // 1.03 vs 1.10 off the same SHOP_BAND_H), so the blade's foot clears the
    // neighbour's cornice by CLEAR + 0.01, and both facades' first-storey
    // cills sit above the top arm — the skirt band the note above describes
    // runs the full width of both walls.
    const bx = along(0);
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
    // THE ONE THING ON THIS FRONTAGE THAT IS LIT. The steel fascia below it
    // stays dark metal (`signNight(board, false)` above, since DINER is not in
    // LIT_FASCIAS) and the blade burns all night, because the diner never
    // closes. That split is the whole shop: a dark band with a neon blade
    // hanging off the brick over it.
    signNight(blade, true, 'DINER');
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
  if (name === 'VOLT VILLAGE') return electroFront(brick, name, wMeters);
  if (name === 'VIDEO HUT') return videoFront(brick, name, wMeters);
  if (name === 'CROSSTOWN FITNESS') return gymFront(brick, name, wMeters);
  if (name === 'COMMUNITY COLLEGE') return collegeFront(brick, wMeters);
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
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    // the band's foot IS world y = 0, so its courses are the datum the wall
    // above continues from — same 0.5 m spacing, same lines
    surf.courses(g);
    // fascia: a signboard fixed to the brick, so it throws a shadow.
    // `fasciaArt` draws it, and the same call at 64 px/m in `shopfrontRelief`
    // hangs the board you actually read — one authoring, two densities.
    const B = BANDS.default;
    const fy = m(B.fy), fh = m(B.fh);
    const bd = fasciaBoardPx(name, W, m);
    fasciaArt(g, surf, {
      x: bd.x, y: fy, w: bd.w, h: fh, name, trim: awning,
      doorX: m(doorAlongU(name, wMeters, F.doorCentreM)),
    });
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

// ══════════════════ APPLIED SIGNAGE: A SIGN GETS ITS OWN TEXELS ═════════════
//
// THE HOUSE FLOOR FOR ANYTHING THAT HAS TO BE READ IS 150 px/m, and it is
// stated twice in this tree already — `ct/college-yard.ts` ("the shop boards
// are 150 px/m") and `ct/hours-cards.ts` ("200 px/m — above the 150 floor …
// texel starvation is the blur disease signs die of here"). Every painted
// letter on this block was 9-19x under it, because it was being drawn on the
// 16 px/m brick canvas: a 0.6 m fascia letter is six texels of ink and a 0.2 m
// price card letter is under two. *"mattress storefront looks like shit"* was
// one shop's symptom of a block-wide disease.
//
// The cure is the one the Sleep Center's paper and the college's frieze both
// already use, promoted here so every front can have it: the artwork LEAVES
// THE WALL onto its own plane at its own density, standing a couple of
// centimetres proud of the painted band. Two things fall out of that for free:
//
//   · the density (4x for a fascia, 12x for paper), and
//   · THE DOOR CANNOT CHOP IT. The door is painted on the canvas underneath;
//     a plane in front of that canvas is drawn after it by construction, so
//     the overpainting faults — VIDEO HUT's `NEW RELEASES` erased by a
//     centre door, `VHS · 2 FOR $20` cut mid-word, the tax office's `E-FILE`
//     under a door frame, `LOANS GOLD TOOLS` under the pawnbroker's balls —
//     cannot come back by anyone moving a door.
//
// `SIGN_PPM` is paper and cards; `FASCIA_PPM` is architecture. A fascia is
// 18 m wide and does not need paper's density — 64 px/m matches the college's
// applied frieze, which is the neighbour it has to sit beside.
//
// `sheet`, `fitInk` and `FASCIA_PPM` are EXPORTED for the same reason
// proud/reveal/glazed/mullions are: `ct/bodega-corner.ts` paints the canted
// bay that turns the corner between two of these shopfronts, and its fascia
// had the identical six-texel letters. Module-private helpers would have left
// that builder a choice between copying them and leaving the bay blurry.
const SIGN_PPM = 200;
export const FASCIA_PPM = 64;

/** largest whole font that fits `maxW` — a long line shrinks, it never clips.
 *  It only ever shrinks: a fitter that GROWS is the casino marquee's trap,
 *  where short text swells until it hits the rule above it. */
export function fitInk(g: CanvasRenderingContext2D, text: string, family: string, maxW: number, cap: number): void {
  for (let s = cap; s > 5; s--) {
    g.font = `bold ${s}px ${family}`;
    if (g.measureText(text).width <= maxW) return;
  }
}

/** one applied sheet, sized in METRES and drawn in its own texels.
 *
 *  `cutout` is for lettering with no paper behind it — the video shop's
 *  `NEW RELEASES` is yellow type on the lit ceiling of the room, and giving it
 *  a paper ground would invent a sign nobody asked for. alphaTest rather than
 *  plain blending so it needs no sort against the glass behind it; `dither`'s
 *  heaviest grain is alpha 0.16, well under the 0.5 cut, so the weathering
 *  lands on the ink and vanishes off it. */
export function sheet(wM: number, hM: number,
                      draw: (g: CanvasRenderingContext2D, W: number, H: number) => void,
                      o: { taped?: boolean; ppm?: number; cutout?: boolean } = {}): THREE.Mesh {
  const ppm = o.ppm ?? SIGN_PPM, taped = o.taped ?? true;
  const W = Math.max(1, Math.round(wM * ppm)), H = Math.max(1, Math.round(hM * ppm));
  const tex = declareSurface(pixTex(W, H, (g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    draw(g, W, H);
    // the tape, last, so it lies OVER the ink the way real tape does
    if (taped) {
      g.fillStyle = 'rgba(214,204,176,0.55)';
      const t = Math.max(3, Math.round(H * 0.16)), l = Math.max(8, Math.round(H * 0.34));
      for (const x of [0, W - l]) for (const y of [0, H - t]) g.fillRect(x, y, l, t);
    }
    dither(g, W, H, Math.round(W * H / 900));
  }), 'sign', ppm);
  return new THREE.Mesh(new THREE.PlaneGeometry(wM, hM),
    new THREE.MeshBasicMaterial(o.cutout
      ? { map: tex, transparent: true, alphaTest: 0.5 }
      : { map: tex }));
}

/** the two panes a door leaves in the glazing, WIDEST FIRST, in frontage
 *  metres. Every window on this block puts its shout on one and its small
 *  print on the other, and none of them may straddle the door. */
function panesOf(F: Layout, clear = 0.10): [number, number][] {
  const dL = F.doorCentreM - F.doorWidthM / 2 - clear;
  const dR = F.doorCentreM + F.doorWidthM / 2 + clear;
  const p: [number, number][] = [
    [F.glazingStartM, Math.min(dL, F.glazingEndM)],
    [Math.max(dR, F.glazingStartM), F.glazingEndM],
  ];
  return p.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
}

/** the OPEN card on the door leaf. Four shops have one and all four were
 *  painted at m(0.16) — a three-texel font, 1.8 texels of ink per glyph. */
function openCard(ink: string, paper = '#f2ead0'): THREE.Mesh {
  return sheet(0.5, 0.26, (g, W, H) => {
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    const lw = Math.max(2, Math.round(H * 0.06));
    g.lineWidth = lw; g.strokeStyle = ink;
    g.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
    fitInk(g, 'OPEN', 'monospace', W * 0.62, Math.round(H * 0.48));
    g.fillStyle = ink; g.fillText('OPEN', W / 2, H * 0.5);
  }, { taped: false });
}

// ══ THE FASCIAS ═════════════════════════════════════════════════════════════
//
// The liveries live at module scope because TWO surfaces wear them now — the
// painted band and the applied plane over it — and a colour authored twice is
// how the burger barn's mustard survived three "fixes" (see burgerFront).
const SHOP_LETTER = '#f2ead0';
const BURGER_RED = '#c8302a', BURGER_BEIGE = '#e6dcc6';
const PAWN_BOARD = '#6a5a3a', PAWN_GOLD = '#c9a45e', PAWN_INK = '#e8dcc0', PAWN_SUB = '#c9bfa0';
const TAX_BANNER = '#d8d2c4', TAX_NAVY = '#2c4a7a';
const SLEEP_RUST = '#b8642c', SLEEP_CREAM = '#efe6d2';
const VOLT_GRAPHITE = '#2a2d33', VOLT_RED = '#c8322a';
const VIDEO_BLUE = '#1e5aa8', VIDEO_YELLOW = '#f2c22a';
const DINER_STEEL_D = '#6e747a', DINER_VINYL = '#8a2f34';
const THRIFT_BOARD = '#7a5a2c', THRIFT_CARD = '#e4dcc4';
const COLLEGE_STONE = '#d3c9ae', COLLEGE_STONE_D = '#b0a68b';
// teal + magenta + cream, and the values are ct/int-gym.ts's TEAL / MAGENTA /
// CREAM to the digit — the front and the room are the two faces of one wall,
// and the roster `col` in ct/street.ts is this same teal for the same reason.
const GYM_TEAL = '#17766b', GYM_MAGENTA = '#c02a6a', GYM_CREAM = '#f2ede0';

// ══ WHICH SIGNS BURN AFTER DARK ═════════════════════════════════════════════
//
// *"why is only the burger barn business illuminated? or at least it looks
//  illuminated while the other businesses look dark"*   (2026-08-11)
//
// It was, and by ACCIDENT. `ct/props.ts`'s isSelfLit looks at the sheet — over
// 20% of texels bright AND chromatic — and BURGER BARN's board is 85% #c8302a
// (max 200, chroma 158). It cleared the bar and every other fascia on the block
// missed it, because no other roster colour reaches 200 in any channel. So one
// shop held full daylight at four in the morning and fourteen went dark, and
// which one was decided by a palette rather than by anybody.
//
// A commercial street in 1997 does not go uniformly black and it does not glow
// all over either. The contrast is the whole point, so this is a SHORT list and
// it is argued per shop:
//
//   BURGER BARN  a moulded plastic light box, lit from inside — the painter
//                already says exactly that, and it is what the user saw.
//   VIDEO HUT    "the deepest fascia on the block, because on a rental shop the
//                sign IS the shop" — blue plexi with the tube showing top and
//                bottom. The business model is a tape and a walk home in the
//                dark; an unlit one would be absurd.
//   VOLT VILLAGE the painter calls it "a backlit box with the tube showing
//                through the plexi" in as many words. It is also the one that
//                goes out EARLIEST, which is what makes the block have an
//                evening rather than a switch.
//   BODEGA       open round the clock. The corner store is the thing you can
//                still see from down the block at four in the morning, and it
//                is the only sign on the main street that is never off.
//   CROSSTOWN FITNESS  a franchise light box — teal plexi with the tube
//                showing top and bottom, which is what a 1997 gym chain bolts
//                over its door. It is also the one trade on the block whose
//                rush hour is AFTER WORK IN THE DARK; a gym with an unlit sign
//                at seven in the evening is a gym that has closed down. It
//                goes out at ten with its door (ct/hours.ts, close: 22).
//
// And ONE that is lit without its fascia being: the DINER's projecting blade,
// below. Stainless is not a light — a builder already found that out and
// cooled its enamel by three points of chroma to stop it glowing — but a
// projecting neon blade over a dark steel band IS the 1997 diner, and the
// diner never closes.
//
// EVERYTHING ELSE IS `printed`: a painted board, a cloth banner, cast stone.
// Stamping it says so out loud and means no future repaint can light a shop by
// drifting a colour over 200.
//
// Nothing is lit that is not also OPEN. `ct/props.ts` reads `litKey` against
// `ct/hours.ts` every frame, so BURGER BARN and VIDEO HUT go dark at midnight
// with their doors, VOLT VILLAGE at nine, and only the bodega and the diner's
// blade are still burning at three. Signs hold their own brightness and throw
// nothing on the pavement — the one exception is the diner's blade, which is
// small enough that props.ts's fitting rule gives it a doorway pool, and a
// puddle of light under a diner sign is not an accident worth removing.
const LIT_FASCIAS = new Set(['BURGER BARN', 'VIDEO HUT', 'VOLT VILLAGE', 'BODEGA', 'CROSSTOWN FITNESS']);

/** Declare a sign's night behaviour on its material, for `ct/props.ts`.
 *  `key` is the hours-table / roster name; omit it for a sign with no hours of
 *  its own and it simply stays lit whenever it is dark. */
export function signNight(mesh: THREE.Mesh, lit: boolean, key?: string): void {
  const m = mesh.material as THREE.MeshBasicMaterial;
  if (lit) { m.userData.lightSource = true; if (key) m.userData.litKey = key; }
  else m.userData.printed = true;
}

/** Where a shop's fascia BOARD sits inside its band, in the surface's texels.
 *  Most run the full frontage; the pawnbroker's, the thrift store's and the
 *  college's are boards screwed to the brick, the tax office's is a banner
 *  cable-tied over it, and the block default's is a centred signboard capped
 *  at 12 m so a wide shell does not get a 20 m plank. */
function fasciaBoardPx(name: string, W: number, mm: (v: number) => number): { x: number; w: number } {
  const k = characterOf(name);
  if (k === 'default') {
    const w = Math.min(W - mm(1.0), mm(12));
    return { x: Math.round((W - w) / 2), w };
  }
  const ins = k === 'pawn' || k === 'thrift' || k === 'college' ? mm(0.25)
    : k === 'tax' ? mm(0.45) : 0;
  return { x: ins, w: W - 2 * ins };
}

interface FasciaArt {
  /** the board's box in THIS surface's texels */
  x: number; y: number; w: number; h: number;
  name: string;
  /** the roster colour ct/street.ts hands the painter and the relief alike */
  trim: string;
  /** the door's centre, in the same texel space as `x` — the pawnbroker's
   *  three balls hang over it and its lettering has to keep out of their way */
  doorX: number;
}

/**
 * ONE FASCIA, DRAWN AT WHATEVER DENSITY THE SURFACE OFFERS.
 *
 * Every measurement is `s.m(metres)`, so this same code paints the 16 px/m
 * band and the 64 px/m plane that covers it and the two cannot drift. That is
 * the point: an applied sign that restates its own board is two authorings of
 * one fact, which is the fault this file spends most of its comments on.
 *
 * The one thing that is NOT a straight transcription of what was here before
 * is the pawnbroker's lettering — see below.
 */
function fasciaArt(g: CanvasRenderingContext2D, s: Band, o: FasciaArt): void {
  const m = s.m, { x, y, w, h } = o;
  const cx = x + w / 2, cy = y + h / 2;
  // the drop under applied letters, in METRES not pixels. It was `+1` on six
  // of these fronts, which is 6 cm of shadow at 16 px/m and 1.6 cm at 64 —
  // a pixel is not a distance, and at four times the density it would have
  // quietly become no shadow at all.
  const sh = Math.max(1, m(0.05));
  g.textAlign = 'center'; g.textBaseline = 'middle';
  /** applied letters with a shadow under them, fitted so they never overrun */
  const letter = (t: string, px: number, py: number, cap: number,
                  ink: string, shadow: string, maxW: number) => {
    fitInk(g, t, 'monospace', maxW, m(cap));
    g.fillStyle = shadow; g.fillText(t, px + sh, py + sh);
    g.fillStyle = ink; g.fillText(t, px, py);
  };

  // CROSSTOWN FITNESS is dispatched BY NAME, not by a character of its own,
  // and that is deliberate: characterOf() must keep answering 'default' for it
  // because the GEOMETRY is load-bearing — ct/int-gym.ts derived its whole
  // room off doorFrac's default hash ("doorFrac('CROSSTOWN FITNESS') = 0.34…
  // doorCentreM 4.446" in its own comments), and a new BANDS row would move
  // the door out from under the room. So the default's bones, this shop's
  // face: a franchise LIGHT BOX (it is in LIT_FASCIAS and burns until its
  // 22:00 close), teal plexi with the tube showing top and bottom, the two
  // italic magenta speed stripes every 1997 fitness brand swore by at each
  // end, and the name in cream between them.
  if (o.name === 'CROSSTOWN FITNESS') {
    proud(g, s, x, y, w, h, GYM_TEAL);
    g.fillStyle = 'rgba(242,237,224,0.30)';
    g.fillRect(x + m(0.2), y + m(0.10), w - m(0.4), Math.max(1, m(0.06)));
    g.fillRect(x + m(0.2), y + h - m(0.16), w - m(0.4), Math.max(1, m(0.06)));
    // the stripes lean the way the letters read, and the lettering is fitted
    // to w * 0.66 below so it can never run into them
    g.fillStyle = GYM_MAGENTA;
    const bw2 = m(0.22), lean = m(0.30), gap = m(0.16);
    const y0 = y + m(0.22), y1 = y + h - m(0.22);
    for (const x0 of [x + m(0.55), x + m(0.55) + bw2 + gap,
                      x + w - m(0.55) - 2 * bw2 - gap - lean, x + w - m(0.55) - bw2 - lean]) {
      g.beginPath();
      g.moveTo(x0 + lean, y0); g.lineTo(x0 + lean + bw2, y0);
      g.lineTo(x0 + bw2, y1); g.lineTo(x0, y1);
      g.closePath(); g.fill();
    }
    letter(o.name, cx, cy, 0.55, GYM_CREAM, 'rgba(0,0,0,0.40)', w * 0.66);
    return;
  }

  switch (characterOf(o.name)) {
    // a signboard fixed to the brick, so it throws a shadow. Quiet on purpose:
    // a barber, a deli and a laundry are supposed to be quiet next to the six
    // that have a character.
    case 'default':
      proud(g, s, x, y, w, h, o.trim);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, y + h - m(0.16), w, m(0.16));
      letter(o.name, cx, cy, 0.6, SHOP_LETTER, 'rgba(0,0,0,0.34)', w * 0.92);
      break;
    // a light box, not a painted board: the face is FLAT and even and its
    // edges are hard, because it is lit from inside
    case 'burger':
      proud(g, s, x, y, w, h, BURGER_RED);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y + m(0.1), w, m(0.5));
      g.fillStyle = BURGER_BEIGE; g.fillRect(x, y + h - m(0.14), w, m(0.14));
      letter('BURGER BARN', cx, cy, 0.62, BURGER_BEIGE, 'rgba(0,0,0,0.30)', w * 0.9);
      break;
    // hand-painted and brush-streaked; nobody has spent money on this frontage
    // since the balls went up
    case 'pawn': {
      proud(g, s, x, y, w, h, PAWN_BOARD);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      const step = Math.max(2, m(0.28));
      for (let bx = x; bx < x + w; bx += step) {
        if (Math.round((bx - x) / step) % 3 === 0) g.fillRect(bx, y, Math.max(1, m(0.14)), h);
      }
      // THE BALLS HANG OVER THE DOOR AND THE WORDS GO WHERE THEY ARE NOT.
      //
      // The balls are drawn after the lettering and are 0.4 m across, so
      // whatever they landed on was erased: with the room declaring this door
      // dead centre of the front, the cluster sat on `LOANS GOLD TOOLS` and
      // ate `LOA`. Moving the balls is not the answer — they belong over the
      // door, a user called that out by name, and they are derived from it so
      // they follow if the room ever moves it. So the LETTERING is what gets
      // laid out around them: measure the run of board the cluster leaves,
      // take the longer end, and set both lines inside it.
      const br = Math.max(1, m(0.19)), spread = m(0.42);
      const c = Math.min(Math.max(o.doorX, x + m(0.7)), x + w - m(0.7));
      const b0 = c - spread / 2 - br, b1 = c + spread / 2 + br;
      const clear = m(0.18);
      const runs: [number, number][] = [[x + m(0.15), b0 - clear], [b1 + clear, x + w - m(0.15)]];
      const run = runs[0][1] - runs[0][0] >= runs[1][1] - runs[1][0] ? runs[0] : runs[1];
      const rw = Math.max(m(1.2), run[1] - run[0]);
      letter('PAWN', run[0] + rw * 0.19, cy, 0.5, PAWN_INK, 'rgba(0,0,0,0.34)', rw * 0.34);
      fitInk(g, 'LOANS  GOLD  TOOLS', 'monospace', rw * 0.58, m(0.3));
      g.fillStyle = PAWN_SUB;
      g.fillText('LOANS  GOLD  TOOLS', run[0] + rw * 0.68, cy + m(0.06));
      for (const [ox2, oy2] of [[-0.21, -0.28], [0.21, -0.28], [0, 0.14]] as [number, number][]) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(c + m(ox2) + sh, cy + m(oy2) + sh, br, br, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = PAWN_GOLD;
        g.beginPath(); g.ellipse(c + m(ox2), cy + m(oy2), br, br, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.ellipse(c + m(ox2) - br * 0.3, cy + m(oy2) - br * 0.3, br * 0.35, br * 0.35, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    // CLOTH, so it sags and its edges are soft. Screen-printed letters sit ON
    // the banner rather than in it: a light bleed above and the ink below.
    case 'tax':
      g.fillStyle = TAX_BANNER; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, y + h - m(0.14), w, m(0.14));
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (const gx2 of [x + m(0.12), x + w - m(0.27)]) {
        g.fillRect(gx2, y + m(0.1), m(0.09), m(0.09));
        g.fillRect(gx2, y + h - m(0.2), m(0.09), m(0.09));
      }
      fitInk(g, 'A-1 TAX SERVICE', 'monospace', w * 0.8, m(0.5));
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText('A-1 TAX SERVICE', cx, cy - sh);
      g.fillStyle = 'rgba(20,26,44,0.35)'; g.fillText('A-1 TAX SERVICE', cx, cy + sh);
      g.fillStyle = TAX_NAVY; g.fillText('A-1 TAX SERVICE', cx, cy);
      break;
    // a painted board with a signwriter's cream keyline inset from its edge,
    // which stops 13 m of one colour reading as a bar
    case 'mattress':
      proud(g, s, x, y, w, h, SLEEP_RUST);
      g.fillStyle = 'rgba(239,230,210,0.30)';
      g.fillRect(x + m(0.25), y + m(0.12), w - m(0.5), Math.max(1, m(0.05)));
      g.fillRect(x + m(0.25), y + h - m(0.17), w - m(0.5), Math.max(1, m(0.05)));
      letter('SLEEP CENTER', cx, cy, 0.54, SLEEP_CREAM, 'rgba(40,20,10,0.45)', w * 0.88);
      break;
    // a backlit box with the tube showing through the plexi top and bottom
    case 'electro':
      proud(g, s, x, y, w, h, VOLT_GRAPHITE);
      g.fillStyle = 'rgba(90,190,220,0.28)';
      g.fillRect(x + m(0.2), y + m(0.1), w - m(0.4), Math.max(1, m(0.06)));
      g.fillRect(x + m(0.2), y + h - m(0.16), w - m(0.4), Math.max(1, m(0.06)));
      letter(o.name, cx, cy, 0.5, VOLT_RED, 'rgba(0,0,0,0.5)', w * 0.88);
      break;
    // the deepest fascia on the block, because on a rental shop the sign IS
    // the shop
    case 'video':
      proud(g, s, x, y, w, h, VIDEO_BLUE);
      g.fillStyle = 'rgba(242,194,42,0.85)';
      g.fillRect(x + m(0.3), y + m(0.13), w - m(0.6), Math.max(1, m(0.06)));
      g.fillRect(x + m(0.3), y + h - m(0.19), w - m(0.6), Math.max(1, m(0.06)));
      letter('VIDEO HUT', cx, cy, 0.62, VIDEO_YELLOW, 'rgba(0,20,50,0.5)', w * 0.88);
      break;
    // stainless, fluted — horizontal lines are what read as pressed metal
    // rather than painted board
    case 'diner': {
      proud(g, s, x, y, w, h, DINER_STEEL);
      const t = Math.max(1, m(0.03)), pitch = Math.max(3, m(0.16));
      for (let yy = y + m(0.12); yy < y + h - m(0.1); yy += pitch) {
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, yy, w, t);
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, yy + t, w, t);
      }
      g.fillStyle = DINER_STEEL_D; g.fillRect(x, y + h - m(0.16), w, m(0.16));
      letter(o.name, cx, cy, 0.58, DINER_VINYL, 'rgba(0,0,0,0.38)', w * 0.88);
      break;
    }
    // a painted board, sun-bleached unevenly across its own length
    case 'thrift': {
      proud(g, s, x, y, w, h, o.trim || THRIFT_BOARD);
      const bleach = Math.max(4, Math.round(w / Math.max(1, m(0.5))));
      for (let i = 0; i < bleach; i++) {
        const x0 = x + Math.round((w * i) / bleach), x1 = x + Math.round((w * (i + 1)) / bleach);
        g.fillStyle = `rgba(228,220,196,${0.05 + 0.09 * Math.abs(Math.sin((x0 - x) / Math.max(1, m(0.5)) * 0.34))})`;
        g.fillRect(x0, y, x1 - x0, h);
      }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + h - m(0.1), w, m(0.1));
      letter(o.name, cx, cy, 0.55, THRIFT_CARD, 'rgba(0,0,0,0.32)', w * 0.88);
      break;
    }
    // cast stone with the name incised: the dark cut, and the lit lower edge
    // of it. Civic, not retail — no drop shadow, because nothing is applied.
    case 'college':
      proud(g, s, x, y, w, h, COLLEGE_STONE);
      g.fillStyle = COLLEGE_STONE_D;
      g.fillRect(x, y + m(0.10), w, Math.max(1, m(0.045)));
      g.fillRect(x, y + h - m(0.14), w, Math.max(1, m(0.045)));
      fitInk(g, 'CROSSTOWN COMMUNITY COLLEGE', 'monospace', w * 0.9, m(0.40));
      g.fillStyle = 'rgba(250,244,225,0.35)';
      g.fillText('CROSSTOWN COMMUNITY COLLEGE', cx, y + h * 0.52 + Math.max(1, m(0.045)));
      g.fillStyle = '#5a4f3c';
      g.fillText('CROSSTOWN COMMUNITY COLLEGE', cx, y + h * 0.52);
      break;
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
  const RED = BURGER_RED, PLASTIC = '#b8ada0';
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
    fasciaArt(g, surf, {
      x: 0, y: fy, w: W, h: fh, name: 'BURGER BARN', trim: RED,
      doorX: m(doorAlongU('BURGER BARN', wM, F.doorCentreM)),
    });
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
  const BOARD = PAWN_BOARD, GOLD = PAWN_GOLD, STEEL = '#40453f';
  const GOODS = ['#8a3a2e', '#c9a45e', '#3a5a8a', '#8a8378', '#4a7a3a', '#7a3a6a', '#a8a29a'];
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // hand-painted board, brush-streaked along its length. THE THREE BALLS
    // BELONG OVER THE DOOR — a user named that, and `fasciaArt` still derives
    // them from `doorAlongU` so they follow if the room ever moves it. What
    // changed is that the LETTERING now measures the run of board they leave
    // and sets itself inside it, instead of being painted first and eaten.
    const B = BANDS.pawn;
    const fy = m(B.fy), fh = m(B.fh);
    const bd = fasciaBoardPx('PAWN', W, m);
    fasciaArt(g, surf, {
      x: bd.x, y: fy, w: bd.w, h: fh, name: 'PAWN', trim: BOARD,
      doorX: m(doorAlongU('PAWN', wM, F.doorCentreM)),
    });
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#1d1a16'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, '#463c31');
    // THIS WINDOW IS A DISPLAY, NOT STORAGE, and the comment that used to sit
    // here said the opposite — "dim, because nothing in here is a display, it
    // is storage" — with the lighting to match. The user has overruled that
    // reading directly: a pawn shop's window is its whole character and should
    // be the most crowded on the block.
    //
    // Measured, it was the LEAST readable: of the glazing texels, the share
    // that read at all (max channel > 120) was
    //
    //     A-1 TAX 43.9  ·  THRIFT 40.8  ·  DINER 40.2  ·  BURGER 33.6
    //     the quiet default shops 7.6 - 14.9
    //     PAWN 4.8            <- darkest window on the street
    //
    // and yet PAWN carried 33 distinct tones, more than every front except the
    // tax office and the thrift. The inventory was all being drawn and then
    // buried under a dark room, a dim bulb and an inner cage at 0.62 alpha.
    // Nothing here needed redrawing; it needed the light turning on.
    g.fillStyle = '#c9a45e'; g.fillRect(gx, gy, gw, m(0.20));                       // the strip over the window
    g.fillStyle = 'rgba(201,164,94,0.34)'; g.fillRect(gx, gy + m(0.20), gw, m(0.55));
    g.fillStyle = 'rgba(201,164,94,0.16)'; g.fillRect(gx, gy + m(0.75), gw, m(0.9));
    let sd = 0x51a3f7;
    const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    // THE WINDOW IS THE SHOP. It used to be two shelves of coloured blocks off a
    // `GOODS` palette, and at 16 px/m a row of same-width rectangles reads as
    // BOOK SPINES — measured from the pavement, this front looked like a
    // bookshop somebody had barred. A pawn shop's window is its whole
    // character, so the inventory is drawn as objects rather than as stock.
    //
    // THE CONTENTS ARE G's, NOT MINE. `ct/int-pawn.ts` already builds this
    // shop's interior and says what is in it — a glass case with rings on the
    // top shelf and watches on the lower "each on its own tag", and a back wall
    // read "left to right: the tools, the guitars, the brass", the guitars dead
    // centre because they are what you come in for. Painting my own display
    // would be the two-things-compute-it fault in a new place, so this depicts
    // G's.
    //
    // AND IT IS MIRRORED, which is the part that is easy to get wrong. G's
    // order is what a customer sees standing INSIDE facing the back wall. From
    // the pavement you are looking the other way through the same wall, so it
    // reads brass, guitars, tools — the same handedness rule `mirror-walk`
    // measures for doors, applied to the display.
    const tag = (x: number, y: number) => {                        // handwritten price ticket
      g.fillStyle = '#d8d0b8'; g.fillRect(x, y, m(0.17), m(0.11));
      g.fillStyle = 'rgba(60,50,36,0.75)'; g.fillRect(x + m(0.03), y + m(0.04), m(0.11), Math.max(1, m(0.03)));
    };
    // DENSITY IS THE POINT, and it is what three passes of recolouring did not
    // fix. Measured after lifting every object colour, this window still read
    // 9.1% against 33-44% for the other character fronts — because a handful of
    // objects spread over 13.7 m of glazing is not a crowded window however
    // brightly they are painted. The zones stay (they carry G's order) and each
    // one is now FILLED.
    const third = gw / 3;
    // ── BRASS, on stands (G's right-hand end, so our left) ──────────────────
    for (let bx = gx + m(0.3); bx < gx + third - m(0.5); bx += m(0.72)) {
      const by = gy + m(1.62) + (r() < 0.5 ? 0 : m(0.16));
      g.fillStyle = '#8a7550'; g.fillRect(bx + m(0.20), by, Math.max(1, m(0.06)), m(0.50));
      g.fillStyle = GOLD; g.fillRect(bx + m(0.05), by - m(0.38), m(0.30), m(0.38));
      g.fillStyle = '#e8cf96'; g.fillRect(bx + m(0.05), by - m(0.38), m(0.30), m(0.08));
      g.fillStyle = GOLD;
      g.beginPath(); g.ellipse(bx + m(0.36), by - m(0.26), m(0.13), m(0.17), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.beginPath(); g.ellipse(bx + m(0.39), by - m(0.26), m(0.07), m(0.11), 0, 0, Math.PI * 2); g.fill();
      if (r() < 0.6) tag(bx + m(0.06), by - m(0.06));
    }
    // ── GUITARS, dead centre, a wall of necks ───────────────────────────────
    {
      let i = 0;
      for (let cx2 = gx + third + m(0.12); cx2 < gx + 2 * third - m(0.4); cx2 += m(0.5), i++) {
        const ty = gy + m(0.58) + (i % 2) * m(0.10);
        g.fillStyle = '#8a6a45'; g.fillRect(cx2, ty, Math.max(1, m(0.09)), m(1.10));
        g.fillStyle = '#6a5236'; g.fillRect(cx2 - m(0.03), ty, m(0.15), m(0.10));
        g.fillStyle = 'rgba(240,230,205,0.55)';
        for (let fr = 1; fr < 5; fr++) g.fillRect(cx2, ty + fr * m(0.21), Math.max(1, m(0.09)), 1);
        const bodyC = ['#c4763c', '#a35d84', '#5a8ec4', '#c9a45e'][i % 4];
        g.fillStyle = bodyC;
        g.beginPath(); g.ellipse(cx2 + m(0.04), ty + m(1.34), m(0.24), m(0.28), 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.beginPath(); g.ellipse(cx2 - m(0.04), ty + m(1.26), m(0.10), m(0.11), 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1a1512';
        g.beginPath(); g.ellipse(cx2 + m(0.04), ty + m(1.34), m(0.07), m(0.08), 0, 0, Math.PI * 2); g.fill();
        if (i % 3 === 0) tag(cx2 + m(0.14), ty + m(1.60));
      }
    }
    // ── TOOLS on a pegboard, filling the last third ─────────────────────────
    {
      const tx0 = gx + 2 * third + m(0.10), tw = third - m(0.30), ty0 = gy + m(0.62);
      g.fillStyle = '#6a6154'; g.fillRect(tx0, ty0, tw, m(1.35));
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = ty0 + m(0.1); y < ty0 + m(1.3); y += m(0.13))
        for (let x = tx0 + m(0.1); x < tx0 + tw - m(0.1); x += m(0.13)) g.fillRect(x, y, 1, 1);
      let k = 0;
      for (let x = tx0 + m(0.16); x < tx0 + tw - m(0.28); x += m(0.42), k++) {
        const kind = k % 4;
        if (kind === 0) {                                            // saw
          g.fillStyle = '#cfc8ba'; g.fillRect(x, ty0 + m(0.16), m(0.09), m(0.55));
          g.fillStyle = '#9a7c52'; g.fillRect(x - m(0.03), ty0 + m(0.71), m(0.16), m(0.15));
        } else if (kind === 1) {                                     // drill
          g.fillStyle = '#7d857c'; g.fillRect(x, ty0 + m(0.20), m(0.28), m(0.20));
          g.fillStyle = '#9a7c52'; g.fillRect(x + m(0.07), ty0 + m(0.40), m(0.12), m(0.24));
        } else if (kind === 2) {                                     // wrench
          g.fillStyle = '#cfc8ba'; g.fillRect(x + m(0.06), ty0 + m(0.18), m(0.08), m(0.50));
          g.fillStyle = '#b8b0a4'; g.fillRect(x + m(0.02), ty0 + m(0.14), m(0.16), m(0.09));
        } else {                                                     // a boxed set
          g.fillStyle = '#8a5a3a'; g.fillRect(x, ty0 + m(0.26), m(0.30), m(0.34));
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, ty0 + m(0.26), m(0.30), m(0.06));
        }
        if (k % 2 === 0) tag(x + m(0.02), ty0 + m(0.94));
      }
    }
    // ── A TV STACK and boxed gear along the floor, the whole width ──────────
    {
      let k = 0;
      for (let vx = gx + m(0.35); vx < gx + gw - m(0.75); vx += m(0.86), k++) {
        const stack = 1 + (k % 3 === 0 ? 1 : 0);
        for (let sIdx = 0; sIdx < stack; sIdx++) {
          const vy = gy + gh - m(0.35) - m(0.46) * (sIdx + 1);
          g.fillStyle = '#7a7466'; g.fillRect(vx, vy, m(0.58), m(0.44));
          g.fillStyle = '#20262a'; g.fillRect(vx + m(0.05), vy + m(0.05), m(0.38), m(0.30));
          g.fillStyle = 'rgba(150,172,190,0.22)'; g.fillRect(vx + m(0.05), vy + m(0.05), m(0.38), m(0.09));
          g.fillStyle = '#a8a294'; g.fillRect(vx + m(0.47), vy + m(0.09), m(0.07), m(0.22));
        }
        if (k % 2 === 0) tag(vx + m(0.06), gy + gh - m(0.30));
      }
    }
    // ── THE GLASS CASE, rings above and watches below, each tagged ──────────
    {
      const cy0 = gy + m(2.10), ch = m(0.50);
      g.fillStyle = 'rgba(30,32,34,0.80)'; g.fillRect(gx + m(0.2), cy0, gw - m(0.4), ch);
      g.fillStyle = '#6a6458'; g.fillRect(gx + m(0.2), cy0 + ch / 2, gw - m(0.4), 1);
      g.fillStyle = 'rgba(255,255,255,0.26)'; g.fillRect(gx + m(0.2), cy0, gw - m(0.4), 1);
      for (let x = gx + m(0.32); x < gx + gw - m(0.45); x += m(0.34)) {
        g.fillStyle = GOLD;                                                  // a ring, above
        g.fillRect(x + m(0.02), cy0 + m(0.09), m(0.10), Math.max(1, m(0.05)));
        g.fillStyle = r() < 0.34 ? '#c8d0d8' : '#e8cf96';                    // a watch, below
        g.fillRect(x + m(0.02), cy0 + m(0.30), m(0.11), m(0.10));
        g.fillStyle = '#9a9488'; g.fillRect(x + m(0.04), cy0 + m(0.40), m(0.07), Math.max(1, m(0.03)));
      }
    }
    g.fillStyle = '#211d19'; g.fillRect(gx, gy + gh - m(0.35), gw, m(0.35));          // floor
    // BARS ON THE INSIDE OF THE GLASS AS WELL AS OUTSIDE — the detail that says
    // pawn shop before you read the sign. These go on FIRST, behind the
    // mullions and the outer grille, at a different pitch and much darker,
    // because an inner cage seen through glass is a silhouette rather than a
    // lit object. Two layers at different pitches is what stops a barred window
    // reading as one flat printed grid.
    for (let x = gx + m(0.42); x < gx + gw - m(0.05); x += m(0.63)) {
      g.fillStyle = 'rgba(10,9,8,0.34)'; g.fillRect(x, gy, Math.max(1, m(0.05)), gh);
    }
    g.fillStyle = 'rgba(10,9,8,0.30)'; g.fillRect(gx, gy + m(1.30), gw, Math.max(1, m(0.05)));
    // MULLIONS, which this front simply never had — the brief lists them and
    // every other shopfront on the block divides its glazing. One sheet of
    // glass reads as a hole (`mullions`' own comment says so).
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 3.8)), '#2e2a24');
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
    // THE LEAF STAYS SOLID. The brief asks for "a transom over the door", and a
    // transom is a fixed light ABOVE the door — not a pane in it. That
    // distinction is load-bearing here: `ct/int-pawn.ts` reasons explicitly
    // that "this shop's door is a SOLID dark panel with no glazing at all --
    // which is right, it is a pawn shop... A shop that bars its windows does
    // not put a pane in its door." Glazing this leaf would put the shopfront
    // and the room back to inventing different doors, which is the exact thing
    // the coordination was for.
    //
    // So: a transom over it, on the SAME line as the glazing's upper rail so
    // the horizontals run through, and the leaf below it stays shut and solid.
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(dx, gy + m(0.55), dw, Math.max(1, m(0.08)));
    g.fillStyle = '#2b2622'; g.fillRect(dx, gy + m(0.63), dw, m(0.42));            // the fixed light
    g.fillStyle = 'rgba(150,172,190,0.16)'; g.fillRect(dx, gy + m(0.63), dw, m(0.16));
    g.fillStyle = STEEL;                                                           // barred, like the window
    for (let bxx = dx + m(0.16); bxx < dx + dw - m(0.08); bxx += m(0.26)) g.fillRect(bxx, gy + m(0.63), Math.max(1, m(0.05)), m(0.42));
    g.fillStyle = '#40453f'; g.fillRect(dx, gy + m(1.05), dw, Math.max(1, m(0.07)));
    // the leaf: solid, panelled, with the heavy kick plate it already had
    g.fillStyle = '#3a3228'; g.fillRect(dx, gy + m(1.12), dw, gh - m(1.12));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(dx + m(0.12), gy + m(1.28), dw - m(0.24), m(0.85));
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(dx + m(0.12), gy + m(1.28), dw - m(0.24), 1);
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
  const GOLD = '#b89a4e', BLIND = '#7d8178', ALU = '#8f938f';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // the banner: cloth, so it sags and its edges are soft — no light box.
    // Screen-printed letters sit ON it rather than in it: `fasciaArt` draws
    // both, here on the brick and again at 64 px/m on the plane in front.
    //
    // ITS TOP WAS HAND-TYPED AT 0.20 m AND `BANDS.tax.fy` SAYS 0.12. Nothing
    // read the descriptor, so the whole front — banner, opening, glazing —
    // hung 8 cm below where `frontageOf` publishes it, and the projecting bed
    // mould and jambs `shopfrontRelief` frames it with were all computed off
    // the descriptor. That is the two-places-decide-one-fact fault this file's
    // whole frontage system exists to end, still live on one front. It reads
    // the descriptor now.
    const B = BANDS.tax;
    const by0 = m(B.fy), bh = m(B.fh), bx0 = m(0.45), bw = W - m(0.9);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(bx0, by0 + bh - m(0.06), bw, m(0.2));  // shadow on brick
    fasciaArt(g, surf, {
      x: bx0, y: by0, w: bw, h: bh, name: 'A-1 TAX', trim: TAX_NAVY,
      doorX: m(doorAlongU('A-1 TAX', wM, F.doorCentreM)),
    });
    // the opening
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
    // The three notes taped inside the glass are `taxWindowSigns` now. Painted
    // here they were 2.4 texels of ink a glyph, `E-FILE` sat half under the
    // door frame, and the staggered one hung 0.4 m past the bottom of 2.48 m of
    // glazing and was cut off by the stallriser painted over it.
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

// ══ THE SLEEP CENTER'S PAPER ═════════════════════════════════════════════════
//
// *"mattress storefront looks like shit"* (2026-08-11). Everything he named —
// the smeared red banner, the bills that are coloured blobs, the pink smudge on
// the door — was one fault: PAPER WAS BEING PAINTED ONTO BRICK'S CANVAS.
//
//     shopfront canvas          16 px/m (WALL_PPM 8 x SHOP_MULT 2)
//     'MATTRESS SALE' at m(0.42)   52 texels for 13 characters
//     the two bills at m(0.20)      3-texel font
//     the door's OPEN at m(0.16)    3-texel font
//
// A 4-texel glyph is all antialiasing fringe, and `pixTex` magnifies with
// NearestFilter, so every fringe pixel arrives on the glass as a 6 cm block of
// half-tone. The fascia survives on the same canvas only because `SLEEP CENTER`
// is set at m(0.54) across 13 m — that is why the sign he can read and the signs
// he cannot are side by side in the same shot.
//
// Raising the whole shopfront's density is the wrong lever: it is 13 x 4.2 m of
// brick, and this block's look IS 16 px/m: finer courses on one shop would make
// the Sleep Center the odd front on the street instead of the good one.
//
// So the paper leaves the wall. Each sheet is its own small plane at 200 px/m,
// standing 2 cm proud of the painted glass — inside the 0.12 m jamb, so it still
// reads as taped to the INSIDE of the window — which is the same construction
// (and the same density) as the BUSINESS HOURS placard by the door, the one
// thing in his screenshot that holds up.
// `SIGN_PPM`, `fitInk()` and `sheet()` were declared HERE, private to this
// block, and the whole rest of the street was still painting its signs on
// brick. They are up in the depth vocabulary now, beside proud/reveal/glazed —
// this shop was never the only one with the disease, it was just the one that
// got named.
/** the Sleep Center's paper palette. Shared with `mattressFront` so the ink on
 *  the sheets and the paint on the front cannot drift apart. */
const SLEEP_PAPER = '#f6efdb', SLEEP_INK = '#a02818', SLEEP_BLUE = '#2f5c86';

/**
 * Hang the Sleep Center's window paper. Called by `shopfrontRelief` with the
 * frontage group, so everything is placed in frontage metres off `F` and moves
 * if the door or the glazing ever moves.
 *
 * THE BANNER NO LONGER RUNS THROUGH THE DOOR, and that was the second half of
 * the complaint: the painted one was centred on the whole glazed run, and the
 * door — drawn after it — chopped it, so from the pavement it read `MATTRESS
 * SA`. A sheet of paper is taped to ONE pane. It goes on the wider of the two
 * panes the door leaves (7.19 m against 3.71 m here) and the two bills go on the
 * narrow one, which also gives the front a composition instead of a smear:
 * the shout beside the door, the small print on the other side of it.
 *
 * SIGNAGE STAYS IN THE TOP THIRD. `mattressFront` gives the stock the lower two
 * and is emphatic about why — three pale slabs behind a sign is a sign, not a
 * bed shop. The lowest sheet here stops at 1.74 m and the tallest bed's mattress
 * tops out at 1.63 m, so nothing is hung across a mattress.
 */
function sleepWindowSigns(grp: THREE.Group, F: Layout, half: number): void {
  const PROUD = 0.02;                       // inside the 0.12 m jamb, on the glass
  const at = (uM: number, y: number, mesh: THREE.Mesh) => {
    mesh.position.set(uM - half, y, PROUD);
    grp.add(mesh);
  };
  const [wide, narrow] = panesOf(F, 0);
  const top = F.glazingTopM;

  // ── the banner: hand-lettered, the loudest thing on the front ───────────
  const bw = Math.min(6.6, (wide[1] - wide[0]) - 0.7), bh = 0.62;
  at((wide[0] + wide[1]) / 2, top - 0.28 - bh / 2, sheet(bw, bh, (g, W, H) => {
    g.fillStyle = SLEEP_PAPER; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.10)';                       // the curl along two edges
    g.fillRect(0, H - 3, W, 3); g.fillRect(W - 3, 0, 3, H);
    fitInk(g, 'MATTRESS SALE', 'monospace', W * 0.84, Math.round(H * 0.5));
    g.fillStyle = SLEEP_INK; g.fillText('MATTRESS SALE', W / 2, H * 0.4);
    g.fillStyle = SLEEP_BLUE;
    g.fillRect(Math.round(W * 0.08), Math.round(H * 0.66), Math.round(W * 0.84), Math.max(2, Math.round(H * 0.05)));
    fitInk(g, '50% OFF EVERY SET', 'monospace', W * 0.7, Math.round(H * 0.2));
    g.fillText('50% OFF EVERY SET', W / 2, H * 0.83);
  }));

  // ── the small print, on the pane the other side of the door ────────────
  const lw = Math.min(1.9, (narrow[1] - narrow[0]) - 0.5), lh = 0.4;
  const bills = ["NO PAYMENTS TIL '98", 'FREE DELIVERY'];
  bills.forEach((t, i) => {
    at((narrow[0] + narrow[1]) / 2, top - 0.30 - lh / 2 - i * (lh + 0.04), sheet(lw, lh, (g, W, H) => {
      g.fillStyle = '#fdf6e2'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 2, W, 2);
      fitInk(g, t, 'monospace', W * 0.88, Math.round(H * 0.42));
      g.fillStyle = SLEEP_BLUE; g.fillText(t, W / 2, H * 0.5);
    }));
  });

  // ── the OPEN card on the leaf, where every shop door has one ───────────
  at(F.doorCentreM - F.doorWidthM / 2 + 0.39, F.glazingTopM - 0.95 - 0.13, openCard(SLEEP_INK));
}

/**
 * WHERE A SHEET OF PAPER GOES, for the shops that have any.
 *
 * `sleepWindowSigns` above is the model and these four follow it exactly: the
 * paper is placed in FRONTAGE METRES off `F`, so it moves with the door and
 * the glazing, and it goes on a PANE rather than across the whole window, so
 * nothing can be chopped mid-word by a door leaf again.
 */
function taxWindowSigns(grp: THREE.Group, F: Layout, half: number): void {
  const at = (uM: number, y: number, mesh: THREE.Mesh) => {
    mesh.position.set(uM - half, y, 0.02); grp.add(mesh);
  };
  // THREE NOTES TAPED UP OFF SQUARE, and every one of them was in trouble:
  // 2.4 texels of ink per glyph, `E-FILE` half under the door frame, and the
  // staggered one hanging past the bottom of the glass onto the stallriser
  // (painted at gy + 2.0 m with a 0.5 m card, in 2.48 m of glazing).
  const [wide] = panesOf(F, 0.14);
  const cw = Math.min(1.15, (wide[1] - wide[0]) / 3.4), ch = 0.42, stag = 0.16;
  const run = Math.max(0, (wide[1] - wide[0]) - cw - 0.5);
  // DERIVED FROM THE SILL UP, not from the glazing top down. There is 0.73 m
  // of glass between the gold `REFUNDS` underline and the bottom of the
  // window, and the painted version wanted 0.9 m for a 0.5 m card and a 0.4 m
  // stagger — which is how the second note came to hang past the glass onto
  // the stallriser and be cut off by it.
  const yTop = Math.min(F.glazingTopM - 1.72, F.glazingBottomM + 0.12 + ch + stag);
  ['E-FILE', 'FAST', 'WALK-IN'].forEach((t, i) => {
    at(wide[0] + 0.25 + cw / 2 + run * (i / 2), yTop - ch / 2 - (i % 2) * stag,
      sheet(cw, ch, (g, W, H) => {
        g.fillStyle = '#f2ead0'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 3, W, 3);
        fitInk(g, t, 'monospace', W * 0.84, Math.round(H * 0.46));
        g.fillStyle = '#8a2c22'; g.fillText(t, W / 2, H * 0.5);
      }));
  });
}

function voltWindowSigns(grp: THREE.Group, F: Layout, half: number, wM: number): void {
  const at = (uM: number, y: number, mesh: THREE.Mesh) => {
    mesh.position.set(uM - half, y, 0.02); grp.add(mesh);
  };
  // THE PRICE CARD, and it was the worst sign on the block: `TV · VCR ·
  // CAMCORDER` at m(0.2) is a three-texel font, 1.8 texels of ink a glyph.
  // It also started ONE TEXEL from the door frame — the near miss the survey
  // flagged — which a pane keeps it out of for good.
  //
  // Which end it goes on is unchanged: `electroFront` stands its hi-fi tower
  // at the end nearest the door and the card goes to the other one, so stock
  // and paper can never collide whatever width or door side this front gets.
  const towerLeft = F.doorCentreM > wM / 2;
  const dL = F.doorCentreM - F.doorWidthM / 2 - 0.14;
  const dR = F.doorCentreM + F.doorWidthM / 2 + 0.14;
  let pane: [number, number] = towerLeft
    ? [Math.max(dR, F.glazingStartM), F.glazingEndM]
    : [F.glazingStartM, Math.min(dL, F.glazingEndM)];
  if (pane[1] - pane[0] < 1.4) pane = panesOf(F, 0.14)[0];
  const cw = Math.min(3.0, (pane[1] - pane[0]) - 0.5), ch = 0.5;
  const u = towerLeft ? pane[1] - 0.25 - cw / 2 : pane[0] + 0.25 + cw / 2;
  at(u, F.glazingBottomM + 0.16 + ch / 2, sheet(cw, ch, (g, W, H) => {
    g.fillStyle = '#f4edd8'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, H - 3, W, 3);
    fitInk(g, 'TV · VCR · CAMCORDER', 'monospace', W * 0.88, Math.round(H * 0.42));
    g.fillStyle = VOLT_RED; g.fillText('TV · VCR · CAMCORDER', W / 2, H * 0.5);
  }));
  at(F.doorCentreM - F.doorWidthM / 2 + 0.39, F.glazingTopM - 0.95 - 0.13, openCard(VOLT_RED));
}

function videoWindowSigns(grp: THREE.Group, F: Layout, half: number): void {
  const at = (uM: number, y: number, mesh: THREE.Mesh) => {
    mesh.position.set(uM - half, y, 0.02); grp.add(mesh);
  };
  // THE ROOM PUT THIS DOOR DEAD CENTRE OF AN 18 m FRONT (ct/int-video.ts,
  // `at: 0`), and both of this window's signs were centred on the whole
  // glazed run — so the door was painted straight through the middle of each
  // of them and five texels survived either end of `NEW RELEASES`. On a pane
  // they cannot be reached by it.
  const [wide] = panesOf(F, 0.14);
  const paneW = wide[1] - wide[0], mid = (wide[0] + wide[1]) / 2;
  // the header is TYPE ON THE ROOM, not a sheet of paper — yellow letters over
  // the shop's own lit ceiling, which is what it has always been
  const hw = Math.min(4.6, paneW - 0.5), hh = 0.42;
  at(mid, F.glazingTopM - 0.36, sheet(hw, hh, (g, W, H) => {
    fitInk(g, 'NEW RELEASES', 'monospace', W * 0.9, Math.round(H * 0.66));
    g.fillStyle = 'rgba(0,20,50,0.55)'; g.fillText('NEW RELEASES', W / 2 + 3, H * 0.5 + 3);
    g.fillStyle = VIDEO_YELLOW; g.fillText('NEW RELEASES', W / 2, H * 0.5);
  }, { taped: false, cutout: true }));
  // the hand-lettered rental card, low in the glass
  const cw = Math.min(4.4, paneW - 0.5), ch = 0.54;
  at(mid, F.glazingBottomM + 0.14 + ch / 2, sheet(cw, ch, (g, W, H) => {
    g.fillStyle = '#f6efdb'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 3, W, 3);
    fitInk(g, 'VHS · 2 FOR $20', 'monospace', W * 0.86, Math.round(H * 0.52));
    g.fillStyle = VIDEO_BLUE; g.fillText('VHS · 2 FOR $20', W / 2, H * 0.5);
  }));
  at(F.doorCentreM - F.doorWidthM / 2 + 0.39, F.glazingTopM - 0.95 - 0.13, openCard('#a02818'));
}

/** the thrift store's three price cards, in frontage metres. Shared, because
 *  `thriftFront` stands its mannequin in the gap BETWEEN them — a card taped
 *  over its head would hide the only silhouette in the window, and two places
 *  deciding where a card is would put it there. */
const THRIFT_CARD_W = 1.3, THRIFT_CARD_H = 0.6;
function thriftCardLayout(F: Layout): { u: number; yTop: number; text: string }[] {
  const [wide] = panesOf(F, 0.07);
  const gh = F.glazingTopM - F.glazingBottomM;
  const span = Math.max(0, (wide[1] - wide[0]) - THRIFT_CARD_W - 0.3);
  return ([[0.06, 0.26, '50c'], [0.44, 0.10, 'ALL 1$'], [0.86, 0.34, 'SALE']] as [number, number, string][])
    .map(([fx, fy, text]) => ({
      u: wide[0] + 0.15 + span * fx,
      yTop: F.glazingTopM - (gh - THRIFT_CARD_H - 0.4) * fy,
      text,
    }));
}

function thriftWindowSigns(grp: THREE.Group, F: Layout, half: number): void {
  for (const c of thriftCardLayout(F)) {
    const mesh = sheet(THRIFT_CARD_W, THRIFT_CARD_H, (g, W, H) => {
      g.fillStyle = THRIFT_CARD; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 4, W, 4);
      fitInk(g, c.text, 'monospace', W * 0.8, Math.round(H * 0.5));
      g.fillStyle = '#3a3026'; g.fillText(c.text, W / 2, H * 0.5);
    }, { taped: false });
    // tape at ONE corner only, the way a shop with no window dresser does it
    mesh.position.set(c.u + THRIFT_CARD_W / 2 - half, c.yTop - THRIFT_CARD_H / 2, 0.02);
    grp.add(mesh);
  }
}

/** CROSSTOWN FITNESS's window paper, on the sleep/volt model: the shout on the
 *  wide pane, the small print on the narrow one, nothing straddling the door.
 *  Franchise print, not hand-lettering — a chain sends its posters from head
 *  office (ct/hours-cards.ts already files this shop's card as 'chain').
 *  SIGNAGE STAYS IN THE TOP THIRD: the machines in the glass top out at
 *  ~1.35 m over the floor line and both sheets here hang off the glazing top,
 *  so nothing is taped across a treadmill. NO HOURS on any of it — the posted
 *  hours are the hours card, read out of ct/hours.ts like everyone else's. */
function gymWindowSigns(grp: THREE.Group, F: Layout, half: number): void {
  const at = (uM: number, y: number, mesh: THREE.Mesh) => {
    mesh.position.set(uM - half, y, 0.02); grp.add(mesh);
  };
  const [wide, narrow] = panesOf(F, 0);
  const top = F.glazingTopM;
  // ── the shout: the desk's actual pitch, off int-gym.ts's rate board ─────
  // ONE FEE UNLOCKS EVERYTHING (day pass $15, full season $120/28 days) is
  // what the ledger sells — the paper says THAT, not an offer the desk would
  // have to refuse. *"first week free + 5$ day pass is not correct."*
  const bw = Math.min(4.4, (wide[1] - wide[0]) - 0.6), bh = 0.58;
  at((wide[0] + wide[1]) / 2, top - 0.26 - bh / 2, sheet(bw, bh, (g, W, H) => {
    g.fillStyle = GYM_CREAM; g.fillRect(0, 0, W, H);
    const bar = Math.max(2, Math.round(H * 0.09));
    g.fillStyle = GYM_MAGENTA;
    g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    fitInk(g, 'ONE FEE · EVERY MACHINE', 'monospace', W * 0.84, Math.round(H * 0.42));
    g.fillStyle = GYM_MAGENTA; g.fillText('ONE FEE · EVERY MACHINE', W / 2, H * 0.40);
    fitInk(g, 'FULL SEASON $120', 'monospace', W * 0.62, Math.round(H * 0.2));
    g.fillStyle = GYM_TEAL; g.fillText('FULL SEASON $120', W / 2, H * 0.76);
  }));
  // ── the small print, the other side of the door ─────────────────────────
  const lw = Math.min(2.2, (narrow[1] - narrow[0]) - 0.4), lh = 0.4;
  const bills = ['DAY PASS $15', 'WEIGHTS · BAG · ROWER'];
  bills.forEach((t, i) => {
    at((narrow[0] + narrow[1]) / 2, top - 0.30 - lh / 2 - i * (lh + 0.04), sheet(lw, lh, (g, W, H) => {
      g.fillStyle = GYM_CREAM; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 2, W, 2);
      fitInk(g, t, 'monospace', W * 0.88, Math.round(H * 0.42));
      g.fillStyle = i ? GYM_TEAL : GYM_MAGENTA; g.fillText(t, W / 2, H * 0.5);
    }));
  });
  // ── the OPEN card on the leaf, where every shop door has one ────────────
  at(F.doorCentreM - F.doorWidthM / 2 + 0.39, F.glazingTopM - 0.95 - 0.13, openCard(GYM_MAGENTA));
}

/**
 * THE MATTRESS SHOWROOM — *"make the liquor store a mattress store."*
 *
 * Character: a shop whose entire sales pitch is THE STOCK, seen through glass.
 * A liquor store defends its window; a showroom gives it away. So this is the
 * most glass on the block (BANDS.mattress, the smallest inset and the lowest
 * sill on the street), lit from inside, with three beds standing in it.
 *
 * WHY THE BEDS ARE THE WHOLE JOB. At 8 px/m a fascia is four or five legible
 * letters and nothing else on this street reads its name from the far pavement.
 * "Unmistakably a mattress store" therefore cannot rest on the word MATTRESS —
 * it has to rest on SILHOUETTE, and a mattress is one of the most recognisable
 * silhouettes there is: a pale slab, thicker than a shelf and thinner than a
 * table, lying on a darker base, with a pillow cocked at one end. Three of them
 * in a row, at different heights, is a bed shop from across the road whether or
 * not you can read a word.
 *
 * The palette is deliberately WARMER than the wine red it replaces (#8a2c42 was
 * chosen to say liquor, and says it well). Rust and cream, with the one blue
 * accent that every discount showroom of the period had somewhere in it.
 *
 * `SLEEP CENTER` rather than the literal word: the neighbours are A-1 TAX and
 * PAWN — plain, working, slightly desperate — and MATTRESS DISCOUNTERS would be
 * a chain on an arterial, not a 13 m slot between a tax office and a pawnshop.
 * The word itself goes where a showroom actually puts it, hand-lettered across
 * the glass on a sale banner.
 */
export const mattressFront = (brick: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf('SLEEP CENTER', wM);
  // RUST is the roster colour; keep the two in step or the mouldings that
  // `shopfrontRelief` stands off the wall will frame a fascia of another shade.
  const RUST = SLEEP_RUST;
  const ALU = '#8f938f', ROOM = '#43413c';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // ── the fascia: a painted board, not cloth and not a light box ────────
    // …with a cream keyline inset from its edge — signwriter's habit, and it
    // stops a flat 13 m rectangle of one colour reading as a bar
    const B = BANDS.mattress;
    const fy = m(B.fy), fh = m(B.fh);
    fasciaArt(g, surf, {
      x: 0, y: fy, w: W, h: fh, name: 'SLEEP CENTER', trim: RUST,
      doorX: m(doorAlongU('SLEEP CENTER', wM, F.doorCentreM)),
    });
    // ── the opening: as much glass as the band will give ─────────────────
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#241f1a'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, ROOM);
    // A SHOWROOM IS LIT, and that is why you can see into it at all. Two things
    // sell it: the ceiling is brighter than the floor, and the floor throws the
    // light back — a showroom has a hard pale floor, not a shop's dark boards.
    g.fillStyle = 'rgba(255,246,224,0.30)'; g.fillRect(gx, gy, gw, m(0.34));       // ceiling wash
    g.fillStyle = 'rgba(226,220,205,0.22)'; g.fillRect(gx, gy + gh - m(0.9), gw, m(0.9)); // pale floor
    // the strip lights themselves, receding — three of them, evenly along
    for (let i = 0; i < 3; i++) {
      const lx = gx + m(0.6) + i * Math.round((gw - m(1.2)) / 3);
      g.fillStyle = 'rgba(255,250,235,0.55)';
      g.fillRect(lx, gy + m(0.16), Math.round((gw - m(1.2)) / 3) - m(0.5), Math.max(1, m(0.09)));
    }
    // ── THE BEDS. Three, at three heights, so it reads as stock and not as
    // furniture. Drawn back-to-front: base, then mattress, then pillow, then
    // the shadow each throws on the pale floor.
    // THE BEDS OWN THE LOWER TWO THIRDS OF THE GLASS AND NOTHING IS DRAWN OVER
    // THEM. The first cut put the sale banner across the middle of the window at
    // the same height as the mattresses, and from the far pavement the stock
    // came out as three pale streaks behind a sign — the one thing that had to
    // read did not. Signage now lives in the top third, stock in the bottom two,
    // and they do not overlap at any width.
    const bedTop = gy + gh - m(1.34);           // where the highest bed's mattress starts
    const bedW = Math.min(m(3.1), (gw - m(1.2)) / 3);
    for (let i = 0; i < 3; i++) {
      const bx = gx + m(0.45) + i * ((gw - m(0.9) - bedW) / 2);
      // the middle one is a divan set (taller), the outer two are lower
      const lift = i === 1 ? m(0.22) : 0;
      const by = bedTop - lift;
      // Deeper than a real bed on purpose. At 16 px/m a 0.30 m mattress is five
      // texels and reads as a line; the silhouette is the whole point of the
      // shopfront, so it is drawn at the size it needs to be legible from the
      // opposite pavement, which is where the user will be standing.
      const baseH = m(0.55), matH = m(0.40);
      // headboard, behind everything — a strong vertical that says "bed" even
      // when the slab reads as a shelf
      g.fillStyle = i === 1 ? '#5b4a3c' : '#4e4238';
      g.fillRect(bx - m(0.06), by - m(0.52), m(0.16), baseH + matH + m(0.52));
      g.fillRect(bx + bedW - m(0.10), by - m(0.52), m(0.16), baseH + matH + m(0.52));
      // the shadow it throws, first
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(bx - m(0.06), by + baseH + matH, bedW + m(0.12), m(0.16));
      // base: a dark upholstered divan
      g.fillStyle = i === 1 ? '#4a3f38' : '#403a35';
      g.fillRect(bx, by + matH, bedW, baseH);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(bx, by + matH + baseH - m(0.1), bedW, m(0.1));
      // MATTRESS: the pale slab that does the whole job
      g.fillStyle = i === 1 ? '#f0ead8' : '#e6dfcb';
      g.fillRect(bx, by, bedW, matH);
      g.fillStyle = HI; g.fillRect(bx, by, bedW, Math.max(1, m(0.05)));      // lit top edge
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(bx, by + matH - m(0.05), bedW, m(0.05));
      // the quilted band down the side of a mattress — three stitch lines
      g.fillStyle = 'rgba(120,105,85,0.35)';
      for (let k = 1; k < 4; k++) g.fillRect(bx, by + Math.round(matH * k / 4), bedW, 1);
      // pillow, cocked at the end away from the door
      const pw = m(0.62), ph = m(0.2);
      const px = F.doorCentreM > wM / 2 ? bx + m(0.1) : bx + bedW - pw - m(0.1);
      g.fillStyle = '#faf4e4'; g.fillRect(px, by - ph + m(0.04), pw, ph);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(px, by - m(0.02), pw, m(0.06));
      // a price card on a wire, because that is what is on every bed in one
      g.fillStyle = '#fdfaf0'; g.fillRect(bx + bedW / 2 - m(0.22), by - m(0.62), m(0.44), m(0.3));
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(bx + bedW / 2 - m(0.22), by - m(0.32), m(0.44), m(0.04));
      g.fillStyle = '#a03020'; g.font = `bold ${m(0.16)}px monospace`;
      g.fillText('$', bx + bedW / 2, by - m(0.46));
    }
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 4.4)), ALU);
    // ── NO SIGNAGE IS PAINTED INTO THIS CANVAS ANY MORE ───────────────────
    // The sale banner, the two window bills and the door's OPEN card used to
    // be drawn here, and this canvas is 16 px/m. `MATTRESS SALE` came out
    // 52 texels wide — FOUR texels a character — so canvas antialiasing had
    // nothing but fringe to work with and NearestFilter blew each fringe up
    // into a 6 cm grey stroke: *"mattress storefront looks like shit"*
    // (2026-08-11), the banner soft and smeared, the bills unreadable blobs
    // and the door card a pink smudge. That is exactly the disease commit
    // 98fa9f77 cured INSIDE this shop, and no font size fixes it — the texels
    // are not there to fix it with.
    //
    // Paper is not brick and does not have to live on brick's canvas. The
    // signage is now real taped-up sheets standing 2 cm proud of the glass at
    // 200 px/m — `sleepWindowSigns()` below, hung by `shopfrontRelief` — which
    // is the density the BUSINESS HOURS placard beside the door already reads
    // at, and that card is the one crisp thing in the user's screenshot.
    // ── the door, where the frontage says it is ──────────────────────────
    const dcM = doorAlongU('SLEEP CENTER', wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = ALU; g.fillRect(dx - m(0.08), gy, dw + m(0.16), gh);
    g.fillStyle = SH; g.fillRect(dx - m(0.08), gy, m(0.08), gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.5), ROOM);
    g.fillStyle = 'rgba(255,246,224,0.16)'; g.fillRect(dx, gy + m(0.12), dw, m(0.4));
    g.fillStyle = ALU; g.fillRect(dx, gy + m(0.66), dw, 1);                     // transom
    g.fillStyle = '#6e726e'; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.55));    // kick plate
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.06));
    g.fillStyle = ALU; g.fillRect(dx + dw - m(0.2), gy + m(1.45), m(0.07), m(0.4));  // push bar
    // (the OPEN card on the leaf is a proud plane now — see the note above)
    // ── stallriser: a low painted board, panelled like the block default ──
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#7a5340');
    g.fillStyle = 'rgba(0,0,0,0.24)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.6));
    for (let i = 1; i < panels; i++)
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.06), Math.max(1, m(0.07)), rh - m(0.12));
    g.fillStyle = 'rgba(30,26,20,0.30)'; g.fillRect(ox, H - m(0.16), ow, m(0.16));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};

/**
 * VOLT VILLAGE — *"replace 'radio' with an electronics shop."*, then
 * *"name the electronics shop volt village"* (2026-08-05).
 *
 * ⚠ THE FASCIA PRINTS `nm`, NOT A STRING TYPED HERE. It always took the name as
 * an argument and always ignored it, printing its own copy — so the shop had
 * two names in two files and a rename had to find both. It prints what it is
 * given now, which is what the parameter was for. The identifiers below stay
 * `electro`/`electroFront` on purpose: they name the KIND of frontage — an
 * electronics showroom, lit screens behind glass — not the trading name, and
 * the whole point of this change is that the trading name lives in one place.
 *
 * THE WALL OF TELEVISIONS IS THE WHOLE FRONT. Everything else here is in
 * service of it. A 1997 electronics discounter is recognised from the far
 * pavement by one thing: a grid of lit screens, all showing the SAME picture,
 * stacked three high behind plate glass. Draw that and nobody needs to read a
 * word; draw a fascia and a dark window and it is a barber's again.
 *
 * So the screens are drawn at the size they need to be legible rather than at
 * scale — the same argument mattressFront's beds are drawn at — and the stock
 * owns the glass. The hi-fi tower and the camcorder shelf are one column and
 * one row of small dark blocks with a glint each: they say "and the other two
 * things this shop sells" and they are not allowed to be more than that.
 *
 * GRAPHITE AND RED. `col` in ct/street.ts is the same graphite because it is
 * also the projecting joinery — keep the two in step or the mouldings frame a
 * fascia of another shade. The screens are the only bright thing, which is
 * exactly right: in a shop like this the merchandise IS the lighting.
 */
const electroFront = (brick: string, nm: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf(nm, wM);
  const GRAPHITE = VOLT_GRAPHITE, RED = VOLT_RED, SILVER = '#9aa0a6';
  const ROOM = '#1a1c20', SCREEN = '#5f8fa8';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // ── the fascia: a backlit box, not a painted board ────────────────────
    // CAPPED AT 0.5 m, NEVER GROWN TO THE WIDTH — so the casino marquee's trap
    // (short text auto-grows until it hits the rule above it) cannot happen
    // here. `fitInk` only ever shrinks, and the budget runs the other way and
    // is enormous: 12 monospace characters at a 0.6 em advance is ~3.6 m of
    // lettering on a 12 m fascia, 30% of it.
    const B = BANDS.electro;
    const fy = m(B.fy), fh = m(B.fh);
    fasciaArt(g, surf, {
      x: 0, y: fy, w: W, h: fh, name: nm, trim: GRAPHITE,
      doorX: m(doorAlongU(nm, wM, F.doorCentreM)),
    });
    // ── the opening ───────────────────────────────────────────────────────
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#17191d'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, ROOM);
    // ── THE SCREENS. Three rows on a shelf stack, every one the same frame.
    const cols = Math.max(4, Math.round(wM / 1.5)), rows = 3;
    const cw = (gw - m(0.5)) / cols, chh = m(0.62);
    const sx0 = gx + m(0.25), sy0 = gy + m(0.5);
    for (let r = 0; r < rows; r++) {
      const sy = sy0 + r * (chh + m(0.24));
      if (sy + chh > gy + gh - m(0.1)) break;
      // the shelf the row stands on — a dark bar under the sets
      g.fillStyle = '#2f3238'; g.fillRect(gx + m(0.1), sy + chh, gw - m(0.2), m(0.12));
      for (let c = 0; c < cols; c++) {
        const sx = sx0 + c * cw;
        g.fillStyle = '#26282c'; g.fillRect(sx, sy, cw - m(0.14), chh);          // the cabinet
        // THE PICTURE, and every set carries the same one — that is the tell.
        // Two bands and a bright block: a test card at eight texels tall.
        const px = sx + m(0.06), py = sy + m(0.06);
        const pw = cw - m(0.26), ph = chh - m(0.18);
        g.fillStyle = SCREEN; g.fillRect(px, py, pw, ph);
        g.fillStyle = 'rgba(240,250,255,0.55)'; g.fillRect(px, py, pw, Math.max(1, ph * 0.34));
        g.fillStyle = 'rgba(200,60,40,0.45)'; g.fillRect(px, py + ph - Math.max(1, ph * 0.22), pw, Math.max(1, ph * 0.22));
        g.fillStyle = HI; g.fillRect(px, py, pw, 1);
      }
    }
    // ── the hi-fi tower, one end, UNDER the screen wall ───────────────────
    // Same lesson the mattress front learned the hard way: stock does not get
    // drawn over stock. The screens own the upper glass, so the separates stack
    // sits below the lowest shelf, and the price card goes to the OPPOSITE end
    // so the two can never collide whatever width or door side this front gets.
    const towerLeft = F.doorCentreM > wM / 2;
    const tw = m(0.7), tx = towerLeft ? gx + m(0.3) : gx + gw - tw - m(0.3);
    let ty = gy + gh - m(1.05);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i === 1 ? '#34383e' : '#2b2e33';
      g.fillRect(tx, ty, tw, m(0.2));
      g.fillStyle = i % 2 ? 'rgba(90,190,220,0.7)' : 'rgba(230,120,40,0.7)';   // the one lit dot
      g.fillRect(tx + tw - m(0.16), ty + m(0.07), m(0.07), m(0.06));
      ty += m(0.24);
    }
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 4.4)), SILVER);
    // The price card is `voltWindowSigns` now. Painted here it was the worst
    // sign on the block — m(0.2) is a three-texel font, 1.8 texels of ink a
    // glyph — and it started one texel off the door frame with no clearance.
    // ── the door ──────────────────────────────────────────────────────────
    const dcM = doorAlongU(nm, wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = SILVER; g.fillRect(dx - m(0.08), gy, dw + m(0.16), gh);
    g.fillStyle = SH; g.fillRect(dx - m(0.08), gy, m(0.08), gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.5), ROOM);
    g.fillStyle = SILVER; g.fillRect(dx, gy + m(0.66), dw, 1);                  // transom
    g.fillStyle = '#6e726e'; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.55));    // kick plate
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.06));
    g.fillStyle = SILVER; g.fillRect(dx + dw - m(0.2), gy + m(1.45), m(0.07), m(0.4));
    // the OPEN card on the leaf is `voltWindowSigns` — m(0.16) was 1.8 texels
    // of ink a glyph, which is not a word, it is four smudges
    // ── stallriser: a dark painted board, panelled like the block default ─
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#3a3d42');
    g.fillStyle = 'rgba(0,0,0,0.24)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.6));
    for (let i = 1; i < panels; i++)
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.06), Math.max(1, m(0.07)), rh - m(0.12));
    g.fillStyle = 'rgba(30,26,20,0.30)'; g.fillRect(ox, H - m(0.16), ow, m(0.16));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};

/**
 * VIDEO HUT — *"replace deli and records with a video hut."* The two were
 * adjacent, so their 9.5 and 8.5 became one 18 m front and this painter has the
 * widest shopfront on the side street to fill.
 *
 * WHAT MAKES IT A VIDEO SHOP AND NOT A SHOP: the racked spines. A rental floor
 * of 1997 is a wall of identical clamshell boxes stood on end, and at any
 * distance that is a row of coloured ticks with a dark bar under each shelf.
 * That pattern is the entire read; it is drawn full width and nothing crosses
 * it. The posters in the glass are the second signal and they live at the ends,
 * where they cannot sit in front of the racks.
 *
 * BLUE AND YELLOW, because that is what a video rental was, everywhere, and the
 * green that said deli and the purple that said records both had to go. The
 * roster `col` is this same blue — it is the joinery as well as the fascia.
 *
 * A DEEP FASCIA (BANDS.video, the deepest on the block after the burger barn):
 * the sign is the shop. Nine characters across 18 m is a big, calm word, which
 * is the difference between this and a fast-food front shouting at the same
 * size.
 */
const videoFront = (brick: string, nm: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf(nm, wM);
  const BLUE = VIDEO_BLUE, ALU = '#8f938f', ROOM = '#3a3630';
  // the spines: five stock colours, cycled. Not random — a rack reads as a rack
  // because the same few boxes repeat, and rnd() here would re-grain every
  // texture created after it (GOTCHAS §31).
  const SPINE = ['#b8402c', '#2f6ea8', '#c8a230', '#4a7a4a', '#8a4a7a'];
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // ── the fascia ────────────────────────────────────────────────────────
    const B = BANDS.video;
    const fy = m(B.fy), fh = m(B.fh);
    fasciaArt(g, surf, {
      x: 0, y: fy, w: W, h: fh, name: 'VIDEO HUT', trim: BLUE,
      doorX: m(doorAlongU(nm, wM, F.doorCentreM)),
    });
    // ── the opening ───────────────────────────────────────────────────────
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#241f1a'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, ROOM);
    // a rental floor is fluorescent-lit and that is why you can see the racks
    g.fillStyle = 'rgba(255,250,230,0.26)'; g.fillRect(gx, gy, gw, m(0.3));
    // ── THE RACKS. Two banks of shelves, spines stood on end. ─────────────
    const bankTop = gy + m(0.62), shelfH = m(0.72), sw = m(0.17);
    for (let r = 0; r < 3; r++) {
      const sy = bankTop + r * (shelfH + m(0.16));
      if (sy + shelfH > gy + gh - m(0.1)) break;
      const boxH = shelfH - m(0.14);
      for (let x = gx + m(0.3); x < gx + gw - m(0.3); x += sw + Math.max(1, m(0.03))) {
        const i = Math.round((x - gx) / (sw + m(0.03)));
        g.fillStyle = SPINE[i % SPINE.length];
        g.fillRect(x, sy, sw, boxH);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, sy + m(0.06), sw, Math.max(1, m(0.04)));
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + sw - 1, sy, 1, boxH);
      }
      // the shelf board, and the shadow the row above throws onto it
      g.fillStyle = '#4a4038'; g.fillRect(gx + m(0.2), sy + boxH, gw - m(0.4), m(0.1));
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(gx + m(0.2), sy + boxH + m(0.1), gw - m(0.4), m(0.05));
    }
    // The NEW RELEASES header is `videoWindowSigns` now. Centred on the whole
    // glazed run and painted before the door, it was ERASED by it: the room
    // declares this door dead centre of an 18 m front, so five texels of the
    // header survived at each end of a 1.5 m word.
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 4.4)), ALU);
    // ── two posters taped inside the glass, at the ENDS, clear of the racks
    const pw = m(1.15), ph = m(1.7);
    for (const at of [0.03, 0.97 - pw / gw]) {
      const px = gx + Math.round(gw * at), py = gy + m(0.9);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px + m(0.05), py + m(0.06), pw, ph);
      g.fillStyle = '#e8e0cc'; g.fillRect(px, py, pw, ph);
      g.fillStyle = at < 0.5 ? '#2f3d6a' : '#6a2f33'; g.fillRect(px + m(0.07), py + m(0.07), pw - m(0.14), ph * 0.62);
      g.fillStyle = 'rgba(240,235,215,0.6)';                                    // the title bar
      g.fillRect(px + m(0.14), py + ph * 0.72, pw - m(0.28), m(0.12));
      g.fillRect(px + m(0.22), py + ph * 0.82, pw - m(0.44), m(0.08));
      g.fillStyle = 'rgba(0,0,0,0.16)';                                         // tape
      for (const tx of [px - m(0.04), px + pw - m(0.12)])
        for (const ty of [py - m(0.04), py + ph - m(0.1)]) g.fillRect(tx, ty, m(0.18), m(0.12));
    }
    // The rental card is `videoWindowSigns` too — centred on the same glazed
    // run, cut mid-word by the same door.
    // ── the door ──────────────────────────────────────────────────────────
    const dcM = doorAlongU(nm, wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    g.fillStyle = ALU; g.fillRect(dx - m(0.08), gy, dw + m(0.16), gh);
    g.fillStyle = SH; g.fillRect(dx - m(0.08), gy, m(0.08), gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.5), ROOM);
    g.fillStyle = 'rgba(255,250,230,0.16)'; g.fillRect(dx, gy + m(0.12), dw, m(0.4));
    g.fillStyle = ALU; g.fillRect(dx, gy + m(0.66), dw, 1);                     // transom
    g.fillStyle = '#6e726e'; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.55));    // kick plate
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.55), dw, m(0.06));
    g.fillStyle = ALU; g.fillRect(dx + dw - m(0.2), gy + m(1.45), m(0.07), m(0.4));
    // the return slot every rental shop has beside its door
    g.fillStyle = '#2a2d33'; g.fillRect(dx + dw + m(0.24), gy + m(1.3), m(0.46), m(0.5));
    g.fillStyle = '#111316'; g.fillRect(dx + dw + m(0.3), gy + m(1.4), m(0.34), m(0.09));
    // the OPEN card on the leaf is `videoWindowSigns`
    // ── stallriser ────────────────────────────────────────────────────────
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#17427a');
    g.fillStyle = 'rgba(0,0,0,0.24)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.6));
    for (let i = 1; i < panels; i++)
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.06), Math.max(1, m(0.07)), rh - m(0.12));
    g.fillStyle = 'rgba(30,26,20,0.30)'; g.fillRect(ox, H - m(0.16), ow, m(0.16));
    dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
  });
};

/**
 * CROSSTOWN FITNESS — teal and magenta, because 1997 fitness is teal and
 * magenta and the roster already says so. `gym`/`gymFront` names the KIND of
 * frontage, like `electro` — the trading name comes in through `nm`.
 *
 * THE MACHINES AT THE GLASS ARE THE WHOLE FRONT. A 1997 gym is recognised
 * from the far pavement by one thing: a row of cardio machines lined up in
 * the window facing the street, under cold strip light — the shop where the
 * stock is people working. So the bikes and treadmills own the glass, dark
 * silhouettes against the lit room, and the magenta stripe running across the
 * back wall behind them is the aerobics-studio wall doing the shouting.
 *
 * GEOMETRY IS BANDS.default ON PURPOSE, not a band of its own: ct/int-gym.ts
 * derived its room off the default character's door hash (its comments carry
 * the numbers — doorFrac 0.34, doorCentreM 4.446), and `characterOf` keeps
 * answering 'default' so `shopfrontRelief`'s mouldings, `layoutOf`'s door and
 * the room all stay exactly where they were. Same contract as the fasciaArt
 * branch above the switch, stated at both ends.
 *
 * COLD LIGHT, NOT WARM. Every quiet shop on the block glows tungsten-warm
 * behind its glass; a gym is fluorescent, and the blue-white strip is half of
 * what says "gym" before you can read a word.
 */
const gymFront = (brick: string, nm: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf(nm, wM);
  const ROOM = '#2c3032', DK = '#191d1f', STEEL = '#41464a';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // ── the fascia: the teal light box, same art the applied board wears ──
    const B = BANDS.default;
    const fy = m(B.fy), fh = m(B.fh);
    const bd = fasciaBoardPx(nm, W, m);
    fasciaArt(g, surf, {
      x: bd.x, y: fy, w: bd.w, h: fh, name: nm, trim: GYM_TEAL,
      doorX: m(doorAlongU(nm, wM, F.doorCentreM)),
    });
    // ── the opening ───────────────────────────────────────────────────────
    const ox = m(B.ox), oy = fy + fh + m(B.og), ow = W - m(2 * B.ox), oh = H - oy - m(0.05);
    g.fillStyle = '#1d2124'; g.fillRect(ox, oy, ow, oh);
    reveal(g, surf, ox, oy, ow, oh);
    const gx = ox + m(B.gi), gy = oy + m(B.gi), gw = ow - m(2 * B.gi), gh = oh - m(B.sg);
    glazed(g, surf, gx, gy, gw, gh, ROOM);
    // the strip light: blue-white and even, falling off downward
    g.fillStyle = 'rgba(225,240,248,0.30)'; g.fillRect(gx, gy, gw, m(0.24));
    g.fillStyle = 'rgba(225,240,248,0.12)'; g.fillRect(gx, gy + m(0.24), gw, m(0.42));
    // the back wall, full width — it is the room — with the aerobics stripe
    g.fillStyle = '#3a3e3e'; g.fillRect(gx, gy + m(0.85), gw, m(1.2));
    g.fillStyle = GYM_MAGENTA; g.fillRect(gx, gy + m(1.18), gw, m(0.12));
    g.fillStyle = 'rgba(242,237,224,0.5)'; g.fillRect(gx, gy + m(1.30), gw, Math.max(1, m(0.03)));
    // rubber floor, darkest, so the eye reads depth downward
    g.fillStyle = '#1f2222'; g.fillRect(gx, gy + gh - m(0.4), gw, m(0.4));
    // ── THE MACHINES, in the runs the door leaves. They are furniture and
    //    stop at it — the block default's shelf learned that the hard way. ──
    const dcM = doorAlongU(nm, wM, F.doorCentreM);
    const dw = m(F.doorWidthM), dx = m(dcM - F.doorWidthM / 2);
    const dL = dx - m(0.07), dR = dx + dw + m(0.07);
    const runs = ([[gx, Math.min(dL, gx + gw)], [Math.max(dR, gx), gx + gw]] as [number, number][])
      .filter(([a, c]) => c - a >= m(1.6));
    const by = gy + gh - m(0.16);                      // the floor line they stand on
    const bike = (bx: number) => {
      g.fillStyle = DK;
      g.fillRect(bx, by - m(0.08), m(1.05), m(0.08));                       // base rail
      g.fillRect(bx + m(0.14), by - m(1.10), Math.max(1, m(0.07)), m(1.02)); // console mast
      g.fillRect(bx + m(0.72), by - m(0.92), Math.max(1, m(0.07)), m(0.84)); // seat post
      g.fillRect(bx + m(0.02), by - m(1.18), m(0.34), m(0.10));             // handlebars
      g.fillRect(bx + m(0.62), by - m(0.98), m(0.28), m(0.08));             // saddle
      g.beginPath(); g.ellipse(bx + m(0.32), by - m(0.34), m(0.20), m(0.20), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2e3336';                                              // flywheel hub
      g.beginPath(); g.ellipse(bx + m(0.32), by - m(0.34), m(0.09), m(0.09), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,220,140,0.85)';                                // console LED
      g.fillRect(bx + m(0.10), by - m(1.16), Math.max(1, m(0.06)), Math.max(1, m(0.05)));
    };
    const tread = (bx: number) => {
      g.fillStyle = DK;
      g.fillRect(bx, by - m(0.14), m(1.45), m(0.14));                       // the deck
      g.fillRect(bx + m(0.10), by - m(1.25), Math.max(1, m(0.07)), m(1.11)); // mast
      g.fillRect(bx + m(0.02), by - m(1.34), m(0.44), m(0.10));             // console bar
      g.fillStyle = '#2e3336'; g.fillRect(bx + m(0.10), by - m(0.11), m(1.28), Math.max(1, m(0.04))); // belt
      g.fillStyle = 'rgba(220,80,60,0.85)';                                 // readout
      g.fillRect(bx + m(0.30), by - m(1.32), Math.max(1, m(0.08)), Math.max(1, m(0.05)));
    };
    let mi = 0;
    for (const [a, c] of runs) {
      for (let bx = a + m(0.25); bx + m(1.5) <= c - m(0.1); bx += m(1.8)) {
        (mi++ % 2 ? tread : bike)(bx);
      }
    }
    mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 3.4)), STEEL);
    // ── the door: the default's bones, refit in the livery ────────────────
    g.fillStyle = STEEL; g.fillRect(dL, gy, dR - dL, gh);
    glazed(g, surf, dx, gy + m(0.12), dw, gh - m(0.95), ROOM);
    g.fillStyle = GYM_TEAL; g.fillRect(dx, gy + gh - m(0.83), dw, m(0.83));  // its panel
    g.fillStyle = HI; g.fillRect(dx, gy + gh - m(0.83), dw, m(0.06));
    g.fillStyle = '#9aa0a6'; g.fillRect(dx + dw - m(0.2), gy + m(1.45), Math.max(1, m(0.08)), m(0.26));
    // ── stallriser: the teal gone dark and scuffed at the pavement ────────
    const ry = gy + gh, rh = H - ry - m(0.05);
    proud(g, surf, ox, ry, ow, rh, '#0f4a44');
    g.fillStyle = 'rgba(0,0,0,0.24)';
    const panels = Math.max(2, Math.round(ow / surf.ppm / 1.6));
    for (let i = 1; i < panels; i++)
      g.fillRect(ox + Math.round((ow * i) / panels), ry + m(0.06), Math.max(1, m(0.07)), rh - m(0.12));
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
  const STEEL = DINER_STEEL, STEEL_D = DINER_STEEL_D, CREAM = '#e8e2d2', VINYL = DINER_VINYL;
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // stainless fascia, fluted — horizontal lines are what read as pressed
    // metal rather than painted board, and they cost two texels each
    // …and applied letters over it: a shadow under them is what makes them sit
    // ON the metal rather than in it
    const B = BANDS.diner;
    const fy = m(B.fy), fh = m(B.fh);
    fasciaArt(g, surf, {
      x: 0, y: fy, w: W, h: fh, name: nm, trim: STEEL,
      doorX: m(doorAlongU(nm, wM, F.doorCentreM)),
    });
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
  const BOARD = awning || THRIFT_BOARD, CARD = THRIFT_CARD, INK = '#3a3026';
  const STOCK = ['#7a6a52', '#5a6a72', '#8a5a4a', '#6a7a5a', '#7a5a6a', '#8a7a52'];
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    // a painted board, sun-bleached unevenly across its OWN width — stepping
    // across the canvas at a fixed pitch overruns onto the brick whenever the
    // board is not a whole number of steps, which is the same
    // fragment-at-the-end fault as the window run below.
    const B = BANDS.thrift;
    const fy = m(B.fy), fh = m(B.fh);
    const bd = fasciaBoardPx(nm, W, m);
    fasciaArt(g, surf, {
      x: bd.x, y: fy, w: bd.w, h: fh, name: nm, trim: BOARD,
      doorX: m(doorAlongU(nm, wM, F.doorCentreM)),
    });
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
    // The cards themselves are `thriftWindowSigns`, hung as paper at 200 px/m
    // — `50c` and `ALL 1$` were 3 texels of ink a glyph on this canvas. Where
    // they hang is `thriftCardLayout`, read by both, because the mannequin
    // below stands in the gap between them and two places deciding that would
    // put a card over its head.
    const cardX = thriftCardLayout(F).map((c) => m(c.u));
    const cdw = m(THRIFT_CARD_W);
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

/**
 * CROSSTOWN COMMUNITY COLLEGE — a CIVIC front, not a shop.
 *
 * *"hey please improve the ourdoor facade of the community college … make it
 *  nice. a little quiant campus."*   (2026-08-09)
 *
 * The register is the library's and the church's — the block's two civic
 * anchors — without copying either: masonry openings punched in brick, cast
 * stone where they said stone, and the name CARVED, not signwritten. What
 * sells "campus" at 8 px/m is three things and this paints exactly those:
 *
 *   1. the NAME IN A STONE FRIEZE where every shop hangs a painted fascia —
 *      an institution's name is part of the building, not applied to it;
 *   2. TALL SASH WINDOWS in pairs with stone sills and lintels, WARM-LIT,
 *      because the whole building type reads at dusk as "evening classes";
 *   3. an AXIAL DOORCASE — stone pilasters, a fanlight, a 1.2 m double leaf —
 *      dead centre, on one line with the courtyard gate and path that
 *      `ct/college-yard.ts` builds in front of it.
 *
 * Geometry answers to BANDS.college through `frontageOf`, so the relief
 * mouldings and the room's door (ct/int-college.ts) frame what is painted.
 * MAROON is the roster colour and is spent only on the doors and the lamp
 * brackets — stone and brick carry everything else, which is the difference
 * between a college and a franchise.
 */
export const collegeFront = (brick: string, wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H } = surf, m = surf.m;
  const F = frontageOf('COMMUNITY COLLEGE', wM);
  const STONE = COLLEGE_STONE, STONE_D = COLLEGE_STONE_D, MAROON = '#6a2430';
  const GLOW = '#7a6238';                       // a lit classroom behind glass
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    surf.courses(g);
    const B = BANDS.college;
    const fy = m(B.fy), fh = m(B.fh);
    // ── the frieze: cast stone, name incised. The READABLE one is the applied
    // plane ct/college-yard.ts hangs over this at 64 px/m; this is what it
    // covers, and `fasciaArt` draws both so they cannot drift.
    const bd = fasciaBoardPx('COMMUNITY COLLEGE', W, m);
    fasciaArt(g, surf, {
      x: bd.x, y: fy, w: bd.w, h: fh, name: 'COMMUNITY COLLEGE', trim: STONE,
      doorX: m(F.doorCentreM),
    });
    // ── the doorcase, dead centre ───────────────────────────────────────────
    const dcM = F.doorCentreM, dwM = F.doorWidthM;
    const dL = m(dcM - dwM / 2), dR = m(dcM + dwM / 2), dw = dR - dL;
    const oy = fy + fh + m(B.og);                // head of the openings
    const pilW = m(0.34);
    proud(g, surf, dL - pilW, oy, pilW, H - oy - m(0.05), STONE);   // pilasters
    proud(g, surf, dR, oy, pilW, H - oy - m(0.05), STONE);
    proud(g, surf, dL - pilW - m(0.10), oy, dw + 2 * pilW + m(0.20), m(0.30), STONE);  // entablature
    g.fillStyle = STONE_D;                                          // its shadow line
    g.fillRect(dL - pilW - m(0.10), oy + m(0.30), dw + 2 * pilW + m(0.20), Math.max(1, m(0.06)));
    // the fanlight, warm, with radiating bars — the last window lit at night
    const fanY = oy + m(0.42), fanH = m(0.50);
    reveal(g, surf, dL, fanY, dw, fanH);
    g.fillStyle = GLOW; g.fillRect(dL + m(0.05), fanY + m(0.05), dw - m(0.10), fanH - m(0.10));
    g.fillStyle = 'rgba(40,30,20,0.75)';
    for (let i = 1; i < 4; i++)
      g.fillRect(dL + Math.round((dw * i) / 4), fanY + m(0.05), Math.max(1, m(0.05)), fanH - m(0.10));
    // the double leaf: maroon timber, glazed above the lock rail, panelled below
    const doorY = fanY + fanH + m(0.08), doorH = H - doorY - m(0.06);
    reveal(g, surf, dL, doorY, dw, doorH);
    g.fillStyle = MAROON; g.fillRect(dL + m(0.03), doorY, dw - m(0.06), doorH);
    g.fillStyle = 'rgba(255,240,220,0.14)'; g.fillRect(dL + m(0.03), doorY, dw - m(0.06), Math.max(1, m(0.05)));
    const stile = Math.max(1, m(0.06));
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(Math.round((dL + dR) / 2), doorY, stile, doorH);
    for (const lx of [dL + m(0.14), Math.round((dL + dR) / 2) + stile + m(0.08)]) {
      const lw = dw / 2 - m(0.25);
      g.fillStyle = GLOW; g.fillRect(lx, doorY + m(0.10), lw, m(0.85));          // vision glass
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(lx, doorY + m(1.05), lw, m(0.60));  // the panel
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(dL, H - m(0.30), dw, m(0.24));  // kick plates
    g.fillStyle = '#c8b06a';                                                     // brass pulls
    g.fillRect(Math.round((dL + dR) / 2) - m(0.16), doorY + m(1.12), Math.max(1, m(0.05)), m(0.28));
    g.fillRect(Math.round((dL + dR) / 2) + stile + m(0.11), doorY + m(1.12), Math.max(1, m(0.05)), m(0.28));
    // two lantern brackets on the pilasters, lit — evening classes
    for (const lx of [dL - pilW / 2, dR + pilW / 2]) {
      g.fillStyle = '#3a332a'; g.fillRect(lx - m(0.09), oy + m(0.85), m(0.18), m(0.30));
      g.fillStyle = '#f2c86a'; g.fillRect(lx - m(0.06), oy + m(0.90), m(0.12), m(0.20));
    }
    // ── the sash windows, two each side, warm-lit ───────────────────────────
    const winY = oy + m(0.22), winB = H - m(0.65);                  // head … sill
    const sillY = winB, winH = winB - winY;
    const westRun: [number, number] = [m(0.62), dL - pilW - m(0.10)];
    const eastRun: [number, number] = [dR + pilW + m(0.10), W - m(0.62)];
    for (const [a, b] of [westRun, eastRun]) {
      const run = b - a, ww = m(1.40), gap = (run - 2 * ww) / 3;
      for (let i = 0; i < 2; i++) {
        const x = Math.round(a + gap + i * (ww + gap));
        proud(g, surf, x - m(0.06), winY - m(0.14), ww + m(0.12), m(0.14), STONE);   // lintel
        reveal(g, surf, x, winY, ww, winH);
        g.fillStyle = '#efe8d4'; g.fillRect(x, winY, ww, winH);                       // frame
        const gx = x + m(0.07), gy2 = winY + m(0.07), gw2 = ww - m(0.14), gh2 = winH - m(0.14);
        glazed(g, surf, gx, gy2, gw2, gh2, GLOW);
        g.fillStyle = 'rgba(58,48,36,0.80)';                                          // sash bars
        for (let c = 1; c < 3; c++) g.fillRect(gx + Math.round((gw2 * c) / 3), gy2, Math.max(1, m(0.045)), gh2);
        for (let r = 1; r < 4; r++) g.fillRect(gx, gy2 + Math.round((gh2 * r) / 4), gw2, Math.max(1, m(0.045)));
        g.fillStyle = 'rgba(0,0,0,0.35)';                                             // meeting rail
        g.fillRect(gx, gy2 + Math.round(gh2 / 2) - 1, gw2, Math.max(2, m(0.08)));
        proud(g, surf, x - m(0.08), sillY, ww + m(0.16), m(0.12), STONE);             // sill
        g.fillStyle = STONE_D; g.fillRect(x - m(0.08), sillY + m(0.12), ww + m(0.16), Math.max(1, m(0.04)));
      }
    }
    // ── the plinth the whole front stands on ────────────────────────────────
    proud(g, surf, 0, H - m(0.28), W, m(0.23), STONE_D);
    g.fillStyle = 'rgba(28,24,18,0.30)'; g.fillRect(0, H - m(0.10), W, m(0.10));
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
