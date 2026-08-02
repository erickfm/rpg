// H (verifier): I measured 78 casino seats with a non-stand spot inside the
// 0.5 m stand radius. L claims "you cannot be trapped at a machine". This tests
// the exit against those rivals, at EVERY FACING - because the K lesson is that
// the facing decides which spot wins the pick.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);   // focus FIRST
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const seat = await p.evaluate(() => {
  const s = window.__ct.seats().find((q) => /slot/i.test(q.label));
  return s ? { label: s.label, x: s.pose.x, z: s.pose.z, ax: s.at.x, az: s.at.z } : null;
});
if (!seat) { console.log('no slot seat found — nothing measured'); await b.close(); process.exit(3); }
console.log(`slot seat "${seat.label}" pose (${seat.x.toFixed(2)}, ${seat.z.toFixed(2)}) approach (${seat.ax.toFixed(2)}, ${seat.az.toFixed(2)})`);
let trapped = 0, tried = 0;
for (let i = 0; i < 8; i++) {
  const yaw = (i / 8) * Math.PI * 2;
  // sit: stand on the approach, face the seat, E
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [seat.ax, seat.az, Math.atan2(seat.x - seat.ax, -(seat.z - seat.az))]);
  await p.waitForTimeout(300);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  if (!await p.evaluate(() => window.__ct.seated())) { console.log(`  yaw ${(yaw*180/Math.PI).toFixed(0)}°: could not sit — skipped`); continue; }
  tried++;
  // now LOOK somewhere arbitrary while seated, and try to get out
  await p.evaluate((y) => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], y, window.__ct.groundAt(q[0], q[2]), 0); }, yaw);
  await p.waitForTimeout(350);
  const seenPrompt = await prompt() || '(nothing)';
  const rivals = await p.evaluate(() => {
    const q = window.__ct.pos();
    return window.__ct.spots().filter((s) => s.ok && Math.hypot(s.x - q[0], s.z - q[2]) <= 0.6)
      .map((s) => `${s.label}@${Math.hypot(s.x - q[0], s.z - q[2]).toFixed(2)}`);
  });
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  const still = await p.evaluate(() => !!window.__ct.seated());
  if (still) { trapped++; await p.keyboard.press('KeyE'); await p.waitForTimeout(500); }
  console.log(`  yaw ${String((yaw*180/Math.PI).toFixed(0)).padStart(3)}°  prompt ${seenPrompt.padEnd(30)} live<=0.6m ${JSON.stringify(rivals)}  ${still ? 'STILL SEATED' : 'stood up'}`);
}
console.log(`\n  ${tried} sittings tested across facings; ${trapped} left the player seated after one E.`);
await b.close();
process.exit(trapped ? 1 : 0);
