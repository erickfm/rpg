// CAN YOU STILL GET IN WHEN THE STREET IS BUSY?
//
// spots-walk and my own door checks run against a static world. The lane does
// change when populated -- 1.15 m built, 0.72 m at its worst lived -- so the
// question for the doors is whether a citizen can stand where you need to and
// keep you out.
//
// For each door spot, sample over time WITH the movers in and ask: is there
// still at least one standable point inside the trigger?
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const RAD = 0.36;
  const doors = window.__ct.spots().filter(s => /^into /i.test(s.label||'') && s.x < 400)
    .map(s => ({ label:s.label, x:s.x, z:s.z, r:s.r }));
  const sample = () => {
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free = (x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
    return doors.map(d => {
      let n = 0;
      for (let a=0; a<360; a+=15) for (const f of [0,0.35,0.65,0.9]) {
        const rad=a*Math.PI/180;
        if (free(d.x+Math.sin(rad)*d.r*f, d.z+Math.cos(rad)*d.r*f)) n++;
      }
      return n;
    });
  };
  const runs = [];
  for (let i=0;i<8;i++) { runs.push(sample()); await new Promise(r=>setTimeout(r,1000)); }
  return { doors: doors.map(d=>d.label), runs };
});
console.log(`8 samples over ~8 s, movers included — standable points inside each door trigger\n`);
console.log(`door                       min  max   ever zero?`);
let bad = 0;
out.doors.forEach((label, i) => {
  const vals = out.runs.map(r => r[i]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === 0) bad++;
  console.log(`${label.padEnd(26)} ${String(lo).padStart(3)}  ${String(hi).padStart(3)}   ${lo===0?'** YES — blocked **':'no'}`);
});
console.log(`\n${bad ? bad+' door(s) fully blocked at some sample' : 'no door was ever fully blocked by a citizen'}`);
await b.close();
