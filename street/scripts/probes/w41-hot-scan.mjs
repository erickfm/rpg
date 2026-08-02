// Where does the world think the pressable bands ARE? Sweep the pointer down a
// column of the pad and record where the hand appears, so the answer comes from
// the world rather than from my arithmetic about it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 6000 });
await page.keyboard.up('e');
await page.waitForTimeout(700);
await page.keyboard.press('1');
await page.waitForTimeout(250);

// sweep page-y down the middle column of the pad (page x 558, from the debug run)
let runs = [], cur = null, start = null;
for (let y = 250; y <= 560; y += 2) {
  await page.mouse.move(558, y);
  const c = await page.evaluate(() => document.body.style.cursor);
  const hot = c === 'pointer';
  if (hot !== cur) {
    if (cur === true) runs.push([start, y - 2]);
    if (hot) start = y;
    cur = hot;
  }
}
if (cur === true) runs.push([start, 560]);
console.log('HOT page-y bands down the pad column:', JSON.stringify(runs));

// and where the pad rows are DRAWN, projected out the same way the harness does
const proj = (cx, cy) => page.evaluate(([cx, cy]) => {
  const scene = window.__ct.scene(); const cam = window.__ct.camera();
  let m = null, bd = Infinity;
  scene.traverse((o) => {
    if (o.userData?.atmPart !== 'screen') return;
    o.updateWorldMatrix(true, false);
    const v = new (o.position.constructor)().setFromMatrixPosition(o.matrixWorld);
    const d = (v.x - cam.position.x) ** 2 + (v.z - cam.position.z) ** 2;
    if (d < bd) { bd = d; m = o; }
  });
  const W = 300, H = 205; const u = cx / W, v = 1 - cy / H;
  const pos = m.geometry.getAttribute('position'), uv = m.geometry.getAttribute('uv');
  const corner = (tu, tv) => {
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getX(i) - tu) < 1e-6 && Math.abs(uv.getY(i) - tv) < 1e-6) {
        return new (m.position.constructor)(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
  };
  const a = corner(0, 0).clone().lerp(corner(1, 0), u), b = corner(0, 1).clone().lerp(corner(1, 1), u);
  const ndc = a.lerp(b, v).applyMatrix4(m.matrixWorld).project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return +(r.top + (-ndc.y * 0.5 + 0.5) * r.height).toFixed(1);
}, [cx, cy]);
for (let row = 0; row < 4; row++) {
  const top = 9 + 72 + row * 29, bot = top + 24;
  console.log(`pad row ${row}: canvas y ${top}..${bot} -> page y ${await proj(150, top)}..${await proj(150, bot)}`);
}
await browser.close();
