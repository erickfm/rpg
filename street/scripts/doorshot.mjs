// Stand at the exact centre of each [E] prompt span, face the facade, shoot.
// If the prompt is on its door, the door is in the middle of the frame.
//
// This is the check that works regardless of whether a door is a separate leaf
// or painted into the shopfront glazing -- and only 2 of 7 are separate leaves,
// so leaf geometry cannot answer it.
import { chromium } from 'playwright';
const PROMPTS = [
  ['bodega',  'east', -96.00, -94.75], ['pawn',    'east', -61.50, -59.50],
  ['no227',   'east', -45.00, -43.00], ['tax',     'east', -21.00, -19.25],
  ['thrift',  'west', -60.25, -58.50], ['diner',   'west', -47.50, -45.75],
  ['burger',  'west', -26.00, -24.25],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const [name, line, z0, z1] of PROMPTS) {
  const zc = (z0 + z1) / 2, x = line === 'east' ? 5.9 : -5.9;
  const yaw = line === 'east' ? Math.PI / 2 : -Math.PI / 2;   // face the facade
  const r = await p.evaluate(([x, zc, yaw]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    if (cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&zc>c.minZ-RAD&&zc<c.maxZ+RAD)) return {ok:false};
    window.__ct.warp(x, zc, yaw, 0.14, 0.06); return {ok:true};
  }, [x, zc, yaw]);
  if (!r.ok) { console.log(`   MISS ${name}: prompt centre is not standable`); continue; }
  await p.waitForTimeout(260);
  const q = await p.evaluate(()=>window.__ct.pos());
  const ok = Math.abs(q[0]-x)<0.06 && Math.abs(q[2]-zc)<0.06;
  await p.screenshot({ path: `shots/dr-${name}.png` });
  console.log(`   ${ok?'shot ':'DRIFT'} dr-${name}  at (${x}, ${zc.toFixed(2)}) facing the ${line} facade`);
}
await b.close();
