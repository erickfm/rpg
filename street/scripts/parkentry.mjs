// Why can park.mjs no longer find the gate entry path?
// Its locator wants a PlaneGeometry at y = 0.1445 +- 0.02 whose +x edge touches
// site.maxX. The park just gained topography (8ff5ecb8), so relax each criterion
// in turn and see which one is doing the excluding.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);
const r = await p.evaluate(()=>{
  const sc = window.__ct.scene();
  const cands=[];
  sc.traverse(o=>{
    const g=o.geometry?.parameters;
    if(!o.isMesh||!g||o.geometry.type!=='PlaneGeometry') return;
    if(!g.width||!g.height||g.width>4||g.height>4) return;
    cands.push({x:+o.position.x.toFixed(2), y:+o.position.y.toFixed(4), z:+o.position.z.toFixed(2),
                w:+g.width.toFixed(2), h:+g.height.toFixed(2)});
  });
  return cands;
});
// the bounds park.mjs itself derives from the park's own ground plane
const SITE = { minX:-39, maxX:-7, minZ:-98, maxZ:-68 };
await b.close();
const atY = r.filter(c=>Math.abs(c.y-0.1445)<0.02);
console.log(`small PlaneGeometry meshes in the world: ${r.length}`);
console.log(`  of those at y = 0.1445 +- 0.02 (what the locator demands): ${atY.length}`);
const ys = [...new Set(r.map(c=>c.y))].sort((a,b)=>a-b);
console.log(`\n  distinct y values among the candidates (first 12):`);
console.log('   ' + ys.slice(0,12).join('  '));
// use the park's real bounds, read from the world rather than guessed
const park = r.filter(c=>c.x>=SITE.minX-1 && c.x<=SITE.maxX+1 && c.z>=SITE.minZ-1 && c.z<=SITE.maxZ+1)
              .sort((a,b)=>b.x-a.x).slice(0,10);
console.log(`\n  park site: x ${SITE.minX}…${SITE.maxX}  z ${SITE.minZ}…${SITE.maxZ}`);
console.log(`\n  candidates in the park quadrant, highest x first:`);
for(const c of park) console.log(`    x ${String(c.x).padStart(7)}  y ${String(c.y).padStart(7)}  z ${String(c.z).padStart(7)}   ${c.w}x${c.h}` +
  `   +x edge ${(c.x + c.w/2).toFixed(2)}  ${Math.abs(c.x + c.w/2 - SITE.maxX) <= 0.35 ? '← TOUCHES street edge' : ''}` +
  `${Math.abs(c.y-0.1445)<0.02 ? '' : '   [y excludes it]'}`);
