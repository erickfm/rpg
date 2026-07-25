import * as THREE from 'three';
import { pixTex, dither } from './paint';

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
export const WALL_PPM = 8;
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
    /** paint it. The canvas size is not the caller's to choose. */
    paint: (draw: (g: CanvasRenderingContext2D) => void) => pixTex(W, H, draw),
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
export function facadeTex(
  brick: string, floors: number, wMeters = 12,
  hMeters = wallHeight(floors), baseY = DEFAULT_BASE_Y, minCols = 2,
  sill0 = SKIRT_M,
): THREE.Texture {
  const surf = masonry(wMeters, hMeters, baseY);
  const { W, H, ppm } = surf;
  const m = (v: number) => Math.round(v * ppm);          // metres → texels
  const WIN_W = 1.5, WIN_H = 1.5, BAY_M = 2.75, SILL_M = 0.2, MARGIN_M = 1.0;
  const CORNICE_M = 0.5, CORNICE_SHADE_M = 0.2;
  return surf.paint((g) => {
    g.fillStyle = brick;
    g.fillRect(0, 0, W, H);
    surf.courses(g);
    g.fillStyle = '#8a7a62';
    g.fillRect(0, 0, W, m(CORNICE_M));
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, m(CORNICE_M), W, m(CORNICE_SHADE_M));
    // window bays: as many as fit at BAY_M pitch inside a margin each end
    const cols = Math.max(minCols, Math.floor((wMeters - 2 * MARGIN_M) / BAY_M));
    const slack = (wMeters - 2 * MARGIN_M - cols * BAY_M) / 2;
    const winW = m(WIN_W), winH = m(WIN_H);
    for (let f = 0; f < floors; f++) {
      // storey f counted from the BOTTOM, so a 4- and a 5-storey neighbour
      // share every window band they both have (seam finding 7)
      const sill = sill0 + f * FLOOR_M;                   // metres above the wall's foot
      const y = Math.round(H - (sill + WIN_H) * ppm);     // canvas y of the window head
      for (let c = 0; c < cols; c++) {
        const x = m(MARGIN_M + slack + c * BAY_M);
        const lit = ((f * 7 + c * 3) % 5) === 0;
        g.fillStyle = '#1a1c22';
        g.fillRect(x - 1, y - 1, winW + 2, winH + 2);
        g.fillStyle = lit ? '#c9a45e' : '#2e3a46';
        g.fillRect(x, y, winW, winH);
        if (!lit) { g.fillStyle = '#48586a'; g.fillRect(x + Math.round(winW / 2) - 1, y, Math.max(1, m(0.35)), winH); }
        else { g.fillStyle = '#8a6a3a'; g.fillRect(x, y + winH - m(0.6), winW, m(0.6)); }
        g.fillStyle = '#9a8a72';
        g.fillRect(x - 1, y + winH + 1, winW + 2, m(SILL_M));
      }
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
}

/** the shop ground-floor band, in metres. TALLER than the residential one
 *  (ENTRANCE.BAND_H): a commercial ground floor genuinely is, and when they
 *  shared 3.2 m the glazing came out 1.92 m — shorter than a doorway, which
 *  is what made every shop on the block read undersized. */
export const SHOP_BAND_H = 4.2;

/** Ground-floor bands run at 2× masonry density: they are the surfaces that
 *  have to render TEXT and one-texel stone arrises, and a shop's name at
 *  0.65 m of letter height is 5 texels at 1× — unreadable. An integer multiple
 *  keeps the texels square and keeps the course grid commensurate, so the
 *  brick either side of the fascia still lands on the same world lines as the
 *  wall above. Exported so `ct/street.ts`'s corner bay uses the same one. */
export const SHOP_MULT = 2;

export function shopfrontTex(brick: string, name: string, awning: string, wMeters = 12): THREE.Texture {
  const surf = masonry(wMeters, SHOP_BAND_H, 0, SHOP_MULT);
  const { W, H, ppm } = surf;
  const m = (v: number) => Math.round(v * ppm);
  // every dimension below is METRES of real shopfront, converted once
  const FASCIA_Y = 0.16, FASCIA_H = 0.89, FASCIA_SHADE = 0.16, LETTER_H = 0.65;
  const BAND_MAX = 12, BAND_INSET = 0.5;   // sign caps at 12 m of fascia
  const FRAME_X = 0.63, FRAME_Y = 1.13, GLASS_X = 0.88, GLASS_Y = 1.29;
  const GLASS_H = 2.59, TRANSOM_Y = 1.70, RISER_Y = 3.88, RISER_H = 0.32;
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    // the band's foot IS world y = 0, so its courses are the datum the wall
    // above continues from — same 0.5 m spacing, same lines
    surf.courses(g);
    const bandW = Math.min(W - m(2 * BAND_INSET), m(BAND_MAX)), bandX = Math.round((W - bandW) / 2);
    g.fillStyle = awning;
    g.fillRect(bandX, m(FASCIA_Y), bandW, m(FASCIA_H));
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(bandX, m(FASCIA_Y + FASCIA_H), bandW, m(FASCIA_SHADE));
    g.fillStyle = '#f2ead0';
    g.font = `bold ${m(LETTER_H)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, W / 2, m(FASCIA_Y + FASCIA_H / 2));
    g.fillStyle = '#141820';
    g.fillRect(m(FRAME_X), m(FRAME_Y), W - 2 * m(FRAME_X), H - m(FRAME_Y));   // frame
    g.fillStyle = '#3a3020';
    g.fillRect(m(GLASS_X), m(GLASS_Y), W - 2 * m(GLASS_X), m(GLASS_H));       // glazing
    g.fillStyle = '#c9a45e';
    g.fillRect(m(1.25), m(1.94), Math.round(W * 0.31), m(1.45));              // lit from inside
    g.fillStyle = '#5a6a7a';
    g.fillRect(Math.round(W * 0.6), m(GLASS_Y), m(0.75), m(GLASS_H));
    g.fillStyle = '#2a3440';
    g.fillRect(Math.round(W * 0.48), m(GLASS_Y), m(0.38), m(GLASS_H));        // the shop door
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(m(GLASS_X), m(TRANSOM_Y), W - 2 * m(GLASS_X), Math.max(1, m(0.08)));
    // the stallriser: the panelled bulkhead under the glass that every real
    // shopfront has and this one did not, so the glass ran into the pavement
    g.fillStyle = '#4a4034'; g.fillRect(m(FRAME_X), m(RISER_Y), W - 2 * m(FRAME_X), m(RISER_H));
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(m(FRAME_X), m(RISER_Y), W - 2 * m(FRAME_X), Math.max(1, m(0.08)));
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = m(1.38); x < W - m(1.25); x += m(1.5)) g.fillRect(x, m(RISER_Y + 0.08), Math.max(1, m(0.12)), m(0.24));
    dither(g, W, H, Math.round(wMeters * SHOP_BAND_H * 6));
  });
}

// ── three shopfronts that are NOT the block default ─────────────────────
//
// Everything else on the street wears shopfrontTex, which is the right
// neutral for a barber or a deli. These three are characters, and the
// spread between them is the point: the fast-food place is the loudest
// thing on the block, the tax office is the least designed, and the
// pawnshop is the most defended. All three keep the block's 8 px/m and the
// same band heights as shopfrontTex, so they line up with their neighbours.
// The three custom shop bands below were authored on a (wM*8) x 52 canvas —
// 8 x 12.38 px/m — while every other band on the block runs at the shared
// 2x masonry density. bandSurf() hands them the correct canvas and re-bases
// the coordinates they were drawn in: `bx`/`by` map an old texel onto the
// same WORLD position on the new one, so the art is unchanged and no painter
// here carries a px/m of its own.
const OLD_SB = 52;
const bandSurf = (wM: number) => {
  const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
  const oldW = Math.max(64, Math.round(wM * 8));
  return {
    surf, W: surf.W, H: surf.H,
    bx: (v: number) => Math.round(v * surf.W / oldW),
    by: (v: number) => Math.round(v * surf.H / OLD_SB),
  };
};
// 1997 fast food: saturated brand colours, a fascia twice the usual depth,
// and more glass than anyone else because you are supposed to see in.
export const burgerFront = (brick: string, wM: number) => {
  const { surf, W, H: SB, bx, by } = bandSurf(wM);
  // RED AND BEIGE, asked for twice. The scheme is these three: the fascia
  // red, the beige it is trimmed and lettered in, and the warm-but-not-
  // yellow interior. It used to run red + mustard (#e8a02a stripe, #f2d24a
  // letters, #e8c26a interior) and the mustard is what read as the second
  // colour — so all three moved together. Change them here, nowhere else.
  const BB_RED = '#c8302a', BB_BEIGE = '#e6dcc6', BB_INSIDE = '#e0d2b4';
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, SB);
    g.fillStyle = BB_RED; g.fillRect(0, 0, W, by(16));              // the big red fascia
    g.fillStyle = BB_BEIGE; g.fillRect(0, by(16), W, by(3));        // beige accent stripe
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, by(19), W, by(2));
    g.fillStyle = BB_BEIGE; g.font = `bold ${by(9)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BURGER BARN', W / 2, by(8));
    g.fillStyle = '#141820'; g.fillRect(bx(4), by(21), W - bx(8), by(31));
    g.fillStyle = BB_INSIDE; g.fillRect(bx(6), by(23), W - bx(12), by(25));   // lit right through
    g.fillStyle = '#8a6a4a';                                       // booths in silhouette
    for (let x = bx(10); x < W - bx(14); x += bx(17)) { g.fillRect(x, by(33), bx(7), by(12)); g.fillRect(x + bx(9), by(36), bx(5), by(9)); }
    g.fillStyle = BB_RED; g.fillRect(Math.round(W * 0.62), by(23), bx(12), by(12));   // menu board
    g.fillStyle = BB_BEIGE; g.fillRect(Math.round(W * 0.62) + bx(2), by(26), bx(8), 1);
    g.fillRect(Math.round(W * 0.62) + bx(2), by(29), bx(8), 1);
    g.fillStyle = '#2a3440'; g.fillRect(Math.round(W * 0.44), by(23), bx(4), by(25)); // door
    g.fillStyle = '#d8d0c0';                                        // window decals
    g.fillRect(bx(9), by(25), bx(10), by(4)); g.fillRect(W - bx(22), by(25), bx(12), by(4));
    g.fillStyle = '#8a3a24'; g.fillRect(bx(4), by(48), W - bx(8), by(4));    // stallriser
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(bx(4), by(48), W - bx(8), 1);
    dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
  });
};
// the pawnshop: barred glass, a hand-painted board, and the three balls
export const pawnFront = (brick: string, wM: number) => {
  const { surf, W, H: SB, bx, by } = bandSurf(wM);
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, SB);
    surf.courses(g);
    g.fillStyle = '#6a5a3a'; g.fillRect(bx(3), by(2), W - bx(6), by(11));  // a painted board, not a light box
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(bx(3), by(13), W - bx(6), by(2));
    g.fillStyle = '#e8dcc0'; g.font = `bold ${by(8)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PAWN', W / 2 - bx(12), by(7));
    g.font = `bold ${by(5)}px monospace`;
    g.fillText('LOANS  GOLD  TOOLS', W / 2 + bx(26), by(8));
    g.fillStyle = '#c9a45e';                                        // the three balls
    for (const b of [8, 14, 11]) g.beginPath(), g.arc(bx(b), b === 11 ? by(11) : by(6), by(2.4), 0, Math.PI * 2), g.fill();
    g.fillStyle = '#141820'; g.fillRect(bx(5), by(14), W - bx(10), by(38));
    g.fillStyle = '#2e2a26'; g.fillRect(bx(7), by(16), W - bx(14), by(32));  // dim, crowded window
    const junk = ['#8a3a2e', '#c9a45e', '#3a5a8a', '#8a8378', '#4a7a3a', '#7a3a6a'];
    for (let i = 0; i < Math.floor(W / bx(6)); i++) {
      g.fillStyle = junk[i % 6];
      g.fillRect(bx(9) + i * bx(6), by(20) + ((i * by(7)) % by(18)), bx(4), by(3) + (i % 4) * by(2));
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';                               // the security bars
    for (let x = bx(8); x < W - bx(8); x += bx(5)) g.fillRect(x, by(16), 1, by(32));
    g.fillRect(bx(7), by(24), W - bx(14), 1); g.fillRect(bx(7), by(38), W - bx(14), 1);
    g.fillStyle = '#3a3020'; g.fillRect(bx(5), by(48), W - bx(10), by(4));
    dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
  });
};
// the tax office: no sign worth the name, just a banner cable-tied over the
// brick and paper taped inside the glass. The least designed thing here.
export const taxFront = (brick: string, wM: number) => {
  const { surf, W, H: SB, bx, by } = bandSurf(wM);
  return surf.paint((g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, SB);
    surf.courses(g);
    // a vinyl banner, sagging a texel in the middle, grommets at the corners
    const bw = W - bx(14);
    g.fillStyle = '#d8d2c4'; g.fillRect(bx(7), by(3), bw, by(9));
    g.fillStyle = '#d8d2c4'; g.fillRect(bx(9), by(12), bw - bx(4), 1);   // the sag
    g.fillStyle = '#2c4a7a'; g.font = `bold ${by(7)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('A-1 TAX SERVICE', W / 2, by(7));
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const gx of [bx(8), W - bx(9)]) { g.fillRect(gx, by(4), 1, 1); g.fillRect(gx, by(10), 1, 1); }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(bx(7), by(13), bw, by(2));
    g.fillStyle = '#141820'; g.fillRect(bx(5), by(15), W - bx(10), by(37));
    g.fillStyle = '#cfd6c8'; g.fillRect(bx(7), by(17), W - bx(14), by(31));  // flat fluorescent interior
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = bx(12); x < W - bx(12); x += bx(22)) g.fillRect(x, by(19), bx(14), by(2)); // tube fittings
    // paper signs taped up inside, slightly off square
    const notes = ['REFUNDS', 'FAST', 'E-FILE'];
    g.font = `bold ${by(4)}px monospace`;
    notes.forEach((n, i) => {
      const nx = bx(10) + i * Math.round((W - bx(26)) / 3), ny = by(26) + (i % 2) * by(6);
      g.fillStyle = '#f2ead0'; g.fillRect(nx, ny, bx(18), by(8));
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(nx, ny + by(8), bx(18), 1);
      g.fillStyle = '#8a2c22'; g.fillText(n, nx + bx(9), ny + by(4));
    });
    g.fillStyle = '#2a3440'; g.fillRect(Math.round(W * 0.5), by(17), bx(4), by(31));   // door
    g.fillStyle = '#6a665e'; g.fillRect(bx(5), by(48), W - bx(10), by(4));
    dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
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
  return t;
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
  return pixTex(TREE_W, H, (g) => {
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
    // ragged edge: bite small notches out of the outline so it is never smooth
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.35;
      const d = 0.94 + r() * 0.22;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d,
                1 + r() * 2.2, 1 + r() * 2.0, 0, 0, Math.PI * 2);
      g.fill();
    }
    // two or three real sky holes, well inside the mass
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2, d = 0.25 + r() * 0.35;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d,
                1.2 + r() * 1.6, 1.0 + r() * 1.3, 0, 0, Math.PI * 2);
      g.fill();
    }
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
      // same ragged treatment as the crown so it belongs to the same tree
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + r() * 0.4;
        g.beginPath();
        g.ellipse(tx + Math.cos(a) * trx * (0.92 + r() * 0.2),
                  ty + Math.sin(a) * try_ * (0.92 + r() * 0.2),
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
  });
}

// the pit replaces a 2×2 block of sidewalk slabs: concrete rim at slab
// tone, joint shadows on the edges, soil inset — it FITS the grid
export function treePitTex(): THREE.Texture {
  return pixTex(38, 38, (g) => {
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
  });
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
  return pixTex(32, 48, (g) => {
    g.fillStyle = '#8a2c22';
    g.fillRect(12, 14, 8, 30);
    g.fillRect(8, 22, 16, 6);
    g.fillStyle = '#a83a2e';
    g.fillRect(12, 14, 3, 30);
    g.fillRect(11, 10, 10, 6);
    g.fillStyle = '#6a2018';
    g.fillRect(13, 44, 7, 2);
    dither(g, 32, 48, 60);
  });
}

export function pigeonSprite(): THREE.Texture {
  return pixTex(24, 24, (g) => {
    g.fillStyle = '#6a6e78';
    g.beginPath(); g.arc(12, 15, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4e58';
    g.beginPath(); g.arc(17, 10, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a45e';
    g.fillRect(20, 10, 3, 1);
    g.fillStyle = '#3a3e46';
    g.fillRect(6, 13, 6, 4);
  });
}

export function payphoneTex(): THREE.Texture {
  return pixTex(32, 64, (g) => {
    g.fillStyle = '#2c4a7a'; g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText('PHONE', 16, 9);
    g.fillStyle = '#8a8e94'; g.fillRect(2, 12, 28, 52);
    g.fillStyle = '#141820'; g.fillRect(6, 16, 20, 26);
    g.fillStyle = '#1c1e24'; g.fillRect(10, 46, 12, 14);
    dither(g, 32, 64, 60);
  });
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
  return pixTex(24, 14, (g) => {
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
  });
}

// Paper trash: flyers, handbills, folded sheets — gone soft and grey in the
// wet. Not "a newspaper": the note was "like paper. like flyers and stuff.
// folded paper trash wet from rain".
// Gutter paper is NOT newsprint-white. It has been rained on, walked on and
// ground into the road; it sits only a little lighter than wet asphalt.
export function paperTex(v: number): THREE.Texture {
  return pixTex(22, 16, (g) => {
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
  });
}

// nondescript flattened scraps — wrappers, cup, cardboard
export function scrapTex(v: number): THREE.Texture {
  return pixTex(14, 12, (g) => {
    const pal = [['#c9c2b2', '#a09884'], ['#8a6a4a', '#6a4f38'], ['#c0b0a0', '#93857a']][v % 3];
    g.fillStyle = pal[0]; g.fillRect(2, 3, 10, 7);
    g.fillStyle = pal[1]; g.fillRect(2, 8, 10, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, 10, 10, 1);
    dither(g, 14, 12, 14);
  });
}
