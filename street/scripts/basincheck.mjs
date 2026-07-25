// SPENT -- basin.mjs reads the published rainAt now (31089b97), so the old-vs-world
// diff this script performs has no subject left. Kept because three notes quote
// its output; it deliberately carries the stale constant and says so below.
// Does basin.mjs's hand-copied rain predicate still pick a rainy hour?
// It duplicates the pre-e0c68e46 formula and comments that scripts "cannot
// import from the TS module" — no longer true: rainAt is published on
// scene.userData. Compare the hour it picks against the world's own schedule.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
const world = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  return typeof f === 'function' ? Array.from({ length: 48 }, (_, h) => !!f(h)) : null;
});
await b.close();
if (!world) { console.error('rainAt not published'); process.exit(2); }
// DELIBERATE COPY, and this comment is why. Every other script carrying
// imul(h, 2246822519) is carrying a stale duplicate that should read
// scene.userData.rainAt instead. This one holds it ON PURPOSE, as the thing
// under test: the script's whole job is to diff the old formula against the
// world's published one. A sweep for the constant will flag this file, and it
// should — an exemption nobody declared looks exactly like a defect.
const stale = (h) => (((h % 24) + 24) % 24) === 14 || ((Math.imul(h, 2246822519) >>> 0) % 100) < 30;
let staleH = 0; for (let h = 0; h < 48; h++) if (stale(h)) { staleH = h; break; }
let realH = world.findIndex(Boolean);
console.log(`basin.mjs picks the first hour its STALE predicate calls rainy:  h=${staleH}`);
console.log(`the world's published rainAt says that hour is:                 ${world[staleH] ? 'RAINY  ✓' : '** DRY — the wet shots are of a dry street **'}`);
console.log(`first genuinely rainy hour per the world:                       h=${realH}`);
let dis = 0; for (let h = 0; h < 48; h++) if (stale(h) !== world[h]) dis++;
console.log(`\nhours 0..47 where the stale copy and the world disagree: ${dis} of 48`);
console.log('stale : ' + Array.from({length:48},(_,h)=>stale(h)?'R':'.').join(''));
console.log('world : ' + world.map(r=>r?'R':'.').join(''));
