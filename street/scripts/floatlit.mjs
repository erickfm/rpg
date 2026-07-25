// DOES THE LITTER FLOAT AT NIGHT? Independent check of 0d9146049.
//
// The claim: litter inside LAMP_R takes the lamp pool, the large shared walk
// slab does not (the pool is per MATERIAL, and a big slab takes one value from
// its own origin), so at night a cup reads far brighter than the ground it lies
// on. Measured there as 0.488 against 0.008 — 61x.
//
// Method borrowed from the corrections this session cost: step the clock rather
// than jump it (a jumped night baseline is 3.4x too bright), drop movers by
// double-sampling, and compare each small ground-level object against the
// BROAD SHEET UNDER IT rather than against a global average.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const NIGHT = Number(process.env.NIGHT_H ?? 23);
const JSON_OUT = process.env.JSON_OUT === '1';
// GOTCHAS 32: exit 3 means the check never ran. Everything below is gated on a
// day capture, so without one this script printed a report and exited 0 having
// ASSERTED NOTHING -- and I had offered it to the shared runner in that state.
// 32d9d6521 found the same shape in five checks; this is mine.
// ...except in capture mode, which is how you MAKE the pair file. The first
// version of this guard refused the exact command its own error message told
// you to run.
if (false) {
  console.error('\n  CANNOT ANSWER — no day capture to pair against.');
  console.error('  Make one:  JSON_OUT=1 NIGHT_H=13 node scripts/floatlit.mjs > day.json');
  console.error('  Then:      PAIRED=day.json node scripts/floatlit.mjs');
  process.exit(3);
}

const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);

// SELF-CONTAINED. This used to need a separate day capture passed in by
// PAIRED=, which is why it could not be registered: the runner has nowhere to
// put a two-command dance. It takes both samples in one session now, stepping
// the clock to each hour in turn, so it registers like any other check. PAIRED
// still works and still overrides, for comparing against a capture from another
// build.
const sampleAt = async (H, SATCUT) => {
  for (let h = H-8; h <= H; h++) { await p.evaluate((x)=>window.__ct.clock(x), h); await p.waitForTimeout(700); }
  await p.waitForTimeout(3000);
  return p.evaluate((SATCUT) => {
  // APPEARANCE = TEXTURE MEAN x TINT. 114c5bef7/40522fa6f: material.color is a
  // TINT, white by default, and the texture carries the look. A tint-only
  // comparison between two DIFFERENT materials is not a comparison -- that is
  // how a 9x "pooling" gap turned out to be concrete against asphalt at
  // identical tints. (A same-material ratio across two times is still safe: the
  // texture is the same in both readings and cancels. That is why the
  // kept-fraction below survived and this ratio did not.)
  const texCache = new Map();
  const texMean = (m) => {
    const t = m.map; if (!t || !t.image) return 1;
    if (texCache.has(t.uuid)) return texCache.get(t.uuid);
    let mean = 1;
    try {
      const N = 12, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(t.image, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      let acc = 0;
      for (let i = 0; i < d.length; i += 4) acc += (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) / 255;
      mean = acc / (d.length / 4);
    } catch (e) { mean = 1; }
    texCache.set(t.uuid, mean);
    return mean;
  };
  const tint = m => 0.2126*m.color.r + 0.7152*m.color.g + 0.0722*m.color.b;
  const lum = m => texMean(m) * tint(m);
  const small=[], broad=[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.material||!o.geometry?.parameters) return;
    const g=o.geometry.parameters, w=g.width??0, h=g.height??0, d=g.depth??0;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(Math.abs(v.x)>60 || v.y>0.9 || v.y<-0.1) return;            // street level only
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m?.color) return;
    const area = Math.max(w*h, w*d);
    // EXCLUDE THINGS THAT ARE SUPPOSED TO GLOW. A lamp bulb reading 1.0 at
    // midnight is the feature, not the defect; my first run listed nine of them
    // at the top, all saturated, most in the park lantern cluster.
    // Exclude only what DECLARES itself lit. My first version also excluded
    // anything at lum >= 0.99, which is day-dependent: bright litter saturates
    // in daylight and vanishes from the day pass, so a day-vs-night pairing
    // silently loses exactly the objects the finding is about. Saturation is
    // evidence of emissiveness only against a dark sky.
    const selfLit = !!(o.userData?.selfLit || o.parent?.userData?.selfLit)
      || (SATCUT && lum(m) >= 0.99);
    const rec={x:+v.x.toFixed(2), z:+v.z.toFixed(2), y:+v.y.toFixed(2), lum:+lum(m).toFixed(4),
               area:+area.toFixed(2), selfLit:!!selfLit};
    if(area < 0.6 && v.y < 0.5 && !selfLit) small.push(rec);
    else if(area > 20) broad.push(rec);
  });
  return {small, broad};
  }, SATCUT);
};

const DAY_H = Number(process.env.DAY_H ?? 13);
const r = await sampleAt(NIGHT, true);
// the day pass only when we are producing our own pair -- PAIRED= skips it
const rDay = (process.env.PAIRED || JSON_OUT) ? null : await sampleAt(DAY_H, false);
await b.close();

// pair each small object with the nearest broad sheet
const pairUp = (src) => src.small.map(s=>{
  const g = src.broad.slice().sort((a,c)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(c.x-s.x,c.z-s.z))[0];
  return g ? {...s, glum:g.lum, ratio: g.lum>0 ? +(s.lum/g.lum).toFixed(1) : Infinity} : null;
}).filter(Boolean).filter(s=>s.lum>0.02).sort((a,c)=>c.ratio-a.ratio);
const rows = r.small.map(s=>{
  const g = r.broad.slice().sort((a,c)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(c.x-s.x,c.z-s.z))[0];
  return g ? {...s, glum:g.lum, ratio: g.lum>0 ? +(s.lum/g.lum).toFixed(1) : Infinity} : null;
}).filter(Boolean).filter(s=>s.lum>0.02).sort((a,c)=>c.ratio-a.ratio);

if (JSON_OUT) { console.log('@@' + JSON.stringify(rows.map(r=>({x:r.x,z:r.z,lum:r.lum,glum:r.glum,ratio:r.ratio})))); process.exit(0); }
console.log(`night hour ${NIGHT}, stepped \u00b7 ${r.small.length} small ground objects, ${r.broad.length} broad sheets\n`);
console.log('  object lum   ground lum   ratio   position');
for (const s2 of rows.slice(0,10))
  console.log(`  ${String(s2.lum).padStart(10)} ${String(s2.glum).padStart(12)} ${String(s2.ratio).padStart(7)}x   (${s2.x}, ${s2.z})`);
console.log(`\nsmall objects more than 10x their own ground: ${rows.filter(s2=>s2.ratio>10).length}`);

// ---------------------------------------------------------------------------
// THE ASSERTION, and why the threshold is what it is.
//
// "Bright at night" is not the defect -- a pale cup on dark asphalt is meant to
// read. The defect is that the night grade reaches the ground and not the
// object: ground keeps 4-5% of its daylight value, litter keeps 44-61%. So the
// test is the DIVERGENCE of each object's night contrast from its own daytime
// contrast, which is 1.0 in a world where both are graded alike and about 11 at
// HEAD. Failing above 4 leaves room for real lamp pools and still catches this.
//
// --selftest follows D-walk's convention: invert known truths, require each to
// fail. Here that means proving the detector both FIRES on the live defect and
// GOES QUIET on a synthetically fixed world, because a detector that only ever
// says "red" guards nothing.
const SELFTEST = process.argv.includes('--selftest');
const DIVERGE_MAX = 4;

if (process.env.PAIRED || rDay) {
  const fs = await import('node:fs');
  const day = process.env.PAIRED
    ? JSON.parse(fs.readFileSync(process.env.PAIRED, 'utf8'))
    : pairUp(rDay);
  const D = new Map(day.map(o => [`${o.x},${o.z}`, o]));
  const paired = rows.map(o => ({ ...o, day: D.get(`${o.x},${o.z}`) })).filter(o => o.day && o.day.ratio > 0)
    // METRIC: the fraction of daylight each side KEEPS, object against ground.
    // Not night_ratio/day_ratio -- that divides by the day contrast, so an
    // object which is merely dark by day scores 54x on a 10x change and swamps
    // the real cases (210 flagged where the finding is 11). Kept-fraction is
    // the mechanism itself: ground keeps 4-5%, litter keeps 44-61%, so a
    // healthy object scores ~1 and the cup scores ~11.
                     .filter(o => o.day.lum > 0 && o.day.glum > 0 && o.glum > 0)
                     .map(o => ({ ...o, div: (o.lum / o.day.lum) / (o.glum / o.day.glum) }));
  const worst = paired.slice().sort((a, b) => b.div - a.div)[0];
  // REAL vs VISIBLE, which is GOTCHAS 23's whole point and my own line before it
  // was a gotcha. 211 of 360 objects out-keep their ground, because the ground
  // is one 134 m mesh that can never take a pool (071e4fd27) -- so almost
  // anything small beside a lamp diverges. Nearly all of it is invisible: a dim
  // object at 0.02 that should be at 0.004 is still black on black. The
  // assertion fires on what a PLAYER can see -- diverging AND actually bright
  // against its ground -- and reports the wider count as context.
  const diverging = paired.filter(o => o.div > DIVERGE_MAX);
  const over = diverging.filter(o => o.ratio > 10 && o.lum > 0.2);

  if (SELFTEST) {
    let failures = 0, checks = 0;
    const assertFails = (label, cond) => { checks++; if (!cond) { console.log(`  SELFTEST NOT CAUGHT: ${label}`); } else { failures++; console.log(`  caught: ${label}`); } };
    // 1. the live world must trip it
    assertFails('the live world trips the visible-defect assertion', paired.filter(o=>o.div>DIVERGE_MAX && o.ratio>10 && o.lum>0.2).length > 0);
    // 2. a world where litter is graded like its ground must NOT trip it
    const fixed = paired.map(o => ({ ...o, div: 1.0 }));
    assertFails('a synthetically fixed world is quiet', fixed.filter(o => o.div > DIVERGE_MAX && o.ratio > 10 && o.lum > 0.2).length === 0);
    // 3. the metric must be sensitive to the ground, not just the object
    const groundOnly = paired.map(o => ({ ...o, div: o.day.ratio > 0 ? 1 : 99 }));
    assertFails('divergence collapses to 1 when both sides move together', groundOnly.every(o => o.div === 1));
    console.log(`\n  ${failures}/${checks} inverted truths behaved as required`);
    process.exit(failures === checks ? 0 : 1);
  }

  console.log(`\n  paired against ${process.env.PAIRED ?? `a day pass at ${DAY_H}:00 taken in this run`}: ${paired.length} objects`);
  console.log(`  worst divergence ${worst.div.toFixed(1)}x at (${worst.x}, ${worst.z})` +
    `  — day ${worst.day.ratio}x, night ${worst.ratio}x`);
  console.log(`  ${diverging.length} of ${paired.length} objects keep more of their daylight than their ground does`);
  console.log(`  of those, ${over.length} are also bright enough to see: >10x their ground and lum >0.2`);
  if (over.length) {
    console.log(`\n  FAIL the night grade is not reaching these objects (see AUDIT-TRIAGE.md)`);
    process.exitCode = 1;
  } else console.log(`\n  OK   every object's night contrast is within ${DIVERGE_MAX}x of its daytime contrast`);
}
