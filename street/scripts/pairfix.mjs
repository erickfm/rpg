// How much of the seam pair list is a bounding-box artefact?
//
// A long thin shopfront band has a bbox spanning a whole frontage, so bbox
// adjacency pairs it with things metres from any part of its real geometry.
// Two extra tests, both cheap, both using only what the mesh already carries:
//
//   1. PLANE DISTANCE, not box distance. For a flat face, how far is the other
//      face's nearest point from this face's own plane and inside its extent.
//   2. FACING. Two faces whose normals oppose are back to back and can never be
//      seen together, whatever their distance.
//
// Reports how many pairs survive each, so the shared instrument's signal can be
// separated from its noise.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const F = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if (!m||!m.map||!m.map.image) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    const h = bb.max.y-bb.min.y;
    if (h < 2 || bb.min.y > 4) return;                    // wall-ish only
    const e=o.matrixWorld.elements, L=Math.hypot(e[8],e[9],e[10])||1;
    const ms = m.map.userData && m.map.userData.masonry;
    F.push({ x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z,
      n:[e[8]/L,e[9]/L,e[10]/L], stamped: !!ms,
      c:[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2] });
  });
  const gap1 = (a0,a1,c0,c1) => (a0>c1)?a0-c1:(c0>a1)?c0-a1:0;
  const boxNear = (a,c) => gap1(a.x0,a.x1,c.x0,c.x1) < 0.6 && gap1(a.z0,a.z1,c.z0,c.z1) < 0.6
                        && Math.min(a.y1,c.y1)-Math.max(a.y0,c.y0) > 1.5;
  // true separation between the two boxes in 3D (0 if they overlap)
  const realGap = (a,c) => Math.hypot(gap1(a.x0,a.x1,c.x0,c.x1), gap1(a.z0,a.z1,c.z0,c.z1));
  // how far is c's centre from a's own plane?
  const planeDist = (a,c) => Math.abs((c.c[0]-a.c[0])*a.n[0] + (c.c[2]-a.c[2])*a.n[2]);
  let box=0, opposed=0, farFromPlane=0, survive=0; const kept=[];
  for (let i=0;i<F.length;i++) for (let j=i+1;j<F.length;j++) {
    const a=F[i], c=F[j];
    if (a.stamped === c.stamped) continue;                // declared vs undeclared only
    if (!boxNear(a,c)) continue;
    box++;
    const dot = a.n[0]*c.n[0] + a.n[2]*c.n[2];
    if (dot < -0.5) { opposed++; continue; }
    // the other face must lie near THIS face's plane, or be perpendicular to it
    const perpendicular = Math.abs(dot) < 0.5;
    const pd = Math.min(planeDist(a,c), planeDist(c,a));
    if (!perpendicular && pd > 1.0) { farFromPlane++; continue; }
    survive++; kept.push({ a:a.c.map(v=>+v.toFixed(1)), c:c.c.map(v=>+v.toFixed(1)),
      dot:+dot.toFixed(2), planeDist:+pd.toFixed(2), realGap:+realGap(a,c).toFixed(2) });
  }
  return { faces:F.length, box, opposed, farFromPlane, survive, kept: kept.slice(0,8) };
});
console.log(`${out.faces} wall-ish textured faces\n`);
console.log(`declared-vs-undeclared pairs by BOUNDING BOX adjacency:   ${out.box}`);
console.log(`   dropped — normals opposed, back to back, never seen together:  ${out.opposed}`);
console.log(`   dropped — coplanar test fails, >1.0 m off each other's plane:  ${out.farFromPlane}`);
console.log(`   SURVIVING as real, visible junctions:                          ${out.survive}`);
for (const k of out.kept)
  console.log(`      (${k.a.join(',')}) vs (${k.c.join(',')})  dot ${k.dot}  planeDist ${k.planeDist}  gap ${k.realGap}`);
writeFileSync('shots/pairfix.json', JSON.stringify(out,null,2));
await b.close();
