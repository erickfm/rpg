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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const scan = (x0, x1, z0, z1, step) => page.evaluate(([x0, x1, z0, z1, step]) => {
  const scene = window.__ct.scene();
  const V3 = Object.getPrototypeOf(scene.position).constructor;
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    meshes.push(o);
  });
  const v = new V3();
  const wp = (g, o, i) => { v.fromBufferAttribute(g.attributes.position, i); return v.applyMatrix4(o.matrixWorld).clone(); };
  // is there any ground under (x, z) at all? A box in the wrong place has none,
  // and a check over an empty box passes without asserting anything (§34).
  const anySurface = (x, z) => {
    for (const o of meshes) {
      const g = o.geometry, idx = g.index;
      const n = idx ? idx.count : g.attributes.position.count;
      for (let t = 0; t < n; t += 3) {
        const a = wp(g, o, idx ? idx.getX(t) : t);
        const c = wp(g, o, idx ? idx.getX(t + 1) : t + 1);
        const d = wp(g, o, idx ? idx.getX(t + 2) : t + 2);
        if (Math.max(a.y, c.y, d.y) > 1.6 || Math.min(a.y, c.y, d.y) < -0.4) continue;
        const det = (c.z - d.z) * (a.x - d.x) + (d.x - c.x) * (a.z - d.z);
        if (Math.abs(det) < 1e-9) continue;
        const l1 = ((c.z - d.z) * (x - d.x) + (d.x - c.x) * (z - d.z)) / det;
        const l2 = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det;
        if (l1 < -1e-6 || l2 < -1e-6 || 1 - l1 - l2 < -1e-6) continue;
        return true;
      }
    }
    return false;
  };
  let total = 0;
  for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) total++;

  // the height at which two different meshes coincide under (x, z), or null
  const coincident = (x, z) => {
    const ys = [];
    for (const o of meshes) {
      const g = o.geometry, idx = g.index;
      const n = idx ? idx.count : g.attributes.position.count;
      for (let t = 0; t < n; t += 3) {
        const a = wp(g, o, idx ? idx.getX(t) : t);
        const c = wp(g, o, idx ? idx.getX(t + 1) : t + 1);
        const d = wp(g, o, idx ? idx.getX(t + 2) : t + 2);
        if (Math.max(a.y, c.y, d.y) > 1.6 || Math.min(a.y, c.y, d.y) < -0.4) continue;
        // UPWARD-FACING ONLY. Two surfaces can only fight over a pixel you can
        // see, and the first version of this reported the UNDERSIDES of stacked
        // boxes: the library's step and plinth boxes both bottom out at y = 0,
        // and a kerb edging strip's underside sits exactly on the paving it
        // stands on. All of them true, none of them visible, and each one a
        // reason to stop believing the check.
        const nx = (c.y - a.y) * (d.z - a.z) - (c.z - a.z) * (d.y - a.y);
        const ny = (c.z - a.z) * (d.x - a.x) - (c.x - a.x) * (d.z - a.z);
        const nz = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
        if (ny <= 0 && Math.abs(ny) > 1e-9 * (Math.abs(nx) + Math.abs(nz) + 1)) continue;
        const det = (c.z - d.z) * (a.x - d.x) + (d.x - c.x) * (a.z - d.z);
        if (Math.abs(det) < 1e-9) continue;
        const l1 = ((c.z - d.z) * (x - d.x) + (d.x - c.x) * (z - d.z)) / det;
        const l2 = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        ys.push({ y: l1 * a.y + l2 * c.y + l3 * d.y, id: o.id, o });
      }
    }
    ys.sort((p, q) => p.y - q.y);
    for (let i = 1; i < ys.length; i++) {
      if (ys[i].id !== ys[i - 1].id && Math.abs(ys[i].y - ys[i - 1].y) < 0.0005) {
        // WHICH TWO. A check that says "two surfaces coincide" without naming
        // them cannot be acted on — the first version of this reported 80-odd
        // points across four boxes and I could not tell a real overlap from
        // two rectangles sharing an edge without going back to the source.
        const say = (m) => {
          const g = m.geometry, p2 = m.position;
          const sz = g.parameters
            ? `${g.type}(${[g.parameters.width, g.parameters.height, g.parameters.depth]
              .filter((v) => v !== undefined).map((v) => (+v).toFixed(2)).join('×')})`
            : g.type;
          return `${sz} at ${p2.x.toFixed(2)},${p2.y.toFixed(3)},${p2.z.toFixed(2)}`
            + (m.material?.map ? ' [mapped]' : ` [#${m.material?.color?.getHexString?.() ?? '??'}]`);
        };
        return { y: +ys[i].y.toFixed(4), a: say(ys[i - 1].o), b: say(ys[i].o) };
      }
    }
    return null;
  };
  const hits = [];
  let saw = 0;                     // sample points that found ANY surface at all
  for (let x = x0; x <= x1; x += step) {
    for (let z = z0; z <= z1; z += step) {
      if (anySurface(x, z)) saw++;
      const here = coincident(x, z);
      if (here === null) continue;
      let around = 0;
      for (const [dx, dz] of [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) {
        if (coincident(x + dx, z + dz) !== null) around++;
      }
      if (around >= 3) hits.push({ x: +x.toFixed(2), z: +z.toFixed(2), ...here });
    }
  }
  return { hits, saw, of: total };
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
  const { hits, saw, of } = await scan(box[0], box[1], box[2], box[3], step);
  report(`${name}: the box actually contains ${name.startsWith('the park') ? 'park' : 'it'}`,
    saw > of * 0.5, `${saw} of ${of} sample points found ground`);
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
