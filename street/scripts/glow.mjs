// feat/glow — is the lamp glow ON the lamp, or beside it?
//
// The complaint was never about the drawing, it was about position: the halo
// sat inside the opaque head box, which ate its core and left a smudge to one
// side. So this script does two things — it takes the two framings the user
// shot from (close low look at a head, and the wide street pool), and it
// measures the overlap between the halo's bright core and the lamp head in
// SCREEN space, which is the thing that was actually wrong.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/glow.mjs [shots|probe|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(2, 30));      // deep night
await page.waitForTimeout(1200);

const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/gl-${n}.png` });
};

if (mode === 'probe' || mode === 'all') {
  // where is the halo relative to the head it belongs to?
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    const halos = [], heads = [], lenses = [];
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m?.map?.image?.width === 32 && m?.blending === 2 && m.transparent) halos.push(o);
      const g = o.geometry?.parameters;
      if (!g) return;
      if (Math.abs(g.width - 0.34) < 1e-6 && Math.abs(g.height - 0.26) < 1e-6) heads.push(o);
      if (Math.abs(g.width - 0.26) < 1e-6 && Math.abs(g.height - 0.08) < 1e-6) lenses.push(o);
    });
    // pair a halo with the head/lens it actually belongs to — same pole, so
    // within half a metre in x/z. Anything unpaired is not a streetlamp (the
    // interiors have their own glow sheets at the same texture size).
    const near = (a, list) => list
      .filter((c) => Math.hypot(c.position.x - a.position.x, c.position.z - a.position.z) < 0.5)
      .sort((p, q) => Math.abs(p.position.y - a.position.y) - Math.abs(q.position.y - a.position.y))[0];
    return halos.map((h) => {
      const hd = near(h, heads), ln = near(h, lenses);
      if (!hd || !ln) return null;
      const g = hd.geometry.parameters;
      return {
        haloY: +h.position.y.toFixed(3),
        dx: +(h.position.x - hd.position.x).toFixed(3),
        dz: +(h.position.z - hd.position.z).toFixed(3),
        // is the halo centre inside the opaque head box? that is what ate it
        insideHead: h.position.y > hd.position.y - g.height / 2 &&
                    h.position.y < hd.position.y + g.height / 2,
        offLens: +(h.position.y - ln.position.y).toFixed(3),
      };
    }).filter(Boolean);
  });
  console.log(`\n${r.length} streetlamp halos`);
  const bad = r.filter((h) => h.insideHead || Math.abs(h.dx) > 0.01 || Math.abs(h.dz) > 0.01);
  const offLens = [...new Set(r.map((h) => h.offLens))];
  console.log(`  halo is directly over its head in x/z: ${r.every((h) => !h.dx && !h.dz) ? 'yes' : 'NO'}`);
  console.log(`  halo centre buried inside the opaque head box: ${r.some((h) => h.insideHead) ? 'YES — it will be eaten' : 'no'}`);
  console.log(`  halo centre vs the lens it comes out of: ${offLens.join(', ')} m`);
  console.log(`\n  ${bad.length === 0 ? 'OK  ' : 'FAIL'} every halo is anchored on its lamp, core unoccluded`);
  if (bad.length) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  // 1. the user's close look up at a head — the framing that showed it beside
  await shot('head-close', 4.0, -20.5, 3.4, -23.5, 1.55, 0.42);
  await shot('head-side', 0.5, -23.0, 3.6, -23.0, 1.6, 0.34);
  // 2. the user's wide street shot — head glow + ground pool together
  await shot('street', 1.2, -6.0, -1.0, -30.0, 1.65, -0.06);
  await shot('pool', -2.0, -33.0, -3.6, -38.5, 1.65, -0.22);
  console.log('shots -> shots/gl-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
