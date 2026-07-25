// THE CAR LOT, as a player meets it: can you walk in, is the office at the
// back, are there rows either side. Reachability is a flood fill from spawn over
// the collider array the movement code tests -- a warp can put you inside a
// building, walking cannot.
//
// Nothing here is a remembered coordinate: the lot is found as the reachable
// region east of the shopfront line that contains cars, and the cars are found
// by shape.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 780 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);

const R = await p.evaluate(() => {
  const RAD = 0.36, S = 0.5, X0 = -60, X1 = 70, Z0 = 16, Z1 = -150;
  const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
  const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
  const nx=Math.round((X1-X0)/S), nz=Math.round((Z0-Z1)/S);
  const ix=x=>Math.round((x-X0)/S), iz=z=>Math.round((Z0-z)/S);
  const ok=new Uint8Array(nx*nz);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++) if(free(X0+i*S,Z0-j*S)) ok[j*nx+i]=1;
  const q0=window.__ct.pos(); const si=ix(q0[0]), sj=iz(q0[2]);
  const seen=new Uint8Array(nx*nz); const st=[[si,sj]]; seen[sj*nx+si]=1;
  while(st.length){const [i,j]=st.pop();
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,c=j+dj;
      if(a<0||c<0||a>=nx||c>=nz)continue; const k=c*nx+a;
      if(ok[k]&&!seen[k]){seen[k]=1;st.push([a,c]);}}}
  const at=(x,z)=>{const i=ix(x),j=iz(z); return (i<0||j<0||i>=nx||j>=nz)?null:!!seen[j*nx+i];};

  // cars by shape
  const boxes=[]; const s=window.__ct.scene(); s.updateMatrixWorld(true);
  s.traverse(o=>{ if(!o.isMesh||!o.geometry)return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.x>400)return;
    boxes.push({x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z});});
  const cl=(sel,gap)=>{const it=boxes.filter(sel),sn=new Array(it.length).fill(false),out=[];
    const t=(a,c)=>a.x0-gap<c.x1&&a.x1+gap>c.x0&&a.z0-gap<c.z1&&a.z1+gap>c.z0&&a.y0-gap<c.y1&&a.y1+gap>c.y0;
    for(let i=0;i<it.length;i++){if(sn[i])continue;const stk=[i],mem=[];sn[i]=true;
      while(stk.length){const k=stk.pop();mem.push(it[k]);
        for(let j=0;j<it.length;j++) if(!sn[j]&&t(it[k],it[j])){sn[j]=true;stk.push(j);}}
      out.push({x0:Math.min(...mem.map(q=>q.x0)),x1:Math.max(...mem.map(q=>q.x1)),
        y1:Math.max(...mem.map(q=>q.y1)),z0:Math.min(...mem.map(q=>q.z0)),z1:Math.max(...mem.map(q=>q.z1))});}
    return out.map(c=>({...c,w:+(c.x1-c.x0).toFixed(2),d:+(c.z1-c.z0).toFixed(2),
      cx:+((c.x0+c.x1)/2).toFixed(2),cz:+((c.z0+c.z1)/2).toFixed(2)}));};
  const cars=cl(q=>q.y0<0.9&&q.y1<2.3&&q.y1>0.6,0.35).filter(c=>{
    const a=Math.min(c.w,c.d),bl=Math.max(c.w,c.d);
    return a>1.4&&a<2.8&&bl>3.2&&bl<6.2;});
  // the lot = reachable cells within 14 m of a car that is east of the shopfronts
  const lotCars=cars.filter(c=>c.cx>7.2);
  const cells=[];
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){ if(!seen[j*nx+i])continue;
    const x=X0+i*S,z=Z0-j*S; if(x<7.2)continue;
    if(lotCars.some(c=>Math.abs(x-c.cx)<16&&Math.abs(z-c.cz)<16)) cells.push([x,z]); }
  const xs=cells.map(q=>q[0]), zs=cells.map(q=>q[1]);
  return { spawn:[q0[0],q0[2]], nCars:cars.length, lotCars,
    lot: cells.length?{n:cells.length, areaM2:+(cells.length*S*S).toFixed(0),
      x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.max(...zs),z1:Math.min(...zs)}:{n:0},
    beside: lotCars.map(c=>({ car:[c.cx,c.cz],
      north: at(c.cx, c.cz+3), south: at(c.cx, c.cz-3), east: at(c.cx+3, c.cz), west: at(c.cx-3, c.cz) })) };
});
console.log(`${R.nCars} cars in the world; ${R.lotCars.length} east of the shopfront line`);
for (const c of R.lotCars) console.log(`   car ${c.w}×${c.d} at (${c.cx}, ${c.cz})`);
console.log(R.lot.n ? `\nLOT reachable on foot: ${R.lot.areaM2} m² · x ${R.lot.x0} … ${R.lot.x1} · z ${R.lot.z0} … ${R.lot.z1}`
                    : '\nLOT: NO reachable ground near any car east of the shopfronts');
console.log('\ncan you stand beside each car (3 m out)?');
for (const q of R.beside) console.log(`   (${q.car.join(', ')})  N ${q.north?'y':'n'}  S ${q.south?'y':'n'}  E ${q.east?'y':'n'}  W ${q.west?'y':'n'}`);
writeFileSync('shots/lot.json', JSON.stringify(R,null,2));
await b.close();
