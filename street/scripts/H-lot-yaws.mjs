// H (verifier): what yaw do the lot cars ACTUALLY have, at HEAD?
// Two rows argue from yaw 0.55 rad; I once measured 0 and flagged it stale.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.cars || window.__ct?.spots, null, { timeout: 60000 });
const out = await page.evaluate(() => {
  // WORLD, not local. My first pass read o.position and found 0 cars in a box
  // that demonstrably holds several - the cars hang under a parent group, so
  // local coords are not where they are. A clean-looking zero from the wrong
  // frame of reference (GOTCHAS §34).
  const seen = [];
  const root = window.__ct.scene();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.userData || !o.userData.wheelbase) return;
    const m = o.matrixWorld.elements;
    // world translation
    const x = m[12], z = m[14];
    // yaw from the world basis: the object's local +z axis in world space
    const yaw = Math.atan2(m[8], m[10]);
    seen.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(4), wb: o.userData.wheelbase });
  });
  return seen;
});
console.log(`${out.length} cars carrying userData.wheelbase`);
const lot = out.filter((c) => c.x > 5 && c.x < 30 && Math.abs(c.z) < 15);
console.log(`${lot.length} of them in the lot box (x 5..30, |z| < 15):`);
for (const c of lot.sort((a, b2) => a.z - b2.z || a.x - b2.x)) {
  const deg = (c.yaw * 180 / Math.PI).toFixed(1);
  console.log(`   (${String(c.x).padStart(6)}, ${String(c.z).padStart(6)})  yaw ${String(c.yaw).padStart(8)} rad = ${String(deg).padStart(7)} deg   wb ${c.wb}`);
}
const rows = {};
for (const c of lot) (rows[c.z] ??= []).push(c);
console.log('\nby row (z):');
for (const [z, cs] of Object.entries(rows)) {
  const ys = [...new Set(cs.map((c) => c.yaw))];
  console.log(`   z ${z}: ${cs.length} cars, distinct yaws ${JSON.stringify(ys)}`);
}
await b.close();
