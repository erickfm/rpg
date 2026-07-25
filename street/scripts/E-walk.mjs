// Builder E: WALK the library courtyard. Screenshots prove nothing about
// movement (GOTCHAS §1/§9) — this drives the player and reports where it
// actually ended up.
//
//   1. the sacred 2 m sidewalk lane, both ways along the frontage
//   2. street -> into the courtyard -> back out
//   3. round the steps to each bench
//   4. nothing lets you through the facade, the party walls or the steps
//   5. the floor is walk level everywhere inside, and nowhere behind
//
// CITIZENS ARE SOLID, and they are seeded — so one standing in the courtyard
// mouth reproduces on every run at the same instant and reads exactly like a
// wall. Two legs of this failed that way and the geometry was fine. Every leg
// therefore RETRIES: same walk, a second later, by which time anyone standing
// in it has moved on. A leg that fails three times in a row is the world.
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
const f = (n) => n.toFixed(2);
let fails = 0;
const report = (name, ok, detail, tries) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};

/** warp somewhere, hold a key, and test where you ended up — with retries */
const walk = async (name, { at, yaw, key = 'w', ms, ok, say }) => {
  let last, tries = 0;
  for (; tries < 3; tries++) {
    if (tries) await page.waitForTimeout(1100);      // let the block clear
    await warp(at[0], at[1], yaw);
    await page.waitForTimeout(150);
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    await page.waitForTimeout(60);
    last = await pos();
    if (ok(last)) break;
  }
  report(name, ok(last), say(last), tries + 1);
  return last;
};

// 1 ── the sacred lane along the frontage, in the BUILDING-side lane. The
// streetlamp at z=-9 owns x -5.75…-5.35 and blocks out to x=-6.11, so x=-6.25
// is the lane that has to stay open the whole length of the library.
//
// It did not used to be: the payphone stood at z=-11 and blocked -7.31…-5.59,
// leaving a 0.23 m window at the kerb. Builder B has since moved it to z=-3
// and slimmed it to 0.3 m deep, so the whole frontage is now clear — that is
// what this leg checks, and it is the thing to re-run if the payphone or the
// lamps ever move again.
await walk('lane south, the whole library frontage', {
  at: [-6.25, -4.4], yaw: 0.0, ms: 6200,   // 17 m of frontage at 3.3 m/s
  ok: (p) => p[2] < -21.5,
  say: (p) => `z -4.40 -> ${f(p[2])}, x ${f(p[0])} (clear past the mouth)`,
});
await walk('lane north, the whole library frontage', {
  at: [-6.25, -22.0], yaw: Math.PI, ms: 6200,
  ok: (p) => p[2] > -4.9,
  say: (p) => `z -22.00 -> ${f(p[2])}, x ${f(p[0])}`,
});

// 2 ── in from the street on the entrance axis, and out again
const inCourt = await walk('street -> into the courtyard on the axis', {
  at: [-5.4, -13.0], yaw: -Math.PI / 2, ms: 1400,
  ok: (p) => p[0] < -7.6,
  say: (p) => `x -5.40 -> ${f(p[0])} (mouth at -7.0)`,
});
report('the steps stop you, you do not walk through them',
  inCourt[0] > -8.9, `stopped at x ${f(inCourt[0])}, bottom nosing at -8.40`, 1);
await page.keyboard.down('s'); await page.waitForTimeout(1400); await page.keyboard.up('s');
await page.waitForTimeout(60);
const out = await pos();
report('back out of the courtyard to the street', out[0] > -6.0, `x ${f(inCourt[0])} -> ${f(out[0])}`, 1);

// …and the courtyard is a way THROUGH as well as a way in: step inside the
// mouth and walk its length, which the blanket wall never allowed
await walk('walk the length of the courtyard, inside the mouth', {
  at: [-7.8, -6.4], yaw: 0.0, ms: 5000,
  ok: (p) => p[2] < -16.0,
  say: (p) => `z -6.40 -> ${f(p[2])} at x ${f(p[0])}`,
});

// 3 ── round the steps to each bench
for (const [name, z] of [['north', -8.4], ['south', -17.6]]) {
  await walk(`walk to the ${name} bench`, {
    at: [-6.4, z], yaw: -Math.PI / 2, ms: 1600,
    ok: (p) => p[0] < -8.6,
    say: (p) => `x -6.40 -> ${f(p[0])}, z ${f(p[2])}`,
  });
}

// 4 ── the walls hold
await walk('the recessed facade holds', {
  at: [-9.0, -8.0], yaw: -Math.PI / 2, ms: 1600,
  ok: (p) => p[0] > -10.0,
  say: (p) => `stopped at x ${f(p[0])}, facade at -10.20`,
});
await walk('the north party wall holds', {
  at: [-8.6, -6.6], yaw: Math.PI, ms: 1600,
  ok: (p) => p[2] < -5.3,
  say: (p) => `stopped at z ${f(p[2])}, party line at -5.00`,
});
await walk('the south party wall holds', {
  at: [-8.6, -19.4], yaw: 0.0, ms: 1600,
  ok: (p) => p[2] > -20.7,
  say: (p) => `stopped at z ${f(p[2])}, party line at -21.00`,
});

// 5 ── the floor never drops: sample the height across the whole courtyard.
// pos()[3] is the ground the RIG resolved, so each sample needs a frame.
const samples = [];
for (let x = -10.0; x <= -7.0; x += 0.4) {
  for (let z = -20.4; z <= -5.6; z += 2.0) {
    await warp(x, z, 0);
    await page.waitForTimeout(34);
    samples.push([x, z, (await pos())[3]]);
  }
}
const bad = samples.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
report('the courtyard floor is walk level everywhere', bad.length === 0,
  bad.length ? `${bad.length}/${samples.length} off: ${JSON.stringify(bad.slice(0, 4))}`
    : `${samples.length} samples all at gy 0.14`, 1);

await warp(-11.0, -13.0, 0);
await page.waitForTimeout(34);
const inside = (await pos())[3];
report('the paved floor stops at the facade', Math.abs(inside) < 0.001, `gy behind the facade = ${inside}`, 1);

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await browser.close();
process.exit(fails ? 1 : 0);
