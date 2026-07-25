// Does the world's night grading actually reach this module's materials?
//
// A screenshot cannot answer that: "the fence looks a bit bright" is not a
// measurement, and the failure it hides is silent. props.ts's dimWorld SKIPS
// any material with `transparent: true` — correct for glass, and it means any
// prop that sets that flag when it only needed `alphaTest` stands at full
// daylight brightness at midnight while everything behind it goes dark.
//
// So this averages material colour by CLASS, at noon and at 23:00, over a
// world-space box. What you want to see is every class falling except
// `additive` — those are lights, and a light that dims at night is backwards.
//
// The car lot read like this before the fix and after it:
//   13:00  opaque 0.415  translucent 0.684  alphaCut 1.000  additive 0.683
//   23:00  opaque 0.221  translucent 0.497  alphaCut 0.374  additive 0.683
// alphaCut pinned at 1.000 all night was the bug, in one line.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/nightgrade.mjs [x0 x1 z0 z1]
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const A = process.argv.slice(2).map(Number);
const BOX = A.length === 4 ? A : [-1e9, 1e9, -1e9, 1e9];
const probe = async (h) => {
  await p.evaluate(([hh]) => window.__ct.clock(hh, 0), [h]);
  await p.waitForTimeout(1000);
  return p.evaluate(([BOX]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const out = {}, each = {};
    s.traverse((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
      if (x < BOX[0] || x > BOX[1] || z < BOX[2] || z > BOX[3]) return;
      const m = o.material; if (!m || Array.isArray(m) || !m.color) return;
      const key = m.blending === 2 ? 'additive'
        : (m.alphaTest > 0 ? 'alphaCut' : (m.transparent ? 'translucent' : 'opaque'));
      const v = (m.color.r + m.color.g + m.color.b) / 3;
      if (!out[key]) out[key] = { n: 0, sum: 0 };
      out[key].n++; out[key].sum += v;
      // Per MATERIAL as well as per class. The class average is the headline
      // and it is not the test — see the note at the top of this file.
      if (!each[m.uuid]) each[m.uuid] = { key, v, cut: m.alphaTest > 0, tr: !!m.transparent,
        reach: Math.abs(o.position.x) <= 100,
        x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1) };
    });
    for (const k in out) out[k] = +(out[k].sum / out[k].n).toFixed(3);
    return { avg: out, each };
  }, [BOX]);
};

const day = await probe(13), night = await probe(23);
console.log('13:00 ', JSON.stringify(day.avg));
console.log('23:00 ', JSON.stringify(night.avg));

// ── the actual test ───────────────────────────────────────────────────────
//
// Test the CAUSE, not the symptom.
//
// The obvious test is "which materials did not move between noon and 23:00",
// and it does not work: it flags 494 of them. Most of the world is simply never
// handed to `dimWorld` at all — interiors are lit by their own rooms, and a
// material that was never offered to the dimmer is indistinguishable, from the
// outside, from one the dimmer skipped. A check that cannot tell those apart
// cries wolf, and a check that cries wolf gets deleted rather than fixed.
//
// C's bug has an exact signature instead: `alphaTest` AND `transparent: true`
// on the same material. A cut-out discards its fragment and never blends, so
// the flag buys nothing and costs the material its grading. That is a static
// property of the material — no timing, no threshold, no argument.
// WHEN you read the flag matters as much as which flag you read.
//
// A first version sampled `transparent` in a pass of its own, after the 23:00
// probe — and reported the same 85 materials whether or not the source had been
// changed, while the class average moved. Both cannot be true. Read at 23:00
// you are reading the night's own state, not what the module asked for. So the
// flags are captured inside the NOON probe, alongside the colour.
await b.close();

// CAUSE AND SYMPTOM MUST AGREE. The flag pair is the cause; not moving between
// noon and 23:00 is the symptom. Reporting either alone is how a detector earns
// its reputation for crying wolf — a material may carry the pair and still be
// graded by something else, or sit still for reasons of its own.
const bad = Object.entries(day.each)
  .filter(([, d]) => d.cut && d.tr && d.reach)
  .map(([uuid, d]) => ({ uuid, ...d }));
const skipped = bad.filter((m) => {
  const d = day.each[m.uuid], n = night.each[m.uuid];
  return d && n && d.v >= 0.02 && Math.abs(d.v - n.v) < 1e-4;
});
const SCOPED = A.length === 4;
console.log(`\n${bad.length} cut-outs within dimWorld's reach also set transparent at noon`);
console.log(`${skipped.length} of those provably never moved between noon and 23:00`);
if (!skipped.length) {
  console.log('  no cut-out is losing its night grading to a blend flag it cannot use');
  process.exit(0);
}
// WHY THIS ONLY FAILS WHEN GIVEN A BOX.
//
// Run over the whole world this finds 84, and it must not call them 84 bugs.
// dimWorld also skips `litSeen` and `wetMats`, neither of which is visible from
// the scene graph — and a neon blade sign that stays bright at midnight is
// CORRECT. Intent cannot be read from outside, so world-wide this is a tally,
// not a verdict.
//
// Give it your module's box and it becomes a verdict, because then someone who
// knows the intent is asking. That is how it was used to find the car lot, and
// it is the usage that would have caught that bug without a human reading four
// floats and knowing what they should have been.

for (const s of skipped.slice(0, 12)) console.log(`     at ${s.x},${s.y},${s.z}`);
if (skipped.length > 12) console.log(`     …and ${skipped.length - 12} more`);
console.log(`
Each of these stands at full daylight brightness at midnight while everything
behind it goes dark. A cut-out discards its fragment and never blends, so
\`transparent: true\` buys it nothing and costs it its night grading. Delete the
flag; keep the alphaTest — unless it is meant to stay lit, in which case it
belongs in dimWorld's lit set rather than hidden behind a blend flag.`);
if (!SCOPED) {
  console.log(`
Informational: no box was given, so this is the whole world and some of these
are deliberate. Re-run with your module's box to get a verdict:
  node scripts/nightgrade.mjs x0 x1 z0 z1`);
  process.exit(0);
}
process.exit(1);
