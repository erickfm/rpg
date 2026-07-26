import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, process.env.SHOT_URL);
const r = await p.evaluate(() => {
  const heads = [];
  window.__ct.scene().traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      o.updateMatrixWorld(true);
      const m = o.matrixWorld.elements;
      heads.push({ x: +m[12].toFixed(2), z: +m[14].toFixed(2),
                   kind: o.userData.parkLantern ? 'park' : 'street' });
    }
  });
  return heads;
});
// the side street runs EAST in +x; the main street is the x ~ +-4.3 line
const side = r.filter((h) => h.x > 8).sort((a, b) => a.x - b.x);
const main = r.filter((h) => h.x <= 8);
console.log(`${r.length} lamps total — ${main.length} on/near the main street, ${side.length} out along the side street`);
console.log('side-street lamps, west to east:');
for (const h of side) console.log(`   x ${String(h.x).padStart(6)}  z ${String(h.z).padStart(6)}  ${h.kind}`);
if (side.length > 1) {
  const gaps = side.slice(1).map((h, i) => +(h.x - side[i].x).toFixed(2));
  console.log('gaps between them, west to east:', gaps.join(', '));
  console.log('furthest east:', side[side.length - 1].x, ' (the side street runs to x=55)');
}
await b.close();
