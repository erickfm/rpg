// Why does a click on the PIN pad not register? Ask the machine directly.
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
await page.keyboard.press('1');                 // straight to the PIN screen
await page.waitForTimeout(200);
console.log('screen:', await page.evaluate(() => window.__atm.screen()));

const probe = (cx, cy) => page.evaluate(([cx, cy]) => {
  const scene = window.__ct.scene();
  const cam = window.__ct.camera();
  let m = null, bd = Infinity;
  scene.traverse((o) => {
    if (o.userData?.atmPart !== 'screen') return;
    o.updateWorldMatrix(true, false);
    const v = new (o.position.constructor)().setFromMatrixPosition(o.matrixWorld);
    const d = (v.x - cam.position.x) ** 2 + (v.z - cam.position.z) ** 2;
    if (d < bd) { bd = d; m = o; }
  });
  const W = 300, H = 205;
  const u = cx / W, v = 1 - cy / H;
  const pos = m.geometry.getAttribute('position'), uv = m.geometry.getAttribute('uv');
  const corner = (tu, tv) => {
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getX(i) - tu) < 1e-6 && Math.abs(uv.getY(i) - tv) < 1e-6) {
        return new (m.position.constructor)(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    return null;
  };
  const a = corner(0, 0).clone().lerp(corner(1, 0), u), b = corner(0, 1).clone().lerp(corner(1, 1), u);
  const world = a.lerp(b, v).applyMatrix4(m.matrixWorld);
  const ndc = world.clone().project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.left + (ndc.x * 0.5 + 0.5) * r.width, y: r.top + (-ndc.y * 0.5 + 0.5) * r.height };
}, [cx, cy]);

// centre of pad cell 3 ('4'): padCell gives x 84..124, y 110..134
for (const [label, cx, cy] of [['pad 4', 104, 122], ['pad 1', 104, 93], ['pad ENT', 194, 180], ['softkey 5', 288, 63]]) {
  const p = await probe(cx, cy);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
  const cur = await page.evaluate(() => document.body.style.cursor);
  const snap = () => page.evaluate(() => ({
    s: window.__atm.screen(), p: window.__atm.pin(), panel: window.__hud.panel(),
    lock: !!document.pointerLockElement, seated: !!window.__ct.seated(),
    cursor: document.body.style.cursor,
  }));
  const before = await snap();
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(180);
  const after = await snap();
  console.log(`${label} canvas(${cx},${cy}) -> page(${p.x.toFixed(0)},${p.y.toFixed(0)}) cursor=${cur}`);
  console.log(`      before ${JSON.stringify(before)}`);
  console.log(`      after  ${JSON.stringify(after)}`);
}
// and what does the framework think the pointer is over?
const rt = await page.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { w: r.width, h: r.height, left: r.left, top: r.top };
});
console.log('canvas rect:', JSON.stringify(rt));
await page.screenshot({ path: '/tmp/w41-pad-debug.png' });
await browser.close();
