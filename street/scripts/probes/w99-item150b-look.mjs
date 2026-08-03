#!/usr/bin/env node
// LOOK AT THE TAX-OFFICE PREPARER AND HIS CHAIR. Item 150b.
//
// The proof is w99-item150b-office-clip.mjs; this is so the verdict is one a
// human formed. Item 93's note records that its own look-probe came back ALL
// BLACK because the region culler hides an interior you are not registered as
// inside and a warp does not enter a room — so `cullRegions(false)` first.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-item150b-look.mjs before
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const label = process.argv[2] ?? 'now';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await p.evaluate(() => { window.__ct.cullRegions(false); window.__ct.clock(13, 0); });
await p.waitForTimeout(900);

// find him by the kit's own tag rather than by a typed coordinate
const who = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let hit = null;
  s.traverse((o) => {
    if (!o.isMesh || hit) return;
    let cit = false;
    for (let q = o; q; q = q.parent) if (q.userData && q.userData.citizen) { cit = true; break; }
    if (!cit) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (cx > 1234 && cx < 1246 && cz > -4.25 && cz < 4.25) hit = { x: cx, z: cz, y0: bb.min.y, y1: bb.max.y };
  });
  return hit;
});
if (!who) { console.log('EXIT 3 — no citizen found in the tax office.'); await b.close(); process.exit(3); }
console.log(`preparer at (${who.x.toFixed(2)}, ${who.z.toFixed(2)})  y ${who.y0.toFixed(2)}..${who.y1.toFixed(2)}`);

// stand off on the client's side (+z) and a little to the side, so the chair is
// between the camera and the man — which is the view the clip shows up in
for (const [tag, dx, dz] of [['front', 0.0, 2.6], ['quarter', 1.9, 2.0], ['side', 2.6, 0.2]]) {
  await p.evaluate(([tx, tz, dx, dz]) => {
    const cx = tx + dx, cz = tz + dz;
    window.__ct.warp(cx, cz, Math.atan2(tx - cx, -(tz - cz)), 0, -0.20);
  }, [who.x, who.z, dx, dz]);
  await p.waitForTimeout(700);
  const f = `shots/tax-prep-${label}-${tag}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f}`);
}
await b.close();
