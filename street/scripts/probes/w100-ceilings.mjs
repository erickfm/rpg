// w100 / item 96 — EVERY ROOM'S CEILING, as geometry rather than as an opinion.
//
// The row's one observation that w97 could not dismiss was "a near-black ceiling
// against saturated red walls", and its verdict was "deliberate cause, real
// symptom". This measures the symptom: for each room, the kit's ceiling plane —
// its colour, its luminance, whether it carries a texture map at all, and how
// many square metres of it there are. A room can then be compared to its
// siblings instead of to a memory.
//
// The kit builds it at ct/interior.ts:889 as a bare MeshBasicMaterial with no
// map, so `map` is expected to be `.` everywhere; the interesting columns are
// LUM and AREA, which is where the hotel is or is not an outlier.
//
// Usage: SHOT_URL=http://localhost:4562/ node scripts/probes/w100-ceilings.mjs
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(process.env.SHOT_URL || 'http://localhost:4177/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 30000 });

const rows = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const rooms = window.__ct.roomDims();
  const out = [];
  for (const r of rooms) {
    let best = null;
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
      const g = o.geometry.parameters || {};
      // the kit's ceiling: a W×D plane, laid flat, at the room's centre, high up
      if (Math.abs((g.width ?? -1) - r.w) > 0.01 || Math.abs((g.height ?? -1) - r.d) > 0.01) return;
      const wp = o.getWorldPosition(o.position.clone());
      if (Math.abs(wp.x - r.cx) > 0.05 || Math.abs(wp.z - r.cz) > 0.05) return;
      if (wp.y < 1.5) return;                       // that is the floor, not the ceiling
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      best = { y: +wp.y.toFixed(2), col: mat && mat.color ? mat.color.getHex() : -1, map: !!(mat && mat.map) };
    });
    if (!best) { out.push({ id: r.id, none: true }); continue; }
    const c = best.col;
    const R = (c >> 16) & 255, G = (c >> 8) & 255, B = c & 255;
    out.push({
      id: r.id, h: best.y, map: best.map,
      hex: '#' + best.col.toString(16).padStart(6, '0'),
      lum: +(0.2126 * R + 0.7152 * G + 0.0722 * B).toFixed(1),
      area: +(r.w * r.d).toFixed(0),
    });
  }
  return out;
});

console.log('room          H     area   ceil-colour   LUM(0-255)  textured');
rows.sort((a, c) => (a.lum ?? 999) - (c.lum ?? 999));
for (const r of rows) {
  if (r.none) { console.log(`${r.id.padEnd(12)}  -- no kit ceiling plane found`); continue; }
  console.log(`${r.id.padEnd(12)} ${String(r.h).padStart(4)} ${String(r.area).padStart(6)}m2  `
    + `${r.hex.padEnd(12)} ${String(r.lum).padStart(8)}      ${r.map ? 'YES' : 'no'}`);
}
const lit = rows.filter((r) => !r.none);
const textured = lit.filter((r) => r.map).length;
console.log(`\n${lit.length} ceilings, ${textured} carry a texture map.`);
const dark = lit.slice().sort((a, c) => a.lum - c.lum);
console.log(`darkest: ${dark[0].id} at LUM ${dark[0].lum}; next: ${dark[1].id} at ${dark[1].lum}`
  + ` — a factor of ${(dark[1].lum / dark[0].lum).toFixed(2)}`);
const byArea = lit.slice().sort((a, c) => c.area - a.area);
console.log(`largest ceiling: ${byArea[0].id} ${byArea[0].area} m2; hotel is`
  + ` ${lit.find((r) => r.id === 'hotel')?.area} m2 at H ${lit.find((r) => r.id === 'hotel')?.h}`);

await b.close();
