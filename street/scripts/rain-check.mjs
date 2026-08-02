// Prove rain is world-locked, not camera-locked.
//
// Sample a raindrop's WORLD position, teleport the player a long way, sample
// again. If rain follows the camera the drop moves with you. If it's
// world-locked the drop either hasn't moved horizontally at all, or has
// wrapped by an exact multiple of RAIN_BOX (30 m) — a full period, which is
// invisible because the distribution is uniform.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const URL = aim('http://localhost:4177/');
await page.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(page, URL);   // GOTCHAS 26 — before the try/catch below judges the world
try {
  await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });
} catch {
  console.error('__ct.scene never appeared. Page errors:\n' + (errs.join('\n') || '(none captured)'));
  await browser.close(); process.exit(1);
}

const BOX = 30;
const res = await page.evaluate(async (BOX) => {
  const scene = window.__ct.scene();
  let rain = null;
  scene.traverse((o) => { if (o.type === 'Points') rain = o; });
  if (!rain) return { err: 'no rain Points object found' };

  // find a rainy hour and sit in it until the rain has built up
  let hr = -1;
  for (let h = 0; h < 300; h++) if (((Math.imul(h, 2246822519) >>> 0) % 100) < 22) { hr = h; break; }
  window.__ct.clock(hr, 30);
  window.__ct.warp(-1, -20, Math.PI, 0, 0.05);
  await new Promise((r) => setTimeout(r, 2500));

  const sample = (n) => {
    const a = rain.geometry.getAttribute('position');
    const out = [];
    for (let i = 0; i < n; i++) out.push([a.getX(i), a.getZ(i)]);
    return { pts: out, objX: rain.position.x, objZ: rain.position.z };
  };

  const before = sample(12);
  // teleport a long way down the block — 45 m, not a multiple of the box
  window.__ct.warp(-1, -65, Math.PI, 0, 0.05);
  await new Promise((r) => setTimeout(r, 900));
  const after = sample(12);

  // classify each drop's horizontal movement
  const verdicts = before.pts.map(([x0, z0], i) => {
    const [x1, z1] = after.pts[i];
    const dx = x1 - x0, dz = z1 - z0;
    const isPeriodic = (d) => Math.abs(d - BOX * Math.round(d / BOX)) < 0.01;
    return { dx: +dx.toFixed(3), dz: +dz.toFixed(3), ok: isPeriodic(dx) && isPeriodic(dz) };
  });
  return { hr, objMoved: { x: after.objX - before.objX, z: after.objZ - before.objZ }, verdicts };
}, BOX);

await browser.close();
if (res.err) { console.error(res.err); process.exit(1); }

const bad = res.verdicts.filter((v) => !v.ok);
console.log(`rainy hour ${res.hr}; player teleported 45 m`);
console.log(`rain object itself moved: x=${res.objMoved.x} z=${res.objMoved.z}  (must be 0 — nonzero means it is pinned to the camera)`);
for (const v of res.verdicts.slice(0, 6)) {
  console.log(`  drop dx=${String(v.dx).padStart(8)} dz=${String(v.dz).padStart(8)}  ${v.ok ? 'world-locked' : 'FOLLOWS CAMERA'}`);
}
console.log(`\n${res.verdicts.length - bad.length}/${res.verdicts.length} drops world-locked`);
if (bad.length || res.objMoved.x || res.objMoved.z) { console.error('FAIL: rain is not world-locked'); process.exit(1); }
console.log('PASS: rain is locked to the world');
