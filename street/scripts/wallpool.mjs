// THE AUDITOR AND I DISAGREE ABOUT THE ALLEY DOOR, SO REPRODUCE THEIR
// MEASUREMENT RATHER THAN ARGUE WITH IT.
//
// AUDIT, re-opening the row: a brightness profile across the wall the fitting
// is mounted on, at its own height, 28 bins at 22:00 — baseline 18.0, peak 44.0
// in the two bins where the fitting is drawn, "2 of 28 bins raised, no falloff
// either side. A cast pool lights a wall over a span; this lights only itself."
//
// B, landing it: the DOOR went 0.0079 -> 0.0787 and carries `poolLit`.
//
// Both can be true, and if they are then the auditor's predicate can never go
// green however the lighting is fixed — which is worth knowing before anyone
// spends another pass on it. So this measures three things in one run:
//
//   1. the auditor's own profile, same shape, on this build
//   2. the DOOR's tint, so the two numbers sit side by side
//   3. THE WALL MESH ITSELF — its span, its sizeW, whether it is poolable at
//      all — because ct/props.ts excludes wide meshes from pooling BY DESIGN
//      (one material carries one tint, so a 12 m wall cannot hold a gradient),
//      and if the wall is one of those then "no falloff on the wall" is the
//      rule working, not the fix failing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(22, 0));
await p.waitForTimeout(1500);

const D = [19.40, 1.06, -55.45];          // the door, measured in alleydoor.mjs
const GLOW = [19.40, 2.15, -55.45];       // the self-lit quad above it

const r = await p.evaluate(([DX, DY, DZ]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = { door: null, glow: null, walls: [] };
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const cx = (w.min.x + w.max.x) / 2, cy = (w.min.y + w.max.y) / 2, cz = (w.min.z + w.max.z) / 2;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m?.color) return;
    const span = Math.max(w.max.x - w.min.x, w.max.z - w.min.z);
    const row = { at: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
                  size: [+(w.max.x - w.min.x).toFixed(2), +(w.max.y - w.min.y).toFixed(2), +(w.max.z - w.min.z).toFixed(2)],
                  span: +span.toFixed(2), tint: +m.color.r.toFixed(4),
                  graded: !!m.userData?.graded, selfLit: !!m.userData?.selfLit,
                  poolLit: !!m.userData?.poolLit, mod: n.userData.mod ?? '?',
                  // THE WORLD'S OWN taper weight, not this script's opinion of
                  // it. `undefined` means this mesh is not in the pooling
                  // registry at all, which is a different statement from
                  // "weight 0" and must not be flattened into one.
                  sizeW: typeof n.userData?.sizeW === 'number' ? +n.userData.sizeW.toFixed(4) : null,
                  poolSpan: typeof n.userData?.poolSpan === 'number' ? +n.userData.poolSpan.toFixed(3) : null };
    if (Math.hypot(cx - DX, cy - DY, cz - DZ) < 0.4 && row.size[1] > 1.5) out.door = row;
    if (Math.hypot(cx - DX, cz - DZ) < 1.0 && Math.abs(cy - 2.15) < 0.2 && row.selfLit) out.glow = row;
    // THE WALL the fitting is on: a tall surface in the same plane as the door,
    // wide enough that the span rule bites
    if (Math.abs(cz - DZ) < 1.2 && w.max.y > 3 && span > 3) out.walls.push(row);
  });
  out.walls.sort((a, c) => c.span - a.span);
  return out;
}, D);

console.log('\n── the three surfaces, at 22:00 ──');
const show = (name, q) => console.log(q
  ? `  ${name.padEnd(8)} ${JSON.stringify(q.size).padEnd(22)} span ${String(q.span).padStart(6)} m   tint ${String(q.tint).padEnd(8)}` +
    ` graded ${q.graded ? 'Y' : 'n'} selfLit ${q.selfLit ? 'Y' : 'n'} poolLit ${q.poolLit ? 'Y' : 'n'}`
  : `  ${name.padEnd(8)} (not found)`);
show('door', r.door);
show('glow', r.glow);
for (const w of r.walls.slice(0, 3)) show('wall', w);

// ── THE SPAN RULE, READ OFF THE WORLD RATHER THAN RESTATED ────────────────
//
// THIS BLOCK USED TO RETYPE THE SMOOTHSTEP. It carried its own copy of
// `SPAN_FULL = 6, SPAN_NONE = 12` and `tw*tw*(3-2*tw)`, computed what the
// weight OUGHT to be, and printed that — so it compared the world against its
// own restatement of the world. It agreed with itself by construction and
// could not go red on any change to ct/props.ts. Row L260 was demoted
// CONFIRMED -> LANDED on precisely that ground, and this is the repair.
//
// props.ts now publishes the weight it actually used, plus the span it used to
// compute it, on each slot mesh's userData. So the rule is a QUERY now.
//
// WHAT IS ASSERTED, AND WHY IT IS NOT ANOTHER COPY OF THE FORMULA. Restating
// `3t²-2t³` here would rebuild the exact fault this item exists to remove. So
// nothing below reproduces the curve; every assertion is a PROPERTY the taper
// exists to provide, tested against the world's own numbers:
//
//   1. it is a FUNCTION of span      — equal spans must carry equal weight
//   2. it is MONOTONE                — a wider surface never pools harder
//   3. it SATURATES at both ends     — full weight exists, zero weight exists
//   4. it TAPERS rather than steps   — partial weights exist at all
//   5. it has NO CLIFF               — bounded slope everywhere
//   6. it FLATTENS at both knees     — what makes it a smoothstep, not a ramp
//
// (5) and (6) are the user's actual complaint, which is the point: "a warm
// light pool on the brick that stops dead at a straight vertical line with
// nothing there to stop it". A hard cutoff fails (4) and (5); a linear ramp
// fails (6); a changed knee fails (3).
//
// The two knee positions are the one thing that cannot be inferred from the
// data alone, so they are READ FROM props.ts ITSELF rather than typed here —
// one source of truth, and if someone moves them the check re-reads the new
// values and demands the world moved with them.
// `import.meta.dirname`, NOT `new URL(...)` — this file declares `const URL`
// at the top for the page address, which shadows the global and turns the
// usual idiom into "URL is not a constructor".
const propsSrc = readFileSync(join(import.meta.dirname, '../src/proto/ct/props.ts'), 'utf8');
const knee = propsSrc.match(/const\s+SPAN_FULL\s*=\s*([\d.]+)\s*,\s*SPAN_NONE\s*=\s*([\d.]+)\s*;/);
if (!knee) {
  console.error('\nCANNOT ANSWER — ct/props.ts no longer declares SPAN_FULL/SPAN_NONE in the');
  console.error('  form this check reads. Do NOT paste the numbers back in here; find where');
  console.error('  the taper is declared now and read them from there.');
  await b.close(); process.exit(3);
}
const SPAN_FULL = +knee[1], SPAN_NONE = +knee[2];
const WIDTH = SPAN_NONE - SPAN_FULL;
console.log(`\n── the taper, as ct/props.ts declares it: full to ${SPAN_FULL} m, none past ${SPAN_NONE} m ──`);

// every (span, weight) pair the world publishes
const pairs = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && typeof o.userData.sizeW === 'number' && typeof o.userData.poolSpan === 'number')
      out.push([o.userData.poolSpan, o.userData.sizeW]);
  });
  return out;
});

const fails = [];
const check = (ok, name, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(34)} ${detail}`);
  if (!ok) fails.push(name);
};

console.log('\n── can each of those pool at all? (the world\'s own published weight) ──');
for (const [name, q] of [['door', r.door], ...r.walls.slice(0, 3).map((w) => ['wall', w])]) {
  if (!q) continue;
  console.log(`  ${name.padEnd(6)} span ${String(q.span).padStart(6)} m -> sizeW ` +
    (q.sizeW === null ? '  (not registered for pooling)'
      : `${q.sizeW.toFixed(4)}${q.sizeW === 0 ? '   CANNOT POOL, by design' : '   can pool'}`));
}

console.log(`\n── is the published taper well formed? (${pairs.length} slot meshes) ──`);
if (pairs.length === 0) {
  console.error('\nCANNOT ANSWER — no slot mesh publishes userData.sizeW/poolSpan.');
  console.error('  props.ts is meant to publish them where it computes the weight. Without');
  console.error('  that this check can only restate the formula, which is what it was.');
  await b.close(); process.exit(3);
}

// 1. a function of span
const bySpan = new Map();
for (const [s, w] of pairs) {
  const k = s.toFixed(4);
  if (!bySpan.has(k)) bySpan.set(k, []);
  bySpan.get(k).push(w);
}
let worstSpread = 0, worstSpreadAt = null;
for (const [k, ws] of bySpan) {
  const sp = Math.max(...ws) - Math.min(...ws);
  if (sp > worstSpread) { worstSpread = sp; worstSpreadAt = k; }
}
check(worstSpread < 1e-6, 'a function of span',
  `worst spread among equal spans ${worstSpread.toExponential(1)}` + (worstSpreadAt ? ` (at ${worstSpreadAt} m)` : ''));

// 2. monotone non-increasing
const curve = [...bySpan.entries()].map(([k, ws]) => [+k, ws[0]]).sort((a, c) => a[0] - c[0]);
let mono = true, monoAt = '';
for (let i = 1; i < curve.length; i++) {
  if (curve[i][1] > curve[i - 1][1] + 1e-9) {
    mono = false; monoAt = `${curve[i - 1][0]}m->${curve[i][0]}m rises ${curve[i - 1][1].toFixed(4)}->${curve[i][1].toFixed(4)}`; break;
  }
}
check(mono, 'monotone: wider never pools more', mono ? `${curve.length} distinct spans, never rises` : monoAt);

// 3. saturates at both ends
const nFull = pairs.filter(([, w]) => w >= 0.999).length;
const nZero = pairs.filter(([, w]) => w <= 0.001).length;
check(nFull > 0 && nZero > 0, 'saturates at both ends', `${nFull} at full weight, ${nZero} excluded`);

// 4. a taper, not a step
const partial = pairs.filter(([, w]) => w > 0.001 && w < 0.999);
check(partial.length > 0, 'tapers rather than steps',
  `${partial.length} slots at partial weight` + (partial.length ? '' : '  — this is the CLIFF the taper replaced'));

// 5. no cliff: bounded slope between neighbouring spans.
//    The taper spreads one unit of weight over WIDTH metres, so its AVERAGE
//    slope is 1/WIDTH. A bound of 3x that is loose enough to admit any sane
//    easing and still infinitely tighter than a step, which moves the whole
//    unit across a zero-width gap. Derived from the declared knees, not tuned.
const avgSlope = 1 / WIDTH;
let maxSlope = 0, maxSlopeAt = '';
for (let i = 1; i < curve.length; i++) {
  const ds = curve[i][0] - curve[i - 1][0];
  if (ds <= 0 || ds > 1.0) continue;             // only genuine neighbours
  const sl = Math.abs(curve[i][1] - curve[i - 1][1]) / ds;
  if (sl > maxSlope) { maxSlope = sl; maxSlopeAt = `${curve[i - 1][0]}..${curve[i][0]} m`; }
}
check(maxSlope <= 3 * avgSlope, 'no cliff: bounded slope',
  `steepest ${maxSlope.toFixed(4)}/m at ${maxSlopeAt}, average ${avgSlope.toFixed(4)}/m, bound ${(3 * avgSlope).toFixed(4)}/m`);

// 6. FLATTENS AT BOTH KNEES — the smoothstep's signature, and the thing that
//    makes "two halves of a wall either side of 6 m differ by a hair" true.
//    A linear ramp loses exactly this: its slope at the knee equals its
//    average, so the ratios below would both read ~1.0. A smoothstep's slope
//    at either knee is 0, so they read near 0. Bound of 0.5 sits between the
//    two with room on both sides; measured today they are ~0.10 and ~0.15.
const uOf = (s) => (s - SPAN_FULL) / WIDTH;
const near = partial.map(([s, w]) => [uOf(s), w]).filter(([u]) => u > 0 && u < 1).sort((a, c) => a[0] - c[0]);
if (near.length < 2) {
  check(false, 'flattens at both knees', 'not enough partial-weight slots to tell');
} else {
  const [uLo, wLo] = near[0], [uHi, wHi] = near[near.length - 1];
  const dropAtFull = (1 - wLo) / uLo;         // how fast it leaves full weight
  const riseAtNone = wHi / (1 - uHi);         // how fast it leaves zero
  check(dropAtFull < 0.5 && riseAtNone < 0.5, 'flattens at both knees (smoothstep)',
    `leaving full ${dropAtFull.toFixed(3)}x average, leaving zero ${riseAtNone.toFixed(3)}x average, bound 0.5x` +
    `  [a straight ramp reads 1.0x on both]`);
}

// ── the auditor's own profile, same shape ────────────────────────────────
await p.evaluate(([X, Z]) => window.__ct.warp(X, Z + 3.2, 0, 0, 0.06), [D[0], D[2]]);
await settle(p);
const png = (await p.screenshot()).toString('base64');
const prof = await p.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const W = img.width, H = img.height;
  // a band across the frame at the fitting's height — the top third, above the
  // door and below the eaves, which is where the auditor's 28 bins sit
  const y0 = Math.round(H * 0.18), y1 = Math.round(H * 0.30);
  const bins = [];
  for (let k = 0; k < 28; k++) {
    const x0 = Math.round((k * W) / 28), x1 = Math.round(((k + 1) * W) / 28);
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; n++;
    }
    bins.push(+(s / n).toFixed(1));
  }
  return bins;
}, png);
console.log('\n── the auditor\'s profile reproduced: 28 bins across the wall at the fitting\'s height ──');
console.log('  ' + prof.join(' '));
const base = [...prof].sort((a, c) => a - c)[Math.floor(prof.length * 0.4)];
const raised = prof.filter((v) => v > base * 1.35).length;
console.log(`  baseline ~${base}   peak ${Math.max(...prof)}   bins more than 35% over baseline: ${raised} of 28`);
await p.screenshot({ path: 'shots/wp-wall.png' });
console.log('  shots/wp-wall.png');
await b.close();

// ── THE VERDICT, AND AN EXIT CODE THAT CAN CARRY IT ───────────────────────
//
// This script printed and exited 0 no matter what it found — so on top of
// comparing the world against its own copy of the rule, it had no way to
// SAY the comparison had failed. Both halves of "its green means nothing"
// are fixed here: it reads the world now, and it can go red about it.
if (fails.length) {
  console.error(`\nFAIL — the published taper breaks ${fails.length} of its own properties:`);
  for (const f of fails) console.error(`  - ${f}`);
  console.error('\nThese are read off ct/props.ts\'s published sizeW/poolSpan, so a failure');
  console.error('here means the WORLD changed shape — not that this script disagrees with');
  console.error('a formula it remembers. Do not "fix" it by relaxing a bound.');
  process.exit(1);
}
console.log('\nPASS — the taper the world publishes is a well-formed smoothstep between the');
console.log(`       knees ct/props.ts declares (${SPAN_FULL} m -> ${SPAN_NONE} m), on ${pairs.length} slot meshes.`);
