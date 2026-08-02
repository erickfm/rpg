// RECONCILE. I reported the lived lane's worst clear width as 0.72 m; mainline's
// 81603988 reports "tightest real gap 1.24 m". Same property, different numbers.
//
// The suspect is my band. I scanned x 4.6…7.4 — 2.8 m, which reaches below the
// kerb (5.0) and past the facade collider (6.7). Re-run with the band clipped
// to the actual pavement and compare.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD = 0.36, S = 0.05;
  const BANDS = {
    'mine (4.6…7.4)':      [{lo:-7.4, hi:-4.6},{lo:4.6, hi:7.4}],
    'pavement (5.0…6.7)':  [{lo:-6.7, hi:-5.0},{lo:5.0, hi:6.7}],
  };
  const narrowest = (bands) => {
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
    let worst = 99, at = null;
    for (const W of bands) {
      for (let v = 12; v >= -94; v -= 0.5) {
        let best = 0, run = 0;
        for (let c = W.lo; c <= W.hi; c += S) { run = free(c, v) ? run + S : 0; if (run > best) best = run; }
        if (best < worst) { worst = best; at = +v.toFixed(1); }
      }
    }
    return { centre:+worst.toFixed(2), clear:+(worst + 2*RAD).toFixed(2), at };
  };
  const res = {};
  for (const [name, bands] of Object.entries(BANDS)) {
    const s = [];
    for (let i=0;i<10;i++) { s.push(narrowest(bands)); await new Promise(r=>setTimeout(r,700)); }
    const cl = s.map(q=>q.clear).sort((a,c)=>a-c);
    res[name] = { worst: cl[0], median: cl[Math.floor(cl.length/2)], best: cl[cl.length-1] };
  }
  return res;
});
console.log('band                    worst   median    best   (clear width, 10 samples)');
for (const [k,v] of Object.entries(out))
  console.log(`${k.padEnd(22)} ${String(v.worst).padStart(5)}   ${String(v.median).padStart(6)}  ${String(v.best).padStart(6)}`);
console.log('\nmainline 81603988 reports: 0 of 1196 sealed, tightest real gap 1.24 m');
await b.close();
