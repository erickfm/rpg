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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
// same predicate as ct/props.ts rainAt(), and as wetness.mjs duplicates it
const rainy = (h) => (((h % 24) + 24) % 24) === 14 ||
  ((Math.imul(h, 2246822519) >>> 0) % 100) < 30;

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

// a wet hour the world guarantees, and the nearest dry hour, so the sun barely moves
const wetH = 14;
const dryH = [13, 15, 12, 16, 11, 17].find((h) => !rainy(h));
if (dryH === undefined) { console.error('no dry hour near 14'); process.exit(2); }

// MEASURED, not guessed: after clock(14) the road walks 1.000 → 0.597 → 0.329 →
// 0.224 → 0.186 → 0.172 → 0.167 → 0.165 at two-second intervals. The wet look
// takes ~16 s to settle, so anything sampled earlier reads as partly dry.
const SETTLE_MS = 18000;

const sample = async (h) => {
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

const W = new Map(wet.map((m) => [m.id, m]));
const rows = [];
for (const d of dry) {
  const w = W.get(d.id);
  if (!w || d.lum <= 0.001) continue;
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
console.log(`dry hour ${dryH}, wet hour ${wetH}   ·   ${out.length} outdoor materials joined\n`);
console.log(`CONTROL — the surfaces that DID respond: ${responded.length}`);
for (const r of best) console.log(`   ${pct(r.drop)}  ${r.mod || r.name}  at (${r.x}, ${r.z})`);
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
