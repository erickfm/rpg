// ITEM 242 — DOES PARKING THE IDLE MESHES CHANGE DRIVING OR COLLISION?
//
// The row warns that these boxes enter `citAvoid` and `actorBoxes`, that
// ct/traffic.ts rewrites their extents every frame, and that crosstown.ts:603
// records a previous bug where a moving box was read out of `colliders`. So the
// question is not "does it still compile" but "does a vehicle still drive the
// same route, and does its collider still travel with it".
//
// WATCHES THE WORLD RUN. Samples every second for SECS seconds and records, for
// each vehicle that becomes active:
//   - the path its MESH takes (min/max x and z while visible)
//   - whether its COLLIDER BOX is co-located with the mesh on every sample
//     where it is out — that is the pairing the previous bug broke
//   - that nothing visible is ever at the idle coordinate, and nothing idle is
//     ever anywhere else
//
// A vehicle mesh and its box are matched by proximity, not by index, because the
// harness cannot see the module's private Map — so the assertion is "for every
// visible vehicle there is a box within 3 m of it", which is exactly the
// property that fails if a box is left behind or parked while its mesh drives.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const SECS = Number(process.env.SECS ?? 75);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 520 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

// ── WHICH GROUPS ARE THE POOL? MY FIRST SELECTOR GOT THIS WRONG ──────────
// "a top-level Group with userData.wheelbase" matches TWELVE groups, not six:
// the traffic pool AND the six statically parked cars along the kerb and in the
// lot. The parked ones sit at real street positions and are `visible=false`
// under storey culling, so they were counted as "idle vehicles off station" —
// 6 parked x 75 samples = the 450 my first run reported against a world that
// was fine. So the pool is identified ONCE, before any activation, as the
// groups standing at the idle coordinate, and indices are remembered.
const poolIdx = await p.evaluate(() => {
  const s = window.__ct.scene();
  const idx = [];
  s.children.forEach((c, i) => {
    if (!c.userData || c.userData.wheelbase === undefined) return;
    if (Math.hypot(c.position.x - 999, c.position.z - 999) < 1) idx.push(i);
  });
  return idx;
});
console.log(`traffic pool identified at load: ${poolIdx.length} groups standing at the idle coordinate`);

const sample = () => p.evaluate((idx) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const cars = idx.map((i) => {
    const c = s.children[i];
    return { vis: c.visible, x: +c.position.x.toFixed(2), z: +c.position.z.toFixed(2) };
  });
  const av = (window.__ct.citAvoid ? window.__ct.citAvoid() : []).filter((q) => q && typeof q.minX === 'number');
  const boxes = av.map((q) => ({ cx: (q.minX + q.maxX) / 2, cz: (q.minZ + q.maxZ) / 2,
    w: q.maxX - q.minX, d: q.maxZ - q.minZ }));
  return { cars, boxes };
}, poolIdx);

const seen = new Map();
let visSamples = 0, paired = 0, unpaired = 0, strayVisible = 0, strayIdle = 0;
for (let t = 0; t < SECS; t++) {
  const s = await sample();
  for (const c of s.cars) {
    if (c.vis) {
      visSamples++;
      if (Math.abs(c.x - 999) < 1 && Math.abs(c.z - 999) < 1) strayVisible++;
      const k = `${Math.round(c.x)}`;
      const e = seen.get('path') || { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
      e.x0 = Math.min(e.x0, c.x); e.x1 = Math.max(e.x1, c.x);
      e.z0 = Math.min(e.z0, c.z); e.z1 = Math.max(e.z1, c.z);
      seen.set('path', e); void k;
      // is there a vehicle-sized citAvoid box travelling with it?
      // ORIENTATION-INDEPENDENT. The first version demanded d > 2.5, which is
      // the car's LENGTH only while it drives along z; on the side street the
      // same car's AABB is 4.5 in x and 1.8 in z, so the filter rejected the
      // very box it was looking for and reported 6 "colliders left behind" on
      // a world that was fine. Test the long and short sides instead.
      const hit = s.boxes.some((q) => {
        const lo = Math.min(q.w, q.d), hi = Math.max(q.w, q.d);
        return hi > 2.5 && lo > 1.2 && Math.hypot(q.cx - c.x, q.cz - c.z) < 3.5;
      });
      if (hit) paired++; else unpaired++;
    } else if (!(Math.abs(c.x - 999) < 1 && Math.abs(c.z - 999) < 1)) {
      strayIdle++;
    }
  }
  await p.waitForTimeout(1000);
}
const path = seen.get('path');
console.log(`sampled ${SECS}s`);
console.log(`  visible-vehicle samples          ${visSamples}`);
console.log(`  ...with a vehicle-sized citAvoid box travelling with them   ${paired}`);
console.log(`  ...WITHOUT one (collider left behind)                       ${unpaired}`);
console.log(`  visible vehicles sitting at the idle coord (must be 0)      ${strayVisible}`);
console.log(`  hidden vehicles NOT at the idle coord   (must be 0)         ${strayIdle}`);
if (path) console.log(`  driven envelope  x ${path.x0.toFixed(2)}…${path.x1.toFixed(2)}   z ${path.z0.toFixed(2)}…${path.z1.toFixed(2)}`);
console.log(`  console errors: ${errors.length}`);
const ok = visSamples > 0 && unpaired === 0 && strayVisible === 0 && strayIdle === 0;
console.log(ok ? '\nTRAFFIC OK — vehicles drove, every one carried its collider, none idled off-station'
  : '\nPROBLEM — see the counts above');
await b.close();
process.exit(ok ? 0 : 1);
