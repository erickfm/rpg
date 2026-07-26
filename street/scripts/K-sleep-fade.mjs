// THE CLAIM: the screen really goes black, THE WORLD CHANGES WHILE IT IS BLACK,
// black is held for a beat, the screen comes back, and the player cannot move
// or interact through any of it — including when the key was already down when
// the fade started.
//
// *"when the player goes to sleep i want the screen to fade to black"*.
//
// Read from the ELEMENT'S OWN COMPUTED OPACITY, not from `__hud.fading()`. A
// boolean going true is not the same claim as the screen being black: it would
// pass with the overlay transparent, detached, or behind the world.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-sleep-fade.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// AFTER A WARP THE PROMPT DESCRIBES WHERE YOU WERE, for about a second.
//
// Measured: warp to the casino's street door and the prompt still reads
// `[E] sit on the bed and watch TV` — the SPAWN's prompt, from 166 m away — at
// 200 ms and at 600 ms, and only becomes `[E] into SEVENS` by 1200 ms. The
// player is still settling in those frames (z −95.8 → −96.7, gy 0 → 0.1) and
// the spot pick has not caught up.
//
// This nearly cost me a false report that a player at a casino slot is
// teleported into their apartment. It is also a live hazard for any sweep that
// looks for a named prompt, because the PREVIOUS station's prompt is exactly
// the thing a stale read returns — a false positive on the square before.
//
// So: wait for the position to stop moving, which is the event, rather than
// sleeping on a number that was measured on an idle machine (GOTCHAS §30).
const settled = async (page) => {
  let last = null;
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(3)));
    if (last && q[0] === last[0] && q[2] === last[2] && q[3] === last[3]) return true;
    last = q;
    await page.waitForTimeout(90);
  }
  return false;
};

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// WHAT STOREY IS 301 ON — read BEFORE anything moves, because the floor picker
// has HYSTERESIS (GOTCHAS §7) and `groundAt` answers relative to the storey you
// are already on. The controls below put the player out on the street at gy 0;
// warping back to 301's coordinates after that and asking `groundAt` returns
// the GROUND floor, so you land 5.4 m under the room and nothing in it is
// reachable. My sweep found 45 offering positions run on its own and ZERO run
// inside this check, and that was the whole difference. The player spawns in
// 301, so its floor is simply what the rig reports before the first warp.
const SPAWN = await page.evaluate(() => window.__ct.pos());
const ROOM_GY = SPAWN[3];

if (!(await page.evaluate(() => typeof window.__hud === 'object' && window.__hud !== null))) {
  console.log('__hud absent — nothing measured'); await browser.close(); process.exit(3);
}
const el = await page.$('#ct-fade');
ok(!!el, 'the fade overlay exists');
if (!el) { await browser.close(); process.exit(3); }

// stand somewhere open on the pavement so a step would be a step, not a wall
const STAND = [-5.2, -30];
const warp = () => page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z)), STAND);
const travelled = (from) => page.evaluate(([x, z]) => {
  const q = window.__ct.pos();
  return Math.hypot(q[0] - x, q[2] - z);
}, from);
await warp();
await page.waitForTimeout(150);

// ── TWO CONTROLS, BEFORE THE THING BEING TESTED ──────────────────────────
//
// The verdict further down is an ABSENCE — "the player did not move" — and an
// absence is free when nothing could have moved them anyway (GOTCHAS §34). Two
// controls make it mean something, and both were paid for:
//
//   · WALK — hold W for as long as a fade lasts with NO fade running. If this
//     does not cover real ground then the driver's keys are not reaching the
//     page at all, and "did not move" below would pass for a reason that has
//     nothing to do with the lock.
//   · DRIFT — run a whole fade with NO KEYS AT ALL. This is not zero: warping
//     onto the pavement lands you inside a collider and it pushes you out over
//     the next few frames. I measured 0.132 m of it and spent a round reading
//     that as a broken input lock. The keyed run is compared against THIS, not
//     against zero.
//
// WALKED UNTIL IT GETS THERE, not for a fixed 2.6 s. This assertion was
// `> 2 m in 2.6 s` and it went red on 2 runs in 5 under load, reporting 1.54 and
// 1.87 m — a false red on a control, which is the worst kind because it
// discredits the real verdict beside it. The world advances in FRAMES and a
// headless browser runs the sim at about two thirds of wall time (GOTCHAS §43),
// so any distance-per-second bar is a bet on how busy the machine is. Poll the
// position and stop when the target is reached or progress stalls — §30's own
// prescription, and the same fix `lotwalk.mjs` needed.
//
// AND IT RETRIES, because a CONTROL that fails spuriously is the worst kind of
// red: it discredits the real verdict standing beside it. Under four-way load
// one run in three read 0.00 m — the keydown never reached a starved page at
// all. Three attempts, best distance wins, and a failure now means the keys
// genuinely are not arriving, which is exactly what this control is for.
const WALK_TARGET = 1.0;
let WALK = 0;
for (let attempt = 0; attempt < 3 && WALK < WALK_TARGET; attempt++) {
  await warp();
  await page.waitForTimeout(200);
  const walkFrom = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
  await page.keyboard.down('w');
  let d = 0, stalled = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(120);
    const now = await travelled(walkFrom);
    if (now - d < 0.01) stalled++; else stalled = 0;
    d = now;
    if (d >= WALK_TARGET || stalled >= 10) break;      // there, or against a wall
  }
  await page.keyboard.up('w');
  WALK = Math.max(WALK, d);
}
ok(WALK >= WALK_TARGET,
  `CONTROL: a held W with no fade really walks (${WALK.toFixed(2)} m, walked until it got there`
  + ` rather than for a fixed time — the sim runs at ~0.66x wall clock headless)`);

await warp();
await page.waitForTimeout(200);
const driftFrom = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
await page.evaluate(() => window.__hud.fade({}));
const DRIFT = await travelled(driftFrom);
console.log(`      CONTROL: a fade with no keys drifts ${DRIFT.toFixed(3)} m (collider settling, not input)`);

await warp();
await page.waitForTimeout(200);

// ── run one fade, sampling the whole thing from inside the page ──────────
//
// Sampled in the page rather than round-tripped over the wire per reading:
// every `page.evaluate` is a message hop, and a fade is ~2.6 s of a value that
// moves every frame. Round-tripping would measure the harness.
//
// THE KEYS ARE DRIVEN BY PLAYWRIGHT, NOT DISPATCHED IN THE PAGE, and that
// correction is the whole reason this comment is here. My first version did
// `window.dispatchEvent(new KeyboardEvent('keydown'))` and reported the input
// lock BROKEN — 5.4 m walked through a fade that holds you still perfectly well
// in a browser. When an event is dispatched ON window, window is the TARGET, so
// its capture and bubble listeners all fire in REGISTRATION ORDER and main.ts's
// (registered first) wins. A real key lands on `document.body`, so window's
// capture listener runs a whole phase earlier and the swallow works.
//
// A synthetic event is not the thing it imitates. GOTCHAS §27 says a check you
// have never watched fail is one you will argue with — this is the other edge
// of that: a check that fails for its own reasons will have you "fixing" code
// that was right, and I was one commit from doing exactly that.
//
// W GOES DOWN BEFORE THE FADE IS EVEN ARMED. That ordering is the test: a key
// already in main.ts's Set is not touched by blocking new keydowns, so this is
// the half that only the synthetic keyups the fade dispatches can answer.
await page.keyboard.down('w');
await page.waitForTimeout(120);
const armed = await page.evaluate((selftest) => {
  const fx = document.getElementById('ct-fade');
  const op = () => parseFloat(getComputedStyle(fx).opacity || '0');
  const t0 = performance.now();
  const samples = [];
  let midAt = null, midOpacity = null, clockBefore = null, clockAfter = null;
  const tick = setInterval(() => samples.push([performance.now() - t0, op()]), 25);

  const advance = () => {
    clockBefore = window.__ct.clockNow().totalMin;
    window.__ct.advanceClock(8 * 60, 0);          // SNAP: nothing to see behind black
    clockAfter = window.__ct.clockNow().totalMin;
  };

  // THE MUTATION (--selftest): do the world change BEFORE the fade instead of
  // inside it, which is exactly the caller mistake the ordering rule exists to
  // prevent — advance the clock first and the fade-in reveals a room that has
  // already changed, so it reads as a loading screen and not as sleeping. Every
  // other verdict below stays true; only "it happened while the screen was
  // black" can catch this, which is the point of breaking it here.
  if (selftest) { midOpacity = op(); midAt = performance.now() - t0; advance(); }

  const posBefore = window.__ct.pos();
  const p = window.__hud.fade(selftest ? {} : {
    mid: () => { midOpacity = op(); midAt = performance.now() - t0; advance(); },
  });

  const shown = (q) => {
    const w = document.getElementById(q);
    if (!w) return false;
    const r = w.getBoundingClientRect();
    const o = parseFloat(getComputedStyle(w).opacity || '0');
    return o > 0.5 && r.top < window.innerHeight - 40 && r.height > 100;
  };
  window.__k = p.then(() => {
    clearInterval(tick);
    const posAfter = window.__ct.pos();
    return {
      samples, midAt, midOpacity, clockBefore, clockAfter,
      peak: Math.max(...samples.map((s) => s[1])),
      end: op(),
      total: performance.now() - t0,
      moved: Math.hypot(posAfter[0] - posBefore[0], posAfter[2] - posBefore[2]),
      walletShown: shown('ct-wallet'), pocketsShown: shown('ct-pockets'),
    };
  });
  return true;
}, SELFTEST);
ok(armed === true, 'the fade started');

// REAL keys, from the driver. W is pressed BEFORE the fade begins — the half a
// "block new keydowns" implementation gets wrong, since a key already in
// main.ts's Set is not affected by blocking new ones — and again DURING it,
// along with an i and a right-click.
await page.waitForTimeout(400);
await page.keyboard.press('i');
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(140);
await page.mouse.up({ button: 'right' });
const run = await page.evaluate(() => window.__k);
await page.keyboard.up('w');

console.log(`      ${run.samples.length} samples over ${Math.round(run.total)} ms,`
  + ` peak opacity ${run.peak.toFixed(3)}, ended at ${run.end.toFixed(3)}`);

// ── it actually goes black, and actually comes back ──────────────────────
ok(run.peak >= 0.99, `the screen goes FULLY black (peak opacity ${run.peak.toFixed(3)})`);
ok(run.end <= 0.01, `and comes back (ended at ${run.end.toFixed(3)})`);
// …as a FADE, not a cut. COUNTED IN MILLISECONDS, NOT IN SAMPLES: the first
// version wanted 4 readings part way up and went red 2 runs in 4 under
// concurrent load with 3 — the sampler was starved, the fade was perfect, and
// the check was measuring how busy the machine was (GOTCHAS §30). Elapsed time
// between the first non-zero reading and the first fully-black one does not
// care how often the sampler ran, and starvation can only make it LOOK longer,
// never shorter. The sample count stays as a floor of one, which is all it can
// honestly assert.
const mid = run.samples.filter(([, o]) => o > 0.1 && o < 0.9).length;
const firstUp = run.samples.find(([, o]) => o > 0.05);
const firstFull = run.samples.find(([, o]) => o >= 0.99);
const rampMs = firstUp && firstFull ? firstFull[0] - firstUp[0] : -1;
ok(mid >= 1 && rampMs >= 200,
  `it FADES rather than cuts (${Math.round(rampMs)} ms from first light to full black,`
  + ` ${mid} samples caught part way)`);

// ── the world changed WHILE it was black ─────────────────────────────────
ok(run.clockAfter !== null && run.clockAfter > run.clockBefore,
  `the clock moved (${run.clockBefore} -> ${run.clockAfter} min)`);
ok(run.midOpacity !== null && run.midOpacity >= 0.99,
  `…and it moved WHILE THE SCREEN WAS BLACK (opacity ${run.midOpacity === null ? '—' : run.midOpacity.toFixed(3)} at the moment it happened)`);

// ── black is HELD, not blinked ───────────────────────────────────────────
const firstDrop = run.samples.find(([t, o]) => run.midAt !== null && t > run.midAt && o < 0.98);
const heldMs = firstDrop ? firstDrop[0] - run.midAt : run.total - (run.midAt ?? 0);
ok(heldMs >= 300, `black is held for a beat after the change (${Math.round(heldMs)} ms)`);

// ── nothing moves and nothing opens ──────────────────────────────────────
//
// BOTH halves of the input lock, because they fail independently: a key already
// held when the fade starts is already in main.ts's Set and blocking new
// keydowns does nothing about it. GOTCHAS §41 — the mirror is where the bug is.
ok(run.moved < DRIFT + 0.15,
  `the player did not move through it — W HELD ACROSS THE START: ${run.moved.toFixed(3)} m`
  + ` against ${DRIFT.toFixed(3)} m of keyless drift, and ${WALK.toFixed(2)} m if the key had counted`);
ok(!run.walletShown, 'a right-click during the fade did not open the wallet');
ok(!run.pocketsShown, 'an i during the fade did not open the pockets');

// ── and the world is usable again afterwards ─────────────────────────────
//
// The one that matters most if the lock is ever wrong in the other direction: a
// swallow that is not undone leaves the player unable to walk, which is a far
// worse bug than the one being prevented.
const wasAt = await page.evaluate(() => window.__ct.pos());
await page.keyboard.down('w');
await page.waitForTimeout(700);
await page.keyboard.up('w');
const after = await page.evaluate(([x, z]) => {
  const q = window.__ct.pos();
  return Math.hypot(q[0] - x, q[2] - z);
}, [wasAt[0], wasAt[2]]);
ok(after > 0.3, `and you can walk again when it is over (${after.toFixed(2)} m on a held W)`);

// ══ AND THE VERB ACTUALLY USES IT ════════════════════════════════════════
//
// THE GAP THAT MADE A CONFIRMED ROW UNTRUE, and it was mine. Everything above
// tests the CAPABILITY: call `hud.fade` and the screen goes black. It was green
// while the world had no fade in it at all, because `ct/apartment.ts`'s
// "sleep until morning" advances the clock and never calls it. The desk
// re-opened the row on exactly that — *"CONFIRMED and not true at the same
// time"* — and A and D reproduced it independently.
//
// A check that proves a kit works is not a check that the kit is USED.
//
// It was RED ON PURPOSE until `ct/apartment.ts` called `screenFade`, which C has
// now done — one line, the shape published in `notes/K-screen-fade.md`. Kept
// green rather than deleted: this half is the only thing standing between a
// working capability and a repeat of the CONFIRMED-but-not-true row.
if (!SELFTEST) {
  const bed = await page.evaluate(() => window.__ct.spots().find((q) => /sleep/i.test(q.label)) ?? null);
  ok(!!bed, 'the world offers a sleep verb at all');
  if (bed) {
    // WHERE TO STAND IS FOUND BY SWEEPING, not assumed. The bed now carries a
    // second spot — C's "sit on the bed and watch TV" — and from half the
    // positions around it that one wins the pick, so a station derived from the
    // sleep spot's own coordinates gets you the TV instead. Ask the world which
    // squares actually offer the prompt, the way scripts/doorsweep.mjs does.
    let at = null;
    for (let dx = -1.4; dx <= 1.4 && !at; dx += 0.35) {
      for (let dz = -1.4; dz <= 1.4 && !at; dz += 0.35) {
        const x = bed.x + dx, z = bed.z + dz;
        await page.evaluate(([X, Z, BX, BZ, GY]) => window.__ct.warp(X, Z, Math.atan2(BX - X, -(BZ - Z)), GY), [x, z, bed.x, bed.z, ROOM_GY]);
        await settled(page);
        const pr = await page.evaluate(() => {
          const e = document.getElementById('ct-prompt');
          return e && e.style.display !== 'none' ? e.textContent : null;
        });
        if (pr && /sleep/i.test(pr)) at = { x: +x.toFixed(2), z: +z.toFixed(2) };
      }
    }
    ok(!!at, at ? `a player can reach the sleep prompt (standing at ${at.x}, ${at.z})`
      : 'NO position around the bed offers "sleep until morning" — the TV seat wins every pick');
    if (at) {
      const t0 = await page.evaluate(() => window.__ct.clockNow().totalMin);
      const watch = page.evaluate(() => new Promise((res) => {
        const fx = document.getElementById('ct-fade');
        let peak = 0, n = 0;
        const t = setInterval(() => { peak = Math.max(peak, parseFloat(getComputedStyle(fx).opacity || '0')); n++; }, 25);
        setTimeout(() => { clearInterval(t); res({ peak: +peak.toFixed(3), n }); }, 3600);
      }));
      await page.keyboard.down('e');
      await page.waitForTimeout(220);
      await page.keyboard.up('e');
      const seen = await watch;
      const moved = +((await page.evaluate(() => window.__ct.clockNow().totalMin)) - t0).toFixed(1);
      console.log(`      the bed: clock moved ${moved} min, peak overlay opacity ${seen.peak} over ${seen.n} samples`);
      ok(moved > 60, `pressing E at the bed advances the clock (${moved} min)`);
      // GREEN SINCE C LANDED THE CALL (`ct/apartment.ts` line ~1918:
      // `screenFade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) })`).
      // It was written red on purpose and it stayed red for exactly as long as
      // the world had no fade in it, which is what a check is for.
      ok(seen.peak >= 0.99,
        `…AND THE SCREEN GOES BLACK WHILE IT DOES (peak ${seen.peak})`);
    }
  }
}

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the out-of-order change' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
