import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(p, process.env.SHOT_URL);   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(500);
await p.evaluate(() => window.__ct.clock(13, 0));
const info = await p.evaluate(() => {
  let truck = null;
  window.__ct.scene().traverse((o) => {
    if (o.type === 'Group' && o.userData.steer !== undefined && o.visible
        && o.position.x < -2 && o.position.z > -45 && o.position.z < -25) truck = o;
  });
  const out = { truck: { x: truck.position.x, z: truck.position.z, ry: truck.rotation.y }, parts: [] };
  for (const c of truck.children) {
    const g = c.geometry?.parameters ?? {};
    const mats = (Array.isArray(c.material) ? c.material : [c.material]).map((m) => ({
      col: m?.color?.getHexString?.() ?? '-', map: m?.map ? `${m.map.image?.width}x${m.map.image?.height}` : 'none',
    }));
    out.parts.push({
      type: c.geometry?.type, w: g.width, h: g.height, d: g.depth,
      pos: [+c.position.x.toFixed(3), +c.position.y.toFixed(3), +c.position.z.toFixed(3)],
      mats: mats.map((m, i) => `${i}:${m.col}/${m.map}`).join(' '),
    });
  }
  return out;
});
console.log(`truck world (${info.truck.x.toFixed(2)}, ${info.truck.z.toFixed(2)}) yaw ${info.truck.ry.toFixed(2)}`);
console.log('local-space parts (material index 2 = +y top face):');
for (const q of info.parts) {
  if (!q.type) continue;
  console.log(`  ${q.type}(${q.w}x${q.h}x${q.d}) @ y=${q.pos[1]} z=${q.pos[2]}`);
  console.log(`      ${q.mats}`);
}
await b.close();
