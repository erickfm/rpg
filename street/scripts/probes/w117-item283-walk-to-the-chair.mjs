// ITEM 283, WALKED — the whole journey, from the pavement to the loan.
//
// The sibling probe (w117-item283-client-chair.mjs) warps onto the client
// chair's approach point and presses E. BUILDER-BRIEF §10 is explicit that
// seats are proved by WALKING them, because a teleport onto a trigger says
// nothing about whether a player can get there on foot. So this one does what
// the user does: stands on the street, presses [E] into FIRST FEDERAL, and
// walks across the banking hall to the chair on held W.
//
// TWO THINGS THIS CATCHES THAT A WARP CANNOT.
//
// 1. The walk crosses the door's OWN arrival latch. `landing` is armed by
//    stepping through the door — correctly — and must discharge on the way
//    across the hall, or nothing in the room is selectable. That is the same
//    mechanism item 283 is about, exercised in the direction where it is
//    supposed to fire.
// 2. It proves the chair is reachable through the room's furniture, not merely
//    triggerable from a coordinate.
//
// WHY IT WALKS IN BURSTS AND POLLS, rather than holding W for a fixed time.
// The first cut held W for 1400 ms from 0.8 m back and reported the chair "not
// walkable". It was not: the walk had OVERSHOT the approach point, and from
// 0.54 m past it the aimed pick ("read the loan application", straight ahead on
// the desk) legitimately beats the proximity pick ("sit in the client chair").
// A fixed sleep against anything the render loop drives is GOTCHAS 30, and the
// finding was the instrument rather than the world — BUILDER-BRIEF §7. So the
// walk advances in short bursts and stops the moment the chair is on offer.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-item283-walk-to-the-chair.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.evaluate(() => window.__ct.clock(10, 0));   // applications are taken nine to four

const fails = [];
const note = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };
const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const here = () => p.evaluate(() => {
  const q = window.__ct.pos();
  return { x: q[0], z: q[2], gy: q[3], landing: window.__ct.landing(), seated: !!window.__ct.seated() };
});
const tap = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(120);
  await p.keyboard.up(k); await p.waitForTimeout(260);
};

const chair = await p.evaluate(() => {
  const s = (window.__ct.seats() || []).find((q) => /client chair/i.test(q.label));
  return s ? { x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw, ax: s.at.x, az: s.at.z } : null;
});
if (!chair) { console.log('REFUSING TO REPORT: no client chair published'); await b.close(); process.exit(3); }

// ── 1. through the front door, on foot ──────────────────────────────────────
await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));
await waitPainted(p, { frames: 4 });
const door = await p.evaluate(() => (window.__ct.spots() || [])
  .find((s) => /FIRST FEDERAL/.test(s.label ?? '') && s.ok) ?? null);
note(!!door, `the bank's street door is published and open — ${JSON.stringify(door?.label)}`);
if (!door) { console.log('cannot continue'); await b.close(); process.exit(1); }
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [door.x, door.z]);
await waitPainted(p, { frames: 6 });
await tap('e');
await waitPainted(p, { frames: 8 });
const inside = await here();
console.log(`\nstepped in at ${inside.x.toFixed(2)},${inside.z.toFixed(2)} (gy ${inside.gy})`);
note(inside.landing !== null,
  `the DOOR armed the arrival latch, as it must — landing=${JSON.stringify(inside.landing)}`);
console.log(`  the chair's approach is ${Math.hypot(inside.x - chair.ax, inside.z - chair.az).toFixed(2)} m away`);

// ── 2. walk across the hall to the chair ────────────────────────────────────
// Re-aim at the approach point each burst and take a short step. This is a
// player holding W and steering, not a path solver; if the room's furniture
// blocked the chair it would stall and the arrival assertion would fail.
// STOP ON DISTANCE, NOT ON THE PROMPT. The first version stopped as soon as the
// chair was offered and that fired at d 4.24 m — legitimately, because the
// AIMED pass reaches 6 m and the walk faces the chair the whole way, so the
// prompt says more about the aim cone than about the walk. "Walked there" is a
// claim about distance, so the loop ends on distance and the prompt is then
// asserted separately.
const STOP = 0.5;                       // inside the seat spot's own r (0.8)
let dist = 0, stalls = 0, arrived = false;
let prev = inside;
const d0 = Math.hypot(inside.x - chair.ax, inside.z - chair.az);
for (let burst = 0; burst < 60 && !arrived; burst++) {
  await p.evaluate(([x, z, ax, az]) => window.__ct.warp(x, z, Math.atan2(ax - x, -(az - z))),
    [prev.x, prev.z, chair.ax, chair.az]);
  await p.keyboard.down('w'); await p.waitForTimeout(140); await p.keyboard.up('w');
  await p.waitForTimeout(40);
  const now = await here();
  const step = Math.hypot(now.x - prev.x, now.z - prev.z);
  dist += step;
  if (step < 0.02) stalls++;
  prev = now;
  if (Math.hypot(now.x - chair.ax, now.z - chair.az) <= STOP) arrived = true;
}
const at = await here();
const dApp = Math.hypot(at.x - chair.ax, at.z - chair.az);
console.log(`\nwalked ${dist.toFixed(2)} m in ${stalls} stalled bursts, ${d0.toFixed(2)} m -> ${dApp.toFixed(2)} m from the approach`);
console.log(`  ended at ${at.x.toFixed(2)},${at.z.toFixed(2)}   prompt: ${JSON.stringify(await promptNow())}`);
note(arrived, arrived
  ? `holding W across the hall put you within ${STOP} m of the chair's approach point`
  : `walking stalled ${dApp.toFixed(2)} m short — the chair is not reachable on foot from the door`);
note(/sit in the client chair/i.test((await promptNow()) ?? ''),
  'and standing there, the chair is what [E] offers');
note(at.landing === null,
  `the door's latch discharged on the way over — landing=${JSON.stringify(at.landing)}`);

// ── 3. sit, and take the loan ───────────────────────────────────────────────
if (arrived) {
  await tap('e');
  await waitPainted(p, { frames: 8 });
  const sat = await here();
  note(sat.seated, 'pressing [E] after walking there sat you down');
  note(sat.landing === null,
    `and SITTING did not arm the latch — landing=${JSON.stringify(sat.landing)}   (item 283)`);

  let got = null;
  for (let d = -80; d <= 80 && !got; d += 4) {
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [chair.x, chair.z, chair.yaw + (d * Math.PI) / 180]);
    await waitPainted(p, { frames: 2 });
    const t = await promptNow();
    if (/loan|application/i.test(t ?? '')) got = { d, t };
  }
  note(!!got, got ? `the loan is offered from the chair at ${got.d >= 0 ? '+' : ''}${got.d}° — ${JSON.stringify(got.t)}`
    : 'no loan offered from the chair at any head angle');
  if (got) {
    await tap('e');
    await waitPainted(p, { frames: 8 });
    const open = await p.evaluate(() => ({
      panel: window.__hud?.panel?.() ?? null, seated: !!window.__ct.seated(),
    }));
    note(open.panel === 'ct-loan', `the loan application opened while seated — ${JSON.stringify(open.panel)}`);
    note(open.seated, 'and you are still in the chair while it is up');
    await tap('Escape');
    await waitPainted(p, { frames: 8 });
    const shut = await p.evaluate(() => ({
      panel: window.__hud?.panel?.() ?? null, seated: !!window.__ct.seated(),
    }));
    note(!shut.panel, `[ESC] closed it — panel=${JSON.stringify(shut.panel)}`);
    // NOT ASSERTED, REPORTED: [ESC] also stands you up. That is item 206's
    // subject (two unconditional stand-ups, `ct/hud.ts:1331` the second), it is
    // live with another builder, and asserting it either way here would either
    // fail on a world nobody has fixed yet or freeze behaviour they are about
    // to change.
    console.log(`        [ESC] left you seated=${shut.seated}   (item 206's subject — reported, not asserted)`);
  }
  await p.evaluate(() => window.__ct.stand());
  const up = await here();
  note(!up.seated, 'and you can get back up out of the chair');
}

if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 5).join('\n')}`);
console.log(`\n${fails.length} failing assertion(s)`);
for (const f of fails) console.log(`   ${f}`);
await b.close();
if (fails.length) { console.log('\nFAIL — the chair is not walkable-and-usable'); process.exit(1); }
console.log('\nok — walked in off the street, crossed the hall, sat down and took the loan application');
