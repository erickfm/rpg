#!/usr/bin/env node
// ITEM 196 — LOOK AT IT. The four frames the row asks for: the pavement by day
// and by night, the connecting doorway from the hotel side, and from inside the
// casino looking back through it.
//
// Screenshots are for LOOKING, never for proving (CLAUDE.md) — the walking is
// in w70-orpheus-walk.mjs. These exist because "reads as one establishment" is
// a judgement about apparent form, which is the one thing an image is for.
//
//   SHOT_URL=http://localhost:4260/ node scripts/probes/w70-orpheus-shots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4260/');
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const dims = await p.evaluate(() => window.__ct.roomDims());
const hotel = dims.find((d) => d.id === 'hotel'), casino = dims.find((d) => d.id === 'casino');
const seam = hotel.cx + hotel.w / 2 + 0.18;                 // middle of the party wall
const AT = -9.0;

const shot = async (name, x, z, yaw, pitch, hour) => {
  await p.evaluate(([h]) => window.__ct.clock(h, 0), [hour]);
  await p.evaluate(([a, c, y, q]) => window.__ct.warp(a, c, y, undefined, q), [x, z, yaw, pitch]);
  await waitPainted(p, { quiet: true });
  await p.waitForTimeout(700);
  const buf = await p.screenshot({ path: `shots/${name}.png` });
  const blk = await blackFraction(p, buf);
  console.log(`  shots/${name}.png   black ${(blk * 100).toFixed(1)}%`);
};

// THE PAVEMENT. The side street's north walk is z = -97; the combined property
// runs x 33.45 … 57.00, so stand back down the walk and look along it.
await shot('w70-pavement-day', 30.0, -97.6, Math.PI / 2 - 0.42, -0.02, 13);
await shot('w70-pavement-night', 30.0, -97.6, Math.PI / 2 - 0.42, -0.02, 22);
await shot('w70-pavement-front', 45.4, -99.6, 0.10, 0.06, 21);

// THE CONNECTING DOORWAY, from the hotel lobby, looking at it
await shot('w70-doorway-from-hotel', hotel.cx - 1.0, AT + 3.6, Math.PI / 2 - 0.62, -0.02, 13);
// standing IN it
await shot('w70-doorway-in', seam, AT, Math.PI / 2, 0, 13);
// and from the casino floor looking back through
await shot('w70-doorway-from-casino', casino.cx + 1.6, AT + 1.2, -Math.PI / 2 - 0.30, -0.02, 13);

await b.close();
