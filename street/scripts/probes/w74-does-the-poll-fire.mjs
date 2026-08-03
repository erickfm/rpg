// Does the CURRENT frame-hook poll actually open either machine when you sit?
// The queue row asserts the library terminal is unreachable; w69's note says the
// poll is what reaches it. Both cannot be true. Ask the world.
//
//   SHOT_URL=http://localhost:4301/ node scripts/probes/w74-does-the-poll-fire.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4301/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForTimeout(500);

const state = () => p.evaluate(() => ({
  panel: window.__hud?.panel?.() ?? null,
  seated: !!window.__ct.seated(),
  prompt: (() => { const d = document.getElementById('ct-prompt'); return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null; })(),
  pcOnMesh: window.__librarypc?.onMesh?.() ?? null,
  slotScreen: !!window.__slots?.screen?.(),
}));

for (const LABEL of ['sit at the computer', 'sit at the slot']) {
  console.log(`\n═══ ${LABEL} ═══`);
  const i = await p.evaluate((l) => window.__ct.seats().findIndex((s) => s.label === l), LABEL);
  if (i < 0) { console.log('no such seat'); continue; }
  const seat = (await p.evaluate(() => window.__ct.seats()))[i];
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
  await p.waitForTimeout(700);
  console.log(`standing at the approach: ${JSON.stringify(await state())}`);
  // BY IDENTITY. `__ct.sit` hands the caller's object straight to `rig.sit`, so
  // a fresh `{x,z,yaw,h}` literal is NOT the pose object `ctx.seat` registered —
  // and both machines match their seat by `s.pose === pose`. Sitting with a copy
  // reports "the poll never fires" when the poll is fine.
  await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
  for (const ms of [150, 500, 1500]) {
    await p.waitForTimeout(ms === 150 ? 150 : ms - 150);
    console.log(`  +${ms} ms: ${JSON.stringify(await state())}`);
  }
  await p.screenshot({ path: `shots/w74-base-${LABEL.replace(/\s+/g, '-')}.png` });
  await p.evaluate(() => { window.__hud?.closePanels?.(); window.__ct.stand(); });
  await p.waitForTimeout(400);
}

if (errs.length) { console.log(`\nerrors: ${errs.length}`); console.log(errs.slice(0, 8).join('\n')); }
await b.close();
