// CAN YOU WALK THROUGH THE DOORS THAT ARE NOW REAL OPENINGS?
//
// Item 109 cut a doorway in both walk-up walls on every floor, where before
// only floor 3 was pierced. The colliders were deliberately NOT touched — the
// west wall's collider already carried a permanent gap at the door strip,
// plugged on every floor but the third by `aptDoorCap`, and the east wall is
// solid with 302's doorway blocked separately. That is a claim about the world
// and it has to be walked, not read: an opening you can see through and an
// opening you can step through look identical in a screenshot.
//
// For each of the four landings this WALKS the player at each door with held
// keys and reports where they stop. Leaving the shell (x outside the hall, or
// gy falling) is a failure.
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/probes/w61-walk-landings.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';

const URL = aim('http://localhost:4192/');
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;
const DOOR_Z = AZI(3.5);
const at = (dx, dz) => Math.atan2(dx, -dz);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ct, null, { timeout: 60000 });
await afterFrames(page, 3);

const hold = async (k, ms) => {
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(90);
};
// crosstown.ts:1683 — `pos: () => [rig.pos.x, rig.pos.y, rig.pos.z, apt.gy()]`
const pos = () => page.evaluate(() => {
  const [x, , z, gy] = window.__ct.pos();
  return { x, z, gy };
});

let fails = 0;
for (let f = 0; f < 4; f++) {
  for (const west of [true, false]) {
    const name = `${f + 1}0${west ? '1' : '2'}`;
    // start in the middle of the hall on this landing, facing the door
    const sx = AX(1.2), sz = DOOR_Z;
    const yaw = at((west ? AX(0) : AX(2.4)) - sx, 0);
    await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
      [sx, sz, yaw, f * ST]);
    await afterFrames(page, 2);
    const a = await pos();
    for (let i = 0; i < 8; i++) await hold('w', 200);   // walk hard at the door
    await afterFrames(page, 2);
    const b = await pos();
    // the hall's clear span; outside it you are inside/through the wall
    const through = west ? b.x < AX(0.02) : b.x > AX(2.38);
    const fell = Math.abs(b.gy - f * ST) > 0.5;
    const hung = f === 2;                                // 301 and 302 DO open
    const bad = (through && !hung) || fell;
    if (bad) fails++;
    console.log(`  ${name}  start x=${a.x.toFixed(2)} gy=${a.gy.toFixed(2)}  ->  `
      + `x=${b.x.toFixed(2)} gy=${b.gy.toFixed(2)}  `
      + `${bad ? 'FAIL — left the hall' : (through ? 'ok (open doorway, expected)' : 'ok — held')}`);
  }
}

// and the landings are still walkable end to end: north-south along each hall
console.log('\nwalking each landing end to end:');
for (let f = 0; f < 4; f++) {
  // NOT x = AX(1.9). That line runs 0.36 from the corner of collider #204,
  // the 0.15 m block standing off the east wall across 302's doorway, and the
  // walker grazes it and stops 1.65 m in — on every floor, including the one
  // this item did not touch. Twenty minutes went into that before the
  // frame-aware predicate in lib/collide.mjs named the box; a hand-rolled
  // min/max test had said "nothing there". Walk the hall, not the skirting.
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
    [AX(0.7), AZI(1.0), at(0, 1), f * ST]);
  await afterFrames(page, 2);
  const a = await pos();
  // far enough to actually cross the landing and pass both doorways: the hall
  // runs 13.2 m and a 200 ms hold is worth about 0.16 m, so 10 holds proved
  // only "not wedged on the spot". This walks past the doors to the stairwell.
  for (let i = 0; i < 45; i++) await hold('w', 200);
  await afterFrames(page, 2);
  const b = await pos();
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  const fell = Math.abs(b.gy - f * ST) > 0.5;
  const passedDoors = b.z > DOOR_Z + 0.5;         // got past the door strip
  if (moved < 4 || fell || !passedDoors) fails++;
  console.log(`  floor ${f + 1}: z ${a.z.toFixed(2)} -> ${b.z.toFixed(2)} `
    + `(${moved.toFixed(2)} m), gy ${a.gy.toFixed(2)} -> ${b.gy.toFixed(2)}  `
    + `${moved < 4 ? 'FAIL — wedged' : (fell ? 'FAIL — fell' : (!passedDoors ? 'FAIL — never passed the doors' : 'ok'))}`);
}

// the stairs still carry you between floors. The item warned that the landing
// geometry, the floor-picker and the guard collider read the same numbers, so
// a change in the door column could in principle move one of them.
console.log('\nclimbing flight A from the lobby:');
{
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
    [AX(0.6), AZI(7.9), at(0, 1)]);
  await afterFrames(page, 2);
  const a = await pos();
  for (let i = 0; i < 40; i++) await hold('w', 200);
  await afterFrames(page, 2);
  const b = await pos();
  const climbed = b.gy - a.gy;
  if (climbed < 0.8) fails++;
  console.log(`  gy ${a.gy.toFixed(2)} -> ${b.gy.toFixed(2)} (climbed ${climbed.toFixed(2)} m)  `
    + `${climbed < 0.8 ? 'FAIL — the stair does not carry' : 'ok'}`);
}

if (errs.length) { console.log(`\nCONSOLE ERRORS (${errs.length}):`); for (const e of errs.slice(0, 5)) console.log('  ' + e); }
console.log(fails ? `\n${fails} FAILURE(S)` : '\nall landings hold and all are walkable');
await browser.close();
process.exit(fails ? 1 : 0);
