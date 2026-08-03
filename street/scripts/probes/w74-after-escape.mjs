// Item 205, the question the row does NOT ask: once you have dismissed the
// machine, can you get it back WITHOUT standing up?
//
// The row's premise is that the terminal is unreachable. It is not — sitting
// opens it (`w74-does-the-poll-fire.mjs`). But `dismissed` latches the pose, so
// after one ESC the poll will never re-open it while you stay on that seat, and
// there is no `ctx.spot` to press [E] on either. That is the actual hole.
//
//   SHOT_URL=http://localhost:4301/ node scripts/probes/w74-after-escape.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4301/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForTimeout(500);

const state = () => p.evaluate(() => ({
  panel: window.__hud?.panel?.() ?? null,
  seated: !!window.__ct.seated(),
  prompt: (() => { const d = document.getElementById('ct-prompt'); return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null; })(),
}));
const tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k); await p.waitForTimeout(400); };

for (const LABEL of ['sit at the computer', 'sit at the slot']) {
  console.log(`\n═══ ${LABEL} ═══`);
  const i = await p.evaluate((l) => window.__ct.seats().findIndex((s) => s.label === l), LABEL);
  if (i < 0) { console.log('no such seat'); continue; }
  const seat = (await p.evaluate(() => window.__ct.seats()))[i];
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
  await p.waitForTimeout(700);
  await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
  await p.waitForTimeout(500);
  console.log(`sat          : ${JSON.stringify(await state())}`);
  await tap('Escape');
  console.log(`after ESC    : ${JSON.stringify(await state())}`);
  await p.waitForTimeout(600);
  console.log(`+600 ms      : ${JSON.stringify(await state())}`);
  await tap('e');
  console.log(`then [E]     : ${JSON.stringify(await state())}`);
  await p.evaluate(() => { window.__hud?.closePanels?.(); window.__ct.stand(); });
  await p.waitForTimeout(400);
}

if (errs.length) { console.log(`\nerrors: ${errs.length}`); console.log(errs.slice(0, 8).join('\n')); }
await b.close();
