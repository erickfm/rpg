// The end-to-end leg I added for apt301 reported "travelled 4.43 m of a 2.20 m
// run" in a room 3.06 m wide — so the rig LEFT the room. This asks where it
// went: out through the doorway (legitimate, the flat's door is a real door
// onto a real landing) or through a wall (a defect).
//
// Usage: SHOT_URL=http://localhost:4188/ node scripts/probes/w32-apt301-lane-overshoot.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const RADIUS = 0.36;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4188/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };

const r = (await p.evaluate(() => window.__ct.roomDims())).find((d) => d.id === 'apt301');
const hw = r.w / 2, hd = r.d / 2;
console.log(`apt301 cx=${r.cx} cz=${r.cz} y=${r.y} w=${r.w} d=${r.d}`);
console.log(`  door local (${r.door.x}, ${r.door.z}) normal (${r.door.nx}, ${r.door.nz})`);
console.log(`  room spans world x ${(r.cx - hw).toFixed(2)}..${(r.cx + hw).toFixed(2)}`);

// the same lane the harness finds
const lane = await p.evaluate(([cx, cz, hw, hd, R]) => {
  const cols = window.__ct.colliders();
  const free = (x, z) => !cols.some((c) =>
    x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
  let best = { z: 0, x0: 0, run: 0 };
  for (let z = -hd + R; z <= hd - R; z += 0.1) {
    let start = null, run = 0;
    for (let x = -hw + R; x <= hw - R; x += 0.1) {
      if (free(cx + x, cz + z)) {
        if (start === null) { start = x; run = 0; }
        run += 0.1;
        if (run > best.run) best = { z: +z.toFixed(2), x0: +start.toFixed(2), run: +run.toFixed(2) };
      } else { start = null; run = 0; }
    }
  }
  return best;
}, [r.cx, r.cz, hw, hd, RADIUS]);
console.log(`  lane: x0=${lane.x0} run=${lane.run} at local z=${lane.z}`);

await warp(r.cx + lane.x0, r.cz + lane.z, Math.PI / 2, r.y);
await p.waitForTimeout(150);
const a0 = await pos();
await hold('w', Math.round((lane.run / 3.3) * 1000) + 900);
const a1 = await pos();
console.log(`\n  start world (${a0[0].toFixed(2)}, ${a0[2].toFixed(2)}) gy=${a0[3].toFixed(2)}`);
console.log(`  end   world (${a1[0].toFixed(2)}, ${a1[2].toFixed(2)}) gy=${a1[3].toFixed(2)}`);
console.log(`  end   local x=${(a1[0] - r.cx).toFixed(2)} z=${(a1[2] - r.cz).toFixed(2)}  (room half-width ${hw.toFixed(2)})`);
console.log(`  travelled ${Math.abs(a1[0] - a0[0]).toFixed(2)} m in x`);
const doorLocalX = r.door.x;
console.log(`\n  door is at local x=${doorLocalX}, local z=${r.door.z}; lane z=${lane.z}`);
console.log(`  did it leave via the doorway? lane z ${lane.z} vs door z ${r.door.z}: ` +
  (Math.abs(lane.z - r.door.z) < 0.6 ? 'YES, same z band as the door' : 'NO — not aligned with the doorway'));
await b.close();
