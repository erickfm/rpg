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
  // Read the actual material colours off the scene graph. A car standing in a
  // pool must warm up at night; a car nowhere near a lamp must not move at
  // all; and by day nothing may differ from its base colour.
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
          if (m && m.color) cols.push(m.color.getHexString());
        }
      });
      return cols.join(',');
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

  const warmth = (csv) => {
    const c = csv.split(',');
    let r = 0, b = 0;
    for (const h of c) { r += parseInt(h.slice(0, 2), 16); b += parseInt(h.slice(4, 6), 16); }
    return (r - b) / c.length;
  };
  console.log('\nlamplight probe (material colours read off the scene graph):');
  console.log(`  hatch (2.1 m from the z=-51 lamp head)  day r-b ${warmth(day.hatch).toFixed(1)}  ->  night ${warmth(night.hatch).toFixed(1)}`);
  console.log(`  sedan (10 m from any lamp head)         day r-b ${warmth(day.sedan).toFixed(1)}  ->  night ${warmth(night.sedan).toFixed(1)}`);
  const litUp = warmth(night.hatch) - warmth(day.hatch) > 8;
  const controlFlat = night.sedan === day.sedan;
  const restored = back.hatch === day.hatch;
  console.log(`  ${litUp ? 'OK  ' : 'FAIL'} the car in the pool warms up at night`);
  console.log(`  ${controlFlat ? 'OK  ' : 'FAIL'} the car away from any lamp is untouched`);
  console.log(`  ${restored ? 'OK  ' : 'FAIL'} it returns exactly to its base colour by day`);
  if (!litUp || !controlFlat || !restored) process.exit(1);
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
