// ITEM 172 — HOW MUCH RELIEF DOES THE PARK ACTUALLY HAVE, and is it strollable?
//
// The user: *"try to add some y diversity here. the height is soooo flat."*
//
// This sweeps the world's OWN floor picker (`__ct.groundAt`, which runs
// `groundPick`) over the published park site on a 0.2 m grid and reports:
//
//   RANGE   max - min of the floor over the site — the number the user's
//           complaint is about. "soooo flat" is a statement about this.
//   GRADE   the steepest rise/run between 0.2 m-adjacent samples, as 1-in-N.
//           The constraint the item calls non-negotiable.
//   STEP    the largest single-sample jump, which is what you trip over. The
//           picker is sampled, not swept, so a genuine discontinuity and a
//           steep-but-continuous grade look the same in GRADE; STEP separates
//           them by comparing the jump against what the local grade predicts.
//   FLOOR   the minimum, which must stay above the roadway.
//
// WHY IT SWEEPS THE PICKER AND NOT THE MESH. `ct/park.ts`'s discipline is "one
// function, two consumers" — the mesh is displaced by `relief` and the floor
// picker answers `relief`. A probe that re-implemented `relief` here would be
// the second hand-typed copy the brief §8 warns about, and would agree with the
// source while disagreeing with the world. The picker is what the player's feet
// actually get, so the picker is what gets measured.
//
// POPULATION FLOOR. A grid over a 32 x 30 m site at 0.2 m is ~24,000 samples.
// Anything under 10,000 means the site came back wrong (or empty) and every
// number below would be a confident lie about nothing — so it aborts instead.
// This is not decoration: `sites()` returning `{}` on a world that failed to
// build would otherwise print "RANGE 0.000 m" and read as a successful
// measurement of a flat park.
//
// SELF-TEST BOTH SIGNS. `--selftest` swaps the picker for three grounds whose
// answer is known in advance and checks the sweep reproduces each:
//
//   ramp   a pure 1-in-8 plane      GRADE must read 1 in 8, STEP must read ~0
//   cliff  flat with one 0.25 m lip STEP must read ~250 mm
//   flat   dead flat                RANGE 0, GRADE infinite, STEP 0
//
// The third is the case that matters most and is the one this file did not have
// on its first draft: a probe that reports relief on flat ground is worse than
// one that reports none on a slope, because it makes the fix look done. The
// first draft's ramp was also wrong — 1 in 16 written as 1 in 8, plus an
// unintended 0.75 m cliff — and the self-test is what caught it, before any
// number about the park had been believed.
//
//   SHOT_URL=http://localhost:4390/ node scripts/probes/w83-park-relief.mjs
//   SHOT_URL=http://localhost:4390/ node scripts/probes/w83-park-relief.mjs --selftest
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4390/';
const SELFTEST = process.argv.includes('--selftest');
const STEP = 0.2;
/** The known ground for each self-test case, as source text evaluated in the
 *  page. `d` is the distance in metres from the site's west edge along x, `e`
 *  the distance from its south edge along z. */
const CASES = {
  //  0.2 m of run must produce 0.025 m of rise: 1 in 8 exactly.
  ramp: { fn: '(d, e) => 0.14 + d * 0.125', grade: 8, step: 0, range: null },
  //  flat either side of one lip at 10 m in along z — a discontinuity, not a
  //  slope, and the one thing GRADE alone cannot tell apart from a bank.
  cliff: { fn: '(d, e) => 0.14 + (e > 10 ? 0.25 : 0)', grade: 0.8, step: 0.25, range: 0.25 },
  //  THE NEGATIVE CASE. Nothing here is sloped, stepped or varied, and all
  //  three numbers must say so.
  flat: { fn: '(d, e) => 0.14', grade: Infinity, step: 0, range: 0 },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// SITE=lot sweeps the car lot instead. That is not a curiosity: `openSite` in
// ct/street.ts is SHARED, and item 172 changed it — its ground plane went from
// one quad to a subdivided grid so a module could take it over. The lot never
// calls `displace`, so the lot must still be perfectly flat, and this is the
// regression guard that says so. A change to a shared builder that is only ever
// checked on the one site that wanted it is a change nobody checked.
const SITE = process.env.SITE || 'park';
const sites = await page.evaluate(() => window.__ct.sites());
const park = sites[SITE];
if (!park) { console.log(`ABORT  no '${SITE}' site published`); await browser.close(); process.exit(3); }
console.log(`${SITE} site  x ${park.minX.toFixed(2)}…${park.maxX.toFixed(2)}  z ${park.minZ.toFixed(2)}…${park.maxZ.toFixed(2)}  y ${park.y.toFixed(3)}`);

// The sweep runs IN THE PAGE — 24k round trips over CDP is minutes, one
// evaluate is milliseconds, and the picker is synchronous so there is nothing
// to await inside it.
//
// ONE ARITHMETIC, FOUR GROUNDS. The self-test cases and the real park go
// through this identical function; `fnSrc` is either null (use the world's own
// picker) or the source of a known ground. Nothing about the measurement
// differs between a self-test run and a real one, which is the only thing that
// makes a green self-test evidence about the real number.
const sweep = (fnSrc) => page.evaluate(([p, step, src]) => {
  const known = src ? (0, eval)(src) : null;
  const pick = known
    ? (x, z) => known(x - p.minX, z - p.minZ)
    : window.__ct.groundAt;
  let n = 0, min = Infinity, max = -Infinity;
  let worstG = 0, worstGAt = null;
  let worstS = 0, worstSAt = null;
  const nx = Math.floor((p.maxX - p.minX) / step);
  const nz = Math.floor((p.maxZ - p.minZ) / step);
  // one row of heights at a time, so a 24k grid never sits in memory twice
  let prevRow = null;
  for (let i = 0; i <= nx; i++) {
    const x = p.minX + i * step;
    const row = new Float64Array(nz + 1);
    for (let j = 0; j <= nz; j++) {
      const z = p.minZ + j * step;
      const y = pick(x, z);
      row[j] = y;
      if (Number.isFinite(y)) { n++; if (y < min) min = y; if (y > max) max = y; }
    }
    // grade along z within the row, and along x against the previous row
    for (let j = 0; j <= nz; j++) {
      if (j > 0) {
        const d = Math.abs(row[j] - row[j - 1]);
        if (d > worstG) { worstG = d; worstGAt = [x, p.minZ + j * step, 'z']; }
      }
      if (prevRow) {
        const d = Math.abs(row[j] - prevRow[j]);
        if (d > worstG) { worstG = d; worstGAt = [x, p.minZ + j * step, 'x']; }
      }
    }
    // STEP: a jump between adjacent samples that is far larger than the jumps
    // on either side of it is a discontinuity, not a slope. Compared against
    // the neighbouring differences rather than an absolute threshold, because
    // a legitimately steep bank has large differences everywhere and a cliff
    // has one.
    for (let j = 2; j < nz - 1; j++) {
      const d = Math.abs(row[j] - row[j - 1]);
      const around = Math.max(Math.abs(row[j - 1] - row[j - 2]), Math.abs(row[j + 1] - row[j]));
      const excess = d - around * 1.5;
      if (excess > worstS) { worstS = excess; worstSAt = [x, p.minZ + j * step]; }
    }
    prevRow = row;
  }
  return { n, min, max, worstG, worstGAt, worstS, worstSAt, nx, nz };
}, [park, STEP, fnSrc]);

const oneIn = (d) => (d <= 1e-9 ? Infinity : STEP / d);
/** POPULATION FLOOR — see the header. A thin grid means the site did not
 *  resolve, and every number after it would be a confident statement about
 *  nothing. Returns null rather than throwing so the caller decides.
 *
 *  PROPORTIONAL, NOT ABSOLUTE. This was a flat 10,000 and it was wrong: the
 *  jail forecourt is 18 x 14 m, so a complete, correct sweep of it is 6,461
 *  samples and the guard rejected it. An absolute floor is really two
 *  assertions confused with each other — "the site has extent" and "every
 *  point in it answered" — so they are separated here. The second is the one
 *  that catches a picker returning NaN, which is the failure the floor exists
 *  for; `groundPick` never returns null, so a hole shows up as a missing
 *  finite value and nothing else. */
const report = (label, out) => {
  const range = out.max - out.min;
  const g = oneIn(out.worstG);
  const expect = (out.nx + 1) * (out.nz + 1);
  console.log(`\n── ${label} ──`);
  console.log(`samples    ${out.n} of ${expect}  (${out.nx + 1} x ${out.nz + 1} at ${STEP} m)`);
  if (expect < 400) {
    console.log(`ABORT  the site is only ${out.nx * STEP} x ${out.nz * STEP} m — it did not resolve`);
    return null;
  }
  if (out.n < expect) {
    console.log(`ABORT  ${expect - out.n} of ${expect} points returned a non-finite height`);
    return null;
  }
  console.log(`RANGE      ${range.toFixed(3)} m   (floor ${out.min.toFixed(3)} … ${out.max.toFixed(3)})`);
  console.log(`GRADE      1 in ${g.toFixed(1)}   (rise ${out.worstG.toFixed(4)} m over ${STEP} m)` +
    (out.worstGAt ? `  at x ${out.worstGAt[0].toFixed(2)} z ${out.worstGAt[1].toFixed(2)} along ${out.worstGAt[2]}` : ''));
  console.log(`STEP       ${(out.worstS * 1000).toFixed(1)} mm of excess over the local grade` +
    (out.worstSAt ? `  at x ${out.worstSAt[0].toFixed(2)} z ${out.worstSAt[1].toFixed(2)}` : ''));
  console.log(`FLOOR      ${out.min.toFixed(4)} m`);
  return { range, g, step: out.worstS, floor: out.min };
};

if (SELFTEST) {
  let bad = 0;
  const near = (a, b, tol) => (a === Infinity && b === Infinity) || Math.abs(a - b) <= tol;
  for (const [name, c] of Object.entries(CASES)) {
    const r = report(`selftest: ${name}`, await sweep(c.fn));
    if (!r) { bad++; continue; }
    const okG = near(r.g, c.grade, Math.max(0.05, c.grade === Infinity ? 0 : c.grade * 0.05));
    const okS = Math.abs(r.step - c.step) <= 0.02;
    const okR = c.range === null || Math.abs(r.range - c.range) <= 0.02;
    for (const [what, ok, want, got] of [
      ['grade', okG, c.grade === Infinity ? 'no slope' : `1 in ${c.grade}`, `1 in ${r.g.toFixed(2)}`],
      ['step', okS, `${(c.step * 1000).toFixed(0)} mm`, `${(r.step * 1000).toFixed(0)} mm`],
      ['range', okR, c.range === null ? '(unchecked)' : `${c.range.toFixed(2)} m`, `${r.range.toFixed(3)} m`],
    ]) {
      if (!ok) bad++;
      console.log(`SELFTEST  ${name}/${what}  ${ok ? 'PASS' : 'FAIL'}  want ${want}, got ${got}`);
    }
  }
  console.log(`\n${bad === 0 ? 'SELFTEST GREEN — the sweep sees a slope, sees a step, and invents neither on flat ground'
    : `SELFTEST RED — ${bad} assertion(s) failed; no number this probe prints about the park is trustworthy`}`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
}

const r = report(`${SITE}, as built`, await sweep(null));
if (errors.length) console.log(`\nconsole errors: ${errors.length}\n  ${errors.join('\n  ')}`);
await browser.close();
process.exit(r ? 0 : 3);
