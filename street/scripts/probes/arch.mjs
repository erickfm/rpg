// WHEEL ARCHES, attempt three (H's 6333004c). Graded the way the user asked:
// from the kerb beside a parked car, at STANDING EYE HEIGHT, not a hero angle.
//
// So: camera on the walk at eye level (gy 0.14 -> eye ~1.74 m), looking at the
// car's mid-height from ~3 m. That is a pitch of about -18 degrees -- a person
// standing on the pavement looking at a parked car, which is the only angle the
// question is actually about. No low camera, no upward tilt, no crouch.
//
// Cars are found by shape, not by remembered coordinates. Fresh build, because
// a stale dist has already fooled one probe on this project.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const cars = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse(o => { if(!o.isMesh||!o.geometry) return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.x>400) return;
    boxes.push({x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z}); });
  const it = boxes.filter(q=>q.y0<0.9&&q.y1<2.3&&q.y1>0.6), sn=new Array(it.length).fill(false), out=[];
  const t=(a,c,g)=>a.x0-g<c.x1&&a.x1+g>c.x0&&a.z0-g<c.z1&&a.z1+g>c.z0&&a.y0-g<c.y1&&a.y1+g>c.y0;
  for(let i=0;i<it.length;i++){ if(sn[i])continue; const st=[i],mem=[]; sn[i]=true;
    while(st.length){const k=st.pop();mem.push(it[k]);
      for(let j=0;j<it.length;j++) if(!sn[j]&&t(it[k],it[j],0.35)){sn[j]=true;st.push(j);}}
    out.push({x0:Math.min(...mem.map(q=>q.x0)),x1:Math.max(...mem.map(q=>q.x1)),
      y0:Math.min(...mem.map(q=>q.y0)),y1:Math.max(...mem.map(q=>q.y1)),
      z0:Math.min(...mem.map(q=>q.z0)),z1:Math.max(...mem.map(q=>q.z1))}); }
  return out.map(c=>({...c, w:+(c.x1-c.x0).toFixed(2), d:+(c.z1-c.z0).toFixed(2),
      cx:+((c.x0+c.x1)/2).toFixed(2), cy:+((c.y0+c.y1)/2).toFixed(2), cz:+((c.z0+c.z1)/2).toFixed(2)}))
    .filter(c=>{const a=Math.min(c.w,c.d), l=Math.max(c.w,c.d);
      return a>1.4&&a<2.8&&l>3.2&&l<6.2&&Math.abs(c.cx)<12;});
});
console.log(`${cars.length} street cars found by shape:`);
for (const c of cars) console.log(`   ${c.w}×${c.d} at (${c.cx}, ${c.cz})  body y ${c.y0.toFixed(2)}…${c.y1.toFixed(2)}`);

let i = 0;
for (const c of cars) {
  const onEast = c.cx > 0;
  const camX = onEast ? 5.9 : -5.9;                 // the walk, kerbside
  const r = await p.evaluate(([camX, cz, cx, cy]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
    if (cols.some(q=>camX>q.minX-RAD&&camX<q.maxX+RAD&&cz>q.minZ-RAD&&cz<q.maxZ+RAD)) return {ok:false};
    const eye = 0.14 + 1.6, dist = Math.abs(cx - camX);
    // aim at the WHEEL (top of tyre is 0.663), still standing at eye height --
    // looking down at a wheel from the pavement is not a hero angle, it is what
    // you do. This puts the arch centre-frame where 4-6 cm can actually resolve.
    const pitch = Math.atan2(0.5 - eye, dist);
    window.__ct.warp(camX, cz, Math.atan2(cx-camX, 0), 0.14, pitch);
    return { ok:true, dist:+dist.toFixed(2), pitchDeg:+(pitch*180/Math.PI).toFixed(0), eye };
  }, [camX, c.cz, c.cx, c.cy]);
  if (!r.ok) { console.log(`   MISS car at (${c.cx}, ${c.cz}): kerb point not standable`); continue; }
  await p.waitForTimeout(300);
  const q = await p.evaluate(()=>window.__ct.pos());
  const landed = Math.abs(q[0]-camX)<0.06 && Math.abs(q[2]-c.cz)<0.06;
  await p.screenshot({ path:`shots/archw-${i}.png` });
  console.log(`   ${landed?'shot ':'DRIFT'} archw-${i}  from the ${onEast?'east':'west'} kerb at (${camX}, ${c.cz}), ` +
    `${r.dist} m away, eye ${r.eye.toFixed(2)} m, pitch ${r.pitchDeg}°`);
  i++;
}
await b.close();
