// AXIS-FREE, CORNER-SAFE. Compare where each [E] fires against the declared
// door POINT in world space, not against a frontage scalar.
//
// Two of my checks in a row compared a z against an x, and the bodega -- a
// chamfered corner whose door normal is (-0.707,-0.707) -- cannot be expressed
// on either axis. __ct.doors() publishes {x, z, nx, nz} per building, so a 2D
// distance answers every case with no axis convention to get wrong.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const walked = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const LINES = [
    { kind:'z', fixed:-6.30, from:14, to:-108 }, { kind:'z', fixed:6.30, from:14, to:-96 },
    { kind:'x', fixed:-97.3, from:8, to:56 },    { kind:'x', fixed:-108.7, from:-6, to:56 },
  ];
  const acc = new Map();
  for (const L of LINES) {
    const step = L.from > L.to ? -0.5 : 0.5;
    for (let v = L.from; step<0 ? v>=L.to : v<=L.to; v += step) {
      const x = L.kind==='z' ? L.fixed : v, z = L.kind==='z' ? v : L.fixed;
      window.__ct.warp(x, z, 0, 0.14, 0);
      await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
      const s = read(); if (!s) continue;
      const a = acc.get(s) ?? { sx:0, sz:0, n:0 };
      a.sx += x; a.sz += z; a.n++; acc.set(s, a);
    }
  }
  return [...acc].map(([prompt,a]) => ({ prompt, x:+(a.sx/a.n).toFixed(2), z:+(a.sz/a.n).toFixed(2), n:a.n }));
});
const doors = await p.evaluate(() => (window.__ct.doors?window.__ct.doors():[]).map(d=>({
  b:d.building, x:d.point.x, z:d.point.z, nx:d.point.nx, nz:d.point.nz, chamfer:d.chamfer,
  sx:d.stand.x, sz:d.stand.z })));
console.log(`${walked.length} walked prompts · ${doors.length} declared doors\n`);
console.log('prompt                        walked centroid    nearest declared door      dist   chamfer');
const rows = [];
for (const w of walked) {
  let best=null, bd=1e9;
  for (const d of doors) { const dist=Math.hypot(w.x-d.sx, w.z-d.sz); if (dist<bd) { bd=dist; best=d; } }
  if (!best) continue;
  rows.push({ ...w, door:best.b, dist:+bd.toFixed(2), chamfer:best.chamfer });
  console.log(`${w.prompt.padEnd(29)} (${String(w.x).padStart(7)},${String(w.z).padStart(8)})   ` +
    `${best.b.padEnd(14)} (${best.sx.toFixed(1)},${best.sz.toFixed(1)})  ${String(bd.toFixed(2)).padStart(6)}   ${best.chamfer?'yes':''}`);
}
const named = rows.filter(r => r.prompt.toUpperCase().includes(r.door.toUpperCase().split(' ')[0]));
console.log(`\n${named.filter(r=>r.dist<=1.5).length} of ${named.length} name-matched prompts sit within 1.5 m of their own declared door`);
writeFileSync('shots/doorpoint.json', JSON.stringify({walked,doors,rows},null,2));
await b.close();
