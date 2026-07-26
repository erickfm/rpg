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

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

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
const walkFrom = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
await page.keyboard.down('w');
await page.waitForTimeout(2600);
await page.keyboard.up('w');
const WALK = await travelled(walkFrom);
ok(WALK > 2, `CONTROL: a held W with no fade really walks (${WALK.toFixed(2)} m in 2.6 s)`);

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
// …as a FADE, not a cut: the way up has to pass through the middle. A cut would
// step 0 -> 1 between two samples and never be seen part way.
const mid = run.samples.filter(([, o]) => o > 0.1 && o < 0.9).length;
ok(mid >= 4, `it FADES rather than cuts (${mid} samples caught part way)`);

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
