// Is the 1.5 s mover filter's window long enough?
//
// lane3, lanewalk and corridor all decide "is this furniture" by MOTION: snapshot
// the collider list twice ~1.5 s apart and keep whatever did not move. A citizen
// who stands still for the whole window is byte-identical in both frames and is
// kept as furniture. That is exactly the failure behind 3f7b2623 (the mid-walk
// "post" was a stopped citizen), and G's 19e1e9f9 validated their own walk this
// way and handed the same hole back to me.
//
// This re-runs the corridor measurement under BOTH windows — the 1.5 s one my
// scripts use, and a ~22 s one — and reports:
//   * ghosts: boxes the short window called static but which moved later
//   * whether the corridor answer differs between the two sets
//
// Note the monotonicity, which is the real point: the long-window static set is a
// SUBSET of the short-window one, so dropping ghosts can only ever make a passage
// wider. A ghost can therefore only manufacture a falsely NARROW finding, never a
// falsely clear one.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const LONG_MS = Number(process.env.LONG_MS ?? 22000);

/**
 * THE VERDICT, AND WHY THIS SCRIPT HAD NONE.
 *
 * Until now this file printed `** DIFFERS **` and exited 0. Not "exited 0 by an
 * accident of control flow" — it contained no `process.exit` and no
 * `process.exitCode` **anywhere**, so there was no input, real or imagined, that
 * could make it non-zero. Anything that ran it in a suite and read its status
 * was reading a constant.
 *
 * It is separated out as a pure function of the measurement so that
 * `--selftest` can drive it with synthetic input, both signs, with no browser
 * and no world. A red check nobody has ever seen go red is a check nobody
 * should trust (GOTCHAS 58), and the failing case here is not one you can
 * arrange on demand — it needs a citizen to stand still through the whole
 * window.
 *
 * WHAT COUNTS AS FAILURE IS **THE CORRIDOR ANSWER DIFFERING**, NOT THE PRESENCE
 * OF GHOSTS, and that is this file's own reasoning rather than a judgement I
 * added. The header states the monotonicity: the long-window static set is a
 * SUBSET of the short-window one, so dropping ghosts can only ever make a
 * passage WIDER, and a ghost can therefore only manufacture a falsely NARROW
 * finding — never a falsely clear one. A ghost is conservative. It is only
 * evidence of a problem when it actually moves the answer, and then the answer
 * moving is the thing to report.
 *
 * Failing on ghost COUNT instead would have made this permanently red for a
 * reason nobody can act on: any citizen who happens to pause for 1.5 s is a
 * ghost, and "never fix a failing check by loosening it until it passes"
 * (BUILDER-BRIEF §7) cuts both ways — a check that is red on correct behaviour
 * gets ignored just as fast as one that cannot go red at all.
 */
export function verdict(out) {
  const bad = [];
  const s = out.shortResult, l = out.longResult;
  if (s.nTight !== l.nTight) {
    bad.push(`the 1.5 s mover filter changes the corridor answer: ${s.nTight} stretches`
      + ` under 1.00 m with it, ${l.nTight} without. lane3/lanewalk/corridor all use the`
      + ' short window, so their findings are the ones in doubt.');
  }
  if (s.worst !== l.worst) {
    bad.push(`the narrowest point differs by window: ${s.worst} m at ${s.worstAt}`
      + ` (1.5 s) vs ${l.worst} m at ${l.worstAt} (long).`);
  }
  return bad;
}

// ── --selftest: prove the verdict goes BOTH ways, with no world ───────────
//
// POPULATION FLOOR FIRST. A self-test that runs zero cases and prints nothing
// is the vacuous green this whole item is about, so the case count is asserted
// before the cases are.
if (process.argv.includes('--selftest')) {
  const R = (nTight, worst, worstAt = 'east z -85.75') => ({ nTight, worst, worstAt });
  const cases = [
    ['clean — identical answers, no ghosts',
      { ghosts: [], shortResult: R(0, 1.12), longResult: R(0, 1.12) }, 0],
    ['ghosts present but the answer did not move — NOT a failure, see verdict()',
      { ghosts: [{ w: 0.4, d: 0.4, x: 1, z: -20 }], shortResult: R(0, 1.12), longResult: R(0, 1.12) }, 0],
    // ONE FIELD AT A TIME. This case first read `R(3, 0.88)` against
    // `R(0, 1.12)` — which moves BOTH fields and so raises two complaints, and
    // the self-test caught it on its first run. Worth keeping as a note rather
    // than quietly correcting: a fixture that varies two things cannot tell you
    // which one the code responded to, and it was my test that was wrong, not
    // the verdict.
    ['the count of tight stretches differs, and only that',
      { ghosts: [], shortResult: R(3, 1.12), longResult: R(0, 1.12) }, 1],
    ['the narrowest point differs',
      { ghosts: [], shortResult: R(0, 0.94), longResult: R(0, 1.12) }, 1],
    ['both differ — two distinct complaints, not one',
      { ghosts: [], shortResult: R(2, 0.90), longResult: R(0, 1.12) }, 2],
  ];
  if (cases.length < 5) { console.log(`SELFTEST FAILED — only ${cases.length} cases`); process.exit(1); }
  let bad = 0;
  for (const [name, out, want] of cases) {
    const got = verdict(out).length;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} — expected ${want} complaint(s), got ${got}`);
  }
  // BOTH SIGNS, asserted rather than eyeballed: at least one case that must
  // pass and at least one that must fail, or the suite proves nothing.
  const greens = cases.filter((c) => c[2] === 0).length, reds = cases.filter((c) => c[2] > 0).length;
  if (!greens || !reds) { console.log('SELFTEST FAILED — needs cases of BOTH signs'); process.exit(1); }
  console.log(`\n${cases.length} cases, ${greens} that must pass and ${reds} that must fail`
    + ` — ${bad ? `${bad} WRONG` : 'all correct'}`);
  process.exit(bad ? 1 : 0);
}

const b = await chromium.launch();
const p = await b.newPage();
const URL = aim('http://localhost:4184/');
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
// `reportWorld(page, url)` takes the url and this passed only the page, so the
// one line whose whole job is saying WHICH WORLD was measured printed
// "measuring undefined" — the banner that exists for GOTCHAS 48 naming no port
// at all. Two arguments, not one.
await reportWorld(p, URL);
await p.waitForTimeout(800);

const out = await p.evaluate(async (LONG_MS) => {
  const RAD = 0.36, S = 0.05;
  const key = c => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map(c => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));

  const a = snap();
  await new Promise(r => setTimeout(r, 1500));
  const shortKeys = new Set(snap().map(key));
  const shortStatic = a.filter(c => shortKeys.has(key(c)));

  // long window: sample repeatedly; a box is static only if present at EVERY sample
  const live = new Set(shortStatic.map(key));
  const t0 = performance.now();
  let samples = 0;
  while (performance.now() - t0 < LONG_MS) {
    await new Promise(r => setTimeout(r, 1000));
    const now = new Set(snap().map(key));
    for (const k of [...live]) if (!now.has(k)) live.delete(k);
    samples++;
  }
  const longStatic = shortStatic.filter(c => live.has(key(c)));
  const ghosts = shortStatic.filter(c => !live.has(key(c)))
    .map(c => ({ w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
                 x: +((c.minX + c.maxX) / 2).toFixed(2), z: +((c.minZ + c.maxZ) / 2).toFixed(2) }));

  // corridor across the walk, computed from an arbitrary collider set
  const corridor = (cols) => {
    const free = (x, z) => !cols.some(c => x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
    const BANDS = [{ lo: -6.7, hi: -5.0, id: 'west' }, { lo: 5.0, hi: 6.7, id: 'east' }];
    const tight = []; let worst = 99, worstAt = null;
    for (const W of BANDS) for (let v = 12; v >= -94; v -= 0.25) {
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) { run = free(c, v) ? run + S : 0; if (run > best) best = run; }
      const clear = +(best + 2 * RAD).toFixed(2);
      if (clear < worst) { worst = clear; worstAt = `${W.id} z ${v.toFixed(2)}`; }
      if (clear < 1.0) tight.push({ walk: W.id, z: +v.toFixed(2), clear });
    }
    return { nTight: tight.length, worst, worstAt };
  };

  return {
    total: a.length, nShort: shortStatic.length, nLong: longStatic.length,
    samples, ghosts,
    shortResult: corridor(shortStatic),
    longResult: corridor(longStatic),
  };
}, LONG_MS);

const w = process.env.LONG_MS ? Number(process.env.LONG_MS) / 1000 : 22;
console.log(`${out.total} colliders · static by 1.5 s ${out.nShort} · still static after a further ${w}s ${out.nLong}`);
console.log(`(${out.samples} long-window samples)\n`);
console.log(`GHOSTS — boxes the short window called static but which moved later: ${out.ghosts.length}`);
for (const g of out.ghosts) console.log(`    ${g.w}×${g.d} at (${g.x}, ${g.z})`);
console.log();
const f = r => `${r.nTight} stretches under 1.00 m · narrowest ${r.worst} m at ${r.worstAt}`;
console.log(`  short window (what corridor.mjs uses):  ${f(out.shortResult)}`);
console.log(`  long  window:                           ${f(out.longResult)}`);
const bad = verdict(out);
console.log(`\ncorridor answer ${bad.length ? '** DIFFERS **' : 'IDENTICAL under both windows'}`);
for (const b of bad) console.log(`  FAIL  ${b}`);
writeFileSync('shots/ghosts.json', JSON.stringify(out, null, 2));
await b.close();
// AND IT NOW SAYS SO IN ITS EXIT CODE. See `verdict`.
process.exit(bad.length ? 1 : 0);
