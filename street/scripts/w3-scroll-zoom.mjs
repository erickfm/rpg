// Verifies scroll-to-zoom: resting FOV, clamped pull-in, spring-back to rest,
// and — the requirement most likely to silently break — no zoom while a
// panel (ATM/slots/blackjack/pockets) is open.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const fov = () => p.evaluate(() => window.__ct.camera().fov);

let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fail++;
};

const restFov = await fov();
check('resting fov is 88 (the deliberate wide 1997 look)', Math.abs(restFov - 88) < 0.01, `got ${restFov}`);

// scroll "up" (negative deltaY) repeatedly: should zoom IN, clamped at 64
for (let i = 0; i < 20; i++) {
  await p.mouse.wheel(0, -120);
  await p.waitForTimeout(30);
}
await p.waitForTimeout(400); // let the ease settle
const zoomed = await fov();
check('scrolling up pulls the fov in', zoomed < restFov, `got ${zoomed}`);
check('pull-in is clamped tight (>= 64, "shouldn\'t zoom too much")', zoomed >= 63.9, `got ${zoomed}`);

// scroll back out: should spring back to exactly 88, never wider
for (let i = 0; i < 30; i++) {
  await p.mouse.wheel(0, 120);
  await p.waitForTimeout(30);
}
await p.waitForTimeout(400);
const restored = await fov();
check('scrolling down springs back to the 88° resting value', Math.abs(restored - 88) < 0.05, `got ${restored}`);

// zoom in again, then open a panel, and confirm the wheel no longer reaches the camera
for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(20); }
await p.waitForTimeout(400);
const preOpen = await fov();
check('sanity: zoomed in before opening a panel', preOpen < 88, `got ${preOpen}`);

const opened = await p.evaluate(() => window.__hud.openPanel('ct-atm'));
check('ATM panel opened', opened === true);
const beforeScroll = await fov();
for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(20); }
await p.waitForTimeout(400);
const afterScroll = await fov();
check('scrolling with the ATM open does NOT change fov', Math.abs(afterScroll - beforeScroll) < 0.01,
  `before ${beforeScroll} after ${afterScroll}`);

await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(150);
// and the world responds to scroll again once the panel is closed
for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(20); }
await p.waitForTimeout(400);
const afterClose = await fov();
check('scroll works again once the panel is closed', afterClose > afterScroll, `got ${afterClose}`);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
await b.close();
process.exit(fail === 0 ? 0 : 1);
