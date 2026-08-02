// WHERE IS THE BODEGA'S [E]? Three independent probes have singled this shop
// out: it has a canted bay, it has no entry in __frontages, and its prompt does
// not fire anywhere on the x = ±5.9 line that every other door fires on.
//
// So sweep a 2D patch of pavement instead of a line, and map the trigger.
// Visibility-checked prompt read, lifted from doorsweep.mjs.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
  const free=(x,z)=>!cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&z>q.minZ-RAD&&z<q.maxZ+RAD);
  const hits=[]; let walked=0, blocked=0;
  for (let x=4.8; x<=9.4; x+=0.2) for (let z=-91.5; z>=-100.5; z-=0.2) {
    if (!free(x,z)) { blocked++; continue; }
    window.__ct.warp(x,z,Math.PI/2,0.14,0);
    await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>requestAnimationFrame(r));
    const q=window.__ct.pos();
    if (Math.abs(q[0]-x)>0.05||Math.abs(q[2]-z)>0.05) continue;
    walked++;
    const s=read(); if (s) hits.push({x:+x.toFixed(1),z:+z.toFixed(1),s});
  }
  return { walked, blocked, hits };
});
console.log(`swept x 4.8…9.4 × z −91.5…−100.5 at 0.2 m: ${res.walked} standable points, ${res.blocked} inside colliders`);
const by={};
for(const h of res.hits) (by[h.s] ??= []).push(h);
for (const [prompt, hs] of Object.entries(by)) {
  const xs=hs.map(h=>h.x), zs=hs.map(h=>h.z);
  console.log(`\n${prompt}  — ${hs.length} points`);
  console.log(`   x ${Math.min(...xs)} … ${Math.max(...xs)}   z ${Math.min(...zs)} … ${Math.max(...zs)}`);
  console.log(`   nearest the walk line (x=5.9): x ${Math.min(...xs.map(v=>Math.abs(v-5.9))).toFixed(1)} m away`);
}
if (!res.hits.length) console.log('\nNO prompt fired anywhere in the patch.');
writeFileSync('shots/bodega.json', JSON.stringify(res,null,2));
await b.close();
