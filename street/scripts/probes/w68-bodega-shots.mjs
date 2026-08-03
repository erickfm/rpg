// Item 177 — LOOK AT THE CORNER THE USER PHOTOGRAPHED.
//
// The clip sweep and the walk are the proof; this is the looking. His shot was
// *"at the counter end"* with the deli case and the coffee bench visibly inside
// each other, so the first frame stands where he stood: just inside the cut
// door, facing the front-left corner.
//
// Yaw convention is DERIVED, not assumed: measured in w68-yawcheck.mjs, yaw 0
// walks -z, so forward = (sin y, -cos y) and facing a target is atan2(dx, -dz).
// Getting this wrong is what walked five earlier routes into a wall.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = aim('http://localhost:4240/');
const OUT = process.argv[2] ?? '/tmp/w68-bodega';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);

const room = await p.evaluate(() => (window.__ct.roomDims?.() ?? []).find((q) => /bodega/i.test(q.id ?? '')));
const W = (lx, lz) => [room.cx + lx, room.cz + lz];
const face = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

const shots = [
  // where he stood: through the cut door, looking into the front-left corner
  ['his-view', 2.6, 4.5, -3.3, 4.2],
  // square on the L: the case and the bench, from the shop side
  ['the-L', -1.6, 2.2, -3.3, 4.4],
  // straight down the left aisle, the one that could not be entered
  ['left-aisle', -1.77, 5.4, -1.77, -4.0],
  // and the middle aisle, unchanged, as a control
  ['mid-aisle', 0.0, 5.4, 0.0, -4.0],
];
for (const [name, lx, lz, tx, tz] of shots) {
  const [wx, wz] = W(lx, lz);
  const [ttx, ttz] = W(tx, tz);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [wx, wz, face(wx, wz, ttx, ttz)]);
  await p.waitForTimeout(600);
  await waitPainted(p);
  const buf = await p.screenshot({ path: `${OUT}-${name}.png` });
  const black = await blackFraction(p, buf);
  console.log(`${name}: local (${lx}, ${lz}) -> (${tx}, ${tz})   black ${(black * 100).toFixed(1)} %`);
  if (black > 0.9) console.log('   ⚠ that frame is essentially black — do not read anything off it');
}
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 5)) console.log('  ', e);
console.log(`shots at ${OUT}-*.png`);
await b.close();
