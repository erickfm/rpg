// Item 263, before touching seats-walk: what does a MACHINE seat actually do,
// as against a plain chair, now that `__ct.focus()` exists?
//
// Sits on one slot stool and one ordinary chair and prints, for each: the focus
// state as you sit, whether it settles, where the eye ends up against the
// published target, what the seated prompt is, and what ESCAPE does.
//
//   SHOT_URL=http://localhost:4181/ node scripts/probes/w122-item263-focus-shape.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await p.goto(aim('http://localhost:4181/'), { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 25000 });
await p.waitForTimeout(1200);

const seats = await p.evaluate(() => window.__ct.seats());
const labels = [...new Set(seats.map((s) => s.label))];
console.log(`${seats.length} seats, ${labels.length} distinct labels:`);
for (const l of labels) console.log(`  ${String(seats.filter((s) => s.label === l).length).padStart(3)}  ${l}`);

const prompt = () => p.evaluate(() => {
  const el = document.querySelector('#ct-prompt');
  return el && el.style.display !== 'none' ? el.textContent : null;
});
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(220); };

for (const want of ['sit at the slot', 'sit down', 'sit at the blackjack table']) {
  const s = seats.find((q) => q.label === want);
  if (!s) { console.log(`\n=== ${want}: no such seat`); continue; }
  console.log(`\n=== ${want} at ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)} ===`);
  await p.evaluate(() => { if (window.__ct.seated()) window.__ct.stand(); });
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [s.at.x, s.at.z, s.pose.yaw]);
  await p.waitForTimeout(200);
  console.log(`  standing prompt: ${JSON.stringify(await prompt())}`);
  await press();
  const t0 = await p.evaluate(() => ({ seated: !!window.__ct.seated(), focus: window.__ct.focus(), camY: window.__ct.camY() }));
  console.log(`  just sat: seated=${t0.seated} camY=${t0.camY.toFixed(3)} focus=${JSON.stringify(t0.focus)}`);
  await p.waitForTimeout(900);
  const t1 = await p.evaluate(() => ({ focus: window.__ct.focus(), camY: window.__ct.camY() }));
  console.log(`  +900ms:  camY=${t1.camY.toFixed(3)} settled=${t1.focus?.settled} t=${t1.focus?.t}`
    + (t1.focus ? `  targetEyeY=${t1.focus.eye.y.toFixed(3)}  err=${Math.abs(t1.camY - t1.focus.eye.y).toFixed(3)}` : ''));
  console.log(`  seated prompt: ${JSON.stringify(await prompt())}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const t2 = await p.evaluate(() => ({ seated: !!window.__ct.seated(), focus: window.__ct.focus(), camY: window.__ct.camY() }));
  console.log(`  after ESC: seated=${t2.seated} focus=${t2.focus === null ? 'null' : JSON.stringify(t2.focus)} camY=${t2.camY.toFixed(3)}`);
  console.log(`  prompt after ESC: ${JSON.stringify(await prompt())}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  console.log(`  after 2nd ESC: seated=${await p.evaluate(() => !!window.__ct.seated())}`
    + `  prompt ${JSON.stringify(await prompt())}`);
}
await b.close();
