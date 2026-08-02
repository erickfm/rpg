// H (verifier): stand where a player stands and LOOK at the lot rows.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
const shot = async (x, z, yaw, tag) => {
  const ok = await page.evaluate(([px, pz]) => {
    const gy = window.__ct.groundAt(px, pz);
    for (const c of window.__ct.colliders()) {
      if (px > c.minX - 0.36 && px < c.maxX + 0.36 && pz > c.minZ - 0.36 && pz < c.maxZ + 0.36) return false;
    }
    return Number.isFinite(gy);
  }, [x, z]);
  await page.evaluate(([px, pz, y]) => window.__ct.warp(px, pz, y, window.__ct.groundAt(px, pz), 0), [x, z, yaw]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/H-lot-${tag}.png` });
  console.log(`  ${tag}: stood at (${x}, ${z}) yaw ${yaw.toFixed(2)}  standable=${ok}`);
};
// the near row (z 8.6, yaw 0.55) seen along its length from the street side
await shot(8.0, 14.0, Math.atan2(18 - 8, -(8.6 - 14)), 'nearrow');
// the far row (z -3.4, yaw 2.59) seen from the lot entrance
await shot(9.0, -9.0, Math.atan2(17 - 9, -(-3.4 + 9)), 'farrow');
// both rows in one frame, from the deck between them
await shot(24.0, 2.5, Math.atan2(12 - 24, -(2.5 - 2.5)), 'between');
await b.close();
