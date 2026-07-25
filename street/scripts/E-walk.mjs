// Builder E: WALK the library courtyard. Screenshots prove nothing about
// movement (GOTCHAS §1/§9) — this drives the player and reports where it
// actually ended up.
//
//   1. the sacred 2 m sidewalk lane, north to south past the courtyard mouth
//   2. street -> into the courtyard -> back out
//   3. the flank tests: can you get round the steps to each bench
//   4. nothing lets you through the facade, the party walls or the steps
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 20));

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy = 0.14) => page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (key, ms) => {
  await page.keyboard.down(key); await page.waitForTimeout(ms);
  await page.keyboard.up(key); await page.waitForTimeout(60);
};
const f = (n) => n.toFixed(2);
let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

// 1 ── the sacred lane along the frontage, in the BUILDING-side lane. The
// streetlamp at z=-9 owns x -5.75…-5.35 and blocks out to x=-6.11, so
// x=-6.25 is the lane that has to stay open. It is open for the whole
// frontage EXCEPT at the payphone, which reaches x=-5.95 and blocks
// -7.31…-5.59 — pre-existing, not the courtyard's doing, and the reason
// this build asks the desk to move it (see the handoff).
const PHONE_N = -10.09;   // payphone maxZ (-10.45) + player RADIUS
await warp(-6.25, -5.6, 0.0);
await page.waitForTimeout(150);
let a = await pos();
await hold('w', 1800);
let b = await pos();
check('lane south along the frontage, as far as the payphone',
  Math.abs(b[2] - PHONE_N) < 0.15,
  `z ${f(a[2])} -> ${f(b[2])}, expected to stop at the payphone ${f(PHONE_N)}`);

await warp(-6.25, -12.2, 0.0);   // south of the payphone, on down the frontage
await page.waitForTimeout(150);
a = await pos();
await hold('w', 3200);
b = await pos();
check('lane south, payphone to the end of the frontage',
  b[2] < -21.5, `z ${f(a[2])} -> ${f(b[2])}, x ${f(b[0])}`);

await warp(-6.25, -22.0, Math.PI); // and back north up the same lane
await page.waitForTimeout(150);
a = await pos();
await hold('w', 3200);
b = await pos();
check('lane north, end of the frontage back to the payphone',
  b[2] > -12.0, `z ${f(a[2])} -> ${f(b[2])}, x ${f(b[0])}`);

// …and the courtyard now provides the way PAST the payphone that the solid
// wall never did: step in, walk south inside the mouth, step back out.
await warp(-7.8, -8.6, 0.0);
await page.waitForTimeout(150);
a = await pos();
await hold('w', 1600);
b = await pos();
check('detour through the courtyard mouth, past the payphone',
  b[2] < -12.0, `z ${f(a[2])} -> ${f(b[2])} inside the mouth at x ${f(b[0])}`);

// 2 ── in from the street on the entrance axis, and out again
await warp(-5.4, -13.0, -Math.PI / 2);
await page.waitForTimeout(150);
a = await pos();
await hold('w', 1400);
b = await pos();
check('street -> into the courtyard on the axis',
  b[0] < -7.6, `x ${f(a[0])} -> ${f(b[0])} (mouth at -7.0)`);
check('the steps stop you, you do not walk through them',
  b[0] > -8.9, `stopped at x ${f(b[0])}, bottom nosing at -8.40`);
await hold('s', 1400);
let c = await pos();
check('back out of the courtyard to the street', c[0] > -6.0, `x ${f(b[0])} -> ${f(c[0])}`);

// 3 ── round the steps to each bench
for (const [name, z, keys] of [['north', -8.4, 'north'], ['south', -17.6, 'south']]) {
  await warp(-6.4, z, -Math.PI / 2);
  await page.waitForTimeout(150);
  a = await pos();
  await hold('w', 1600);
  b = await pos();
  check(`walk to the ${name} bench`, b[0] < -8.6, `x ${f(a[0])} -> ${f(b[0])}, z ${f(b[2])}`);
}

// 4 ── the walls hold. Push west at the facade, and push at both party lines.
await warp(-9.0, -8.0, -Math.PI / 2);
await page.waitForTimeout(150);
await hold('w', 1600);
b = await pos();
check('the recessed facade holds', b[0] > -10.0, `stopped at x ${f(b[0])}, facade at -10.20`);

await warp(-8.6, -6.6, Math.PI); // north, toward MERIDIAN's party wall (z = -5)
await page.waitForTimeout(150);
await hold('w', 1600);
b = await pos();
check('the north party wall holds', b[2] < -5.3, `stopped at z ${f(b[2])}, party line at -5.00`);

await warp(-8.6, -19.4, 0.0); // south, toward BURGER BARN's party wall (z = -21)
await page.waitForTimeout(150);
await hold('w', 1600);
b = await pos();
check('the south party wall holds', b[2] > -20.7, `stopped at z ${f(b[2])}, party line at -21.00`);

// 5 ── the floor never drops: sample the height across the whole courtyard.
// pos()[3] is the ground the RIG resolved, so each sample needs a frame.
const samples = [];
for (let x = -10.0; x <= -7.0; x += 0.4) {
  for (let z = -20.4; z <= -5.6; z += 2.0) {
    await warp(x, z, 0);
    await page.waitForTimeout(34);
    const q = await pos();
    samples.push([x, z, q[3]]);
  }
}
const bad = samples.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
check('the courtyard floor is walk level everywhere',
  bad.length === 0,
  bad.length ? `${bad.length}/${samples.length} off: ${JSON.stringify(bad.slice(0, 4))}`
    : `${samples.length} samples all at gy 0.14`);

// …and that it does NOT leak past the facade into the building
await warp(-11.0, -13.0, 0);
await page.waitForTimeout(34);
const inside = (await pos())[3];
check('the paved floor stops at the facade', Math.abs(inside) < 0.001, `gy behind the facade = ${inside}`);

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await browser.close();
process.exit(fails ? 1 : 0);
