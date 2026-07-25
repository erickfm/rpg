// FLOAT AUDIT — find objects that touch nothing.
//
// Brief: "the sign up top is completely floating. make sure for stuff like this
// we pay more attention." Walk the scene graph and ask, of every mesh, what
// carries it.
//
//   SHOT_URL=http://localhost:4184/ node scripts/floats.mjs
//
// Method. Bounding boxes in WORLD space for every visible mesh, then a CONTACT
// GRAPH: two meshes are in contact if their boxes overlap or sit within EPS on
// every axis. Flood-fill "anchored" out from anything that reaches the ground
// (bbox minY <= GROUND_Y). Whatever the flood never reaches touches nothing.
//
// Why a graph and not "is there something under it": a wall-mounted bracket is
// held laterally, not from below, and a two-plane sign holds only itself. A
// component that reaches neither the ground nor a wall is the real defect, and
// that is exactly what the flood-fill answers.
//
// Output: shots/float-report.json + a ranked summary on stdout.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const EPS = Number(process.env.FLOAT_EPS ?? 0.05);   // "abut" tolerance
const GROUND_Y = 0.25; // a box reaching this low is standing on the world

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(1200);

const report = await page.evaluate(({ EPS, GROUND_Y }) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);

  const items = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // invisible things are parked off-world (the cruising car pool)
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (!isFinite(bb.min.x) || !isFinite(bb.max.x)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    items.push({
      i: items.length,
      min: [bb.min.x, bb.min.y, bb.min.z],
      max: [bb.max.x, bb.max.y, bb.max.z],
      geo: g.type,
      params: g.parameters
        ? Object.fromEntries(Object.entries(g.parameters)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => [k, +v.toFixed(3)]))
        : {},
      tris: g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3,
      mat: m ? m.type : '?',
      color: m && m.color ? '#' + m.color.getHexString() : null,
      hasMap: !!(m && m.map),
      additive: !!(m && m.blending === 2),          // THREE.AdditiveBlending
      transparent: !!(m && m.transparent),
      depthWrite: m ? m.depthWrite !== false : true,
      opacity: m ? m.opacity : 1,
    });
  });

  // contact graph
  const near = (a, b) =>
    a.min[0] - EPS <= b.max[0] && a.max[0] + EPS >= b.min[0] &&
    a.min[1] - EPS <= b.max[1] && a.max[1] + EPS >= b.min[1] &&
    a.min[2] - EPS <= b.max[2] && a.max[2] + EPS >= b.min[2];

  const adj = items.map(() => []);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (near(items[i], items[j])) { adj[i].push(j); adj[j].push(i); }
    }
  }

  // flood "anchored" out from anything that reaches the ground
  const anchored = items.map((it) => it.min[1] <= GROUND_Y);
  const stack = items.filter((_, i) => anchored[i]).map((_, i) => i)
    .filter((i) => anchored[i]);
  const q = [];
  items.forEach((_, i) => { if (anchored[i]) q.push(i); });
  while (q.length) {
    const i = q.pop();
    for (const j of adj[i]) if (!anchored[j]) { anchored[j] = true; q.push(j); }
  }

  // group the un-anchored into components so a two-plane sign reports once
  const comp = new Map();
  const seen = new Set();
  let cid = 0;
  for (let i = 0; i < items.length; i++) {
    if (anchored[i] || seen.has(i)) continue;
    const members = [];
    const s = [i]; seen.add(i);
    while (s.length) {
      const k = s.pop(); members.push(k);
      for (const j of adj[k]) if (!anchored[j] && !seen.has(j)) { seen.add(j); s.push(j); }
    }
    comp.set(cid++, members);
  }

  // for each floating component: how far is the nearest anchored thing, and
  // what is the biggest drop to whatever lies under its footprint
  const gapTo = (a, b) => {
    const d = (lo1, hi1, lo2, hi2) => (lo1 > hi2 ? lo1 - hi2 : lo2 > hi1 ? lo2 - hi1 : 0);
    return Math.hypot(
      d(a.min[0], a.max[0], b.min[0], b.max[0]),
      d(a.min[1], a.max[1], b.min[1], b.max[1]),
      d(a.min[2], a.max[2], b.min[2], b.max[2]));
  };
  const out = [];
  for (const [id, members] of comp) {
    const bbmin = [Infinity, Infinity, Infinity], bbmax = [-Infinity, -Infinity, -Infinity];
    for (const k of members) for (let a = 0; a < 3; a++) {
      bbmin[a] = Math.min(bbmin[a], items[k].min[a]);
      bbmax[a] = Math.max(bbmax[a], items[k].max[a]);
    }
    // nearest anchored mesh in the world, and what is directly beneath
    let nearest = Infinity, nearestIdx = -1;
    let below = 0, belowIdx = -1;
    for (let j = 0; j < items.length; j++) {
      if (!anchored[j]) continue;
      const it = items[j];
      let d = Infinity;
      for (const k of members) d = Math.min(d, gapTo(items[k], it));
      if (d < nearest) { nearest = d; nearestIdx = j; }
      // overlapping footprint and lower than us?
      const overlapXZ = it.min[0] <= bbmax[0] && it.max[0] >= bbmin[0] &&
                        it.min[2] <= bbmax[2] && it.max[2] >= bbmin[2];
      if (overlapXZ && it.max[1] <= bbmin[1] && it.max[1] > below - 1e-9) {
        below = it.max[1]; belowIdx = j;
      }
    }
    out.push({
      id,
      meshes: members.length,
      bbox: { min: bbmin.map((v) => +v.toFixed(3)), max: bbmax.map((v) => +v.toFixed(3)) },
      centre: bbmin.map((v, a) => +((v + bbmax[a]) / 2).toFixed(2)),
      dropToSurfaceBelow: +(bbmin[1] - below).toFixed(3),
      surfaceBelowY: +below.toFixed(3),
      gapToNearestAnchored: +nearest.toFixed(3),
      nearestAnchored: nearestIdx >= 0 ? {
        geo: items[nearestIdx].geo, params: items[nearestIdx].params,
        color: items[nearestIdx].color,
        centre: items[nearestIdx].min.map((v, a) => +((v + items[nearestIdx].max[a]) / 2).toFixed(2)),
      } : null,
      allAdditive: members.every((k) => items[k].additive),
      anyAdditive: members.some((k) => items[k].additive),
      parts: members.map((k) => ({
        geo: items[k].geo, params: items[k].params, mat: items[k].mat,
        color: items[k].color, hasMap: items[k].hasMap, additive: items[k].additive,
        tris: items[k].tris,
        centre: items[k].min.map((v, a) => +((v + items[k].max[a]) / 2).toFixed(2)),
        size: items[k].max.map((v, a) => +(v - items[k].min[a]).toFixed(3)),
      })),
    });
  }
  out.sort((a, b) => b.dropToSurfaceBelow - a.dropToSurfaceBelow);
  return { totalMeshes: items.length, anchored: anchored.filter(Boolean).length, floating: out };
}, { EPS, GROUND_Y });

writeFileSync('shots/float-report.json', JSON.stringify(report, null, 2));
console.log(`meshes: ${report.totalMeshes}   anchored: ${report.anchored}   floating components: ${report.floating.length}\n`);
for (const c of report.floating) {
  const tag = c.allAdditive ? ' [additive/glow]' : c.anyAdditive ? ' [has glow]' : '';
  console.log(
    `#${c.id}${tag}  ${c.meshes} mesh(es)  centre (${c.centre.join(', ')})\n` +
    `      drop to surface below: ${c.dropToSurfaceBelow} m   (surface at y=${c.surfaceBelowY})\n` +
    `      gap to nearest anchored mesh: ${c.gapToNearestAnchored} m` +
    (c.nearestAnchored ? `  → ${c.nearestAnchored.geo} ${JSON.stringify(c.nearestAnchored.params)} at (${c.nearestAnchored.centre.join(', ')})` : '') + '\n' +
    c.parts.map((p) => `      · ${p.geo} ${JSON.stringify(p.params)} ${p.mat}${p.color ? ' ' + p.color : ''}${p.hasMap ? ' +map' : ''}${p.additive ? ' ADDITIVE' : ''} size ${p.size.join('×')} at (${p.centre.join(', ')})`).join('\n'));
  console.log('');
}
await browser.close();
if (errors.length) console.error('PAGE ERRORS:\n' + errors.join('\n'));
