// MEASURE FIRST. Does a real raked screen mesh exist on the machine in the
// world, can it be found without editing ct/bank.ts, and does a raycast from a
// plausible standing pose hit it with sane UVs?
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w41-screen-mesh.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4187/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const out = await page.evaluate(() => {
  const THREE = window.__THREE;
  const scene = window.__ct.scene();
  const found = [];
  scene.traverse((o) => { if (o.userData && o.userData.atmPart) found.push(o); });
  const parts = {};
  for (const o of found) parts[o.userData.atmPart] = (parts[o.userData.atmPart] || 0) + 1;

  const screens = found.filter((o) => o.userData.atmPart === 'screen');
  const rows = screens.map((m) => {
    m.updateWorldMatrix(true, false);
    const p = new (m.position.constructor)();
    p.setFromMatrixPosition(m.matrixWorld);
    // world normal, from the geometry's own normal attribute (baked rotation)
    const na = m.geometry.getAttribute('normal');
    const n = { x: na.getX(0), y: na.getY(0), z: na.getZ(0) };
    const nm = new (m.position.constructor)(n.x, n.y, n.z);
    nm.transformDirection(m.matrixWorld);
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    const uv = m.geometry.getAttribute('uv');
    const pos = m.geometry.getAttribute('position');
    const corners = [];
    for (let i = 0; i < uv.count; i++) {
      corners.push({
        uv: [uv.getX(i), uv.getY(i)],
        local: [+pos.getX(i).toFixed(4), +pos.getY(i).toFixed(4), +pos.getZ(i).toFixed(4)],
      });
    }
    const tex = m.material && m.material.map;
    return {
      worldPos: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)],
      worldNormal: [+nm.x.toFixed(4), +nm.y.toFixed(4), +nm.z.toFixed(4)],
      tiltDeg: m.userData.atmTilt,
      bboxSize: [+(bb.max.x - bb.min.x).toFixed(4), +(bb.max.y - bb.min.y).toFixed(4), +(bb.max.z - bb.min.z).toFixed(4)],
      corners,
      texImage: tex && tex.image ? [tex.image.width, tex.image.height] : null,
      matType: m.material && m.material.type,
    };
  });
  return { parts, count: found.length, screens: rows, hasTHREE: !!window.__THREE };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
