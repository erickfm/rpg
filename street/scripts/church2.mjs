// The church is NOT in the south. street.ts:810 -- "The church stands on the
// main block now" -- and placeChurchEast puts it on the east frontage. Every
// scan I ran was of an empty block, which is why 12,260 walked points found no
// rise. Walk the east frontage strip instead.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD=0.36, cols=window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
  const free=(x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
  const hits=[]; let n=0;
  for (let x=6.5; x<=14.5; x+=0.5) for (let z=2; z>=-100; z-=0.5) {
    if (!free(x,z)) continue;
    window.__ct.warp(x,z,0,0.14,0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const q=window.__ct.pos();
    if (Math.abs(q[0]-x)>0.05||Math.abs(q[2]-z)>0.05) continue;
    n++; if (q[3]>0.20) hits.push([+x.toFixed(1),+z.toFixed(1),+q[3].toFixed(2)]);
  }
  return { n, hits };
});
console.log(`east frontage x 6.5…14.5, z 2…-100: ${out.n} free points walked, ${out.hits.length} raised`);
const cs=[];
for (const [x,z,gy] of out.hits) {
  const c=cs.find(k=>Math.abs(k.cx-x)<4&&Math.abs(k.cz-z)<4);
  if(c){c.n++;c.x0=Math.min(c.x0,x);c.x1=Math.max(c.x1,x);c.z0=Math.min(c.z0,z);c.z1=Math.max(c.z1,z);
    c.lo=Math.min(c.lo,gy);c.hi=Math.max(c.hi,gy);c.cx=(c.x0+c.x1)/2;c.cz=(c.z0+c.z1)/2;}
  else cs.push({cx:x,cz:z,n:1,x0:x,x1:x,z0:z,z1:z,lo:gy,hi:gy});
}
for (const c of cs.sort((a,d)=>d.n-a.n))
  console.log(`   x ${c.x0} … ${c.x1}   z ${c.z0} … ${c.z1}   gy ${c.lo} … ${c.hi}   (${c.n} pts)`);
writeFileSync('shots/church2.json', JSON.stringify(out,null,2));
await b.close();
