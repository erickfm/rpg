#!/usr/bin/env node
// ITEM 178: *"i havent seen a single package outside my neighbors doors?"*
//
// The feature landed while this row was open, and `scripts/packages.mjs` is
// green on it — but that check proves the ground floor and the ARITHMETIC. His
// sentence is about HIS OWN LANDING, floor 3, where 301 is his flat and 302 is
// the neighbour he actually sees. So this walks up there and asks the two
// questions the existing check does not:
//
//   1. does a parcel outside 302 appear, prompt and hand over an item?
//   2. HOW OFTEN would he see one at all — measured over many days, on his
//      landing rather than building-wide?
//
//   SHOT_URL=http://localhost:4202/ node scripts/probes/w64-pkg-landing3.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
mkdirSync('/tmp/w64-pkg', { recursive: true });
let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(900);
const has = await p.evaluate(() => !!window.__ct.scene().userData.packages);
if (!has) { console.error('scene.userData.packages missing — nothing measured'); await b.close(); process.exit(3); }

// ── 1. THE RATE, on his own landing ────────────────────────────────────────
//
// `packages.list()` reports today's roll; stepping the clock a day at a time
// and reading it back samples the real hash rather than re-implementing it.
const RATE_DAYS = 120;
const rate = await p.evaluate(async (DAYS) => {
  const ud = window.__ct.scene().userData.packages;
  ud.force(null);                                   // the honest roll
  const mine = [], all = [];
  for (let d = 0; d < DAYS; d++) {
    window.__ct.clock(12, 0);
    window.__ct.advanceClock(1440 * d, 0);          // jump d whole days
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const list = ud.list();
    all.push(list.filter((q) => q.present).length);
    mine.push(list.filter((q) => q.present && q.floor === 2).length);
  }
  return { mine, all };
}, RATE_DAYS);
const daysAnyMine = rate.mine.filter((n) => n > 0).length;
const daysAnyAll = rate.all.filter((n) => n > 0).length;
const totMine = rate.mine.reduce((a, c) => a + c, 0);
console.log(`\n  over ${RATE_DAYS} days:`);
console.log(`    building-wide  ${rate.all.reduce((a, c) => a + c, 0)} parcels, on ${daysAnyAll} of ${RATE_DAYS} days (${(100 * daysAnyAll / RATE_DAYS).toFixed(0)}%)`);
console.log(`    HIS LANDING    ${totMine} parcels, on ${daysAnyMine} of ${RATE_DAYS} days (${(100 * daysAnyMine / RATE_DAYS).toFixed(0)}%)`);
// longest run of days with nothing outside 301/302
let run = 0, worst = 0;
for (const n of rate.mine) { run = n ? 0 : run + 1; worst = Math.max(worst, run); }
console.log(`    longest stretch with nothing outside 301 or 302: ${worst} days\n`);

// ── 2. WALK IT, with the roll forced on ────────────────────────────────────
await p.evaluate(() => { window.__ct.scene().userData.packages.force(true); window.__ct.clock(12, 0); });
await p.waitForTimeout(500);
const land3 = await p.evaluate(() => {
  const l = window.__ct.scene().userData.packages.list().filter((q) => q.floor === 2);
  return l.map((q) => ({ num: q.num, present: q.present, x: q.x, z: q.z, side: q.side }));
});
console.log(`  floor-3 parcels: ${JSON.stringify(land3)}`);
ok(land3.length === 2 && land3.every((q) => q.present), 'both floor-3 doors carry a parcel when the roll is forced');

const target = land3.find((q) => q.num === '302') ?? land3[0];
// STAND ON THE LANDING. gy is the floor height the picker reports; floor 3 is
// index 2, and the walk-up's storey height comes from the world, not from here.
const stand = await p.evaluate(async (t) => {
  // approach from inside the landing, a little back from the parcel
  const gy = 2 * 2.7;
  window.__ct.warp(t.x - 0.9, t.z, Math.PI / 2, gy);
  await new Promise((r) => setTimeout(r, 400));
  return window.__ct.pos();
}, target);
console.log(`  standing at ${JSON.stringify(stand)}`);

const prompt = await p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '') : '';
});
ok(/steal .*package/.test(prompt), `the landing offers it: "${prompt.trim() || '(nothing)'}"`);
await p.screenshot({ path: '/tmp/w64-pkg/landing3.png' });

const before = await p.evaluate(() => JSON.stringify(window.__ct.purse?.() ?? null));
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  const l = window.__ct.scene().userData.packages.list().find((q) => q.floor === 2 && q.present === false);
  const note = document.getElementById('ct-note');
  return { gone: !!l, note: note ? (note.textContent ?? '') : '' };
});
ok(after.gone, 'pressing [E] on his own landing takes the parcel off it');
ok(/—/.test(after.note), `and the HUD says what was in it: "${after.note.trim()}"`);
void before;
await p.screenshot({ path: '/tmp/w64-pkg/landing3-after.png' });

// FEET STILL WORK — the landing is 2.6 m deep and the parcel carries a collider
const p0 = await p.evaluate(() => window.__ct.pos());
await p.keyboard.down('s'); await p.waitForTimeout(500); await p.keyboard.up('s');
const p1 = await p.evaluate(() => window.__ct.pos());
const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
ok(moved > 0.3, `the landing still walks after taking it — ${moved.toFixed(2)} m backwards`);

ok(errs.length === 0, `no page errors (${errs.length})`);
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : '\n  floor 3 works.\n');
process.exit(bad ? 1 : 0);
