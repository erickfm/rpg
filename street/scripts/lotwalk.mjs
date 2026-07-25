// Can a pedestrian get into the lot, and does the fence stop them everywhere
// else? Walks the rig east off the pavement across the frontage and reports
// how far it gets. The collider list alone cannot answer this — a gap in the
// fence is worth nothing if a blanket box is lying across it.
//
// IT ASKS WHERE THE LOT IS. The z values used to be a typed list, which was
// right when written and would have gone on passing after the lot moved — and
// this lot HAS moved, more than once, as D reordered the roster. A hardcoded
// coordinate is a check that quietly starts testing empty pavement. The span
// comes from ct/lot.ts's own `userData.mod` stamps, so the walk follows the
// building.
//
// AN EMPTY STREET, and that is a real limit rather than a quibble. Citizens
// are not in `__ct.colliders()` — measured: 310 boxes, unchanged over ten
// seconds with six people walking about — so nobody can block this walk and
// nobody can make it flap. What it proves is that the FENCE and the GATE are
// where they should be, which is a question about built geometry.
//
// Whether the world stays connected when it is busy is a different question,
// answered in b0398ead by flood-filling with the movers included: "car lot
// mid" reachable in all four fills.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lotwalk.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
// --selftest: wall the mouth shut in the LIVE collider list and require this
// to go red. The mutation is a push onto __ct.colliders(), which is the same
// array the movement code tests, so it is the real thing being broken.
const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.mouse.click(640, 360); await p.waitForTimeout(500);

// Where is the lot? Read it off its own meshes rather than remembering it.
const span = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let z0 = 1e9, z1 = -1e9;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
  });
  return z0 > z1 ? null : [z0, z1];
});
if (!span) { console.error('no meshes stamped `lot` — is the lot in this world at all?'); process.exit(1); }
console.log(`lot frontage z ${span[0].toFixed(1)} … ${span[1].toFixed(1)}, from its own stamps`);

// Sample across the frontage and a little past each end, so "the fence stops
// you" is tested outside the lot as well as along it.
// HOW LONG TO HOLD W. The rig covers about 3.3 m/s, and the test is "did it
// get more than 3 m past the building line" — so 1.2 s is 4 m of travel,
// comfortably over the line and comfortably short of the 8 m the aisle allows.
// It was 2.6 s, which walked to the back fence and then stood there: 28 samples
// of dead time made this the slowest check in `npm run checks` at 98 s, and a
// shared runner should not be dominated by one builder's script.
// HOLD, and the criterion that made it safe to shorten.
//
// This held W for 2.6 s per sample, which walked to the back fence and then
// stood there. 28 samples of dead time made it the slowest check in
// `npm run checks` at 98 s, and a shared runner should not be dominated by one
// builder's script.
//
// Shortening it exposed the real problem, which was the CRITERION, not the
// time: "did it travel more than 3 m" put the pass mark inside the noise once
// the walk was short — 3.46 m against a 3 m line is one sample away from
// flipping, and a flaky check is worse than a slow one.
//
// So ask WHERE IT ENDED UP instead of how far it got. Blocked samples stop
// dead at x ~6.5 against the site boundary; ones that get in reach x >= 9.
// That is a 2.5 m gap rather than a 0.4 m one, and it does not depend on how
// long the key was held so long as the rig has cleared the gate.
const HOLD = 1600;
const INSIDE_X = 8.0;
const STEP = 1.0;
const ZS = [];
for (let z = span[0] - 2; z <= span[1] + 2; z += STEP) ZS.push(+z.toFixed(2));

if (SELFTEST) {
  const n = await p.evaluate(([z0, z1]) => {
    window.__ct.colliders().push({ minX: 6.9, maxX: 7.4, minZ: z0, maxZ: z1 });
    return 1;
  }, span);
  console.log(`selftest: walled the frontage shut (${n} collider) — this MUST now go red`);
}

// FACE is 7; the walk is west of it. Start on the pavement and hold W facing east.
const start = 5.6;
const RESULT = [];
for (const z of ZS) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0), [start, z]);
  await p.waitForTimeout(120);
  await p.keyboard.down('w');
  // WALK UNTIL IT STOPS, don't hold W for a fixed time. Movement is driven by
  // the render loop, so `HOLD` milliseconds buys frames, and frames are what
  // the suite is short of: run twelve of these at once and the rig covers
  // 7.25-7.75 m instead of 9, every sample reads `blocked`, and the script
  // goes red on a lot you can walk straight into. Measured, 9 of 12 red.
  //
  // It failed SAFE — the opening needs the most travel, so it breaks first and
  // the "an opening exists" assertion catches it — but a check that cries wolf
  // whenever the machine is busy is one people learn to re-run rather than
  // read. GOTCHAS 30.
  //
  // So stop on the ANSWER: either the rig is inside, or it has stopped making
  // progress, which is what "the fence stopped me" actually looks like. HOLD
  // survives as the cap only.
  const walk = await p.evaluate(([insideX, cap]) => new Promise((res) => {
    const t0 = performance.now(); let lastX = window.__ct.pos()[0], stuck = 0, f = 0;
    const tick = () => {
      const x = window.__ct.pos()[0]; f++;
      if (x > insideX) return res({ x, f, why: 'inside', ms: +(performance.now() - t0).toFixed(0) });
      stuck = (x - lastX < 0.004) ? stuck + 1 : 0;
      lastX = x;
      if (stuck >= 8) return res({ x, f, why: 'stopped', ms: +(performance.now() - t0).toFixed(0) });
      if (performance.now() - t0 > cap) return res({ x, f, why: 'cap', ms: +(performance.now() - t0).toFixed(0) });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [INSIDE_X, HOLD * 4]);
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  const [x2, , z2] = await p.evaluate(() => window.__ct.pos());
  if (walk.why === 'cap') console.warn(`  [walk] z=${z} hit the ${HOLD * 4} ms cap still moving `
    + `(${walk.f} frames, x=${walk.x.toFixed(2)}) — neither in nor stopped`);
  const got = x2 - start;
  const inside = x2 > INSIDE_X;
  RESULT.push([z, inside]);
  console.log(`z=${String(z).padStart(5)}  walked ${got.toFixed(2)} m east -> x=${x2.toFixed(2)} z=${z2.toFixed(2)}  ${inside ? 'IN' : 'blocked'}`);
}
await b.close();

// ── the verdict ───────────────────────────────────────────────────────────
// This used to print IN/blocked and exit 0 whatever it found, which made ME
// the assertion: every round I ran it and counted the lines by hand. A report
// that a human has to read is not a check — wall the mouth and it would have
// gone on being green.
//
// Two things have to hold, and they are different failures:
//   1. you can get IN somewhere        — or the lot is sealed
//   2. you are stopped at both ENDS    — or the fence is not doing anything
const ins = RESULT.filter((r) => r[1]);
const ends = [RESULT[0], RESULT[RESULT.length - 1]];
const fail = [];
if (!ins.length) fail.push('no opening at all — the lot cannot be entered');
if (ends.some((r) => r[1])) fail.push('walked in past the END of the frontage — the fence stops short');
if (ins.length && ins.length === RESULT.length) fail.push('every sample got in — there is no fence');
if (fail.length) {
  console.error(`\nFAILED:`);
  for (const f of fail) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the sealed mouth was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the frontage was walled shut and this did not notice.'); process.exit(2); }
console.log(`\nopening at z ${ins[0][0]} … ${ins[ins.length - 1][0]}, ${ins.length} of ${RESULT.length} samples;`);
console.log(`stopped at both ends and everywhere else — the fence holds.`);
