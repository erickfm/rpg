// Builder E: WALK the library courtyard. Screenshots prove nothing about
// movement (GOTCHAS §1/§9) — this drives the player and reports where it
// actually ended up.
//
//   1. the sacred 2 m sidewalk lane, both ways along the frontage
//   2. street -> into the courtyard -> back out
//   3. round the steps to each bench
//   4. nothing lets you through the facade, the party walls or the steps
//   5. the floor is walk level off the flight, and the flight is a ramp
//   6. you can WALK UP the steps to the doors, and back down
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
// `apt.gy()` is a last-written value with more than one writer, so a single
// read can catch somebody else's frame — it shows up as an occasional 0 in a
// field of 0.14. Sample it three times and take the mode-ish max; the floor
// under a given point does not change between frames.
const gyAt = async (x, z) => {
  let best = -1;
  for (let i = 0; i < 3; i++) {
    await warp(x, z, 0);
    await page.waitForTimeout(40);
    best = Math.max(best, (await pos())[3]);
  }
  return best;
};
let fails = 0;
const report = (name, ok, detail, tries) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};

/** warp somewhere, hold a key, and test where you ended up — with retries */
const walk = async (name, { at, yaw, key = 'w', ms, ok, say }) => {
  let last, tries = 0;
  // 1.1 s was not enough: a citizen standing in a lane is seeded, so it stops
  // you in the same place on every retry unless the wait outlasts its walk.
  for (; tries < 4; tries++) {
    if (tries) await page.waitForTimeout(3200);      // let the block clear
    await warp(at[0], at[1], yaw);
    await page.waitForTimeout(150);
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    await page.waitForTimeout(60);
    last = await pos();
    if (ok(last)) break;
  }
  // A lane check that just says "blocked" sends you looking with a torch. On
  // a real failure, say what is actually there — and if the answer is
  // nothing, it was a citizen and the retries were unlucky.
  if (!ok(last)) {
    const near = await page.evaluate(([x, z]) => window.__ct.colliders()
      .filter((c) => x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8)
      .map((c) => `x ${c.minX.toFixed(2)}…${c.maxX.toFixed(2)} z ${c.minZ.toFixed(2)}…${c.maxZ.toFixed(2)}`),
      [last[0], last[2]]);
    report(name, false, say(last), tries + 1);
    console.log(near.length ? `      what is there: ${near.join(' | ')}`
      : '      nothing static within 0.8 m — a citizen was standing in it');
    return last;
  }
  report(name, true, say(last), tries + 1);
  return last;
};

// Is the entry point asking ct/civic.ts for the courtyard floor? The steps
// only open when it is (see COURT.climbable), so probe the landing: 0.99 means
// wired, 0.14 means the flight is still one solid block.
await warp(-11.0, -13.0, 0);
await page.waitForTimeout(60);
const CLIMBABLE = (await pos())[3] > 0.5;
console.log(`the steps are ${CLIMBABLE ? 'WIRED — climb tests run' : 'NOT wired — climb tests skipped'}\n`);

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
// walking the axis used to END at the steps — they were one solid block. It
// now carries you straight onto them, which is the whole point of the item.
if (CLIMBABLE) {
  report('the axis carries you onto the flight, not into a wall',
    inCourt[0] < -8.4 && inCourt[3] > 0.14,
    `reached x ${f(inCourt[0])} at gy ${inCourt[3].toFixed(2)} (bottom nosing -8.40)`, 1);
} else {
  report('the flight is solid, as it is until the picker is wired',
    inCourt[0] > -8.9 && Math.abs(inCourt[3] - 0.14) < 0.01,
    `stopped at x ${f(inCourt[0])}, bottom nosing at -8.40`, 1);
}
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

// 5 ── the floor. Flat at walk level everywhere EXCEPT the flight, which is
// a ramp from the paving up to the threshold 0.85 m above it.
const CZ = -13.0, FLIGHT_HALF = 2.05, XBOT = -8.4, XF = -10.2, TOP = 0.99;
const samples = [];
for (let x = -10.0; x <= -7.0; x += 0.4) {
  for (let z = -20.4; z <= -5.6; z += 2.0) {
    samples.push([x, z, await gyAt(x, z)]);
  }
}
const flat = samples.filter(([, z]) => Math.abs(z - CZ) > FLIGHT_HALF);
const bad = flat.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
report('the courtyard floor is walk level off the flight', bad.length === 0,
  bad.length ? `${bad.length}/${flat.length} off: ${JSON.stringify(bad.slice(0, 4))}`
    : `${flat.length} samples all at gy 0.14`, 1);

await warp(-11.0, -13.0, 0);
await page.waitForTimeout(34);
const inside = (await pos())[3];
report(CLIMBABLE ? 'the floor carries on up to the doors' : 'the floor stops at the facade',
  Math.abs(inside - (CLIMBABLE ? TOP : 0)) < 0.001,
  `gy on the landing = ${inside}${CLIMBABLE ? ` (threshold ${TOP})` : ' (flight still solid)'}`, 1);


// 6 ── THE CLIMB. Skipped unless the entry point is wired: ct/civic.ts keeps
// the flight solid until then on purpose (COURT.climbable), so these would be
// testing a state that does not exist rather than a bug.
if (!CLIMBABLE) {
  console.log('\nSKIP  the climb — the entry point is not asking courtGround yet.');
  console.log('      apply notes/E-steps-crosstown.patch and re-run.');
  console.log(fails ? `\n${fails} FAILED` : '\nall walks passed (climb skipped)');
  await browser.close();
  process.exit(fails ? 1 : 0);
}

// 6 ── THE CLIMB. The whole point of the item: the steps are drawn, so they
// have to be walkable. Height comes from the picker (GOTCHAS §7), so this
// walks the flight and watches the ground rise, then walks back down.
const profile = [];
for (let x = -7.6; x >= -11.4; x -= 0.2) {
  await warp(x, CZ, 0);
  await page.waitForTimeout(34);
  profile.push([+x.toFixed(1), (await pos())[3]]);
}
const atPaving = profile.find(([x]) => x === -7.8)[1];
const atLanding = profile.find(([x]) => x === -11.0)[1];
const monotone = profile.every(([, gy], i) => i === 0 || gy >= profile[i - 1][1] - 0.0001);
report('the flight rises from the paving to the threshold',
  Math.abs(atPaving - 0.14) < 0.01 && Math.abs(atLanding - TOP) < 0.01,
  `gy ${atPaving.toFixed(2)} at the foot -> ${atLanding.toFixed(2)} on the landing`, 1);
report('…and it never dips on the way up', monotone,
  monotone ? `${profile.length} samples, all non-decreasing` : JSON.stringify(profile), 1);

// and actually WALK it, rather than sampling it
const climbed = await walk('walk UP the steps to the doors', {
  at: [-7.6, CZ], yaw: -Math.PI / 2, ms: 1800,
  ok: (p) => p[0] < -11.3 && p[3] > TOP - 0.02,
  say: (p) => `x -7.60 -> ${f(p[0])}, standing at gy ${p[3].toFixed(2)}`,
});
await page.keyboard.down('s'); await page.waitForTimeout(1800); await page.keyboard.up('s');
await page.waitForTimeout(60);
const down = await pos();
report('…and back down into the courtyard', down[0] > -8.2 && Math.abs(down[3] - 0.14) < 0.01,
  `x ${f(climbed[0])} -> ${f(down[0])}, gy ${down[3].toFixed(2)}`, 1);

// the cheek walls still hold you on the flight
await walk('the cheek walls hold you on the steps', {
  at: [-9.3, CZ], yaw: Math.PI, ms: 1200,
  ok: (p) => p[2] < CZ + 2.1,
  say: (p) => `pushed north to z ${f(p[2])}, cheek inner face at ${(CZ + 2.08).toFixed(2)}`,
});

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await browser.close();
process.exit(fails ? 1 : 0);
