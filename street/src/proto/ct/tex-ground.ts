import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { ROAD_HALF, WALK } from './rng';

// ═══════════════════════════════════════════════════════════════════════════
// THE GROUND — the sidewalk, the kerb, the gutter, and the corner.
//
// Built off real construction rather than memory (US municipal standards,
// which is what a '97 American street would have been built to):
//
//   · Kerb reveal 6–7 in above the roadway, 6 in wide on top, and the top
//     arris is ROUNDED — NYSDOT 609 details call a 1–1½ in radius on the
//     face edge. Never a sharp 90°.
//   · Transverse contraction joints in curb & gutter at 10 ft (≈3 m); the
//     range across states is 6–20 ft. So: a cast joint every 3 m.
//   · A concrete GUTTER PAN between kerb and asphalt. Integral curb-and-
//     gutter pours the kerb and the first 6–24 in of the roadway as one
//     concrete structure, cross-sloped ~4% to the kerb so it drains to the
//     nearest catch basin. Its absence is why bare kerb-on-tarmac reads
//     wrong: there is always a lighter concrete strip at the kerb line.
//   · Kerb returns at a city intersection run 10–25 ft radius; the sidewalk
//     follows the return. Inside-of-bend returns are tighter.
//   · Kerb ramp: 36 in min clear width, 1:12 run, 1:10 flared sides (1991
//     ADA). Truncated-dome detectable warning is a post-2000 requirement —
//     a plain ramp with flared sides is the period-correct '97 detail.
//   · Catch basin at the corner low point: 2 ft × 3 ft cast-iron grate set
//     in the gutter with a hooded curb inlet.
//   · Sidewalk scoring joints on a ~1 m grid, with staining, patches and
//     the odd cracked flag.
//
// Texel density matches the rest of the ground art: 32 px/m (walkTex was
// already 64 px per 2 m block; the kerb and gutter hold the same scale
// across the joint, so nothing reads sharper than its neighbour).
// ═══════════════════════════════════════════════════════════════════════════

// ── dimensions ────────────────────────────────────────────────────────────
const CH = 0.0625;     // chamfer across the kerb's top arris (a rounded edge, faceted once)
const GW = 0.45;       // gutter pan width — 18 in, mid-range for a combination C&G
const GY_K = 0.006;    // gutter surface at the kerb (the flow line, lowest)
const GY_R = 0.018;    // gutter surface where it meets asphalt — a 2.7% cross-slope
const KBOT = -0.04;    // kerb face runs below grade so no angle can see under it
const KTEX = 0.15;     // world height the kerb texture spans, from KBOT up
const SEG = 3.0;       // cast joint spacing in kerb + gutter (10 ft)
const SEG_K = 12.0;    // the kerb sheet carries four of those joints, so the
                       // chipping doesn't repeat every 3 m down the block
const KPM = 64;        // px per metre on the kerb face and its arris — SQUARE
                       // texels. Deriving these from real metres is the whole
                       // point: a strip 0.15 m tall drawn at the same px count
                       // as one 3 m long crowds the grain 2.5× vertically, and
                       // at a grazing angle that crowding reads as a crawling
                       // black line rather than as staining.
const RAMP_H = 0.025;  // kerb reveal at the foot of the ramp (a ½ in lip — period-correct)
const RAMP_W = 0.6;    // half-width of the ramp run (1.2 m clear, over the 36 in minimum)
const RAMP_F = 0.9;    // flared side either side of the run

/** A texture for a strip thinner than ~0.3 m. Mipmaps are the crawl: a
 *  nearest-mipmap lookup across a face only a few screen pixels tall swaps
 *  level every frame as you walk. These surfaces are small on screen and
 *  deliberately low-detail, so drop the chain entirely. */
function thin(t: THREE.Texture): THREE.Texture {
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** how far the arris chamfer rises — scaled down where the kerb is ramped
 *  away, so the chamfer can never eat more than the reveal it sits on */
const rise = (h: number) => Math.min(0.03, h * 0.4);

/** The gutter pan's surface height, `d` metres out from the kerb line. The
 *  pan is cross-sloped, so anything laid IN it — litter, puddles — has to
 *  follow that slope or it ends up under the concrete. Exported because
 *  ct/props.ts drops decals in here and cannot otherwise know. */
export const gutterSurfaceY = (d: number) =>
  GY_K + (GY_R - GY_K) * Math.min(1, Math.max(0, d / GW));
/** how wide that pan is, from the kerb outward */
export const GUTTER_W = GW;

// ── the sidewalk sheet ────────────────────────────────────────────────────
// One 256 px tile = 8 m of walk at 32 px/m, so the scoring grid is 1 m and
// the staining doesn't repeat until you've walked eight paces past it. Every
// walk surface in the world shares this one canvas and maps it in WORLD
// space — that is what makes the slab grid line up across the corner instead
// of each slab restarting at its own mesh edge.
const WT = 256, WPM = 32; // px, px per metre

let walkSheet: HTMLCanvasElement | null = null;

function drawWalk(g: CanvasRenderingContext2D) {
  g.fillStyle = '#84817a';
  g.fillRect(0, 0, WT, WT);
  // flag-to-flag tone variation — no two pours the same age
  for (let sy = 0; sy < WT; sy += WPM) {
    for (let sx = 0; sx < WT; sx += WPM) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.06})` : `rgba(255,255,255,${(v - 0.5) * 0.09})`;
      g.fillRect(sx, sy, WPM, WPM);
    }
  }
  // staining: soft blotches, darker where water sits
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * WT, y = Math.random() * WT, r = 5 + Math.random() * 22;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, `rgba(46,42,36,${0.06 + Math.random() * 0.1})`);
    gr.addColorStop(1, 'rgba(46,42,36,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // patches: a couple of flags replaced with newer, paler concrete
  for (let i = 0; i < 3; i++) {
    const sx = Math.floor(Math.random() * 8) * WPM, sy = Math.floor(Math.random() * 8) * WPM;
    g.fillStyle = 'rgba(212,206,192,0.13)';
    g.fillRect(sx + 2, sy + 2, WPM - 4, WPM - 4);
  }
  // scoring joints — 1 m grid, 2 px (6 cm) of shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < WT; k += WPM) { g.fillRect(0, k, WT, 2); g.fillRect(k, 0, 2, WT); }
  // the odd cracked flag: a jagged run across one slab, stopping at the joints
  for (let i = 0; i < 3; i++) {
    const sx = Math.floor(Math.random() * 8) * WPM, sy = Math.floor(Math.random() * 8) * WPM;
    g.strokeStyle = 'rgba(0,0,0,0.34)';
    g.lineWidth = 1;
    g.beginPath();
    let cx = sx + 2, cy = sy + 3 + Math.random() * (WPM - 8);
    g.moveTo(cx, cy);
    while (cx < sx + WPM - 2) { cx += 3 + Math.random() * 5; cy += (Math.random() - 0.5) * 7; g.lineTo(cx, cy); }
    g.stroke();
  }
  dither(g, WT, WT, 900);
}

/** the shared sidewalk sheet — one canvas, one map per surface so each can
 *  carry its own world-space repeat/offset */
function walkMap(): THREE.Texture {
  if (!walkSheet) walkSheet = pixTex(WT, WT, drawWalk).image as HTMLCanvasElement;
  const t = new THREE.CanvasTexture(walkSheet);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// WORLD-space uv for the walk sheet. Every walk surface uses these two, so a
// slab joint on the side street is the same joint line as on the main drag.
// Phase is chosen to preserve the existing grid exactly: joints fall on
// integer x and half-integer z, which is where the tree pits were already cut.
const walkU = (x: number) => x / 8;
const walkV = (z: number) => (0.5 - z) / 8;

/** map for a rectangular walk top spanning the given world box */
export function walkTex(minX: number, maxX: number, minZ: number, maxZ: number): THREE.Texture {
  const t = walkMap();
  t.repeat.set((maxX - minX) / 8, (maxZ - minZ) / 8);
  t.offset.set(walkU(minX), 0.0625 - maxZ / 8);
  return t;
}

// ── the kerb face ─────────────────────────────────────────────────────────
// 768 × 10 px = 12 m × 0.15 m, i.e. 64 px/m across and 67 px/m up: square
// texels, so the grain never crowds. Read against walkTex's #84817a: the face
// is DARKER and greyer than the walk top it caps — it is a vertical surface
// under an overcast sky, it catches less light. The highlight lives on the
// arris strip, not here.
const KW = Math.round(SEG_K * KPM), KH = 10;

function kerbTex(): THREE.Texture {
  const t = pixTex(KW, KH, (g) => {
    const band = (y0: number, y1: number, c: string) => { g.fillStyle = c; g.fillRect(0, y0, KW, y1 - y0); };
    band(0, 1, '#8f8a81');   // just under the arris
    band(1, 3, '#746f66');   // face
    band(3, 5, '#6e6960');
    band(5, 7, '#5f5a52');   // stained bottom third, where the road throws grit at it
    band(7, 10, '#433f38');  // below grade — buried under the gutter pan
    // cast joints every 3 m, the whole depth of the pour
    for (let j = 0; j < SEG_K / SEG; j++) {
      const x = Math.round(j * SEG * KPM);
      g.fillStyle = '#4a463f'; g.fillRect(x, 0, 2, KH);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, 0, 1, KH);
    }
    // Staining only, in patches wide enough to still be many texels across
    // when the face is seen end-on. NO dither and no single-texel marks: on a
    // strip this thin they alias into a crawling line rather than reading as
    // grime. Large features are the only kind that survive here.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(Math.random() * KW), h = 2 + Math.floor(Math.random() * 3);
      g.fillStyle = `rgba(40,36,30,${0.10 + Math.random() * 0.12})`;
      g.fillRect(x, KH - h - 3, 10 + Math.floor(Math.random() * 26), h);
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle = 'rgba(30,27,22,0.20)';
      g.fillRect(Math.floor(Math.random() * KW), 5, 14 + Math.floor(Math.random() * 30), 2);
    }
  });
  return thin(t);
}

// ── the arris ─────────────────────────────────────────────────────────────
// The rounded top edge gets its OWN sheet: 768 × 4 px = 12 m × 0.0625 m, the
// same 64 px/m as the face. It used to borrow the kerb sheet's top texel row,
// which stretched every dark pixel in that one row across the full width of
// the chamfer — a dense speckle band right along the joint with the walk.
function arrisTex(): THREE.Texture {
  const t = pixTex(KW, 4, (g) => {
    const band = (y0: number, y1: number, c: string) => { g.fillStyle = c; g.fillRect(0, y0, KW, y1 - y0); };
    band(0, 1, '#928d84');   // catching the sky
    band(1, 2, '#8a857c');
    band(2, 3, '#7e7970');
    band(3, 4, '#6f6a62');   // rolling into the face
    for (let j = 0; j < SEG_K / SEG; j++) {
      const x = Math.round(j * SEG * KPM);
      g.fillStyle = '#575349'; g.fillRect(x, 0, 2, 4);
    }
    // chipping: a FEW discrete knocks, 6–14 cm across, not fine noise
    for (const [at, w] of [[0.17, 9], [0.44, 6], [0.71, 13], [0.93, 7]] as [number, number][]) {
      const x = Math.round(at * KW);
      g.fillStyle = '#635e55'; g.fillRect(x, 0, w, 2);
      g.fillStyle = '#585349'; g.fillRect(x + 1, 0, w - 3, 1);
    }
  });
  return thin(t);
}

// ── the gutter pan ────────────────────────────────────────────────────────
// 96 × 14 px = 3 m × 0.45 m. v = 0 is the kerb (canvas bottom), v = 1 is the
// asphalt joint (canvas top). Clearly lighter than the road, grimiest at the
// flow line where the water actually runs.
function gutterTex(): THREE.Texture {
  const t = pixTex(96, 14, (g) => {
    const band = (y0: number, y1: number, c: string) => { g.fillStyle = c; g.fillRect(0, y0, 96, y1 - y0); };
    band(0, 1, '#2f2c29');   // tar seal at the asphalt joint
    band(1, 3, '#6e6a62');   // dirt tracked over the edge
    band(3, 10, '#8a857c');  // the pan — pale concrete against #3a3d42 tarmac
    band(10, 11, '#6f6a62'); // longitudinal score
    band(11, 13, '#605b53'); // the flow line
    band(13, 14, '#4e4a42'); // right against the kerb: silt and grit
    // transverse contraction joint, one per 3 m tile, aligned with the kerb's
    g.fillStyle = '#565149'; g.fillRect(0, 1, 1, 13);
    // grit, leaf litter and old patching
    for (let i = 0; i < 90; i++) {
      g.fillStyle = Math.random() < 0.55 ? 'rgba(34,31,26,0.34)' : 'rgba(176,170,158,0.20)';
      g.fillRect(Math.floor(Math.random() * 96), 3 + Math.floor(Math.random() * 11), 1, 1);
    }
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 88), w = 4 + Math.floor(Math.random() * 10);
      g.fillStyle = `rgba(52,48,42,${0.10 + Math.random() * 0.12})`;
      g.fillRect(x, 3 + Math.floor(Math.random() * 6), w, 2 + Math.floor(Math.random() * 3));
    }
    dither(g, 96, 14, 150);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── red kerb paint ────────────────────────────────────────────────────────
// No-parking paint on the same 768 × 10 grid as the kerb face, so it shares
// the face's uv exactly and its wear lines up with the cast joints. Drawn on
// a TRANSPARENT canvas: where the paint has worn off, the pixel is a hole and
// the concrete underneath shows through — not a paler red.
//
// A block gets its kerb painted by hand with a roller on a pole, and then it
// sits in the weather for years. So: chalky and faded, thin at the top where
// tyres and boots scuff it, eaten away along the bottom where the gutter
// throws grit at it, and ragged at both ends of every stroke. Wear is drawn as
// BLOBS, never single-pixel noise — same reason the arris speckle had to go.
// THE RULE FOR THIN FACES, learned twice on this surface: the kerb face is
// 0.14 m tall. Any dither, per-column variation, gradient or fine chipping
// put into a strip that thin becomes aliasing, and a nearest-mipmap lookup at
// a grazing angle turns that aliasing into a crawling band. So this sheet is
// deliberately COARSE: 32 px/m, a solid band, and features measured in
// tenths of a metre. No noise of any kind, and no mipmaps (see thin() below).
const PW = Math.round(SEG_K * 32), PH = 5;   // 12 m × 0.15 m at 32 px/m

function paintTex(): THREE.Texture {
  const t = pixTex(PW, PH, (g) => {
    // faded oxide red — dusty and desaturated, sitting near the brick rather
    // than shouting over it. Three flat bands, nothing per-pixel.
    g.fillStyle = '#7a4c42'; g.fillRect(0, 0, PW, 4);
    g.fillStyle = '#85574c'; g.fillRect(0, 0, PW, 1);   // sun-bleached at the top
    g.fillStyle = '#6a4239'; g.fillRect(0, 3, PW, 1);   // dirtier down by the gutter
    // a couple of LARGE chips worn back to concrete — 0.4–1.3 m across, so
    // they are still many texels wide when the face is seen end-on
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const [at, w, y, h] of [
      [0.13, 1.10, 2, 3],   // a long scrape along the bottom
      [0.38, 0.45, 0, 2],   // knocked off the top edge
      [0.66, 0.85, 1, 4],   // gone right through
      [0.88, 0.40, 3, 2],
    ] as [number, number, number, number][]) {
      g.fillRect(Math.round(at * PW), y, Math.round(w * 32), h);
    }
    g.globalCompositeOperation = 'source-over';
  });
  return thin(t);
}

// ── WHERE the kerb is painted, and why ────────────────────────────────────
//
// Red kerb is not decoration — it MEANS no parking. So it is placed by rule,
// never by hand, and every place on the block that meets a condition gets the
// same treatment. Paint one side of a corner and you must paint the other.
//
//   RULE 1 — hydrant frontage: 3 m either side of a fire hydrant.
//   RULE 2 — intersection approach: the whole of each kerb return at the
//            main street / side street junction, plus 4 m back along BOTH
//            legs of it. Every leg of that junction, both sides of both
//            streets, identically.
//
// Both are computed from the kerb path itself (as arclength ranges), so they
// follow the corner geometry and cannot drift out of sync with it. The closed
// east end of the side street is NOT an intersection, so it gets none.
const HYD_CLEAR = 3.0;   // either side of a hydrant
const CNR_CLEAR = 4.0;   // back along each leg from a junction return

// The block's only fire hydrant. ct/props.ts owns the hydrant itself and
// plants it at (ROAD_HALF + 0.35, -6); this is the kerb line it fronts.
const HYDRANTS: [number, number][] = [[ROAD_HALF + 0.35, -6]];

// 2 ft × 3 ft cast-iron grate, parallel slots
function grateTex(): THREE.Texture {
  return pixTex(24, 36, (g) => {
    g.fillStyle = '#3c3833'; g.fillRect(0, 0, 24, 36);
    g.fillStyle = '#4a453e'; g.fillRect(0, 0, 24, 1); g.fillRect(0, 0, 1, 36);
    g.fillStyle = '#2a2723'; g.fillRect(2, 3, 20, 30);
    g.fillStyle = '#14120f';
    for (let i = 0; i < 5; i++) g.fillRect(3, 5 + i * 6, 18, 3);
    g.fillStyle = 'rgba(120,112,98,0.25)';
    for (let i = 0; i < 5; i++) g.fillRect(3, 4 + i * 6, 18, 1);
    dither(g, 24, 36, 60);
  });
}

// the hooded curb inlet — a cast-iron piece let into the kerb face
function hoodTex(): THREE.Texture {
  return pixTex(32, 12, (g) => {
    g.fillStyle = '#4d4841'; g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#635d53'; g.fillRect(0, 0, 32, 1);
    g.fillStyle = '#38342e'; g.fillRect(0, 1, 32, 1);
    g.fillStyle = '#0d0c0a'; g.fillRect(2, 5, 28, 5);   // the throat
    g.fillStyle = '#2a2723'; g.fillRect(2, 4, 28, 1);
    dither(g, 32, 12, 40);
  });
}

// ═══════════════════════════ the kerb line ════════════════════════════════
//
// CROSSTOWN turns a corner: the main drag runs south and bends east into the
// side street. So the kerb is ONE continuous path around the roadway, walk
// always on its left, and every vertex is filleted on a radius. Three of the
// four are inside-of-bend returns (the walk gains a rounded nose); the fourth
// — the bodega corner — is the outside of the bend, the big 3.5 m return the
// sidewalk has to be cut back to follow.
const KPATH: [number, number][] = [
  [-ROAD_HALF, 16.5],   // west kerb, north end (into the fog)
  [-ROAD_HALF, -108],   // SW: bends east, inside of the turn
  [55, -108],           // SE: the closed east end of the side street
  [55, -98],            // NE of that end
  [ROAD_HALF, -98],     // THE corner — outside of the bend, by the bodega
  [ROAD_HALF, 16.5],    // east kerb, north end
];
const KR = [0, 2.0, 2.0, 2.0, 3.5, 0];      // fillet radius per vertex
const KRAMP = [false, false, false, false, true, false]; // kerb ramp on the corner return
// Which vertices are the main-street / side-street JUNCTION. The two at x=55
// are the closed east end of the side street, not an intersection, so they
// are not corner approaches and carry no red kerb (see the paint rules above).
const KJUNC = [false, true, false, false, true, false];

interface Fillet {
  cx: number; cz: number; r: number; sgn: number;   // arc centre, radius, walk side
  vx: number; vz: number;                            // the sharp kerb corner it replaces
  ax: number; az: number;                            // fan apex (the walk's back corner)
  aIn: number; dA: number; len: number; ramp: boolean;
  ring: number[];                                    // sample indices along the arc
  sIn: number; sOut: number;                         // arclength at each end of the arc
  junction: boolean;                                 // part of the real intersection
}
interface Sample { x: number; z: number; nx: number; nz: number; s: number; h: number }

/** kerb reveal at a point on a fillet's arc — dips to a ramp on the corner
 *  return, with 1:10-ish flared sides either side of the run */
function revealAt(f: Fillet, t: number, KERB_H: number): number {
  if (!f.ramp) return KERB_H;
  const u = Math.abs((t - f.aIn) / f.dA) * f.len;
  const e = Math.abs(u - f.len / 2);
  if (e <= RAMP_W) return RAMP_H;
  if (e >= RAMP_W + RAMP_F) return KERB_H;
  return RAMP_H + (KERB_H - RAMP_H) * ((e - RAMP_W) / RAMP_F);
}

function buildPath(KERB_H: number): { pts: Sample[]; fillets: Fillet[] } {
  const pts: Sample[] = [];
  const fillets: Fillet[] = [];
  let s = 0;
  let cx = KPATH[0][0], cz = KPATH[0][1];
  for (let i = 1; i < KPATH.length; i++) {
    const [bx, bz] = KPATH[i];
    const dx = Math.sign(bx - KPATH[i - 1][0]), dz = Math.sign(bz - KPATH[i - 1][1]);
    const nx = dz, nz = -dx;                       // left of travel — the walk side
    const r = KR[i];
    const ex = bx - r * dx, ez = bz - r * dz;      // tangent point in
    // Subdivide the straight runs at ~1 m. The ribbons themselves don't need
    // it — but the red kerb paint is picked per segment, and a run emitted as
    // one 111 m quad can only be all-painted or none.
    const runL = Math.hypot(ex - cx, ez - cz);
    const n = Math.max(1, Math.round(runL));
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      pts.push({ x: cx + (ex - cx) * u, z: cz + (ez - cz) * u, nx, nz, s: s + runL * u, h: KERB_H });
    }
    s += runL;
    if (r <= 0) break;
    // fillet at this vertex
    const [nxt0, nxt1] = KPATH[i + 1];
    const ox = Math.sign(nxt0 - bx), oz = Math.sign(nxt1 - bz);
    const fcx = bx + r * (ox - dx), fcz = bz + r * (oz - dz);
    const aIn = Math.atan2(ez - fcz, ex - fcx);
    const aOut = Math.atan2(bz + r * oz - fcz, bx + r * ox - fcx);
    let dA = aOut - aIn;
    while (dA > Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    // which way does the walk lie off the arc? Match the straight's normal.
    const sgn = Math.sign(nx * Math.cos(aIn) + nz * Math.sin(aIn));
    const len = r * Math.abs(dA);
    const f: Fillet = {
      cx: fcx, cz: fcz, r, sgn, vx: bx, vz: bz, ax: 0, az: 0,
      aIn, dA, len, ramp: KRAMP[i], ring: [],
      sIn: s, sOut: s + len, junction: KJUNC[i],
    };
    const onx = oz, onz = -ox;                     // left normal of the outgoing run
    // the fan apex is the walk's BACK corner: at the building line on an
    // outside-of-bend return, at the walk edge on a tight inside one
    const off = sgn < 0 ? WALK : CH;
    f.ax = bx + nx * off + onx * off;
    f.az = bz + nz * off + onz * off;
    fillets.push(f);
    const N = Math.max(8, Math.ceil(len / 0.22));
    for (let k = 0; k <= N; k++) {
      const t = aIn + dA * (k / N);
      const px = fcx + r * Math.cos(t), pz = fcz + r * Math.sin(t);
      const h = revealAt(f, t, KERB_H);
      if (k > 0) s += len / N;
      f.ring.push(pts.length);
      pts.push({ x: px, z: pz, nx: sgn * Math.cos(t), nz: sgn * Math.sin(t), s, h });
    }
    cx = bx + r * ox; cz = bz + r * oz;            // tangent point out
  }
  return { pts, fillets };
}

// ── geometry helpers ──────────────────────────────────────────────────────
function mesh(pos: number[], uv: number[], mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return new THREE.Mesh(g, mat);
}

export interface GroundOpts {
  scene: THREE.Scene;
  flat: (t: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  KERB_H: number;
  SIDE_Z0: number;
  SIDE_Z1: number;
  SIDE_X1: number;
  asphalt: (w: number, d: number) => THREE.Texture;
}

export interface Ground {
  /** ground height at (x, z) if this module owns that patch, else null */
  gy: (x: number, z: number) => number | null;
}

export function buildGround(o: GroundOpts): Ground {
  const { scene, flat, wet, KERB_H } = o;
  const { pts, fillets } = buildPath(KERB_H);

  // ── apply the red-kerb rules to this particular block ──────────────────
  // Both rules resolve to arclength ranges along the kerb path, so they wrap
  // the corner geometry automatically and stay mirrored by construction: a
  // junction return paints BOTH its legs, so if one side of the corner is
  // red, the other side necessarily is too.
  const redZones: [number, number][] = [];
  for (const f of fillets) {
    if (f.junction) redZones.push([f.sIn - CNR_CLEAR, f.sOut + CNR_CLEAR]);
  }
  for (const [hx, hz] of HYDRANTS) {
    let best = -1, bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - hx, p.z - hz);
      if (d < bestD) { bestD = d; best = p.s; }
    }
    if (best >= 0) redZones.push([best - HYD_CLEAR, best + HYD_CLEAR]);
  }
  const isRed = (s: number) => redZones.some(([a, b]) => s >= a && s <= b);

  // ── the walks themselves: raised slabs, inset from the kerb line by the
  //    chamfer so the walk top and the rounded arris ABUT and never overlap
  const walkDarkM = new THREE.MeshBasicMaterial({ color: 0x605d56 });
  const slab = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const w = maxX - minX, d = maxZ - minZ, h = KERB_H + 0.04;
    const top = wet(flat(walkTex(minX, maxX, minZ, maxZ)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [walkDarkM, walkDarkM, top, walkDarkM, walkDarkM, walkDarkM]);
    m.position.set((minX + maxX) / 2, h / 2 - 0.04, (minZ + maxZ) / 2);
    scene.add(m);
  };
  slab(-7, -ROAD_HALF - CH, o.SIDE_Z1 - 2, 16.5);              // west walk, whole length
  slab(ROAD_HALF + CH, 7, -94.5, 16.5);                        // east walk, cut at the corner return
  slab(8.5, 57, o.SIDE_Z0 + CH, -96);                          // north side-street walk
  slab(-ROAD_HALF - CH, 55 + CH, o.SIDE_Z1 - 2, -108 - CH);    // south side-street walk
  slab(55 + CH, 57, o.SIDE_Z1 - 2, o.SIDE_Z0 + CH);            // east end of the side street

  // ── kerb face, chamfered arris, and gutter pan — three ribbons that run
  //    the whole path in one piece, so joints march continuously round the
  //    corners exactly as a real pour does
  // the kerb joins the wet registry too — a dry-looking kerb standing over a
  // rain-darkened gutter was the one thing that read wrong at night
  const kerbM = wet(new THREE.MeshBasicMaterial({ map: kerbTex(), side: THREE.DoubleSide }));
  const arrisM = wet(new THREE.MeshBasicMaterial({ map: arrisTex(), side: THREE.DoubleSide }));
  const gutterMap = gutterTex();
  const gutterM = wet(new THREE.MeshBasicMaterial({ map: gutterMap, side: THREE.DoubleSide }));
  const facePos: number[] = [], faceUv: number[] = [];
  const chamPos: number[] = [], chamUv: number[] = [];
  const gutPos: number[] = [], gutUv: number[] = [];
  const pntPos: number[] = [], pntUv: number[] = [];
  const V = (a: number[], x: number, y: number, z: number) => a.push(x, y, z);
  const T = (a: number[], u: number, v: number) => a.push(u, v);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.x === q.x && p.z === q.z) continue;
    const pT = p.h - rise(p.h), qT = q.h - rise(q.h); // top of the vertical face (chamfer above)
    const pu = p.s / SEG, qu = q.s / SEG;             // gutter: a joint every 3 m
    const pk = p.s / SEG_K, qk = q.s / SEG_K;         // kerb + arris: a 12 m sheet
    // vertical face, bottom below grade
    const pvT = (pT - KBOT) / KTEX, qvT = (qT - KBOT) / KTEX;
    V(facePos, p.x, KBOT, p.z); T(faceUv, pk, 0);
    V(facePos, p.x, pT, p.z); T(faceUv, pk, pvT);
    V(facePos, q.x, qT, q.z); T(faceUv, qk, qvT);
    V(facePos, p.x, KBOT, p.z); T(faceUv, pk, 0);
    V(facePos, q.x, qT, q.z); T(faceUv, qk, qvT);
    V(facePos, q.x, KBOT, q.z); T(faceUv, qk, 0);
    // the arris: a chamfer back into the walk, on its own sheet mapped across
    // its FULL width — never one stretched texel row of the face
    const pcx = p.x + p.nx * CH, pcz = p.z + p.nz * CH;
    const qcx = q.x + q.nx * CH, qcz = q.z + q.nz * CH;
    V(chamPos, p.x, pT, p.z); T(chamUv, pk, 0);
    V(chamPos, pcx, p.h, pcz); T(chamUv, pk, 1);
    V(chamPos, qcx, q.h, qcz); T(chamUv, qk, 1);
    V(chamPos, p.x, pT, p.z); T(chamUv, pk, 0);
    V(chamPos, qcx, q.h, qcz); T(chamUv, qk, 1);
    V(chamPos, q.x, qT, q.z); T(chamUv, qk, 0);
    // Red kerb paint: the VERTICAL FACE quad again, and only that. It must
    // never go onto the rounded arris — paint lying over a rounded lip reads
    // as a cylindrical rail sitting on the kerb rather than as paint on a
    // wall. The face is covered corner to corner, top to bottom, so it reads
    // as a painted face and not as a sliver along an edge. Depth-offset
    // rather than pushed out in space, so there is no lip.
    if (isRed((p.s + q.s) / 2)) {
      V(pntPos, p.x, KBOT, p.z); T(pntUv, pk, 0);
      V(pntPos, p.x, pT, p.z); T(pntUv, pk, 1);
      V(pntPos, q.x, qT, q.z); T(pntUv, qk, 1);
      V(pntPos, p.x, KBOT, p.z); T(pntUv, pk, 0);
      V(pntPos, q.x, qT, q.z); T(pntUv, qk, 1);
      V(pntPos, q.x, KBOT, q.z); T(pntUv, qk, 0);
    }
    // gutter pan, out into the road, cross-sloped back to the kerb
    const pgx = p.x - p.nx * GW, pgz = p.z - p.nz * GW;
    const qgx = q.x - q.nx * GW, qgz = q.z - q.nz * GW;
    V(gutPos, p.x, GY_K, p.z); T(gutUv, pu, 0);
    V(gutPos, pgx, GY_R, pgz); T(gutUv, pu, 1);
    V(gutPos, qgx, GY_R, qgz); T(gutUv, qu, 1);
    V(gutPos, p.x, GY_K, p.z); T(gutUv, pu, 0);
    V(gutPos, qgx, GY_R, qgz); T(gutUv, qu, 1);
    V(gutPos, q.x, GY_K, q.z); T(gutUv, qu, 0);
  }
  scene.add(mesh(facePos, faceUv, kerbM));
  scene.add(mesh(chamPos, chamUv, arrisM));
  scene.add(mesh(gutPos, gutUv, gutterM));
  const paintM = wet(new THREE.MeshBasicMaterial({
    map: paintTex(), side: THREE.DoubleSide, alphaTest: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  scene.add(mesh(pntPos, pntUv, paintM));

  // ── the corner returns: the walk surface that follows each radius ───────
  const fanM = wet(flat(walkMap()));
  fanM.side = THREE.DoubleSide;
  const wedgeMap = o.asphalt(8, 8);
  wedgeMap.repeat.set(1, 1);           // the wedge carries the road's uv itself
  const wedgeM = wet(flat(wedgeMap));
  wedgeM.side = THREE.DoubleSide;
  for (const f of fillets) {
    const ring: [number, number, number][] = [];   // x, y, z
    const first = pts[f.ring[0]], last = pts[f.ring[f.ring.length - 1]];
    const off = f.sgn < 0 ? WALK : CH;
    // reach back to the walk's back edge at each end (a no-op on the tight
    // inside returns, where the fan apex already sits on that edge)
    ring.push([first.x + first.nx * off, KERB_H, first.z + first.nz * off]);
    for (const idx of f.ring) {
      const p = pts[idx];
      ring.push([p.x + p.nx * CH, p.h, p.z + p.nz * CH]);
    }
    ring.push([last.x + last.nx * off, KERB_H, last.z + last.nz * off]);
    const pos: number[] = [], uv: number[] = [];
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 1e-6) continue;
      for (const v of [[f.ax, KERB_H, f.az] as [number, number, number], a, b]) {
        V(pos, v[0], v[1], v[2]); T(uv, walkU(v[0]), walkV(v[2]));
      }
    }
    scene.add(mesh(pos, uv, fanM));
    // outside-of-bend returns cut the walk back, so the roadway has to grow
    // into the corner: an asphalt wedge that ABUTS the road planes on both
    // its straight edges (never overlaps them — this corner has a history)
    if (f.sgn < 0) {
      const wpos: number[] = [], wuv: number[] = [];
      // match the main road plane's own uv so the grain runs through the seam
      const au = (x: number) => 0.3 * (x + ROAD_HALF);
      const av = (z: number) => 15 - (31 + z) * (30 / 134);
      for (let k = 0; k + 1 < f.ring.length; k++) {
        const a = pts[f.ring[k]], b = pts[f.ring[k + 1]];
        for (const v of [[f.vx, f.vz], [a.x, a.z], [b.x, b.z]]) {
          V(wpos, v[0], 0, v[1]); T(wuv, au(v[0]), av(v[1]));
        }
      }
      scene.add(mesh(wpos, wuv, wedgeM));
    }
  }

  // ── catch basins at the two corner low points, where the gutters run to ─
  const grateM = new THREE.MeshBasicMaterial({ map: grateTex() });
  const hoodM = new THREE.MeshBasicMaterial({ map: hoodTex(), side: THREE.DoubleSide });
  const basin = (kx: number, z: number, side: number) => {
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), grateM);
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(kx - side * 0.3, 0.021, z);
    scene.add(grate);
    const hood = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.104), hoodM);
    hood.rotation.y = side * Math.PI / 2;
    hood.position.set(kx - side * 0.004, 0.058, z);
    scene.add(hood);
  };
  basin(ROAD_HALF, -92.5, 1);    // east gutter, just up-grade of the corner return
  basin(-ROAD_HALF, -105, -1);   // west gutter, above the inside bend

  // ── ground height: the corners are curved and one of them ramps ─────────
  const gy = (x: number, z: number): number | null => {
    for (const f of fillets) {
      const x0 = Math.min(f.vx, f.cx), x1 = Math.max(f.vx, f.cx);
      const z0 = Math.min(f.vz, f.cz), z1 = Math.max(f.vz, f.cz);
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const d = Math.hypot(x - f.cx, z - f.cz);
      if (f.sgn > 0) return d > f.r ? KERB_H : 0;   // inside-of-bend nose
      if (d > f.r) return 0;                        // cut back to roadway
      // on the return: ride the fan from its apex out to the (possibly
      // ramped) kerb edge
      const ex = f.ax - f.cx, ez = f.az - f.cz;
      let dx = x - f.ax, dz = z - f.az;
      const dl = Math.hypot(dx, dz);
      if (dl < 1e-5) return KERB_H;
      dx /= dl; dz /= dl;
      const Rw = f.r - CH;
      const b = ex * dx + ez * dz;
      const c = ex * ex + ez * ez - Rw * Rw;
      const disc = b * b - c;
      if (disc <= 0) return KERB_H;
      const u = -b + Math.sqrt(disc);
      if (u <= 1e-5) return KERB_H;
      const t = Math.atan2(f.az + u * dz - f.cz, f.ax + u * dx - f.cx);
      const h = revealAt(f, t, KERB_H);
      const k = Math.min(1, dl / u);
      return KERB_H + (h - KERB_H) * k;
    }
    return null;
  };
  return { gy };
}
