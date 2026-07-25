// WHY can the library-courtyard bench not be sat on? seats-walk reports one
// standable point in its whole disc and no prompt there. Name what is in the
// way, so this is routable rather than a symptom.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const SX = -8.65, SZ = -20.38, RAD = 0.36;
  const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
  const near = cols.filter(c => SX > c.minX-2.5 && SX < c.maxX+2.5 && SZ > c.minZ-2.5 && SZ < c.maxZ+2.5)
    .map(c => ({ x:[+c.minX.toFixed(2),+c.maxX.toFixed(2)], z:[+c.minZ.toFixed(2),+c.maxZ.toFixed(2)],
                 w:+(c.maxX-c.minX).toFixed(2), d:+(c.maxZ-c.minZ).toFixed(2) }));
  // the seat spots at this bench, from the registry
  const spots = window.__ct.spots().filter(s => Math.hypot(s.x-SX, s.z-SZ) < 2.5)
    .map(s => ({ label:s.label, x:+s.x.toFixed(2), z:+s.z.toFixed(2), r:+s.r.toFixed(2), ok:s.ok }));
  // map standability across the bench's surroundings
  const free=(x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
  const grid=[];
  for (let x=SX-2.0; x<=SX+2.0; x+=0.25) {
    let row='';
    for (let z=SZ-2.0; z<=SZ+2.0; z+=0.25) row += free(x,z) ? '.' : '#';
    grid.push(`   x ${x.toFixed(2).padStart(6)}  ${row}`);
  }
  return { near, spots, grid };
});
console.log(`colliders within 2.5 m of the bench (-8.65, -20.38): ${out.near.length}`);
for (const c of out.near) console.log(`   ${c.w}×${c.d}   x ${c.x[0]} … ${c.x[1]}   z ${c.z[0]} … ${c.z[1]}`);
console.log(`\nregistered spots within 2.5 m:`);
for (const s of out.spots) console.log(`   "${s.label}"  at (${s.x}, ${s.z}) r ${s.r}  ok=${s.ok}`);
console.log(`\nstandability, . = free, # = inside a collider   (z runs -22.4 → -18.4 left to right)`);
for (const row of out.grid) console.log(row);
await b.close();
