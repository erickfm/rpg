// Does anything laid ON the grass sink INTO it?
//
// The field is displaced by `relief()` and tessellated at 1.5 vertices/m. The
// things laid on it — the desire lines, the litter, the bald ring — are flat
// quads or coarser strips lifted by the SAME function, but sampled at their own
// spacing. Two tessellations of one curved surface do not agree between their
// vertices: the coarser one cuts the chord and dips below the finer one. A
// 6 mm lift does not survive much of that, and the failure is silent — a worn
// path that fades out over the mound looks like a worn path that stops there.
//
// So: raycast straight down at points across the field and ask WHICH MESH IS
// ON TOP. The field is identifiable without tagging anything — it is the only
// mesh in the park carrying a per-vertex `color` attribute.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// A vertical ray needs no Raycaster, and the page has no `three` to import
// anyway (the bundle does not publish it). Straight down through a triangle is
// a point-in-triangle test in XZ plus one barycentric interpolation of y — 20
// lines, no dependency, and exact rather than epsilon-tolerant.
const probe = (pts) => page.evaluate(([pts]) => {
  const scene = window.__ct.scene();
  const V3 = Object.getPrototypeOf(scene.position).constructor;
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    meshes.push({ o, g, isField: !!g.attributes.color });
  });
  const v = new V3();
  const wp = (g, o, i) => {
    v.fromBufferAttribute(g.attributes.position, i);
    return v.applyMatrix4(o.matrixWorld).clone();
  };
  const out = [];
  for (const [x, z] of pts) {
    const hits = [];
    for (const { o, g, isField } of meshes) {
      const idx = g.index;
      const n = idx ? idx.count : g.attributes.position.count;
      for (let t = 0; t < n; t += 3) {
        const a = wp(g, o, idx ? idx.getX(t) : t);
        const b2 = wp(g, o, idx ? idx.getX(t + 1) : t + 1);
        const c = wp(g, o, idx ? idx.getX(t + 2) : t + 2);
        if (Math.max(a.y, b2.y, c.y) > 2.0 || Math.min(a.y, b2.y, c.y) < -0.6) continue;
        const d = (b2.z - c.z) * (a.x - c.x) + (c.x - b2.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((b2.z - c.z) * (x - c.x) + (c.x - b2.x) * (z - c.z)) / d;
        const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        hits.push({ y: l1 * a.y + l2 * b2.y + l3 * c.y, isField });
      }
    }
    hits.sort((p2, q) => q.y - p2.y);
    if (!hits.length) { out.push([+x.toFixed(2), +z.toFixed(2), 'nothing', 0, null, 0]); continue; }
    const top = hits[0];
    const under = hits.find((h) => h.isField !== top.isField);
    out.push([+x.toFixed(2), +z.toFixed(2), top.isField ? 'FIELD' : 'decal', +top.y.toFixed(4),
      under ? (under.isField ? 'field' : 'decal') : null,
      under ? +(top.y - under.y).toFixed(4) : 0]);
  }
  return out;
}, [pts]);

// the FIELD's own surface height under a point, ignoring anything standing over it
const fieldAt = (pts) => page.evaluate(([pts]) => {
  const scene = window.__ct.scene();
  const V3 = Object.getPrototypeOf(scene.position).constructor;
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.color) { o.updateWorldMatrix(true, false); meshes.push(o); }
  });
  const v = new V3();
  const wp = (g, o, i) => { v.fromBufferAttribute(g.attributes.position, i); return v.applyMatrix4(o.matrixWorld).clone(); };
  return pts.map(([x, z]) => {
    let y = null;
    for (const o of meshes) {
      const g = o.geometry, idx = g.index;
      const n = idx ? idx.count : g.attributes.position.count;
      for (let t = 0; t < n; t += 3) {
        const a = wp(g, o, idx ? idx.getX(t) : t);
        const c = wp(g, o, idx ? idx.getX(t + 1) : t + 1);
        const d = wp(g, o, idx ? idx.getX(t + 2) : t + 2);
        const det = (c.z - d.z) * (a.x - d.x) + (d.x - c.x) * (a.z - d.z);
        if (Math.abs(det) < 1e-9) continue;
        const l1 = ((c.z - d.z) * (x - d.x) + (d.x - c.x) * (z - d.z)) / det;
        const l2 = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        y = +(l1 * a.y + l2 * c.y + l3 * d.y).toFixed(4);
      }
    }
    return { x, z, fieldY: y };
  });
}, [pts]);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const line = [];
for (let t = 0.06; t <= 0.94; t += 0.02) {
  line.push([-13.65 + (-32.1 + 13.65) * t, -83.0 + (-78.5 + 83.0) * t]);
}
const got = await probe(line);
const buried = got.filter((r) => r[2] === 'FIELD');
report('the desire line stays on top of the grass it crosses', buried.length === 0,
  buried.length
    ? `${buried.length}/${got.length} samples have GRASS on top: ${JSON.stringify(buried.slice(0, 3))}`
    : `${got.length} samples along it, the worn strip is the top surface at every one`);
const clear = got.filter((r) => r[5] > 0).map((r) => r[5]);
if (clear.length) {
  const min = Math.min(...clear);
  report('…and with clearance left over, not by a hair', min > 0.002,
    `thinnest gap over the grass under it: ${(min * 1000).toFixed(1)} mm`);
}

// THE GRASS MUST NOT SINK UNDER THE PARK'S OWN PAVING. The site is floored by
// one 32 × 30 m plane at KERB_H, and the field is drawn 3 mm over it — but the
// field is DISPLACED, and two of my three gaussians go DOWN. A dish 90 mm deep
// and a corner falling 100 mm both put grass below that plane, which does not
// move, so the paving would be drawn over the hollow it is supposed to be
// grass. `E-coplanar` found the two crossing at the rim; these are the places
// the relief is most negative.
// Sampled on GRASS, which is not the same as sampled in the hollow. The corner
// point was first put at the fall's centre, which the loop's chamfered corner
// path runs straight over — the check reported a path on top and was right to.
const low = await fieldAt([[-19.5, -80.2], [-20.1, -80.7], [-16.6, -88.7], [-17.4, -87.9]]);
// The invariant is NOT "the field is the top surface" — that was my first
// wording and it fails wherever anything legitimately stands over the grass,
// which at one sample was a bench 4 cm up. What must hold is that the GRASS
// ITSELF never sinks below the site's own base plane at KERB_H, because that
// plane is opaque, is drawn by ct/street.ts, and does not move.
const KERB = 0.14;
const sunk = low.filter((q) => q.fieldY === null || q.fieldY < KERB - 0.0002);
report('the grass in the hollows stays above the site plane', sunk.length === 0,
  sunk.length ? `${sunk.length}/${low.length} sink under the paving: ${JSON.stringify(sunk)}`
    : `${low.length}/${low.length} hollows have grass at or above ${KERB} — lowest ${
      Math.min(...low.map((q) => q.fieldY)).toFixed(4)}`);

const r = await probe([[-28.55, -78.15], [-28.0, -78.6], [-29.1, -77.7]]);
const bad = r.filter((q) => q[2] === 'FIELD');
report('the bald patch under the tree lies on the grass', bad.length === 0,
  bad.length ? `${bad.length}/${r.length} buried: ${JSON.stringify(bad)}` : `${r.length}/${r.length} on top`);

console.log(fails ? `\n${fails} FAILED` : '\nnothing laid on the grass is sinking into it');
await b.close();
process.exit(fails ? 1 : 0);
