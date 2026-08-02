import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4184/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(900);

// warp to the jail door on the street, walk in via the [E]
await p.evaluate(() => window.__ct.warp(60.5, -103.0, Math.PI/2, 0, 0));
await p.waitForTimeout(200);
let spots = await p.evaluate(() => window.__ct.spots().filter(s => /DETENTION/i.test(s.label ?? '')));
console.log('street spots:', JSON.stringify(spots));

await p.keyboard.press('e');
await p.waitForTimeout(500);
let pos = await p.evaluate(() => window.__ct.pos());
console.log('after E (enter):', pos);

// warp back near the entrance ourselves
await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0, 0), [pos[0], pos[2]]);
await p.waitForTimeout(300);

for (let i = 0; i < 20; i++) {
  const info = await p.evaluate(() => {
    const ct = window.__ct;
    const pos = ct.pos();
    const landing = ct.landing ? ct.landing() : 'no-landing-fn';
    const spots = ct.spots().filter(s => /street/i.test(s.label ?? ''));
    return { pos, landing, spots };
  });
  console.log(`frame ${i}:`, JSON.stringify(info));
  await p.waitForTimeout(100);
}

await p.keyboard.press('e');
console.log('pressed E to exit');
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(150);
  const pos = await p.evaluate(() => window.__ct.pos());
  console.log(`  +${(i+1)*150}ms pos:`, pos);
  if (pos[0] < 100) { console.log('LEFT the room'); break; }
}

await b.close();
