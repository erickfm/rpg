import { chromium } from 'playwright';
const URL = 'http://localhost:4181/';
const [px, pz, yaw, pitch] = (process.argv[2] ?? '-6.2,-40.1,-1.5708,-0.06').split(',').map(Number);
const box = JSON.parse(process.argv[3] ?? '[-13.6,-6.4,-44,-36.5,1.4]');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.mouse.click(640, 360);
await page.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));
await page.waitForTimeout(400);
await page.evaluate(([a, b, y, p]) => window.__ct.warp(a, b, y, 0, p), [px, pz, yaw, pitch]);
await page.waitForTimeout(600);
const out = await page.evaluate(([bx, ppx, ppz]) => {
  const sc = window.__ct.scene();
  let cam = null;
  sc.traverse((o) => { if (o.isCamera) cam = o; });
  const rows = [];
  sc.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const p = o.position.clone().setFromMatrixPosition(o.matrixWorld);
    if (p.x < bx[0] || p.x > bx[1] || p.z < bx[2] || p.z > bx[3] || p.y > bx[4]) return;
    const g = o.geometry; g.computeBoundingBox();
    const bb = g.boundingBox;
    let sx = null, sy = null;
    if (cam) {
      const q = p.clone().project(cam);
      sx = Math.round((q.x + 1) * 640); sy = Math.round((1 - q.y) * 360);
    }
    rows.push({
      x: +p.x.toFixed(2), y: +p.y.toFixed(3), z: +p.z.toFixed(2),
      sx, sy,
      d: +Math.hypot(p.x - ppx, p.z - ppz).toFixed(2),
      dim: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((n) => +n.toFixed(2)),
      rotY: +o.rotation.y.toFixed(2),
      mat: Array.isArray(o.material) ? 'multi' : (o.material.map ? 'map' : '#' + (o.material.color?.getHexString?.() ?? '')),
    });
  });
  return { camFound: !!cam, rows };
}, [box, px, pz]);
out.rows.sort((a, b) => (a.sx ?? 0) - (b.sx ?? 0));
console.log('cam projection available:', out.camFound);
for (const r of out.rows) console.log(JSON.stringify(r));
console.log('count', out.rows.length);
await browser.close();
