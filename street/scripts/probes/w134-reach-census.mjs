// HOW BIG IS EVERY INTERACTABLE'S REACH, WORLD-WIDE — item 309's baseline.
//
// The user: *"with the radius for all these things a bit less."* Before choosing
// a number, count what is actually out there: how many spots, what radii, and
// how far apart the neighbours are. A cut that is fine for a door can be
// catastrophic for whatever the tightest pair in the world is, and the only way
// to know which is which is to print them.
//
// Numbers, not an absence: it prints the histogram and the ten tightest pairs.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w134-reach-census.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const K = await p.evaluate(() => ({ TM: window.__ct.touchMargin(), R: window.__ct.playerRadius() }));
const spots = await p.evaluate(() => window.__ct.spots());
console.log(`TOUCH_MARGIN ${K.TM}  RADIUS ${K.R}`);
console.log(`${spots.length} registered spots (ok or not)`);

const hist = new Map();
for (const s of spots) {
  const k = s.r.toFixed(2);
  hist.set(k, (hist.get(k) ?? 0) + 1);
}
console.log('radius histogram:');
for (const k of [...hist.keys()].sort((a, c) => a - c)) {
  console.log(`  r ${k}  x${hist.get(k)}   aim-free disc ${(Number(k) + K.TM).toFixed(2)} m`);
}

const pairs = [];
for (let i = 0; i < spots.length; i++) {
  for (let j = i + 1; j < spots.length; j++) {
    const d = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
    if (d < 1.2) pairs.push({ d, a: spots[i], c: spots[j] });
  }
}
pairs.sort((x, y) => x.d - y.d);
console.log(`${pairs.length} pairs closer than 1.20 m; tightest 15:`);
for (const q of pairs.slice(0, 15)) {
  console.log(`  ${q.d.toFixed(3)} m  "${q.a.label}" (r${q.a.r}) <-> "${q.c.label}" (r${q.c.r})`);
}
await b.close();
