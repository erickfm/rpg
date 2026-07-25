// Every seat in the world: is it OFFERED, and can you actually WALK to it?
//
// `ctx.seat()` registering is not the same as the seat working. The library's
// benches registered fine and could never be sat on, and the car lot's first
// pair of chairs registered fine while standing inside a solid box — GOTCHAS
// §8, an [E] trigger buried in a collider. Both look identical from the code.
//
// So this checks the two things the code cannot tell you: that the approach
// point is not inside any collider, and that pressing E from it actually puts
// you in the seat. Warp reaches places you cannot walk to, so `inSolid` is the
// half of the answer the seating itself will never report.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/seatcheck.mjs [x0 x1 z0 z1]
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.mouse.click(640, 360); await p.waitForTimeout(500);

const seats = await p.evaluate(() => window.__ct.seats().map(s => ({
  x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), h: s.pose.h, label: s.label,
  ax: +(s.at ?? s.pose).x.toFixed(2), az: +(s.at ?? s.pose).z.toFixed(2) })));
const box = process.argv.slice(2).map(Number);
const [x0, x1, z0, z1] = box.length === 4 ? box : [-1e9, 1e9, -1e9, 1e9];
const lot = seats.filter(s => s.x > x0 && s.x < x1 && s.z > z0 && s.z < z1);
console.log(`seats total ${seats.length}; in range ${lot.length}`);

const cols = await p.evaluate(() => window.__ct.colliders().map(c => [c.minX,c.maxX,c.minZ,c.maxZ]));
const inSolid = (x,z) => cols.some(([a,b2,c,d]) => x>a-0.36 && x<b2+0.36 && z>c-0.36 && z<d+0.36);

const prompt = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => {
    if (e.children.length || !/\[E\]/.test(e.textContent||'')) return false;
    const st = getComputedStyle(e);
    return st.display!=='none' && st.visibility!=='hidden' && +st.opacity>0.05;
  });
  return el ? el.textContent.trim() : null;
});

for (const s of lot) {
  const ax = s.ax ?? s.x, az = s.az ?? s.z;
  const blocked = inSolid(ax, az);
  await p.evaluate(([x,z,y]) => window.__ct.warp(x,z,Math.atan2(0,-1),y,0), [ax, az, 0.14]);
  await p.waitForTimeout(400);
  const pr = await prompt();
  await p.keyboard.press('e'); await p.waitForTimeout(700);
  const sat = await p.evaluate(() => window.__ct.seated());
  console.log(`${JSON.stringify(s.label)} (${s.x},${s.z}) h=${s.h}  approach(${ax},${az}) inSolid=${blocked}  prompt=${JSON.stringify(pr)}  seated=${sat!==null}`);
  if (sat !== null) { await p.keyboard.press('e'); await p.waitForTimeout(600); }
}
await b.close();
