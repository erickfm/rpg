// H (verifier): C claims the bed's exit prompt "does not change however you
// look" and that E leaves from every look direction (6 of 6). Facing has
// decided the pick at three other seats tonight, so this sweeps 12 and also
// tests Escape, which C added as a second exit.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(250);   // focus FIRST, then warp
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0] || '(nothing)');
const s = await p.evaluate(() => {
  const q = window.__ct.seats().find((x) => /watch TV/i.test(x.label));
  return { x: q.pose.x, z: q.pose.z, ax: q.at.x, az: q.at.z };
});
const sit = async () => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0),
    [s.ax, s.az, Math.atan2(s.x - s.ax, -(s.z - s.az))]);
  await p.waitForTimeout(320);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  return p.evaluate(() => !!window.__ct.seated());
};
console.log('12 facings, seated on the bed — prompt, then E:');
let outE = 0, labels = new Set(), tried = 0;
for (let i = 0; i < 12; i++) {
  if (!await sit()) { console.log(`   yaw ${i * 30}: could not sit`); continue; }
  tried++;
  await p.evaluate((y) => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], y, window.__ct.groundAt(q[0], q[2]), 0); }, (i / 12) * Math.PI * 2);
  await p.waitForTimeout(300);
  const t = await prompt(); labels.add(t);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(650);
  const off = !await p.evaluate(() => !!window.__ct.seated());
  if (off) outE++; else { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  console.log(`   yaw ${String(i * 30).padStart(3)}°  ${t.padEnd(28)} E -> ${off ? 'left the seat' : 'STILL SEATED'}`);
}
console.log(`\n  E left the seat on ${outE} of ${tried} facings`);
console.log(`  distinct prompts seen: ${JSON.stringify([...labels])}`);
// Escape as the second exit
if (await sit()) {
  await p.keyboard.press('Escape'); await p.waitForTimeout(650);
  console.log(`  Escape as a second exit: ${await p.evaluate(() => !!window.__ct.seated()) ? 'STILL SEATED' : 'left the seat'}`);
}
await b.close();
