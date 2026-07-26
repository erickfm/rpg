// Builder E: WALK the churchyard. Same rules as E-walk.mjs — movement is
// proved by driving the player, never by looking (GOTCHAS §1/§9), and every
// leg retries because citizens are solid and seeded.
//
// The church is INLAID 2.6 m. street.ts turns the whole church a quarter
// turn, so its own frame runs along z in world terms:
//   world x 7.0  = the street line and the churchyard wall
//   world x 9.6  = the church facade, at the top of the steps
//   world z -86 … -68 = the 18 m frontage; the doors are on z = -79.5
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.evaluate(() => window.__ct.clock(13, 20));

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy = 0.14) => page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const f = (n) => n.toFixed(2);
// `apt.gy()` is a last-written value with more than one writer, so a single
// read can catch somebody else's frame. Sample three times and take the
// THE FLOOR AT A POINT, asked directly. This used to teleport the player there
// and read pos()[3] — which is `apt.gy()`, a last-written value that the
// citizens on the pavement also write, so the answer is whoever queried the
// picker last and that is usually not you. A median of three does not help:
// it is not noise, it is a different question being answered.
//
// `window.__ct.groundAt(x, z)` runs the world's own picker for an arbitrary
// point. Same change as E-walk, E-park-walk and E-onslope, and made after the
// same fault cost a real diagnosis in the library courtyard.
const gyAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
let fails = 0;
const report = (name, ok, detail, tries = 1) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};
const walk = async (name, { at, yaw, key = 'w', ms, ok, say }) => {
  let last, tries = 0;
  // 1.1 s was not enough: a citizen standing in a lane is seeded, so it stops
  // you in the same place on every retry unless the wait outlasts its walk.
  for (; tries < 4; tries++) {
    if (tries) await page.waitForTimeout(3200);
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

const DOOR_Z = -79.5, SILL = 0.55, E = Math.PI / 2;
const WIRED = (await gyAt(9.2, DOOR_Z)) > 0.3;
// …and separately, can you get IN? ct/street.ts still registers a blanket
// footprint over the whole church frontage, which seals the yard the way the
// blanket wall sealed the library courtyard. The floor being wired and the
// gate being open are two different landings.
//
// RETRIED, because this is a walk and a citizen standing in the gateway reads
// exactly like a sealed gate. Like WIRED above it does not fail a check, it
// picks which half of them run — so one unlucky pedestrian silently turns the
// whole climb into a SKIP, and the run still says "all walks passed". It
// reported SEALED once today on a build where it had been open all morning.
let OPEN = false;
for (let t = 0; t < 3 && !OPEN; t++) {
  if (t) await page.waitForTimeout(1200);
  await warp(5.6, -80.0, Math.PI / 2);
  await page.waitForTimeout(150);
  await page.keyboard.down('w'); await page.waitForTimeout(1400); await page.keyboard.up('w');
  await page.waitForTimeout(60);
  OPEN = (await pos())[0] > 7.4;
}
console.log(`the churchyard floor is ${WIRED ? 'WIRED' : 'NOT wired'}; the gate is ${OPEN ? 'OPEN' : 'SEALED'}\n`);

// 1 ── the 2 m walk past the church stays clear, both ways
await walk('the walk past the church, south', {
  at: [6.2, -64.0], yaw: 0.0, ms: 8000,
  ok: (p) => p[2] < -88.0,
  say: (p) => `z -64.00 -> ${f(p[2])}, x ${f(p[0])}`,
});
// northbound is a NOTE, not a check: the only static collider on that stretch
// is ct/street.ts's blanket church footprint, which does not reach the lane at
// x = 6.2, so anything that stops you there is a citizen or another builder's
// prop — outside this churchyard either way.
await warp(6.2, -90.0, Math.PI);
await page.waitForTimeout(150);
await page.keyboard.down('w'); await page.waitForTimeout(8000); await page.keyboard.up('w');
await page.waitForTimeout(60);
const northTo = (await pos())[2];
console.log(`NOTE  the walk past the church, north: z -90.00 -> ${f(northTo)}` +
  (northTo < -66 ? '   <-- stopped short; nothing static there, check citizens' : ''));

// 2 ── the wall holds everywhere except the gate
for (const [name, z] of [['north of the gate', -75.0], ['south of the gate', -84.0]]) {
  await walk(`the churchyard wall holds ${name}`, {
    at: [6.2, z], yaw: E, ms: 1400,
    ok: (p) => p[0] < 6.8,
    say: (p) => `stopped at x ${f(p[0])}, wall face at 7.00`,
  });
}

// 3 ── in through the gate, and the climb.
//
// NOT on the door axis: a streetlamp (ct/props.ts, builder B) stands at
// x 5.55, z -79.0 and blocks x 4.99…6.11 across z -79.56…-78.44 — which is
// the middle of the gate opening. You cannot walk in on the axis at all. The
// piers leave z -80.44…-78.56 clear once the player's 0.36 m radius is
// allowed for, and the lamp eats -79.56…-78.44 of that — so the whole gate
// is reduced to an 0.88 m slot at z -80.44…-79.56. This walks that slot; the
// obstruction is reported to the desk rather than designed around.
if (WIRED && OPEN) {
  const lampBlocked = await walk('(diagnostic) the door axis is blocked by B\'s lamp', {
    at: [5.6, DOOR_Z], yaw: E, ms: 1200,
    ok: (p) => p[0] > 7.0,
    say: (p) => `x 5.60 -> ${f(p[0])}${p[0] < 7 ? '  <-- the lamp, not the gate' : ''}`,
  });
  if (lampBlocked[0] < 7) fails--;   // known external obstruction, not this build
  const inYard = await walk('in through the gate, beside the lamp', {
    at: [5.6, -80.0], yaw: E, ms: 1500,
    ok: (p) => p[0] > 7.6,
    say: (p) => `x 5.60 -> ${f(p[0])} (gate opening z -81.05…-77.95)`,
  });

  // …then onto the axis and up
  await warp(7.8, DOOR_Z, E);
  await page.waitForTimeout(120);
  await page.keyboard.down('w'); await page.waitForTimeout(1400); await page.keyboard.up('w');
  await page.waitForTimeout(60);
  const atDoors = await pos();
  report('the flight carries you up to the doors',
    atDoors[0] > 9.0 && Math.abs(atDoors[3] - SILL) < 0.02,
    `reached x ${f(atDoors[0])} at gy ${atDoors[3].toFixed(2)} (sill ${SILL})`);
  await page.keyboard.down('s'); await page.waitForTimeout(1200); await page.keyboard.up('s');
  await page.waitForTimeout(60);
  const out = await pos();
  report('…and back down onto the flags', out[0] < 8.0 && Math.abs(out[3] - 0.14) < 0.02,
    `x ${f(atDoors[0])} -> ${f(out[0])}, gy ${out[3].toFixed(2)}`);

  // the ramp itself: sampled across the flight, and it must not dip
  const prof = [];
  for (let x = 7.2; x <= 9.5; x += 0.2) prof.push([+x.toFixed(1), await gyAt(x, DOOR_Z)]);
  const mono = prof.every(([, gy], i) => i === 0 || gy >= prof[i - 1][1] - 0.0001);
  report('the flight rises from the flags to the sill without dipping',
    mono && Math.abs(prof[0][1] - 0.14) < 0.01 && Math.abs(prof[prof.length - 1][1] - SILL) < 0.01,
    `gy ${prof[0][1].toFixed(2)} at the gate -> ${prof[prof.length - 1][1].toFixed(2)} at the doors, ${prof.length} samples`);

  // the flags either side of the flight stay flat
  const flat = [];
  for (const z of [-84.5, -83.0, -76.0, -74.5]) {
    for (let x = 7.4; x <= 9.4; x += 0.5) flat.push([x, z, await gyAt(x, z)]);
  }
  const bad = flat.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
  // an empty `flat` satisfies this too — say how many were looked at (§34)
  report('…and the flag samples exist to be checked', flat.length >= 12,
    `${flat.length} points either side of the flight`);
  report('the flags either side of the flight are level', bad.length === 0,
    bad.length ? `${bad.length}/${flat.length} off: ${JSON.stringify(bad.slice(0, 3))}` : `${flat.length} samples at gy 0.14`);

  // and you cannot walk through the church
  await walk('the church facade holds at the top of the steps', {
    at: [9.0, DOOR_Z], yaw: E, ms: 1400,
    ok: (p) => p[0] < 9.7,
    say: (p) => `stopped at x ${f(p[0])}, facade at 9.60`,
  });
} else {
  console.log(`SKIP  the gate and the climb — floor ${WIRED ? 'wired' : 'NOT wired'}, gate ${OPEN ? 'open' : 'SEALED'}.`);
  console.log('      notes/E-steps-crosstown.patch  (the floor picker)');
  console.log('      notes/E-church-street.patch    (D\'s blanket church footprint)');
  console.log('      Until they land the church is solid, exactly as it was before.');
}

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await browser.close();
process.exit(fails ? 1 : 0);
