// The casino's door declaration is lost to the glob cycle. The prompt still
// fires -- but does pressing E actually put you inside? That is the only
// question a player would ever ask, and nothing I have run answers it.
//
// Tested against a room whose door IS collected (the diner) as a control, so a
// failure means "the casino specifically" rather than "my key press".
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const pos = () => p.evaluate(() => window.__ct.pos().map(v=>+v.toFixed(2)));
for (const [tag, x, z] of [['DINER (control)', -6.3, -46.75], ['SEVENS', 51.25, -97.3]]) {
  await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0.14, 0), [x, z]);
  await p.waitForTimeout(350);
  const before = await pos(), pr = await prompt();
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(700);
  const after = await pos();
  const moved = Math.hypot(after[0]-before[0], after[2]-before[2]);
  const inside = after[0] > 400;
  console.log(`${tag.padEnd(16)} prompt ${JSON.stringify(pr)}`);
  console.log(`   before ${JSON.stringify(before)}  →  after ${JSON.stringify(after)}   moved ${moved.toFixed(1)} m   ${inside ? 'INSIDE the interior belt' : '** still on the street **'}`);
  await p.screenshot({ path: `shots/enter-${tag.split(' ')[0].toLowerCase()}.png` });
  // come back out for the next test
  await p.evaluate(() => window.__ct.warp(0, 0, 0, 0.14, 0));
  await p.waitForTimeout(400);
}
await b.close();
