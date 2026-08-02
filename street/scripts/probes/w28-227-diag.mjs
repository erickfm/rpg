#!/usr/bin/env node
// One question: after the No. 227 door's own act() puts you in the lobby, where
// ARE you, which way are you facing, and what is in front of you? The band scan
// in w28-227-landing.mjs derived the lobby origin from the first core-wall-shaped
// collider it found and got APT_X=200 — but the door lands at x 198.6, so either
// there is more than one such shaft or the derivation is wrong. Guessing which
// would be exactly the mistake this project keeps paying for.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w28-227-diag.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 30000 });

const shafts = await p.evaluate(() => window.__ct.colliders()
  .filter((c) => c.minX > 100 && c.maxX - c.minX > 0.25 && c.maxX - c.minX < 0.40
    && c.maxZ - c.minZ > 2.0 && c.maxZ - c.minZ < 2.4)
  .map((c) => ({ minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2), minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2) })));
console.log(`core-wall-shaped colliders past x=100: ${shafts.length}`);
console.log(JSON.stringify(shafts));

const door = await p.evaluate(() =>
  window.__ct.spots().find((s) => /enter No\. 227/.test(s.label ?? '')));
await p.evaluate((d) => window.__ct.warp(d.x, d.z, 0, 0, 0), door);
await p.waitForTimeout(400);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(600);

const at = await p.evaluate(() => window.__ct.pos());
console.log(`\nthe door leaves you at (${at[0]}, ${at[2]}) gy=${at[3]}`);

// Which way does W actually take you? Four short bursts from the same spot.
for (const [k, name] of [['w', 'W'], ['s', 'S'], ['a', 'A'], ['d', 'D']]) {
  await p.evaluate((a) => window.__ct.warp(a[0], a[2], undefined, 0, 0), at);
  await p.waitForTimeout(250);
  const f = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down(k); await p.waitForTimeout(700); await p.keyboard.up(k);
  await p.waitForTimeout(150);
  const t = await p.evaluate(() => window.__ct.pos());
  console.log(`  ${name}: (${f[0].toFixed(2)}, ${f[2].toFixed(2)}) -> (${t[0].toFixed(2)}, ${t[2].toFixed(2)})`
    + `  d=(${(t[0] - f[0]).toFixed(2)}, ${(t[2] - f[2]).toFixed(2)})  gy ${t[3].toFixed(2)}`);
}

// What is within 3 m of the landing, at any height?
const near = await p.evaluate((a) => window.__ct.colliders()
  .filter((c) => c.minX - 3 < a[0] && c.maxX + 3 > a[0] && c.minZ - 3 < a[2] && c.maxZ + 3 > a[2])
  .map((c) => ({ x: [+c.minX.toFixed(2), +c.maxX.toFixed(2)], z: [+c.minZ.toFixed(2), +c.maxZ.toFixed(2)], maxY: c.maxY })), at);
console.log(`\n${near.length} colliders within 3 m of the landing:`);
for (const c of near) console.log('   ', JSON.stringify(c));

await b.close();
