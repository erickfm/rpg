// THE CLAIM: you can get back up off a seat you sat down on.
//
// **FIXED, AND THIS IS NOW THE GUARD.** It was RED ON PURPOSE: sitting down
// from more than about a metre away left you with no way off any of the world's
// 225 seats, and the user hit it himself — *"pressing e doesnt get me out of
// it"*, on top of the standing request *"for every seat in the game i want to
// be able to sit down"*.
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
// MEASURED ON THE STREET BENCH BEFORE THE FIX, walking in from six distances —
// the boundary is what made the diagnosis certain:
//
//     travel 0.97 m   landing not latched   GOT UP
//     travel 1.03 m   landing LATCHED       STUCK
//     travel 1.12 / 1.24 / 1.38 / 1.53 m    STUCK
//
// AND AFTER THE FIX, the same bench across the whole band: 0.97, 1.12, 1.38,
// 1.69 and 2.04 m of travel all GET UP. `crosstown.ts` is DESK-OWNED and I
// never touched it; this file only ever measured.
//
// IT SWEEPS THE BAND rather than testing two points, because the bug was a
// THRESHOLD — a two-point check that happened to straddle it would pass on a
// fix that only moved it.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-seat-lets-you-up.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = aim('http://localhost:4292/');
/** measured, not remembered: the world has 225 seats */
const MIN_SEATS = 50;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await goto(page, URL);
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

const results = [];
for (const d of [0.2, 0.6, 1.0, 1.4, 1.8]) {
  const X = bench.ax - d, Z = bench.az;
  const travel = Math.hypot(bench.px - X, bench.pz - Z);
  await page.evaluate(([x, z, ax, az]) => window.__ct.warp(x, z, Math.atan2(ax - x, -(az - z)), window.__ct.groundAt(x, z)),
    [X, Z, bench.ax, bench.az]);
  await page.waitForTimeout(420);
  if (!(await pressUntil(true))) { console.log(`      approach ${d} m: never seated, skipping`); continue; }
  const up = await pressUntil(false);
  console.log(`      approach ${d.toFixed(1)} m · the sit moved you ${travel.toFixed(2)} m · ${up ? 'GOT UP' : 'STUCK'}`);
  results.push({ d, travel, up });
  if (!up) await page.evaluate(() => window.__ct.warp(0, -30, 0, 0));   // free the rig for the next case
}

// THE CONTROL FIRST, because every verdict below is only meaningful if getting
// up works at all: the near approach, whose sit moves you under the old 1.0 m
// threshold, was the one case that always worked.
const near = results.find((r) => r.travel < 1.0);
ok(near && near.up === true,
  `CONTROL: a sit that moves you under 1 m lets you stand back up (${near ? near.travel.toFixed(2) : '—'} m)`);
// …AND THE WHOLE BAND ABOVE IT, which is where the trap lived.
const far = results.filter((r) => r.travel >= 1.0);
ok(far.length >= 3, `swept ${far.length} approaches past the old 1.0 m threshold (floor 3)`);
const stuck = far.filter((r) => !r.up);
ok(stuck.length === 0,
  `every sit past the old threshold still lets you stand back up`
  + ` (${far.map((r) => r.travel.toFixed(2)).join(', ')} m${stuck.length ? ` — STUCK at ${stuck.map((r) => r.travel.toFixed(2)).join(', ')}` : ''})`);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
