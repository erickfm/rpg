// Which way does the ATM screen mesh actually face? The alignment probe mapped
// canvas-u onto world X and got two points that differ only in depth. Before
// trusting or blaming that, read the mesh's own basis vectors out of the world.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.evaluate(() => window.__ct.warp(-6.15, 7.29, -Math.PI / 2, 0.14, -0.14));
await p.waitForTimeout(1200);
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(1000);

const all = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const img = m && m.map && m.map.image;
    if (!img || img.width !== 300 || img.height !== 205) return;
    const e = n.matrixWorld.elements;
    out.push({
      pos: [e[12], e[13], e[14]].map((v) => +v.toFixed(3)),
      xAxis: [e[0], e[1], e[2]].map((v) => +v.toFixed(3)),
      yAxis: [e[4], e[5], e[6]].map((v) => +v.toFixed(3)),
      zAxis: [e[8], e[9], e[10]].map((v) => +v.toFixed(3)),
      geo: [n.geometry.parameters?.width, n.geometry.parameters?.height],
      uvAttr: !!n.geometry.attributes?.uv,
      visible: n.visible,
    });
  });
  const cam = window.__ct.camera();
  return { out, cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(3)) };
});
console.log('camera at', all.cam);
for (const m of all.out) {
  console.log(`\n  300x205 plane ${m.geo[0]} x ${m.geo[1]} m at ${m.pos}  visible=${m.visible}`);
  console.log(`    local +x -> world ${m.xAxis}`);
  console.log(`    local +y -> world ${m.yAxis}`);
  console.log(`    normal   -> world ${m.zAxis}`);
}
await b.close();
