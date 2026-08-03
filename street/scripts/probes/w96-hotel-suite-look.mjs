// LOOK AT THE HOTEL SEATING GROUP.
//
// `slabTex` fills the authored colour into the texture and the material then
// reads WHITE, so a census can only tell you a map arrived — it cannot tell you
// the bottle-green survived. That needs a picture, and the whole point of the
// change is "do not repaint anyone's approved artwork".
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-hotel-suite-look.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4520/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));   // a game day is 24 REAL minutes

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'hotel'));
if (!room) { console.log('REFUSING TO REPORT: no hotel room'); await b.close(); process.exit(3); }

// The suite sits against the EAST wall. Stand off it and look at it, and also
// take the three mismatched chairs, which are the other half of the change.
const shots = [
  ['suite', room.cx + 2.4, 3.5, Math.PI / 2],
  ['chairs', room.cx + 1.0, room.cz + 26 / 2 - 6.2, Math.PI / 2],
];
for (const [tag, x, z, yaw] of shots) {
  await p.evaluate(([x2, z2, y2]) =>
    window.__ct.warp(x2, z2, y2, window.__ct.groundAt(x2, z2), -0.12), [x, z, yaw]);
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `shots/w96-hotel-${tag}.png` });
  console.log(`${tag}: stood at (${x.toFixed(2)}, ${z.toFixed(2)}) -> shots/w96-hotel-${tag}.png`);
}
await b.close();
