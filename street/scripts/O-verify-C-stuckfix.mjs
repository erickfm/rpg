// VERIFYING C's stuck-in-the-TV fixes — I did not build them, so I may.
//
// I have two specific reasons to be the one who checks this. Earlier tonight I
// tried to reproduce the user's failure and could not, and I filed a
// CANNOT-ANSWER against the sibling row because **no spot anywhere in the world
// carried a `stop watching` label** — the prompt was invisible to tooling. C's
// `standLabel` work has landed since. So:
//
//   1. IS THE PROMPT VISIBLE NOW? That settles my own open cannot-answer, and
//      it is the difference between "C's fix works" and "C's fix is unobservable".
//   2. THE ONE MECHANISM C SAYS IS STILL LIVE. C is explicit and careful about
//      it: `ct/hud.ts:175`'s `swallow` calls stopImmediatePropagation on window
//      in the CAPTURE phase; panels are covered because `gate` forces Escape to
//      close them, **but a fade is not** — *"raise one that never resolves and
//      no key can recover"*. That is a claim about a live trap, and it is
//      testable from outside by raising exactly that fade.
//
// (2) is a mutation of the WORLD and not of this check's view, which is the
// distinction GOTCHAS 34 turns on: I am putting the world into the state C
// describes and asking whether the player can get out of it.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-C-stuckfix.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

const seat = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /watch tv/i.test(s.label ?? '')).map((s) => ({ x: s.x, z: s.z }))[0] ?? null);
if (!seat) { console.error('ABORT: no watch-TV seat'); await b.close(); process.exit(3); }
const FLOOR = await p.evaluate(async ([sx, sz]) => {
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let gy = 0; gy <= 14; gy += 0.1) {
    window.__ct.warp(sx, sz, 0, gy, 0); await wait();
    if (window.__ct.spots().filter((s) => /watch tv/i.test(s.label ?? ''))[0]?.ok) {
      return +window.__ct.pos()[3].toFixed(2);
    }
  }
  return null;
}, [seat.x, seat.z]);
if (FLOOR === null) { console.error('ABORT: the seat never arms'); await b.close(); process.exit(3); }

const sit = async () => {
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [seat.x, seat.z, FLOOR]);
  await afterFrames(p, 5);
  await p.evaluate(() => new Promise((res) => {
    const t = performance.now();
    const tick = () => {
      if (window.__ct.spots().filter((s) => /watch tv/i.test(s.label ?? ''))[0]?.ok) return res(true);
      if (performance.now() - t > 6000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  await p.keyboard.press('e');
  return p.evaluate(() => new Promise((res) => {
    const t = performance.now();
    const tick = () => {
      if (window.__ct.seated?.()) return res(true);
      if (performance.now() - t > 8000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }));
};

// ── 1. IS THE PROMPT VISIBLE NOW? ─────────────────────────────────────────
console.log('── the exit prompt, which I could not see at all a few hours ago ──');
if (!(await sit())) { console.error('ABORT: could not sit'); await b.close(); process.exit(3); }
const inReach = await p.evaluate(() => {
  const q = window.__ct.pos();
  return window.__ct.spots()
    .filter((s) => Math.hypot(s.x - q[0], s.z - q[2]) < s.r + 0.6)
    .map((s) => ({ label: s.label, ok: s.ok }));
});
console.log(`  live and in reach while watching: ${JSON.stringify(inReach)}`);
const exit = inReach.find((s) => s.ok && /stop watching/i.test(s.label ?? ''));
ok(!!exit,
  exit ? `the exit prompt IS observable now — ${JSON.stringify(exit.label)}. That closes the ` +
         `CANNOT-ANSWER I filed on the sibling row`
       : 'no "stop watching" prompt is offered while seated — still unobservable from outside');
const sleepOffered = inReach.find((s) => s.ok && /sleep until morning/i.test(s.label ?? ''));
if (sleepOffered && !exit) {
  console.log('  NOTE: the only live prompt is "sleep until morning", which is what a player');
  console.log('        watching television would be reading. That was my earlier finding.');
}

// leave cleanly
await p.keyboard.press('e');
await afterFrames(p, 20);

// ── 2. THE FADE TRAP C NAMES AS STILL LIVE ────────────────────────────────
//
// C: "a fade is not [covered] — raise one that never resolves and no key can
// recover." Put the world in exactly that state and try to get out of it.
console.log('\n── the mechanism C says is still live: a fade that never resolves ──');
const canFade = await p.evaluate(() => typeof window.__hud?.fade === 'function');
if (!canFade) {
  console.log('  NOT MEASURED — no __hud.fade to raise. Saying so rather than scoring it.');
} else {
  await p.evaluate(() => { window.__hud.fade({ mid: () => new Promise(() => {}) }); });
  // ASSERT THE STATE EXISTS BEFORE TESTING ESCAPE FROM IT. My first run
  // concluded "an unresolved fade does not trap the player" while the fade was
  // at opacity 0.000 — it never rose, so there was no trap to escape and the
  // pass was free. That is GOTCHAS 34 in my own check, for the second time
  // tonight: an absence measured over an empty population.
  const rose = await p.evaluate(() => new Promise((res) => {
    const t = performance.now();
    const tick = () => {
      const el = document.querySelector('#ct-fade');
      if (el && parseFloat(getComputedStyle(el).opacity || '0') > 0.9) return res(true);
      if (performance.now() - t > 6000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  if (!rose) {
    console.log('  COULD NOT BUILD THE STATE — the fade never reached black, so there was');
    console.log('  nothing to be trapped by. That is NOT a refutation of C\'s mechanism:');
    console.log('  it means `fade({mid: never-resolving})` is not how you construct it, and');
    console.log('  C\'s claim stands untested by me. Reported, not scored.');
    console.log(`\n${n} checks, ${bad} disagreed`);
    await b.close();
    process.exit(bad ? 1 : 0);
  }
  const before = await p.evaluate(() => window.__ct.pos());
  for (const k of ['Escape', 'e', 'Enter', 'Space']) { await p.keyboard.press(k); await afterFrames(p, 8); }
  await p.keyboard.down('w'); await afterFrames(p, 25); await p.keyboard.up('w');
  const after = await p.evaluate(() => window.__ct.pos());
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
  const dark = await p.evaluate(() => {
    const el = document.querySelector('#ct-fade');
    return el ? parseFloat(getComputedStyle(el).opacity || '0') : 0;
  });
  console.log(`  fade opacity now ${dark.toFixed(3)}; after Escape/e/Enter/Space and holding W, moved ${moved.toFixed(2)} m`);
  ok(moved > 0.4 || dark < 0.5,
    moved > 0.4 || dark < 0.5
      ? 'an unresolved fade does NOT trap the player'
      : `CONFIRMED LIVE: an unresolved fade traps the player — screen at opacity ` +
        `${dark.toFixed(3)}, no key recovers, movement ${moved.toFixed(2)} m. This is C's ` +
        `own diagnosis and it reproduces`);
  await p.screenshot({ path: 'shots/O-verify-C-fadetrap.png' });
}

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
