// Grade the remaining named checks. Everything is FOUND by scanning the scene
// graph for what the thing actually is, then aimed at what the scan returns —
// the method that located the library steps after three hand-aimed cameras
// missed them.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// the rain hour, computed with the world's own hash (ct/props.ts rainAt)
const rainAt = (h) => ((Math.imul(h, 2246822519) >>> 0) % 100) < 22;
let wet = -1;
for (let h = 0; h < 240; h++) if (rainAt(h)) { wet = h; break; }
console.log(`first raining hour by the world's own hash: h = ${wet} (clock ${wet % 24}:00)`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

// ── find the things ───────────────────────────────────────────────────────
const found = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = { neon: [], benches: [], cars: [], puddles: [] };
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sz = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
    const c = [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2].map(v => +v.toFixed(2));
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    // neon: the signs are the only materials with fog turned off
    if (m.fog === false && sz[1] > 2) out.neon.push({ c, sz: sz.map(v => +v.toFixed(2)) });
    // a bench: wide, low, shallow, on the ground
    if (sz[0] > 1.2 && sz[1] > 0.3 && sz[1] < 1.3 && sz[2] < 1.0 && bb.min.y < 0.6 && bb.min.y > -0.1)
      out.benches.push({ c, sz: sz.map(v => +v.toFixed(2)) });
    // a parked car body: ~4-5 m long, ~1.4 m tall
    if (Math.max(sz[0], sz[2]) > 3.6 && Math.max(sz[0], sz[2]) < 6 && sz[1] > 0.8 && sz[1] < 2 && bb.min.y < 0.6)
      out.cars.push({ c, sz: sz.map(v => +v.toFixed(2)) });
    // puddle decals: flat, transparent, on the road
    if (sz[1] < 0.05 && m.transparent && Math.abs(c[0]) < 6 && sz[0] > 0.8) out.puddles.push({ c, sz: sz.map(v => +v.toFixed(2)) });
  });
  return out;
});
console.log(`found: ${found.neon.length} neon, ${found.benches.length} benches, ${found.cars.length} cars, ${found.puddles.length} puddle decals`);
found.neon.slice(0, 6).forEach(n => console.log(`   neon ${n.sz.join('×')} at ${n.c.join(',')}`));
found.benches.slice(0, 6).forEach(n => console.log(`   bench ${n.sz.join('×')} at ${n.c.join(',')}`));
found.cars.slice(0, 4).forEach(n => console.log(`   car ${n.sz.join('×')} at ${n.c.join(',')}`));
writeFileSync('shots/grade-found.json', JSON.stringify(found, null, 2));

const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const shot = async (name, x, z, tx, tz, pitch, hm) => {
  await p.evaluate(([x, z, yaw, pitch, hm]) => {
    if (hm) window.__ct.clock(hm[0], hm[1]);
    window.__ct.warp(x, z, yaw, 0.14, pitch);
  }, [x, z, look(x, z, tx, tz), pitch, hm ?? null]);
  await p.waitForTimeout(hm ? 3500 : 300);
  await p.screenshot({ path: `shots/gr-${name}.png` });
  console.log(`   shot ${name}`);
};

// blade signs: stand level with each, 5 m away, on BOTH sides along the street
const blades = found.neon.filter(n => n.sz[1] > 3 && Math.min(n.sz[0], n.sz[2]) < 1.2 && n.c[0] > 20);
for (const [i, n] of blades.slice(0, 2).entries()) {
  await shot(`blade${i}-fromW`, n.c[0] - 5.5, n.c[2] - 1.4, n.c[0], n.c[2], 0.38);
  await shot(`blade${i}-fromE`, n.c[0] + 5.5, n.c[2] - 1.4, n.c[0], n.c[2], 0.38);
}
// bench: square on, and low for the legs
const bench = found.benches.find(x => Math.abs(x.c[0]) > 4 && Math.abs(x.c[0]) < 7);
if (bench) {
  const side = Math.sign(bench.c[0]);
  await shot('bench-front', bench.c[0] - side * 2.2, bench.c[2], bench.c[0], bench.c[2], -0.10);
  await shot('bench-legs',  bench.c[0] - side * 1.3, bench.c[2], bench.c[0], bench.c[2], -0.42);
}
// a parked car, for the wheel arches
const car = found.cars[0];
if (car) await shot('wheel-arch', car.c[0] - Math.sign(car.c[0]) * 2.4, car.c[2] - 1.2, car.c[0], car.c[2], -0.18);
// puddles: drive the clock to a raining hour and let the sim wet the ground
await shot('rain-gutter', 4.2, -46, 5.1, -49, -0.5, [wet % 24, 0]);
await shot('rain-street', -1.4, -30, -1.4, -60, 0.05, [wet % 24, 0]);
await b.close();
