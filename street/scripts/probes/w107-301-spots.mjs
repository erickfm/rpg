// WHAT [E] SPOTS ARE ALREADY IN 301, and where. Item 270 adds one for the
// calendar, and the bed's own comment records what happens when two spots in
// this room sit too close: "door301 pressed E expecting to shut the door and
// got 'sleep until morning' instead". So measure the neighbours first.
//
// Prints. Does not assert.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const s = await p.evaluate(() =>
  window.__ct.spots().filter((q) => q.x > 190 && q.z > -22 && q.z < -12));
for (const q of s) {
  console.log(`x ${q.x.toFixed(3)}  z ${q.z.toFixed(3)}  r ${q.r}  ok=${q.ok}  "${q.label}"`);
}
console.log(`${s.length} spots in the 301 box`);
await b.close();
