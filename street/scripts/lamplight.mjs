// feat/lamplight — things standing in a lamp pool now catch the light.
//
//   shots (default) — night views of lit cars, people, walls
//   probe           — assert the tint is POSITION-dependent and free by day
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/lamplight.mjs [shots|probe|all]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
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
  // dynamic range: the same frame must contain genuinely dark street AND
  // genuinely warm pools. A flat wash gives you neither.
  await shot('range-down-block', -1.0, -14, -1.0, -60, 0, 0.02);
  await shot('range-between', -1.0, -34, -1.0, -44, 0, 0.02);
  await shot('depth-fog', -1.2, -8, -1.2, -60, 0, 0.03);
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
    // a big building wall well away from any lamp head — world geometry,
    // ambient only, which is the thing a flat overlay used to wash out
    let wall = null, wd = 1e9;
    scene.traverse((o) => {
      if (!o.isMesh || !o.material?.color || o.material.transparent) return;
      if (o.position.y < 2 || Math.abs(o.position.x) > 20) return;
      const d = Math.abs(o.position.z + 44);   // mid-block, between lamps
      if (d < wd) { wd = d; wall = o; }
    });
    // Height costs light: sample the ROAD, a ground-level shopfront/sign, and
    // an upper floor no lamp can reach. These are the three surfaces the user
    // named, so they are the three the probe measures.
    const V = new (Object.getPrototypeOf(scene.position).constructor)();
    let road = null, low = null, high = null, highY = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const g = o.geometry?.parameters, t = o.geometry?.type;
      const y = o.getWorldPosition(V).y;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m?.color || m.transparent) continue;
        if (t === 'PlaneGeometry' && g?.width === 10 && g?.height > 100) road ??= m;
        if (!m.map) continue;
        if (y > 1 && y < 3.2 && !low) low = m;                 // shopfront band / signage
        if (y > 6 && y > highY) { high = m; highY = y; }        // upper floors
      }
    });
    const rgb = (m) => m ? [m.color.r, m.color.g, m.color.b] : null;
    return {
      hatch: near(3.63, -49), sedan: near(3.93, -13),
      wall: wall ? [wall.material.color.r, wall.material.color.g, wall.material.color.b] : null,
      road: rgb(road), low: rgb(low), high: rgb(high),
    };
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
  // Since night now darkens the world, "did the colour change" is the wrong
  // question — everything changes. The right question is whether a surface
  // keeps its IDENTITY: normalise out brightness and compare what is left.
  // A uniform darkening leaves chroma untouched; only warming shifts it.
  const norm = (c) => { const l = Math.max(lum(c), 1e-6); return [c[0] / l, c[1] / l, c[2] / l]; };
  const chromaShift = (d, n) => {
    const a = norm(d), b = norm(n);
    return Math.max(...[0, 1, 2].map((i) => Math.abs(b[i] - a[i]) / Math.max(a[i], 1e-6)));
  };

  let warmed = 0, worstChroma = 0, darkWarmed = 0;
  for (let i = 0; i < day.hatch.length; i++) {
    const d = day.hatch[i], n = night.hatch[i];
    const cs = chromaShift(d, n);
    if (cs > 0.01) { warmed++; worstChroma = Math.max(worstChroma, cs); }
    if (lum(d) < 0.22 && cs > 0.01) darkWarmed++;   // glass/rubber must never warm
  }
  const ctlChroma = Math.max(...day.sedan.map((d, i) => chromaShift(d, night.sedan[i])));
  const ctlScale = day.sedan.map((d, i) => lum(night.sedan[i]) / Math.max(lum(d), 1e-6));
  const ctlUniform = Math.max(...ctlScale) - Math.min(...ctlScale);

  const wallDay = lum(day.wall), wallNight = lum(night.wall);
  const poolLum = (set) => set.hatch.reduce((a, c) => a + lum(c), 0) / set.hatch.length;
  const darkLum = (set) => set.sedan.reduce((a, c) => a + lum(c), 0) / set.sedan.length;
  const range = poolLum(night) / Math.max(darkLum(night), 1e-6);

  console.log('\nlamplight probe — hatch parked 2.1 m from the z=-51 lamp head:');
  console.log(`  ${warmed}/${day.hatch.length} materials take WARMTH (hue shift, not just dimming)`);
  console.log(`  largest hue shift on the car:   ${(worstChroma * 100).toFixed(1)}%`);
  console.log(`  glass / tyres / ironwork warmed: ${darkWarmed}`);
  console.log(`  mid-block wall:  day ${wallDay.toFixed(3)} -> night ${wallNight.toFixed(3)} ` +
    `(${((1 - wallNight / wallDay) * 100).toFixed(0)}% of the ambient gone)`);
  console.log(`  control car away from lamps: hue shift ${(ctlChroma * 100).toFixed(1)}%, ` +
    `dimming spread across its materials ${(ctlUniform * 100).toFixed(1)}%`);
  console.log(`  at night, car in a pool vs car between lamps: ${range.toFixed(2)}x brighter`);

  const litUp = warmed >= 3;
  const stillItself = worstChroma > 0.01 && worstChroma < 0.25;   // warms, stays itself
  const darkSafe = darkWarmed === 0;                              // may dim, never warm
  const controlFlat = ctlChroma < 0.01 && ctlUniform < 0.01;      // dims uniformly, no warmth
  const restored = JSON.stringify(back.hatch) === JSON.stringify(day.hatch);
  // the three surfaces the follow-up called out by name
  const frac = (k) => lum(night[k]) / Math.max(lum(day[k]), 1e-6);
  console.log(`  road surface:      ${(frac('road') * 100).toFixed(1)}% of daylight at 3am`);
  console.log(`  signage y<3.2:     ${(frac('low') * 100).toFixed(1)}%   (must stay lit)`);
  console.log(`  upper floors:      ${(frac('high') * 100).toFixed(1)}%   (nothing reaches them)`);
  const roadBlack = frac('road') < 0.10;
  const signageKept = frac('low') > 0.20;
  const heightCosts = frac('high') < frac('low') * 0.75;
  console.log(`  ${roadBlack ? 'OK  ' : 'FAIL'} the road between lamps is nearly black`);
  console.log(`  ${signageKept ? 'OK  ' : 'FAIL'} lit signage does NOT come down with the street`);
  console.log(`  ${heightCosts ? 'OK  ' : 'FAIL'} height costs light — upper floors darker than the shopfront`);

  const worldDarkens = wallNight / wallDay < 0.45;
  const hasRange = range > 1.6;
  console.log(`  ${litUp ? 'OK  ' : 'FAIL'} the car in the pool warms up`);
  console.log(`  ${stillItself ? 'OK  ' : 'FAIL'} it is still the same car — hue barely moves`);
  console.log(`  ${darkSafe ? 'OK  ' : 'FAIL'} glass, tyres and ironwork dim but never warm`);
  console.log(`  ${controlFlat ? 'OK  ' : 'FAIL'} a car away from lamps only loses ambient, uniformly`);
  console.log(`  ${worldDarkens ? 'OK  ' : 'FAIL'} the world itself goes dark, not just the lens`);
  console.log(`  ${hasRange ? 'OK  ' : 'FAIL'} lit and unlit are genuinely far apart (no flat wash)`);
  console.log(`  ${restored ? 'OK  ' : 'FAIL'} everything returns exactly to base by day`);
  if (!litUp || !stillItself || !darkSafe || !controlFlat || !restored || !worldDarkens || !hasRange) process.exit(1);
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
