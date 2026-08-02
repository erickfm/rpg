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
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

// --selftest: rig the crowded lane leg to fail WITH NOTHING STATIC UNDER IT,
// and require the run to downgrade it to a NOTE rather than a red.
//
// Both halves are rigged, and the first attempt rigged only one. Forcing `ok`
// to false makes the walk run its full 6.2 s instead of stopping at z -21.5, so
// the player ends up 3 m further south — inside the next building's footprint,
// where a static collider legitimately is. The downgrade correctly did NOT fire
// and the selftest read BROKEN for the code being right. What this branch
// decides is "no static blocker ⇒ it was traffic", so the collider query is
// rigged empty too, and the test is of the DECISION rather than of the physics
// that feeds it.
//
// The downgrade is the branch that decides whether §9 — the standing rule about
// the sacred lane — is believed when it fires. A branch nobody has watched run
// is one you argue with at the worst moment, and this one only executes when
// the pavement happens to be busy, so it could sit wrong for weeks.
//
// Flags are REJECTED rather than ignored (GOTCHAS §34, shape one): a mistyped
// --selftest that silently ran the ordinary suite would report a pass for a
// selftest that never happened.
const SCRIPT = 'E-walk';
const KNOWN_FLAGS = ['--selftest'];
for (const a of process.argv.slice(2)) {
  if (KNOWN_FLAGS.includes(a)) continue;
  console.error(`${SCRIPT}: unknown flag ${JSON.stringify(a)}`);
  console.error(`  flags are: ${KNOWN_FLAGS.join(' ')}`);
  console.error('  refusing to exit 0 having checked nothing.');
  process.exit(2);
}
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) console.log('selftest: the south lane leg is rigged to fail; it MUST come back a NOTE\n');


const URL = aim('http://localhost:4182/');
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
// ASK THE PICKER, do not teleport and read `pos()[3]`.
//
// `pos()[3]` is `apt.gy()` — a last-written value with more than one writer,
// and the citizens query it too. So the number you get back is whoever asked
// last, which is usually not you. Sampling three times and taking the median
// does not save you: it is not noise, it is a different question being
// answered, and the wrong answer is stable.
//
// `probeLanding` on line 177 was fixed to use `groundAt` when this bit me
// before. THE FLOOR GRID BELOW WAS NOT, and it is the half that reports a
// coordinate list, so its wrong numbers look like evidence. Measured today it
// claimed the courtyard floor sat at 0.99 at (-10.0, -8.4) and (-9.6, -10.4);
// the picker says 0.00 and 0.14 at those points. 0.99 is the LANDING height —
// the value left behind by the previous sample up on the flight.
//
// It reported four points as a broken floor, in a courtyard whose floor is
// fine. GOTCHAS 7 says the floor comes from a picker; this is what it costs to
// read it from anywhere else.
const gyAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
let fails = 0, downgraded = 0;
const report = (name, ok, detail, tries) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};

/** warp somewhere, hold a key, and test where you ended up — with retries */
const walk = async (name, { at, yaw, key = 'w', ms, ok, say, crowded = false }) => {
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
    // WHAT IS IN FRONT OF ME, not what is near me.
    //
    // This asked for colliders within 0.8 m of where I stopped, in every
    // direction, and one match was enough to turn a citizen-block into a hard
    // FAIL. On a walk whose whole point is to travel ALONG a building, the
    // building is always within 0.8 m — so the downgrade this file argues for
    // at length could be defeated by the very wall the lane runs beside.
    //
    // It is my standing failure mode again, and the fourth time today: I
    // filtered on a property that is not stable for the thing I am looking
    // for. "Near where I stopped" does not mean "stopped me". The wall on my
    // left is near me for all 17 m and never touches me.
    //
    // Measured on the library frontage, which is what sent me here: the walk
    // stops at a DIFFERENT z every run (-9.35, -11.02, -11.82, -11.99, -12.98,
    // -14.63) and no collider overlaps the lane rectangle at all. Nothing
    // static is in it. `colliders()` is a stable 494 and the lane is clear —
    // the sacred 2 m holds, and every one of those reds was a pedestrian.
    //
    // So sweep the CORRIDOR AHEAD: from the stop point, forward along the
    // direction of travel, one player-width wide. A collider there is a thing
    // that stopped you. A collider beside or behind you is scenery.
    // …AND IT HAS TO BE STATIC, WHICH colliders() DOES NOT TELL YOU.
    //
    // `__ct.colliders()` publishes the CITIZENS as well as the geometry. That
    // is the fact this whole branch turns on and it was never true: the
    // downgrade asks "is a static collider in the way", using a list where a
    // pedestrian standing in the lane looks exactly like a bollard.
    //
    // How I know, rather than how I assume. The library frontage leg failed on
    // a 0.5 x 0.5 m box at z -13.84…-13.34 in one run and z -13.81…-13.31 in
    // the next. THREE CENTIMETRES. Static geometry is bit-identical between
    // runs of a seeded world; a person is not. It was walking, slowly.
    //
    // So separate them by the only property that actually distinguishes them:
    // a static collider does not move. Snapshot twice, half a second apart, and
    // keep the boxes that are in both AT THE SAME COORDINATES. Anything that
    // moved, appeared or vanished is alive, and a live thing in your way is
    // traffic rather than a squeeze in the lane.
    const snap = () => page.evaluate(() => window.__ct.colliders()
      .map((c) => `${c.minX.toFixed(3)},${c.maxX.toFixed(3)},${c.minZ.toFixed(3)},${c.maxZ.toFixed(3)}`));
    const near = SELFTEST ? [] : await (async () => {
      // THREE samples over ~1.8 s, not two over 0.5 s. A walking citizen is
      // gone from its box in half a second, but a PAUSED one is not, and this
      // leg went NOTE / FAIL / NOTE on identical geometry until the window
      // outlasted the pause. Residual limit, stated rather than hidden: a
      // citizen standing still for the whole window still reads as static.
      const a = await snap();
      await page.waitForTimeout(900);
      const b = new Set(await snap());
      await page.waitForTimeout(900);
      const c2 = new Set(await snap());
      const stat = a.filter((k) => b.has(k) && c2.has(k)).map((k) => k.split(',').map(Number));
      const dx = Math.sin(yaw), dz = -Math.cos(yaw);   // the PLAYER travels (sin t, -cos t)
      const L = 1.6, R = 0.5;                          // 1.6 m ahead, half a player wide
      const [x, z] = [last[0], last[2]];
      const box = {
        minX: Math.min(x, x + dx * L) - R, maxX: Math.max(x, x + dx * L) + R,
        minZ: Math.min(z, z + dz * L) - R, maxZ: Math.max(z, z + dz * L) + R,
      };
      return stat
        .filter(([aX, bX, aZ, bZ]) => aX < box.maxX && bX > box.minX && aZ < box.maxZ && bZ > box.minZ)
        // print the SIZE too: a citizen is exactly 0.50 x 0.50 (crowd.ts:167),
        // so anything that shape in the corridor is a person who stood still
        // rather than a squeeze in the lane.
        .map(([aX, bX, aZ, bZ]) => `x ${aX.toFixed(2)}…${bX.toFixed(2)} z ${aZ.toFixed(2)}…${bZ.toFixed(2)}`
          + ` (${(bX - aX).toFixed(2)}x${(bZ - aZ).toFixed(2)}${(bX - aX).toFixed(2) === '0.50' && (bZ - aZ).toFixed(2) === '0.50' ? ' — CITIZEN-SIZED' : ''})`);
    })();
    // A CITIZEN IS NOT A FAILURE OF THE WORLD, on the walks that say so.
    //
    // The lane legs drive 17 m along the busiest pavement on the block, and one
    // went red in a full E-verify run today after five blocked attempts, then
    // passed on the third try a minute later. Nothing static was there either
    // time. This check is §9, the standing rule about the sacred lane, and it
    // is the one that most needs to be believed when it does go red — a check
    // that cries wolf on the lane is how the next real squeeze gets waved
    // through.
    //
    // Opt-in per walk, not blanket: `crowded` marks the legs whose only
    // plausible non-static blocker is traffic. Everywhere else, stopping short
    // with nothing static nearby still fails, because there the cause might be
    // a floor that drops away rather than somebody standing in the road.
    if (crowded && !near.length) {
      console.log(`NOTE  ${name}  ${say(last)}  [${tries + 1} tries]`);
      console.log('      nothing static in the corridor ahead — the pavement was busy, not blocked');
      downgraded++;
      return last;
    }
    report(name, false, say(last), tries + 1);
    console.log(near.length ? `      what is in front of you: ${near.join(' | ')}`
      : '      nothing static in the corridor ahead — a citizen was standing in it');
    return last;
  }
  report(name, true, say(last), tries + 1);
  return last;
};

// Is the entry point asking ct/civic.ts for the courtyard floor? The steps
// only open when it is (see COURT.climbable), so probe the landing: 0.99 means
// wired, 0.14 means the flight is still one solid block.
//
// Asked directly through `groundAt`, not by teleporting there and reading
// `pos()[3]` — see the note in E-park-walk.mjs. This ONE reading picks which
// SET of checks runs, and reading it off a shared last-written value put the
// whole harness into asserting a world that has not existed for hours.
const probeLanding = () => page.evaluate(() => window.__ct.groundAt(-11.0, -13.0));
const CLIMBABLE = (await probeLanding()) > 0.5;
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
//
// A FAILURE HERE IS ONLY REAL IF SOMETHING STATIC CAUSED IT. This is the most
// important check in the file — §9, the lane the user made a standing rule —
// and it is also the one most exposed to traffic, because it drives 17 m along
// the busiest pavement on the block. It went red in a full E-verify run today
// after five blocked attempts and passed on the third try a minute later: the
// pavement was simply busy. A check that cries wolf on the sacred lane is how
// the next real squeeze gets waved through.
//
// So on failure it asks the world whether any static collider actually reaches
// into the lane, and downgrades to a NOTE if none does — the same distinction
// E-yard-walk draws on the walk past the church. A collider IS a red; a
// pedestrian is a note that says the pavement was busy.
await walk('lane south, the whole library frontage', {
  at: [-6.25, -4.4], yaw: 0.0, ms: 6200,   // 17 m of frontage at 3.3 m/s
  ok: (p) => (SELFTEST ? false : p[2] < -21.5), crowded: true,
  say: (p) => `z -4.40 -> ${f(p[2])}, x ${f(p[0])} (clear past the mouth)`,
});
await walk('lane north, the whole library frontage', {
  at: [-6.25, -22.0], yaw: Math.PI, ms: 6200,
  ok: (p) => p[2] > -4.9, crowded: true,
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
// CROWDED, and on the same evidence as the lane legs rather than to quiet a
// red: this leg reached z -19.68 in one run today and stopped at -15.31 in
// another, on identical geometry. This file's own header names the courtyard
// mouth as the place a citizen stands and reads exactly like a wall.
//
// The downgrade cannot hide a real squeeze — it only fires when nothing STATIC
// (snapshot-stable) sits in the corridor ahead, so a bollard or a mis-set
// footprint still goes red here.
await walk('walk the length of the courtyard, inside the mouth', {
  crowded: true,
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
// `bad.length === 0` is also true of an empty `flat`. It is filtered by the
// flight's own half-width, so a wider flight would empty it and this would read
// green having sampled nothing (§34).
report('…and the level samples exist to be checked', flat.length >= 20,
  `${flat.length} points clear of the flight`);
report('the courtyard floor is walk level off the flight', bad.length === 0,
  bad.length ? `${bad.length}/${flat.length} off: ${JSON.stringify(bad.slice(0, 4))}`
    : `${flat.length} samples all at gy 0.14`, 1);

const inside = await probeLanding();      // the same direct read
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
// `down[3]` is `pos()[3]` — the shared last-written gy again, and here it is
// read ONE FRAME after a walk that ended up on the flight, so it hands back
// 0.99 for a player standing on the 0.14 paving. That is what this reported:
// "x -11.61 -> -5.62, gy 0.99", a descent it had just measured as successful,
// failed on the floor value at the bottom of it.
//
// Ask the picker where they ended up. NOT `pos()[1]`: I added that here as a
// second opinion and it is not one. Measured at six places with floors from
// 0.14 to 0.99 — pavement, both flights, the mound crest — `pos()[1]` reads
// 1.62 at every single one. It is the eye height ABOVE the floor, a constant,
// and it says nothing about how high you are standing.
//
// It went GREEN in this file, which is why it is worth a note rather than a
// silent deletion: this walk ends on the 0.14 pavement, where the constant
// happens to equal the value I was predicting. The identical term turned a
// perfectly good church flight RED in E-yard-walk. Same wrong idea, opposite
// outcomes, and the green one is the more expensive.
const downGy = await gyAt(down[0], down[2]);
report('…and back down into the courtyard',
  down[0] > -8.2 && Math.abs(downGy - 0.14) < 0.01,
  `x ${f(climbed[0])} -> ${f(down[0])}, floor there ${downGy.toFixed(2)}`, 1);

// the cheek walls still hold you on the flight
await walk('the cheek walls hold you on the steps', {
  at: [-9.3, CZ], yaw: Math.PI, ms: 1200,
  ok: (p) => p[2] < CZ + 2.1,
  say: (p) => `pushed north to z ${f(p[2])}, cheek inner face at ${(CZ + 2.08).toFixed(2)}`,
});

if (SELFTEST) {
  // The rigged leg must have come back as a NOTE and not as a red. Either other
  // outcome is a broken selftest: a FAIL means the downgrade did not fire, and
  // a clean pass means the rig did not take.
  //
  // `>= 1`, NOT `=== 1`. There is more than one `crowded` leg now, and a second
  // one downgrading is a statement about how busy the pavement happened to be
  // — not about the branch under test. Pinning the exact count made the
  // selftest fail for a reason that has nothing to do with the code it checks,
  // which is the same class of fault as everything else fixed today: asserting
  // a property that is not stable for the thing being asked about.
  const ok = downgraded >= 1 && fails === 0;
  console.log(`\nselftest: ${downgraded} downgraded, ${fails} failed — ${ok ? 'PASS' : 'BROKEN'}`);
  if (!ok) console.log('  a rigged crowded leg must produce a NOTE and no FAIL');
  await browser.close();
  process.exit(ok ? 0 : 2);
}
console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await browser.close();
process.exit(fails ? 1 : 0);
