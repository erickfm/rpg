import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:4279/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
console.log(await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true); const out = [];
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'ConeGeometry') return;
    const g = n.geometry.parameters;
    if (g.radius > 0.4) return;
    const e = n.matrixWorld.elements;
    out.push([+e[12].toFixed(2), +e[13].toFixed(2), +e[14].toFixed(2)]);
  });
  return JSON.stringify(out);
}));
await b.close();
