// THE LANE, MEASURED BY WALKING rather than by reading collider boxes.
//
// lane3.mjs asks the collider list how wide the gap is. This asks a different
// question with a different method: flood-fill the pavement at the player's own
// radius and measure the narrowest continuous corridor. If the two agree, the
// 0.89 -> 1.15 m result rests on two independent measurements; if they disagree
// I have a frame or threshold problem in one of them.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD = 0.36, S = 0.05;
  // Drop the movers the way lane3.mjs does: sample the list twice and keep only
  // boxes that did not shift. A citizen standing on the pavement genuinely
  // narrows it, but it is not a property of the built lane.
  const snap = () => window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500)
    .map(c=>({minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ}));
  const a = snap();
  await new Promise(r=>setTimeout(r,1500));
  const bset = new Set(snap().map(c=>`${c.minX.toFixed(2)},${c.minZ.toFixed(2)},${c.maxX.toFixed(2)},${c.maxZ.toFixed(2)}`));
  const cols = a.filter(c=>bset.has(`${c.minX.toFixed(2)},${c.minZ.toFixed(2)},${c.maxX.toFixed(2)},${c.maxZ.toFixed(2)}`));
  const free = (x,z) => !cols.some(c =>
    x > c.minX-RAD && x < c.maxX+RAD && z > c.minZ-RAD && z < c.maxZ+RAD);
  // for each walk, step along it and measure the widest free run across it
  const WALKS = [
    { id:'west walk', cross:'x', lo:-7.4, hi:-4.6, run:'z', from:12, to:-104 },
    { id:'east walk', cross:'x', lo: 4.6, hi: 7.4, run:'z', from:12, to:-94 },
  ];
  const res = [];
  for (const W of WALKS) {
    let worst = 99, worstAt = null;
    for (let v = W.from; v >= W.to; v -= 0.25) {
      // longest contiguous free span across the walk at this station
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) {
        const ok = W.cross === 'x' ? free(c, v) : free(v, c);
        run = ok ? run + S : 0;
        if (run > best) best = run;
      }
      if (best < worst) { worst = best; worstAt = +v.toFixed(2); }
    }
    res.push({ id: W.id, narrowest: +worst.toFixed(2), at: worstAt, clear: +(worst + 2*RAD).toFixed(2) });
  }
  return res;
});
console.log('walked corridor width (flood at RADIUS 0.36, 5 cm resolution):\n');
console.log(`   (static colliders only; movers dropped by double-sampling)\n`);
for (const r of out) console.log(`   ${r.id.padEnd(11)} centre corridor ${r.narrowest} m  ->  clear width ${r.clear} m   at ${r.at}`);
console.log('\nlane3.mjs (collider-gap method) reports the world clears 1.15 m');
await b.close();
