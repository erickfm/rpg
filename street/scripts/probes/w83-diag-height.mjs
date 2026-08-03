// ITEM 172, diagnostic — does the PLAYER rise with the ground, or only the
// floor picker's answer? The walk harness reported a 0.218 m drift between the
// body and the picker at x -19.85 z -85.20, and 0.218 m is exactly the mound's
// height at that point, so one of the two is not moving. This stands still at
// points across the mound and prints both.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL || 'http://localhost:4390/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
for (const [x, z] of [[-8.6, -85.2], [-16, -85.2], [-19.85, -85.2], [-22, -85.2],
  [-23.585, -84.6], [-26, -85.2], [-30, -85.2]]) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 0), [x, z]);
  await p.waitForTimeout(700);            // let the rig settle onto the floor
  const r = await p.evaluate(() => {
    const q = window.__ct.pos();
    return { x: q[0], y: q[1], z: q[2], gy: q[3], pick: window.__ct.groundAt(q[0], q[2]) };
  });
  console.log(`asked x ${String(x).padStart(8)} z ${z}  ->  at x ${r.x.toFixed(2)}  ` +
    `body y ${r.y.toFixed(3)}  gy ${r.gy.toFixed(3)}  pick ${r.pick.toFixed(3)}  ` +
    `body-pick ${(r.y - r.pick).toFixed(3)}`);
}
await b.close();
