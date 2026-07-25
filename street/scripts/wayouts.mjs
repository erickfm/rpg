// The last two spots nothing had checked: the bodega's counter purchases.
// spotsplit.mjs narrowed 135 spots to 18 unverified, then to two that no sweep
// I ran covers -- "buy cereal" and "buy soda", inside the bodega.
//
// Spots are read from the live registry, not typed in, so this stays correct if
// the shop is re-priced or re-laid-out.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);   // refuse to measure a build that is not this checkout
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
  const free=(x,z)=>!cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&z>q.minZ-RAD&&z<q.maxZ+RAD);
  // find the buy spots from the registry
  const buys = window.__ct.spots().filter(s => /out to the street/i.test(s.label || ''));
  const res = [];
  for (const s of buys) {
    // sweep the disc: is any point in it standable, and does the prompt fire?
    let standable = 0, fired = 0, firstHit = null;
    for (let a = 0; a < 360; a += 15) {
      for (const frac of [0, 0.4, 0.7, 0.95]) {
        const rad = a*Math.PI/180, x = s.x + Math.sin(rad)*s.r*frac, z = s.z + Math.cos(rad)*s.r*frac;
        if (!free(x, z)) continue;
        standable++;
        window.__ct.warp(x, z, 0, 0.14, 0);
        await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
        const q = window.__ct.pos();
        if (Math.abs(q[0]-x)>0.05 || Math.abs(q[2]-z)>0.05) continue;
        const t = read();
        if (t) { fired++; if (!firstHit) firstHit = { x:+x.toFixed(2), z:+z.toFixed(2), text: t }; }
      }
    }
    res.push({ label: s.label, at:[+s.x.toFixed(2), +s.z.toFixed(2)], r:+s.r.toFixed(2),
      standable, fired, firstHit });
  }
  return res;
});
console.log(`${out.length} "buy" spots found in the live registry\n`);
for (const r of out) {
  console.log(`${r.label}`);
  console.log(`   disc at (${r.at.join(', ')}) r ${r.r}`);
  console.log(`   standable samples: ${r.standable} · prompt fired at: ${r.fired}`);
  console.log(`   ${r.fired ? `reads "${r.firstHit.text}" from (${r.firstHit.x}, ${r.firstHit.z})` : 'NEVER FIRED — unreachable in practice'}`);
}
writeFileSync('shots/wayouts.json', JSON.stringify(out,null,2));
await b.close();
