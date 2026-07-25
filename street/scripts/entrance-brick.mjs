// Does the brick run THROUGH the entrance bay of No. 227?
//
// The user, on an earlier version: *"i dont like the white background on the
// sycamore door"* — the doorway sat in a wide pale stone panel that cut the
// brick coursing in half. The fix was to let the brick run all the way across
// and give the door only a narrow stone doorcase hugging it.
//
// Nothing guarded that. `resGroundTex` paints the band from ENTRANCE.BAY_W,
// CASE_W and OPEN_W, and widening the doorcase — or painting the reserved bay
// in stone again — brings the panel straight back. It is an APPEARANCE request,
// so the thing to guard is the DEFECT (a wide pale field across the bay), not
// the quality.
//
// So: read the band's own texture out of the running world and count what
// colour the bay actually is, at the height of the doorcase.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/entrance-brick.mjs
//        --selftest   count the doorcase as stone-wide, require this to fail
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { installMats, blindSpot } from './lib/materials.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await installMats(p);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // The ground-floor band of No. 227: found by its world box touching the east
  // building line and spanning the doorway at z = -44, not by a remembered
  // mesh. Its street face is the widest texture on it.
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    // the shared walk (4008d7c3): this check found the band only because I
    // handled the array case by hand, and the band IS a six-material box
    const maps = window.__mats(n).filter((m) => m?.map?.image).map((m) => m.map);
    if (!maps.length) return;
    n.geometry.computeBoundingBox();
    const g = n.geometry.boundingBox; if (!g) return;
    const e = n.matrixWorld.elements;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const cx of [g.min.x, g.max.x]) for (const cy of [g.min.y, g.max.y]) for (const cz of [g.min.z, g.max.z]) {
      const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12];
      const Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13];
      const Z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      z0 = Math.min(z0, Z); z1 = Math.max(z1, Z);
    }
    if (Math.abs(x0 - 7) > 0.2) return;            // on the east building line
    if (z0 > -44 || z1 < -44) return;              // spans the doorway
    if (y0 > 0.1 || y1 < 2.5 || y1 > 4.5) return;  // the ground band, not the wall above
    const map = maps.reduce((a, m) => (m.image.width > a.image.width ? m : a), maps[0]);
    best = { map, z0, z1, y0, y1 };
  });
  if (!best) return null;

  const im = best.map.image;
  const cv = document.createElement('canvas');
  cv.width = im.width; cv.height = im.height;
  cv.getContext('2d').drawImage(im, 0, 0);
  const px = cv.getContext('2d').getImageData(0, 0, im.width, im.height).data;

  const ppm = im.width / (best.z1 - best.z0);
  const BAY = 4.0;                                  // ENTRANCE.BAY_W
  const cx = im.width / 2;                          // the doorway is centred
  const half = (BAY / 2) * ppm;
  // read at the doorcase's own height: a third of the way up the band
  const row = Math.round(im.height * 0.55);
  let stone = 0, brick = 0, dark = 0;
  for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
    const i = (row * im.width + x) * 4;
    const R = px[i], G = px[i + 1], B = px[i + 2];
    const lum = (R + G + B) / 3;
    if (lum < 70) { dark++; continue; }             // the opening / its reveal
    // stone is pale and near-neutral; brick is darker and clearly red
    if (lum > 110 && R - B < 55) stone++; else brick++;
  }
  return { w: im.width, h: im.height, ppm, row, stone, brick, dark, bayPx: Math.round(half * 2) };
});
await b.close();

if (!r) { console.error("could not find No. 227's ground band — has the facade moved?"); process.exit(1); }
let { stone, brick, dark, bayPx } = r;
if (SELFTEST) { stone += brick; brick = 0; console.log('selftest: calling the whole bay stone — this MUST now go red'); }
const lit = stone + brick;
const frac = lit ? stone / lit : 0;
console.log(`band texture ${r.w}x${r.h} at ${r.ppm.toFixed(1)} px/m; bay = ${bayPx} px, row ${r.row}`);
console.log(`  across the 4.0 m bay: ${brick} brick, ${stone} stone, ${dark} dark (the opening)`);
console.log(`  stone is ${(frac * 100).toFixed(0)}% of the painted bay`);

if (frac > 0.45) {
  console.error(`\nTHE PALE PANEL IS BACK. The doorway sits in a wide stone field again`);
  console.error(`instead of a narrow doorcase with brick running through the bay —`);
  console.error(`the thing the user rejected. Check ENTRANCE.CASE_W against BAY_W.`);
  if (SELFTEST) { console.log('SELFTEST PASSED — a stone bay was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the bay was called all stone and this did not notice.'); process.exit(2); }
console.log('\nthe brick runs through the bay; the doorcase is a narrow frame.');
