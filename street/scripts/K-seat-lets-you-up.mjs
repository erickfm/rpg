// THE CLAIM: you can get back up off a seat you sat down on.
//
// RED ON PURPOSE. It is not true today, on 225 of the world's seats, whenever
// you sit down from more than about a metre away — and *"for every seat in the
// game i want to be able to sit down"* is a user request, as is *"im literally
// stuck here"*.
//
// THE MECHANISM, measured rather than guessed. `crosstown.ts` latches `landing`
// when an `[E]` moves the player more than a stride:
//
//     if (Math.hypot(rig.pos.x - wasX, rig.pos.z - wasZ) > 1.0) landing = {…}
//
// …and `canSee` returns false for EVERY spot while `landing` is set, until the
// player walks 1.2 m clear of it. **A seated player cannot walk.** So the latch
// never clears, no prompt is ever offered again, and `stand up` — which is an
// ordinary spot like any other — is unreachable.
//
// The comment above that line anticipates this exact failure and says latching
// everything "would stop … a seat re-offering 'stand up'". The threshold does
// not protect against it, because SITTING DOWN IS ITSELF A MOVE of more than a
// stride whenever you were standing more than a metre from the pose.
//
// MEASURED ON THE STREET BENCH, walking in from six distances:
//
//     travel 0.97 m   landing not latched   GOT UP
//     travel 1.03 m   landing LATCHED       STUCK
//     travel 1.12 m                         STUCK
//     travel 1.24 m                         STUCK
//     travel 1.38 m                         STUCK
//     travel 1.53 m                         STUCK
//
// `crosstown.ts` is DESK-OWNED and I have not touched it. Two shapes that would
// close it, for whoever does: clear `landing` whenever `rig.seated`, or exempt
// a seat's own stand-up spot from the sight test.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-seat-lets-you-up.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
/** measured, not remembered: the world has 225 seats */
const MIN_SEATS = 50;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const seats = await page.evaluate(() => window.__ct.seats().map((s) => ({
  ax: s.at.x, az: s.at.z, px: s.pose.x, pz: s.pose.z, label: s.label ?? 'sit down',
})));
ok(seats.length >= MIN_SEATS, `the world has seats to test (${seats.length}, floor ${MIN_SEATS})`);
if (seats.length < MIN_SEATS) { console.log('EMPTY SUBJECT SET'); await browser.close(); process.exit(3); }

// press E until it takes: the dispatch is edge-triggered inside the render loop,
// so one press can land entirely between two frames (GOTCHAS §30)
const pressUntil = async (want) => {
  for (let t = 0; t < 3; t++) {
    await page.keyboard.down('e');
    await page.waitForTimeout(300);
    await page.keyboard.up('e');
    await page.waitForTimeout(420);
    if ((await page.evaluate(() => !!window.__ct.seated())) === want) return true;
  }
  return false;
};

// A SEAT ON THE STREET, not in a room: no floor-picker hysteresis to get wrong
// (GOTCHAS §7), and it is a seat the user walks past.
const bench = seats.find((s) => /bench/i.test(s.label) && Math.abs(s.ax) < 20) ?? seats[1];
console.log(`      testing "${bench.label}" at (${bench.ax.toFixed(2)}, ${bench.az.toFixed(2)})`);

let gotUpNear = null, gotUpFar = null;
for (const d of [0.2, 1.2]) {
  const X = bench.ax - d, Z = bench.az;
  const travel = Math.hypot(bench.px - X, bench.pz - Z);
  await page.evaluate(([x, z, ax, az]) => window.__ct.warp(x, z, Math.atan2(ax - x, -(az - z)), window.__ct.groundAt(x, z)),
    [X, Z, bench.ax, bench.az]);
  await page.waitForTimeout(420);
  if (!(await pressUntil(true))) { console.log(`      approach ${d} m: never seated, skipping`); continue; }
  const up = await pressUntil(false);
  console.log(`      approach ${d.toFixed(1)} m · the sit moved you ${travel.toFixed(2)} m · ${up ? 'GOT UP' : 'STUCK'}`);
  if (d < 1) gotUpNear = up; else gotUpFar = up;
  if (!up) await page.evaluate(() => window.__ct.warp(0, -30, 0, 0));   // free the rig for the next case
}

// THE CONTROL FIRST, because the verdict below is only meaningful if getting up
// works at all: sit from close enough that the move is under the latch's 1.0 m
// and you can stand.
ok(gotUpNear === true, `CONTROL: sitting from 0.2 m — a move of under 1 m — lets you stand back up (${gotUpNear})`);
ok(gotUpFar === true,
  `sitting from 1.2 m ALSO lets you stand back up (${gotUpFar}) —`
  + ' RED ON PURPOSE: the landing latch is set by the sit and a seated player cannot walk it off');

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
