import { chromium } from 'playwright';
import { FACE_LIB } from './lib/faces.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.addInitScript({ content: FACE_LIB });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const rows = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2, cy=(bb.min.y+bb.max.y)/2;
    if (cx < 55 || cx > 78 || cz < -115 || cz > -92) return;
    const mats = Array.isArray(o.material)?o.material:[o.material];
    mats.forEach((m, mi) => {
      if (!m || !m.map) return;
      const ms = m.map.userData && m.map.userData.masonry;
      if (!ms) return;
      const { fw, fh } = window.__faceLib.dims(o, mi);
      const img = m.map.image;
      out.push({ name:o.name||'(anon)', mi, decl: ms.ppm,
        u:+((img.width*Math.abs(m.map.repeat.x))/fw).toFixed(2),
        v:+((img.height*Math.abs(m.map.repeat.y))/fh).toFixed(2),
        fw:+fw.toFixed(2), fh:+fh.toFixed(2),
        canvas: img.width+'x'+img.height,
        params: g.parameters ? [g.parameters.width, g.parameters.height, g.parameters.depth] : null,
        at: [+cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1)] });
    });
  });
  return out;
});
for (const r of rows) {
  const bad = Math.abs(r.u - r.decl)/r.decl > 0.15 || Math.abs(r.v - r.decl)/r.decl > 0.15;
  console.log((bad?'BAD ':'ok  ') + `mi${r.mi} decl${r.decl}  u${String(r.u).padStart(8)} v${String(r.v).padStart(8)}  face ${r.fw}x${r.fh}m  canvas ${r.canvas}  box ${JSON.stringify(r.params)}  at ${r.at.join(',')}`);
}
await b.close();
