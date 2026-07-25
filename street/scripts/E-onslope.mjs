// Furniture standing ON the relief takes ONE ground height — the one under its
// centre. Anything wide enough, on ground tilted enough, then floats at one end
// or is buried at the other. This measures the gap under each corner.
//
// The bench on the mound is the case that matters: 1.56 m of it, on 1-in-17.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// THE FLOOR AT A POINT, asked directly. `window.__ct.groundAt(x, z)` runs the
// world's own picker for an arbitrary point and returns the answer.
//
// What this replaces, and why it matters more than a tidy-up: every floor
// reading in my harnesses used to TELEPORT THE PLAYER there and read
// `pos()[3]`. That is `apt.gy()` — a last-written value with more than one
// writer, and the citizens on the pavement write it too. So the reading you get
// is whoever queried the picker last, which is usually not you.
//
// It cost a real diagnosis. `E-walk` decides which half of its checks to run by
// probing the library landing: 0.99 means the flight is wired and climbs, 0.14
// means it is still one solid block. The probe read 0.14 three times running on
// a world where `groundAt` says 0.99, so the harness ran the un-wired half and
// reported two reds for the world being CORRECT — and every green run before
// that was green for having asserted a world that had not existed for hours.
// A median of three does not save you from this: it is not noise, it is a
// different question being answered.
const gy = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// The GAP UNDER THE FURNITURE, which is the thing you can see — not the drop in
// the terrain, which is what the first cut of this compared and which no change
// to where a bench sits could ever have moved. It reported the same 36 mm after
// the bench had been bedded into the slope, because it was measuring the hill.
//
// So: read the bottom of the real mesh. A bench's cast ends are the lowest
// thing it owns, so the smallest mesh-bottom near the seat IS where the bench
// meets the ground, and the gap is that minus the floor under each end.
const baseNear = (x, z, r) => page.evaluate(([x, z, r]) => {
  const scene = window.__ct.scene();
  const V3 = Object.getPrototypeOf(scene.position).constructor;
  let lo = Infinity;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    const v = new V3();
    v.setFromMatrixPosition(o.matrixWorld);
    if (Math.hypot(v.x - x, v.z - z) > r) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const y = v.y + o.geometry.boundingBox.min.y;
    if (y > -0.2 && y < 1.2 && y < lo) lo = y;
  });
  return lo === Infinity ? null : lo;
}, [x, z, r]);

const seats = (await page.evaluate(() => window.__ct.seats()))
  .filter((s) => s.pose.z < -60 && s.pose.x < -14);
const items = seats.map((s) => ({
  what: `bench @ ${s.pose.x.toFixed(1)},${s.pose.z.toFixed(1)}`,
  x: s.pose.x, z: s.pose.z, halfLen: 0.78,
  ax: Math.round(Math.cos(s.pose.yaw)), az: Math.round(Math.sin(s.pose.yaw)),
}));
items.push({ what: 'the tree on the mound', x: -24.29, z: -85.19, halfLen: 0.15, ax: 1, az: 0 });

let worst = { d: 0, what: '' };
for (const it of items) {
  // 1.45 m, not 1.1: the shelter's bench carries its cast ends 1.2 m out from
  // the seat centre, so a tighter radius found only the slats and reported
  // 425 mm of daylight under a bench whose ends reach the ground exactly.
  const base = await baseNear(it.x, it.z, 1.45);
  if (base === null) { console.log(`   ${it.what}: no mesh found, skipped`); continue; }
  for (const sgn of [1, -1]) {
    const g = await gy(it.x + it.ax * it.halfLen * sgn, it.z + it.az * it.halfLen * sgn);
    const gap = base - g;                       // + floats, - is bedded in
    if (gap > worst.d) worst = { d: gap, what: it.what };
    if (gap > 0.02) console.log(`   ${it.what}: base ${base.toFixed(3)}, floor ${g.toFixed(3)} — ${(gap * 1000).toFixed(0)} mm of daylight`);
  }
}
report('something was actually measured', items.length >= 4,
  `${items.length} things standing on the grass`);
// 20 mm is where a gap under a bench end starts to read as a gap: the slats are
// 50 mm thick. Bedded IN is not a fault — the ground hides it.
report('nothing on the grass floats above the ground it stands on', worst.d <= 0.02,
  `most daylight under anything: ${(worst.d * 1000).toFixed(0)} mm${worst.what ? ` (${worst.what})` : ''}`);

console.log(fails ? `\n${fails} FAILED` : '\nnothing on the grass is floating');
await b.close();
process.exit(fails ? 1 : 0);
