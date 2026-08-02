// I verified prompts FIRE and mostly never pressed the key. Pressing it found
// that both civic doors are shut and the library's message names a board that
// does not exist. So: press the two whose ACTION I have never triggered.
//   "buy cereal — $2.50"  — does it take the money?
//   "enter No. 227"       — does it let you in?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const prompt = () => p.evaluate(() => { const d=document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null; });
const pos = () => p.evaluate(() => window.__ct.pos().map(v=>+v.toFixed(2)));
// The HUD says right-click = wallet, and my first detector just matched the
// PROMPT (it contains "$2.50"). Open the wallet and read it, excluding the
// prompt element itself.
const wallet = async () => {
  await p.mouse.click(450, 300, { button: 'right' });
  await p.waitForTimeout(400);
  return p.evaluate(() => {
    const pr = document.getElementById('ct-prompt');
    const els = [...document.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && e !== pr && !(pr && pr.contains(e)))
      .filter(e => /\$\s?\d/.test(e.textContent ?? ''));
    return els.length ? els.map(e => e.textContent.trim()).slice(0,3).join(' | ') : null;
  });
};
const targets = await p.evaluate(() => window.__ct.spots()
  .filter(s => /buy cereal/i.test(s.label||''))
  .map(s => ({ label:s.label, x:+s.x.toFixed(2), z:+s.z.toFixed(2) })));
for (const t of targets) {
  await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0.14, 0), [t.x, t.z]);
  await p.waitForTimeout(350);
  const before = { prompt: await prompt(), pos: await pos(), wallet: await wallet() };
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(700);
  const after = { prompt: await prompt(), pos: await pos(), wallet: await wallet() };
  const moved = Math.hypot(after.pos[0]-before.pos[0], after.pos[2]-before.pos[2]);
  console.log(`\n${t.label}  at (${t.x}, ${t.z})`);
  console.log(`   before: prompt ${JSON.stringify(before.prompt)}  wallet ${JSON.stringify(before.wallet)}`);
  console.log(`   after : prompt ${JSON.stringify(after.prompt)}  wallet ${JSON.stringify(after.wallet)}`);
  console.log(`   moved ${moved.toFixed(1)} m${after.pos[0]>400?'  → INSIDE the interior belt':''}`);
}
await b.close();
