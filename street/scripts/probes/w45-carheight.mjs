// w45 / item 95 — is anything at CAR HEIGHT near a lamp carrying the pool?
//
// The probe-spawned car came back 0/33 patched, but a car made by
// __ct.carVariant is built long after buildProps has run and so was never
// offered to any registry — that is a property of the probe, not of the fleet.
// The parked fleet is registered at build time (crosstown.ts: props.lit(car)),
// so this asks the world directly: everything standing between 0.25 m and
// 1.9 m off the ground within 8 m of a lamp head, and whether it is patched.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-carheight.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const rows = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    if (y < 0.25 || y > 1.9) return;
    if (Math.abs(x) > 12 || z > 5 || z < -95) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.color) continue;
      out.push({ x: +x.toFixed(1), y: +y.toFixed(2), z: +z.toFixed(1),
        hex: '#' + m.color.getHexString(),
        patched: !!(m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool'),
        noLight: !!m.userData.noLight, wet: !!m.userData.wet, graded: !!m.userData.graded });
    }
  });
  return out;
});
const yes = rows.filter((a) => a.patched).length;
console.log(`materials 0.25-1.9 m up within 8 m of lamp (4.1,-23): ${rows.length}, patched ${yes}`);
for (const a of rows.slice(0, 30)) {
  console.log(`  (${a.x},${a.z}) y=${a.y} ${a.hex} patched=${a.patched} noLight=${a.noLight} wet=${a.wet} graded=${a.graded}`);
}
await browser.close();
