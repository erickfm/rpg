#!/usr/bin/env node
// WHY THE JUMP NEVER REACHES ITS ANALYTIC APEX.
//
// `fp.ts`'s comment quotes 0.571 m, which is the closed form v0^2/2g = 16/28 for
// vy 4.0 against gravity 14. The world does not reach it and cannot: the
// integrator is SEMI-IMPLICIT (symplectic) Euler and decrements vy BEFORE it
// integrates position (fp.ts:452-458), so every frame the position is advanced
// with the velocity it will have at the END of the step rather than the start.
//
//   vy  -= g*dt
//   airY = max(0, airY + vy*dt)
//
// Summing that to the sign change gives a discrete apex of
//
//   apex(dt) = v0^2/(2g) - v0*dt/2   =   0.5714 - 2*dt      (v0=4, g=14)
//
// so the analytic figure is the dt -> 0 LIMIT, approached from below and never
// attained. `src/main.ts:107` clamps dt to 0.05, which puts a HARD FLOOR under
// the hop at 0.4750 m — not noise, a reachable exact value, and the one this
// probe sees most often under headless load.
//
// This measures the world and checks it against that formula, so the comment
// `fp.ts` carries is backed by a run rather than by arithmetic alone.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w25-jump-apex.mjs
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. There is no default —'
    + ' jump-walk.mjs defaults to 4185, which has been somebody else\'s world all'
    + ' session (GOTCHAS §26, §48).');
  process.exit(3);
}

const V0 = 4.0, G = 14, DT_CLAMP = 0.05;         // fp.ts:452-458 and main.ts:107
const predict = (dt) => V0 * V0 / (2 * G) - V0 * dt / 2;

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}
await reportWorld(p, URL);

// Settle on the pavement, and take the baseline from the world at rest rather
// than from a typed eye height — the 5.260 m reading in jump-walk.mjs's header
// was a hand-typed baseline subtracted from a camera that had not settled.
await p.evaluate(() => window.__ct.warp(-6.0, -20.0, 0, 0.14, 0));
const rest = await p.evaluate(() => new Promise((resolve, reject) => {
  let last = null, stable = 0, frames = 0;
  const tick = () => {
    const y = window.__ct.camY();
    if (last !== null && Math.abs(y - last) < 1e-4) stable++; else stable = 0;
    last = y;
    if (stable >= 6) return resolve(y);
    if (++frames > 300) return reject(new Error('camera never settled'));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));

console.log(`\nJUMP APEX vs FRAME TIME — the analytic 0.5714 m is a limit, not a height.\n`);
console.log(`  predicted apex(dt) = ${(V0 * V0 / (2 * G)).toFixed(4)} - ${(V0 / 2).toFixed(1)}*dt`);
console.log(`  dt is clamped to ${DT_CLAMP} in main.ts:107, so the hop cannot be`
  + ` shorter than ${predict(DT_CLAMP).toFixed(4)} m\n`);

// Sample the camera AND the frame intervals across the same hop, in-page on
// requestAnimationFrame, so the apex and the dt that produced it come from the
// same frames. Polling from node on a wall-clock timer cannot see either.
const runs = [];
for (let i = 0; i < 6; i++) {
  // WAIT FOR THE HOP TO END, NEVER FOR A CONSTANT. A fixed 1100 ms window —
  // which is what this had, and what jump-walk.mjs still has — is a bet on
  // wall-clock speed that the dt clamp makes unsafe: at the 0.05 s clamp the
  // hop needs ~12 physics steps, and under load those 12 frames can span well
  // over a second of real time, so the window closes mid-ascent and reports a
  // truncated peak. That is exactly how this probe produced a 0.1632 m "apex",
  // which is below a floor the physics cannot go under — the instrument, not
  // the world (GOTCHAS §30).
  //
  // So the page decides when the hop is over: it must take off, and then come
  // back to rest for 4 consecutive frames.
  const hop = p.evaluate((rest) => new Promise((resolve) => {
    let peak = -Infinity, took = false, back = 0, frames = 0;
    const dts = []; let prev = performance.now();
    const f = (now) => {
      dts.push((now - prev) / 1000); prev = now;
      const y = window.__ct.camY();
      peak = Math.max(peak, y);
      if (y > rest + 0.02) took = true;
      if (took && Math.abs(y - rest) < 5e-3) back++; else back = 0;
      if ((took && back >= 4) || ++frames > 600) {
        return resolve({ peak, dts: dts.filter((x) => x > 0).map((x) => Math.min(x, 0.05)), took, frames });
      }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }), rest);
  await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' ');
  const r = await hop;
  if (!r.took) { console.log(`  run ${i + 1}: the hop never left the ground — skipped`); continue; }
  const rise = r.peak - rest;
  // The apex is set by the frames DURING the ascent, which is the first ~0.29 s.
  const asc = r.dts.slice(0, Math.max(1, Math.round(0.29 / (r.dts.reduce((a, x) => a + x, 0) / r.dts.length))));
  const meanDt = asc.reduce((a, x) => a + x, 0) / asc.length;
  runs.push({ rise, meanDt, pred: predict(meanDt) });
  console.log(`  run ${i + 1}: apex ${rise.toFixed(4)} m   mean dt over the ascent`
    + ` ${meanDt.toFixed(4)} s (${(1 / meanDt).toFixed(0)} fps)   formula says ${predict(meanDt).toFixed(4)} m`);
}

const rises = runs.map((r) => r.rise);
const lo = Math.min(...rises), hi = Math.max(...rises);
console.log(`\n  measured apex range across ${runs.length} hops: ${lo.toFixed(4)} - ${hi.toFixed(4)} m\n`);

check(hi < V0 * V0 / (2 * G) - 1e-3,
  `every hop falls SHORT of the analytic ${(V0 * V0 / (2 * G)).toFixed(4)} m —`
  + ` the tallest was ${hi.toFixed(4)} m, so the quoted figure is unreachable, not merely approximate`);

check(lo >= predict(DT_CLAMP) - 0.002,
  `and none falls below the ${predict(DT_CLAMP).toFixed(4)} m floor that main.ts:107's`
  + ` ${DT_CLAMP} s dt clamp puts under it (lowest ${lo.toFixed(4)} m)`);

// The formula has to TRACK the frame time, not merely bracket it — that is the
// difference between "the apex varies" and "the apex is 0.5714 - 2*dt".
const worst = Math.max(...runs.map((r) => Math.abs(r.rise - r.pred)));
check(worst < 0.02,
  `and each hop matches 0.5714 - 2*dt computed from the frames that produced it,`
  + ` worst deviation ${worst.toFixed(4)} m — the shortfall IS the integrator's, not noise`);

check(errs.length === 0, `no page errors (${errs.length})`);

await b.close();
console.log(bad === 0 ? '\n  the comment should quote a range and a formula, not 0.571.\n'
                      : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
