// feat/park — is the park lit, and are the lamps beside the path?
//
// The auditor's finding was "NOT lit — ZERO light sources; black at night", so
// the first thing this asserts is that there ARE emitters and that the ground
// under them is not black. The second thing matters more for keeping it right:
// the lamp positions are DERIVED from ctx.site('park') using ct/park.ts's own
// offsets, and the park has been re-cut twice — so this checks each lamp
// actually stands beside the loop, and fails loudly if E moves it rather than
// quietly lighting the grass.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/park.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(2, 30));
await page.waitForTimeout(1600);

const r = await page.evaluate(() => {
  const sc = window.__ct.scene();
  // the park's own ground plane tells us the site without trusting a constant
  let site = null;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.14) > 1e-6 || o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    site = { minX: o.position.x - g.width / 2, maxX: o.position.x + g.width / 2,
             minZ: o.position.z - g.height / 2, maxZ: o.position.z + g.height / 2 };
  });
  // park lanterns: the 0.22 cube lens, which no street lamp has
  const lamps = [];
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g) return;
    if (Math.abs(g.width - 0.22) < 1e-6 && Math.abs(g.height - 0.20) < 1e-6)
      lamps.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2), +o.position.y.toFixed(2)]);
  });
  // how bright is the park ground at 3am? sample the material of its floor
  let floorLum = null;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.14) > 1e-6 || o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    const c = o.material.color;
    floorLum = +(0.299 * c.r + 0.587 * c.g + 0.114 * c.b).toFixed(4);
  });
  // additive emitters that actually carry opacity right now
  let lit = 0;
  sc.traverse((o) => {
    if (o.isMesh && o.material?.blending === 2 && o.material.opacity > 0.05 &&
        o.position.x < -8 && o.position.x > -40) lit++;
  });
  return { site, lamps, floorLum, lit };
});

console.log(`\n  park site: x ${r.site?.minX} … ${r.site?.maxX}, z ${r.site?.minZ} … ${r.site?.maxZ}`);
console.log(`  park lanterns: ${r.lamps.length}`);
console.log(`  additive emitters carrying light inside the park at 3am: ${r.lit}`);
console.log(`  park ground material luminance at 3am: ${r.floorLum}`);

// the loop, by ct/park.ts's own rule
const lx0 = r.site.minX + 3.2, lx1 = r.site.maxX - 0.25 - 1.35;
const lz0 = r.site.minZ + 1.7, lz1 = r.site.maxZ - 1.7;
// distance from a point to the loop rectangle's PERIMETER
const toLoop = (x, z) => {
  const onLeg = (a, b, c) => Math.abs(a - b) <= 0 ? Infinity : 0;
  const dLegs = [
    Math.abs(x - lx0) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(x - lx1) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(z - lz0) + Math.max(0, Math.max(lx0 - x, x - lx1)),
    Math.abs(z - lz1) + Math.max(0, Math.max(lx0 - x, x - lx1)),
  ];
  return Math.min(...dLegs);
};
const offs = r.lamps.map(([x, z]) => +toLoop(x, z).toFixed(2));
const worst = Math.max(...offs);
console.log(`  each lantern's distance from the loop path: ${offs.join(', ')}`);

const okCount = r.lamps.length >= 8;
const okLit = r.lit >= 8;
const okBeside = worst <= 1.3;             // beside it, not on it and not adrift
const okClear = Math.min(...offs) >= 0.75; // off the 1.5 m path itself
console.log(`\n  ${okCount ? 'OK  ' : 'FAIL'} the park HAS light sources (${r.lamps.length})`);
console.log(`  ${okLit ? 'OK  ' : 'FAIL'} they are emitting at 3am (${r.lit} sheets lit)`);
console.log(`  ${okBeside ? 'OK  ' : 'FAIL'} every lantern stands beside the loop (worst ${worst} m)`);
console.log(`  ${okClear ? 'OK  ' : 'FAIL'} none stands ON the 1.5 m path (nearest ${Math.min(...offs)} m)`);

const shot = async (n, x, z, tx, tz, gy, p2) => {
  await page.evaluate(([x, z, tx, tz, gy, p2]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p2), [x, z, tx, tz, gy, p2]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `shots/pk-${n}.png` });
};
await shot('path-night', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);
await shot('gate-night', r.site.maxX + 1.0, (lz0 + lz1) / 2, lx0, (lz0 + lz1) / 2, 0.14, -0.02);
await shot('across-night', lx0 + 2, lz0 + 2, lx1, lz1, 0.14, 0.0);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);
await shot('path-day', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!okCount || !okLit || !okBeside || !okClear) process.exit(1);
console.log('\nno page errors');
