// WHERE IS THE BODEGA DOOR, AND WHAT STANDS BETWEEN IT AND THE WALKER?
//
// side-walk.mjs hard-codes `DOOR = { x: 8.7, z: -96.85, r: 1.05 }` and walks
// west at it from (14, -97). It gets within 3.5 m and fails. This asks the
// world the two questions that separates "the walk is blocked" from "the
// constant is stale":
//   1. every [E] spot near the side street's west end, from __ct.spots()
//   2. every static collider in the corridor the walker traverses
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const spots = window.__ct.spots().map((sp) => ({
    label: sp.label, x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: sp.r,
    d: +Math.hypot(sp.x - 8.7, sp.z + 96.85).toFixed(2),
  })).sort((a, c) => a.d - c.d);
  // static geometry anywhere near the walked corridor x 6..16, z -100..-94
  const cols = window.__ct.staticColliders()
    .filter((c) => c.maxX > 5 && c.minX < 17 && c.maxZ > -101 && c.minZ < -93)
    .map((c) => ({
      minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2),
      minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2),
      rot: c.rot ?? 0, h: c.maxY ?? c.h ?? null,
    }));
  return { spots: spots.slice(0, 8), nSpots: window.__ct.spots().length, cols };
});

console.log(`\n${out.nSpots} [E] spots in the world; the 8 nearest to side-walk's hard-coded (8.70, -96.85):`);
for (const s of out.spots) console.log(`   ${s.d.toFixed(2)} m  "${s.label}"  at (${s.x}, ${s.z}) r=${s.r}`);

console.log(`\n${out.cols.length} static colliders overlapping the walked corridor (x 6..17, z -101..-93):`);
for (const c of out.cols) {
  console.log(`   x ${c.minX}..${c.maxX}  z ${c.minZ}..${c.maxZ}` + (c.rot ? `  rot ${c.rot}` : ''));
}
await b.close();
