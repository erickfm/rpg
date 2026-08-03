#!/usr/bin/env node
// ITEM 208: THE FACE ITSELF, AT ITS OWN RESOLUTION.
//
// The world shot (`w55-slot-look.mjs`) is what the user sees and is the verdict
// that counts. But it lands the 320 x 483 canvas on ~320 screen pixels through a
// perspective camera, so judging a 3 px bevel from it is guessing. This pulls
// the panel's own canvas out with `toDataURL` and writes it at 1x and 3x, which
// is the same thing the desk did when it described his frame — look at the
// artwork, then look at the world.
//
//   SHOT_URL=http://localhost:4290/ node scripts/probes/w73-slot-face.mjs [outdir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const OUT = process.argv[2] ?? '/tmp/w73-face';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const seat = await p.evaluate(() => {
  const s = window.__ct.seats().filter((x) => x.label === 'sit at the slot');
  return s[Math.floor(s.length / 2)];
});
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos?.().gy ?? 0, 0), seat);
await p.waitForTimeout(400);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await p.waitForFunction(() => window.__hud?.panel() === 'ct-slots', { timeout: 10000 });
await p.evaluate(() => window.__slots.insert(60));

// The canvas is a live texture source; grab it a few times so the chase and the
// win flash are both represented rather than one arbitrary frame.
const grab = async (name) => {
  // THE CANVAS IS THE TEXTURE — `ct/hud.ts` hangs the panel's own canvas on the
  // mesh as a `CanvasTexture`, which is a view onto it rather than a copy. So
  // the thing to grab is `material.map.image`, and grabbing it proves the
  // picture reaching the mesh is the picture, not a re-render of the layout.
  const url = await p.evaluate(() => {
    let f = null;
    window.__ct.scene().traverse((o) => { if (o.name === 'ct-slots-screen') f = o; });
    const img = f?.material?.map?.image;
    return img && img.toDataURL ? img.toDataURL('image/png') : null;
  });
  if (!url) { console.error('no live canvas on ct-slots-screen'); return; }
  const png = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(`${OUT}/${name}.png`, png);
  console.log(`  ${name}.png  ${png.length} bytes`);
};

await p.waitForTimeout(600); await grab('idle');
await p.keyboard.press('m');                       // max bet, so the pays scale
await p.waitForTimeout(400); await grab('maxbet');
await p.waitForTimeout(9000); await grab('attract');

// Spin until something pays, so the win state gets looked at too. Bounded, and
// it reports how many it took rather than looping forever pretending.
// TOP THE METER UP EVERY SPIN. The first version inserted 60 once and then
// pressed MAX BET, which is 5 a spin — so it went broke after 12 and reported
// "no win in 60 spins" about a machine that was fine. A loop that keeps
// pressing a button the machine is refusing measures nothing and says so in a
// sentence that sounds like a finding.
let spins = 0, paid = false;
for (; spins < 60 && !paid; spins++) {
  await p.evaluate(() => window.__slots.insert(20));
  await p.keyboard.press(' ');
  await p.waitForFunction(() => window.__slots.view().state === 'idle', { timeout: 8000 });
  paid = await p.evaluate(() => !!window.__slots.view().win);
}
console.log(`  ${paid ? `a win after ${spins} spins` : `no win in ${spins} spins`}`);
if (paid) await grab('win');

await p.evaluate(() => window.__slots.view());
console.log(errs.length ? `\n  ${errs.length} page errors:\n   ${errs.join('\n   ')}` : '\n  no page errors');
await b.close();
process.exit(errs.length ? 1 : 0);
