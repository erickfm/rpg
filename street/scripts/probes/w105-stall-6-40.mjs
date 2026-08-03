// Item 265 — REPRODUCE FIRST. "Walking north from (6, −40) the player stalls
// for 5.5–6.0 SECONDS near z ≈ −36. Five runs out of five."
//
// This probe establishes WHAT is happening before anything is changed. It does
// not test a hypothesis; it records the walk and whatever was standing near him
// while it happened, and prints both.
//
// ⚠ NORTH IS +z HERE, and it is derived, not assumed. `crosstown.ts:1195` gives
// the rig convention `fwd = (sin yaw, 0, −cos yaw)`, so yaw = π walks toward
// +z; and D-walk's own stations put "side st N" at z = −96.5 against "side st S"
// at z = −109.5, so the larger z IS north. Walking north from z = −40 therefore
// passes z = −36, which is where the row says he stops. The two agree, which is
// the only reason to believe either.
//
// ⚠ SAMPLED PER FRAME IN-PAGE, not by polling from node. A stall is a time
// measurement and `page.evaluate` round trips are tens of milliseconds each —
// polling from outside would smear a 6 s stop into something with no edges.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const FROM = [Number(process.env.FROM_X ?? 6), Number(process.env.FROM_Z ?? -40)];
const YAW = process.env.YAW !== undefined ? Number(process.env.YAW) : Math.PI;  // north = +z
const HOLD = Number(process.env.HOLD_MS ?? 14000);
const RUNS = Number(process.env.RUNS ?? 5);
// A STALL IS "he is holding forward and going nowhere". 0.05 m/frame at ~60 fps
// is ~3 m/s; walking pace is well above 0.2 m/s, so 0.02 m over a 10-frame
// window is comfortably below anything that counts as movement and comfortably
// above float noise.
const STILL_M = 0.02, WIN = 10;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const rows = [];
for (let run = 0; run < RUNS; run++) {
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [FROM[0], FROM[1], YAW]);
  await p.waitForTimeout(400);
  // Per-frame sampler. Also snapshots every citizen and vehicle within 6 m, so
  // the record says WHO was there rather than leaving it to be guessed at.
  await p.evaluate(() => {
    window.__S = [];
    const t0 = performance.now();
    const tick = () => {
      const q = window.__ct.pos();
      const near = (window.__ct.walkers?.() ?? [])
        .map((w) => ({ x: w.x, z: w.z, d: Math.hypot(w.x - q[0], w.z - q[2]) }))
        .filter((w) => w.d < 6).sort((a, c) => a.d - c.d).slice(0, 4);
      window.__S.push({ t: performance.now() - t0, x: q[0], z: q[2], near });
      window.__Sraf = requestAnimationFrame(tick);
    };
    window.__Sraf = requestAnimationFrame(tick);
  });
  await p.keyboard.down('w');
  await p.waitForTimeout(HOLD);
  await p.keyboard.up('w');
  await p.evaluate(() => cancelAnimationFrame(window.__Sraf));
  const S = await p.evaluate(() => window.__S);

  // longest run of consecutive WIN-frame windows that moved less than STILL_M
  let worst = null, cur = null;
  for (let i = WIN; i < S.length; i++) {
    const moved = Math.hypot(S[i].x - S[i - WIN].x, S[i].z - S[i - WIN].z);
    if (moved < STILL_M) {
      if (!cur) cur = { i0: i - WIN, i1: i };
      else cur.i1 = i;
    } else if (cur) {
      if (!worst || (cur.i1 - cur.i0) > (worst.i1 - worst.i0)) worst = cur;
      cur = null;
    }
  }
  if (cur && (!worst || (cur.i1 - cur.i0) > (worst.i1 - worst.i0))) worst = cur;

  const first = S[0], last = S[S.length - 1];
  const secs = worst ? (S[worst.i1].t - S[worst.i0].t) / 1000 : 0;
  rows.push({
    run: run + 1,
    frames: S.length,
    from: `(${first.x.toFixed(2)}, ${first.z.toFixed(2)})`,
    to: `(${last.x.toFixed(2)}, ${last.z.toFixed(2)})`,
    dist: Math.hypot(last.x - first.x, last.z - first.z),
    stall: secs,
    at: worst ? `(${S[worst.i0].x.toFixed(2)}, ${S[worst.i0].z.toFixed(2)})` : '—',
    who: worst ? JSON.stringify(S[worst.i0].near.map((w) => `${w.d.toFixed(2)}m`)) : '[]',
  });
}

console.log(`\nwalking from (${FROM[0]}, ${FROM[1]}) at yaw ${YAW.toFixed(3)}`
  + ` (fwd ${Math.sin(YAW).toFixed(2)}, ${(-Math.cos(YAW)).toFixed(2)}), holding W for ${HOLD} ms\n`);
console.log('run  frames  from            to              travelled  LONGEST STALL  where           walkers within 6 m');
for (const r of rows) {
  console.log(`${String(r.run).padStart(3)}  ${String(r.frames).padStart(6)}  ${r.from.padEnd(15)} ${r.to.padEnd(15)}`
    + ` ${r.dist.toFixed(2).padStart(8)} m  ${r.stall.toFixed(2).padStart(8)} s   ${r.at.padEnd(15)} ${r.who}`);
}
const st = rows.map((r) => r.stall);
console.log(`\nstall spread over ${rows.length} runs: min ${Math.min(...st).toFixed(2)} s,`
  + ` max ${Math.max(...st).toFixed(2)} s,`
  + ` median ${st.slice().sort((a, c) => a - c)[Math.floor(st.length / 2)].toFixed(2)} s`);
if (errs.length) console.log(`\nPAGE ERRORS (${errs.length}): ${errs.slice(0, 3).join(' | ')}`);
await b.close();
