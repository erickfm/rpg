// ITEM 280 — one FIXED camera, so before and after are comparable.
//
// `w108-item272-diner-legs.mjs` derives its camera from the SITTER, which is
// the thing this change moves — so its before/after pair is shot from two
// different vantages and cannot be compared. This anchors the camera to the
// BENCH BOX, which does not move, and photographs whatever is sitting on it.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w111-280-fixed-camera.mjs <label>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const label = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4672/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// into the diner
// `roomDims()` is INDEXED, not keyed by id -- its keys are 0..12. The ids come
// from `rooms()`, in the same order. Pairing them is the only way to find the
// diner; matching /diner/ against roomDims' own keys finds nothing and the
// first run of this probe exited 3 saying "no diner in roomDims()".
const room = await p.evaluate(() => {
  const ids = window.__ct.rooms(), dims = window.__ct.roomDims();
  const i = ids.indexOf('diner');
  return i < 0 ? null : { id: 'diner', ...dims[i] };
});
if (!room) { console.error('MISS: no diner in roomDims()'); process.exit(3); }
console.log(`diner ${room.id} at cx ${room.cx?.toFixed(2)} cz ${room.cz?.toFixed(2)}`);

for (let i = 0; i < 6; i++) {
  await p.evaluate((r) => window.__ct.warp(r.cx, r.cz, 0, 0, 0), room);
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(250);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - room.cx, q[2] - room.cz) < 3) break;
}

// the bench boxes -- 0.55 x 0.45 x 1.5, top at 0.45 -- and the sitters on them
const seats = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const benches = [], people = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const gp = n.geometry.parameters || {};
    if (n.geometry.type === 'BoxGeometry' && Math.abs(gp.width - 0.55) < 1e-3
      && Math.abs(gp.height - 0.45) < 1e-3 && Math.abs(gp.depth - 1.5) < 1e-3) {
      const e = n.matrixWorld.elements; benches.push({ x: e[12], y: e[13], z: e[14] });
    }
    if (n.userData?.citizen && n.userData?.seated) {
      const e = n.matrixWorld.elements;
      people.push({ x: +e[12].toFixed(3), y: +e[13].toFixed(3), z: +e[14].toFixed(3),
        facing: n.userData.citizenFacing });
    }
  });
  return { benches, people };
});
console.log(`${seats.benches.length} bench boxes, ${seats.people.length} seated citizens`);
for (const q of seats.people)
  console.log(`  sitter (${q.x}, ${q.y}, ${q.z})  facing ${q.facing?.toFixed(2)}`);

// THE CAMERA IS ANCHORED TO A BENCH, NOT TO A SITTER. Stand in the aisle beside
// the northernmost bench, at eye height, looking square at it.
const bench = seats.benches.sort((a, c) => a.z - c.z)[0];
if (!bench) { console.error('MISS: no diner bench box'); process.exit(3); }
const CAM = { x: bench.x + 2.0, z: bench.z };
const yaw = Math.atan2(bench.x - CAM.x, -(bench.z - CAM.z));
for (let i = 0; i < 6; i++) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.14), [CAM.x, CAM.z, yaw]);
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(250);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - CAM.x, q[2] - CAM.z) < 0.6) break;
}
const at = await p.evaluate(() => window.__ct.pos());
console.log(`camera anchored to bench (${bench.x.toFixed(2)}, ${bench.z.toFixed(2)}), `
  + `standing (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) yaw ${yaw.toFixed(2)}`);
await p.waitForTimeout(700);
await waitPainted(p, { quiet: true });
await p.screenshot({ path: `shots/w111-280-${label}-fixed.png` });
console.log(`  shots/w111-280-${label}-fixed.png`);

// and the occupied-seat registry, which must NOT move
const taken = await p.evaluate(() => {
  const t = window.__ct.seats ? null : null; return t;
});
await b.close();
