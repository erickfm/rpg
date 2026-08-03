// ITEM 172 — LOOK at the park. Screenshots prove nothing here (two runs of
// identical code differ ~20% of pixels), so these are for a human — and for me
// — to LOOK at, not to diff. The item's done-when is *"the park has real,
// visible height variation from the street view he screenshotted"*, and that is
// a judgement somebody has to make with their eyes.
//
// Views, in the order they answer the question:
//   gate      the street view he complained about, from the pavement looking in
//   inside    just through the gate, the full length of the lawn
//   crest     from the mound's own top, looking back at the gate
//   oblique   across the lawn from the north-east, where a profile reads best
//   dish      the hollow, from beside it
//
// waitPainted, not afterFrames — rAF fires whether or not anything rendered
// (GOTCHAS 80), and the built bundle has handed back eight solid black frames
// after the prescribed wait. Every shot is checked for blackness before it is
// believed.
//
//   SHOT_URL=http://localhost:4390/ node scripts/probes/w83-park-look.mjs [suffix]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4390/';
const SUF = process.argv[2] ? `-${process.argv[2]}` : '';
mkdirSync('shots', { recursive: true });          // a fresh worktree has no shots/

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(page);
await page.evaluate(() => window.__ct.clock(13, 20));

const park = (await page.evaluate(() => window.__ct.sites())).park;
// derived the same way the walk harness derives them — see its comment
const KERB_W = 0.25, INSET = 6.0, PATH_W = 1.5;
const lx0 = park.minX + INSET + 0.5, lx1 = park.maxX - KERB_W - INSET;
const lz0 = park.minZ + INSET, lz1 = park.maxZ - INSET;
const fx0 = lx0 + PATH_W / 2, fx1 = lx1 - PATH_W / 2;
const fz0 = lz0 + PATH_W / 2, fz1 = lz1 - PATH_W / 2;
const mndX = fx0 + (fx1 - fx0) * 0.46, mndZ = (fz0 + fz1) / 2 - 1.6;
const gateMid = (park.minZ + park.maxZ) / 2;

const W = -Math.PI / 2, E = Math.PI / 2;
const views = [
  ['gate', park.maxX + 2.6, gateMid, W, 0],
  ['inside', park.maxX - 3.0, gateMid, W, 0],
  ['crest', mndX, mndZ, E, -0.06],
  ['oblique', fx1 - 1.0, fz1 - 1.0, -2.3, -0.10],
  ['dish', fx1 - 6.0, fz1 - 6.5, W, -0.12],
];
for (const [name, x, z, yaw, pitch] of views) {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  await page.evaluate(([x, z, yaw, gy, p]) => window.__ct.warp(x, z, yaw, gy, p), [x, z, yaw, gy, pitch]);
  await waitPainted(page);
  const path = `shots/w83-park-${name}${SUF}.png`;
  const buf = await page.screenshot({ path });
  const black = await blackFraction(page, buf);
  console.log(`${path}   at x ${x.toFixed(2)} z ${z.toFixed(2)} floor ${gy.toFixed(3)}   ` +
    `black ${(black * 100).toFixed(1)}%${black > 0.98 ? '   <- PHOTOGRAPHED THE VOID' : ''}`);
}
console.log(errors.length ? `console errors: ${errors.length}\n  ${errors.join('\n  ')}` : 'console errors: 0');
await browser.close();
