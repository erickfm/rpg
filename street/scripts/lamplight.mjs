// feat/lamplight — things standing in a lamp pool now catch the light.
//
//   shots (default) — night views of lit cars, people, walls
//   probe           — assert the tint is POSITION-dependent and free by day
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/lamplight.mjs [shots|probe|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(600);

const shot = async (name, x, z, tx, tz, gy = 0, pitch = 0, wait = 420) => {
  await page.evaluate(([x, z, tx, tz, gy, pitch]) => {
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, pitch);
  }, [x, z, tx, tz, gy, pitch]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/ll-${name}.png` });
};

if (mode === 'shots' || mode === 'all') {
  await page.evaluate(() => window.__ct.clock(1, 30));
  await page.waitForTimeout(800);
  // The hatch parked at z=-49 sits 2.1 m from the east lamp head at z=-51 —
  // that is the car standing in a pool. (Lamps alternate: east at -23, -51,
  // -79; west at -9, -37, -65.)
  await shot('hatch-lit', 1.0, -44, 3.6, -49.5, 0, -0.04);
  await shot('hatch-close', 1.4, -47.0, 3.6, -50.0, 0, -0.06);
  await shot('hatch-over', 1.0, -44, 3.6, -50.0, 5.0, -0.55);
  // the wall splash: brick beside a lamp vs brick mid-block
  await shot('wall-splash', 2.0, -18, 6.6, -23.5, 0, 0.18);
  await shot('wall-midblock', 2.0, -28, 6.6, -33.5, 0, 0.18);
  await shot('wall-west', -2.0, -32, -6.6, -37.5, 0, 0.18);
  // a lamp with everything around it
  await shot('pool-wide', 1.5, -16, 4.4, -23.5, 0, 0.02);
  await shot('pool-under', 4.2, -21, 4.4, -25.0, 0.14, -0.10);
  // people walking through
  await shot('street-night', -1.2, -40, -1.2, -60, 0, 0.02);
  await shot('block-night', 0.5, -8, 0.5, -30, 0, 0.03);
  // and the same spots by day, which must be untouched
  await page.evaluate(() => window.__ct.clock(13, 0));
  await page.waitForTimeout(800);
  await shot('hatch-day', 1.4, -47.0, 3.6, -50.0, 0, -0.06);
  await shot('wall-day', 2.0, -18, 6.6, -23.5, 0, 0.18);
  console.log('shots -> shots/ll-*.png');
}

if (mode === 'probe' || mode === 'all') {
  // Read material colours straight off the scene graph. The bar is not "did
  // it get amber" — sodium light WARMS a surface, it does not repaint it. So:
  // the car must change, must stay recognisably its own colour, must not all
  // shift as one block, and glass/rubber must not move at all.
  const sample = () => page.evaluate(() => {
    const scene = window.__ct.scene();
    const near = (x, z) => {
      let best = null, bd = 1e9;
      scene.traverse((o) => {
        if (!o.isGroup || o.children.length < 4) return;
        const d = Math.hypot(o.position.x - x, o.position.z - z);
        if (d < bd) { bd = d; best = o; }
      });
      const cols = [];
      best.traverse((o) => {
        const mm = o.material;
        if (!mm) return;
        for (const m of (Array.isArray(mm) ? mm : [mm])) {
          if (m && m.color) cols.push([m.color.r, m.color.g, m.color.b]);
        }
      });
      return cols;
    };
    return { hatch: near(3.63, -49), sedan: near(3.93, -13) };
  });

  await page.evaluate(() => window.__ct.clock(13, 0));
  await page.waitForTimeout(700);
  const day = await sample();
  await page.evaluate(() => window.__ct.clock(1, 30));
  await page.waitForTimeout(900);
  const night = await sample();
  await page.evaluate(() => window.__ct.clock(13, 0));
  await page.waitForTimeout(900);
  const back = await sample();

  const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  let changed = 0, worstDrift = 0, darkMoved = 0;
  const ratios = new Set();
  for (let i = 0; i < day.hatch.length; i++) {
    const d = day.hatch[i], n = night.hatch[i];
    const same = d.every((v, k) => Math.abs(v - n[k]) < 1e-4);
    if (!same) {
      changed++;
      ratios.add((n[0] / Math.max(d[0], 1e-6)).toFixed(3));
      for (let k = 0; k < 3; k++) {
        worstDrift = Math.max(worstDrift, Math.abs(n[k] - d[k]) / Math.max(d[k], 1e-6));
      }
    }
    if (!same && lum(d) < 0.22) darkMoved++;   // glass, rubber, ironwork
  }
  console.log('\nlamplight probe — the hatch parked 2.1 m from the z=-51 lamp head:');
  console.log(`  ${changed}/${day.hatch.length} materials warm up at night`);
  console.log(`  largest per-channel change: ${(worstDrift * 100).toFixed(1)}%`);
  console.log(`  distinct warm ratios across the car: ${ratios.size} (per-part falloff)`);
  console.log(`  dark materials (glass / tyres / ironwork) that moved: ${darkMoved}`);

  const litUp = changed >= 3;
  const stillItself = worstDrift > 0.02 && worstDrift < 0.22;   // visible, not a repaint
  const perPart = ratios.size >= 2;
  const darkSafe = darkMoved === 0;
  const controlFlat = JSON.stringify(night.sedan) === JSON.stringify(day.sedan);
  const restored = JSON.stringify(back.hatch) === JSON.stringify(day.hatch);
  console.log(`  ${litUp ? 'OK  ' : 'FAIL'} the car in the pool warms up`);
  console.log(`  ${stillItself ? 'OK  ' : 'FAIL'} it is still the same car (change within 2-22%)`);
  console.log(`  ${perPart ? 'OK  ' : 'FAIL'} the car does not shift as one block`);
  console.log(`  ${darkSafe ? 'OK  ' : 'FAIL'} glass, tyres and ironwork are untouched`);
  console.log(`  ${controlFlat ? 'OK  ' : 'FAIL'} the car away from any lamp is untouched`);
  console.log(`  ${restored ? 'OK  ' : 'FAIL'} everything returns exactly to base by day`);
  if (!litUp || !stillItself || !perPart || !darkSafe || !controlFlat || !restored) process.exit(1);
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
