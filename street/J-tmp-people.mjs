import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(3500);
const rows = await p.evaluate(() => {
  const scene = window.__ct.scene(); scene.updateMatrixWorld(true);
  return window.__ct.roomDims().map((r) => {
    let tagged = 0, seated = 0, untagged = 0;
    scene.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const e = m.matrixWorld.elements, x = e[12], z = e[14];
      if (Math.abs(x - r.cx) > r.w / 2 || Math.abs(z - r.cz) > r.d / 2) return;
      if (m.userData.citizen) { tagged++; if (m.userData.seated) seated++; return; }
      const g = m.geometry;
      if (g.type !== 'PlaneGeometry' || !g.parameters) return;
      const sy = (g.parameters.height || 0) * m.scale.y, sx = (g.parameters.width || 0) * m.scale.x;
      if (Math.abs(m.rotation.x) < 0.35 && sy > 1.35 && sy < 2.10 && sx > 0.30 && sx < 1.20) untagged++;
    });
    return { id: r.id, tagged, seated, untagged };
  });
});
console.log('room         tagged  seated  untagged person-height planes');
for (const r of rows) console.log(`${r.id.padEnd(12)}${String(r.tagged).padStart(5)}${String(r.seated).padStart(8)}${String(r.untagged).padStart(9)}`);
console.log(`\ntotal tagged ${rows.reduce((a,r)=>a+r.tagged,0)}, seated ${rows.reduce((a,r)=>a+r.seated,0)}, untagged ${rows.reduce((a,r)=>a+r.untagged,0)}`);
await b.close();
