// WHERE ARE THE TWO CIVIC FLIGHTS, ACTUALLY?
//
// I guessed the church flight's footprint from texdensity's `at` column and my
// own reading of `flight()`'s axis mapping, and the population floor in
// w102-geomdiff.mjs caught the guess: 1 object where there should be a dozen.
// Rather than reason harder about which of `at`/position/face-centroid is
// which, ask the world.
//
// A flight step is the only Mesh in this world that is a BoxGeometry carrying a
// SIX-material array whose +y entry has a map declared 'ground'. Find those,
// print them, and print the axis-aligned bounds of each cluster.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(1200);

const found = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return;
    if (!Array.isArray(o.material) || o.material.length !== 6) return;
    const pos = o.getWorldPosition(new o.position.constructor());
    const g = o.geometry.parameters;
    out.push({
      x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2),
      W: +g.width.toFixed(2), H: +g.height.toFixed(2), D: +g.depth.toFixed(2),
      topKind: o.material[2]?.map?.userData?.surface ?? null,
      name: o.name || '',
    });
  });
  return out;
});

const steps = found.filter((f) => f.topKind === 'ground');
console.log(`${found.length} six-material boxes; ${steps.length} with a 'ground'-declared top (= flight treads)\n`);

// cluster by z rounded, then report bounds
const clusters = new Map();
for (const s of steps) {
  const key = `${Math.round(s.x / 20) * 20}/${Math.round(s.z / 20) * 20}`;
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(s);
}
for (const [k, cs] of clusters) {
  const rng = (f) => [Math.min(...cs.map(f)), Math.max(...cs.map(f))];
  const [x0, x1] = rng((c) => c.x), [y0, y1] = rng((c) => c.y), [z0, z1] = rng((c) => c.z);
  console.log(`cluster ${k}: ${cs.length} treads`);
  console.log(`   x ${x0} .. ${x1}    y ${y0} .. ${y1}    z ${z0} .. ${z1}`);
  for (const c of cs) console.log(`      at (${c.x}, ${c.y}, ${c.z})  box ${c.W} x ${c.H} x ${c.D}`);
  console.log('');
}
await b.close();
