// THE CLAIM: *"the screen on the literal atm be the overlay that i can use my
// mouse to click through"* — a whole session, card to cash, driven by CLICKING
// BUTTONS IN THE WORLD. No keyboard, no __atm.open(), no synthetic events into
// the panel: real page clicks, raycast onto the machine's own screen mesh.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w41-mouse-walk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4187/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };
const st = () => page.evaluate(() => ({
  screen: window.__atm.screen(), account: window.__atm.account(),
  cash: window.__atm.cash(), pending: window.__atm.pending(), panel: window.__hud.panel(),
}));

// ── walk up and open it, as a player ─────────────────────────────────────
const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 6000 });
await page.keyboard.up('e');
await page.waitForTimeout(700);
ok((await st()).panel === 'ct-atm', 'the machine is up');

// ── WHERE IS A GIVEN CANVAS PIXEL ON SCREEN? ─────────────────────────────
// The inverse of what the framework does: project the point of the screen mesh
// that carries canvas pixel (cx, cy) back out to a page coordinate, so the
// harness can put the real mouse on a real button. Derived from the mesh, so it
// cannot drift from the thing being tested.
const pageXY = (cx, cy) => page.evaluate(([cx, cy]) => {
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
  if (!m) return null;
  const W = 300, H = 205;                 // the panel's canvas, ct/atm.ts
  const u = cx / W, v = 1 - cy / H;       // canvas top-left -> UV bottom-left
  const pos = m.geometry.getAttribute('position');
  const uv = m.geometry.getAttribute('uv');
  // the plane's four corners, in UV order, so a bilinear lerp lands anywhere
  const corner = (tu, tv) => {
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getX(i) - tu) < 1e-6 && Math.abs(uv.getY(i) - tv) < 1e-6) {
        return new (m.position.constructor)(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    return null;
  };
  const p00 = corner(0, 0), p10 = corner(1, 0), p01 = corner(0, 1), p11 = corner(1, 1);
  if (!p00 || !p10 || !p01 || !p11) return null;
  const a = p00.clone().lerp(p10, u), b = p01.clone().lerp(p11, u);
  const local = a.lerp(b, v);
  const world = local.applyMatrix4(m.matrixWorld);
  const ndc = world.clone().project(cam);
  const cv = document.querySelector('canvas');
  const r = cv.getBoundingClientRect();
  return { x: r.left + (ndc.x * 0.5 + 0.5) * r.width, y: r.top + (-ndc.y * 0.5 + 0.5) * r.height };
}, [cx, cy]);

// the soft keys, from ct/atm.ts's own layout: BTN_Y = [56,92,128,164], BTN_H 15
const BTN_Y = [56, 92, 128, 164], BTN_H = 15;
const softKey = async (row, right) => {
  const p = await pageXY(right ? 288 : 12, BTN_Y[row] + BTN_H / 2);
  if (!p) throw new Error('could not project the soft key');
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
  const cur = await page.evaluate(() => document.body.style.cursor);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(220);
  return cur;
};
// the PIN pad, from ct/atm.ts's PAD: 40x24 cells, gap 5, at CRT(32,9)+(52,72)
const padKey = async (i) => {
  const x = 32 + 52 + (i % 3) * 45 + 20, y = 9 + 72 + Math.floor(i / 3) * 29 + 12;
  const p = await pageXY(x, y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(150);
};

// ── the hand only appears over something that does something ─────────────
const dead = await pageXY(150, 20);                 // middle of the header band
await page.mouse.move(dead.x, dead.y);
await page.waitForTimeout(80);
ok((await page.evaluate(() => document.body.style.cursor)) !== 'pointer',
   'the cursor is plain over the tube where nothing is pressable');

// ── INSERT CARD, by clicking it ──────────────────────────────────────────
const cur1 = await softKey(0, false);
ok(cur1 === 'pointer', `the cursor turns to a hand over a live button (${cur1})`);
ok((await st()).screen === 'pin', 'clicking INSERT CARD in the world took the card');

// ── the PIN, on the on-screen pad ────────────────────────────────────────
for (const i of [3, 8, 10, 1]) await padKey(i);     // 4, 9, 0, 2
// COUNT THE DIGITS, do not just check we are still on the screen — "the pad did
// nothing" and "the pad worked" are indistinguishable from `screen` alone, and
// that is exactly how the pointer-lock bug below first read as an ENTER fault.
ok((await page.evaluate(() => window.__atm.pin())) === 4,
  `four clicked digits went in (${await page.evaluate(() => window.__atm.pin())})`);
await padKey(11);                                    // ENT
await page.waitForTimeout(250);
ok((await st()).screen === 'menu', 'and clicking ENT reaches the menu');

// ── balance, then a withdrawal, all by mouse ─────────────────────────────
await softKey(0, false);
ok((await st()).screen === 'balance', 'clicking BALANCE shows the balance');
await softKey(0, true);
ok((await st()).screen === 'menu', 'clicking BACK returns to the menu');

const before = await st();
await softKey(1, false);
ok((await st()).screen === 'withdraw', 'clicking WITHDRAW offers the notes');
await softKey(1, false);                             // $40
await page.waitForFunction(() => window.__atm.screen() === 'cash', null, { timeout: 8000 }).catch(() => {});
const cash = await st();
ok(cash.screen === 'cash', 'clicking $40 counted the notes out');
ok(Math.abs(cash.account - (before.account - 40)) < 1e-6,
  `the account fell by exactly $40 (${before.account} -> ${cash.account})`);
await softKey(0, false);                             // TAKE CASH
const took = await st();
ok(Math.abs(took.cash - (before.cash + 40)) < 1e-6,
  `and $40 reached the pocket (${before.cash} -> ${took.cash})`);
ok(Math.abs((took.account + took.cash) - (before.account + before.cash)) < 1e-6,
  'nothing was created or destroyed by the mouse path');

await page.screenshot({ path: '/tmp/w41-atm-mouse.png' });

// ── ESCAPE STILL WORKS, FROM A SCREEN DEEP IN THE SESSION ────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
ok((await page.evaluate(() => window.__hud.panel())) === null, 'Escape closes it mid-session');
ok(!(await page.evaluate(() => window.__ct.seated())), 'and stands the player up');
ok((await page.evaluate(() => document.body.style.cursor)) === '', 'and gives the page its cursor back');

for (const e of errors) console.log(e);
ok(errors.length === 0, `no console errors (${errors.length})`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
