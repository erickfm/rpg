// "im literally stuck here. i think we need some sort of stuck protection or
//  something smarter around collision and blocking"
//
// Sweep the WHOLE world for places a player can be but cannot leave. The player
// is a disc of radius 0.36, so its CENTRE must stay clear of every collider
// inflated by 0.36. Two faults matter:
//   TRAP CELL  - standable ground whose centre is inside an inflated collider:
//                you can be pushed/land there and then cannot move.
//   POCKET     - a passable region not connected to the rest of the world.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const R=0.36, STEP=0.4;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(([R,STEP])=>{
 const cols=window.__ct.colliders();
 const X0=-42,X1=58,Z0=-116,Z1=22;
 const W=Math.round((X1-X0)/STEP), H=Math.round((Z1-Z0)/STEP);
 const xOf=i=>X0+i*STEP, zOf=j=>Z0+j*STEP;
 const ground=new Uint8Array(W*H), pass=new Uint8Array(W*H);
 for(let j=0;j<H;j++) for(let i=0;i<W;i++){
  const x=xOf(i), z=zOf(j);
  const g=window.__ct.groundAt(x,z);
  if(!(g>-0.5&&g<3.0)) continue;                       // somewhere you could stand
  let raw=false, inf=false;
  for(const c of cols){
   if(x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ){raw=true;break;}
   if(x>c.minX-R&&x<c.maxX+R&&z>c.minZ-R&&z<c.maxZ+R) inf=true;
  }
  if(raw) continue;                                     // inside solid, not a floor
  ground[j*W+i]=1;
  if(!inf) pass[j*W+i]=1;
 }
 // flood fill the passable space from the street outside the bodega
 const si=Math.round((0-X0)/STEP), sj=Math.round((-20-Z0)/STEP);
 const comp=new Int32Array(W*H).fill(-1);
 let ncomp=0; const sizes=[];
 for(let s=0;s<W*H;s++){
  if(!pass[s]||comp[s]>=0) continue;
  const id=ncomp++; let n=0; const st=[s]; comp[s]=id;
  while(st.length){ const q=st.pop(); n++;
   const qi=q%W, qj=(q-qi)/W;
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const ni=qi+di, nj=qj+dj; if(ni<0||nj<0||ni>=W||nj>=H) continue;
    const t=nj*W+ni; if(pass[t]&&comp[t]<0){comp[t]=id;st.push(t);} } }
  sizes.push({id,n});
 }
 const mainId=comp[sj*W+si];
 sizes.sort((a,b)=>b.n-a.n);
 // trap cells: standable but the player centre cannot legally be there
 const traps=[];
 for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){
  const s=j*W+i; if(!ground[s]||pass[s]) continue;
  // only interesting if it is NOT simply the fringe against a wall:
  // count passable cells within 2 steps - a real trap has none nearby
  let near=0;
  for(let dj=-2;dj<=2;dj++) for(let di=-2;di<=2;di++){
   const t=(j+dj)*W+(i+di); if(t>=0&&t<W*H&&pass[t]) near++; }
  if(near===0) traps.push({x:+xOf(i).toFixed(1), z:+zOf(j).toFixed(1)});
 }
 const pockets=sizes.filter(c=>c.id!==mainId&&c.n>=2).map(c=>{
  let ex=0,ez=0,n=0;
  for(let s=0;s<W*H;s++) if(comp[s]===c.id){ const i=s%W,j=(s-i)/W; ex+=xOf(i); ez+=zOf(j); n++; }
  return {cells:c.n, area:+(c.n*STEP*STEP).toFixed(1), x:+(ex/n).toFixed(1), z:+(ez/n).toFixed(1)};});
 return {W,H,ground:ground.reduce((a,v)=>a+v,0),pass:pass.reduce((a,v)=>a+v,0),
   mainSize:sizes.find(c=>c.id===mainId)?.n||0, ncomp, pockets, traps, step:STEP};},[R,STEP]);
console.log(`grid ${r.W} x ${r.H} at ${r.step} m   standable cells ${r.ground}   player-passable ${r.pass}`);
console.log(`connected regions: ${r.ncomp}   largest (the world) ${r.mainSize} cells = ${(r.mainSize*r.step*r.step).toFixed(0)} m2\n`);
console.log(`POCKETS — passable but cut off from the world: ${r.pockets.length}`);
for(const q of r.pockets.slice(0,14)) console.log(`   ${String(q.area).padStart(6)} m2 at (${q.x}, ${q.z})  ${q.cells} cells`);
console.log(`\nTRAP CELLS — standable ground with no passable cell within 0.8 m: ${r.traps.length}`);
const seen=[];
for(const t of r.traps){ if(seen.some(s=>Math.hypot(s.x-t.x,s.z-t.z)<2.5)) continue; seen.push(t); }
for(const t of seen.slice(0,16)) console.log(`   (${t.x}, ${t.z})`);
console.log(`   (${seen.length} distinct locations after clustering)`);
await b.close();
