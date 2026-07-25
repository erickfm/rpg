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
const LEG = { x0: -12.5, x1: -8.15, z0: -96.3, z1: -69.7 };
for (const [name, at, yaw, ms, ok, say] of [
  ['street leg, south to north', [LEG.x1, LEG.z0 + 0.8], Math.PI, 8400,
    (p) => p[2] > LEG.z1 - 0.9, (p) => `z ${f(p[2])} (corner at ${LEG.z1})`],
  ['north end, street to back', [LEG.x1 - 0.4, LEG.z1], -Math.PI / 2, 1800,
    (p) => p[0] < LEG.x0 + 0.9, (p) => `x ${f(p[0])} (corner at ${LEG.x0})`],
  ['back leg, north to south', [LEG.x0, LEG.z1 - 0.8], 0.0, 8400,
    (p) => p[2] < LEG.z0 + 0.9, (p) => `z ${f(p[2])} (corner at ${LEG.z0})`],
  ['south end, back to street', [LEG.x0 + 0.4, LEG.z0], Math.PI / 2, 1800,
    (p) => p[0] > LEG.x1 - 0.9, (p) => `x ${f(p[0])} (corner at ${LEG.x1})`],
]) {
  await walk(`the loop: ${name}`, { at, yaw, ms, ok, say });
}

// the floor is level all through
const s = [];
for (let x = -13.2; x <= -7.4; x += 0.6) for (let z = -96; z <= -70; z += 4) {
  await warp(x, z, 0); await page.waitForTimeout(30); s.push([x, z, (await pos())[3]]);
}
const bad = s.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
report('the park floor is walk level everywhere', bad.length === 0,
  bad.length ? `${bad.length}/${s.length} off: ${JSON.stringify(bad.slice(0, 3))}` : `${s.length} samples at gy 0.14`);
// ── the 2 m walk past the park ───────────────────────────────────────────
//
// DIAGNOSTIC, not a check on this park: it reports where the pavement is
// blocked rather than failing, because nothing here is inside the fence.
//
// D's park boundary blocks out to x = -6.28. B's street tree at z = -71.5
// owns x -5.94…-5.78, which with the player's radius blocks -6.30…-5.42.
// Those two leave nothing: the building-side lane stops dead at the tree, and
// so does the kerb-side one, because the walk itself ends at about -5.36. The
// only way south past this park is with one foot in the road — which is a §9
// finding for the desk (B's tree, D's wall), not something the park can fix.
for (const [name, x] of [['building-side', -6.2], ['kerb-side', -5.6], ['in the road', -5.1]]) {
  await warp(x, -66.0, 0.0);
  await page.waitForTimeout(150);
  await page.keyboard.down('w'); await page.waitForTimeout(11000); await page.keyboard.up('w');
  await page.waitForTimeout(60);
  const p = await pos();
  console.log(`NOTE  the ${name} lane past the park: z -66.00 -> ${f(p[2])} at x ${f(p[0])}` +
    (p[2] > -96 ? '   <-- BLOCKED' : ''));
}

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await b.close();
process.exit(fails ? 1 : 0);
