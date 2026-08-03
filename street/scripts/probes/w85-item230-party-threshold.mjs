// Item 230 — the party-wall threshold: LOOK at it, and WALK it.
//
// The sweep says the 0.36 m slot of sky in the hotel/casino doorway is gone.
// That is a claim about meshes; the user's claim was about walking from one
// room into the other. So this does both, and it walks the crossing in BOTH
// directions — GOTCHAS 41: the mirror is where the bug hides, and a threshold
// laid by two rooms is exactly a mirrored thing.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { waitPainted } from './../lib/painted.mjs';
import { reportWorld } from './../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4410/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const f = (n) => n.toFixed(2);
const pos = async () => { const p = await page.evaluate(() => window.__ct.pos()); return [p[0], p[2]]; };

// ── 1. is the floor continuous across the boundary now? ───────────────────
const line = await page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const T = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    const e = o.matrixWorld.elements;
    const xf = (k) => {
      const vx = pos.getX(k), vy = pos.getY(k), vz = pos.getZ(k);
      return [e[0] * vx + e[4] * vy + e[8] * vz + e[12],
        e[1] * vx + e[5] * vy + e[9] * vz + e[13],
        e[2] * vx + e[6] * vy + e[10] * vz + e[14]];
    };
    for (let t = 0; t + 2 < n; t += 3) {
      const A = xf(idx ? idx.getX(t) : t), C = xf(idx ? idx.getX(t + 1) : t + 1), D = xf(idx ? idx.getX(t + 2) : t + 2);
      const det = (C[0] - A[0]) * (D[2] - A[2]) - (D[0] - A[0]) * (C[2] - A[2]);
      if (Math.abs(det) > 1e-9) T.push([A, C, D, det]);
    }
  });
  const floored = (x, z) => {
    const gy = window.__ct.groundAt(x, z);
    return T.some(([A, C, D, det]) => {
      const w0 = ((C[0] - x) * (D[2] - z) - (D[0] - x) * (C[2] - z)) / det;
      const w1 = ((D[0] - x) * (A[2] - z) - (A[0] - x) * (D[2] - z)) / det;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) return false;
      const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
      return y >= gy - 0.9 && y <= gy + 1.2;
    });
  };
  const out = { gaps: {}, inDoor: 0, inDoorFloored: 0, offDoor: 0, offDoorFloored: 0 };
  for (const z of [-10.0, -9.5, -9.0, -8.5, -8.0]) {
    const g = [];
    for (let x = 878; x <= 882.0001; x += 0.02) if (!floored(x, z)) g.push(+x.toFixed(2));
    out.gaps[z] = g.length ? `${Math.min(...g).toFixed(2)}…${Math.max(...g).toFixed(2)} (${g.length})` : 'continuous';
  }
  // the doorway is 2.6 m at local z -9, i.e. z -10.3…-7.7
  for (let z = -10.3; z <= -7.7; z += 0.1) for (let x = 879.7; x <= 880.3; x += 0.05) {
    out.inDoor++; if (floored(x, z)) out.inDoorFloored++;
  }
  // ── THE NEGATIVE CONTROL, ON THE SECOND ATTEMPT ─────────────────────────
  //
  // The first version sampled the wall line OUTSIDE the opening and demanded it
  // read bare, on the theory that a fix which floored the whole wall line was
  // overreaching. It came back 59/65 FLOORED and the fix was innocent: **a wall
  // is a `BoxGeometry`, so its UNDERSIDE at y = 0 is a horizontal face**, and a
  // downward ray hits it exactly as it would hit lino. That was true before this
  // change and after it. In the doorway the wall is cut away and only the
  // header survives — bottom face at y 2.6, outside the walkable band — which
  // is why the slot showed there and nowhere else.
  //
  // So the control now asserts on THE THING THAT WAS ADDED: exactly two sill
  // planes, one per room, 0.18 m x 2.6 m, meeting on the boundary. If a future
  // change floors the whole party wall, this fails on the count.
  out.sills = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const p = o.geometry.parameters;
    if (!p || Math.abs(p.width - 0.18) > 1e-6 || Math.abs(p.height - 2.6) > 1e-6) return;
    const v = new (o.position.constructor)();
    v.setFromMatrixPosition(o.matrixWorld);
    out.sills.push([+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]);
  });
  return out;
});
console.log('floor gaps on a 0.02 m line across x 878…882:');
for (const [z, g] of Object.entries(line.gaps)) console.log(`  z ${z}: ${g}`);
report('the doorway threshold is continuous floor, corner to corner',
  line.inDoorFloored === line.inDoor,
  `${line.inDoorFloored}/${line.inDoor} points across the full 2.6 m opening x 879.7…880.3 have a floor triangle`);
const sills = line.sills.sort((a, c) => a[0] - c[0]);
const paired = sills.length === 2 && Math.abs(sills[0][0] - 879.91) < 0.02 && Math.abs(sills[1][0] - 880.09) < 0.02
  && sills.every((s) => Math.abs(s[2] + 9) < 0.02 && Math.abs(s[1] - 0.005) < 1e-6);
report('exactly TWO sill planes, one per room, meeting on the slab boundary', paired,
  `${sills.length} plane(s) of 0.18 x 2.6 m at ${JSON.stringify(sills)} — expected x 879.91 and 880.09, z -9, y 0.005`);

// ── 2. WALK the crossing, both ways ───────────────────────────────────────
const faceYaw = (dx, dz) => Math.atan2(dx, -dz);
const hold = async (ms) => {
  await page.keyboard.down('w'); await page.waitForTimeout(ms);
  await page.keyboard.up('w'); await page.waitForTimeout(60);
};
for (const [nm, fromX, toX] of [['hotel -> casino', 877.5, 882.5], ['casino -> hotel', 882.5, 877.5]]) {
  await page.evaluate(([x]) => window.__ct.warp(x, -9, 0, window.__ct.groundAt(x, -9) ?? 0, 0), [fromX]);
  await page.waitForTimeout(150);
  await page.evaluate(([x, yaw]) => window.__ct.warp(x, -9, yaw), [fromX, faceYaw(toX - fromX, 0)]);
  let crossed = false;
  for (let i = 0; i < 20; i++) {
    await hold(220);
    const [x] = await pos();
    if ((toX > fromX && x > 880.6) || (toX < fromX && x < 879.4)) { crossed = true; break; }
  }
  const p = await pos();
  report(`the player can WALK ${nm} through the party doorway`, crossed,
    `ended at x ${f(p[0])}, z ${f(p[1])}`);
}

// ── 3. and photograph it ──────────────────────────────────────────────────
for (const [nm, x, z, yaw, pitch] of [
  ['w85-party-880-down-after', 880, -9, Math.PI / 2, -1.1],
  ['w85-party-880-fwd-after', 878.6, -9, Math.PI / 2, -0.35],
]) {
  await page.evaluate(([x, z, yaw, pitch]) => {
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0, pitch);
  }, [x, z, yaw, pitch]);
  await waitPainted(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${nm}.png` });
  console.log(`  shot shots/${nm}.png at (${x}, ${z})`);
}
report('no console errors', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nthreshold holds');
await b.close();
process.exit(fails ? 1 : 0);
