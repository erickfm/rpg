// ITEM 130 — GETTING OUT OF A CHAIR MUST NOT BE A FALL.
//
// This is the regression the change most plausibly creates, and it is not
// hypothetical: `sit()` MOVES you to the seat pose and `stand()` moves you again
// by up to a 1.4 m search ring. `support` is the floor you were last standing
// on, and while the fall was gated on `heldByTop` those two moves were harmless
// — the flag was cleared and terrain could not start a fall anyway. With the
// gate gone, a stale `support` from wherever you were standing before you sat
// is a drop the moment you get up.
//
// `fp.ts` now re-bases `support` in both `sit()` and `stand()` instead of
// clearing a flag. This is the check on that, and it WALKS/SITS rather than
// inspecting: CLAUDE.md is explicit that seats are verified by sitting in them.
//
// ⚠ THE INTERACTION KEY MUST BE HELD. BUILDER-BRIEF §5: `[E]` is an edge read
// once per rendered frame, so `press('e')` can begin and end inside one frame
// and never be observed. That made a working feature report three false
// failures once already.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-stand-up-is-not-a-fall.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4191/');
const WANT = Number(process.env.SEATS ?? 8);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.seats && window.__ct.warp, null, { timeout: 60000 });

// A SEAT IS TWO PLACES, and my first cut used neither: `{ x, z }` is not on the
// object at all, so it warped to `undefined` eight times and reported "sat in
// nothing". `at` is where you STAND to be offered the seat and `pose` is where
// the seat puts you — you must warp to `at`, and you must FACE `pose` or the
// aim-weighted `pickSpot` will not offer it.
const seats = await p.evaluate(() => (window.__ct.seats?.() ?? [])
  .filter((s) => s.at && s.pose)
  .map((s) => ({ x: s.at.x, z: s.at.z, label: s.label,
    yaw: Math.atan2(s.pose.x - s.at.x, -(s.pose.z - s.at.z)) })));
if (!seats.length) { console.log('ABORT the world publishes no seats — nothing to sit in (GOTCHAS §32)'); await b.close(); process.exit(3); }
console.log(`${seats.length} seats published; sitting in ${Math.min(WANT, seats.length)} spread across the list\n`);

const pick = [];
const stride = Math.max(1, Math.floor(seats.length / WANT));
for (let i = 0; i < seats.length && pick.length < WANT; i += stride) pick.push(seats[i]);

const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
let sat = 0, bad = 0, stuck = 0, modal = 0;
for (const s of pick) {
  // stand ON the seat's own spot, then sit
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y ?? 0, undefined, 0), [s.x, s.z, s.yaw]);
  await p.waitForTimeout(320);
  await hold('e', 110);
  await p.waitForTimeout(320);
  const seated = await p.evaluate(() => !!window.__ct.seated?.());
  if (!seated) continue;                  // no seat here; not this probe's verdict
  sat++;
  // get up, and watch the camera for a second afterwards
  const t = await p.evaluate(async () => {
    const ev = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k }));
    ev('keydown', 'e'); await new Promise((r) => setTimeout(r, 110)); ev('keyup', 'e');
    const o = []; const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        const q = window.__ct.pos();
        o.push([+window.__ct.camY().toFixed(5), +window.__ct.groundAt(q[0], q[2]).toFixed(5)]);
        if (performance.now() - t0 > 1000) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return o;
  });
  // The settled eye height is the LAST frame's, measured rather than typed —
  // a hand-typed 1.62 would quietly become a crouch measurement one day.
  const rest = t.at(-1)[0] - t.at(-1)[1];
  // A FALL after standing shows as the eye sitting high above its floor early on
  // and easing down. Head bob is 0.035 and you are not walking here, so
  // anything over 0.08 is airtime, not bob.
  const peak = Math.max(...t.map((f) => f[0] - f[1] - rest));
  const stillSeated = await p.evaluate(() => !!window.__ct.seated?.());

  // ⚠ TWO VERDICTS, NOT ONE, AND CONFLATING THEM IS THE BUG THIS PROBE ALMOST
  // SHIPPED. The first cut printed "stood up into a fall" for four seats whose
  // settled eye was 1.050 m — a SEATED eye height. They had not fallen; they
  // had never got up, so `rest` was the seated height and the 0.345 m "peak"
  // was the sit-down transition still in the trace. It reported the identical
  // four rows against the UNCHANGED world, which is the only reason I caught
  // it: a regression probe that says the same thing before and after is
  // measuring something else.
  if (stillSeated) {
    // …AND THEN A THIRD VERDICT, because "E did not get me up" is still not the
    // same as "I am trapped". Every one of these is a casino seat, and a casino
    // seat opens a MODAL: `ct/hud.ts` blocks keydown while a panel is up, so the
    // E is eaten by the panel and never reaches the rig. Escape is the documented
    // way out of exactly that (BUILDER-BRIEF §11), so ask it before filing a
    // trapped-player bug — which is the most serious thing this project ships and
    // deserves better than a probe that only knows one key.
    // ⚠ AND GIVE IT TIME. At 280 ms this reported **3 seats "neither E nor
    // Escape got the player up"** — a trapped player, the most serious thing
    // this project ships — and every one of them was this wait being too short.
    // Driven by hand at 700 ms the same slot seat stands up on the FIRST E,
    // repeatedly. Three separate instrument faults in one probe now, which is
    // BUILDER-BRIEF §7's ratio exactly; the difference between a finding and a
    // false alarm here was one `waitForTimeout`.
    //
    // ⚠⚠ AND CHECK AFTER *EACH* KEY, NOT AFTER THE PAIR. Pressing Escape then E
    // unconditionally reported the SAME three slot seats as trapped however long
    // I waited — because Escape had already stood the player up, and the E that
    // followed **sat him straight back down**: he is still on the seat's own
    // stand spot with the prompt showing, so E is "sit", not "stand". Driven by
    // hand the state alternates seated/not on every press, which is the shape
    // that gave it away. A probe that presses a toggle twice and reads the end
    // state has measured the parity of its own key count.
    await hold('Escape', 140);
    await p.waitForTimeout(700);
    let reallyStuck = await p.evaluate(() => !!window.__ct.seated?.());
    if (reallyStuck) {
      await hold('e', 140);
      await p.waitForTimeout(700);
      reallyStuck = await p.evaluate(() => !!window.__ct.seated?.());
    }
    if (reallyStuck) {
      stuck++;
      console.log(`  STUCK seat (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  "${s.label}"`
        + ' — neither E nor Escape got the player up. BUILDER-BRIEF §11, and NOT this item');
    } else {
      modal++;
      console.log(`  modal seat (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  "${s.label}"`
        + ' — E is consumed by the panel; Escape closes it and E then stands. Not a defect');
    }
    continue;
  }
  const ok = peak <= 0.08;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} seat (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`
    + `  settled eye ${rest.toFixed(3)} m  peak above it after standing ${peak.toFixed(3)} m`);
}

console.log(`\nsat in ${sat} of ${pick.length} tried; ${bad} stood up INTO A FALL`
  + `; ${modal} were modal (Escape then E); ${stuck} genuinely trapped`);
if (errs.length) console.log(`PAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
if (!sat) { console.log('ABORT sat in nothing — this measured NOTHING, it is not a pass'); await b.close(); process.exit(3); }
await b.close();
process.exit(bad ? 1 : 0);
