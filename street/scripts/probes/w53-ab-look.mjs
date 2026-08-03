// ITEM 141: save the cull-off / cull-on pair for ONE station, and say which
// street-band objects are a first hit from it. For running down a w53-ab.mjs
// failure — a pixel count says something changed, not what.
//
// Usage: SHOT_URL=... node scripts/probes/w53-ab-look.mjs <roomId> <yaw> [pitch]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4183/');
const ROOM = process.argv[2] ?? 'apt301';
const YAW = Number(process.argv[3] ?? 0);
const PITCH = Number(process.argv[4] ?? 0);
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 30));

const st = await p.evaluate((room) => {
  const r = window.__ct.roomDims().find((q) => q.id === room);
  return r ? { x: r.cx, z: r.cz } : null;
}, ROOM);
if (!st) { console.error(`no room ${ROOM}`); await browser.close(); process.exit(3); }

await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, undefined, pi), [st.x, st.z, YAW, PITCH]);
await p.waitForTimeout(400);
const pos = await p.evaluate(() => window.__ct.pos());
console.log(`${ROOM} centre (${st.x.toFixed(2)}, ${st.z.toFixed(2)}) — player at (${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}) gy ${pos[3].toFixed(2)}  yaw ${YAW} pitch ${PITCH}`);

await p.evaluate(() => window.__ct.cullRegions(false));
await p.waitForTimeout(400);
await p.screenshot({ path: `shots/w53-ab-${ROOM}-${YAW}-off.png` });
await p.evaluate(() => window.__ct.cullRegions(true));
await p.waitForTimeout(400);
await p.screenshot({ path: `shots/w53-ab-${ROOM}-${YAW}-on.png` });

// WHICH street-band objects are in the frustum here, and how far away?
const r = await p.evaluate(() => {
  window.__ct.cullRegions(false);
  const s = window.__ct.scene(), cam = window.__ct.camera();
  s.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
  const pl = [
    [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
    [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
    [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
    [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
    [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
    [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
  ].map(([a, b, c, d]) => { const n = Math.hypot(a, b, c); return [a / n, b / n, c / n, d / n]; });
  const out = [];
  for (const child of s.children) {
    let maxX = -Infinity, hit = null, best = Infinity;
    child.traverse((o) => {
      const g = o.geometry; if (!g) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere; if (!bs) return;
      const c = bs.center.clone().applyMatrix4(o.matrixWorld);
      maxX = Math.max(maxX, c.x + bs.radius);
      let inF = true;
      for (const [a, b2, c2, d] of pl) if (a * c.x + b2 * c.y + c2 * c.z + d < -bs.radius) { inF = false; break; }
      if (inF) { const dd = c.distanceTo(cam.position); if (dd < best) { best = dd; hit = o.name || o.type; } }
    });
    if (maxX < 100 && hit) out.push({ name: child.name || child.type, hit, d: +best.toFixed(1), maxX: +maxX.toFixed(1) });
  }
  window.__ct.cullRegions(true);
  return out.sort((a, b) => a.d - b.d).slice(0, 12);
});
console.log(`\nstreet-band (x<100) top-level children in the frustum from here: ${r.length ? '' : 'none'}`);
for (const o of r) console.log(`  ${String(o.d).padStart(7)} m  maxX ${String(o.maxX).padStart(7)}  ${o.name} / ${o.hit}`);
await browser.close();
