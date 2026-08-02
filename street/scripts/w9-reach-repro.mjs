// REPRO for QUEUE item 0b: "the radius for interaction is far too wide. i
// dont want to be so far from the bed and the option is still to sit on the
// bed and watch tv" — and the desk's own framing: "a door you are standing
// in should beat furniture across the room regardless of margins."
//
// The queue row's literal claim (fp.ts:463 adds REACH_MARGIN=0.6 to every
// spot, live to 1.3 m) is STALE: commit b1707b600 (26 Jul) already replaced
// the aim-free proximity margin with TOUCH_MARGIN=0.15 for exactly this
// reason. REACH_MARGIN is dead in the actual near-test now (only the debug
// ring at fp.ts:680 still reads it). So part (a) of the item is ALREADY DONE.
//
// This script isolates part (b): standing right at the door's own stand
// spot (d ~ 0, well inside touch range), but FACING the bed across the room
// — does the door still win, or does the bed (which is aimed-at) steal it?
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4188/');

const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});

const info = await page.evaluate(() => {
  const spots = window.__ct.spots();
  const door = spots.find((s) => s.label === 'close the door' || s.label === 'open the door');
  const bed = spots.find((s) => s.label === 'sit on the bed and watch TV');
  return {
    door: door ? { x: door.x, z: door.z, r: door.r, label: door.label } : null,
    bed: bed ? { x: bed.x, z: bed.z, r: bed.r, label: bed.label } : null,
  };
});
console.log('door spot:', info.door);
console.log('bed  spot:', info.bed);
if (!info.door || !info.bed) { console.log('FAIL: could not find both spots — labels moved?'); process.exit(1); }

const gy = await page.evaluate((x) => window.__ct.groundAt ? window.__ct.groundAt(x.dx, x.dz) : null,
  { dx: info.door.x, dz: info.door.z });

// stand essentially ON the door's own stand-point (d << TOUCH_MARGIN), facing
// the bed's coordinate — this is the "in the doorway, looking into the room"
// pose the queue row describes.
const yawToBed = Math.atan2(info.bed.x - info.door.x, -(info.bed.z - info.door.z));
await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
  [info.door.x, info.door.z, yawToBed, gy]);
await page.waitForTimeout(300);

const seen = await prompt();
const d = Math.hypot(info.door.x - info.door.x, info.door.z - info.door.z); // 0 by construction
console.log(`\nstanding AT the door's own stand-point (d=0.00 m from it, inside its r=${info.door.r}),`);
console.log(`facing the bed (r=${info.bed.r}) across the room.`);
console.log(`prompt reads: "${seen}"`);

const wantDoor = `[E] ${info.door.label}`;
const gotBed = seen.includes('bed') || seen.includes('TV');
if (seen === wantDoor) {
  console.log('\nPASS: the door you are standing in wins, as it should.');
} else if (gotBed) {
  console.log('\nFAIL (reproduced): standing exactly at the door, the BED wins instead, because');
  console.log('  it is aimed-at and the door (touching, but off-axis behind you) is not — the');
  console.log('  resolver key `offAxis + d*0.02` does not actually give touching candidates');
  console.log('  priority over merely-looked ones, contradicting its own comment.');
  process.exit(1);
} else {
  console.log(`\nFAIL: neither door nor bed — got "${seen}". Investigate.`);
  process.exit(1);
}
await b.close();
