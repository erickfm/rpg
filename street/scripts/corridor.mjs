// EVERY mid-walk obstruction, not just the one I stumbled on.
//
// lane3.mjs measures gaps between neighbouring collider faces ALONG the run and
// therefore cannot see something standing in the middle of the pavement. This
// measures the free corridor ACROSS the walk at every station and lists each
// place the player's actual passage drops below 1.00 m, with what forms it.
//
// Movers dropped by double-sampling, so this is the BUILT corridor.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD = 0.36, S = 0.05;
  const snap = () => window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500)
    .map(c=>({minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ}));
  const a = snap(); await new Promise(r=>setTimeout(r,1500));
  const keys = new Set(snap().map(c=>`${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`));
  const cols = a.filter(c=>keys.has(`${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`));
  const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
  const BANDS = [{lo:-6.7,hi:-5.0,id:'west'},{lo:5.0,hi:6.7,id:'east'}];
  const rows = [];
  for (const W of BANDS) for (let v=12; v>=-94; v-=0.25) {
    let best=0, run=0;
    for (let c=W.lo; c<=W.hi; c+=S) { run = free(c,v)?run+S:0; if (run>best) best=run; }
    rows.push({ walk:W.id, z:+v.toFixed(2), clear:+(best+2*RAD).toFixed(2) });
  }
  // group contiguous sub-1.00 m stations into stretches
  const tight = [];
  let cur = null;
  for (const r of rows) {
    if (r.clear < 1.0) {
      if (cur && cur.walk===r.walk && Math.abs(cur.z1 - r.z) <= 0.3) { cur.z1 = r.z; cur.min = Math.min(cur.min, r.clear); }
      else { if (cur) tight.push(cur); cur = { walk:r.walk, z0:r.z, z1:r.z, min:r.clear }; }
    }
  }
  if (cur) tight.push(cur);
  // name the small obstruction in each
  for (const t of tight) {
    const x0 = t.walk==='west' ? -6.7 : 5.0, x1 = t.walk==='west' ? -5.0 : 6.7;
    t.obstacles = cols.filter(c => c.maxX > x0-0.3 && c.minX < x1+0.3
        && c.maxZ > Math.min(t.z0,t.z1)-0.6 && c.minZ < Math.max(t.z0,t.z1)+0.6
        && (c.maxX-c.minX) < 2 && (c.maxZ-c.minZ) < 2)
      .map(c=>`${(c.maxX-c.minX).toFixed(2)}×${(c.maxZ-c.minZ).toFixed(2)} at (${((c.minX+c.maxX)/2).toFixed(2)}, ${((c.minZ+c.maxZ)/2).toFixed(2)})`);
  }
  return { nStations: rows.length, tight, nCols: cols.length };
});
console.log(`${out.nStations} stations scanned across both walks, ${out.nCols} static colliders\n`);
console.log(`stretches where the walking corridor is under 1.00 m: ${out.tight.length}\n`);
for (const t of out.tight.sort((a,c)=>a.min-c.min))
  console.log(`  ${t.walk} walk  z ${t.z0} … ${t.z1}   narrowest ${t.min} m\n      ${t.obstacles.length?t.obstacles.join('\n      '):'(no small collider found — bounded by the building line)'}`);
writeFileSync('shots/corridor.json', JSON.stringify(out,null,2));
await b.close();
