#!/usr/bin/env node
// ITEM 206 — DOES CLOSING A PANEL FROM A CHAIR EJECT YOU FROM THE CHAIR?
//
// The row is a HYPOTHESIS (BUILDER-BRIEF §6). This walks the scenario the user
// described — *"you sit and its the loan process as an integrated overlay"* —
// and reports what the world actually does, before anything is changed.
//
//   sit on a real seat -> [E] to open its diegetic panel -> [ESC] -> still seated?
//
// ⚠ GOTCHAS 87: `__ct.sit({…})` with a FRESH LITERAL sits on a pose no seat
// owns, and the machines match their seat BY IDENTITY (`s.pose === pose`). The
// pose object is fetched from `__ct.seats()` and passed through unchanged.
//
// ⚠ BUILDER-BRIEF §5: `[E]` is an edge read once per rendered frame, so
// `keyboard.press` can begin and end inside one frame and never be seen. Held.
//
// ⚠ GOTCHAS 79b: warp before anything — the player spawns inside apartment 301,
// past the region cull.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
const SEAT = process.env.SEAT || 'sit at the computer';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const seat = await p.evaluate(([label]) => {
  const s = window.__ct.seats().find((q) => q.label === label);
  return s ? { x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw, at: s.at ? { x: s.at.x, z: s.at.z } : null } : null;
}, [SEAT]);
if (!seat) {
  const labels = await p.evaluate(() => [...new Set(window.__ct.seats().map((s) => s.label))]);
  console.log(`EXIT 3 — no seat labelled "${SEAT}". Labels in the world:`);
  for (const l of labels) console.log(`   ${l}`);
  await b.close(); process.exit(3);
}
console.log(`seat "${SEAT}" at (${seat.x.toFixed(2)}, ${seat.z.toFixed(2)}) yaw ${seat.yaw.toFixed(2)}`);

// stand next to it first, so the room is live and unculled
await p.evaluate(([x, z]) => window.__ct.warp(x, z - 1.0, Math.PI, 0, 0), [seat.x, seat.z]);
await waitPainted(p, { quiet: true });

const panelUp = () => p.evaluate(() => {
  const d = document.getElementById('ct-panelback');
  if (!d) return false;
  const st = getComputedStyle(d);
  return st.display !== 'none' && Number(st.opacity) > 0.05;
});
const seatedNow = () => p.evaluate(() => !!window.__ct.seated());

// SIT ON THE REAL POSE OBJECT (GOTCHAS 87)
await p.evaluate(([label]) => {
  const s = window.__ct.seats().find((q) => q.label === label);
  window.__ct.sit(s.pose);
}, [SEAT]);
await waitPainted(p, { quiet: true });
const sat = await seatedNow();
console.log(`after sit()            seated=${sat}   panel=${await panelUp()}`);
if (!sat) { console.log('EXIT 3 — could not sit; measured nothing.'); await b.close(); process.exit(3); }

// [E] — held, or the edge read is never seen
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(400);
const openPanel = await panelUp();
const seatedWithPanel = await seatedNow();
console.log(`after [E]              seated=${seatedWithPanel}   panel=${openPanel}`);
if (!openPanel) {
  console.log('EXIT 3 — [E] did not open a panel from this seat; the scenario never ran.');
  await b.close(); process.exit(3);
}

// [ESC] — the whole question
await p.keyboard.down('Escape'); await p.waitForTimeout(120); await p.keyboard.up('Escape');
await p.waitForTimeout(500);
const stillPanel = await panelUp();
const stillSeated = await seatedNow();
console.log(`after [ESC]            seated=${stillSeated}   panel=${stillPanel}`);

// and can he still get up?
let gotUp = null;
if (stillSeated) {
  await p.keyboard.down('Escape'); await p.waitForTimeout(120); await p.keyboard.up('Escape');
  await p.waitForTimeout(400);
  gotUp = !(await seatedNow());
  console.log(`after a second [ESC]   seated=${!gotUp}   (standing up still works: ${gotUp})`);
}

await b.close();
if (errs.length) console.log(`console errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);
console.log('');
if (stillPanel) { console.log('FAIL — the panel did not close on ESC. That is a different and worse bug.'); process.exit(1); }
if (!stillSeated) { console.log('REPRODUCED — closing the panel ejected the player from the chair (item 206).'); process.exit(1); }
if (gotUp === false) { console.log('FAIL — he stayed in the chair but can no longer stand up. BUILDER-BRIEF §11.'); process.exit(1); }
console.log('PASS — the panel closed, the player is still in the chair, and ESC still stands him up.');
process.exit(0);
