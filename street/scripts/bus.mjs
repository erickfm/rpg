// feat/bus — the 42 stop and the bus that serves it.
//
//   shots  (default) — the stop, and the bus from several angles
//   walk             — hold W past the stop, both lanes, to prove the walk
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/bus.mjs [shots|walk|all]
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
await page.evaluate(() => window.__ct.clock(13, 0));

// stand at (x,z,gy) looking AT (tx,tz) — forward is (sin yaw, ·, -cos yaw)
const shot = async (name, x, z, tx, tz, gy = 0, pitch = 0, before = null, wait = 320) => {
  if (before) await page.evaluate(before);
  await page.evaluate(([x, z, tx, tz, gy, pitch]) => {
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, pitch);
  }, [x, z, tx, tz, gy, pitch]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/bs-${name}.png` });
};

// park the bus where we want it, then look at it. The sim keeps moving, so
// re-place it immediately before each frame.
const atBus = (z, dir = -1) => new Function(`window.__ct.bus(${z}, ${dir})`);

if (mode === 'shots' || mode === 'all') {
  // ── the stop itself ───────────────────────────────────────────────────
  await shot('stop', 3.0, -35, 5.6, -34.5, 0, -0.10);
  await shot('stop-walk', 6.2, -30, 6.2, -40, 0.14, -0.16);   // walking up to it
  await shot('flag', 3.6, -32.0, 5.35, -33.5, 0, 0.12);
  await shot('bench-ad', 2.6, -36.6, 5.2, -36.6, 0, -0.06);
  await shot('bench-seat', 6.5, -34.6, 5.4, -37.2, 0.14, -0.30);
  // ── the bus ───────────────────────────────────────────────────────────
  await shot('side', -2.0, -34, 1.4, -34, 0, 0.02, atBus(-34));
  await shot('front', -1.2, -44, 1.35, -37, 0, 0.03, atBus(-36));
  await shot('doors', 6.4, -34, 1.35, -35, 0.14, 0.0, atBus(-35));
  await shot('rear', 3.2, -24, 1.35, -31, 0, 0.02, atBus(-31));
  await shot('roll-sign', -1.0, -46, 1.35, -40, 0, 0.10, atBus(-39));
  await shot('at-stop', 6.6, -30.5, 1.35, -36, 0.14, 0.0, atBus(-35));
  await shot('passing', 6.3, -20, 1.35, -26, 0.14, 0.0, atBus(-26));
  await shot('northbound', 3.0, -30, -1.35, -36, 0, 0.02, atBus(-36, 1));
  // ── clearance: the bus against the parked cars it has to squeeze past ──
  await shot('clearance', 4.6, -60, 2.0, -49, 0, -0.06, atBus(-49));
  await shot('clearance-over', 2.0, -40, 2.0, -50, 9.0, -0.85, atBus(-49));
  // ── night ─────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__ct.clock(1, 30));
  await shot('night', -2.0, -34, 1.4, -34, 0, 0.02, atBus(-34), 700);
  await page.evaluate(() => window.__ct.clock(13, 0));
  console.log('shots -> shots/bs-*.png');
}

if (mode === 'walk' || mode === 'all') {
  const hike = async (label, x, z, yaw, seconds, axis) => {
    await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
    await page.waitForTimeout(120);
    const a = await page.evaluate(() => window.__ct.pos());
    await page.keyboard.down('w');
    await page.waitForTimeout(seconds * 1000);
    await page.keyboard.up('w');
    const b = await page.evaluate(() => window.__ct.pos());
    const moved = Math.abs(axis === 'z' ? b[2] - a[2] : b[0] - a[0]);
    const ok = moved > seconds * 2.4;
    console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${moved.toFixed(1)} m in ${seconds}s ` +
      `(${a[0].toFixed(1)},${a[2].toFixed(1)}) -> (${b[0].toFixed(1)},${b[2].toFixed(1)})`);
    return ok;
  };
  console.log('\nwalking past the stop (W held, no mouse):');
  let all = true;
  // straight through the stop on the building-side lane
  all = await hike('east walk, through the stop southbound', 6.22, -24, 0, 8, 'z') && all;
  all = await hike('east walk, through the stop northbound', 6.22, -46, Math.PI, 8, 'z') && all;
  // The kerb-side strip: the flag pole must not pinch it. (The BENCH is
  // solid and does occupy that strip — you walk round it on the lane above,
  // which is the point of keeping the bench inside the lamp-pole envelope.)
  all = await hike('east walk, kerb strip past the flag pole', 5.85, -28, 0, 2, 'z') && all;
  if (!all) { console.error('\nWALK FAILED — the stop blocks the lane'); process.exit(1); }
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
