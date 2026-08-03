// BASELINE, item 205: what does a seated player at the library terminal and at
// a slot stool actually get offered TODAY? Read before changing anything
// (BUILDER-BRIEF §6 — a queue item is a hypothesis, not a finding).
//
//   SHOT_URL=http://localhost:4301/ node scripts/probes/w74-baseline.mjs
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

const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});

const labels = await p.evaluate(() => {
  const seen = {};
  for (const s of window.__ct.seats()) seen[s.label] = (seen[s.label] ?? 0) + 1;
  return seen;
});
console.log('seat labels in the world:');
for (const [k, v] of Object.entries(labels).sort()) console.log(`  ${String(v).padStart(3)}  ${k}`);

for (const LABEL of ['sit at the computer', 'sit at the slot']) {
  console.log(`\n═══ ${LABEL} ═══`);
  const seats = (await p.evaluate(() => window.__ct.seats())).filter((s) => s.label === LABEL);
  console.log(`${seats.length} seat(s)`);
  if (!seats.length) continue;
  const seat = seats[0];
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0),
    [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
  await p.waitForTimeout(700);
  await p.evaluate(([x, z, yaw, h]) => window.__ct.sit({ x, z, yaw, h }),
    [seat.pose.x, seat.pose.z, seat.pose.yaw, seat.pose.h]);
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({
    seated: !!window.__ct.seated(),
    panelUp: !!window.__hud?.panel?.(),
  }));
  console.log(`pose (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)}) yaw ${seat.pose.yaw.toFixed(3)}  seated=${st.seated}  panel=${JSON.stringify(st.panelUp)}`);
  console.log(`prompt head-straight: ${JSON.stringify(await promptNow())}`);
  // everything registered within 3 m of the chair
  const near = await p.evaluate(([sx, sz]) => window.__ct.spots()
    .map((s) => ({ ...s, d: Math.hypot(s.x - sx, s.z - sz) }))
    .filter((s) => s.d < 3)
    .sort((a, c) => a.d - c.d), [seat.pose.x, seat.pose.z]);
  console.log(`spots within 3 m of the chair: ${near.length}`);
  for (const s of near) console.log(`   ${s.d.toFixed(3)} m  r ${s.r}  ok=${s.ok}  ${JSON.stringify(s.label)}`);
  await p.evaluate(() => window.__ct.stand());
  await p.waitForTimeout(300);
}

if (errs.length) { console.log(`\nconsole errors: ${errs.length}`); console.log(errs.slice(0, 6).join('\n')); }
await b.close();
