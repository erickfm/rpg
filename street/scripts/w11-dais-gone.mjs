// Structural check for item 9c: no BoxGeometry(6.4, 0.18, 2.6) survives in the
// church's mesh graph — the exact dimensions the removed `dais` box carried.
// Also a look at the near-door end of the nave floor, for the eyes.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL || 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await afterFrames(p, 10); await p.waitForTimeout(1000);

const rm = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'church'));
console.log(`church centre (${rm.cx}, ${rm.cz}) ${rm.w} x ${rm.d}, door at z ${rm.door.z}`);

// The dead box's local coords were (0, 0.09, hd - 2.2) with hd = 12 -> local
// (0, 0.09, 9.8). Local z is measured from the room's own centre toward the
// door (see `put()`/`room.wz`); the room's world cz + local z is what a scan
// needs.
const hits = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const pr = o.geometry.parameters;
    if (Math.abs((pr.width ?? 0) - 6.4) < 0.01 && Math.abs((pr.height ?? 0) - 0.18) < 0.01
      && Math.abs((pr.depth ?? 0) - 2.6) < 0.01) {
      const wp = new (o.position.constructor)(); o.getWorldPosition(wp);
      out.push({ x: +wp.x.toFixed(2), y: +wp.y.toFixed(2), z: +wp.z.toFixed(2) });
    }
  });
  return out;
});
console.log(`meshes matching the dead dais's BoxGeometry(6.4, 0.18, 2.6): ${hits.length}`, hits);

// look at the door-end of the nave, where the box used to sit
await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), pi),
  [rm.cx, rm.cz + 7.5, 0, -0.15]);
await afterFrames(p, 5);
await p.screenshot({ path: 'shots/w11-church-rear.png' });
console.log('shots/w11-church-rear.png written');

await b.close();
process.exit(hits.length === 0 ? 0 : 1);
