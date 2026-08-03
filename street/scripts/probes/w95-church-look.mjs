// Item 145 — LOOK at the church. Four framings a player actually gets.
//
// The tone probe reports two numbers; numbers cannot say whether a nave reads
// as a nave. These are the frames I judged the change on.
//
// Usage: SHOT_URL=http://localhost:4510/ node scripts/probes/w95-church-look.mjs <tag>
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const tag = process.argv[2] || 'now';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await page.goto(process.env.SHOT_URL || 'http://localhost:4510/');
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.waitForTimeout(600);
const R = (await page.evaluate(() => window.__ct.roomDims())).find((r) => r.id === 'church');

// door end looking up the nave to the altar; the altar close; back down the
// nave to the door; and straight up, which is the 9.5 m the room exists for.
const SHOTS = [
  ['nave', 0, 10.5, 0, 0],
  ['altar', 0, -2.0, 0, 0],
  ['back', 0, -6.0, Math.PI, 0],
  ['up', 0, 4.0, 0, 0.95],
];
for (const [name, lx, lz, yaw, pitch] of SHOTS) {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, undefined, p),
    [R.cx + lx, R.cz + lz, yaw, pitch]);
  // GOTCHAS 78/80: a timeout is not a painted frame. The first cut of this
  // probe used waitForTimeout(320) and wrote a SOLID WHITE nave.
  await waitPainted(page, { quiet: true });
  await page.screenshot({ path: `shots/church-${tag}-${name}.png` });
}
console.log(`wrote shots/church-${tag}-{nave,altar,back,up}.png`);
await browser.close();
