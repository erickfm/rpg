// Did the ATM panel actually open, and what is its screen mesh made of?
// The alignment probe could not find a 600x410 canvas texture; before
// believing that, find out what IS there.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  page error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.evaluate(() => window.__ct.warp(-6.15, 7.29, -Math.PI / 2, 0.14, -0.14));
await p.waitForTimeout(1500);

const hint = async (tag) => {
  const s = await p.evaluate(() => (document.body.innerText || '').slice(0, 300).replace(/\n+/g, ' | '));
  console.log(`  ${tag}: "${s.trim()}"`);
};
await hint('before E');
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(1200);
await hint('after E');

const maps = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const seen = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const img = m && m.map && m.map.image;
    if (!img || !img.width) return;
    const e = n.matrixWorld.elements;
    // only things standing near the cash machine
    if (Math.hypot(e[12] + 6.7, e[14] - 7.29) > 2.5) return;
    seen.push({ w: img.width, h: img.height, type: n.geometry.type,
      gw: n.geometry.parameters?.width, gh: n.geometry.parameters?.height,
      x: +e[12].toFixed(2), y: +e[13].toFixed(2), z: +e[14].toFixed(2) });
  });
  return seen;
});
console.log(`  textured meshes within 2.5 m of the ATM: ${maps.length}`);
for (const m of maps.slice(0, 25)) {
  console.log(`    ${String(m.w).padStart(4)}x${String(m.h).padEnd(4)} ${m.type}`
    + ` ${m.gw ?? '?'}x${m.gh ?? '?'} m  at (${m.x}, ${m.y}, ${m.z})`);
}
await p.screenshot({ path: 'shots/w60-atm-open.png' });
console.log('shots/w60-atm-open.png');
await b.close();
