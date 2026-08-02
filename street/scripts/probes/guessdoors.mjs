// The eleven frontages whose door position was GUESSED, not declared. None has
// an [E] to walk to, so nothing verifies where their painted door sits. But a
// camera can look: stand square to the frontage centre, and see whether the
// door is drawn where the roster says it is.
//
// Axis-aware camera: axis 'z' frontages face along x, axis 'x' ones along z.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 640 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const fronts = await p.evaluate(() => (globalThis.__frontages||[]).map(f=>({
  name:f.name, axis:f.axis, lo:f.loWorld, hi:f.hiWorld, face:f.facePos,
  door:f.doorWorld, w:f.frontageM, declared: f.doorDeclared })));
const guessed = fronts.filter(f => f.declared === false);
console.log(`${fronts.length} frontages · ${guessed.length} with a GUESSED door position\n`);
for (const f of guessed.slice(0, 6)) {
  const c = (f.lo + f.hi) / 2;
  const off = +(f.door - c).toFixed(2);
  const back = 9.0;
  let x, z, yaw;
  if (f.axis === 'z') { x = f.face + (f.face < 0 ? back : -back); z = c; yaw = f.face < 0 ? -Math.PI/2 : Math.PI/2; }
  else               { z = f.face + (f.face < 0 ? back : -back); x = c; yaw = f.face < 0 ? Math.PI : 0; }
  const ok = await p.evaluate(([x,z,yaw]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
    if (cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&z>q.minZ-RAD&&z<q.maxZ+RAD)) return false;
    window.__ct.warp(x, z, yaw, 0.14, 0.04); return true;
  }, [x,z,yaw]);
  if (!ok) { console.log(`   ${f.name.padEnd(12)} camera point not standable`); continue; }
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/gd-${f.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png` });
  console.log(`   ${f.name.padEnd(12)} axis ${f.axis}  ${f.w} m  door offset from centre ${String(off).padStart(6)} m  → shot`);
}
await b.close();
