// ONE QUESTION: is there anywhere in THIS tree a player can stand that is not a
// floor — specifically, on a car?
//
// Queue item 46 is about a player stuck on a CAB ROOF, "the first place in the
// world a player can stand that is not a floor". Before reporting that the
// feature is not in this checkout, stand on a car and look, rather than concluding
// it from a grep (BUILDER-BRIEF §7: the source is the answer, but standing in the
// world is better than either when the claim is about standing).
//
// Method: take a parked car's own collider, drop the player onto its middle from
// above, let it settle, and read the ground height back. If a roof is standable
// the picker puts you on it; if it is not, you end up at street level.
//
//   SHOT_URL=http://localhost:4184/ node scripts/probes/w19-can-you-stand-on-a-car.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(900);

const out = await p.evaluate(async () => {
  // MOVERS ARE NOT SCENERY: the traffic pool parks its boxes off-world and
  // shuffles them, so keep only boxes that held still across a beat.
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 400)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const first = snap();
  await new Promise((r) => setTimeout(r, 1200));
  const still = new Set(snap().map(key));
  const cols = first.filter((c) => still.has(key(c)));

  // A parked car is roughly car-sized: 1.5-2.4 m across, 3.5-6 m long.
  const cars = cols.filter((c) => {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    const [s, l] = w < d ? [w, d] : [d, w];
    return s > 1.4 && s < 2.6 && l > 3.2 && l < 6.5;
  });
  const tried = [];
  for (const c of cars.slice(0, 6)) {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    tried.push({ cx: +cx.toFixed(2), cz: +cz.toFixed(2), groundAt: +window.__ct.groundAt(cx, cz).toFixed(3) });
  }
  return { colliders: cols.length, carLike: cars.length, tried };
});

console.log(`${out.colliders} still colliders, ${out.carLike} of them car-sized`);
for (const t of out.tried) console.log(`  car at (${t.cx}, ${t.cz})  groundAt over its middle: ${t.groundAt}`);

// And actually stand there: warp onto the first one and read back where the
// world put us.
if (out.tried.length) {
  const { cx, cz } = out.tried[0];
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [cx, cz]);
  await p.waitForTimeout(900);
  const q = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(3)));
  console.log(`\nstood on it: pos (${q[0]}, ${q[2]}) at storey ${q[3]}, eye y ${q[1]}`);
  console.log(q[3] > 0.5
    ? '  RAISED — something in this tree IS standable above the street.'
    : '  NOT RAISED — the player is at street level. No standable vehicle surface here.');
}
await b.close();
