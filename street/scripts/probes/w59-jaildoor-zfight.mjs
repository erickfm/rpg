// Is the jail's front door coplanar with the stone behind it?
//
// The user, 2026-08-02, in daylight: *"jail door is still messed up"* — the
// leaves are SEE-THROUGH, with masonry coursing and the stone reveal visible
// THROUGH them. The desk's lead was `ct/interior.ts:924`'s `opacity: 0.55`
// glazing. That material is a room WINDOW; the exterior leaf is
// `flat(jailLeafTex())`, i.e. `new MeshBasicMaterial({ map })` — opaque, no
// `transparent` flag at all. So transparency cannot be the mechanism.
//
// The other thing that looks exactly like see-through is Z-FIGHTING: two
// opaque faces at the SAME depth, where the depth test has no winner and the
// rasteriser picks per-fragment. That is what this probe measures — it finds
// the leaves by geometric SIGNATURE (never by a coordinate typed here) and
// reports the front-face x of every mesh sharing their footprint.
//
// Exits non-zero when a leaf's front face is within Z_EPS of another opaque
// face spanning it. BUILDER-BRIEF: a check must exit non-zero to fail.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4187/';
/** two opaque faces closer than this cannot be resolved by a 24-bit depth
 *  buffer at street range — anything under it renders as tearing */
const Z_EPS = 0.002;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
// The world culls by region: at spawn the jail is not in the scene at all and
// this probe reports "no leaf" rather than a verdict. Stand at the user's own
// approach to the sally port first — 0.75 m off the recessed leaf plane, on
// the pavement outside, which is `standOf(DOOR)` in ct/int-jail.ts.
await p.evaluate(() => window.__ct.warp(58.5, -103));
await p.waitForTimeout(1200);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    boxes.push({
      x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z,
      w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z,
      transparent: mats.some((m) => m && m.transparent),
      opacity: mats.map((m) => (m && m.opacity !== undefined ? m.opacity : 1)),
      mapW: mats[0] && mats[0].map && mats[0].map.image ? mats[0].map.image.width : 0,
      mapH: mats[0] && mats[0].map && mats[0].map.image ? mats[0].map.image.height : 0,
    });
  });
  return boxes;
});
await b.close();

// ── find the leaves by SIGNATURE ────────────────────────────────────────────
// A jail leaf is a thin upright slab: ~0.09 m through, ~3 m tall, ~1.2 m across
// in z, carrying a 24x64 canvas. `jailLeafTex` is the only 24x64 map in the
// world, which is what makes this identification safe without a coordinate.
const leaves = out.filter((o) => o.mapW === 24 && o.mapH === 64
  && o.w < 0.2 && o.h > 2.5 && o.d > 0.8 && o.d < 2.0);
console.log(`leaves found by 24x64 signature: ${leaves.length}`);
if (leaves.length === 0) { console.log('MISS: no jail leaf found — signature is stale'); process.exit(2); }

let bad = 0;
for (const L of leaves) {
  console.log(`\nleaf  x ${L.x0.toFixed(3)}…${L.x1.toFixed(3)}  y ${L.y0.toFixed(2)}…${L.y1.toFixed(2)}  z ${L.z0.toFixed(2)}…${L.z1.toFixed(2)}  transparent=${L.transparent} opacity=${JSON.stringify(L.opacity)}`);
  // everything that shares this leaf's y/z footprint and is NOT the leaf itself
  const behind = out.filter((o) => o !== L
    && o.z0 < L.z1 - 0.05 && o.z1 > L.z0 + 0.05
    && o.y0 < L.y1 - 0.05 && o.y1 > L.y0 + 0.05
    && o.x1 > L.x0 - 0.5 && o.x0 < L.x1 + 1.5);
  for (const o of behind) {
    const gap = o.x0 - L.x0;                       // front face of each, +x is INTO the building
    const flag = Math.abs(gap) < Z_EPS ? '  <<< COPLANAR WITH THE LEAF FRONT FACE' : '';
    if (flag) bad++;
    console.log(`   behind: x ${o.x0.toFixed(3)}…${o.x1.toFixed(3)}  ${o.w.toFixed(2)}x${o.h.toFixed(2)}x${o.d.toFixed(2)}  map ${o.mapW}x${o.mapH}  Δfront ${gap.toFixed(4)}${flag}`);
  }
}

console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'}: ${bad} coplanar front face(s) within ${Z_EPS} m of a leaf`);
process.exit(bad === 0 ? 0 : 1);
