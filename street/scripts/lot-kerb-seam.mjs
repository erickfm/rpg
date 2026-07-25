// Does the KERB CUT line up with the LOT'S OPENING?
//
// The user asked for one thing in two halves: *"A pedestrian must enter and a
// car must leave."* Two checks answer half of it each, and they are owned by
// different builders:
//
//   kerbcut.mjs   B's kerb: is there a cut, does it RAMP, is it where declared
//   lotwalk.mjs   my fence: can a pedestrian get in, and only at the opening
//
// Neither asks whether the two LINE UP, and that is the question a car cares
// about. A cut that runs past the fence leads a car into chain-link; a fence
// opening that drifts off the cut leaves it facing a 14 cm kerb face. Both
// checks stay green through either, because each is looking at its own half.
//
// It is a seam between two owners, which is the kind that rots quietly: B may
// move the cut, I may move the gate, and nothing in either suite is watching
// the relationship.
//
// THE PROPERTY, stated so it is arguable: the cut must be CONTAINED IN the
// opening. Not equal to it — the fence opening is deliberately wider, because
// a vehicle entrance wants room and the flares want somewhere to land. Wider
// is harmless. What is not harmless is any part of the cut having fence across
// it, or any part of the opening being the only way out and having full kerb.
//
// Measured at HEAD: cut z -0.80 … 6.00 inside opening z -2.04 … 6.60, with
// 1.24 m to spare at the south end and 0.60 m at the north.
//
// BOTH SIDES ARE READ FROM THE WORLD. Nothing here is copied from either
// module's constants — a copy of someone else's number is exactly how a seam
// check comes to certify two things that have both moved. The kerb comes off
// the mesh (the same signal kerbcut uses, deliberately), the opening off the
// live collider list.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot-kerb-seam.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// ── the kerb cut, off the mesh ────────────────────────────────────────────
// Same vertex signal as kerbcut.mjs: the top of the kerb's vertical FACE along
// the kerb line at x = 5.0, binned in z. A face top below half the full reveal
// is down-kerb. FACE_TOP is 0.140 - 0.030 because the chamfered arris rises
// from the face top to the kerb top over the last 6.25 cm — comparing against
// 0.140 fails a correct kerb, which kerbcut records having learned the hard way.
const FACE_TOP = 0.140 - 0.030;
const prof = await page.evaluate(() => {
  const sc = window.__ct.scene();
  const bins = new Map();
  sc.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || !g?.attributes?.position || g.type !== 'BufferGeometry') return;
    const pa = g.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) {
      const x = pa[i], y = pa[i + 1], z = pa[i + 2];
      if (Math.abs(x - 5.0) > 0.02) continue;
      if (z < -20 || z > 24) continue;
      const k = Math.round(z * 5) / 5;
      bins.set(k, Math.max(bins.get(k) ?? -9, y));
    }
  });
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, +v.toFixed(4)]);
});
const down = prof.filter(([, v]) => v < FACE_TOP / 2).map(([k]) => k);
if (!down.length) {
  console.error('\nNO DOWN-KERB anywhere along the sampled run — there is no cut to line up with.');
  console.error('  Either the kerb moved off x = 5.0 or the cut is gone. Read kerbcut.mjs first.\n');
  await browser.close(); process.exit(1);
}
// The profile is quantised at 0.2 m, so the true cut edge lies within half a
// bin of the outermost down sample. Widen by that half-bin rather than pretend
// to a precision the bins do not have — 1a9e0ed9's lesson, one file over.
const BIN = 0.2;
const cut = [Math.min(...down) - BIN / 2, Math.max(...down) + BIN / 2];

// ── the lot's opening, off the live colliders ─────────────────────────────
if (SELFTEST) {
  // Narrow the fence opening from the south until it no longer covers the cut.
  // This is the failure the check exists for: my gate drifts, B's kerb does
  // not, and a car leaving at the south end of the cut meets chain-link.
  await page.evaluate(() => window.__ct.colliders()
    .push({ minX: 6.8, maxX: 7.6, minZ: -3.0, maxZ: 1.5 }));
  console.log('selftest: narrowed the fence opening across the south end of the cut — MUST go red');
}
const gap = await page.evaluate(() => {
  const runs = window.__ct.colliders()
    .filter((c) => c.minX < 8.2 && c.maxX > 6.6 && c.minZ > -20 && c.maxZ < 24)
    .map((c) => [c.minZ, c.maxZ]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [z0, z1] of runs) {
    const last = merged[merged.length - 1];
    if (last && z0 <= last[1] + 0.001) last[1] = Math.max(last[1], z1);
    else merged.push([z0, z1]);
  }
  const gaps = [];
  for (let i = 0; i + 1 < merged.length; i++) gaps.push([merged[i][1], merged[i + 1][0]]);
  return { merged: merged.map((m) => m.map((v) => +v.toFixed(2))), gaps: gaps.map((g) => g.map((v) => +v.toFixed(2))) };
});

console.log(`\n  kerb cut       z ${cut[0].toFixed(2)} … ${cut[1].toFixed(2)}   (${(cut[1] - cut[0]).toFixed(2)} m, from ${down.length} down-kerb bins)`);
console.log(`  fence runs     ${JSON.stringify(gap.merged)}`);
console.log(`  fence openings ${JSON.stringify(gap.gaps)}`);

// The opening that matters is the one the cut is nearest to — there is only
// one on this frontage, but naming it by overlap rather than by index means a
// second gate elsewhere does not silently become the thing being tested.
let best = null;
for (const [z0, z1] of gap.gaps) {
  const ov = Math.min(z1, cut[1]) - Math.max(z0, cut[0]);
  if (!best || ov > best.ov) best = { z0, z1, ov };
}
const FAIL = [];
const expect = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) FAIL.push(label);
};

console.log('');
expect('the frontage has an opening at all', !!best && best.ov > 0,
  best ? `nearest opening z ${best.z0.toFixed(2)} … ${best.z1.toFixed(2)}` : 'no gap overlaps the cut');

if (best && best.ov > 0) {
  const south = cut[0] - best.z0;      // >= 0 means the fence opens before the cut starts
  const north = best.z1 - cut[1];
  // TOLERANCE IS ONE BIN, AND THE FIRST VERSION WAS 0.01 m.
  //
  // The kerb profile is quantised at 0.2 m, so the cut's true edge is only
  // known to within half a bin at each end — which is exactly why `cut` is
  // widened by half a bin above. Judging containment to the centimetre after
  // that is claiming a precision the measurement does not have.
  //
  // It is not hypothetical here. At HEAD the north end clears by 0.10 m: the
  // cut and the north gate post are FLUSH within resolution, so a 0.01 m bar
  // would sit half a bin from failing a world that is correct. That is
  // 1a9e0ed9's finding — a check clearing its own bar by nothing at all —
  // repeated one file away from where it was written, by the person who read
  // it. A tolerance narrower than the measurement's resolution is not
  // strictness, it is noise with a verdict attached.
  //
  // It costs nothing in detection: the selftest moves the gate 4.5 m.
  const TOL = -BIN;
  expect('the cut is not fenced off at its south end', south >= TOL,
    `${south >= 0 ? south.toFixed(2) + ' m of opening to spare' : Math.abs(south).toFixed(2) + ' m of the cut has FENCE across it'}`);
  expect('the cut is not fenced off at its north end', north >= TOL,
    `${north >= 0 ? north.toFixed(2) + ' m of opening to spare' : Math.abs(north).toFixed(2) + ' m of the cut has FENCE across it'}`
    + `${Math.abs(north) <= BIN ? '  — flush within the 0.2 m profile resolution' : ''}`);
  // A vehicle entrance is only an entrance if a vehicle fits. The lot declares
  // a 6.8 m gate and the aisle is built for two cars passing; 3 m is the bar
  // for "a car can use this at all", well below the design so it fails on a
  // real regression rather than on a 20 cm drift.
  const usable = Math.min(best.z1, cut[1]) - Math.max(best.z0, cut[0]);
  expect('enough of the cut is open to drive through', usable >= 3.0,
    `${usable.toFixed(2)} m usable (bar 3.0)`);
}

await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); FAIL.push('page errors'); }
if (FAIL.length) {
  console.error(`\nTHE KERB CUT AND THE LOT GATE DO NOT LINE UP (${FAIL.length}):`);
  for (const f of FAIL) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the narrowed gate was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the gate was narrowed across the cut and this did not notice.'); process.exit(2); }
console.log('\nthe cut is entirely inside the gate: a car can leave across all of it.');
