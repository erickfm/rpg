// w43 — WALK the rebuilt park loop, and sample the floor along it.
//
// The loop's surface is all decal, so the risk is not that it blocks you; it
// is that a turn is no longer walkable at full width, or that something the
// rebuild moved (the hoop rail now follows the ring) ended up standing in it.
// So: walk a corner for real, and sample the floor across the FULL width of
// the band at 1 m intervals the whole way round, corners included.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4190/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 20));

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
const gyAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
const f = (n) => n.toFixed(3);
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// the loop's own arithmetic, the same identity park.ts uses
const INSET = 6.0, CHAM = 2.6, PATH_W = 1.5, KERB_W = 0.25;
const site = { minX: -39, maxX: -7, minZ: -98, maxZ: -68 };
const EDGE_X = site.maxX - KERB_W;
const lx0 = site.minX + INSET + 0.5, lx1 = EDGE_X - INSET;
const lz0 = site.minZ + INSET, lz1 = site.maxZ - INSET;
const CH_K = 2 - Math.SQRT2;
const ringPts = (t) => {
  const x0 = lx0 - t, x1 = lx1 + t, z0 = lz0 - t, z1 = lz1 + t, c = CHAM + t * CH_K;
  return [[x0 + c, z0], [x1 - c, z0], [x1, z0 + c], [x1, z1 - c],
          [x1 - c, z1], [x0 + c, z1], [x0, z1 - c], [x0, z0 + c]];
};

// ── 1. THE BAND IS A CONSTANT WIDTH ALL THE WAY ROUND ────────────────────
// The old corner was PATH_W/cos45 = 2.12 m wide where it crossed its legs.
// Measured as the distance between the outer and inner rings at matching
// points — if the offset identity is wrong anywhere, it is wrong here.
{
  const o = ringPts(PATH_W / 2), i = ringPts(-PATH_W / 2);
  let worst = 0, at = '';
  for (let k = 0; k < 8; k++) {
    // the perpendicular distance between the two parallel edges k
    const [ax, az] = o[k], [bx, bz] = o[(k + 1) % 8];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const [px, pz] = i[k];
    const d = Math.abs((px - ax) * dz - (pz - az) * dx) / L;
    if (Math.abs(d - PATH_W) > worst) { worst = Math.abs(d - PATH_W); at = `edge ${k} = ${f(d)}`; }
  }
  report('the loop keeps its width through every turn', worst < 1e-9,
    `worst departure from ${PATH_W} m is ${worst.toExponential(2)} m (${at})`);
}

// ── 2. THE FLOOR UNDER THE WHOLE BAND IS LEVEL ───────────────────────────
// A municipal path is laid level and the file's own rule says the relief must
// fade to zero before it reaches the loop. Sampled across the full width so a
// corner that had crept onto the field's crown would show up.
{
  const rings = [-0.5, -0.25, 0, 0.25, 0.5].map((k) => ringPts(k * PATH_W));
  let lo = Infinity, hi = -Infinity, n = 0;
  for (const R of rings) {
    for (let k = 0; k < 8; k++) {
      const [ax, az] = R[k], [bx, bz] = R[(k + 1) % 8];
      const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.round(L));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const y = await gyAt(ax + (bx - ax) * t, az + (bz - az) * t);
        lo = Math.min(lo, y); hi = Math.max(hi, y); n++;
      }
    }
  }
  report('the loop is level end to end', hi - lo < 0.005,
    `${n} samples across the full band width, floor ${f(lo)}…${f(hi)} (spread ${f(hi - lo)} m)`);
}

// ── 3. WALK A CORNER, at player height ───────────────────────────────────
// Up the street leg and round the near turn. The old corner overlapped its
// legs at a 1.5 mm y-separation; the new one is one surface, so this is also
// the check that the join has no lip.
{
  // THE FORWARD VECTOR IS (sin yaw, -cos yaw) — yaw 0 walks you toward -z, not
  // +z. Reading it as (sin, cos) sends every diagonal test off the path and
  // across the field, where it passes for the wrong reason: my own first run of
  // this "rounded the chamfer" by strolling 7.9 m over open grass.
  await warp(lx1, lz1 - CHAM - 5.5, Math.PI);   // up the street leg, toward +z
  await page.waitForTimeout(200);
  const a = await pos();
  await page.keyboard.down('w'); await page.waitForTimeout(2600); await page.keyboard.up('w');
  await page.waitForTimeout(80);
  const c = await pos();
  // pos() is [x, y, z, gy] — z is index 2, NOT 1. Index 1 is the eye height,
  // which is constant on level ground, so reading it as z reports "you did not
  // move" on a walk that worked perfectly.
  report('walk up the street leg into the turn', c[2] > a[2] + 3.0 && c[2] > lz1 - CHAM - 0.3,
    `z ${f(a[2])} -> ${f(c[2])}, reaching the turn at ${f(lz1 - CHAM)}, floor ${f(c[3])}`);
  // now take the chamfer itself. It runs from (lx1, lz1-CHAM) to (lx1-CHAM,
  // lz1), so the bearing is -x/+z: sin yaw = -1/root2 and -cos yaw = +1/root2.
  const CORNER_YAW = -3 * Math.PI / 4;
  await warp(lx1 - 0.2, lz1 - CHAM + 0.2, CORNER_YAW);
  await page.waitForTimeout(200);
  const d0 = await pos();
  await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
  await page.waitForTimeout(80);
  const d1 = await pos();
  const moved = Math.hypot(d1[0] - d0[0], d1[2] - d0[2]);
  // …and it must have STAYED on the chamfer, not wandered onto the grass: the
  // turn's own centreline is the segment between the two leg ends.
  const ax = lx1, az = lz1 - CHAM, bx = lx1 - CHAM, bz = lz1;
  const L = Math.hypot(bx - ax, bz - az);
  const off = Math.abs((d1[0] - ax) * (bz - az) - (d1[2] - az) * (bx - ax)) / L;
  report('…and round the chamfer without being stopped', moved > 2.4 && off < PATH_W / 2,
    `moved ${f(moved)} m to (${f(d1[0])}, ${f(d1[2])}), ${f(off)} m off the turn's centreline, floor ${f(d1[3])}`);
}

// ── 4. NOTHING SOLID STANDS IN THE BAND ──────────────────────────────────
// The hoop rail moved (it follows the ring now). It carries no collider by
// design, but anything else that does must still be clear of the walk.
{
  const cols = await page.evaluate(() => window.__ct.colliders());
  const R = ringPts(0);
  const worst = [];
  for (const c of cols) {
    let near = Infinity;
    for (let k = 0; k < 8; k++) {
      const [ax, az] = R[k], [bx, bz] = R[(k + 1) % 8];
      const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.round(L * 4));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const dx = Math.max(c.minX - x, x - c.maxX, 0), dz = Math.max(c.minZ - z, z - c.maxZ, 0);
        near = Math.min(near, Math.hypot(dx, dz));
      }
    }
    if (near < PATH_W / 2) worst.push({ into: PATH_W / 2 - near, c });
  }
  worst.sort((a, b) => b.into - a.into);
  // These are the park's own benches and bins beside the loop, not anything
  // this pass moved: the loop's plan is unchanged, only its drawing. Reported
  // with the depth so it is actionable rather than just red.
  report('nothing solid stands in the loop', worst.length === 0,
    worst.length
      ? `${worst.length} reach the walk, deepest ${f(worst[0].into)} m at ` +
        worst.slice(0, 8).map((w) => `(${f((w.c.minX + w.c.maxX) / 2)}, ${f((w.c.minZ + w.c.maxZ) / 2)}) ${f(w.into)}m`).join(' ')
      : `${cols.length} colliders checked, none reaches the ${PATH_W} m walk`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall clear');
await b.close();
process.exit(fails ? 1 : 0);
