#!/usr/bin/env node
// ITEM 208: THE MOUSE STILL LANDS ON THE BUTTONS AFTER THEY WERE REDRAWN.
//
// Item 208 rebuilt the button deck's artwork — bezels, raised caps, a red SPIN.
// `ct/slots.ts` already guards against a button drawn where a click does not
// land by having the painter and `deckAt` read one `DECK` declaration, and that
// declaration was not touched. But "the structure says it cannot have moved" is
// the argument every silently-broken thing in this project had, so this drives
// the REAL mouse against the REAL diegetic surface and watches the machine.
//
// There was no pointer check for the slots at all before this. There is one now.
//
//   SHOT_URL=http://localhost:4290/ node scripts/probes/w73-slot-buttons-click.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${what}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const seat = await p.evaluate(() => {
  const s = window.__ct.seats().filter((x) => x.label === 'sit at the slot');
  return s[Math.floor(s.length / 2)];
});
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos?.().gy ?? 0, 0), seat);
await p.waitForTimeout(400);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await p.waitForFunction(() => window.__hud?.panel() === 'ct-slots', { timeout: 10000 });
await p.evaluate(() => window.__slots.insert(60));
await p.waitForTimeout(300);

// THE HAND CURSOR IS THE ONLY THING THE PAGE PUBLISHES ABOUT HIT-TESTING, and
// it is the right thing to read: `ct/hud.ts:779` sets it from
// `spec.surface.hot(x, y)`, which for this panel is `hotAt`, which is `deckAt`
// plus `billAt`. So a hand on screen means the click WILL be dispatched from
// this pixel — it is the same question, asked of the same function.
const isHand = () => p.evaluate(() => /pointer/.test(document.body.style.cursor || ''));

// THE STRIDE HAS TO BE SHORTER THAN THE GAP, NOT THAN THE BUTTON.
//
// The first version of this swept at 6 px and reported ONE merged hot run where
// there are four buttons — and it was the probe that was wrong, twice over.
// `DECK` leaves 4 canvas px between caps (84->88, 150->154, 230->234), the face
// lands at about 1:1 from the stool, and a 6 px stride steps straight over a
// 4 px dead strip. The clustering then merged anything within 12 px, which is
// wider than the gap it was supposed to find. GOTCHAS 48, in a probe written by
// somebody who had just read GOTCHAS 48.
//
// So: find the button band first, then walk it a pixel at a time.
const SPIN_X = 550;                                // roughly the middle of the face
const rows = [];
for (let y = 380; y <= 600; y += 3) {
  await p.mouse.move(SPIN_X, y);
  if (await isHand()) rows.push(y);
}
check(rows.length > 4, `the deck has hot rows at all (${rows.length})`);
// two bands: the bill acceptor above, the buttons below. Take the lower one.
const bands = [];
for (const y of rows) {
  const last = bands[bands.length - 1];
  if (last && y - last[last.length - 1] <= 4) last.push(y); else bands.push([y]);
}
const band = bands[bands.length - 1] ?? [];
const rowY = band.length ? band[Math.floor(band.length / 2)] : 500;
console.log(`\n  ${bands.length} hot bands down the face`
  + ` (${bands.map((bd) => `${bd[0]}..${bd[bd.length - 1]}`).join(', ')});`
  + ` sweeping the lowest at y ${rowY}\n`);
check(bands.length === 2, `two hot bands — the bill acceptor and the button deck`
  + ` (${bands.length})`);

const hot = [];
for (let x = 340; x <= 760; x += 1) {
  await p.mouse.move(x, rowY);
  if (await isHand()) hot.push([x, rowY]);
}
console.log(`  ${hot.length} hot pixels across the button row\n`);
check(hot.length > 20, `the sweep FOUND something (${hot.length} hot points) —`
  + ' at zero every verdict below is free, so this is the population floor');

// Contiguous runs only: a single missing pixel starts a new button. The dead
// strips between caps are 4 px, so anything looser cannot see them.
const xs = [...new Set(hot.map(([x]) => x))].sort((a, c) => a - c);
const groups = [];
for (const x of xs) {
  const last = groups[groups.length - 1];
  if (last && x - last[last.length - 1] <= 1) last.push(x); else groups.push([x]);
}
console.log(`  ${groups.length} separate hot runs across the button row:`
  + ` ${groups.map((gr) => `${gr[0]}..${gr[gr.length - 1]}`).join('  ')}\n`);
check(groups.length === 4, `four buttons, four separate hot runs (${groups.length})`
  + ' — DECK has four entries and a run that merged would mean two caps share one target');

const centre = (gr) => [(gr[0] + gr[gr.length - 1]) / 2, rowY - 8];
const view = () => p.evaluate(() => window.__slots.view());

// LEFTMOST IS BET ONE — verified by what it DOES, not by where it is.
if (groups.length === 4) {
  const before = await view();
  const [bx, by] = centre(groups[0]);
  await p.mouse.move(bx, by); await p.mouse.click(bx, by);
  await p.waitForTimeout(250);
  const after = await view();
  check(after.bet !== before.bet,
    `clicking the leftmost cap changes the stake (${before.bet} -> ${after.bet})`
    + ' — the painted button and the hit-test still agree after the redraw');

  // THIRD FROM THE LEFT IS SPIN, and a spinning machine is unambiguous.
  const [sx, sy] = centre(groups[2]);
  await p.mouse.move(sx, sy); await p.mouse.click(sx, sy);
  await p.waitForTimeout(200);
  const spun = await view();
  check(spun.state === 'spinning' || spun.credits < after.credits,
    `clicking the third cap SPINS it (state ${spun.state},`
    + ` credits ${after.credits} -> ${spun.credits})`);
  await p.waitForFunction(() => window.__slots.view().state === 'idle', { timeout: 12000 });
}

// AND A DEAD PIXEL IS DEAD. A check that only ever sees hands cannot tell a
// working hit-test from one that returns true everywhere.
await p.mouse.move(550, 200);
check(!(await isHand()), 'the reel glass is NOT clickable — `hot` says no somewhere,'
  + ' so the sweep above was reading a real answer rather than a stuck one');

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);
console.log(bad === 0 ? '\n  buttons: all checks pass.\n' : `\n  buttons: ${bad} FAILED.\n`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
