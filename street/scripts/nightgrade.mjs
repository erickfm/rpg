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
// --selftest: take one material's exemption away and require this to go red.
//
// This reports 0, and 0 is what a check that has stopped working also reports.
// The mutation is at RUNTIME. The obvious lever does NOT work and that is worth
// recording: clearing a sheet's `selfLit` does nothing, because props.ts
// re-stamps it in its per-frame pass and the flag is back before the probe
// reads it. A mutation the world repairs is not a mutation.
//
// So it goes the other way, onto ground the dimmer never walks: take a material
// dimWorld does NOT grade — one of the 456 it is never offered — and claim it
// was graded. Nothing rewrites those, so the claim sticks, and it is then
// exactly the shape this check exists to find: offered to the dimmer, not
// excused by any stamp, and unchanged between noon and 23:00.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const SELFTEST = process.argv.includes('--selftest');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4190/');   // GOTCHAS 26: prove it, do not just name it
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
          // props.ts stamps this on a sheet it grades and deliberately keeps
          // bright (8e473276). Without it, "kept lit on purpose" and "never
          // graded at all" look identical from out here, and this script was
          // reporting the first as a bug — thirteen tickets for a neon sign.
          selfLit: !!m.userData?.selfLit,
          // 6ced1c20, asked for in notes/A-nightgrade.md: props.ts stamps every
          // material it actually writes a colour to, and marks the wet registry
          // too. That is what makes "offered to the dimmer and did not move"
          // decidable — before it, that sentence could not be said from here.
          graded: !!m.userData?.graded, wet: !!m.userData?.wet,
          // b93cc2b1: a lamp pool caps the grade at daylight, so anything close
          // enough to a lantern is graded, rewritten every frame, and unchanged.
          // From outside that is identical to never having been touched. It is
          // the last thing this check could not explain, and the cause was
          // HORIZONTAL — 3.29 m from a lantern — which no elevation test could
          // ever have found.
          poolLit: !!m.userData?.poolLit,
          dbl: m.side === 2,
          // cf966b3d: ct/lot.ts stamps `userData.mod` on everything it adds.
          // Identity, not geography — walk up, because the stamp is applied to
          // the top-level child and inherited by everything under it.
          mod: (() => { for (let n = o; n; n = n.parent) if (n.userData?.mod) return n.userData.mod; return null; })(),
          // what the thing IS, so its builder recognises it without a gazetteer
          shape: `${(g.width ?? 0).toFixed(2)}x${(g.height ?? 0).toFixed(2)} tex ${im?.width ?? '?'}x${im?.height ?? '?'}`,
          x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1) };
      }
    });
    for (const k in out) out[k] = +(out[k].sum / out[k].n).toFixed(3);
    return { avg: out, each };
  }, [BOX]);
};

if (SELFTEST) {
  const hit = await p.evaluate(() => {
    let n = 0;
    window.__ct.scene().traverse((o) => {
      if (n || !o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (n || !m?.color || m.userData?.graded || m.userData?.selfLit) continue;
        if (m.blending === 2) continue;                        // not a light
        if ((m.color.r + m.color.g + m.color.b) / 3 < 0.02) continue;   // not black
        m.userData.graded = true;                              // a claim nothing will repair
        n++;
      }
    });
    return n;
  });
  console.log(`selftest: claimed ${hit} ungraded material as graded — this MUST now go red`);
}
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
const BOUNDS = await p.evaluate(() => globalThis.__bounds ?? []);
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
// THE SYMPTOM IS A VERDICT NOW, and it took two stamps from the modules that
// know the answers — neither of them mine, both asked for and both given.
//
//   userData.selfLit (8e473276)  a sheet props.ts grades and deliberately keeps
//                                bright. Written because this script handed its
//                                owner thirteen tickets for a neon sign.
//   userData.graded  (6ced1c20)  props.ts actually wrote a colour here. And
//                                userData.wet for the ones updateRain owns.
//
// Before them, "was offered to the dimmer and did not move" was a sentence that
// could not be said from outside: graded-but-unchanged and never-handed-to-the-
// dimmer are the same picture from here, which is why the un-boxed number was
// 417 and answered nothing. Now every clause is somebody's own mark and nothing
// is inferred, so this fails without needing a box.
//
// It is 1. From 417 unknowns to one material, by asking instead of guessing.
const SCOPED = A.length === 4;
// GOTCHAS §22 HAS TWO COSTS AND ONLY ONE OF THEM IS STILL LIVE.
//
//   the dimmer skip        — fixed at the source by db76dc26 (`isGlass`)
//   the transparent queue  — still live, but the harm §22 actually names is
//                            DoubleSide geometry picking up sorting artifacts
//                            it would never have had
//
// Measured: of the flag-pair materials in reach, 14 are FrontSide and ZERO are
// DoubleSide. So failing on all of them hands their author tickets for a harm
// that cannot occur in their case — which is precisely what 8e473276 had to
// correct me for once already. Fail on the pair only where the harm is real;
// list the rest as the rule violation they are and leave the judgement with
// the person who knows why the flag is there.
const allPairs = Object.entries(day.each)
  .filter(([, d]) => d.cut && d.tr && d.reach)
  .map(([uuid, d]) => ({ uuid, ...d }));
const pairs = allPairs.filter((d) => d.dbl);
const pairsFront = allPairs.filter((d) => !d.dbl);
// A GENUINE FAILURE, now that it can be stated: props.ts wrote a colour to this
// material (`graded`), it is not one props.ts deliberately keeps bright
// (`selfLit`), it is not a light, it is not black — and it still reads the same
// at 23:00 as at noon. Nothing is inferred; every clause is somebody's own mark.
// `wet` materials are excluded: they are graded by updateRain on its own curve.
const dead = Object.entries(day.each).filter(([u, d]) => {
  const n = night.each[u];
  // poolLit is read from the NIGHT probe, not the noon one. At noon the lamps
  // are off, `k > 0` is false, and the flag has not been set yet — reading it
  // at 13:00 finds it false on every material in the world. This file has made
  // that exact mistake once before, with `transparent` at 23:00. A flag is only
  // true at the hour that makes it true.
  return n && d.graded && !d.wet && !d.selfLit && !n.poolLit && d.key !== 'additive'
    && d.v >= 0.02 && Math.abs(d.v - n.v) < 1e-4;
}).map(([uuid, d]) => ({ uuid, ...d }));
const ungraded = Object.values(day.each).filter((d) => !d.graded && !d.selfLit).length;
if (SELFTEST) {
  // exit here: falling through to the normal verdict made a PASSING selftest
  // return 1, which npm run checks --selftest correctly showed as a failure.
  if (dead.length) { console.log(`SELFTEST PASSED — the unexcused material was caught (${dead.length})`); process.exit(0); }
  else { console.error('SELFTEST FAILED — an exemption was removed and this did not notice.'); await b.close?.(); process.exit(2); }
}
console.log(`\n${dead.length} materials were graded by dimWorld and did not move`);
console.log(`  (${ungraded} others were never offered to it at all — interiors and`);
console.log('   anything built outside its reach. That is not a fault, it is scope.)');
for (const d of dead)
  console.log(`   ${d.v.toFixed(3)} at ${d.x},${d.y},${d.z}  ${d.shape}`);
if (pairsFront.length) {
  console.log(`\n${pairsFront.length} materials break GOTCHAS §22 — but are FrontSide, so the`);
  console.log('  sorting harm §22 names cannot reach them, and db76dc26 fixed the dimming');
  console.log('  half at the source. Listed, not failed on: still worth deleting the flag,');
  console.log('  but not worth anyone being paged for it.');
}
console.log(`\n${pairs.length} materials break GOTCHAS §22 AND are DoubleSide — real artifact risk`);
if (!pairs.length) {
  console.log('  no DoubleSide cut-out is sitting in the transparent sort queue');
  process.exit(dead.length ? 1 : 0);
}
const skipped = pairs;
// Group by proximity and hand each cluster back as a command you can run.
//
// The alternative was a table of named regions — "the car lot is 30..60" — and
// that is the stale-constant habit this file has already been bitten by once.
// Clusters come out of the data, so they follow the world.
// A CLUSTER IS A PLACE, NOT AN OWNER — and I got that wrong in prose.
//
// This printed `34 50 -101 -94` with thirteen materials in it, and I called it
// "the car lot" in a note. It is not: ct/lot.ts's office board is at x 26.07,
// z 2.6, and the thirteen are a neon module. The tool reported a location
// honestly and I attached a name to it by eye, which is the same remembered-
// coordinate habit that has misrouted this finding twice.
//
// So: ask, do not guess. A module that publishes its own box gets named; one
// that does not is printed as coordinates and explicitly NOT attributed.
// ct/lot.ts publishes `LOT.bounds` (0bd7a0c1); the registry below is the same
// idea reachable from a script, and it is empty until modules opt in.
// Ask the objects first. `userData.mod` is an author's own mark, so it is right
// even when a module's things are scattered or interleaved with someone else's
// — which a box can never be. Fall back to a published box, and if neither
// exists, say nothing rather than infer a name by eye.
const owner = (c) => {
  const mods = [...new Set(c.list.map((m) => m.mod).filter(Boolean))];
  if (mods.length) return mods.join('+');
  const b = BOUNDS.find((b) => c.cx >= b.minX && c.cx <= b.maxX && c.cz >= b.minZ && c.cz <= b.maxZ);
  return b ? `${b.name} (by box)` : null;
};
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
  const who = owner(c);
  console.log(`  ${String(c.list.length).padStart(3)} at ${c.cx.toFixed(0)},${c.cz.toFixed(0)}  ${who ? who : '(unattributed)'}  ${kinds.slice(0, 2).join(' / ')}${kinds.length > 2 ? ` /+${kinds.length - 2}` : ''}`);
  console.log(`      node scripts/nightgrade.mjs ${box.join(' ')}`);
}
console.log(`
A cut-out discards its fragment and never blends, so \`transparent: true\` buys
these nothing. Since db76dc26 it no longer costs them their night grading, but
it still moves them into the sorted transparent queue, where DoubleSide geometry
picks up sorting artifacts it would never have had. Delete the flag; keep the
alphaTest.

A cluster marked (unattributed) is a LOCATION, not an owner. Nothing in it
carries an author's mark. Stamp \`userData.mod = '<your module>'\` on what you add
the way ct/lot.ts does (cf966b3d) and this names you instead of leaving the next
reader to guess by eye — which has misrouted this same finding three times.
A stamp beats a box: it stays right when your things are scattered or sit inside
someone else's.`);
process.exit(1);
