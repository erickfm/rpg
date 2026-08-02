// WHICH SURFACES NEVER GET WET — the whole class in one pass.
//
// Two agents found the same defect independently: b209275c, the road's centre
// lines bone dry while the road darkened 83%; 21c42a66, the lot's decals dry
// while their tarmac went -74%. Same root cause both times — `dimWorld` SKIPS
// TRANSPARENT MATERIALS, so anything transparent stays dry unless it hand
// registers with `ctx.wet()`. That is a class with a mechanical signature, and
// finding the rest one at a time is slower than enumerating them at once.
//
// Method: sample every material's colour at a dry hour and at a rainy hour,
// holding the hour-of-day grade as close as the world's own predicate allows,
// and join on material uuid. Anything transparent that does not move while the
// opaque world darkens is a CANDIDATE.
//
// It reports candidates, not defects. Plenty of things are entitled to stay dry
// — anything indoors, under cover, or self-lit. Deciding which is the owner's
// call; the point of this script is that nobody has to go looking first.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
// ASK, DO NOT COPY. props.ts publishes rainAt on scene.userData precisely so
// nothing has to mirror it, after e0c68e46 found the old formula wrong and two
// hand-copies of it stale in scripts/. Mine was the third, and it silently
// picked a "rainy" hour that no longer rains -- 65 responders became 1. The
// predicate is now read from the world at run time; see rainyFrom() below.

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

// the world's own predicate, read rather than reimplemented
const rainSched = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  if (typeof f !== 'function') return null;
  return Array.from({ length: 400 }, (_, h) => !!f(h));
});
if (!rainSched) { console.error('scene.userData.rainAt not published — cannot pick hours honestly'); process.exit(2); }
const rainy = (h) => rainSched[h];
// NIGHT=1 picks a rainy night hour and the nearest dry night hour, from the
// world's schedule rather than from a local guess about when it rains.
const isNight = (h) => { const l = ((h % 24) + 24) % 24; return l >= 22 || l <= 2; };
const nightWet = rainSched.findIndex((r, i) => r && i >= 24 && isNight(i));
const wetH = Number(process.env.WET_H ?? (process.env.NIGHT === '1' ? nightWet
  : rainSched.findIndex((r, i) => r && i >= 12)));
const dryH = process.env.DRY_H ? Number(process.env.DRY_H)
  : [wetH - 1, wetH + 1, wetH - 2, wetH + 2, wetH - 3]
      .find((h) => h >= 0 && !rainy(h) && (process.env.NIGHT !== '1' || isNight(h)));
if (dryH === undefined) { console.error('no dry hour near the wet one'); process.exit(2); }
console.log(`rain predicate read from scene.userData.rainAt · wet ${wetH}, dry ${dryH}`);

// MEASURED, not guessed: after clock(14) the road walks 1.000 → 0.597 → 0.329 →
// 0.224 → 0.186 → 0.172 → 0.167 → 0.165 at two-second intervals. The wet look
// takes ~16 s to settle, so anything sampled earlier reads as partly dry.
const SETTLE_MS = 18000;

// 3d71b035: a JUMPED clock is 7.4% brighter than the night the player reaches,
// because some grading is path-dependent. My night figures were taken with a
// 72-hour jump, so STEP=1 walks the clock an hour at a time to the target
// instead, and the two can be compared.
// STEPPED BY DEFAULT. 94ca3664 measured the dry-night baseline as 3.4x too
// bright when jumped (0.04500 vs 0.01335) while the wet reading is identical to
// five decimals, so every wet-vs-dry RATIO after dark is inflated by a jumped
// baseline. Measured here, it inflates the day too: 218 responders jumped
// against 65 stepped, and -83.5% against -65.4%. NOSTEP=1 restores the old
// behaviour for comparison; nothing should trust it.
const STEP = process.env.NOSTEP !== '1';
// STAND OUTSIDE BEFORE ANY OF THIS. ct/props.ts cuts the weather when the player
// is indoors — `if (px > 100) rainLevel = 0; // it NEVER rains indoors` — and
// the spawn is now room 301 at x 198.6. This instrument stepped the clock
// through twelve hours from inside a building and correctly reported "saw no wet
// surface at all", which is the right refusal and the wrong reason: nothing is
// wrong with the world, the sweep was simply not standing in it.
//
// wetness.mjs and rain.mjs had the identical fault the same day. All three used
// to pass because the spawn used to be on the street.
await p.evaluate(() => window.__ct.warp(6.2, -50, 0, 0.14, 0));
await p.waitForTimeout(300);

const sample = async (h) => {
  if (STEP) {
    const from = h - Number(process.env.STEP_HOURS ?? 12);   // walk this many hours in
    for (let k = from; k < h; k++) {
      await p.evaluate((hh) => window.__ct.clock(hh), k);
      await p.waitForTimeout(700);
    }
  }
  await p.evaluate((hh) => window.__ct.clock(hh), h);
  await p.waitForTimeout(SETTLE_MS);         // the street remembers weather; let it settle
  return p.evaluate(() => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const v = o.position.clone();
      o.getWorldPosition(v);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, i) => {
        if (!m || !m.color) return;
        out.push({
          id: `${m.uuid}#${i}`,
          transparent: !!m.transparent,
          lum: 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b,
          mod: o.userData?.mod ?? o.parent?.userData?.mod ?? '',
          x: +v.x.toFixed(1), y: +v.y.toFixed(2), z: +v.z.toFixed(1),
          name: o.name || o.geometry?.type || 'Mesh',
          dim: (() => { const g = o.geometry?.parameters; return g
            ? `${(g.width ?? g.radiusTop ?? 0).toFixed(2)}×${(g.height ?? g.depth ?? 0).toFixed(2)}` : '?'; })(),
        });
      });
    });
    return out;
  });
};

const dry = await sample(dryH);
const wet = await sample(wetH);
await b.close();

// DROP MOVERS. A citizen sprite keeps its material uuid while it walks, so it
// joins to itself across the two samples with a different colour AND a different
// position — and lands in whichever band its lighting happened to change into.
// That is what produced a "surface lightened by 280%" that turned out to be a
// 0.95x1.90 person-shaped plane at kerb height, drifting z -37.7 to -38.3
// between runs. Third time movers have faked a finding in this audit; this one
// is joined on position as well as uuid.
const W = new Map(wet.map((m) => [m.id, m]));
const rows = [];
let moved = 0;
for (const d of dry) {
  const w = W.get(d.id);
  if (!w || d.lum <= 0.001) continue;
  if (Math.abs(w.x - d.x) > 0.01 || Math.abs(w.z - d.z) > 0.01) { moved++; continue; }
  rows.push({ ...d, drop: (d.lum - w.lum) / d.lum });
}
// outdoors only: the interiors live out at x >= 400 and are entitled to stay dry
const out = rows.filter((r) => Math.abs(r.x) < 200);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// THE CONTROL. Rain darkens GROUND, not walls, so a median over every material
// is meaningless — most of the world is building. Prove the instrument sees the
// effect at all by naming the wettest surfaces it found.
const responded = out.filter((r) => r.drop > 0.2);
const best = [...responded].sort((a, c) => c.drop - a.drop).slice(0, 3);
console.log(`dry hour ${dryH}, wet hour ${wetH}   ·   ${out.length} outdoor materials joined, ${moved} movers dropped\n`);
console.log(`CONTROL — the surfaces that DID respond: ${responded.length}`);
for (const r of best) console.log(`   ${pct(r.drop)}  ${r.mod || r.name}  at (${r.x}, ${r.z})`);

// THE BAND THIS SCRIPT WAS BLIND TO. e24c959a found the wet lerp could LIGHTEN a
// surface darker than its WET target — dark asphalt +398%, the casino runner
// +70% — and it is now clamped so wet never lightens. My first version sorted
// into "darkened > 20%" and "unmoved < 1%", so anything that LIGHTENED fell
// between the two bands and was dropped without a word. Report it explicitly:
// a blind spot you have named is a finding, a blind spot you have not is a lie.
const lightened = out.filter((r) => r.drop < -0.01);
console.log(`\nLIGHTENED by rain (should be none — e24c959a clamped it): ${lightened.length}`);
for (const r of [...lightened].sort((a, c) => a.drop - c.drop).slice(0, 5))
  console.log(`   ${pct(r.drop)}  ${r.mod || r.name}  ${r.dim}  at (${r.x}, ${r.y}, ${r.z})`);
if (!responded.length) { console.error('\nInstrument saw no wet surface at all — do not trust anything below.'); process.exit(2); }

// Anchor every dry candidate to ground that DID get wet beneath it. A decal on
// wet tarmac that stayed dry is the b209275c / 21c42a66 shape; a transparent
// thing with no wet ground under it is entitled to stay dry and is not reported.
const wetGround = responded.filter((r) => r.y < 0.6);
const near = (r) => wetGround.find((g) => Math.abs(g.x - r.x) < 3 && Math.abs(g.z - r.z) < 3);

const DEAD = 0.01;
const cand = out.filter((r) => r.transparent && r.y < 1.2 && Math.abs(r.drop) < DEAD && near(r));
console.log(`\nTRANSPARENT, UNMOVED, AND LYING ON GROUND THAT GOT WET: ${cand.length}`);
const byMod = new Map();
for (const r of cand) {
  const k = r.mod || `(untagged) ${r.name}`;
  if (!byMod.has(k)) byMod.set(k, []);
  byMod.get(k).push(r);
}
for (const [k, v] of [...byMod.entries()].sort((a, c) => c[1].length - a[1].length)) {
  const g = near(v[0]);
  console.log(`   ${String(v.length).padStart(4)} × ${k}   x ${Math.min(...v.map(r=>r.x))}…${Math.max(...v.map(r=>r.x))}` +
    `  z ${Math.min(...v.map(r=>r.z))}…${Math.max(...v.map(r=>r.z))}` +
    `   — ground beside it went ${pct(g.drop)}`);
}
if (!cand.length) console.log('   (none — the class is closed at this HEAD)');

console.log('\nevery candidate, so an owner can find it:');
for (const r of cand.sort((a, c) => (a.mod + a.z).localeCompare(c.mod + c.z)))
  console.log(`   ${(r.mod || r.name).padEnd(22)} ${r.dim.padEnd(14)} at (${r.x}, ${r.y}, ${r.z})`);

// who responds, by owner tag — so a subsystem silently leaving the wet-look shows up
const tally = new Map();
for (const r of responded) { const k = r.mod || `(untagged) ${r.name}`; tally.set(k, (tally.get(k) ?? 0) + 1); }
console.log('\nresponding surfaces by owner tag:');
for (const [k, n] of [...tally.entries()].sort((a, c) => c[1] - a[1]))
  console.log(`   ${String(n).padStart(4)} × ${k}`);
const viceAll = out.filter((r) => r.mod === 'vice');
console.log(`\nvice: ${viceAll.length} outdoor materials, ${viceAll.filter(r=>r.drop>0.2).length} responding`);

// the three surfaces that led the control at build baa675d7, by POSITION not tag,
// so retagging cannot be mistaken for deregistration
console.log('\nwhat is at the old top-responder spots now:');
for (const [X, Z] of [[48.8, -97.7], [49.9, -97.7], [50.9, -97.7]]) {
  const hits = out.filter((r) => Math.abs(r.x - X) < 0.3 && Math.abs(r.z - Z) < 0.3);
  const top = hits.sort((a, c) => c.drop - a.drop)[0];
  console.log(`   (${X}, ${Z}): ${hits.length} materials, best ${top ? pct(top.drop) + '  tag=' + (top.mod || top.name) : 'none'}`);
}

// THE FULL PICTURE, because a filtered count reads as a complete one.
// 67299640 found the fleet outside the wet system entirely — 33 materials on one
// sedan, identical to four decimals — and it is NOT in the 19 above, because that
// list was filtered to transparent decals lying flat. Show every owner instead,
// so the next class does not have to be found by hand.
console.log('\nEVERY outdoor owner: responding / total, and how high it sits');
const all = new Map();
for (const r of out) {
  const k = r.mod || `(untagged) ${r.name}`;
  if (!all.has(k)) all.set(k, []);
  all.get(k).push(r);
}
for (const [k, v] of [...all.entries()].sort((a, c) => c[1].length - a[1].length)) {
  const resp = v.filter((r) => r.drop > 0.2).length;
  const ys = v.map((r) => r.y).sort((a, c) => a - c);
  const flag = resp === 0 ? '   ← nothing responds' : '';
  console.log(`   ${String(resp).padStart(4)} / ${String(v.length).padEnd(5)} ${k.padEnd(26)} median y ${ys[ys.length >> 1].toFixed(2)}${flag}`);
}

// f9d326cd says the split is REGISTRY vs registry, not module vs module: every
// wet-registered surface responds at exactly -83.5% and everything else gets a
// ~2.7% nudge. If true, the responders must cluster tightly rather than spread.
const drops = out.filter((r) => r.drop > 0.2).map((r) => r.drop).sort((a, c) => a - c);
if (drops.length) {
  const at835 = drops.filter((d) => Math.abs(d - 0.835) < 0.01).length;
  console.log(`\nresponder distribution: n=${drops.length}` +
    `  min ${pct(drops[0])}  median ${pct(drops[drops.length >> 1])}  max ${pct(drops[drops.length - 1])}`);
  console.log(`   within ±1 point of -83.5%: ${at835} of ${drops.length}`);
}
