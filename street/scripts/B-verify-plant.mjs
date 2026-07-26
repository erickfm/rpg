// VERIFYING G's ROW: "whats wrong with this plant in the tax service place".
//
// This row is unusually checkable, because G did not just say "fixed" — it said
// exactly WHAT was wrong, in texels: *"the leaf sprays ended about y 20 and the
// pot started at y 31: 11 texels of 48, 0.275 m of the 1.2 m it stood, blank
// between them, and no stem drawn at all."*
//
// A claim in texels can be checked in texels. So this reads the plant's own
// canvas out of the live world and measures the blank band itself, rather than
// looking at a screenshot and agreeing. If the gap is closed there is no row of
// the sheet, across the trunk's width, that is empty between the foliage and
// the soil.
//
// It also checks the thing the desk originally guessed and G explicitly denied
// — that pot and foliage are two objects that can drift apart. One plane cannot
// drift; two can. That is worth confirming independently because the whole
// diagnosis rests on it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const res = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // the tax office, by ct/int-tax.ts's own d: 8.5, h: 2.75 — found, not recalled
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    const mat = Array.isArray(n.material) ? n.material[0] : n.material;
    m.push({ n, x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
             plane: n.geometry.type === 'PlaneGeometry', mat });
  });
  const xs = m.map((q) => (q.x0 + q.x1) / 2).sort((a, c) => a - c);
  const spans = []; let st = xs[0], pv = xs[0];
  for (const v of xs) { if (v - pv > 12) { spans.push([st, pv]); st = v; } pv = v; }
  spans.push([st, pv]);
  let room = null;
  for (const [s0, s1] of spans) {
    const inR = m.filter((q) => (q.x0 + q.x1) / 2 >= s0 - 6 && (q.x0 + q.x1) / 2 <= s1 + 6);
    if (inR.length < 25) continue;
    let floor = null, ceil = null;
    for (const q of inR) {
      const a = (q.x1 - q.x0) * (q.z1 - q.z0);
      if (q.y1 <= 0.35 && (!floor || a > (floor.x1 - floor.x0) * (floor.z1 - floor.z0))) floor = q;
      if (q.y0 >= 2.0 && q.y1 - q.y0 <= 0.4 && a > 8 && (ceil === null || q.y0 < ceil)) ceil = q.y0;
    }
    if (!floor || ceil === null) continue;
    const D = floor.z1 - floor.z0;
    const err = Math.abs(D - 8.5) + Math.abs(ceil - 2.75) * 4;
    if (!room || err < room.err) room = { err, inR, cx: (floor.x0 + floor.x1) / 2,
      cz: (floor.z0 + floor.z1) / 2, D: +D.toFixed(1), ceil: +ceil.toFixed(2) };
  }
  if (!room) return { err: 'no room matched' };

  // A POTTED PLANT: a standing plane about a metre wide and 1.2-1.6 m tall,
  // sitting on the floor. G says it is ONE plane; count how many there are.
  const plants = room.inR.filter((q) => q.plane && q.y0 < 0.25
    && q.y1 - q.y0 > 1.0 && q.y1 - q.y0 < 1.9
    && Math.max(q.x1 - q.x0, q.z1 - q.z0) > 0.5 && Math.max(q.x1 - q.x0, q.z1 - q.z0) < 1.4
    && q.mat?.map?.image && q.mat.map.image.width < 120);
  const out = [];
  for (const q of plants) {
    const img = q.mat.map.image;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const d = cv.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    // per ROW, how many texels are opaque, and where are they
    const rows = [];
    for (let y = 0; y < img.height; y++) {
      let n = 0, lo = 1e9, hi = -1;
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (d[i + 3] >= 128) { n++; lo = Math.min(lo, x); hi = Math.max(hi, x); }
      }
      rows.push({ y, n, lo: n ? lo : null, hi: n ? hi : null });
    }
    const first = rows.findIndex((r) => r.n > 0);
    const last = rows.length - 1 - [...rows].reverse().findIndex((r) => r.n > 0);
    // the blank band: the longest run of EMPTY rows between the first and last
    // drawn row — that is exactly the "11 texels of 48" G measured
    let run = 0, worst = 0, worstAt = null;
    for (let y = first; y <= last; y++) {
      if (rows[y].n === 0) { run++; if (run > worst) { worst = run; worstAt = y - run + 1; } }
      else run = 0;
    }
    // and the THINNEST row in that middle band — a stem is thin but not zero
    let thin = 1e9, thinAt = null;
    for (let y = first + 3; y < last - 3; y++) {
      if (rows[y].n > 0 && rows[y].n < thin) { thin = rows[y].n; thinAt = y; }
    }
    out.push({ tex: `${img.width}x${img.height}`,
               world: [+((q.x0 + q.x1) / 2).toFixed(2), +((q.y0 + q.y1) / 2).toFixed(2), +((q.z0 + q.z1) / 2).toFixed(2)],
               size: [+(q.x1 - q.x0).toFixed(2), +(q.y1 - q.y0).toFixed(2)],
               drawnRows: [first, last], blankRun: worst, blankAt: worstAt,
               thinnest: thin === 1e9 ? null : thin, thinnestAt: thinAt,
               pxPerM: +(img.height / (q.y1 - q.y0)).toFixed(1) });
  }
  return { room: { cx: +room.cx.toFixed(1), cz: +room.cz.toFixed(2), D: room.D, ceil: room.ceil },
           n: plants.length, plants: out };
});

if (res.err) { console.log(res.err); await b.close(); process.exit(2); }
console.log(`\ntax office by ct/int-tax.ts's own d: 8.5 / h: 2.75 -> depth ${res.room.D}, ceiling ${res.room.ceil}` +
  `  centre (${res.room.cx}, ${res.room.cz})`);
console.log(`\n── the plant ──`);
console.log(`  ${res.n} standing plant-shaped plane(s) in the room. G's diagnosis says ONE plane,`);
console.log(`  which is what makes "pot and foliage cannot drift apart" true; two would not.`);
for (const q of res.plants) {
  console.log(`\n  ${q.tex} over ${q.size[0]} x ${q.size[1]} m  (${q.pxPerM} px/m)  at ${JSON.stringify(q.world)}`);
  console.log(`    drawn from row ${q.drawnRows[0]} to ${q.drawnRows[1]}`);
  console.log(`    LONGEST BLANK BAND between them: ${q.blankRun} rows` +
    (q.blankAt !== null ? ` starting at row ${q.blankAt}` : ''));
  console.log(`    thinnest drawn row in the middle: ${q.thinnest} texels at row ${q.thinnestAt}` +
    `   (a stem is thin; a gap is zero)`);
  console.log(`    G measured the OLD sheet at 11 blank rows of 48 — 0.275 m of blank on a 1.2 m plant.`);
  console.log(`    this one: ${q.blankRun} blank rows of ${q.tex.split('x')[1]}` +
    ` = ${(q.blankRun / q.pxPerM).toFixed(3)} m`);
}

// and look at it
const pl = res.plants[0];
if (pl) {
  const dx = res.room.cx - pl.world[0], dz = res.room.cz - pl.world[2];
  const L = Math.hypot(dx, dz) || 1;
  for (const [name, back] of [['near', 1.6], ['room', 3.0]]) {
    const sx = pl.world[0] + (dx / L) * back, sz = pl.world[2] + (dz / L) * back;
    const yaw = Math.atan2(pl.world[0] - sx, -(pl.world[2] - sz));
    await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0.05), [sx, sz, yaw]);
    const lum = await settle(p);
    const f = `shots/B-verify-G/plant-${name}.png`;
    await p.screenshot({ path: f });
    console.log(`  ${f.padEnd(34)} from (${sx.toFixed(2)}, ${sz.toFixed(2)})  mean ${lum.toFixed(4)}`);
  }
}
await b.close();
