// The four rooms with no __frontages entry are not actually unmeasurable: the
// building's own collider has a facade, and the door sits on it. Derive the
// exterior width for all ten so the interior/exterior table is complete.
// Also a POSITIVE CONTROL for the swallow detector, since it found nothing.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const cols=window.__ct.colliders(), doors=window.__ct.doors(), dims=window.__ct.roomDims();
 const inside=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
 // POSITIVE CONTROL: the centre of the biggest collider must read as inside.
 const big=[...cols].sort((a,c)=>((c.maxX-c.minX)*(c.maxZ-c.minZ))-((a.maxX-a.minX)*(a.maxZ-a.minZ)))[0];
 const ctrl={x:+((big.minX+big.maxX)/2).toFixed(1), z:+((big.minZ+big.maxZ)/2).toFixed(1),
   detected: inside((big.minX+big.maxX)/2,(big.minZ+big.maxZ)/2),
   size:`${(big.maxX-big.minX).toFixed(1)} x ${(big.maxZ-big.minZ).toFixed(1)}`};
 const rows=[];
 for(const d of doors){
  const px=d.point.x, pz=d.point.z, nx=d.point.nx, nz=d.point.nz;
  // the building is the collider just INSIDE the door, along -normal
  const ix=px-nx*0.35, iz=pz-nz*0.35;
  let host=null, ha=0;
  for(const c of cols){ if(ix>c.minX&&ix<c.maxX&&iz>c.minZ&&iz<c.maxZ){
   const a=(c.maxX-c.minX)*(c.maxZ-c.minZ); if(a>ha){ha=a;host=c;} }}
  const tangentIsZ = Math.abs(nx)>Math.abs(nz);      // facade normal along x -> facade runs in z
  rows.push({b:d.building, host:!!host,
   facade: host? +(tangentIsZ ? host.maxZ-host.minZ : host.maxX-host.minX).toFixed(2) : null,
   depth:  host? +(tangentIsZ ? host.maxX-host.minX : host.maxZ-host.minZ).toFixed(2) : null});}
 return {ctrl, rows, dims};});
console.log(`POSITIVE CONTROL — biggest collider (${r.ctrl.size} m) centre (${r.ctrl.x}, ${r.ctrl.z}) reads inside: ${r.ctrl.detected}`);
if(!r.ctrl.detected){console.error('  ** the swallow detector cannot see a point inside the largest box in the world. 0 of 10 means nothing.');process.exit(3);}
console.log('  so "0 doors swallowed" is a measurement, not a blind pass\n');
const front={'BURGER BARN':16,'DINER':12,'THRIFT':12.5,'A-1 TAX':13,'PAWN':15,'BODEGA':6.05};
const idOf={'BURGER BARN':'burger','DINER':'diner','THRIFT':'thrift','A-1 TAX':'tax','PAWN':'pawn','BODEGA':'bodega',
 'GOLDEN ACES':'casino','ST BRIGID':'church','HOTEL ORPHEUS':'hotel','LIBRARY':'library'};
console.log('building         room w   published   DERIVED facade   building depth   room d   ratio(room/facade)');
for(const o of r.rows){
 const id=idOf[o.b]; const d=r.dims.find(q=>q.id===id); if(!d) {console.log(`${o.b.padEnd(15)} (no room)`); continue;}
 const pub=front[o.b]; const ratio=o.facade?(d.w/o.facade):null;
 console.log(`${o.b.padEnd(15)} ${String(d.w).padStart(6)} ${String(pub??'—').padStart(11)} ${String(o.facade??'?').padStart(16)} ${String(o.depth??'?').padStart(16)} ${String(d.d).padStart(8)}   ${ratio?ratio.toFixed(2):'?'}${pub===undefined?'   <- had NO frontage':''}`);
}
await b.close();
