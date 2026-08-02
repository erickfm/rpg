// DOES THE WORLD STILL WORK WHEN IT IS POPULATED?
//
// Every check in the suite drops the moving colliders, so all of them describe
// an empty street. The lane does differ when populated -- 1.15 m built, 0.77 m
// median lived. So does anything BREAK when people are in the way?
//
// Flood-fill from spawn WITH the movers in, several times, and see whether any
// destination stops being reachable.
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
  const RAD = 0.36, S = 0.5, X0 = -60, X1 = 70, Z0 = 16, Z1 = -150;
  const nx = Math.round((X1-X0)/S), nz = Math.round((Z0-Z1)/S);
  const ix = x => Math.round((x-X0)/S), iz = z => Math.round((Z0-z)/S);
  const PROBES = {
    'park far corner': [-38,-98], 'library courtyard': [-10.5,-13],
    'church yard': [2,-108], 'car lot mid': [16,2.5],
    'side street east': [50,-97.3], 'east walk far': [6,-92],
    'west walk far': [-6,-92],
  };
  const run = () => {
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
    const ok = new Uint8Array(nx*nz);
    for (let i=0;i<nx;i++) for (let j=0;j<nz;j++) if (free(X0+i*S, Z0-j*S)) ok[j*nx+i]=1;
    const q0 = window.__ct.pos();
    const si=ix(q0[0]), sj=iz(q0[2]);
    const seen = new Uint8Array(nx*nz); const st=[[si,sj]]; seen[sj*nx+si]=1; let n=0;
    while (st.length) { const [i,j]=st.pop(); n++;
      for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const a=i+di,c=j+dj; if(a<0||c<0||a>=nx||c>=nz)continue;
        const k=c*nx+a; if(ok[k]&&!seen[k]){seen[k]=1;st.push([a,c]);} } }
    const at = (x,z)=>{const i=ix(x),j=iz(z);return (i<0||j<0||i>=nx||j>=nz)?false:!!seen[j*nx+i];};
    const res = { cells:n };
    for (const [k,[x,z]] of Object.entries(PROBES)) res[k] = at(x,z);
    return res;
  };
  const runs = [];
  for (let i=0;i<4;i++) { runs.push(run()); await new Promise(r=>setTimeout(r,1200)); }
  return runs;
});
const keys = Object.keys(out[0]).filter(k=>k!=='cells');
console.log(`4 flood fills with the movers INCLUDED\n`);
console.log(`reachable cells: ${out.map(r=>r.cells).join(', ')}`);
console.log(`\ndestination            ${out.map((_,i)=>'r'+(i+1)).join('  ')}`);
let broke = 0;
for (const k of keys) {
  const vals = out.map(r=>r[k]);
  if (vals.some(v=>!v)) broke++;
  console.log(`${k.padEnd(22)} ${vals.map(v=>v?' y':' N').join('  ')}${vals.some(v=>!v)?'   ** LOST **':''}`);
}
console.log(`\n${broke ? broke+' destination(s) became unreachable at some sample' : 'every destination reachable in every sample, with people in the way'}`);
await b.close();
