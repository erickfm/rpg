// The parked pickup: its tailgate, and where it stands.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/truck.mjs [shots|check]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const mode = process.argv[2] ?? 'shots';
const tag = process.env.TAG ?? 'now';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(13, 0));

// where is the pickup? it is the parked vehicle on the west kerb
const truck = await page.evaluate(() => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (o.type !== 'Group' || o.userData.steer === undefined || !o.visible) return;
    if (o.position.x < -2 && o.position.z > -45 && o.position.z < -25) best = { x: o.position.x, z: o.position.z, ry: o.rotation.y };
  });
  return best;
});
console.log(`pickup at x=${truck.x.toFixed(2)} z=${truck.z.toFixed(2)} yaw=${truck.ry.toFixed(3)}`);
// it faces +z (yaw π), so its TAILGATE faces -z: stand south of it looking north
const look = async (n, x, z, tx, tz, pitch = 0, gy = 0) => {
  await page.evaluate(([x, z, tx, tz, pitch, gy]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, pitch), [x, z, tx, tz, pitch, gy]);
  await page.waitForTimeout(280);
  await page.screenshot({ path: `shots/truck-${tag}-${n}.png` });
};
// the truck is 4.9 m long, so its tail is 2.45 m south of centre — stand well
// back of THAT, not of the centre, or the camera ends up inside the bed
await look('back', truck.x, truck.z - 8.5, truck.x, truck.z, 0.03);
await look('back-close', truck.x - 0.3, truck.z - 5.5, truck.x, truck.z, 0.04);
// GRAZING angles are where §4 bites
await look('graze-low', truck.x + 1.6, truck.z - 8.0, truck.x, truck.z, 0.01);
await look('graze-far', truck.x + 2.0, truck.z - 18, truck.x, truck.z, 0.02);
await look('alley', -1.0, -33.0, -6.5, -40.5, 0.0);   // the sight line into the alley
// INTO THE BED. The bed centre is local (0,0,+1.45); the truck is parked
// facing +z (yaw π), so that lands at world z - 1.45 — NOT +. Derive it from
// the yaw rather than assuming, or these shots frame the hood instead.
const bx = truck.x + 1.45 * Math.sin(truck.ry);
const bz = truck.z + 1.45 * Math.cos(truck.ry);
await look('bed-over', bx + 2.6, bz + 0.4, bx, bz, -0.40);
await look('bed-behind', bx, bz - 3.6, bx, bz, -0.22);
// straight down into the tub, from above the street (gy lifts the rig, the
// same trick scripts/bus.mjs uses for its clearance-over shot)
await look('bed-high', bx + 0.2, bz - 2.2, bx, bz, -0.78, 3.2);
console.log(`shots -> shots/truck-${tag}-*.png`);

// ── the rest of the fleet at grazing angles (the queue's ask) ─────────────
if (mode === 'fleet') {
  const parked = await page.evaluate(() => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (o.type === 'Group' && o.userData.steer !== undefined && o.visible && o.position.x < 100) {
        out.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2)]);
      }
    });
    return out;
  });
  let i = 0;
  for (const [x, z] of parked) {
    const side = x > 0 ? -1 : 1;
    await look(`fleet${i}-graze`, x + side * 2.0, z - 7, x, z, 0.01);
    await look(`fleet${i}-graze2`, x + side * 1.4, z + 8, x, z, 0.02);
    i++;
  }
  await page.evaluate(() => window.__ct.bus(-30, -1));
  await page.waitForTimeout(200);
  await look('bus-graze', 3.2, -20, 1.35, -28, 0.02);
  await look('bus-sign', -1.0, -40, 1.35, -33, 0.06);
  console.log(`fleet: ${parked.length} parked vehicles + the bus, shots/truck-${tag}-fleet*`);
}

await browser.close();
