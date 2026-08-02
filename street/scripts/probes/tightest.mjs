// WHERE is the narrowest passage? I reported the lived lane's worst clear width
// as 0.72 m and never said where, which makes it unroutable. Locate it, and name
// what forms it.
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
  const BANDS = [{lo:-6.7, hi:-5.0, id:'west'},{lo:5.0, hi:6.7, id:'east'}];
  const scan = () => {
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
    const rows = [];
    for (const W of BANDS) for (let v=12; v>=-94; v-=0.5) {
      let best=0, run=0;
      for (let c=W.lo; c<=W.hi; c+=S) { run = free(c,v) ? run+S : 0; if (run>best) best=run; }
      rows.push({ walk:W.id, z:+v.toFixed(1), clear:+(best+2*RAD).toFixed(2) });
    }
    rows.sort((a,c)=>a.clear-c.clear);
    // name what bounds the tightest station
    const t = rows[0];
    const x0 = t.walk==='west' ? -6.7 : 5.0, x1 = t.walk==='west' ? -5.0 : 6.7;
    const near = cols.filter(c => c.maxX > x0-1 && c.minX < x1+1 && c.maxZ > t.z-0.8 && c.minZ < t.z+0.8)
      .map(c=>({ x:[+c.minX.toFixed(2),+c.maxX.toFixed(2)], z:[+c.minZ.toFixed(2),+c.maxZ.toFixed(2)],
                 w:+(c.maxX-c.minX).toFixed(2), d:+(c.maxZ-c.minZ).toFixed(2) }));
    return { tightest: rows.slice(0,6), near };
  };
  const a = scan();
  await new Promise(r=>setTimeout(r,1500));
  const b2 = scan();
  return { a, b2 };
});
console.log('tightest stations, sample 1:');
for (const r of out.a.tightest) console.log(`   ${r.walk} walk  z ${String(r.z).padStart(7)}   clear ${r.clear} m`);
console.log('\nwhat bounds the tightest one:');
for (const c of out.a.near) console.log(`   ${c.w}×${c.d}   x ${c.x[0]} … ${c.x[1]}   z ${c.z[0]} … ${c.z[1]}`);
console.log('\nsample 2 tightest:', out.b2.tightest.slice(0,3).map(r=>`${r.walk} z${r.z} ${r.clear}`).join(' · '));
await b.close();
