// What are the three meshes at (-5.7…-6.5, ·, -21…-24) that changed height?
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
// NO SEEDING: this is the world as the user actually loads it.
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
console.log(await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  const V = new (s.position.constructor)();
  s.traverse(o => {
    if (!o.isMesh) return;
    o.getWorldPosition(V);
    if (Math.abs(V.x + 6.1) > 1.2 || Math.abs(V.z + 22.3) > 2.0 || V.y > 0.6) return;
    out.push(`${V.x.toFixed(2)},${V.y.toFixed(2)},${V.z.toFixed(2)}  mod=${o.userData.mod ?? '?'}  ` +
      `name=${o.name || o.parent?.name || '(anon)'}  geom=${o.geometry.type}`);
  });
  return out.join('\n');
}));
await b.close();
