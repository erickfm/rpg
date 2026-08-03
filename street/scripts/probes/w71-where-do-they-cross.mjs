// Item 201 — (A) OR (B)? WHERE DOES THE CROWD ACTUALLY ENTER THE ROAD, AND
// WHERE IS THE PAINT?
//
// The user: *"the pedestrians dont cross at the cross walk."* The row says
// establish which of two things is happening before touching the network:
//
//   (A) the walk network has a `road` edge somewhere the paint is not
//   (B) they are not crossing at all — they are STUCK, and he is reading a
//       freeze as a routing choice
//
// (B) is live because item 173/207 is the pinning row and the two figures in his
// screenshot are STANDING. So this measures both at once: every sample a citizen
// spends in the carriageway, WHERE it was, and WHETHER THEY WERE MOVING.
//
// Citizens are tracked the way `w71-crowd-health.mjs` tracks them — the 0.5 x 0.5
// boxes in `actorColliders()`, which ARE the walkers (ct/crowd.ts:270) — sampled
// per frame in the page, because a crossing takes a couple of seconds and a poll
// from node would miss where it started.
//
// THE PAINT IS FOUND IN THE SCENE, not read from a constant: the whole question
// is whether the graph and the paint agree, and taking both from the same source
// file would beg it. `crossingStripes` builds a transparent PlaneGeometry lying
// flat on the road, so it is found by shape and orientation.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-where-do-they-cross.mjs [seconds]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const SECS = Number(process.argv[2] || 240);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(700);

// ── 1. WHERE IS THE PAINT? ────────────────────────────────────────────────
const paint = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.transparent) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    bb.applyMatrix4(o.matrixWorld);
    // flat on the road: thin in y, and low
    if (bb.max.y > 0.25 || bb.max.y - bb.min.y > 0.2) return;
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    if (w < 1.5 && d < 1.5) return;
    out.push({ x: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
      z: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)],
      y: +bb.max.y.toFixed(3), mod: o.userData.mod || '' });
  });
  return out;
});
console.log('\n=== FLAT TRANSPARENT ROAD MARKINGS FOUND IN THE SCENE');
for (const q of paint) console.log(`  x ${q.x[0]}..${q.x[1]}   z ${q.z[0]}..${q.z[1]}   y ${q.y}   mod=${q.mod}`);

// THE TWO JUNCTION CROSSINGS, picked out of the markings above by being at the
// junction (z < -80). The third tex-ground marking is the car-lot mouth apron at
// z -4.4..9.6, which is a kerb cut for vehicles and not a crossing.
const zebra = paint.filter((q) => q.mod === 'tex-ground' && q.z[1] < -80);
console.log(`\n${zebra.length} painted junction crossings taken as the target:`);
for (const q of zebra) console.log(`  x ${q.x[0]}..${q.x[1]}  z ${q.z[0]}..${q.z[1]}`);
if (zebra.length !== 2) {
  console.log('REFUSING TO REPORT: expected exactly 2 painted junction crossings');
  await b.close(); process.exit(3);
}

// ── 2. WHERE DO THEY GO IN THE ROAD, AND ARE THEY MOVING? ────────────────
await p.evaluate((zeb) => {
  window.__w71zebra = zeb;
  const cits = () => window.__ct.actorColliders().filter((c) =>
    Math.abs((c.maxX - c.minX) - 0.5) < 1e-6 && Math.abs((c.maxZ - c.minZ) - 0.5) < 1e-6);
  const S = { n0: cits().length, frames: 0, tPrev: performance.now(),
    prev: [], inMain: [], inSide: [], stillInRoad: 0, movingInRoad: 0, roadFrames: 0,
    onPaint: 0, offPaint: 0, offSamples: [] };
  window.__w71x = S;
  // ── "IN THE ROAD" IS ASKED OF THE GROUND, NOT OF COORDINATES ──────────────
  //
  // The first cut of this probe tested `x > ROAD_HALF` for the side street with
  // no upper bound, and counted 556 samples at x 56..58 as jaywalking. That is
  // the JAIL'S FOOTWAY (EWALK_X = SIDE_X1 + 1 = 56) — pavement, at kerb height,
  // where the ring legitimately closes round the closed east end. My predicate
  // was the liar, not the crowd.
  //
  // So the carriageway is now whatever the world's own floor picker says is
  // carriageway: the road reads 0 and the pavement reads KERB_H (0.14), so
  // anything under half a kerb is road. Nothing here retypes a street dimension,
  // and it cannot go stale if the kerb line moves.
  const ROAD_HALF = 5, SIDE_Z0 = -98, SIDE_Z1 = -108;
  const onRoad = (x, z) => window.__ct.groundAt(x, z) < 0.07;
  const step = () => {
    const c = cits();
    if (c.length !== S.n0) { requestAnimationFrame(step); return; }
    const now = performance.now();
    const dt = Math.min(0.2, (now - S.tPrev) / 1000); S.tPrev = now; S.frames++;
    for (let i = 0; i < c.length; i++) {
      const x = (c[i].minX + c[i].maxX) / 2, z = (c[i].minZ + c[i].maxZ) / 2;
      const pv = S.prev[i];
      const speed = pv ? Math.hypot(x - pv.x, z - pv.z) / Math.max(dt, 1e-4) : 0;
      S.prev[i] = { x, z };
      // THE FLOOR DECIDES whether this is road; the coordinates only decide
      // WHICH road, so the histogram can separate the two crossings.
      const road = onRoad(x, z);
      const inMain = road && Math.abs(x) < ROAD_HALF && z > SIDE_Z0;
      const inSide = road && z < SIDE_Z0 && z > SIDE_Z1 && x > ROAD_HALF;
      if (inMain || inSide) {
        S.roadFrames++;
        // ON THE PAINT? The citizen's own footprint radius is 0.28 (crowd.ts:285),
        // so a walker whose centre is within that of the stripes is on them.
        const R = 0.28;
        const on = zeb.some((q) => x + R > q.x[0] && x - R < q.x[1] && z + R > q.z[0] && z - R < q.z[1]);
        if (on) S.onPaint++;
        else { S.offPaint++; if (S.offSamples.length < 4000) S.offSamples.push([+x.toFixed(1), +z.toFixed(1)]); }
        if (speed < 0.05) S.stillInRoad++; else S.movingInRoad++;
        if (inMain && S.inMain.length < 6000) S.inMain.push(+z.toFixed(2));
        if (inSide && S.inSide.length < 6000) S.inSide.push(+x.toFixed(2));
      }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}, zebra);
console.log(`\nwatching ${SECS} s…`);
await p.waitForTimeout(SECS * 1000);

const r = await p.evaluate(() => {
  const S = window.__w71x;
  const hist = (a, lo, hi, step) => {
    const bins = new Map();
    for (const v of a) { const k = Math.floor((v - lo) / step) * step + lo; bins.set(k, (bins.get(k) || 0) + 1); }
    return [...bins].sort((x, y) => x[0] - y[0]);
  };
  const bins = new Map();
  for (const [x, z] of S.offSamples) { const k = `${Math.round(x / 4) * 4},${Math.round(z / 4) * 4}`; bins.set(k, (bins.get(k) || 0) + 1); }
  return { frames: S.frames, n0: S.n0, roadFrames: S.roadFrames,
    onPaint: S.onPaint, offPaint: S.offPaint,
    offBins: [...bins].sort((a, c) => c[1] - a[1]).slice(0, 8),
    still: S.stillInRoad, moving: S.movingInRoad,
    mainN: S.inMain.length, sideN: S.inSide.length,
    mainHist: hist(S.inMain, -110, 10, 2), sideHist: hist(S.inSide, 0, 60, 2) };
});

console.log(`\n${r.frames} frames, ${r.n0} citizens`);
console.log(`citizen-frames in a carriageway: ${r.roadFrames}   moving ${r.moving}  STANDING STILL ${r.still}`);
console.log('\n  crossing the MAIN street — where along z (2 m bins):');
for (const [k, n] of r.mainHist) console.log(`    z ${String(k).padStart(6)}..${String(k + 2).padStart(6)}  ${'#'.repeat(Math.min(60, Math.ceil(n / 20)))} ${n}`);
console.log('\n  crossing the SIDE street — where along x (2 m bins):');
for (const [k, n] of r.sideHist) console.log(`    x ${String(k).padStart(6)}..${String(k + 2).padStart(6)}  ${'#'.repeat(Math.min(60, Math.ceil(n / 20)))} ${n}`);
const pct = (100 * r.onPaint / Math.max(1, r.roadFrames)).toFixed(1);
console.log(`\n  ON THE PAINT : ${r.onPaint} of ${r.roadFrames} carriageway samples  (${pct}%)`);
console.log(`  OFF IT       : ${r.offPaint}`);
if (r.offBins.length) { console.log('  where the off-paint samples are (4 m bins):');
  for (const [k, n] of r.offBins) console.log(`      (${k})  ${n}`); }
console.log(`\nconsole errors: ${errs.length}`);
if (r.roadFrames === 0) { console.log('NOTHING MEASURED — nobody entered a carriageway; the answer below would be vacuous'); await b.close(); process.exit(3); }
await b.close();
