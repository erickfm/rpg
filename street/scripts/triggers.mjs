// HOW FAR FROM THE WALK LINE DOES EACH DOOR'S TRIGGER START?
//
// I claimed the bodega is the only shop you must step toward. That rested on a
// LINE sweep finding the other seven -- which shows they reach x = ±5.9, not
// where their nearest edge is. Like-for-like means measuring every door the way
// the bodega was measured: a patch, not a line.
//
// Doors are found by walking first (no coordinate typed in), then each one's
// own z span is swept across the full pavement depth.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
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
  const probe = async (x,z) => {
    if(!free(x,z)) return null;
    window.__ct.warp(x,z,x>0?Math.PI/2:-Math.PI/2,0.14,0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const q=window.__ct.pos();
    if(Math.abs(q[0]-x)>0.05||Math.abs(q[2]-z)>0.05) return null;
    return read();
  };
  // 1. find the doors by walking the two centrelines
  const found = new Map();
  for (const [lx, z0, z1] of [[-5.9, 10, -104], [5.9, 10, -100]]) {
    for (let z=z0; z>=z1; z-=0.5) {
      const s = await probe(lx, z);
      if (!s) continue;
      const r = found.get(s) ?? { x: lx, lo: z, hi: z, axis: 'z' };
      r.lo=Math.min(r.lo,z); r.hi=Math.max(r.hi,z); found.set(s, r);
    }
  }
  // the SIDE STREET runs along x, so its walk line is a z. Two more doors live
  // there (doorsweep finds HOTEL ORPHEUS and GOLDEN ACES) and a census that
  // stops at the main block is not a census.
  const probeSide = async (x,z) => {
    if(!free(x,z)) return null;
    window.__ct.warp(x,z,Math.PI,0.14,0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const q=window.__ct.pos();
    if(Math.abs(q[0]-x)>0.05||Math.abs(q[2]-z)>0.05) return null;
    return read();
  };
  for (let x=8; x<=60; x+=0.5) {
    const s = await probeSide(x, -97.3);
    if (!s) continue;
    const r = found.get(s) ?? { z: -97.3, lo: x, hi: x, axis: 'x' };
    r.lo=Math.min(r.lo,x); r.hi=Math.max(r.hi,x); found.set(s, r);
  }
  // 2. plus the bodega, which the centreline cannot see -- find it off-line
  for (let z=-92; z>=-100; z-=0.5) {
    const s = await probe(7.4, z);
    if (!s) continue;
    const r = found.get(s) ?? { x: 7.4, lo: z, hi: z };
    r.lo=Math.min(r.lo,z); r.hi=Math.max(r.hi,z); found.set(s, r);
  }
  // 3. for each, sweep the full pavement depth over its own z span
  const res = [];
  for (const [prompt, r] of found) {
    if (r.axis === 'x') {                       // side street: sweep across z
      let nearest=null, pts=0;
      for (let step=0; step<=22; step++) {
        const z = -97.3 - step*0.2;
        for (let x=r.lo-1.5; x<=r.hi+1.5; x+=0.25) {
          const s = await probeSide(x, z);
          if (s !== prompt) continue;
          pts++; const d = Math.abs(z) - 95.4;
          if (nearest===null || d<nearest) nearest=d;
        }
      }
      res.push({ prompt, side:'side st', span:[+r.lo.toFixed(1),+r.hi.toFixed(1)], pts,
        nearestOffWalk: nearest===null?null:+nearest.toFixed(2) });
      continue;
    }
    const east = r.x > 0;
    let nearest = null, pts = 0;
    for (let step=0; step<=22; step++) {
      const x = east ? 4.9 + step*0.2 : -4.9 - step*0.2;
      for (let z=r.hi+1.5; z>=r.lo-1.5; z-=0.25) {
        const s = await probe(x, z);
        if (s !== prompt) continue;
        pts++;
        const d = Math.abs(x) - 5.9;
        if (nearest === null || d < nearest) nearest = d;
      }
    }
    res.push({ prompt, side: east?'east':'west', span:[+r.lo.toFixed(1),+r.hi.toFixed(1)], pts,
      nearestOffWalk: nearest === null ? null : +nearest.toFixed(2) });
  }
  return res;
});
console.log('door                            side   trigger points   nearest edge relative to the walk line (x=±5.9)');
for (const r of out.sort((a,c)=>(a.nearestOffWalk??9)-(c.nearestOffWalk??9)))
  console.log(`${r.prompt.padEnd(31)} ${r.side.padEnd(6)} ${String(r.pts).padStart(5)}          ` +
    (r.nearestOffWalk === null ? 'never fired' :
     r.nearestOffWalk <= 0 ? `reaches the line (${r.nearestOffWalk} m)` : `**${r.nearestOffWalk} m BEYOND it**`));
writeFileSync('shots/triggers.json', JSON.stringify(out,null,2));
await b.close();
