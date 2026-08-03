// THE STACK BLOCK: no blank end, the aisles unchanged, and you can still walk
// them. Item 273.
//
// Asserts. Exit 1 on failure, 3 if it could not measure (GOTCHAS §32).
//
// FOUR THINGS, and each exists because the obvious version of this check would
// miss it:
//
//   1. NO BAY END IS BLANK BOARD. Counted as "an untextured upright face in the
//      stack block", not as "does the fix exist" — a check that looks for the
//      thing you added passes on a world where you added it in the wrong place.
//   2. EVERY STACK END CARRIES A PLATE, AND IT FACES OUT. `ctx.flat` is NOT
//      double-sided, so a plate turned the wrong way is INVISIBLE rather than
//      backwards — you cannot see the bug by looking, which is exactly what
//      GOTCHAS §41 says about mirrored pairs. So the plate's world normal is
//      dotted against the direction away from its own stack.
//   3. THE AISLES ARE STILL 1.55 m. Item 115's note says explicitly they must
//      not be widened again, and this change stands 8 mm of plate proud of a
//      panel that faces DOWN the aisle rather than across it — so the number to
//      defend is the collider pitch, measured, not asserted from the source.
//   4. YOU CAN WALK THEM. Movement is verified by moving (CLAUDE.md), down two
//      aisles and along the cross aisle, in both directions.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
let fails = 0, checks = 0;
const ok = (c, w) => { checks++; if (!c) { fails++; console.log(`  FAIL  ${w}`); } else console.log(`  ok    ${w}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const lib = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => /libr/i.test(r.id)));
if (!lib) { console.log('NO LIBRARY IN roomDims()'); process.exit(3); }
const { cx, cz, y } = lib;
// ct/int-library.ts: STACK_PITCH 2.15, five runs at -W/2 + 2.4 + i*2.15;
// zBack = -D/2 + 1.3, zFront = -2.0, CROSS = AISLE + 0.15 = 1.70.
const RUN_X = [0, 1, 2, 3, 4].map((i) => cx - lib.w / 2 + 2.4 + i * 2.15);
const ZBACK = cz - lib.d / 2 + 1.3, ZFRONT = cz - 2.0;
const ZMID = (ZBACK + ZFRONT) / 2;

// ── 1 & 2. the ends ───────────────────────────────────────────────────────
console.log('\n=== 1&2. THE BAY ENDS ===');
const ends = await p.evaluate(([lib, RUN_X, ZBACK, ZFRONT, ZMID]) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const blanks = [], plates = [];
  const CROSS = 1.70;
  // where the ten stacks' twenty ends actually are
  const endZ = [ZBACK, ZMID - CROSS / 2, ZMID + CROSS / 2, ZFRONT];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld.elements;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = m[0]*X + m[4]*Y + m[8]*Z + m[12];
      const wy = m[1]*X + m[5]*Y + m[9]*Z + m[13];
      const wz = m[2]*X + m[6]*Y + m[10]*Z + m[14];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
    }
    const ccx = (mnx + mxx) / 2, ccz = (mnz + mxz) / 2;
    // is this in the stack block at all?
    const nearRun = RUN_X.some((rx) => Math.abs(ccx - rx) < 0.4);
    if (!nearRun) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (o.userData?.stackPlate) {
      // the plate's world +z, and which way is "out of my stack"
      const n = { x: m[8], z: m[10] };
      const L = Math.hypot(n.x, n.z) || 1;
      // the stack this plate belongs to is the one whose CENTRE it faces away
      // from; the two halves' centres are known, so pick the nearer.
      const halves = [(ZBACK + (ZMID - 1.70 / 2)) / 2, ((ZMID + 1.70 / 2) + ZFRONT) / 2];
      const own = halves.reduce((a, h) => (Math.abs(ccz - h) < Math.abs(ccz - a) ? h : a));
      const outward = Math.sign(ccz - own) || 1;
      plates.push({ x: +ccx.toFixed(2), z: +ccz.toFixed(2), band: o.userData.stackPlate,
        dot: +((n.z / L) * outward).toFixed(3) });
      return;
    }
    // an untextured upright face standing across an aisle mouth
    if (mats.some((mm) => mm && mm.map)) return;
    if (mxy - mny < 1.2) return;
    if (mxx - mnx < 0.30) return;                  // the spine board, edge-on
    if (mxz - mnz > 0.30) return;                  // not an END
    const isEnd = endZ.some((ez) => Math.abs(ccz - ez) < 0.35);
    if (!isEnd) return;
    blanks.push({ x: +ccx.toFixed(2), z: +ccz.toFixed(2),
      area: +((mxx - mnx) * (mxy - mny)).toFixed(2) });
  });
  return { blanks, plates };
}, [lib, RUN_X, ZBACK, ZFRONT, ZMID]);

console.log(`  blank bay ends: ${ends.blanks.length}`);
for (const bl of ends.blanks.slice(0, 8)) console.log(`    ${bl.area} m2 at (${bl.x}, ${bl.z})`);
ok(ends.blanks.length === 0, 'NO bay end in the stack block is untextured board');
console.log(`  range plates: ${ends.plates.length}`);
ok(ends.plates.length === 20, `all twenty stack ends carry a plate (found ${ends.plates.length})`);
const inward = ends.plates.filter((pl) => pl.dot < 0.9);
for (const pl of inward) console.log(`    FACING IN: ${pl.band} at (${pl.x}, ${pl.z})  dot ${pl.dot}`);
ok(inward.length === 0, 'every plate faces OUT of its own stack (ctx.flat is single-sided)');
const bands = new Set(ends.plates.map((pl) => pl.band));
ok(bands.size === 10, `ten distinct Dewey bands over ten stacks (found ${bands.size}: ${[...bands].sort().join(' ')})`);

// ── 3. the aisles ─────────────────────────────────────────────────────────
console.log('\n=== 3. AISLE WIDTH, from the colliders ===');
const aisles = await p.evaluate(([RUN_X, ZMID]) => {
  const cols = window.__ct.staticColliders()
    .filter((c) => c.minZ < ZMID + 1 && c.maxZ > ZMID - 4
      && c.minX > RUN_X[0] - 1 && c.maxX < RUN_X[4] + 1);
  cols.sort((a, b) => a.minX - b.minX);
  const gaps = [];
  for (let i = 1; i < cols.length; i++) {
    const g = cols[i].minX - cols[i - 1].maxX;
    if (g > 0.2 && g < 4) gaps.push(+g.toFixed(3));
  }
  return gaps;
}, [RUN_X, ZMID]);
console.log(`  gaps between stack colliders: ${aisles.join(', ')}`);
const worst = aisles.length ? Math.min(...aisles) : null;
ok(worst !== null, 'the stack colliders were found at all');
ok(worst !== null && Math.abs(worst - 1.55) < 0.02,
  `the aisle is still 1.55 m (narrowest measured ${worst})`);

// ── 4. WALK them ──────────────────────────────────────────────────────────
console.log('\n=== 4. WALKING THE AISLES ===');
const walk = async (x, z, yaw, ms = 1600) => {
  await p.evaluate(([x, z, yaw, y]) => window.__ct.warp(x, z, yaw, y ?? 0, 0), [x, z, yaw, y]);
  await waitPainted(p, { frames: 3 });
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w'); await p.waitForTimeout(ms); await p.keyboard.up('w');
  await waitPainted(p, { frames: 3 });
  const c = await p.evaluate(() => window.__ct.pos());
  return Math.hypot(c[0] - a[0], c[2] - a[2]);
};
const ROUTES = [
  { id: 'aisle 1-2, front half, toward the back', x: (RUN_X[0] + RUN_X[1]) / 2, z: ZFRONT - 0.4, yaw: 0 },
  { id: 'aisle 1-2, back half, toward the hall',  x: (RUN_X[0] + RUN_X[1]) / 2, z: ZBACK + 0.4, yaw: Math.PI },
  { id: 'aisle 3-4, front half, toward the back', x: (RUN_X[2] + RUN_X[3]) / 2, z: ZFRONT - 0.4, yaw: 0 },
  { id: 'cross aisle, west to east',              x: RUN_X[0] - 0.8, z: ZMID, yaw: Math.PI / 2 },
  { id: 'cross aisle, east to west',              x: RUN_X[4] + 0.8, z: ZMID, yaw: -Math.PI / 2 },
];
for (const r of ROUTES) {
  const d = await walk(r.x, r.z, r.yaw);
  console.log(`  ${r.id.padEnd(38)} walked ${d.toFixed(2)} m`);
  ok(d > 1.5, `${r.id}: walked ${d.toFixed(2)} m (want > 1.5)`);
}

console.log(`\n${checks - fails}/${checks} passed`);
await b.close();
if (!checks) process.exit(3);
process.exit(fails ? 1 : 0);
