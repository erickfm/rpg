// Builder E: WALK the park. Site x -14…-7, z -98…-68; gate z -87.2…-78.8.
// Every leg retries — citizens are solid and seeded (see E-walk.mjs).
import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 20));
const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy = 0.14) => page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const f = (n) => n.toFixed(2);
// `apt.gy()` is a last-written value with more than one writer, so a single
// read can catch somebody else's frame. Sample three times and take the
// MEDIAN — the floor under a point does not change between frames, so the
// odd one out is always the lie. Max was tried first and is wrong in one
// direction: it beats a phantom 0 in a field of 0.14, and then lets a stale
// 0.55 off the step you sampled a moment ago win on the flags beside it.
const gyAt = async (x, z) => {
  const reads = [];
  for (let i = 0; i < 3; i++) {
    await warp(x, z, 0);
    await page.waitForTimeout(40);
    reads.push((await pos())[3]);
  }
  return reads.sort((a, b) => a - b)[1];
};
let fails = 0;
const report = (n, ok, d, t = 1) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}${t > 1 ? `  [${t} tries]` : ''}`); };
const walk = async (n, { at, yaw, ms, ok, say }) => {
  let last, t = 0;
  for (; t < 3; t++) {
    if (t) await page.waitForTimeout(1100);
    await warp(at[0], at[1], yaw); await page.waitForTimeout(150);
    await page.keyboard.down('w'); await page.waitForTimeout(ms); await page.keyboard.up('w');
    await page.waitForTimeout(60);
    last = await pos();
    if (ok(last)) break;
  }
  report(n, ok(last), say(last), t + 1);
  return last;
};
const W = -Math.PI / 2;
// in through the gate, and out again
const inPark = await walk('in through the gate', {
  at: [-5.6, -83.0], yaw: W, ms: 2200,
  ok: (p) => p[0] < -11.5, say: (p) => `x -5.60 -> ${f(p[0])} (back wall at -14.0, clamp at -13.4)`,
});
report('…and the clamp, not the wall, is what stops you', inPark[0] > -13.5,
  `stopped at x ${f(inPark[0])}; bounds.minX is -13.40`);
await page.keyboard.down('s'); await page.waitForTimeout(2200); await page.keyboard.up('s');
await page.waitForTimeout(60);
report('back out to the pavement', (await pos())[0] > -6.5, `x -> ${f((await pos())[0])}`);
// the fence holds either side of the gate
for (const [n, z] of [['north of the gate', -75.0], ['south of the gate', -92.0]]) {
  await walk(`the boundary holds ${n}`, {
    at: [-5.7, z], yaw: W, ms: 1400,
    ok: (p) => p[0] < -6.1 && p[0] > -6.5,
    say: (p) => `stopped at x ${f(p[0])}; the wall face is -6.64, so -6.28 is the capsule against it`,
  });
}
// THE LOOP. Each leg is walked from its own corner to the next one, which is
// what proves the circuit is clear — a single timed lap just tells you how
// fast you were going. Legs: street x=-8.15, back x=-12.5, ends z=-96.3/-69.7.
// THE WHOLE CIRCUIT. F moved bounds.minX to -40, so the loop closes on foot
// for the first time — 27 m legs, not 6 m of them. Each leg is walked from
// its own corner to the next, which is what proves the circuit rather than
// how fast you were going.
const LEG = { x0: -35.8, x1: -8.60, z0: -96.3, z1: -69.7 };
for (const [name, at, yaw, ms, ok, say] of [
  ['street leg, south to north', [LEG.x1, LEG.z0 + 0.8], Math.PI, 8400,
    (p) => p[2] > LEG.z1 - 0.9, (p) => `z ${f(p[2])} (corner at ${LEG.z1})`],
  ['north end, street to back', [LEG.x1 - 0.4, LEG.z1], -Math.PI / 2, 9500,
    (p) => p[0] < LEG.x0 + 1.0, (p) => `x ${f(p[0])} (corner at ${LEG.x0})`],
  ['back leg, north to south', [LEG.x0, LEG.z1 - 0.8], 0.0, 8600,
    (p) => p[2] < LEG.z0 + 1.0, (p) => `z ${f(p[2])} (corner at ${LEG.z0})`],
  ['south end, back to street', [LEG.x0 + 0.4, LEG.z0], Math.PI / 2, 9500,
    (p) => p[0] > LEG.x1 - 1.0, (p) => `x ${f(p[0])} (corner at ${LEG.x1})`],
]) {
  await walk(`the loop: ${name}`, { at, yaw, ms, ok, say });
}


// the floor is level all through
const s = [];
for (let x = -38.0; x <= -7.4; x += 2.2) for (let z = -96; z <= -70; z += 4) {
  s.push([x, z, await gyAt(x, z)]);
}
const bad = s.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
report('the park floor is walk level everywhere', bad.length === 0,
  bad.length ? `${bad.length}/${s.length} off: ${JSON.stringify(bad.slice(0, 3))}` : `${s.length} samples at gy 0.14`);
// ── the edge line ────────────────────────────────────────────────────────
//
// The user's standing rule: nothing the park owns may stand on the pavement.
// This is that rule as a test — every collider inside the park's z-span is
// checked against the line at x = -7.00. The only thing allowed across it is
// ct/street.ts's boundary wall, which IS the boundary and carries the
// railings (x -7.00…-6.64).
const over = await page.evaluate(() => window.__ct.colliders()
  // straddling the line, on the west side. ct/street.ts's boundary wall
  // starts exactly ON the line (minX = -7.00) so it is excluded by <.
  .filter((c) => c.minZ >= -98.5 && c.maxZ <= -67.5 && c.minX > -20 && c.minX < -7.0 && c.maxX > -7.0)
  .map((c) => [+c.minX.toFixed(2), +c.maxX.toFixed(2), +c.minZ.toFixed(2), +c.maxZ.toFixed(2)]));
report('nothing the park owns stands on the pavement', over.length === 0,
  over.length ? `${over.length} over the line: ${JSON.stringify(over)}` : 'every park collider is west of x = -7.00');

// ── the full frontage, walked ────────────────────────────────────────────
//
// Not eyeballed: the capsule goes the whole 30 m in the building-side lane
// and the position is read every step, so a squeeze shows up as a stall
// rather than as something that looked fine in a screenshot.
await warp(-6.2, -66.0, 0.0);
await page.waitForTimeout(150);
// a stall is only real if it survives a pause — citizens are solid and they
// walk on (E-walk.mjs learned this the hard way)
let stall = null, lastZ = -66.0, patience = 0;
for (let i = 0; i < 40; i++) {
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  await page.waitForTimeout(40);
  const p = await pos();
  if (p[2] < -98.5) { lastZ = p[2]; break; }
  if (Math.abs(p[2] - lastZ) < 0.05) {
    if (++patience >= 3) { stall = p; break; }
    await page.waitForTimeout(1300);
  } else patience = 0;
  lastZ = p[2];
}
report('the full 30 m frontage walks without a squeeze', !stall,
  stall ? `stalled at z ${f(stall[2])}, x ${f(stall[0])}` : `walked z -66.00 -> ${f(lastZ)} in the building-side lane`);

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await b.close();
process.exit(fails ? 1 : 0);
