import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p); await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const t = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.color || m.color.getHexString() !== '101114') return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400 || bb.min.y > 0.2) return;
    t.push({ top:+bb.max.y.toFixed(3), at:[+((bb.min.x+bb.max.x)/2).toFixed(1), +((bb.min.z+bb.max.z)/2).toFixed(1)] });
  });
  const byTop = {};
  for (const q of t) byTop[q.top] = (byTop[q.top]||0)+1;
  return { n:t.length, byTop, tall: t.filter(q=>q.top>0.75).slice(0,6) };
});
console.log(`${out.n} tyres, by top height:`);
for (const [k,v] of Object.entries(out.byTop).sort((a,c)=>+c[0]-+a[0])) console.log(`   ${k} m  ×${v}`);
console.log('\nthe tall ones:'); for (const q of out.tall) console.log(`   top ${q.top} at (${q.at.join(', ')})`);
await b.close();
