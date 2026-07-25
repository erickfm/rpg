// DOES THE LITTER FLOAT AT NIGHT? Independent check of 0d9146049.
//
// The claim: litter inside LAMP_R takes the lamp pool, the large shared walk
// slab does not (the pool is per MATERIAL, and a big slab takes one value from
// its own origin), so at night a cup reads far brighter than the ground it lies
// on. Measured there as 0.488 against 0.008 — 61x.
//
// Method borrowed from the corrections this session cost: step the clock rather
// than jump it (a jumped night baseline is 3.4x too bright), drop movers by
// double-sampling, and compare each small ground-level object against the
// BROAD SHEET UNDER IT rather than against a global average.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const NIGHT = Number(process.env.NIGHT_H ?? 23);
const JSON_OUT = process.env.JSON_OUT === '1';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);

// step in, an hour at a time
for (let h = NIGHT-8; h <= NIGHT; h++) { await p.evaluate((x)=>window.__ct.clock(x), h); await p.waitForTimeout(700); }
await p.waitForTimeout(3000);

const r = await p.evaluate((SATCUT) => {
  const lum = m => 0.2126*m.color.r + 0.7152*m.color.g + 0.0722*m.color.b;
  const small=[], broad=[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.material||!o.geometry?.parameters) return;
    const g=o.geometry.parameters, w=g.width??0, h=g.height??0, d=g.depth??0;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(Math.abs(v.x)>60 || v.y>0.9 || v.y<-0.1) return;            // street level only
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m?.color) return;
    const area = Math.max(w*h, w*d);
    // EXCLUDE THINGS THAT ARE SUPPOSED TO GLOW. A lamp bulb reading 1.0 at
    // midnight is the feature, not the defect; my first run listed nine of them
    // at the top, all saturated, most in the park lantern cluster.
    // Exclude only what DECLARES itself lit. My first version also excluded
    // anything at lum >= 0.99, which is day-dependent: bright litter saturates
    // in daylight and vanishes from the day pass, so a day-vs-night pairing
    // silently loses exactly the objects the finding is about. Saturation is
    // evidence of emissiveness only against a dark sky.
    const selfLit = !!(o.userData?.selfLit || o.parent?.userData?.selfLit)
      || (SATCUT && lum(m) >= 0.99);
    const rec={x:+v.x.toFixed(2), z:+v.z.toFixed(2), y:+v.y.toFixed(2), lum:+lum(m).toFixed(4),
               area:+area.toFixed(2), selfLit:!!selfLit};
    if(area < 0.6 && v.y < 0.5 && !selfLit) small.push(rec);
    else if(area > 20) broad.push(rec);
  });
  return {small, broad};
}, process.env.NIGHT_H === undefined || Number(process.env.NIGHT_H) >= 20);
await b.close();

// pair each small object with the nearest broad sheet
const rows = r.small.map(s=>{
  const g = r.broad.slice().sort((a,c)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(c.x-s.x,c.z-s.z))[0];
  return g ? {...s, glum:g.lum, ratio: g.lum>0 ? +(s.lum/g.lum).toFixed(1) : Infinity} : null;
}).filter(Boolean).filter(s=>s.lum>0.02).sort((a,c)=>c.ratio-a.ratio);

if (JSON_OUT) { console.log('@@' + JSON.stringify(rows.map(r=>({x:r.x,z:r.z,lum:r.lum,glum:r.glum,ratio:r.ratio})))); process.exit(0); }
console.log(`night hour ${NIGHT}, stepped · ${r.small.length} small ground objects, ${r.broad.length} broad sheets\n`);
console.log('  object lum   ground lum   ratio   position');
for (const s of rows.slice(0,10))
  console.log(`  ${String(s.lum).padStart(10)} ${String(s.glum).padStart(12)} ${String(s.ratio).padStart(7)}x   (${s.x}, ${s.z})`);
console.log(`\nsmall objects more than 10x their own ground: ${rows.filter(s=>s.ratio>10).length}`);
