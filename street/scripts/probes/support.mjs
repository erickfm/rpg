// FLOAT AUDIT, pass 2 — WEAK SUPPORT.
//
// floats.mjs answers "does this touch anything at all". That catches a sign on
// a stub mast in clear air, but not the commoner defect: an object that grazes
// something and so passes a contact test while still having no visible means of
// support — an awning with no bracket, a box on a wall with nothing under it.
//
// So for every mesh above WAIST, classify each contact by DIRECTION and MEASURE
// the overlap:
//
//   BELOW    something under my footprint whose top meets my bottom → carried
//   LATERAL  something beside me whose face meets mine             → mounted
//   ABOVE    something over me                                     → hanging
//
// and report the contact AREA, because a 4 cm² graze between two bounding boxes
// is not a fixing. Ranked by how little is holding the thing up.
//
// EPS is 0.05 and that is not arbitrary: this project mounts flat detail 1–5 cm
// proud of its wall on purpose (alley tags 0.05, buzzer 0.02, church plaque
// 0.02). A tighter tolerance reports every one of those as a float. Anything
// still unsupported at 5 cm is a real one.
//
//   SHOT_URL=http://localhost:4184/ node scripts/support.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const EPS = 0.05;
const WAIST = 1.5;     // ignore ground clutter; the complaint is about things up high
const BIG = 8;         // a mesh with a face this big (m²) can carry something

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(1200);

const out = await page.evaluate(({ EPS, WAIST, BIG }) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const items = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (!isFinite(bb.min.x)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    items.push({
      min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z],
      geo: g.type,
      params: g.parameters ? Object.fromEntries(Object.entries(g.parameters)
        .filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(3)])) : {},
      color: m && m.color ? '#' + m.color.getHexString() : null,
      hasMap: !!(m && m.map), additive: !!(m && m.blending === 2),
    });
  });

  const ov = (a, b, ax) => Math.min(a.max[ax], b.max[ax]) - Math.max(a.min[ax], b.min[ax]);
  const size = (it, ax) => it.max[ax] - it.min[ax];
  const vol = (it) => size(it, 0) * size(it, 1) * size(it, 2);
  const biggestFace = (it) => Math.max(
    size(it, 0) * size(it, 1), size(it, 0) * size(it, 2), size(it, 1) * size(it, 2));

  const res = [];
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (a.min[1] < WAIST) continue;                 // ground clutter is not the brief
    const tiny = biggestFace(a) < 0.02;
    let below = null, lateral = null, above = null;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const b = items[j];
      const ox = ov(a, b, 0), oy = ov(a, b, 1), oz = ov(a, b, 2);
      if (ox < -EPS || oy < -EPS || oz < -EPS) continue;   // not in contact at all
      const area = Math.max(Math.max(0, ox), size(b,0) < 1e-6 || size(a,0) < 1e-6 ? Math.min(size(a,0), size(b,0)) || 0.05 : 0)
                 * Math.max(Math.max(0, oz), size(b,2) < 1e-6 || size(a,2) < 1e-6 ? Math.min(size(a,2), size(b,2)) || 0.05 : 0);
      // something underneath, meeting my underside
      if (b.max[1] <= a.min[1] + EPS && area > 0) {
        const cand = { area: +area.toFixed(3), gap: +(a.min[1] - b.max[1]).toFixed(3), j };
        if (!below || cand.area > below.area) below = cand;
      }
      // something beside me: vertical ranges overlap, faces meet in x or z
      if (oy > EPS) {
        const face = Math.max(0, Math.min(oy, size(a, 1))) *
                     Math.max(0, Math.max(Math.min(ox, size(a, 0)), Math.min(oz, size(a, 2))));
        const cand = { face: +face.toFixed(3), big: biggestFace(b) >= BIG, j };
        if (!lateral || cand.face > lateral.face) lateral = cand;
      }
      if (b.min[1] >= a.max[1] - EPS && area > 0) {
        const cand = { area: +area.toFixed(3), j };
        if (!above || cand.area > above.area) above = cand;
      }
    }
    // how much is holding it: the better of a footing and a fixing
    const support = Math.max(below ? below.area : 0, lateral ? lateral.face : 0);
    const footprint = size(a, 0) * size(a, 2);
    res.push({
      centre: a.min.map((v, k) => +((v + a.max[k]) / 2).toFixed(2)),
      size: [0, 1, 2].map((k) => +size(a, k).toFixed(2)),
      geo: a.geo, params: a.params, color: a.color, hasMap: a.hasMap, additive: a.additive,
      minY: +a.min[1].toFixed(2),
      support: +support.toFixed(3),
      supportRatio: footprint > 1e-6 ? +(support / footprint).toFixed(3) : null,
      below: below ? { area: below.area, gap: below.gap,
        what: `${items[below.j].geo} ${items[below.j].size ?? ''}`.trim(),
        whatCentre: items[below.j].min.map((v, k) => +((v + items[below.j].max[k]) / 2).toFixed(1)) } : null,
      lateral: lateral ? { face: lateral.face, onBigSurface: lateral.big,
        whatCentre: items[lateral.j].min.map((v, k) => +((v + items[lateral.j].max[k]) / 2).toFixed(1)) } : null,
      above: above ? { area: above.area } : null,
      tiny,
      verdict: (!below && !lateral) ? 'NOTHING'
        : (!below && lateral && lateral.face < 0.05) ? 'graze-only'
          : (!below && !(lateral && lateral.onBigSurface)) ? 'no-footing, no wall'
            : below ? 'carried' : 'wall-mounted',
    });
  }
  const rank = { NOTHING: 0, 'graze-only': 1, 'no-footing, no wall': 2, 'wall-mounted': 3, carried: 4 };
  res.sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.support - b.support);
  return { checked: res.length, res };
}, { EPS, WAIST, BIG });

writeFileSync('shots/support-report.json', JSON.stringify(out, null, 2));
const bad = out.res.filter((r) => r.verdict !== 'carried' && r.verdict !== 'wall-mounted');
console.log(`meshes above ${WAIST} m: ${out.checked}   suspect: ${bad.length}\n`);
for (const r of bad) {
  console.log(`[${r.verdict}]${r.additive ? ' (additive/glow)' : ''} ${r.geo} ${JSON.stringify(r.params)}${r.color ? ' ' + r.color : ''}${r.hasMap ? ' +map' : ''}`);
  console.log(`    at (${r.centre.join(', ')})  size ${r.size.join('×')}  bottom at y=${r.minY}`);
  console.log(`    support area: ${r.support} m²` +
    (r.below ? `   below: ${r.below.area} m² at gap ${r.below.gap} m` : '   below: none') +
    (r.lateral ? `   lateral: ${r.lateral.face} m²${r.lateral.onBigSurface ? ' on a wall' : ' on something small'}` : '   lateral: none'));
  console.log('');
}
const counts = {};
for (const r of out.res) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
console.log('verdict counts:', JSON.stringify(counts));
await browser.close();
