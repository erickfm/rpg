// TWO SURFACES AT THE SAME HEIGHT, in the places I own.
//
// GOTCHAS §6: coplanar surfaces must ABUT, never overlap. I broke it twice in
// one afternoon in ct/park.ts and found neither by looking, because which
// surface wins a depth-fight is view-dependent — a still frame shows one or the
// other and both look fine. The gate spur ran 0.75 m into the loop's street
// leg, in the one place every visitor walks; the four chamfered corners
// overlapped the legs at eight joins.
//
// So this asks the question directly. Fire a ray straight down on a grid and
// report any point where two DIFFERENT meshes are within half a millimetre of
// each other. That is not a tolerance for rounding — it is the gap below which
// the depth buffer cannot separate them at this world's scale.
//
// A vertical ray needs no Raycaster (the page publishes no `three`): a
// point-in-triangle test in XZ plus one barycentric height.
//
// AN OVERLAP HAS AREA; ABUTTING HAS ONLY A LINE. The first cut of this reported
// 83 coincident points across four boxes and every one of them was correct
// geometry — two rectangles sharing an edge, with the ray landing exactly on
// the boundary line so it hits both. x = -14.30 against the loop's street leg
// at -14.00, z = -92.70 against its end leg at -92.75, and so on down the list.
//
// So a point only counts if the coincidence SURVIVES A NUDGE: it must still be
// coincident 5 cm away in at least three of the four compass directions, which
// a shared edge can never manage and a genuine overlap always does. A check
// that fires on correct geometry teaches you to ignore it, and gets deleted
// rather than fixed.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const scan = (x0, x1, z0, z1, step) => page.evaluate(([x0, x1, z0, z1, step]) => {
  // ── BUILD THE TRIANGLES ONCE, AND INDEX THEM ─────────────────────────────
  //
  // The first version transformed every vertex of every mesh in the world for
  // every one of its ~1800 point queries, and one run took seven minutes. That
  // matters beyond patience: E-verify takes twenty minutes over six areas, the
  // merge train rebases builders more often than that, and a suite that cannot
  // finish between rebases is one you only complete by luck. I had to catch a
  // quiet window three times over to get a single clean pass.
  //
  // So: transform into world space ONCE, keep only the triangles inside the
  // scan box and inside the y band anything walkable lives in, and bucket them
  // into 1 m cells. A query then tests the few triangles over its own cell
  // rather than the world's entire geometry. Same arithmetic, same tolerances,
  // same answers — only the number of times it is done changes.
  const scene = window.__ct.scene();
  const V3 = Object.getPrototypeOf(scene.position).constructor;
  const PAD = 1.0;                                  // room for the ±5 cm nudges
  const tris = [];
  const v = new V3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry, idx = g.index;
    const n = idx ? idx.count : g.attributes.position.count;
    let label = null;                               // built once per MESH, not per triangle
    for (let t = 0; t < n; t += 3) {
      const a = v.fromBufferAttribute(g.attributes.position, idx ? idx.getX(t) : t)
        .applyMatrix4(o.matrixWorld).clone();
      const c = v.fromBufferAttribute(g.attributes.position, idx ? idx.getX(t + 1) : t + 1)
        .applyMatrix4(o.matrixWorld).clone();
      const d = v.fromBufferAttribute(g.attributes.position, idx ? idx.getX(t + 2) : t + 2)
        .applyMatrix4(o.matrixWorld).clone();
      if (Math.max(a.y, c.y, d.y) > 1.6 || Math.min(a.y, c.y, d.y) < -0.4) continue;
      const loX = Math.min(a.x, c.x, d.x), hiX = Math.max(a.x, c.x, d.x);
      const loZ = Math.min(a.z, c.z, d.z), hiZ = Math.max(a.z, c.z, d.z);
      if (hiX < x0 - PAD || loX > x1 + PAD || hiZ < z0 - PAD || loZ > z1 + PAD) continue;
      if (label === null) {
        const gp = g.parameters, pos = o.position;
        const sz = gp
          ? `${g.type}(${[gp.width, gp.height, gp.depth].filter((q) => q !== undefined)
            .map((q) => (+q).toFixed(2)).join('×')})`
          : g.type;
        label = `${sz} at ${pos.x.toFixed(2)},${pos.y.toFixed(3)},${pos.z.toFixed(2)}`
          + (o.material?.map ? ' [mapped]' : ` [#${o.material?.color?.getHexString?.() ?? '??'}]`);
      }
      // UPWARD-FACING? Only a surface you can see can fight over a pixel. The
      // undersides of stacked boxes are coplanar all over this world — the
      // library's step and plinth both bottom out at y = 0, a kerb edging sits
      // exactly on the paving it stands on — and none of them is visible.
      const nx = (c.y - a.y) * (d.z - a.z) - (c.z - a.z) * (d.y - a.y);
      const ny = (c.z - a.z) * (d.x - a.x) - (c.x - a.x) * (d.z - a.z);
      const nz = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
      const up = !(ny <= 0 && Math.abs(ny) > 1e-9 * (Math.abs(nx) + Math.abs(nz) + 1));
      tris.push({ a, c, d, id: o.id, label, up, loX, hiX, loZ, hiZ });
    }
  });
  const CELL = 1.0;
  const grid = new Map();
  const key = (cx, cz) => cx + ',' + cz;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    for (let cx = Math.floor(t.loX / CELL); cx <= Math.floor(t.hiX / CELL); cx++) {
      for (let cz = Math.floor(t.loZ / CELL); cz <= Math.floor(t.hiZ / CELL); cz++) {
        const k = key(cx, cz);
        let cell = grid.get(k);
        if (!cell) { cell = []; grid.set(k, cell); }
        cell.push(i);
      }
    }
  }
  const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];

  /** the height of one triangle under (x, z), or null if the point is outside it */
  const heightAt = (t, x, z) => {
    const { a, c, d } = t;
    const det = (c.z - d.z) * (a.x - d.x) + (d.x - c.x) * (a.z - d.z);
    if (Math.abs(det) < 1e-9) return null;
    const l1 = ((c.z - d.z) * (x - d.x) + (d.x - c.x) * (z - d.z)) / det;
    const l2 = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return null;
    return l1 * a.y + l2 * c.y + l3 * d.y;
  };

  // is there any ground under (x, z) at all? A box in the wrong place has none,
  // and a check over an empty box passes without asserting anything (§34).
  const anySurface = (x, z) => {
    for (const i of near(x, z)) if (heightAt(tris[i], x, z) !== null) return true;
    return false;
  };

  // the two meshes that coincide under (x, z), NAMED — a check that says two
  // surfaces coincide without saying which two cannot be acted on
  const coincident = (x, z) => {
    const ys = [];
    for (const i of near(x, z)) {
      const t = tris[i];
      if (!t.up) continue;
      const y = heightAt(t, x, z);
      if (y !== null) ys.push({ y, id: t.id, label: t.label });
    }
    ys.sort((p, q) => p.y - q.y);
    for (let i = 1; i < ys.length; i++) {
      if (ys[i].id !== ys[i - 1].id && Math.abs(ys[i].y - ys[i - 1].y) < 0.0005) {
        return { y: +ys[i].y.toFixed(4), a: ys[i - 1].label, b: ys[i].label };
      }
    }
    return null;
  };

  let total = 0;
  for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) total++;
  const hits = [];
  let saw = 0;                     // sample points that found ANY surface at all
  for (let x = x0; x <= x1; x += step) {
    for (let z = z0; z <= z1; z += step) {
      if (anySurface(x, z)) saw++;
      const here = coincident(x, z);
      if (here === null) continue;
      // AN OVERLAP HAS AREA; ABUTTING HAS ONLY A LINE. Two rectangles sharing
      // an edge put the ray on the boundary and it hits both, which is correct
      // geometry — the first version reported 83 of those. A hit must survive a
      // 5 cm nudge in three of four directions, which an edge can never do.
      let around = 0;
      for (const [dx, dz] of [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) {
        if (coincident(x + dx, z + dz) !== null) around++;
      }
      if (around >= 3) hits.push({ x: +x.toFixed(2), z: +z.toFixed(2), ...here });
    }
  }
  return { hits, saw, of: total, tris: tris.length };
}, [x0, x1, z0, z1, step]);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

for (const [name, box, step] of [
  // THE BOXES ARE WHERE THE THINGS ARE, and one of them was not.
  //
  // `the churchyard` scanned x -10.5…-7.1, z -46…-30. The churchyard is at
  // POSITIVE x — E-yard-walk walks it from 5.6 to 9.6, around z -84…-75 — so
  // that box was a patch of empty pavement on the other side of the street. It
  // passed every run, having examined nothing, which is exactly the shape
  // GOTCHAS §34 is about: an assertion over an empty set is green and means
  // nothing. The `saw` count below is so that can never be silent again.
  //
  // The courtyard box was short too: it stopped at x -10.1 and the library's
  // landing is at -11.0, so the top half of the flight was outside it.
  ['the library courtyard and its flight', [-12.0, -7.0, -20.5, -6.0], 0.7],
  ['the churchyard and its flight', [5.4, 9.7, -85.0, -75.0], 0.5],
  ['the park: the gate and the street leg', [-15.5, -7.4, -88.0, -78.0], 0.6],
  ['the park: the loop and its corners', [-34.0, -12.0, -96.0, -70.0], 1.3],
]) {
  const { hits, saw, of, tris } = await scan(box[0], box[1], box[2], box[3], step);
  report(`${name}: the box actually contains ${name.startsWith('the park') ? 'park' : 'it'}`,
    saw > of * 0.5, `${saw} of ${of} sample points found ground, over ${tris} indexed triangles`);
  report(`${name}: no two surfaces share a height`, hits.length === 0,
    hits.length ? `${hits.length} coincident points`
      : `every one of ${saw} sampled points has one clear top surface`);
  for (const h of hits.slice(0, 3)) {
    console.log(`      at ${h.x},${h.z} both at y ${h.y}`);
    console.log(`        A: ${h.a}`);
    console.log(`        B: ${h.b}`);
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nnothing is fighting for the same height');
await b.close();
process.exit(fails ? 1 : 0);
