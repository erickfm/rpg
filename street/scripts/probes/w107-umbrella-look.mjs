// LOOK AT THE HAND. Item 278, and the row is explicit that this is judged by
// looking, in rain, from a normal walking distance.
//
// A DAYLIGHT wet hour, not merely the first wet one. `w107-umbrella-hand.mjs`
// scans from midnight and finds hour 0, which is a real wet hour and a useless
// frame: 35% of it is black and nothing about an arm is judgeable in it. So
// this searches 8…18 only, and REFUSES to report if it cannot find one rather
// than photographing the dark and calling it evidence.
//
// Distances are item 271's: 1.6 m is the diagnostic, 4 m is what he walks past.
// Warping out of apartment 301 first is not optional — `updateRain` gates on
// `px < 100` and the spawn is at x = 198 (GOTCHAS §79b).
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
const TAG = process.env.TAG ?? 'after';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 760 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await waitPainted(p, { frames: 10 });

let hour = -1;
for (let h = 8; h <= 18 && hour < 0; h++) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  for (let t = 0; t < 12 && hour < 0; t++) {
    await waitPainted(p, { frames: 8 });
    if (await p.evaluate(() => window.__ct.walkers().some((q) => q.umb > 0.95))) hour = h;
  }
}
if (hour < 0) { console.log('REFUSING TO REPORT: no wet DAYLIGHT hour found'); await b.close(); process.exit(3); }
console.log(`wet daylight hour ${hour}`);

// THREE WALKERS, not one, and the backdrop is why. The first frame this took
// put its walker square in front of the library's dark doorway — a dark blue
// arm on dark brown stone, which is item 271's own "two dark silhouettes fuse"
// fault happening to the CHECK instead of to the world. Nothing is wrong with
// that frame; it just cannot answer the question. So shoot several and judge
// the one with something behind it.
for (const [D, WHICH] of [[2.5, 0], [2.5, 1], [2.5, 2], [4, 0]]) {
  const aimed = await p.evaluate(([d, which]) => {
    const ws = window.__ct.walkers().filter((q) => q.umb > 0.95 && q.holding);
    if (!ws.length || which >= ws.length) return null;
    const w = ws[which];
    // out toward the ROAD, so the shopfront is the backdrop rather than the
    // camera being inside a wall; pitch DERIVED from the distance so the hand
    // is centred at every range rather than one angle reused
    const sx = w.x > 0 ? w.x - d : w.x + d;
    window.__ct.warp(sx, w.z, w.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0, Math.atan2(0.30, d));
    return { x: +w.x.toFixed(2), z: +w.z.toFixed(2), holding: w.holding };
  }, [D, WHICH]);
  if (!aimed) { console.log(`  no holding walker #${WHICH} at ${D} m`); continue; }
  await waitPainted(p, { frames: 6 });
  const path = `shots/w107-umb-${TAG}-${D}m-${WHICH}.png`;
  const buf = await p.screenshot({ path });
  console.log(`  ${path}  walker (${aimed.x}, ${aimed.z}) holding=${aimed.holding}  black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);
}
await b.close();
