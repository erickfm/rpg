// THE ONE SEAT THE CROWN MOVED. `ctx.seat({h})` places you h above THE FLOOR,
// and the floor under the mound bench went from 0.44 to 0.51 when the field was
// crowned. seats-walk sweeps all 58 and takes minutes; every other seat sits on
// ground I have not touched, so this is the one worth re-asking after a change
// to the relief.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const seat = (await page.evaluate(() => window.__ct.seats()))
  .find((s) => Math.abs(s.pose.x + 21.5) < 0.6 && Math.abs(s.pose.z + 84.2) < 0.6);
report('the bench on the mound is still a registered seat', !!seat,
  seat ? `at ${seat.pose.x.toFixed(2)},${seat.pose.z.toFixed(2)} h ${seat.pose.h}` : 'not found');
if (!seat) { await b.close(); process.exit(1); }

const floor = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.pose.x, seat.pose.z]);
report('…and it stands on the raised ground, not the old flat 0.14', floor > 0.30,
  `floor under the seat is ${floor.toFixed(3)}`);

// walk in and sit, the way a player meets it
const ux = (seat.at.x - seat.pose.x) / 0.95, uz = (seat.at.z - seat.pose.z) / 0.95;
await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0),
  [seat.pose.x + ux * 2.4, seat.pose.z + uz * 2.4, Math.atan2(-ux, uz)]);
await page.waitForTimeout(250);
await page.keyboard.down('w'); await page.waitForTimeout(1400); await page.keyboard.up('w');
await page.waitForTimeout(350);
const prompt = await page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) {
    const t = (el.textContent || '').trim();
    if (/^\[E\]/.test(t) && !el.children.length) return t;
  }
  return null;
});
report('walking up the mound offers the seat', !!prompt, prompt ?? 'no prompt');
await page.keyboard.press('e'); await page.waitForTimeout(450);
const seated = await page.evaluate(() => !!window.__ct.seated());
const camY = await page.evaluate(() => window.__ct.camY());
report('…and you sit on it', seated, `seated=${seated}, camera at y ${camY?.toFixed?.(2)}`);
// the pose must ride the relief: seat pan is h above the floor, so the camera
// sits well above what it would on flat ground
report('…at a height that followed the ground up', camY > floor,
  `camera ${camY?.toFixed?.(2)} against a floor of ${floor.toFixed(2)}`);
await page.keyboard.press('e'); await page.waitForTimeout(400);
const stood = await page.evaluate(() => !window.__ct.seated());
const p = await page.evaluate(() => window.__ct.pos());
report('…and stand up clear of it', stood && p[3] > 0.30,
  `standing=${stood} at gy ${p[3].toFixed(2)}`);

console.log(fails ? `\n${fails} FAILED` : '\nthe mound bench sits at the height the relief put it');
await b.close();
process.exit(fails ? 1 : 0);
