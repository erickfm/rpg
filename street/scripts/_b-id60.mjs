import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4279/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
const rows = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true); const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
    if (w < 15 || d < 15 || h > 1) return;
    if (bb.min.y > 1 || bb.max.y < -0.3) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    out.push({ name: n.name || '(unnamed)', ud: JSON.stringify(n.userData).slice(0,180),
      geo: n.geometry.type, w:+w.toFixed(2), d:+d.toFixed(2), y:[+bb.min.y.toFixed(3),+bb.max.y.toFixed(3)],
      x:[+bb.min.x.toFixed(1),+bb.max.x.toFixed(1)], z:[+bb.min.z.toFixed(1),+bb.max.z.toFixed(1)],
      map: m?.map?.image ? m.map.image.width+'x'+m.map.image.height : 'none',
      col: m?.color ? '#'+m.color.getHexString() : '-', trans: !!m?.transparent, op: m?.opacity,
      side: m?.side, verts: n.geometry.attributes.position.count });
  });
  return out;
});
for (const r of rows) console.log(JSON.stringify(r));
await b.close();
