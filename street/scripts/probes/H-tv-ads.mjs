// H (verifier): C's TV bezel + ad-pool row, at C's own station — sit on the
// bed in 301 and watch. Pool predicate: scene.userData.tv publishes
// {seg, i, left, pool}; watch and count DISTINCT names.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const SECS = +(process.env.SECS ?? 130);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0), [198.30, -16.30]);
await p.waitForTimeout(600);
await p.mouse.click(480, 300); await p.waitForTimeout(250);
await p.keyboard.press('KeyE');
await p.waitForTimeout(1000);
console.log('seated:', JSON.stringify(await p.evaluate(() => window.__ct.seated())));
const tv0 = await p.evaluate(() => window.__ct.scene().userData.tv);
console.log('scene.userData.tv published:', tv0 ? 'yes' : 'NO');
if (tv0) console.log('  pool size declared:', Array.isArray(tv0.pool) ? tv0.pool.length : tv0.pool);
const seen = new Map();
const t0 = Date.now();
let shots = 0;
while (Date.now() - t0 < SECS * 1000) {
  const tv = await p.evaluate(() => window.__ct.scene().userData.tv);
  if (tv && tv.seg != null) {
    const name = typeof tv.seg === 'string' ? tv.seg : (tv.pool && tv.pool[tv.i]) || String(tv.seg);
    if (!seen.has(name)) {
      seen.set(name, 1);
      if (shots < 3) { await p.screenshot({ path: `shots/H-tv-ad${shots}.png` }); shots++; }
    } else seen.set(name, seen.get(name) + 1);
  }
  await p.waitForTimeout(500);
}
console.log(`\nwatched ${SECS} s from the bed`);
console.log(`distinct segments seen: ${seen.size}`);
for (const [k, v] of seen) console.log(`   ${String(k).slice(0, 46).padEnd(46)} ${v} samples`);
await b.close();
