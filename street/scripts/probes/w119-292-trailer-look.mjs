// Item 292 — LOOK AT THE TRAILER, from where a player actually passes it.
//
// The row: *"VERIFY BY LOOKING in the V debug view and from street level."*
// Three stations, all derived from the rig's own meshes so the camera follows
// it if the parking seed moves:
//   flank   3 m off the near side, standing in the carriageway — the view the
//           original complaint was made from (*"a dark blob detached from the
//           vehicle"*)
//   wheel   1.4 m, crouched to the axle, where a hubcap is either there or not
//   V       the same flank view with the collision overlay up, so the deck box
//           and the hitch can be read at the same time as the wheels
//
//   SHOT_URL=http://localhost:4750/ TAG=after node scripts/probes/w119-292-trailer-look.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const TAG = process.env.TAG ?? 'now';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const rig = await p.evaluate(() => {
  let hit = null;
  const V = window.__ct.scene().position.constructor;
  window.__ct.scene().traverse((o) => {
    if (hit || !o.isGroup) return;
    const w = o.children.filter((c) => c.geometry && c.geometry.type === 'CylinderGeometry'
      && Math.abs(c.geometry.parameters.radiusTop - 0.22) < 1e-6);
    if (w.length !== 2) return;
    o.updateWorldMatrix(true, false);
    const c = new V(); w[0].getWorldPosition(c);
    const c2 = new V(); w[1].getWorldPosition(c2);
    const g = new V(); o.getWorldPosition(g);
    hit = { axleX: (c.x + c2.x) / 2, axleZ: (c.z + c2.z) / 2, axleY: c.y,
            nearX: Math.min(c.x, c2.x), groupZ: g.z };
  });
  return hit;
});
if (!rig) { console.error('trailer not found'); await b.close(); process.exit(3); }
console.log(`trailer axle at (${rig.axleX.toFixed(2)}, ${rig.axleZ.toFixed(2)}), y ${rig.axleY.toFixed(2)}`);

const shot = async (name, dist, pitch, overlay) => {
  // Stand on the CARRIAGEWAY side (-x of the rig) and look straight at the axle.
  // yaw convention measured in probes/w119-249-aim.mjs: dir = (sin yaw, -cos yaw).
  const sx = rig.axleX - dist, sz = rig.axleZ;
  await p.evaluate(([sx, sz, tx, tz, pitch]) => {
    window.__ct.warp(sx, sz, Math.atan2(tx - sx, -(tz - sz)), 0, pitch);
  }, [sx, sz, rig.axleX, rig.axleZ, pitch]);
  await p.waitForTimeout(700);
  if (overlay) {
    await p.keyboard.down('v'); await p.waitForTimeout(90); await p.keyboard.up('v');
    await p.waitForTimeout(500);
    const on = await p.evaluate(() => !!(window.__ct.debugCollisionOn && window.__ct.debugCollisionOn()));
    console.log(`   collision overlay: ${on ? 'ON' : 'OFF — the V press did not take'}`);
  }
  const path = `shots/w119-292-trailer-${TAG}-${name}.png`;
  await p.screenshot({ path });
  console.log(`-> ${path}   from (${sx.toFixed(2)}, ${sz.toFixed(2)}), ${dist} m off the flank`);
  if (overlay) {
    await p.keyboard.down('v'); await p.waitForTimeout(90); await p.keyboard.up('v');
    await p.waitForTimeout(300);
  }
};

await shot('flank', 3.0, -0.06, false);
await shot('wheel', 1.4, -0.24, false);
await shot('vdebug', 3.0, -0.06, true);
console.log(`console errors: ${errs.length}`);
await b.close();
