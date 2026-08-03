#!/usr/bin/env node
// ITEM 157, the LOOKING probe: sit at the terminal and file one frame per
// screen, so the framing (`standoff`/`fov` in ct/library-pc.ts) is chosen by
// looking at it rather than by arithmetic. w55 measured that reasoning about
// this got it backwards.
//   SHOT_URL=http://localhost:4201/ W64_TAG=a node scripts/probes/w64-pc-look.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const TAG = process.env.W64_TAG || 'a';
const DIR = process.env.W64_SHOTS || '/tmp/w64-pc';
mkdirSync(DIR, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);
const seat = await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the computer')[0]);
if (!seat) { console.error('no seat labelled "sit at the computer"'); await b.close(); process.exit(3); }
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos()[3], 0), seat);
await p.waitForTimeout(500);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForFunction(() => window.__hud.panel() === 'ct-library-pc', { timeout: 10000 });
await p.waitForFunction(() => {
  const c = window.__ct.camera();
  const k = `${c.position.x.toFixed(4)},${c.position.y.toFixed(4)},${c.position.z.toFixed(4)},${c.fov.toFixed(3)}`;
  const same = window.__w64look === k; window.__w64look = k; return same;
}, { timeout: 10000 });
const cam = await p.evaluate(() => {
  const c = window.__ct.camera();
  return { x: +c.position.x.toFixed(3), y: +c.position.y.toFixed(3), z: +c.position.z.toFixed(3), fov: +c.fov.toFixed(2) };
});
console.log(`camera ${JSON.stringify(cam)}`);
await p.screenshot({ path: `${DIR}/${TAG}-1-desktop.png` });
await p.evaluate(() => window.__librarypc.key('arrowdown'));
await p.evaluate(() => window.__librarypc.key('enter'));
await p.waitForTimeout(300);
await p.evaluate(() => { for (const k of [' ']) window.__librarypc.key(k); });
await p.waitForTimeout(200);
await p.screenshot({ path: `${DIR}/${TAG}-2-minesweeper.png` });
await p.evaluate(() => window.__librarypc.key('tab'));
await p.evaluate(() => window.__librarypc.key('arrowup'));   // back to CARD CATALOG
await p.evaluate(() => window.__librarypc.key('enter'));
await p.waitForTimeout(200);
for (const ch of 'sea') await p.evaluate((c) => window.__librarypc.key(c), ch);
await p.waitForTimeout(200);
await p.screenshot({ path: `${DIR}/${TAG}-3-catalog.png` });
console.log(`filed ${DIR}/${TAG}-*.png`);
await b.close();
