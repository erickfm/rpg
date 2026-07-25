// Does the world's night grading actually reach this module's materials?
//
// A screenshot cannot answer that: "the fence looks a bit bright" is not a
// measurement, and the failure it hides is silent. props.ts's dimWorld SKIPS
// any material with `transparent: true` — correct for glass, and it means any
// prop that sets that flag when it only needed `alphaTest` stands at full
// daylight brightness at midnight while everything behind it goes dark.
//
// Class averages at noon and 23:00 are the headline. Treat them as a headline
// and nothing more: identical source, two runs, alphaCut at 23:00 read 0.891
// and then 0.670, because the grade is sampled a second after the clock jumps
// while the world is still moving. The variance is larger than most effects.
//
// db76dc26 fixed dimWorld's own test (`isGlass` excludes cut-outs), so the
// original fault here is closed at the source. What is left is the OTHER half
// of GOTCHAS §22 — the sorted transparent queue — which that commit did not
// touch, and that is what this now fails on. See the block further down.
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
      if (!each[m.uuid]) {
        const g = o.geometry?.parameters || {}, im = m.map?.image;
        each[m.uuid] = { key, v, cut: m.alphaTest > 0, tr: !!m.transparent,
          reach: Math.abs(o.position.x) <= 100,
          // what the thing IS, so its builder recognises it without a gazetteer
          shape: `${(g.width ?? 0).toFixed(2)}x${(g.height ?? 0).toFixed(2)} tex ${im?.width ?? '?'}x${im?.height ?? '?'}`,
          x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1) };
      }
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

// WHAT THIS TESTS, AFTER db76dc26 MOVED THE GROUND UNDER IT
//
// It used to test cause AND symptom together: carries `alphaTest` with
// `transparent`, and provably does not dim. That was right while `dimWorld`
// skipped on `transparent` alone. It no longer does — `isGlass` now excludes
// cut-outs, so the flag pair costs a material NOTHING at night and the two
// halves have come apart. Measured after that landed: world-wide non-dimmers
// fell 26 -> 13, and `alphaCut` at 23:00 fell 0.670 -> 0.377.
//
// Keeping the old wording would have this file explaining a cost that no longer
// exists, which is the exact fault it was written to catch elsewhere. So:
//
// THE VERDICT is GOTCHAS §22 — the flag pair — on its own. It is a static
// property, no timing and no threshold, and the rule still stands: a cut-out
// put in the sorted transparent queue gets DoubleSide sorting artifacts it
// would never have had. That cost was always the other half of §22 and it was
// not fixed by db76dc26.
//
// THE SYMPTOM IS NO LONGER A VERDICT, and this is the honest part. "Never moved
// between noon and 23:00" cannot tell deliberate from broken: `dimWorld` also
// skips `litSeen` and `wetMats`, neither visible from the scene graph, and it
// grades by elevation, so a high material can legitimately barely move. A
// floodlit car lot that stays bright at midnight is correct. It is reported
// with its numbers and it is not failed on.
const SCOPED = A.length === 4;
const pairs = Object.entries(day.each)
  .filter(([, d]) => d.cut && d.tr && d.reach)
  .map(([uuid, d]) => ({ uuid, ...d }));
const stillCount = Object.entries(day.each).filter(([u, d]) => {
  const n = night.each[u];
  return n && d.key !== 'additive' && d.v >= 0.02 && Math.abs(d.v - n.v) < 1e-4;
}).length;
if (SCOPED) {
  console.log(`\n${stillCount} gradable materials in the box never moved between noon and 23:00`);
  console.log('  (reported, not failed on — litSeen, wetMats and elevation grading are');
  console.log('   all invisible from out here, and a floodlit lot is meant to stay bright)');
} else {
  // World-wide this is 417 and it means nothing: most of the world is never
  // handed to dimWorld in the first place, and from outside that is
  // indistinguishable from being skipped by it. Only a box makes it a question
  // someone can answer.
  console.log('\nnever-moved count is only meaningful inside a box — give one to see it');
}
console.log(`\n${pairs.length} materials break GOTCHAS §22 — alphaTest AND transparent`);
if (!pairs.length) {
  console.log('  no cut-out is sitting in the transparent sort queue');
  process.exit(0);
}
const skipped = pairs;
// Group by proximity and hand each cluster back as a command you can run.
//
// The alternative was a table of named regions — "the car lot is 30..60" — and
// that is the stale-constant habit this file has already been bitten by once.
// Clusters come out of the data, so they follow the world.
const cl = [];
for (const m of skipped) {
  const near = cl.find((c) => Math.abs(c.cx - m.x) < 14 && Math.abs(c.cz - m.z) < 14);
  if (near) { near.list.push(m); near.cx = (near.cx * (near.list.length - 1) + m.x) / near.list.length;
              near.cz = (near.cz * (near.list.length - 1) + m.z) / near.list.length; }
  else cl.push({ cx: m.x, cz: m.z, list: [m] });
}
cl.sort((a, b) => b.list.length - a.list.length);
for (const c of cl) {
  const xs = c.list.map((m) => m.x), zs = c.list.map((m) => m.z);
  const pad = 3, box = [Math.min(...xs) - pad, Math.max(...xs) + pad,
                        Math.min(...zs) - pad, Math.max(...zs) + pad].map((n) => n.toFixed(0));
  const kinds = [...new Set(c.list.map((m) => m.shape))];
  console.log(`  ${String(c.list.length).padStart(3)} at ${c.cx.toFixed(0)},${c.cz.toFixed(0)}  ${kinds.slice(0, 2).join(' / ')}${kinds.length > 2 ? ` /+${kinds.length - 2}` : ''}`);
  console.log(`      node scripts/nightgrade.mjs ${box.join(' ')}`);
}
console.log(`
A cut-out discards its fragment and never blends, so \`transparent: true\` buys
these nothing. Since db76dc26 it no longer costs them their night grading, but
it still moves them into the sorted transparent queue, where DoubleSide geometry
picks up sorting artifacts it would never have had. Delete the flag; keep the
alphaTest.`);
if (!SCOPED) {
  console.log(`
Informational: no box was given, so this is the whole world and some of these
are deliberate. Re-run with your module's box to get a verdict:
  node scripts/nightgrade.mjs x0 x1 z0 z1`);
  process.exit(0);
}
process.exit(1);
