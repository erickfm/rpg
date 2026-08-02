// Dump a vehicle's painted textures, upscaled, so a paint fault can be READ
// rather than guessed at from the rendered car. This is what finally settled the
// wheel arch: the flank texture showed a ziggurat of stacked treads rising the
// full height of the panel, which no amount of looking at screenshots had made
// legible.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/cartex.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(p, process.env.SHOT_URL);   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  let truck = null;
  window.__ct.scene().traverse((o) => {
    if (o.type === 'Group' && o.userData.steer !== undefined && o.visible
        && o.position.x < -2 && o.position.z > -40 && o.position.z < -25) truck = o;
  });
  // Return EMPTY rather than throwing when nothing matched: the node-side guard
  // that reports this cleanly is unreachable if `truck.children` explodes first,
  // which is what happened the first time I watched this fail on purpose.
  if (!truck) return [];
  const seen = new Map();
  for (const c of truck.children) {
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      const img = m?.map?.image;
      if (!img || seen.has(m.map.uuid)) continue;
      const Z = 6;
      const cv = document.createElement('canvas');
      cv.width = img.width * Z; cv.height = img.height * Z;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#5a6068'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      seen.set(m.map.uuid, { key: `${seen.size}-${img.width}x${img.height}`, url: cv.toDataURL() });
    }
  }
  return [...seen.values()];
});
// Finding NO vehicle is the interesting failure — it means the selector for a
// car has drifted, not that the fleet has no textures. Say so instead of exiting
// 0 having written nothing.
if (!out.length) {
  console.error('FAILED — no vehicle textures found. The pickup selector ' +
    '(Group with userData.steer, west kerb, z -40..-25) matched nothing.');
  await b.close();
  process.exit(1);
}
for (const t of out) {
  writeFileSync(`shots/tex-${t.key}.png`, Buffer.from(t.url.split(',')[1], 'base64'));
  console.log(`  shots/tex-${t.key}.png`);
}
await b.close();
