// Is there a kerb RAMP anywhere at this crossing? One profile line said STEP,
// and one line is how I nearly filed the library stair as a sheer cliff — it
// runs in the other axis. So scan the whole corner region and report WHERE the
// intermediate heights are, rather than asking one line.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const [X0,X1,Z0,Z1]=(process.env.BOX??'49,59,-112,-94').split(',').map(Number);
const r=await p.evaluate(([X0,X1,Z0,Z1])=>{ const S=0.15, cells=[];
  for(let x=X0;x<=X1;x+=S) for(let z=Z0;z<=Z1;z+=S){
    const g=window.__ct.groundAt(x,z);
    if(g>0.02&&g<0.125) cells.push([+x.toFixed(2),+z.toFixed(2),+g.toFixed(3)]); }
  let n=0; for(let x=X0;x<=X1;x+=S) for(let z=Z0;z<=Z1;z+=S) n++;
  return {cells,n}; },[X0,X1,Z0,Z1]);
console.log(`\nscanned ${r.n} cells at 0.15 m over x ${X0}..${X1}, z ${Z0}..${Z1}`);
console.log(`cells at an INTERMEDIATE height (0.02 < g < 0.125), i.e. on a ramp face: ${r.cells.length}`);
if(r.cells.length){
  const xs=r.cells.map(c=>c[0]), zs=r.cells.map(c=>c[1]), gs=r.cells.map(c=>c[2]);
  console.log(`  they span x ${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)}, z ${Math.min(...zs).toFixed(2)}..${Math.max(...zs).toFixed(2)}`);
  console.log(`  heights ${Math.min(...gs).toFixed(3)}..${Math.max(...gs).toFixed(3)}, distinct ${new Set(gs.map(g=>g.toFixed(3))).size}`);
  // cluster by z band so two corners show as two clusters
  const byz={}; for(const c of r.cells){ const k=Math.round(c[1]); byz[k]=(byz[k]||0)+1; }
  const bands=Object.entries(byz).sort((a,b)=>b[1]-a[1]).slice(0,8);
  console.log(`  busiest z bands: ${bands.map(([z,n])=>`z${z}:${n}`).join('  ')}`);
} else console.log('  none — the kerb goes 0 to 0.140 with nothing between, anywhere in this box.');
await b.close();
