// THE CLAIM: pressing [E] at FIRST FEDERAL eases you into a standing pose
// square to the machine, locks the look, and — the half that matters —
// ALWAYS lets you back out again with movement restored.
//
// Walked, never warped-and-inferred. Held keypress, per BUILDER-BRIEF §5.
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w41-focus-walk.mjs
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

const view = () => page.evaluate(() => {
  const c = window.__ct.camera();
  const p = window.__ct.pos();
  return { cx: c.position.x, cy: c.position.y, cz: c.position.z, fov: c.fov, px: p[0], pz: p[2], yaw: window.__ct.yaw(), panel: window.__hud.panel() };
});

// The screen mesh we should end up square to — asked for RELATIVE TO THE
// CAMERA, and only once we are actually focused. There are TWO machines in
// this wall, 0.95 m apart; the first version of this asked at page load, from
// the spawn, and so measured the player against the wrong one of the pair and
// called a correct 0.55 m lock a 1.10 m miss. The instrument, not the world.
const nearestScreen = () => page.evaluate(() => {
  const scene = window.__ct.scene();
  const c = window.__ct.camera();
  let best = null, bd = Infinity;
  scene.traverse((o) => {
    if (o.userData?.atmPart !== 'screen') return;
    o.updateWorldMatrix(true, false);
    const v = new (o.position.constructor)().setFromMatrixPosition(o.matrixWorld);
    const d = (v.x - c.position.x) ** 2 + (v.z - c.position.z) ** 2;
    if (d < bd) { bd = d; best = { x: v.x, y: v.y, z: v.z }; }
  });
  return best;
});

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0] ?? null);

// ── WALK UP TO IT, as the user does ──────────────────────────────────────
// put us a couple of metres away and OFF the axis, then walk in on W, so the
// pose we end at is one the focus chose and not one the harness handed it.
await page.evaluate(([x, z]) => window.__ct.warp(x + 2.6, z + 1.2, Math.atan2(-2.6, -1.2), window.__ct.groundAt(x + 2.6, z + 1.2), 0), [spot.x, spot.z]);
await page.waitForTimeout(300);
await page.keyboard.down('w');
await page.waitForFunction(() => {
  const e = document.getElementById('ct-prompt');
  const t = e && e.style.display !== 'none' ? e.textContent : '';
  return /FIRST FEDERAL/i.test(t || '');
}, null, { timeout: 8000 }).catch(() => {});
await page.keyboard.up('w');
const approached = await view();
ok(true, `walked up to it at (${approached.px.toFixed(2)}, ${approached.pz.toFixed(2)}), yaw ${approached.yaw.toFixed(2)}`);

await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
await page.waitForTimeout(700);                  // let the 0.40 s ease settle
const locked = await view();
ok(locked.panel === 'ct-atm', `[E] opened the machine (${locked.panel})`);

// ── square to the face ───────────────────────────────────────────────────
const target = await nearestScreen();
const dx = target.x - locked.cx, dz = target.z - locked.cz;
const dist = Math.hypot(dx, dz, target.y - locked.cy);
ok(Math.abs(dist - 0.55) < 0.06, `the eye settled 0.55 m off the glass (${dist.toFixed(3)} m)`);
// looking AT it: the yaw should point from the eye to the screen
const wantYaw = Math.atan2(dx, -dz);
const dYaw = Math.abs(((locked.yaw - wantYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
ok(dYaw < 0.05, `and square to it (${(dYaw * 180 / Math.PI).toFixed(2)}° off axis)`);
// The ease must actually REACH its target, not settle wherever two owners of
// cam.fov happen to balance. It read a stable 66.4° first time round: the
// world's own scroll-zoom smoother was dragging it back toward the resting 88°
// every frame while the lock pushed it to 60°.
ok(Math.abs(locked.fov - 60) < 0.5, `leaned in — fov eased all the way to 60° (${locked.fov.toFixed(1)}°)`);

// ── the look is LOCKED: the mouse must not turn the head ─────────────────
await page.mouse.move(200, 200);
await page.mouse.move(900, 500);
await page.waitForTimeout(200);
const afterMouse = await view();
ok(Math.abs(afterMouse.yaw - locked.yaw) < 0.01, `the mouse does not turn the head (${(afterMouse.yaw - locked.yaw).toFixed(4)} rad)`);

// ── and the feet are frozen ──────────────────────────────────────────────
await page.keyboard.down('w');
await page.waitForTimeout(700);
await page.keyboard.up('w');
const afterW = await view();
ok(Math.hypot(afterW.px - locked.px, afterW.pz - locked.pz) < 0.05,
  `the feet are frozen (${Math.hypot(afterW.px - locked.px, afterW.pz - locked.pz).toFixed(3)} m on a held W)`);

// ── ESCAPE RELEASES, AND MOVEMENT COMES BACK ─────────────────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const out = await view();
ok(out.panel === null, `Escape closed it (panel ${out.panel})`);
ok(Math.abs(out.fov - 88) < 0.5, `and gave the fov back (${out.fov.toFixed(1)}°)`);
ok(!(await page.evaluate(() => window.__ct.seated())), 'and stood the player back up');

// BACKWARDS, on S. Releasing leaves you facing the machine — correctly, you
// were just reading it — so a held W walks you into the bank wall and measures
// the collider, not the movement. The first run of this scored 0.28 m and the
// world was right: it was the harness pushing a player nose-first into stone.
const before = { x: out.px, z: out.pz };
await page.keyboard.down('s');
await page.waitForTimeout(800);
await page.keyboard.up('s');
const moved = await view();
const d = Math.hypot(moved.px - before.x, moved.pz - before.z);
ok(d > 0.5, `AND MOVEMENT WORKS AGAIN (${d.toFixed(2)} m on a held S, away from the wall)`);

// mouse-look back too
const y0 = moved.yaw;
await page.mouse.move(300, 360);
await page.mouse.down();
await page.mouse.move(700, 360);
await page.mouse.up();
await page.waitForTimeout(150);
const y1 = (await view()).yaw;
ok(Math.abs(y1 - y0) > 0.05, `and so does looking around (${(y1 - y0).toFixed(3)} rad on a drag)`);

for (const e of errors) console.log(e);
ok(errors.length === 0, `no console errors (${errors.length})`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
