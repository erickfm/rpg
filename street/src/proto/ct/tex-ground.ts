import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { ROAD_HALF, WALK, FACE } from './rng';

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
// (KTEX, the fixed world height the face sheet used to be clipped to, is gone —
//  see the uv note in buildGround for why a depressed kerb must compress the
//  profile rather than crop it.)
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

// ── DRIVEWAY CURB CUT ─────────────────────────────────────────────────────
//
// Builder C's used car lot had no way in. The user: "how does one even enter,
// drive a car off the lot". A lot fronting a kerb needs a CURB CUT — the kerb
// drops to a low lip across the opening, flares back up to full reveal either
// side, and the walk is carried over it on a ramped APRON so the pavement
// still runs through. Without one you have a fence with cars behind it.
//
// Real construction, same sources as the rest of this file: commercial
// driveway openings run 24–30 ft; the depressed kerb keeps a 1–1½ in lip at
// the gutter rather than going dead flush, so the gutter still carries water
// past the drive instead of running into it; and the flared wings are the same
// 1:10-ish detail as the pedestrian ramp already here.
//
// THE NUMBERS ARE NOT MINE AND ARE NOT GUESSED. ct/street.ts puts the lot on
// 23.2 m of the east kerb centred on z = 2.6, and ct/lot.ts runs its drive
// aisle down that same centre at 6.8 m wide. So the opening IS the aisle:
// same centre, same width, and a car that can use the aisle can use the cut.
// If C moves the aisle, this is the one line to follow it.
const DRIVE_H = 0.035;   // reveal left at the gutter across the opening
const DRIVE_F = 0.9;     // flared wing either side, as the pedestrian ramp
const DRIVES: { x: number; z: number; hw: number }[] = [
  { x: ROAD_HALF, z: 2.6, hw: 3.4 },     // the car lot, east kerb
];

// ── PEDESTRIAN RAMPS ON A STRAIGHT RUN ────────────────────────────────────
//
// `revealAt` can only dip a FILLET — it ramps the kerb round a corner arc, and
// that was enough while every crossing in the world met the kerb at a corner.
// The junction crossings do not: the desk asked for them SET BACK to where the
// kerb is genuinely parallel, past the corner radius, because that is what a
// real junction does when its corner is rounded. So the kerb has to be able to
// drop mid-run, which is exactly what the driveway cut already does.
//
// Same mechanism, different profile, and one list so a future reader does not
// find two ways to cut a kerb. A pedestrian ramp keeps a smaller lip than a
// driveway (a wheel has to climb a drive; a foot does not) and is only as wide
// as the crossing it serves.
//
// AXIS, and it is why this is not a two-line change: the main street's kerbs
// run along z and the side street's along x. `driveReveal` keyed on x and
// varied along z with that assumption baked in, so a cut on the side street's
// kerb would have been silently ignored.
const PED_H = 0.022;     // a 1 in lip at the gutter — period-correct, and it
                         // keeps the gutter carrying water past the crossing
const PED_F = 0.75;      // flared wing either side
interface KerbCut { x: number; z: number; hw: number; axis: 'x' | 'z'; lip: number; flare: number }
const CUTS: KerbCut[] = [
  ...DRIVES.map((d) => ({ ...d, axis: 'z' as const, lip: DRIVE_H, flare: DRIVE_F })),
];
/** register a pedestrian ramp; called from buildGround where the crossings are
 *  laid, so the paint and the dropped kerb cannot drift apart */
function pedCut(x: number, z: number, hw: number, axis: 'x' | 'z'): void {
  CUTS.push({ x, z, hw, axis, lip: PED_H, flare: PED_F });
}
/** kerb reveal at a point on a STRAIGHT run — full height everywhere except
 *  across a cut, where it drops to a lip and flares back up */
function driveReveal(x: number, z: number, KERB_H: number): number {
  for (const d of CUTS) {
    // the run this cut is ON, then how far along it we are
    const off = d.axis === 'z' ? Math.abs(x - d.x) : Math.abs(z - d.z);
    if (off > 1) continue;                          // this kerb line only
    const e = d.axis === 'z' ? Math.abs(z - d.z) : Math.abs(x - d.x);
    if (e <= d.hw) return d.lip;
    if (e >= d.hw + d.flare) continue;
    return d.lip + (KERB_H - d.lip) * ((e - d.hw) / d.flare);
  }
  return KERB_H;
}
/** is this point on the apron — the ramped slab that carries the walk over a
 *  cut — and if so, how high is it? The walk stays level at the building line
 *  and ramps down across its width to whatever the kerb is doing at that z. */
function apronY(x: number, z: number, KERB_H: number): number | null {
  const inner = ROAD_HALF + CH;
  for (const d of DRIVES) {
    if (Math.abs(z - d.z) > d.hw + DRIVE_F) continue;
    const ax = Math.abs(x);
    if (ax < inner || ax > FACE) continue;
    if (Math.sign(x) !== Math.sign(d.x)) continue;
    const rev = driveReveal(d.x, z, KERB_H);
    if (rev >= KERB_H - 1e-6) return KERB_H;
    const t = (FACE - ax) / (FACE - inner);        // 0 at the building, 1 at the kerb
    return KERB_H + (rev - KERB_H) * t;
  }
  return null;
}

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
/** The walk does not begin at ROAD_HALF — it begins this far outboard of it,
 *  where the kerb's top arris chamfer ends. Anything ct/props.ts lays on the
 *  pavement has to start outside this or it overhangs the chamfer, which is
 *  exactly what the tree pits were doing. */
export const KERB_CHAMFER = CH;

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
  // GROUND, not brick. Concrete paving compared to a brick wall by density is a
  // question with no answer, and until a face SAYS what it is the seam tools
  // cannot separate "different on purpose" from "wrong" — 90 pairs sit in that
  // column. Declaring is one line per surface (ct/paint.ts).
  return declareSurface(t, 'ground');
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

/** THE DRIVEWAY APRON, poured separately from the walk it interrupts.
 *
 *  The user: "a LARGE FLAT UNTEXTURED GREY PLANE: no concrete texture, no
 *  scoring joints, no aggregate, a colour that matches neither the walk nor the
 *  road." It was not untextured — it wore `walkTex`, the sidewalk sheet, at the
 *  right density. But the apron is only 1.94 m across, which is 0.24 of that
 *  8 m tile, so the window it samples can fall between the 1 m scoring joints
 *  and contain none of them at all. A concrete sheet with no joint in frame is
 *  a flat grey plane, and the eye is right to call it one.
 *
 *  So it gets its own sheet, sized from its REAL METRES at the one density —
 *  32 px/m, the rule every other surface here follows — and mapped 1:1 with no
 *  repeat, so a joint lands where this function puts it rather than wherever
 *  the tile happens to cut.
 *
 *  Its joints run ACROSS the direction of travel: a car crosses them driving in
 *  off the road, which is how an apron is actually poured and scored, instead of
 *  continuing the sidewalk's grid through a slab that is not part of it. Same
 *  aggregate and speckle as the walk, a slightly paler and warmer tone, because
 *  it is a separate and usually newer pour.
 *
 *  It also has to READ AS A RAMP. The geometry already slopes — groundAt runs
 *  0.042 at the kerb to 0.137 at the building line across the drive — but with
 *  no joint or aggregate in view there is nothing for the slope to show on, and
 *  a ramp you cannot see reads as broken geometry. The cross joints are what
 *  give it that: they foreshorten as it falls away. */
export function apronTex(minX: number, maxX: number, minZ: number, maxZ: number): THREE.Texture {
  const w = Math.max(8, Math.round((maxX - minX) * WPM));   // 1.94 m -> 62 px
  const h = Math.max(8, Math.round((maxZ - minZ) * WPM));   // 8.60 m -> 275 px
  const t = pixTex(w, h, (g) => {
    g.fillStyle = '#8a877d';                                 // paler and warmer than the walk's #84817a
    g.fillRect(0, 0, w, h);
    // aggregate: the same fine speckle the walk carries, so the two read as the
    // same material even though the tone and the jointing differ
    for (let i = 0; i < w * h * 0.10; i++) {
      const x = Math.random() * w, y = Math.random() * h, v = Math.random();
      g.fillStyle = v < 0.55 ? `rgba(60,56,49,${0.05 + v * 0.22})`
                             : `rgba(226,221,208,${(v - 0.55) * 0.30})`;
      g.fillRect(x, y, 1, 1);
    }
    // grime at the kerb lip where the water and grit collect
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(38,35,30,0.20)');               // kerb edge, dirtiest
    gr.addColorStop(0.45, 'rgba(38,35,30,0.03)');
    gr.addColorStop(1, 'rgba(38,35,30,0.00)');               // building line, cleanest
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * 14;
      const b = g.createRadialGradient(x, y, 1, x, y, r);
      b.addColorStop(0, `rgba(44,40,34,${0.05 + Math.random() * 0.09})`);
      b.addColorStop(1, 'rgba(44,40,34,0)');
      g.fillStyle = b; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // ── SCORING ───────────────────────────────────────────────────────────
    //
    // "dont like how this curb is discontinuous and only 3 slabs, its
    // unrealistic" (shots/user-kerb-discontinuous.png) is a literal and exact
    // description of what this function used to draw, and it is what he was
    // standing on: the apron is 8.60 m of pavement — a 6.8 m opening plus a
    // 0.9 m flare each side — and it carried joints in ONE direction only,
    // three ribbons running its whole length with a single joint at each end.
    //
    // Measured at his own pose (scripts/jointfade.mjs, east walk at z = 8
    // looking south): joints ACROSS the walk read at 6.95 m and then not again
    // until 1.25 m — a 5.70 m hole, the whole middle of the frame — while the
    // joints ALONG it read 18 times in the same strip. Identical at noon and at
    // 22:30, so it is not the night grade. THREE RIBBONS. THREE SLABS.
    //
    // My earlier note filed this as I's stretched-cross-section finding. It is
    // not: every walk sheet in the world measures exactly 32 texels/m in both
    // axes. That number came from taking the bounding box of a kerb ribbon that
    // wraps a corner and dividing by it, which measures nothing.
    //
    // So it gets scored like the pour it is. The x lines land on the WALK'S OWN
    // flag lines — integer world x, the grid ct/tex-ground's walkU already
    // cuts — so the pavement's joints run through the drive instead of
    // restarting at it. The z lines mark the two flare shoulders, which is
    // where the slope actually changes, and divide the opening between them.
    const J = 'rgba(0,0,0,0.28)';                            // 2 px = 6 cm, as the walk
    g.fillStyle = J;
    for (let wx = Math.ceil(minX); wx < maxX; wx++) {
      const px = Math.round(((wx - minX) / (maxX - minX)) * w);
      if (px > 2 && px < w - 4) g.fillRect(px, 0, 2, h);
    }
    g.fillRect(0, 0, 2, h);                                  // the pour's own edges
    g.fillRect(w - 2, 0, 2, h);
    // the flare shoulders: canvas y runs from maxZ at 0 to minZ at h, and the
    // wings are DRIVE_F deep at each end (see apronY, which ramps between them)
    const flare = Math.round(DRIVE_F * WPM);
    const zs = [0, flare];
    const bays = Math.max(1, Math.round((h - 2 * flare) / (1.4 * WPM)));
    for (let k = 1; k <= bays; k++) zs.push(flare + Math.round(((h - 2 * flare) * k) / bays));
    zs.push(h - 2);
    for (const y of zs) g.fillRect(0, Math.min(y, h - 2), w, 2);
    // TYRE TRACKS, and they run the way the car does — across the apron in x,
    // at the wheel track either side of the opening's centre. Two dark bands
    // crossing the joints is the other half of what stops this reading as
    // ribbons, and it is the mark a drive actually carries.
    const mid = h / 2, halfTrack = Math.round(0.80 * WPM), tw = Math.round(0.22 * WPM);
    for (const c0 of [mid - halfTrack, mid + halfTrack]) {
      const tg = g.createLinearGradient(0, c0 - tw, 0, c0 + tw);
      tg.addColorStop(0, 'rgba(30,27,23,0)');
      tg.addColorStop(0.5, 'rgba(30,27,23,0.22)');
      tg.addColorStop(1, 'rgba(30,27,23,0)');
      g.fillStyle = tg;
      g.fillRect(0, c0 - tw, w, tw * 2);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;   // 1:1, no repeat — see above
  return declareSurface(t, 'ground');
}

/** CIVIC FLAGSTONE, for the library forecourt and the churchyard.
 *
 *  The user asked what the "large translucent quadrilateral patches" on the
 *  library forecourt are. Measured: 26 ground meshes there, ALL registered with
 *  the night grading (so nothing has diverged from its neighbour, which was the
 *  hypothesis) and ALL of them `map: none` — untextured flat colour at seven
 *  tones. The two big ones are a 3.6 x 4.1 m landing and a 3.2 x 4.1 m flight,
 *  each a box with a materials array, which is why one object shows several
 *  tones with hard straight edges between them.
 *
 *  A flat colour has no grain to attach to and no joints to give it scale, so it
 *  reads as a tint laid OVER the paving rather than as paving. Same reason the
 *  driveway apron read as untextured earlier today.
 *
 *  ct/civic.ts is not my file, so this exists to make the fix one line there
 *  rather than a rewrite: same contract as walkTex and apronTex, canvas sized
 *  from the slab's real metres at the world's 32 px/m.
 *
 *  Civic flags rather than sidewalk flags: 1.5 m units instead of 1 m, a cooler
 *  and slightly darker grey than the walk's #84817a because this is granite
 *  rather than poured concrete, and the joints run both ways on the flag grid.
 *  notes/B-forecourt-patches.md is the explanation written for the user. */
export function plazaTex(minX: number, maxX: number, minZ: number, maxZ: number): THREE.Texture {
  const w = Math.max(8, Math.round((maxX - minX) * WPM));
  const h = Math.max(8, Math.round((maxZ - minZ) * WPM));
  const FLAG = Math.round(1.5 * WPM);                       // 1.5 m civic flags
  const t = pixTex(w, h, (g) => {
    g.fillStyle = '#7d7d79';                                // cooler and greyer than the walk
    g.fillRect(0, 0, w, h);
    // flag-to-flag tone variation, the same trick drawWalk uses so the two
    // surfaces read as related stone rather than as unrelated materials
    for (let sy = 0; sy < h; sy += FLAG) for (let sx = 0; sx < w; sx += FLAG) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.05})`
                            : `rgba(255,255,255,${(v - 0.5) * 0.07})`;
      g.fillRect(sx, sy, FLAG, FLAG);
    }
    // granite speckle — finer and sparser than the walk's concrete aggregate
    for (let i = 0; i < w * h * 0.07; i++) {
      const x = Math.random() * w, y = Math.random() * h, v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(52,52,50,${0.06 + v * 0.20})`
                            : `rgba(214,214,210,${(v - 0.5) * 0.26})`;
      g.fillRect(x, y, 1, 1);
    }
    // weathering where water sits along the joints
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 16;
      const b = g.createRadialGradient(x, y, 1, x, y, r);
      b.addColorStop(0, `rgba(48,48,44,${0.05 + Math.random() * 0.08})`);
      b.addColorStop(1, 'rgba(48,48,44,0)');
      g.fillStyle = b; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // the flag joints, both ways, 2 px = 6 cm as everywhere else here
    g.fillStyle = 'rgba(0,0,0,0.26)';
    for (let k = 0; k <= h; k += FLAG) g.fillRect(0, k, w, 2);
    for (let k = 0; k <= w; k += FLAG) g.fillRect(k, 0, 2, h);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;            // 1:1, no repeat
  return declareSurface(t, 'ground');
}

// ── the kerb face ─────────────────────────────────────────────────────────
// 768 × 10 px = 12 m × 0.15 m, i.e. 64 px/m across and 67 px/m up: square
// texels, so the grain never crowds. Read against walkTex's #84817a: the face
// is DARKER and greyer than the walk top it caps — it is a vertical surface
// under an overcast sky, it catches less light. The highlight lives on the
// arris strip, not here.
const KW = Math.round(SEG_K * KPM), KH = 10;

function kerbTex(): THREE.Texture {   // concrete kerb face — ground
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
  return declareSurface(thin(t), 'ground');
}

// ── the arris ─────────────────────────────────────────────────────────────
// The rounded top edge gets its OWN sheet: 768 × 4 px = 12 m × 0.0625 m, the
// same 64 px/m as the face. It used to borrow the kerb sheet's top texel row,
// which stretched every dark pixel in that one row across the full width of
// the chamfer — a dense speckle band right along the joint with the walk.
function arrisTex(): THREE.Texture {  // the chamfer, same pour — ground
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
  return declareSurface(thin(t), 'ground');
}

// ── the gutter pan ────────────────────────────────────────────────────────
// 96 × 14 px = 3 m × 0.45 m. v = 0 is the kerb (canvas bottom), v = 1 is the
// asphalt joint (canvas top). Clearly lighter than the road, grimiest at the
// flow line where the water actually runs.
function gutterTex(): THREE.Texture { // the pan, same pour — ground
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
  return declareSurface(t, 'ground');
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

function paintTex(): THREE.Texture {  // red kerb paint — it is a marking, not masonry
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
  return declareSurface(thin(t), 'detail');
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

//   RULE 3 — the bus stop. This is the same rule as the hydrant, not a new
//            one: red kerb means NO PARKING, and the whole point of a bus
//            stop is that nothing may stand in it. A bus needs the length to
//            pull in parallel and get its door to the kerb, which is why a
//            real stop zone is far longer than a hydrant's — an 18 m stop for
//            a 30 ft bus is standard, and the 42 is 9.1 m (see makeBus in
//            ct/cars.ts), so it wants roughly a bus length either side of the
//            flag. I flagged this inconsistency in my own report twice: my
//            own rule says red kerb marks no-parking and the one place on the
//            block that most obviously is one had none.
const STOP_CLEAR = 9.0;  // either side of the flag pole
// ct/props.ts plants the 42's flag at (ROAD_HALF + 0.32, -33.5).
const BUS_STOPS: [number, number][] = [[ROAD_HALF + 0.32, -33.5]];

// grateTex is gone: the grate is geometry now, not a picture of a grate.
// Cast iron, for the frame and the kerb-inlet surround. Flat colour plus grit
// and one lit top row — no gradient anywhere, because the shape is carried by
// the geometry's edges now and the sheet only has to say "rough grey iron".
function castTex(): THREE.Texture {
  return declareSurface(pixTex(16, 16, (g) => {
    g.fillStyle = '#46413a'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#565046'; g.fillRect(0, 0, 16, 1);     // worn bright along the top arris
    g.fillStyle = '#332f2a'; g.fillRect(0, 15, 16, 1);
    dither(g, 16, 16, 26);
  }), 'detail');
}
// Looking into the throat. There is no geometry behind this — the kerb mesh
// is solid — so the sheet has to carry what you would see: black under the
// lintel where the shadow is deepest, the back of the box faintly catching
// light, and a lit invert where the pan runs in. It is the one place here a
// drawing is the honest answer, because what is being drawn IS darkness.
function throatTex(): THREE.Texture {
  return declareSurface(pixTex(24, 10, (g) => {
    g.fillStyle = '#0a0b0d'; g.fillRect(0, 0, 24, 10);
    g.fillStyle = '#050506'; g.fillRect(0, 0, 24, 4);        // deepest under the lintel
    g.fillStyle = '#15171b'; g.fillRect(2, 6, 20, 2);        // the back wall, just catching
    g.fillStyle = '#232529'; g.fillRect(0, 9, 24, 1);        // the invert, wet and lit
    g.fillStyle = '#0d0e11'; g.fillRect(0, 8, 24, 1);
  }), 'detail');
}
// the grate bars: darker than the frame, because they sit down in the rebate
function barTex(): THREE.Texture {
  return declareSurface(pixTex(16, 16, (g) => {
    g.fillStyle = '#2b2825'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#3d382f'; g.fillRect(0, 0, 16, 1);     // the one lit edge on each bar
    dither(g, 16, 16, 18);
  }), 'detail');
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
// Kerb ramp per vertex. Index 4 is the bodega corner return, which carried the
// only ramp in the world and was therefore the only place crowd-net.ts could
// honestly put a crossing.
//
// 2 and 3 are the CLOSED EAST END, added for H's east-end crossing. H links
// (54, -109) to (54, -97) as a road edge — ten metres of carriageway, and the
// residual in their in-the-road measurement until they flagged it. Their note
// asked for "a ramp and painted stripes like the two at the junction".
//
// A RAMP AND NOT A DRIVEWAY CUT, and the geometry is why. My first read was
// that the crossing meets the kerb mid-run, which `revealAt` cannot dip — it
// only ramps a fillet — so this looked like it needed the `driveReveal`
// machinery instead. It does not: KR is 2.0 at both these vertices, so the
// straight kerb ENDS at x = 53 and the crossing at x = 54 lands inside both
// corner arcs. The fillet ramp is exactly the right mechanism, and the desk's
// "give it the same treatment" is literally correct.
// 2 and 3 — the CLOSED EAST END — carried ramps ONLY because a crossing was
// put there, and the user has now asked for that crossing to go
// (shots/user-remove-crosswalk.png). A dropped kerb at a dead end serving
// nothing is a dip in the kerb for no reason, and he has separately complained
// about the kerb being discontinuous. So they go with the paint, and the east
// end is a continuous kerb again. Index 4, the bodega corner, keeps its ramp —
// it now serves two real crossings instead of none.
const KRAMP = [false, false, false, false, true, false];
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
    // 1 m is enough for the ribbons and for picking red paint per segment, but
    // a driveway's flare is only 0.9 m long — at 1 m spacing the ramp down to
    // the lip would be a single step. Subdivide finely on any run that passes
    // one.
    // EVERY cut, not just the driveways. A ped ramp's flare is 0.75 m, so at
    // 1 m sampling the drop to the lip would be a single step — the same fault
    // this line was written to avoid for driveways, and it would have come back
    // silently the moment a cut was added on the other axis.
    const nearDrive = CUTS.some((d) => {
      const runOff = d.axis === 'z' ? Math.abs(d.x - cx) : Math.abs(d.z - cz);
      if (runOff >= 1) return false;
      const a = d.axis === 'z' ? cz : cx, b = d.axis === 'z' ? ez : ex;
      const at = d.axis === 'z' ? d.z : d.x;
      const pad = d.hw + d.flare + 1;
      return Math.min(a, b) - pad < at && at < Math.max(a, b) + pad;
    });
    const n = Math.max(1, Math.round(runL / (nearDrive ? 0.2 : 1)));
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const px = cx + (ex - cx) * u, pz = cz + (ez - cz) * u;
      pts.push({ x: px, z: pz, nx, nz, s: s + runL * u, h: driveReveal(px, pz, KERB_H) });
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

/**
 * A FLOOR drain, in the same cast vocabulary as the kerb inlet.
 *
 * eb936125 asked for this by name: the alley grate "has no frame, no depth and
 * no thickness against B's proper kerb inlet — match that vocabulary, but as a
 * floor drain rather than a kerb-side one, and ask B for the casting rather
 * than drawing a second design." Two designs for one object is how a world
 * stops looking hand-authored, so here is the one.
 *
 * What it is NOT is the kerb inlet with the kerb removed. That casting has a
 * throat — the opening under the kerb face, with a lintel standing 7 mm proud
 * so it reads as a mouth at the angle people stand. A floor drain has nowhere
 * for a throat to go: water arrives from every side, not down a gutter. So the
 * throat and its surround are dropped and the rest is kept exactly.
 *
 *   the void       a dark plate 1 mm under the slots, not a hole cut in the
 *                  floor — at this rebate they are indistinguishable, and it
 *                  costs no surgery on somebody else's mesh
 *   the frame      flange on all four sides, top 28 mm above the floor
 *   the grate      seven bars sunk 11 mm UNDER the frame top, which is the
 *                  whole read: a flush grate looks painted on
 *
 * `y` is the floor height at (x, z) — the caller knows its own floor; this does
 * not guess. Parts carry userData.basinPart so a check can find them by name
 * rather than by size (park.mjs went blind once matching on exact dimensions).
 */
/** A SOLDIER COURSE ALONG A CUT CORNER.
 *
 *  Routed by the auditor from D's bodega work: the walk's joints are a square
 *  1 m grid and the bodega cuts its corner at 45°, so the joints run diagonally
 *  INTO the foot of the canted bay instead of meeting it. Nothing clips — D
 *  measured that no ground plane extends under the building — the grid simply
 *  does not know the bay is there.
 *
 *  A cut corner wants its paving cut to match, and the way that is done in the
 *  street is a soldier course: one row of flags laid PARALLEL to the face, so
 *  the field joints die against a band instead of striking the wall at an
 *  angle. Same trick as a border course round a manhole.
 *
 *  The bay face is measured, not guessed: the two shopfront mullions at
 *  (7.56, -94.47) and (8.53, -95.44) both satisfy `x + z = -86.91`, which is
 *  the 45° cut line.
 *
 *  4 mm proud rather than coplanar. GOTCHAS §6 says abut, never overlap, and a
 *  band laid exactly on the flags would z-fight the whole length; a real
 *  granite course stands a little proud of the paving it edges, so the honest
 *  drawing and the safe one agree. */
export function soldierCourse(scene: THREE.Scene, cx: number, cz: number, yaw: number,
                       len: number, wide: number, y: number,
                       /** the builder's `wet(flat(...))`; module scope cannot see
                        *  either, and floorDrain above takes the same treatment */
                       dress: (t: THREE.Texture) => THREE.Material): void {
  // joints ACROSS the band, one per 0.5 m of run, so they read as laid flags
  const PX = Math.round(WPM);                       // the world's one density
  const w = Math.max(8, Math.round(len * PX)), h = Math.max(6, Math.round(wide * PX));
  const t = pixTex(w, h, (g) => {
    g.fillStyle = '#807d76';                        // a shade cooler than the walk
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h * 0.09; i++) {
      const x = Math.random() * w, y2 = Math.random() * h, v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(56,53,47,${0.05 + v * 0.20})`
                            : `rgba(220,215,203,${(v - 0.5) * 0.26})`;
      g.fillRect(x, y2, 1, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.26)';
    const step = Math.round(0.5 * PX);
    for (let x = step; x < w - 1; x += step) g.fillRect(x, 0, 2, h);   // transverse joints
    g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);                // the two long edges
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wide), dress(declareSurface(t, 'ground')));
  m.rotation.x = -Math.PI / 2;
  // SIGN MATTERS AND I HAD IT BACKWARDS. After `rotation.x = -PI/2` the plane's
  // local +X still runs along world +X, and `rotation.z` then spins it in plan —
  // but in the ALREADY-ROTATED frame, so the sense is inverted from what reading
  // it left-to-right suggests. `-yaw` put the band's long axis along (1, 1): the
  // face NORMAL, square across the very joint it is meant to edge. The auditor
  // caught it and sent the row back.
  //
  // The bay face satisfies `x + z = -86.91`, so it runs along (1, -1) and the
  // band's long axis must too — i.e. `dx + dz == 0`, not `dx - dz == 0`. Worth
  // stating as the test, because my first probe asserted the wrong one of those
  // two and cheerfully reported the perpendicular band as parallel.
  m.rotation.z = yaw;
  m.position.set(cx, y + 0.004, cz);
  m.userData.mod = 'tex-ground';
  scene.add(m);
}

/** A painted crossing across a carriageway that runs EAST-WEST: bars lying
 *  along the direction cars travel, repeating across the road, which is the way
 *  round you step OVER them rather than along them.
 *
 *  THE FIRST PAINTED CROSSING IN THE WORLD. `crowd-net.ts` has had three
 *  crossings as graph edges for a while and the ground has never marked any of
 *  them — the two at the junction read as crossings only because the bodega
 *  corner has a kerb ramp. So "make it look like the two at the junction"
 *  could not be done literally; there was nothing to copy. Until the junction
 *  crossings are painted too, the east end is the only striped one, which is
 *  the one thing about this that is NOT consistent. Flagged, not decided.
 *
 *  HOW REUSABLE THIS ACTUALLY IS, stated precisely because I first wrote that
 *  the junction pair "can take the same paint on one call" and that is only
 *  half true. The bars repeat along Z, so this paints a crossing over an
 *  EAST-WEST carriageway — which the side-street crossing at the junction also
 *  is, and that one is a straight second call. The crossing across the main
 *  street's mouth is not: the main street runs north-south, so its bars have to
 *  repeat along X, and this wants a plan rotation before it can lay that one.
 *  Small change, but it is a change, and claiming otherwise would have handed
 *  the desk a five-minute job that is not.
 *
 *  Sized from real metres at the world's 32 px/m like every other surface here
 *  (GOTCHAS 5), and transparent so the asphalt shows between the bars rather
 *  than the crossing sitting on a grey slab. */
export function crossingStripes(scene: THREE.Scene, cx: number, z0: number, z1: number,
                                halfW: number, y: number,
                                /** the builder's `wet(flat(...))` — road paint gets
                                 *  wet with the road it is painted on */
                                dress: (t: THREE.Texture) => THREE.Material,
                                /** WHICH WAY THE PEDESTRIAN WALKS. The bars run
                                 *  across their path and repeat along it, so the
                                 *  axis decides the whole layout — and this
                                 *  function used to assume 'z' silently. I claimed
                                 *  once that it was reusable for both junction
                                 *  crossings "on one call"; it was not, because the
                                 *  main street runs north-south and its crossing is
                                 *  walked east-west. `cx`/`z0`/`z1` are read in the
                                 *  travel frame: z0..z1 is the span the walker
                                 *  crosses, cx the centre line of the crossing. */
                                travel: 'x' | 'z' = 'z'): void {
  const len = Math.abs(z1 - z0), w = halfW * 2;
  const cw = Math.max(8, Math.round(w * WPM)), ch = Math.max(8, Math.round(len * WPM));
  const BAR = 0.45, PITCH = 1.0;                    // bar depth and spacing, in metres
  const t = pixTex(cw, ch, (g) => {
    g.clearRect(0, 0, cw, ch);
    const bar = Math.round(BAR * WPM), pitch = Math.round(PITCH * WPM);
    // WORN, NOT FRESH — the desk, and it was right: the first version came out
    // a clean cream against a dark grimy road and read as painted that morning.
    // Everything else on this street is filthy, so a crisp crossing is the one
    // object that looks newer than the world it is in.
    //
    // Four kinds of wear, and they are different physical things rather than
    // four strengths of the same noise:
    //   · the base is thinner overall, so asphalt shows through everywhere
    //   · WHEEL TRACKS eat two bands across every bar, where tyres actually run
    //   · each bar is a different age — repainting is done a bar at a time
    //   · the ENDS lift first, at the kerb, where water and grit sit
    //
    // DETERMINISTIC, from a local hash — not rnd() (GOTCHAS 2: one seeded
    // stream and its call order is load-bearing) and not Math.random (the
    // scenedump harness seeds it, so a draw here would move other things).
    const hsh = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    let k = 0;
    for (let p = Math.round((pitch - bar) / 2); p + bar <= ch; p += pitch, k++) {
      // bar-to-bar age: some were touched up last year, some were not
      const age = 0.60 + hsh(k) * 0.22;
      g.fillStyle = `rgba(206,202,188,${age.toFixed(3)})`;   // road white, greyed
      g.fillRect(0, p, cw, bar);
      // WHEEL TRACKS. A vehicle crosses the bars square, so the tracks run the
      // length of the bar and sit where the wheels of a 1.7 m track land —
      // taken as a fraction of the carriageway, not a fixed pixel count, so it
      // stays right on both crossings whatever the road measures.
      for (const t of [0.28, 0.72]) {
        g.fillStyle = `rgba(206,202,188,${(age * 0.45).toFixed(3)})`;
        g.fillRect(Math.round(cw * (t - 0.075)), p, Math.max(2, Math.round(cw * 0.15)), bar);
      }
      // the ends lift first — the last 8% at each kerb is half gone
      const end = Math.max(1, Math.round(cw * 0.08));
      g.fillStyle = `rgba(206,202,188,${(age * 0.55).toFixed(3)})`;
      g.fillRect(0, p, end, bar);
      g.fillRect(cw - end, p, end, bar);
      // and holidays: small patches scrubbed back to nothing, so the bar has a
      // ragged edge rather than a ruled one
      for (let i = 0; i < 5; i++) {
        const hx = Math.floor(hsh(k * 17 + i) * cw);
        const hy = p + Math.floor(hsh(k * 31 + i + 5) * bar);
        const hw2 = 1 + Math.floor(hsh(k * 53 + i) * 3);
        g.clearRect(hx, hy, hw2, 1 + Math.floor(hsh(k * 71 + i) * 2));
      }
      // a chip out of one end of most bars
      if (hsh(k * 97) > 0.35) {
        const cy = p + Math.floor(hsh(k * 113) * (bar - 2));
        g.clearRect(hsh(k * 131) > 0.5 ? 0 : cw - 3, cy, 3, 2);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const mat = dress(declareSurface(t, 'ground')) as THREE.MeshBasicMaterial;
  // Set HERE rather than asked of the caller: the gaps between bars must show
  // asphalt, and a caller passing its standard `wet(flat(...))` has no reason
  // to know this one needs alpha.
  mat.transparent = true;
  mat.depthWrite = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
  m.rotation.x = -Math.PI / 2;
  // Lay it in the travel frame. Rotating in PLAN rather than rebuilding the
  // canvas keeps one texture path and one worn pattern for every crossing in
  // the world, which is what stops the junction reading as a different kind of
  // paint from the rest of the street.
  if (travel === 'x') {
    m.rotation.z = Math.PI / 2;
    m.position.set((z0 + z1) / 2, y + 0.004, cx);
  } else {
    m.position.set(cx, y + 0.004, (z0 + z1) / 2);
  }
  m.userData.mod = 'tex-ground';
  m.userData.groundProp = 'crossing stripes';
  scene.add(m);
}

/** The PAWN ALLEY's floor — the slot between No. 227 and the pawn shop.
 *
 *  D laid a flat `#2e3034` plane there and said in the code why: *"the ground
 *  is ct/tex-ground.ts, which is B's, and a placeholder tone here is honest
 *  about that rather than pretending."* This replaces it, and my own words are
 *  the brief: a flat colour is not a material, no grain for the eye to attach
 *  to and no joints to give it scale.
 *
 *  IT MUST NOT READ LIKE THE FIRST ALLEY. That one is a service yard behind a
 *  shop — even grain, scattered stains, no story about where anyone walks.
 *  This is the back of a five-storey walk-up, so the floor carries traffic:
 *  a polished strip down the middle where every tenant walks, and grime
 *  building at the flanks where nothing ever scuffs it clean. That contrast is
 *  the whole difference, and it is drawn in the texture rather than modelled,
 *  because a 2.5 m slot is narrower than the 2 m walking lane and nothing on
 *  this floor may trip.
 *
 *  Sized from real metres at 32 px/m like every other surface (GOTCHAS 5). */
function alley2FloorTex(deep: number, wide: number): THREE.Texture {
  const w = Math.max(16, Math.round(deep * WPM)), h = Math.max(16, Math.round(wide * WPM));
  return declareSurface(pixTex(w, h, (g) => {
    // DETERMINISTIC, never rnd(). One seeded stream feeds tree heights and
    // pigeons and its ORDER is load-bearing (GOTCHAS 2) — a draw here would
    // move every tree in the world.
    let s = 0x6d2b79f5 >>> 0;
    const nx = () => { s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0; return (s >>> 9) / 0x7fffff; };
    // #2e3034 IS THE FIRST ALLEY'S BASE, taken deliberately. The user: "i dont
    // like the color of the alley way. i prefer the look of the other alley."
    // The brief I built to said make this one read DIFFERENT, and I expressed
    // that in COLOUR, which was the wrong axis — it landed as near-black with a
    // cool cast and read as wet asphalt at night. Same palette, same value as
    // the alley he likes; the difference lives in the WEAR PATTERN below and in
    // what is lying on the floor, not in the tone.
    g.fillStyle = '#2e3034'; g.fillRect(0, 0, w, h);
    // the worn crown: lighter and smoother down the middle, and this is where
    // "the back of a walk-up" is actually said — every tenant walks this line
    const mid = h / 2, wear = h * 0.22;
    for (let y = 0; y < h; y++) {
      const t = Math.max(0, 1 - Math.abs(y - mid) / wear);
      if (t <= 0) continue;
      g.fillStyle = `rgba(150,150,148,${(0.04 + t * 0.17).toFixed(3)})`;
      g.fillRect(0, y, w, 1);
    }
    // grime at the flanks. MUCH lighter than the first cut, which laid 0.40
    // alpha of near-black over 30% of the width from BOTH edges and is most of
    // why the floor went dark: on a 2.5 m slot that is 1.5 m of the 2.5 m
    // painted down toward black.
    for (let y = 0; y < h; y++) {
      const e = Math.max(0, 1 - (Math.min(y, h - 1 - y) / (h * 0.22)));
      if (e <= 0) continue;
      g.fillStyle = `rgba(28,27,25,${(e * 0.16).toFixed(3)})`;
      g.fillRect(0, y, w, 1);
    }
    // JOINTS, which is what gives it scale: slabs across the alley every 1.2 m
    g.fillStyle = 'rgba(18,18,20,0.55)';
    const step = Math.round(1.2 * WPM);
    for (let x = step; x < w - 1; x += step) g.fillRect(x, 0, 2, h);
    g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);   // against both flanks
    // THE GUTTER CHANNEL, drawn not modelled. A real alley drains somewhere and
    // the user has already said once "the gutter should have the water in the
    // gutter". It runs the full length to the mouth, set 18% across the width
    // against ONE flank rather than down the centre — the centre is the walking
    // line, and a channel there would be both wrong and a thing to catch a heel
    // on. Which flank is not a compass claim I have checked; it is whichever
    // side the texture's v=0 edge lands on, and the gully below is placed from
    // the SAME expression so the two cannot disagree.
    const cz = Math.round(h * 0.18), cw = Math.max(3, Math.round(0.30 * WPM));
    g.fillStyle = 'rgba(20,20,21,0.34)'; g.fillRect(0, cz, w, cw);
    g.fillStyle = 'rgba(12,12,13,0.34)'; g.fillRect(0, cz + Math.floor(cw / 2) - 1, w, 2);
    g.fillStyle = 'rgba(158,158,155,0.20)'; g.fillRect(0, cz - 1, w, 1);   // lit arris
    // standing damp in the channel, and silt where it has dried at the edges
    for (let i = 0; i < Math.round(deep * 0.7); i++) {
      const px = nx() * w, len = (0.4 + nx() * 1.4) * WPM;
      g.fillStyle = `rgba(14,15,15,${(0.07 + nx() * 0.11).toFixed(3)})`;
      g.fillRect(px, cz, len, cw);
    }
    // grain per SQUARE METRE, the correction the facades and the first alley
    // both took — a flat count leaves a big floor bald
    dither(g, w, h, Math.round(deep * wide * 22));   // the first alley's density exactly
    // spills and stains, sized in metres, kept OFF the worn crown so the story
    // the floor tells stays legible
    for (let i = 0; i < 11; i++) {
      const cx = nx() * w;
      const edge = nx() < 0.5 ? h * (0.06 + nx() * 0.20) : h * (0.74 + nx() * 0.20);
      g.fillStyle = `rgba(0,0,0,${(0.14 + nx() * 0.14).toFixed(3)})`;
      g.beginPath();
      g.ellipse(cx, edge, (0.25 + nx() * 0.55) * WPM, (0.14 + nx() * 0.3) * WPM,
                nx() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }), 'ground');
}

/** Lay the pawn alley's ground: floor, gutter channel, gully and two vents.
 *  `deep`/`wide` come from the caller so no coordinate is remembered here. */
export function alley2Ground(scene: THREE.Scene, x0: number, x1: number,
                             z0: number, z1: number, y: number,
                             dress: (t: THREE.Texture) => THREE.Material,
                             /** `ctx.wet`, which is typed for MeshBasicMaterial — the same
                              *  shape floorDrain already takes, narrowed to match the
                              *  builder rather than casting at every call site */
                             wetFn: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial
                               = (m) => m): void {
  // ABUT, DO NOT COINCIDE. The flanks are zero-thickness planes standing at
  // z -53.01 and -55.49 and the back wall at x 24.8; a slab laid EXACTLY wall
  // to wall shares a coordinate with each of them, and whether that reads as
  // "touching" or "overlapping" then comes down to the last bit of a float.
  // footprint.mjs called it a clip — correctly, on the numbers it was given.
  //
  // 6 mm off each wall makes it unambiguous, and it is what a real slab does
  // anyway: it stops short of the brick and the joint is the gap. Invisible at
  // 32 px/m; the alternative was widening a tolerance in the check, which would
  // have blunted it for everyone to spare me a millimetre.
  const J = 0.006;
  const deep = Math.abs(x1 - x0) - J, wide = Math.abs(z1 - z0) - J * 2;
  const zN = Math.min(z0, z1) + J, zS = Math.max(z0, z1) - J;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(deep, wide),
                           dress(alley2FloorTex(deep, wide)));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2 - J / 2, y, (z0 + z1) / 2);
  m.userData.mod = 'tex-ground';
  // NOT `groundProp`. That tag means "a thing standing on the ground", and
  // footprint.mjs tests everything carrying it for intersection with the
  // world's solids. A FLOOR is the ground, and it intersects everything that
  // stands on it by definition — the moment D dressed this alley, their
  // downpipe and fire escape (based at y -0.007, just under this plane) made
  // the floor look like it was clipping through two props.
  //
  // I fixed the symptom first, insetting from the walls, and the joint is
  // right for its own reason. But the tag was the actual error: it put a
  // surface into a test written for objects.
  m.userData.alleyFloor = 2;
  scene.add(m);
  // The channel's line, matching the texture's 0.18 across the width.
  const cz = zN + wide * 0.18;
  // THE GULLY GOES AT THE MOUTH END, because that is where the fall takes the
  // water — the channel runs the length TO the mouth. 1.6 m in, so it is in the
  // alley rather than in the doorway you step through.
  // floorDrain's wetFn is generic and stays that way: ct/street.ts calls it,
  // and narrowing a signature under another module's caller is not mine to do.
  // Everything it dresses really is a MeshBasicMaterial, so adapt here.
  const wetAny = <T extends THREE.Material>(mm: T): T =>
    wetFn(mm as unknown as THREE.MeshBasicMaterial) as unknown as T;
  floorDrain(scene, x0 + 1.6, y, cz, 0.5, wetAny);
  // Two vents, on the SOUTH side, opposite the channel. Opposite on purpose:
  // a vent in a wet channel is a thing nobody builds, and keeping them apart
  // means neither is ever read as the other.
  ventGrille(scene, x0 + 5.4, y, zS - wide * 0.24, 0.75, 0.45, wetFn);
  ventGrille(scene, x0 + 11.9, y, zS - wide * 0.24, 0.75, 0.45, wetFn);
}

/** A flush ground vent — the louvred kind set INTO a floor that you walk over
 *  without noticing until you do. Deliberately not the drain: the drain is a
 *  square casting with bars across a black void, this is a wider, shallower
 *  frame with close blades and no hole behind them, so the two are told apart
 *  at a glance (the user's standing alley rule).
 *
 *  FLUSH MEANS FLUSH. The frame stands 6 mm proud, the blades sit 4 mm below
 *  it, and nothing here is tall enough to catch a foot — the alley is 2.5 m
 *  wide against a 2 m walking lane, so anything that could trip is a fault. */
export function ventGrille(scene: THREE.Scene, x: number, y: number, z: number,
                           w = 0.75, d = 0.45,
                           wetFn: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial
                             = (m) => m): THREE.Object3D[] {
  const FR = 0.05, FR_H = 0.006, BL_H = 0.004;
  const frameM = wetFn(new THREE.MeshBasicMaterial({ map: castTex() }));
  const bladeM = wetFn(new THREE.MeshBasicMaterial({ map: barTex() }));
  const backM = new THREE.MeshBasicMaterial({ color: 0x0d0e10 });
  const made: THREE.Object3D[] = [];
  const box = (bw: number, bh: number, bd: number, bx: number, by: number, bz: number,
               m: THREE.Material, part: string) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
    b.position.set(bx, by, bz);
    b.userData.ventPart = part;
    b.userData.groundProp = 'vent grille';
    scene.add(b); made.push(b);
  };
  // a shallow back so the blades have something dark behind them rather than
  // the floor showing through and killing the read
  box(w, 0.01, d, x, y - 0.004, z, backM, 'back');
  box(FR, FR_H, d + FR * 2, x - (w + FR) / 2, y + 0.003, z, frameM, 'frame');
  box(FR, FR_H, d + FR * 2, x + (w + FR) / 2, y + 0.003, z, frameM, 'frame');
  box(w, FR_H, FR, x, y + 0.003, z - (d + FR) / 2, frameM, 'frame');
  box(w, FR_H, FR, x, y + 0.003, z + (d + FR) / 2, frameM, 'frame');
  const NB = 9, pitch = d / NB;
  for (let i = 0; i < NB; i++)
    box(w, BL_H, pitch * 0.6, x, y + 0.001, z - d / 2 + pitch * (i + 0.5), bladeM, 'blade');
  return made;
}

export function floorDrain(scene: THREE.Scene, x: number, y: number, z: number, size = 0.60,
                           /** Pass `ctx.wet` to have the casting darken with the ground it
                            *  sits in. Optional and identity by default, because this is
                            *  exported and ct/street.ts calls it — a required parameter
                            *  would have been a breaking change to somebody else's file for
                            *  a cosmetic gain. See the note below on the kerb inlet, which
                            *  measured 0.0% against a gutter going -83%. */
                           wetFn: <T extends THREE.Material>(m: T) => T = (m) => m): THREE.Object3D[] {
  const OW = size, OL = size;
  const FL = 0.075, FR_H = 0.028, BAR_H = 0.012;
  // Wet only if the caller asked for it — see wetFn above.
  const ironM = wetFn(new THREE.MeshBasicMaterial({ map: castTex() }));
  const barM = wetFn(new THREE.MeshBasicMaterial({ map: barTex() }));
  const voidM = new THREE.MeshBasicMaterial({ color: 0x08090b });
  const made: THREE.Object3D[] = [];
  const box = (w: number, h: number, d: number, bx: number, by: number, bz: number,
               m: THREE.Material, part: string) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(bx, by, bz);
    b.userData.basinPart = part;
    scene.add(b); made.push(b);
  };
  box(OW, 0.02, OL, x, y - 0.009, z, voidM, 'void');
  box(FL, FR_H, OL + FL * 2, x - (OW + FL) / 2, y + 0.010, z, ironM, 'frame');
  box(FL, FR_H, OL + FL * 2, x + (OW + FL) / 2, y + 0.010, z, ironM, 'frame');
  box(OW, FR_H, FL, x, y + 0.010, z - (OL + FL) / 2, ironM, 'frame');
  box(OW, FR_H, FL, x, y + 0.010, z + (OL + FL) / 2, ironM, 'frame');
  const NB = 7, pitch = OL / NB;
  for (let i = 0; i < NB; i++)
    box(OW, BAR_H, pitch * 0.55, x, y + 0.007, z - OL / 2 + pitch * (i + 0.5), barM, 'bar');
  return made;
}


/** ALONG-STREET GRAIN AT THE LOT MOUTH — a feathered overlay, not a patch.
 *
 *  Builder I measured the fault and I judged it rather than auto-fixing it
 *  (notes/B-density-judgement-for-I.md): the long ground sheets are painted as
 *  a CROSS-SECTION and stretched down the street — 12.8 texels/m across, and
 *  **0.03 along z**. That is a legitimate technique, because a carriageway does
 *  not vary much along its length, and it is where the kerb-to-crown detail
 *  comes from. It runs out at exactly one place: the lot mouth, which is the
 *  "drive a car off the lot" view and the one spot where the player looks ALONG
 *  the street instead of across it. There, the user's "a large flat untextured
 *  grey plane" is literally true on that axis.
 *
 *  WHY THIS FEATHERS INSTEAD OF ABUTTING. The obvious local fix is a patch of
 *  proper 32 px/m ground laid over the mouth. That would put a straight-edged
 *  rectangle of one density against another — which is the exact fault class I
 *  have spent this session removing from the lighting, and I is not going to
 *  thank me for trading a bland surface for a visible seam. So the overlay
 *  carries alpha that falls to zero at all four edges: it ADDS grain where he
 *  stands and dissolves before it ends. There is no boundary to see.
 *
 *  It does not repaint the 124 m ribbons and it does not touch the apron, which
 *  is already 32 texels/m and is the control — nobody has complained about it.
 */
export function mouthGrain(scene: THREE.Scene, cx: number, cz: number,
                           w: number, d: number, y: number,
                           dress: (t: THREE.Texture) => THREE.Material): void {
  const W = Math.max(16, Math.round(w * WPM)), H = Math.max(16, Math.round(d * WPM));
  const t = declareSurface(pixTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    // deterministic — a rnd() draw here moves every tree in the world (GOTCHAS 2)
    let s2 = 0x1b873593 >>> 0;
    const rr = () => { s2 = Math.imul(s2 ^ (s2 >>> 15), 0x2c1b3c6d) >>> 0; return (s2 >>> 9) / 0x7fffff; };
    // ALONG-STREET features, which is the whole point: the cross-section sheets
    // already carry everything that varies across the road.
    for (let i = 0; i < Math.round(w * d * 0.5); i++) {
      const px = rr() * W, py = rr() * H;
      const rx = (0.25 + rr() * 1.1) * WPM, ry = (0.18 + rr() * 0.6) * WPM;
      g.fillStyle = rr() < 0.55 ? `rgba(24,24,26,${(0.05 + rr() * 0.10).toFixed(3)})`
                                : `rgba(150,150,148,${(0.03 + rr() * 0.06).toFixed(3)})`;
      g.beginPath(); g.ellipse(px, py, rx, ry, rr() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    // a few tar-band repairs running ACROSS the carriageway, which is what a
    // real road has along its length and what the stretched sheet cannot show
    for (let i = 0; i < 3; i++) {
      const py = (0.18 + rr() * 0.64) * H;
      g.strokeStyle = `rgba(18,18,19,${(0.14 + rr() * 0.10).toFixed(3)})`;
      g.lineWidth = 1 + rr() * 2.2;
      g.beginPath(); g.moveTo(0, py);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, py + (rr() - 0.5) * 3.2);
      g.stroke();
    }
    dither(g, W, H, Math.round(w * d * 14));
    // FEATHER: multiply alpha down to nothing at every edge, so this overlay
    // has no boundary anywhere. 1.2 m of fade, which at 32 px/m is ~38 px.
    const img = g.getImageData(0, 0, W, H), px2 = img.data;
    const fx = Math.max(2, Math.round(1.2 * WPM)), fy = Math.max(2, Math.round(1.2 * WPM));
    for (let yy = 0; yy < H; yy++) {
      const ey = Math.min(1, Math.min(yy, H - 1 - yy) / fy);
      for (let xx = 0; xx < W; xx++) {
        const ex = Math.min(1, Math.min(xx, W - 1 - xx) / fx);
        const k = (yy * W + xx) * 4 + 3;
        px2[k] = Math.round(px2[k] * ex * ey);
      }
    }
    g.putImageData(img, 0, 0);
  }), 'ground');
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const mat = dress(t) as THREE.MeshBasicMaterial;
  mat.transparent = true;
  mat.depthWrite = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, y, cz);
  m.userData.mod = 'tex-ground';
  m.userData.mouthGrain = true;
  scene.add(m);
}

/**
 * WHERE THE TWO JUNCTION CROSSINGS LAND — hoisted out of `buildGround`'s own
 * closure so nothing that needs this geometry has to copy it.
 *
 * `crosstown.ts` needed exactly these four numbers to stop its centre line
 * painting through both crossings and, with this file read-only to that
 * item, copied them WITH A CITATION rather than duplicating them silently —
 * `ct/tex-ground.ts:1351-1352` (as of `705b78b74`) — and queued this export
 * as the follow-up rather than leaving a hand-typed copy to drift (GOTCHAS
 * §56: a copied constant rots the moment either side changes and nothing
 * says so). Same four numbers `buildGround` already used locally; only the
 * declaration moved, so this is a pure hoist and changes no geometry.
 */
export const JUNCTION_CROSSINGS = {
  /** across the MAIN street, walked E-W — z centre, half-width */
  main: { z: -90.2, hw: 1.3 },
  /** across the SIDE street, walked N-S — x centre, half-width */
  side: { x: 10.6, hw: 1.3 },
};

export function buildGround(o: GroundOpts): Ground {
  const { scene, flat, wet, KERB_H } = o;
  // THE WET REGISTRATION, REACHABLE BY ANYONE HOLDING `scene`, and published
  // from HERE because of when this module builds.
  //
  // 08ad3f0b: ct/vice.ts cannot join the wet-look "not by decision but because
  // the constructor takes four arguments" — { scene, flat, solid, KERB_H }. Its
  // brass-threshold runner stays dry, and the same shape left the road centre
  // lines bone white on an 83%-darkened road (b209275c).
  //
  // I first published this from ct/props.ts and it was useless: buildProps runs
  // at crosstown.ts:210 and buildStreet, which places vice, at :103, so it did
  // not exist when a build-time caller needed it. buildGround runs at :66,
  // before both. Holding `scene` is not the same as holding it in time.
  //
  // `ctx.wet` itself, re-exported — one registry, one way in, no second copy of
  // the curve. ONE WRITER PER MATERIAL: registering hands the COLOUR to
  // updateRain every frame, so register what you do not paint yourself.
  scene.userData.registerWet = wet;
  const mark = scene.children.length;   // see ct/props.ts — stamped at the end

  // ── where the junction crossings land, READ before the kerb is built ──
  //
  // Order matters and it is not obvious: `buildPath` samples `driveReveal` for
  // every vertex it emits, so a ramp registered after it exists in the list and
  // in nothing you can see. The paint is laid further down from these same four
  // numbers, so the dropped kerb and the stripes cannot drift apart — which is
  // the whole of "aligned with the kerb ramps, or put ramps where they land".
  //
  // Numbers themselves live in the module-level `JUNCTION_CROSSINGS` export
  // now, not here — this is a READ, not a declaration, so anything else that
  // needs the same geometry (`crosstown.ts`'s centre line) can import it
  // instead of copying it.
  const { z: XA_Z, hw: XA_HW } = JUNCTION_CROSSINGS.main;   // across the MAIN street, walked E-W
  const { x: XB_X, hw: XB_HW } = JUNCTION_CROSSINGS.side;   // across the SIDE street, walked N-S
  pedCut(-ROAD_HALF, XA_Z, XA_HW, 'z');    // west kerb of the main street
  pedCut(ROAD_HALF, XA_Z, XA_HW, 'z');     // east kerb
  pedCut(XB_X, o.SIDE_Z0, XB_HW, 'x');     // north kerb of the side street
  pedCut(XB_X, o.SIDE_Z1, XB_HW, 'x');     // south kerb

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
  // the bus stop, resolved the same way — nearest point on the kerb path to
  // the flag, then a bus length either side of it
  for (const [sx, sz] of BUS_STOPS) {
    let best = -1, bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - sx, p.z - sz);
      if (d < bestD) { bestD = d; best = p.s; }
    }
    if (best >= 0) redZones.push([best - STOP_CLEAR, best + STOP_CLEAR]);
  }
  // RULE 4 — the driveway. Same rule again, not a new one: red kerb means no
  // parking, and a car left across a curb cut blocks the only way in or out of
  // the lot. The zone is the opening plus its flares, which is exactly the
  // stretch a parked car would foul.
  for (const d of DRIVES) {
    let best = -1, bestD = Infinity;
    for (const p of pts) {
      const dd = Math.hypot(p.x - d.x, p.z - d.z);
      if (dd < bestD) { bestD = dd; best = p.s; }
    }
    if (best >= 0) redZones.push([best - d.hw - DRIVE_F, best + d.hw + DRIVE_F]);
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
  // The east walk is BROKEN at the car lot's driveway, and the apron below
  // fills the gap. It cannot simply be laid over the slab: the apron descends
  // below KERB_H toward the kerb, so a flat slab at KERB_H would stand proud
  // of it and you would see pavement floating over the ramp.
  {
    const d = DRIVES[0], g0 = d.z - d.hw - DRIVE_F, g1 = d.z + d.hw + DRIVE_F;
    slab(ROAD_HALF + CH, 7, -94.5, g0);
    slab(ROAD_HALF + CH, 7, g1, 16.5);
    // ── the apron ──
    // A grid rather than a quad, because the surface is not planar: it is
    // level at the building line and level again outside the flares, and it
    // dips to the kerb's own reveal in between. Sampled from the SAME
    // apronY() the ground-height function uses, so what you see and what you
    // walk on cannot drift apart.
    const NX = 6, NZ = 40, inner = ROAD_HALF + CH;
    const pos: number[] = [], uv: number[] = [];
    const at = (i: number, k: number) => {
      const x = inner + ((7 - inner) * i) / NX, z = g0 + ((g1 - g0) * k) / NZ;
      return [x, apronY(x, z, KERB_H) ?? KERB_H, z] as const;
    };
    for (let i = 0; i < NX; i++) for (let k = 0; k < NZ; k++) {
      const a0 = at(i, k), b0 = at(i + 1, k), c0 = at(i + 1, k + 1), d0 = at(i, k + 1);
      // WOUND FOR AN UPWARD NORMAL. This emitted a,b,c / a,c,d, and with i
      // increasing in x and k in z that is (dx,0,0) x (dx,0,dz) = -y: the top
      // face pointed DOWN, was back-face culled, and you looked straight through
      // the apron to the dark skirt box underneath it.
      //
      // That is the whole of the user's report. "A LARGE FLAT UNTEXTURED GREY
      // PLANE ... a colour that matches neither the walk nor the road" is
      // exactly right, and the colour is 605d56 — walkDarkM, the skirt's
      // material, which is not meant to be seen from above at all. No texture I
      // put on the apron could have shown, and the first one I tried did not:
      // I painted it red with black stripes to test and the surface stayed grey.
      for (const [vx, vy, vz] of [a0, c0, b0, a0, d0, c0]) {
        pos.push(vx, vy, vz);
        // walkTex encodes its world alignment in the texture's own repeat and
        // offset and expects UV 0..1 ACROSS THE REGION — exactly what a box's
        // top face gives it. World-derived UVs bypass that and get multiplied
        // by the repeat on top, which samples the sheet anywhere at all. v runs
        // from maxZ to minZ, which is the sense walkTex's offset assumes.
        uv.push((vx - inner) / (7 - inner), (g1 - vz) / (g1 - g0));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    scene.add(new THREE.Mesh(geo, wet(flat(apronTex(inner, 7, g0, g1)))));
    // and the dark edge under it, so the apron does not float at the kerb
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(7 - inner, 0.14, g1 - g0), walkDarkM);
    skirt.position.set((inner + 7) / 2, -0.07 + 0.002, (g0 + g1) / 2);
    scene.add(skirt);
  }
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
    // VERTICAL FACE, bottom below grade. Mapped to the sheet's FULL height
    // whatever the reveal is, rather than clipped at a fixed world height.
    //
    // "dont like how this curb is discontinuous" (shots/user-kerb-discontinuous
    // .png, and shots/cut-road-across-day.png is the same thing seen head on):
    // the kerb runs red-painted from the left, VANISHES for 7.40 m across the
    // car lot's cut, and comes back on the right. Measured with
    // scripts/curbcut.mjs, off the built geometry rather than off the source.
    //
    // The geometry is not the fault — a depressed kerb at a driveway really is
    // a 3.5 cm lip, and DRIVE_H is period-correct. The fault is that this uv
    // clipped the sheet at (pT - KBOT) / KTEX, so a depressed kerb showed a
    // 1.5 cm slice out of the MIDDLE of the profile: no light top edge, no dark
    // grit line, a mid-grey sliver against a mid-grey gutter. Nothing to see is
    // exactly what he reported.
    //
    // kerbTex is drawn as a kerb's whole profile — pale just under the arris,
    // stained toward the road, dark below grade — so it belongs on whatever
    // height the kerb has, compressed, not cropped. On a full-reveal kerb
    // (pT - KBOT) is exactly KTEX and this is the SAME uv it always had; only
    // the ramped runs change, which is the whole of what was wrong. The red
    // kerb paint below has always mapped 0..1 this way.
    V(facePos, p.x, KBOT, p.z); T(faceUv, pk, 0);
    V(facePos, p.x, pT, p.z); T(faceUv, pk, 1);
    V(facePos, q.x, qT, q.z); T(faceUv, qk, 1);
    V(facePos, p.x, KBOT, p.z); T(faceUv, pk, 0);
    V(facePos, q.x, qT, q.z); T(faceUv, qk, 1);
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
  //
  // v1 was two flat planes — a grate texture laid on the pan, a hood texture
  // painted on the kerb face — and the user's read was "what is this it looks
  // bad". That is right, and it is the same defect as the lamp glow: a decal
  // asked to do a job only geometry can do. A grate drawn flat is a black
  // void with bars floating in it. Nothing framed it, nothing seated it in the
  // concrete, and the kerb inlet had no throat behind it, so it was a
  // rectangle of paint on a kerb.
  //
  // A combination inlet is a CASTING, and it is built as one now:
  //   · a frame whose flange beds into the pan and stands slightly proud, the
  //     way one does once the surface around it has worn down
  //   · the grate dropped into the frame's rebate so its bars sit about a
  //     centimetre BELOW the frame top — that step is most of what says
  //     "casting" rather than "drawing"
  //   · slots that are open onto a dark shaft, so they are holes into
  //     something instead of black paint
  //   · a throat through the kerb face under a cast lintel, which is what the
  //     inlet is FOR — it takes water when the grate blinds over with leaves
  //
  // Every one of those reads by an EDGE and the shadow the edge throws, and an
  // edge is the one thing a flat decal cannot have.
  // THE CASTING GETS WET WITH THE GUTTER IT SITS IN. Measured before fixing:
  // the gutter pan goes 1.000 -> 0.169 in rain, a drop of 83%, while this
  // basin's frame, bars and throat all moved 0.0% — bone-dry iron in the one
  // place on the street the water is actually draining to. wetsweep.mjs had
  // them in its "never gets wet" class and I wrote them off as the known "light
  // surfaces stay dry" group without checking which surfaces they were.
  //
  // Registered rather than hand-tinted: `wet()` puts the material in the
  // registry updateRain owns, which is also its ONE writer — ct/props.ts skips
  // anything in wetMats in both grading paths, so this cannot be written twice.
  //
  // The void is the shaft seen through the slots, already 0x08090b, and 83% of
  // near black is still near black. Left out on purpose.
  const ironM = wet(new THREE.MeshBasicMaterial({ map: castTex() }));
  const barM = wet(new THREE.MeshBasicMaterial({ map: barTex() }));
  const voidM = new THREE.MeshBasicMaterial({ color: 0x08090b });
  const basin = (kx: number, z: number, side: number) => {
    const cx = kx - side * 0.30;                  // centre of the opening in the pan
    const PY = gutterSurfaceY(0.30);              // the pan is cross-sloped; this is its height here
    const OW = 0.56, OL = 0.86;                   // clear opening: 2 ft x 3 ft
    const FL = 0.075, FR_H = 0.028, BAR_H = 0.012;
    const box = (w: number, h: number, d: number, x: number, y: number, cz: number, m: THREE.Material,
                 part?: string) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, cz);
      // `part` lets scripts/basin.mjs find the surround by NAME. park.mjs went
      // blind once matching a lantern by its exact box size, which I then
      // changed; a stamp cannot drift out from under a check that way.
      if (part) b.userData.basinPart = part;
      scene.add(b);
    };
    // The pan is a continuous surface and there is no hole cut in it, so the
    // casting sits ON it and the shaft is a dark plate 1 mm above the concrete
    // seen through the slots. At a 2 cm rebate that is indistinguishable from
    // a real opening and it costs no surgery on the kerb mesh.
    box(OW, 0.02, OL, cx, PY - 0.009, z, voidM);
    // frame — flange all four sides, top 24 mm above the pan
    box(FL, FR_H, OL + FL * 2, cx - side * (OW + FL) / 2, PY + 0.010, z, ironM);
    box(FL, FR_H, OL + FL * 2, cx + side * (OW + FL) / 2, PY + 0.010, z, ironM);
    box(OW, FR_H, FL, cx, PY + 0.010, z - (OL + FL) / 2, ironM);
    box(OW, FR_H, FL, cx, PY + 0.010, z + (OL + FL) / 2, ironM);
    // the grate: seven bars across the flow, sunk 11 mm under the frame top
    const NB = 7, pitch = OL / NB;
    for (let i = 0; i < NB; i++) {
      box(OW, BAR_H, pitch * 0.55, cx, PY + 0.007, z - OL / 2 + pitch * (i + 0.5), barM);
    }
    // the two rails the bars land on, along the kerb line
    box(0.035, BAR_H, OL, cx - OW / 2 + 0.017, PY + 0.007, z, barM);
    box(0.035, BAR_H, OL, cx + OW / 2 - 0.017, PY + 0.007, z, barM);

    // ── the throat through the kerb face ──
    // The kerb mesh cannot be opened without rebuilding KPATH, so the surround
    // stands a few millimetres off the face with the dark opening just inside
    // it. The FIRST attempt at this stood 22 mm proud, and that was wrong for
    // a reason worth keeping: you look at a kerb from 1.6 m eye height two
    // metres away, which is about 20 degrees down, and at 20 degrees a lintel
    // 22 mm proud casts itself over 62 mm of the face below it. The opening
    // was 66 mm tall, so the lintel hid the entire throat from the only angle
    // anyone stands at. Anything proud of a near-vertical face has to be
    // measured against the angle it will be SEEN at, not against the face.
    const PROUD = 0.007;
    const fx = kx - side * PROUD;
    const TL = 0.92;
    const throat = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.070, TL - 0.05),
      // wet with the rest of the casting: the throat is the wettest part of it,
      // being the hole the gutter drains into
      wet(new THREE.MeshBasicMaterial({ map: throatTex() })));
    throat.position.set(kx - side * 0.002, 0.059, z);
    throat.userData.basinPart = 'throat';
    throat.userData.basinSide = side;
    scene.add(throat);
    box(PROUD, 0.020, TL, fx, 0.104, z, ironM, 'frame');                 // lintel
    box(PROUD, 0.014, TL, fx, 0.017, z, ironM, 'frame');                 // sill
    for (const s2 of [-1, 1]) {                                          // cheeks either end
      box(PROUD, 0.090, 0.045, fx, 0.059, z + s2 * (TL / 2 - 0.0225), ironM, 'frame');
    }
  };
  basin(ROAD_HALF, -92.5, 1);    // east gutter, just up-grade of the corner return
  basin(-ROAD_HALF, -105, -1);   // west gutter, above the inside bend

  // ── ground height: the corners are curved and one of them ramps ─────────
  const gy = (x: number, z: number): number | null => {
    // the driveway apron first — it overrides the flat walk it is cut into,
    // and it is what makes the cut something you can actually walk and drive
    // over rather than a picture of one
    const ap = apronY(x, z, KERB_H);
    if (ap !== null) return ap;
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
  // H's east-end crossing, painted. The kerb ramps at both ends are KRAMP on
  // vertices 2 and 3 above; this is the carriageway half.
  //
  // Held clear of BOTH gutter pans — the road cross-slopes through the last
  // 0.45 m into the pan at each kerb, and paint laid across that would either
  // float off the slope or sink into it. The kerbs here are z -108 and -98, so
  // the bars run -107.4 to -98.6 and the last 0.6 m at each end is bare
  // asphalt, which is what a real crossing looks like anyway: the bars stop
  // short of the gutter.
  //
  // x 53.8, not H's 54.0: the crossing corridor has to fit between the
  // carriageway and the closed end's kerb at x = 55, and 1.1 m either side of
  // 53.8 lands the far edge at 54.9 — abutting that kerb rather than climbing
  // over it (GOTCHAS 6). 20 cm off H's centreline, well inside the corridor
  // their walkers use.
  // ── THE JUNCTION CROSSINGS ────────────────────────────────────────────
  //
  // The stripes used to be at the side street's DEAD EAST END (x 53.8, spanning
  // z -107.4..-98.6). The user: *"remove that crossing"*
  // (shots/user-remove-crosswalk.png) — confirmed by position before deleting
  // anything, since the junction has legitimate ones: the only painted crossing
  // mesh in the world measured x 52.70..54.90, z -107.40..-98.60, and SEVENS
  // stands at x 45.45..57.00 with its face at z -96, which is the marquee in
  // his shot. Unambiguous.
  //
  // And it moves HERE, which is the same move rather than the opposite one:
  // *"a wide open intersection, citizens waiting on the kerb, and NO crossings
  // anywhere on it."* The paint goes where people already stand.
  //
  // TWO, NOT FOUR. The junction is a T — the main street runs on north and the
  // side street dead-ends east — so there are only two arms anybody crosses to
  // get anywhere: over the main street to reach the west pavement, and over the
  // side street to reach the south one. A fourth arm would be a crossing to a
  // kerb nobody walks to, and a 1997 corner gets paint where the traffic
  // engineer had a reason, not for symmetry.
  //
  // SET BACK PAST THE CORNER ARC, which the desk asked for and the geometry
  // forces. The bodega return is a 3.5 m radius, so the kerb is not parallel to
  // anything until z = -94.5 on the main street and x = 8.5 on the side street.
  // A crossing laid against a curve has one end square and the other splayed.
  //
  // AND CLEAR OF THE GULLY. The east catch basin sits at (5, -92.5) and its
  // casting runs z -93..-92 — stripes over a casting z-fight it and read as
  // paint laid over ironwork, which is not what a crossing is. The window south
  // of it is only 1 m wide, so the crossing goes north of it.
  crossingStripes(scene, XA_Z, -ROAD_HALF, ROAD_HALF, XA_HW, 0, (t) => wet(flat(t)), 'x');
  crossingStripes(scene, XB_X, o.SIDE_Z1, o.SIDE_Z0, XB_HW, 0, (t) => wet(flat(t)), 'z');

  // The lot mouth: the kerb cut at z 2.6 (DRIVES above). Wide enough to cover
  // the carriageway the player looks down when driving out, long enough along
  // the street that the feather has room to dissolve. Laid 3 mm over the road,
  // under nothing.
  mouthGrain(scene, 0, 2.6, 11.0, 14.0, 0.003, (t) => wet(flat(t)));

  // The pawn alley's ground is laid from ct/props.ts, NOT here. This module
  // builds at crosstown.ts:66, before any building exists; the alley is cut by
  // ct/street.ts during buildWorld at 241, and buildProps runs at 243. Laying
  // it here found no alley at all and silently laid nothing — the guard doing
  // its job for the wrong reason. `alley2Ground` is exported for that caller.

  for (let i = mark; i < scene.children.length; i++) {
    scene.children[i].traverse((n) => { n.userData.mod = 'tex-ground'; });
  }

  return { gy };
}
