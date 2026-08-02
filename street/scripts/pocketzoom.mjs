// A 0.4 m grid can close a real gate. Re-test each pocket locally at 0.1 m
// before claiming anyone is trapped.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const R=0.36;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const spots=[[8.6,-73.6],[8.6,-83.0],[-38.2,-81.4],[57.6,-114.2]];
const r=await p.evaluate(([spots,R])=>{
 const cols=window.__ct.colliders(); const out=[];
 for(const [cx,cz] of spots){
  const S=0.1, HALF=14;
  const W=Math.round(2*HALF/S), H=W;
  const xOf=i=>cx-HALF+i*S, zOf=j=>cz-HALF+j*S;
  const pass=new Uint8Array(W*H);
  for(let j=0;j<H;j++) for(let i=0;i<W;i++){
   const x=xOf(i), z=zOf(j); const g=window.__ct.groundAt(x,z);
   if(!(g>-0.5&&g<3.0)) continue;
   let inf=false;
   for(const c of cols) if(x>c.minX-R&&x<c.maxX+R&&z>c.minZ-R&&z<c.maxZ+R){inf=true;break;}
   if(!inf) pass[j*W+i]=1;
  }
  // flood from the pocket centre; does it reach the edge of this window?
  const si=Math.round(HALF/S), sj=si;
  let start=sj*W+si;
  if(!pass[start]){ // nudge to the nearest passable cell
   let best=-1,bd=1e9;
   for(let s=0;s<W*H;s++) if(pass[s]){ const i=s%W,j=(s-i)/W;
    const d=Math.hypot(i-si,j-sj); if(d<bd){bd=d;best=s;} }
   start=best; }
  if(start<0){ out.push({cx,cz,verdict:'no passable ground at all within 14 m'}); continue; }
  const seen=new Uint8Array(W*H); const st=[start]; seen[start]=1; let n=0, touchedEdge=false;
  while(st.length){ const q=st.pop(); n++; const qi=q%W, qj=(q-qi)/W;
   if(qi<=1||qj<=1||qi>=W-2||qj>=H-2) touchedEdge=true;
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const ni=qi+di, nj=qj+dj; if(ni<0||nj<0||ni>=W||nj>=H) continue;
    const t=nj*W+ni; if(pass[t]&&!seen[t]){seen[t]=1;st.push(t);} } }
  out.push({cx,cz,cells:n,area:+(n*S*S).toFixed(1),escapes:touchedEdge});
 }
 return out;},[spots,R]);
for(const q of r){
 if(q.verdict){ console.log(`  (${q.cx}, ${q.cz}): ${q.verdict}`); continue; }
 console.log(`  (${q.cx}, ${q.cz}) at 0.1 m: region ${q.area} m2  reaches beyond 14 m: ${q.escapes ? 'YES — not a pocket, the coarse grid closed a real gap' : 'NO — genuinely enclosed'}`);
}
await b.close();
