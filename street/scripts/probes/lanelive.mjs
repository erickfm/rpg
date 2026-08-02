// THE LANE AS PLAYED, not as built. Every lane figure in my report drops the
// movers, so they all describe the pavement with nobody on it. But a citizen
// standing on the narrowest stretch takes the clear width from 1.15 m to
// 0.77 m — 5 cm more than the player is wide.
//
// So: how often is it actually like that? Sample the live collider list over
// time and report the distribution of the world's narrowest passage.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD = 0.36, S = 0.05;
  const WALKS = [
    { cross:'x', lo:-7.4, hi:-4.6, from:12, to:-104 },
    { cross:'x', lo: 4.6, hi: 7.4, from:12, to:-94 },
  ];
  const narrowest = () => {
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free = (x,z) => !cols.some(c =>
      x > c.minX-RAD && x < c.maxX+RAD && z > c.minZ-RAD && z < c.maxZ+RAD);
    let worst = 99, at = null;
    for (const W of WALKS) {
      for (let v = W.from; v >= W.to; v -= 0.5) {
        let best = 0, run = 0;
        for (let c = W.lo; c <= W.hi; c += S) {
          run = free(c, v) ? run + S : 0;
          if (run > best) best = run;
        }
        if (best < worst) { worst = best; at = +v.toFixed(1); }
      }
    }
    return { centre: +worst.toFixed(2), clear: +(worst + 2*RAD).toFixed(2), at };
  };
  const samples = [];
  for (let i = 0; i < 20; i++) {
    samples.push(narrowest());
    await new Promise(r => setTimeout(r, 900));
  }
  return samples;
});
const clears = out.map(s=>s.clear).sort((a,b2)=>a-b2);
const pct = q => clears[Math.min(clears.length-1, Math.floor(q*clears.length))];
console.log(`${out.length} samples of the world's narrowest pavement passage, ~18 s\n`);
console.log(`   best   ${clears[clears.length-1]} m`);
console.log(`   median ${pct(0.5)} m`);
console.log(`   worst  ${clears[0]} m   (capsule is 0.72 m)`);
const blocked = clears.filter(c => c < 0.72).length;
const tight  = clears.filter(c => c < 0.90).length;
console.log(`\n   samples under 0.90 m: ${tight} of ${out.length}`);
console.log(`   samples under 0.72 m — physically impassable: ${blocked} of ${out.length}`);
console.log(`\n   built lane with movers dropped: 1.15 m`);
await b.close();
