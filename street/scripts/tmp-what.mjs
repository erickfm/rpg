import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto('http://localhost:4182/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 20));
// the lib-name station: (-8.6, -13.0) facing west, pitched up a little
await page.evaluate(() => window.__ct.warp(-8.6, -13.0, -Math.PI / 2, 0.14, 0.22));
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/E-qpass/_canopy-probe.png' });
// raycast the dark slab at the top of frame (about x 500, y 30 of 1000x640)
const hits = await page.evaluate(([px, py, w, h]) => {
  const cam = window.__ct.camera();
  cam.updateMatrixWorld(true);
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  // build vectors using the camera's own constructor family
  const V = cam.position.constructor;
  const origin = new V().setFromMatrixPosition(cam.matrixWorld);
  const ndc = new V((px / w) * 2 - 1, -(py / h) * 2 + 1, 0.5);
  const dir = ndc.unproject(cam).sub(origin).normalize();
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere; if (!bs) return;
    const c = bs.center.clone().applyMatrix4(o.matrixWorld);
    const t = c.clone().sub(origin).dot(dir);
    if (t < 0.3 || t > 40) return;
    const closest = origin.clone().add(dir.clone().multiplyScalar(t));
    const d = closest.distanceTo(c);
    const sc = Math.max(o.scale.x, o.scale.y, o.scale.z);
    if (d > bs.radius * sc) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    out.push({
      t: +t.toFixed(2),
      at: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
      r: +(bs.radius * sc).toFixed(2),
      mats: mats.map((m) => (m?.map ? 'MAP' : '#' + (m?.color?.getHexString?.() ?? '??'))).join(','),
    });
  });
  return { origin: [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)],
           hits: out.sort((a, b) => a.t - b.t).slice(0, 10) };
}, [500, 30, 1000, 640]);
console.log('camera at', JSON.stringify(hits.origin));
console.log('ray through the dark slab, nearest first:');
for (const h of hits.hits) console.log('  ', JSON.stringify(h));
await b.close();
