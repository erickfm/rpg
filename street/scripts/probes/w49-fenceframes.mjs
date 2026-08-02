// w49 / item 114 — LOOK AT THE JAIL YARD FENCE, from inside the yard.
//
// The sweep found it: a 14 x 2.4 m PlaneGeometry, colour #2a2c2e, opacity 0.75,
// DoubleSide, and NO MAP (ct/jail.ts:841). Its own posts are commented as
// "a touch taller than the mesh they carry" — but there is no mesh, only a
// flat translucent grey sheet. That is the user's "shadow fence".
//
// Warps are VERIFIED to have landed (bugsweep's own lesson: fp.ts's unstick()
// silently reverts a warp into a collider, and the jail yard is exactly where
// that was first caught, so a frame here can very easily photograph the car lot
// under a jail filename).
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w49-fenceframes.mjs <label> [hour]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { mkdirSync } from 'node:fs';

const label = process.argv[2] ?? 'w49';
const hour = Number(process.argv[3] ?? 19);
const URL = aim('http://localhost:4193/');
mkdirSync('shots', { recursive: true });

const faceTo = (f, t) => Math.atan2(t.x - f.x, -(t.z - f.z));

// The yard: jail site x 57…75, building back BX = 65, fence at x 74.65,
// z −110…−96 with the centre line at −103.
const FENCE = { x: 74.65, z: -103 };
const views = [
  { id: 'yard-head-on',   x: 68.0, z: -103.0, look: FENCE },
  { id: 'yard-oblique-n', x: 68.0, z: -98.5,  look: FENCE },
  { id: 'yard-oblique-s', x: 68.0, z: -107.5, look: { x: 74.65, z: -106 } },
  { id: 'yard-close',     x: 72.5, z: -103.0, look: FENCE },
  { id: 'yard-along',     x: 73.5, z: -108.5, look: { x: 74.0, z: -97 } },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });
await setClock(page, hour, 0);

for (const v of views) {
  const yaw = faceTo(v, v.look);
  await page.evaluate((a) => window.__ct.warp(a.x, a.z, a.yaw, 0, 0), { x: v.x, z: v.z, yaw });
  await page.waitForTimeout(420);
  // DID IT LAND? unstick() reverts a warp into a collider and says nothing.
  const at = await page.evaluate(() => {
    const p = window.__ct.pos();          // [x, y, z, gy]
    return { x: +p[0].toFixed(2), z: +p[2].toFixed(2) };
  });
  if (at) {
    const d = Math.hypot(at.x - v.x, at.z - v.z);
    console.log(`${v.id.padEnd(16)} aimed (${v.x},${v.z}) landed (${at.x},${at.z}) drift ${d.toFixed(2)} m` + (d > 1.0 ? '   *** DID NOT LAND ***' : ''));
  } else {
    console.log(`${v.id.padEnd(16)} aimed (${v.x},${v.z}) — no position readback`);
  }
  await page.screenshot({ path: `shots/${label}-${v.id}-h${hour}.png` });
}

await browser.close();
if (errors.length) console.error('PAGE ERRORS:', errors.slice(0, 3));
console.log(`\nwrote shots/${label}-*-h${hour}.png`);
