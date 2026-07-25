// The car lot's LAYOUT, in the user's own words:
//
//   "i would like lines of cars on the right and left as i enter with the
//    actual office in the back of the lot"
//
// That is three separate claims and none of them had a check. The lot could be
// re-planned — bays reordered, the office moved back to the front corner where
// it started — and nothing would go red. `lotwalk` proves you can get IN;
// nothing proved that what you walk into is the thing that was asked for.
//
// Each clause is tested the way a player would meet it:
//   1. AS I ENTER      — a clear aisle from the mouth to the back of the site
//   2. RIGHT AND LEFT  — stepping off that aisle either way puts you into a car
//   3. OFFICE IN BACK  — the cabin stands in the rear third, not at the front
//
// And one more from an earlier round of the same conversation:
//
//   "why is there just signs floating"
//
//   4. NOTHING FLOATS  — every banner on the frontage has fence behind it
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot-layout.mjs
//        --selftest    move the office to the front, require this to go red
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

// Where the lot is, its office, its banners and its fence — asked, not
// remembered.
const site = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, office = null;
  const banners = [], fence = [];
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    x0 = Math.min(x0, e[12]); x1 = Math.max(x1, e[12]);
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
    // the office cabin: the one 3.0 x 2.7 x 4.6 box in the lot
    const g = o.geometry?.parameters;
    if (g && Math.abs(g.width - 3.0) < 0.01 && Math.abs(g.height - 2.7) < 0.01
          && Math.abs(g.depth - 4.6) < 0.01) office = [e[12], e[14]];
    // EVERY material, not `o.material.map`. a7f2241d found nightgrade skipping
    // multi-material meshes entirely, which is the same blind spot that hid the
    // entrance band from me twice: on a box, `o.material` is an ARRAY and
    // `.map` is undefined. Banners and fence panels are single-material planes
    // today, so this changes no number — but a banner that ever became part of
    // a multi-material mesh would silently not be counted, and an uncounted
    // banner is an unchecked one. A false negative in the check that exists to
    // catch floating signs is the worst possible failure for it.
    const ims = (Array.isArray(o.material) ? o.material : [o.material])
      .map((mm) => mm?.map?.image).filter(Boolean);
    for (const im of ims) {
      if (g && g.height && Math.abs(g.height - 0.62) < 0.001 && im.height === 30)
        banners.push({ x: e[12], y: e[13], z: e[14], w: g.width });
      if (im.width === 24 && im.height === 24 && g && g.width)
        fence.push({ x: e[12], y: e[13], z: e[14], w: g.width, h: g.height });
    }
  });
  return x0 > x1 ? null : { x0, x1, z0, z1, office, banners, fence };
});
if (!site) { console.error('no meshes stamped `lot` — is the lot in this world?'); process.exit(1); }
const zMid = (site.z0 + site.z1) / 2;
console.log(`lot x ${site.x0.toFixed(1)} … ${site.x1.toFixed(1)}, z ${site.z0.toFixed(1)} … ${site.z1.toFixed(1)}`);

// Geometric, not a walk. I tried walking the aisle first and the rig drifts —
// it left the centreline by 3.4 m over a 3 s hold and stopped short, so the
// result said "no aisle" when the aisle is fine. `lotwalk` already proves you
// can WALK in; what this has to prove is the SHAPE, and for that the collider
// array is the honest instrument: deterministic, and the same one the movement
// code tests against.
const cols = await p.evaluate(() => window.__ct.colliders()
  .map((c) => [c.minX, c.maxX, c.minZ, c.maxZ]).filter((c) => c[0] < 500));
const R = 0.36;
const free = (x, z) => !cols.some(([a, b2, c, d]) =>
  x > a - R && x < b2 + R && z > c - R && z < d + R);
const FAIL = [];
const depth = site.x1 - site.x0;

// 1 — AS I ENTER: the centreline is walkable from the mouth to the back.
let clearTo = site.x0;
for (let x = site.x0; x <= site.x1 - 2.0; x += 0.25) {
  if (!free(x, zMid)) break;
  clearTo = x;
}
const reach = clearTo - site.x0;
console.log(`  aisle: clear along the centreline for ${reach.toFixed(1)} m of ${depth.toFixed(1)} m`);
if (reach < depth * 0.7) FAIL.push(`no aisle to the back — clear for ${reach.toFixed(1)} m of ${depth.toFixed(1)} m`);

// 2 — RIGHT AND LEFT: step off the aisle and a car is there, both sides, and
// it must be a CAR rather than the perimeter — so look within half the site.
for (const [name, dir] of [['left (north)', 1], ['right (south)', -1]]) {
  let hit = null;
  for (let d = 0.5; d < (site.z1 - site.z0) / 2; d += 0.25) {
    if (!free(site.x0 + depth * 0.45, zMid + dir * d)) { hit = d; break; }
  }
  console.log(`  ${name}: something solid ${hit === null ? 'never' : hit.toFixed(1) + ' m'} off the centreline`);
  if (hit === null || hit > 6.0) FAIL.push(`${name} of the aisle is empty — nothing within 6 m`);
}

// 3 — OFFICE IN BACK
if (!site.office) FAIL.push('no office cabin found in the lot at all');
else {
  let ox = site.office[0];
  if (SELFTEST) { ox = site.x0 + 1.0; console.log('selftest: pretending the office is at the front — this MUST now go red'); }
  const frac = (ox - site.x0) / depth;
  console.log(`  office at x ${ox.toFixed(1)}, ${(frac * 100).toFixed(0)}% of the way back`);
  if (frac < 0.66) FAIL.push(`the office is not in the back — ${(frac * 100).toFixed(0)}% back, wanted 66%+`);
}

// 4 — NOTHING FLOATS: every banner has fence behind it.
// The banners are hung on the mesh; the complaint was that they were hung on
// nothing. A banner is "attached" if a chain-link panel spans its z and its
// height — which is the geometric form of what the user was looking at.
console.log(`  frontage: ${site.banners.length} banners, ${site.fence.length} chain-link panels`);
if (!site.banners.length) FAIL.push('no banners on the frontage at all');
if (!site.fence.length) FAIL.push('no chain-link on the frontage at all');
for (const bn of site.banners) {
  const backed = site.fence.some((f) =>
    Math.abs(f.x - bn.x) < 0.6
    && bn.z > f.z - f.w / 2 - 0.1 && bn.z < f.z + f.w / 2 + 0.1
    && bn.y > f.y - f.h / 2 - 0.1 && bn.y < f.y + f.h / 2 + 0.1);
  if (!backed) FAIL.push(`a banner at z ${bn.z.toFixed(1)}, y ${bn.y.toFixed(2)} has no fence behind it`);
}

await b.close();
if (FAIL.length) {
  console.error(`\nFAILED (${FAIL.length}):`);
  for (const f of FAIL) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the moved office was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the office was moved to the front and this did not notice.'); process.exit(2); }
console.log('\nlines of cars right and left as you enter, office in the back — as asked.');
