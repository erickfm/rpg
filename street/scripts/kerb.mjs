// feat/ground — the kerb, the gutter pan and the corner returns.
//
// Two jobs:
//   shots  (default) — look at the ground from the angles that matter
//   probe            — read back the ground height along walked lines, so the
//                      corner radius and the kerb ramp can be checked as a
//                      SURFACE, not just as pixels
//
// Usage: SHOT_URL=http://localhost:4179/ node scripts/kerb.mjs [shots|probe|all]
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

// Stand at (x, z, gy) and LOOK AT (tx, tz). The rig's forward is
// (sin yaw, ·, -cos yaw), so a raw yaw of π faces +z — the opposite of what
// most of these shots want. Aim by target, never by hand-written yaw.
const shot = async (name, x, z, tx, tz, gy = 0, pitch = 0, wait = 340) => {
  await page.evaluate(([x, z, tx, tz, gy, pitch]) => {
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, pitch);
  }, [x, z, tx, tz, gy, pitch]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/kb-${name}.png` });
};

if (mode === 'shots' || mode === 'all') {
  // ── the corner, walked up to the way a player arrives at it ───────────
  await shot('corner-road', -1, -93, 3, -99, 0, -0.28);       // down the street into the bend
  await shot('corner-east', 1.5, -101, 30, -103, 0, 0);       // out along the side street
  await shot('corner-shops', 1.5, -102, 7, -97, 0, -0.05);    // the bodega corner, from the road
  // ── the return itself: on it, off it, and from above ──────────────────
  await shot('return-on', 6.3, -96.4, 4.2, -99.2, 0.14, -0.35);
  await shot('return-off', 3.0, -100.4, 6.4, -96.6, 0, -0.12);
  await shot('return-over', 6.4, -96.3, 4.6, -98.1, 4.2, -1.15);
  await shot('ramp', 7.0, -95.0, 5.4, -97.0, 0.14, -0.55);
  await shot('ramp-low', 4.4, -99.0, 6.6, -96.6, 0, -0.16);   // eye level, off the roadway
  // ── mid-block: the kerb edge you walk beside all day ──────────────────
  await shot('face', 2.9, -40, 6.0, -40, 0, -0.46);           // from the road, square at the face
  await shot('face-near', 3.9, -47, 5.6, -47, 0, -0.70);      // right up against it
  await shot('face-far', 1.6, -52, 5.4, -58, 0, -0.24);       // down the line of it
  await shot('down', 5.35, -40, 4.6, -40, 0.14, -1.02);       // over the edge, from the walk
  await shot('along', 5.4, -30, 5.4, -44, 0.14, -0.42);
  await shot('gutter', 4.1, -52, 4.4, -62, 0, -0.5);
  await shot('basin', 3.9, -91.0, 4.9, -92.6, 0, -0.45);
  // ── the inside of the bend, and the side street ───────────────────────
  await shot('bend-in', -2.6, -105.0, -4.9, -107.9, 0, -0.32);
  await shot('bend-over', -4.2, -106.2, -4.9, -107.6, 4.0, -1.2);
  await shot('side-south', 10, -104.0, 4, -108.6, 0, -0.26);
  // ── red no-parking paint: the hydrant fire zone and the corner run ────
  await shot('paint-hydrant', 2.6, -6, 6.0, -6, 0, -0.42);
  await shot('paint-hydrant-along', 3.4, -1.5, 5.2, -12, 0, -0.30);
  await shot('paint-corner', 2.6, -92, 6.0, -92, 0, -0.42);
  await shot('paint-worn', 4.0, -7.5, 5.4, -7.5, 0, -0.62);   // close on the wear
  // ── the parked row: nobody parks perfectly ────────────────────────────
  await shot('parked-row', 0.2, -6, 3.4, -52, 0, -0.10);
  await shot('parked-hatch', 1.2, -44, 3.7, -49, 0, -0.14);
  await shot('parked-over', 2.0, -30, 3.2, -50, 9, -0.72);
  // ── night + rain, since both re-tint every ground surface ─────────────
  await page.evaluate(() => window.__ct.clock(1, 30));
  await shot('night', 2.9, -40, 6.0, -40, 0, -0.46, 700);
  await page.evaluate(() => window.__ct.clock(13, 0));
  console.log('shots -> shots/kb-*.png');
}

if (mode === 'probe' || mode === 'all') {
  // Ground height read back through the rig itself: warp to a point, let a
  // frame run, ask where the camera ended up. gy = eye height - 1.62.
  const probe = async (pts) => page.evaluate(async (list) => {
    const out = [];
    for (const [x, z] of list) {
      window.__ct.warp(x, z);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const p = window.__ct.pos();
      out.push([x, z, +p[3].toFixed(3)]);
    }
    return out;
  }, pts);

  const line = (name, pts) => probe(pts).then((r) => {
    console.log(`\n${name}`);
    for (const [x, z, gy] of r) console.log(`  (${x.toFixed(2)}, ${z.toFixed(2)})  gy=${gy.toFixed(3)}`);
  });

  // across the corner return on the 45° bisector: walk → ramp → gutter → road
  const diag = [];
  for (let k = 0; k <= 12; k++) {
    const d = 0.6 + k * 0.28;
    diag.push([8.5 - d * Math.SQRT1_2, -94.5 - d * Math.SQRT1_2]);
  }
  await line('corner return, along the 45° bisector (walk 0.14 -> ramp -> road 0)', diag);

  // the same return, but off the ramp: should step straight off the kerb
  const side = [];
  for (let k = 0; k <= 10; k++) side.push([5.6, -97.6 + k * 0.28]);
  await line('east walk running into the return (x=5.6)', side);

  // the inside of the bend: the walk noses out on a radius
  const nose = [];
  for (let k = 0; k <= 10; k++) nose.push([-5.4 + k * 0.28, -107.4]);
  await line('inside-of-bend nose, crossing it west to east (z=-107.4)', nose);

  // the 2 m lane the player has to keep: kerb edge to building face, mid-block
  const lane = [];
  for (let k = 0; k <= 10; k++) lane.push([4.7 + k * 0.25, -40]);
  await line('mid-block cross-section, road -> kerb -> walk -> wall (z=-40)', lane);
}

if (mode === 'walk' || mode === 'all') {
  // Actually WALK the 2 m lane, holding W, rather than asserting it is clear.
  // This work adds no colliders at all, but the kerb moved, so prove the lane.
  const hike = async (label, x, z, yaw, seconds, axis) => {
    await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
    await page.waitForTimeout(120);
    const start = await page.evaluate(() => window.__ct.pos());
    await page.keyboard.down('w');
    await page.waitForTimeout(seconds * 1000);
    await page.keyboard.up('w');
    const end = await page.evaluate(() => window.__ct.pos());
    const moved = Math.abs((axis === 'z' ? end[2] - start[2] : end[0] - start[0]));
    const ok = moved > seconds * 2.4; // walk speed is 3.3 m/s; allow for corners
    console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${moved.toFixed(1)} m in ${seconds}s ` +
      `(${start[0].toFixed(1)},${start[2].toFixed(1)}) -> (${end[0].toFixed(1)},${end[2].toFixed(1)})`);
    return ok;
  };
  // The clear lane is the strip between the kerb-side furniture and the wall.
  // Tree trunks block out to x≈5.90 and the lamp poles to x≈6.17 (collider +
  // the rig's 0.42 radius); the building wall starts biting at x≈6.28. So the
  // through-lane is a hair over 6.2 — unchanged by this work, which adds no
  // colliders at all, but worth walking rather than asserting.
  console.log('\nwalking the lane (W held, no mouse):');
  let all = true;
  // down the east walk, past the tree pits and the lamp poles, to the corner
  all = await hike('east walk, mid-block southbound', 6.22, -4, 0, 14, 'z') && all;
  // The west walk in a straight line runs into the payphone, whose collider
  // spans x -6.95..-5.95 — half the walk — so you have to step kerb-side for
  // a couple of metres. NOT counted as a failure: it is identical on the
  // baseline (props.ts owns the payphone), and this branch adds no colliders.
  await hike('west walk (known pinch at the payphone, z=-11)', -6.22, -4, 0, 14, 'z');
  all = await hike('west walk, resuming past the payphone', -6.22, -13, 0, 10, 'z') && all;
  // round the corner return itself
  all = await hike('east walk into the corner return', 6.22, -88, 0, 4, 'z') && all;
  // along the side street's north walk, clear of the bodega's fruit crates
  all = await hike('north side-street walk, eastbound', 11, -97, Math.PI / 2, 8, 'x') && all;
  if (!all) { console.error('\nWALK FAILED — something blocks the lane'); process.exit(1); }
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
