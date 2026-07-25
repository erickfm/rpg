// feat/bus — the 42 stop and the bus that serves it.
//
//   shots  (default) — the stop, and the bus from several angles
//   walk             — hold W past the stop, both lanes, to prove the walk
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/bus.mjs [shots|walk|all]
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
  await shot('bench-ad', 2.4, -35.0, 5.2, -35.0, 0, -0.06);      // the ad, from the roadway
  await shot('bench-seat', 6.6, -32.6, 5.4, -35.4, 0.14, -0.26);  // walking up to it
  await shot('bench-sit', 6.3, -35.0, 3.0, -35.0, 0.14, -0.10);   // what a rider faces
  // ── the bus ───────────────────────────────────────────────────────────
  await shot('side', -2.0, -34, 1.4, -34, 0, 0.02, atBus(-34));
  await shot('front', -1.2, -44, 1.35, -37, 0, 0.03, atBus(-36));
  await shot('doors', 6.4, -34, 1.35, -35, 0.14, 0.0, atBus(-35));
  await shot('rear', 3.2, -24, 1.35, -31, 0, 0.02, atBus(-31));
  await shot('roll-sign', -1.0, -46, 1.35, -40, 0, 0.10, atBus(-39));
  await shot('at-stop', 6.6, -30.5, 1.35, -36, 0.14, 0.0, atBus(-35));
  await shot('passing', 6.3, -20, 1.35, -26, 0.14, 0.0, atBus(-26));
  await shot('northbound', 3.0, -30, -1.35, -36, 0, 0.02, atBus(-36, 1));
  // ── the 42 actually serving the stop, doors open ──────────────────────
  const serving = () => page.evaluate(async () => {
    window.__ct.bus(-12, -1);
    for (let i = 0; i < 900; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (window.__ct.busInfo()[3] > 1.2) return;   // dwelling, doors open
    }
  });
  await serving(); await shot('serving-walk', 6.4, -30.0, 4.6, -33.6, 0.14, -0.02);
  await serving(); await shot('serving-bench', 6.3, -36.9, 4.5, -33.0, 0.14, 0.0);
  await serving(); await shot('serving-doors', 5.0, -36.6, 4.4, -33.2, 0.14, -0.05);
  await serving(); await shot('serving-wide', 6.5, -22, 3.9, -32, 0.14, -0.03);
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
    await page.waitForTimeout((seconds - 1.5) * 1000);
    const mid = await page.evaluate(() => window.__ct.pos());   // 1.5 s from the end
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    const b = await page.evaluate(() => window.__ct.pos());
    const moved = Math.abs(axis === 'z' ? b[2] - a[2] : b[0] - a[0]);
    const lastBit = Math.hypot(b[0] - mid[0], b[2] - mid[2]);
    // TUNING THIS THRESHOLD TWICE WAS THE WRONG SHAPE OF FIX, and measuring it
    // says so. CITIZENS are solid until they give way, up to 1.4 s each, so one
    // pedestrian costs ~4 m of an 8 s hike and two cost 8. At 2.4 m/s it was
    // reporting the traffic and not the lane; I dropped it to 1.9 and moved on.
    //
    // But 8 s x 1.9 puts the line at 15.2 m and the worst clear run on record
    // is 15.8 — 0.6 m of margin, 4%. That is the same knife-edge park.mjs was
    // sitting on when it flipped, and no threshold escapes it: the number being
    // tested depends on who happens to be walking here.
    //
    // So ask bfd0b7ae's question instead. Still moving when the clock runs out
    // means the lane is open and the distance was only a time budget; dead
    // still means blocked. When a tree genuinely severed this walk it managed
    // 5.0 m and stopped, which this catches and a distance line only caught by
    // luck of placement. Distance is kept as an OR so a fast clear run passes
    // outright.
    const ok = moved > seconds * 1.9 || lastBit > 0.8;
    console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${moved.toFixed(1)} m in ${seconds}s, ` +
      `${lastBit.toFixed(2)} m in the last 1.5 s ` +
      `(${a[0].toFixed(1)},${a[2].toFixed(1)}) -> (${b[0].toFixed(1)},${b[2].toFixed(1)})`);
    return ok;
  };
  console.log('\nwalking past the stop (W held, no mouse):');
  let all = true;
  // straight through the stop on the building-side lane
  all = await hike('east walk, through the stop southbound', 6.22, -24, 0, 8, 'z') && all;
  all = await hike('east walk, through the stop northbound', 6.22, -46, Math.PI, 8, 'z') && all;
  // WHERE IS THE NARROWEST POINT? This replaces a check that walked the
  // kerb-side strip at a hand-picked x and asserted it got past the flag pole.
  // That test stopped meaning anything once the furniture moved: the bench
  // sits AT THE KERB now, by request, so it occupies that strip on purpose,
  // and the thing that actually stopped the walker was a street tree several
  // metres before the pole — so the test was reporting a pass or fail about
  // the pole while measuring something else entirely.
  //
  // The invariant the project really has is different and worth testing
  // directly: SOMETHING on this walk is the narrowest point, and nothing new
  // may become narrower than the lamp poles, which have set that limit since
  // they went in. So sweep inward from the wall and find the smallest x that
  // walks the whole block. That number IS the lane, measured rather than
  // assumed, and it fails loudly if any future prop encroaches on it.
  let lane = null;
  for (const x of [6.28, 6.22, 6.15, 6.08, 6.00]) {
    await page.evaluate((xx) => window.__ct.warp(xx, -24, 0, 0.14, 0), x);
    await page.waitForTimeout(120);
    await page.keyboard.down('w');
    await page.waitForTimeout(9000);
    await page.keyboard.up('w');
    const end = (await page.evaluate(() => window.__ct.pos()))[2];
    // -45 is past the lamp at -37 and the whole stop; scraping the wall costs
    // speed, so this is "got through", not "covered a target distance"
    if (end < -45) lane = x;
  }
  const laneOK = lane !== null && lane <= 6.22;
  console.log(`  ${laneOK ? 'OK  ' : 'STUCK'} east walk, narrowest clear lane: ` +
    `x = ${lane === null ? 'NONE' : lane.toFixed(2)} (lamp poles cap it at 6.11)`);
  all = laneOK && all;
  if (!all) { console.error('\nWALK FAILED — the stop blocks the lane'); process.exit(1); }
}

if (mode === 'bench' || mode === 'all') {
  // THE TWO QUESTIONS AN AUDIT COULD NOT ANSWER FROM OUTSIDE, answered as
  // numbers. It went looking for the ad panel by shape and could not find it —
  // it searched for "a 1.8 x 0.6 upright board" and the panel is a 1.73 x 0.37
  // plate 4 mm thick, reclined 12 degrees with the backrest. props.ts stamps
  // it now, so this is a lookup rather than a shape hunt.
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    const box = (o) => {
      o.updateWorldMatrix(true, false);
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox, m = o.matrixWorld.elements;
      const acc = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 };
      for (const sx of [bb.min.x, bb.max.x]) for (const sy of [bb.min.y, bb.max.y])
        for (const sz of [bb.min.z, bb.max.z]) {
          const x = m[0]*sx + m[4]*sy + m[8]*sz + m[12];
          const y = m[1]*sx + m[5]*sy + m[9]*sz + m[13];
          const z = m[2]*sx + m[6]*sy + m[10]*sz + m[14];
          acc.minX = Math.min(acc.minX, x); acc.maxX = Math.max(acc.maxX, x);
          acc.minY = Math.min(acc.minY, y); acc.maxY = Math.max(acc.maxY, y);
          acc.minZ = Math.min(acc.minZ, z); acc.maxZ = Math.max(acc.maxZ, z);
        }
      return acc;
    };
    let ad = null; const bez = []; const legs = []; const slats = [];
    sc.traverse((o) => {
      if (o.userData?.benchAd) ad = box(o);
      if (o.userData?.benchBezel) bez.push(box(o));
      if (o.userData?.groundProp === 'bench leg') legs.push(box(o));
      if (o.userData?.groundProp === 'bench seat') slats.push(box(o));
    });
    return { ad, bez, legs, slats };
  });
  console.log('\nthe bench ad and legs, measured:');
  if (!r.ad) { console.error('  FAIL no material stamped benchAd — the panel is not there'); process.exit(1); }
  const inner = {
    minY: Math.max(...r.bez.map((b2) => b2.minY).filter((v) => v < r.ad.minY + 0.2)),
    maxY: Math.min(...r.bez.map((b2) => b2.maxY).filter((v) => v > r.ad.maxY - 0.2)),
    minZ: Math.max(...r.bez.filter((b2) => b2.maxZ < r.ad.minZ + 0.2).map((b2) => b2.maxZ)),
    maxZ: Math.min(...r.bez.filter((b2) => b2.minZ > r.ad.maxZ - 0.2).map((b2) => b2.minZ)),
  };
  const marginZ0 = r.ad.minZ - inner.minZ, marginZ1 = inner.maxZ - r.ad.maxZ;
  const framed = r.bez.length === 4 && marginZ0 > 0.005 && marginZ1 > 0.005;
  console.log(`  ad panel at x ${r.ad.minX.toFixed(3)}…${r.ad.maxX.toFixed(3)}, ` +
    `${(r.ad.maxZ - r.ad.minZ).toFixed(2)} m long, ${(r.ad.maxY - r.ad.minY).toFixed(2)} m tall`);
  console.log(`  bezel bars: ${r.bez.length}; clear margin to the artwork ` +
    `${marginZ0.toFixed(3)} m / ${marginZ1.toFixed(3)} m at the ends`);
  console.log(`  ${framed ? 'OK  ' : 'FAIL'} the ad is FRAMED by a four-sided bezel, not clipped by it`);
  // legs: their tops must be INSIDE the slat, sharing no plane with it
  const slatTop = Math.max(...r.slats.map((s2) => s2.maxY));
  const slatBot = Math.min(...r.slats.map((s2) => s2.minY));
  const legTop = Math.max(...r.legs.map((l) => l.maxY));
  const buried = legTop > slatBot + 0.002 && legTop < slatTop - 0.002;
  console.log(`  seat slats span y ${slatBot.toFixed(3)}…${slatTop.toFixed(3)}; ` +
    `leg tops at ${legTop.toFixed(3)}`);
  console.log(`  ${buried ? 'OK  ' : 'FAIL'} leg tops are BURIED in the slat — coplanar with nothing (GOTCHAS §6)`);
  if (!framed || !buried) process.exitCode = 1;
}

if (mode === 'stop' || mode === 'all') {
  // Does the 42 actually CALL at the stop? Not something a still can show, so
  // sample the run: it should brake from 6.4 m/s, come to rest with its front
  // door at the flag (z = -33.5, i.e. body centre -31.15), pull in toward the
  // kerb, stand for a few seconds with the doors open, then pull away.
  console.log('\nthe 42 calling at the stop (southbound):');
  const trace = await page.evaluate(async () => {
    window.__ct.bus(-12, -1);
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 17000) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now() - t0;
      if (out.length === 0 || now - out[out.length - 1][0] >= 600) {
        const [x, z, spd, dwell, served] = window.__ct.busInfo();
        out.push([now, x, z, spd, dwell, served]);
      }
    }
    return out;
  });
  let stoodStill = 0, minSpd = 99, restZ = null, closestX = 99;
  for (const [t, x, z, spd, dwell] of trace) {
    if (spd < minSpd) { minSpd = spd; restZ = z; }
    if (spd < 0.25) stoodStill++;
    if (dwell > 0) closestX = Math.min(closestX, x);
    console.log(`  t=${(t / 1000).toFixed(1)}s  z=${z.toFixed(2)}  x=${x.toFixed(2)}  ` +
      `speed=${spd.toFixed(2)}  ${dwell > 0 ? `DWELL ${dwell.toFixed(1)}s doors open` : ''}`);
  }
  // the bus faces -z when southbound, so its front door (local z = -2.35)
  // sits 2.35 m BEYOND the body centre, not behind it
  const doorZ = restZ - 2.35;
  console.log(`\n  slowest ${minSpd.toFixed(2)} m/s, front door came to rest at z=${doorZ.toFixed(2)} ` +
    `(flag is at -33.50), pulled in to x=${closestX.toFixed(2)}`);
  const ok = minSpd < 0.25 && Math.abs(doorZ + 33.5) < 1.6 && stoodStill >= 3 && closestX < 3.9;
  console.log(ok ? '  OK — it stops at the flag, pulls in, and waits'
                 : '  FAILED — it did not properly call at the stop');
  if (!ok) process.exit(1);
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
