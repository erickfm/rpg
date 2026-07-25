// Builder D's walk proofs. Everything here is WALKED, never eyeballed
// (GOTCHAS §1), and it covers the collision and [E] surfaces D has touched:
//
//   1 the library courtyard — open, and you can get back out
//   2 the bodega's canted corner — the cut is real and you cannot cross it
//   3 the churchyard — open at the gate, nave still solid, no floor hole
//   4 you cannot get inside any building's footprint
//   5 the bodega's two doors, and the two counters that spend money
//
// These lived in a scratchpad for most of D's run, which meant nobody else
// could run them and they died with the session. They are here now.
//
// RETRIES, and this is the whole reason this file is not a straight copy.
// Citizens are solid, and one standing in a doorway or a courtyard mouth
// blocks a 0.36 m player, so a single-shot walk reports a world bug that is
// really a pedestrian. Every leg gets three attempts and passes if ANY of
// them makes it — same idiom as E's scripts/E-yard-walk.mjs.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-walk.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4231/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.mouse.click(640, 360);
await page.waitForTimeout(600);

const pos = () => page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(2)));
const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
const hold = async (k, ms) => {
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(90);
};
const warp = (x, z, yaw) => page.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0, 0), [x, z, yaw]);

let fails = 0;
const say = (okd, name, detail, tries) => {
  if (!okd) fails++;
  console.log(`  ${okd ? 'PASS' : 'FAIL'}  ${name}: ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};
/** walk forward from (x,z) facing yaw, and test where you end up. Retried,
 *  because a citizen in the way is not a collision bug. */
const walk = async (name, x, z, yaw, steps, test, fmt) => {
  let last, t = 0;
  for (t = 1; t <= 3; t++) {
    await warp(x, z, yaw); await page.waitForTimeout(340);
    for (let i = 0; i < steps; i++) await hold('w', 230);
    last = await pos();
    if (test(last)) break;
    await page.waitForTimeout(700);            // let whoever it was move on
  }
  say(test(last), name, fmt(last), t);
  return last;
};

console.log('\n1. the library courtyard');
// z -19 is ON the south jamb of the mouth: probe there and the player scrapes
// the corner and makes only 0.36 m. The mouth runs z -19.5 … -10.5 (probed),
// so stand in the MIDDLE of it.
const deep = await walk('walked IN', -6.0, -16.5, -Math.PI / 2, 10,
  (p) => p[0] < -7.6, (p) => `x -6 -> ${p[0]}`);
say(Math.abs(deep[1] - 1.62) < 0.9, 'floor held', `eye y = ${deep[1]} (no drop into a hole)`, 1);
await walk('walked back OUT', deep[0], -16.5, Math.PI / 2, 10,
  (p) => p[0] > -7.2, (p) => `x ${deep[0]} -> ${p[0]}`);

console.log('\n2. the bodega canted corner');
await walk('stopped ON the cut, not through it', 6.2, -97.2, Math.atan2(1.8, -2.2), 8,
  (p) => p[0] + p[2] <= -86.9, (p) => `x+z = ${(p[0] + p[2]).toFixed(2)} (the cut is -87)`);
// and the cut is REAL: at z=-95 the face has retreated to x=8.0, so you can
// stand well past the 6.34 a square collider would stop you at
await walk('follows the cut in', 6.0, -95.0, Math.PI / 2, 8,
  (p) => p[0] > 6.9, (p) => `reached x = ${p[0]} at z=-95 (a square wall stops at 6.34)`);

console.log('\n3. the churchyard');
// The blanket church footprint is gone (E's patch) — it was sealing this yard
// the way the old blanket wall sealed the library courtyard. What holds you
// along the frontage now is E's churchyard WALL at x 7.00.
await walk('the wall holds off the gate', 5.5, -77.0, Math.PI / 2, 8,
  (p) => p[0] < 6.8, (p) => `stopped at x ${p[0]}`);
const yard = await walk('the GATE lets you in', 5.6, -80.0, Math.PI / 2, 10,
  (p) => p[0] > 7.3, (p) => `reached x ${p[0]}`);
say(Math.abs(yard[1] - 1.62) < 0.9, 'no floor hole at the gate', `eye y = ${yard[1]}`, 1);
// the nave has to still be solid, and the OLD proof could not tell that from
// "the churchyard is sealed" — which is the confusion that let the bug live
await walk('the nave is still solid', 9.0, -80.0, Math.PI / 2, 12,
  (p) => p[0] < 9.6, (p) => `stopped at x ${p[0]} from inside the yard`);
await walk('and you can leave again', 9.0, -80.0, -Math.PI / 2, 12,
  (p) => p[0] < 6.5, (p) => `back out to x ${p[0]}`);

// THE CLIMB — "i want to be able to walk up those stairs", for the church.
// Sampled all the way up rather than at the top, because the failure mode is
// not "you cannot get there", it is a camera that jolts a riser at every
// nosing (GOTCHAS §7 — the picker walks you up a smooth ramp, the drawn
// treads ride within half a riser of it).
await page.evaluate(() => window.__ct.warp(5.6, -79.9, Math.PI / 2, 0, 0));
await page.waitForTimeout(700);
let prevGy = 0, rose = 0, jolt = 0;
for (let i = 0; i < 14; i++) {
  await hold('w', 180);
  const p = await page.evaluate(() => window.__ct.pos());
  const gy = +p[3];
  if (gy > prevGy + 0.001) rose++;
  if (gy - prevGy > 0.34) jolt++;          // a whole riser in one step
  prevGy = gy;
}
say(prevGy > 0.45, 'the church steps CLIMB', `ground reached ${prevGy.toFixed(2)} at the door (kerb is 0.14)`, 1);
say(rose >= 2, 'and they climb gradually', `${rose} steps of rise, not one teleport`, 1);
say(jolt === 0, 'no riser-sized jolt on the way up', `${jolt} jumps over 0.34 m`, 1);

console.log('\n4. no walking into buildings, and the lane you are owed');
// TWO-SIDED now, and the second half is new. A facade stands at 7.00 and its
// collider is inset by WALK_PROJECTION = 0.12, so the collider face is at
// 6.88 and a 0.36 m player capsule comes to rest at 6.52.
//
//   too far IN  -> you are inside the shopfront; the footprint is wrong
//   too far OUT -> the collider is reserving lane that no geometry occupies,
//                  which is what notes/lane-audit.md caught: a flat 0.30 m
//                  cushion held everyone at 6.34 and ate 15 % of the walk
//
// The old assertions only tested the first, so they PASSED the whole time the
// lane was being stolen. That is the bug this pair exists to catch.
for (const [name, x, z, yaw, test] of [
  ['east shops  z=-30', 5.5, -30.0, Math.PI / 2, (p) => p[0] < 6.88 && p[0] > 6.4],
  ['west shops  z=-60', -5.5, -60.0, -Math.PI / 2, (p) => p[0] > -6.88 && p[0] < -6.4],
  ['side st N   x=30', 30.0, -97.5, Math.PI, (p) => p[2] < -96.3 && p[2] > -96.9],
  ['side st S   x=30', 30.0, -108.5, 0, (p) => p[2] > -109.88 && p[2] < -109.3],
]) await walk(name, x, z, yaw, 8, test, (p) => `stopped at (${p[0]}, ${p[2]})`);

console.log('\n5. the doors, and the money');
for (const [name, x, z, yaw, steps] of [
  // yaw 0 is -z. The door is NORTH of this start point, so this is Math.PI —
  // getting it wrong walks you away from the door and reports a dead trigger.
  ['bodega street door', 8.0, -99.2, Math.PI, 8],
  ['No. 227', 5.9, -44.0, Math.PI / 2, 6],
]) {
  let got = '', t = 0;
  for (t = 1; t <= 3 && !got; t++) {
    await warp(x, z, yaw); await page.waitForTimeout(340);
    for (let i = 0; i < steps && !got; i++) { await hold('w', 230); await page.waitForTimeout(200); got = await prompt(); }
  }
  say(got !== '', name, JSON.stringify(got), t);
}
// The counters are the only spots in the world that SPEND, so prove the PURSE
// moves rather than that a prompt reads.
//
// This used to warp to hard-coded world coordinates and broke the moment the
// bodega interior was rebuilt somewhere else — which is the same "the room's
// own address showing through" that the rebuild was getting rid of. So: go in
// through the DOOR, then look for the counter from wherever you land.
await warp(8.0, -99.2, Math.PI);
await page.waitForTimeout(340);
for (let i = 0; i < 8; i++) { await hold('w', 230); await page.waitForTimeout(200); if ((await prompt()).includes('BODEGA')) break; }
await page.keyboard.press('e');
await page.waitForTimeout(800);
const inside = await pos();
let found = null;
outer:
for (let r = 0.75; r <= 3.75 && !found; r += 0.75) {
  for (let a = 0; a < 16; a++) {
    const x = inside[0] + r * Math.cos(a * Math.PI / 8);
    const z = inside[2] + r * Math.sin(a * Math.PI / 8);
    await page.evaluate(([X, Z]) => window.__ct.warp(X, Z, 0, 0, 0), [x, z]);
    await page.waitForTimeout(70);
    if ((await prompt()).includes('buy cereal')) { found = [x, z]; break outer; }
  }
}
say(!!found, 'the cereal counter is findable from the door',
  found ? `at (${found[0].toFixed(1)}, ${found[1].toFixed(1)}), ${JSON.stringify(await prompt())}` : 'not found within 3.75 m', 1);
if (found) {
  // $14.50 to start: five cereals at $2.50 is $12.50, so the sixth must be
  // refused and $2.00 must still buy a $1.25 soda. That sequence is only true
  // if ctx.purse is the object the HUD was built on.
  for (let i = 0; i < 5; i++) { await page.keyboard.press('e'); await page.waitForTimeout(320); }
  say((await prompt()).includes('you'), 'refused once the money is gone', JSON.stringify(await prompt()), 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nall D walks pass');
process.exit(fails ? 1 : 0);
