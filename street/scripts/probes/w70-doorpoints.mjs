#!/usr/bin/env node
// ITEM 196 — where the world says the two Orpheus entrances are, so the shot
// probe aims at them instead of at a z I remembered.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.doors !== undefined, { timeout: 20000 });
const d = await p.evaluate(() => window.__ct.doors());
for (const x of d) console.log(x.building.padEnd(16), 'point', JSON.stringify(x.point), ' stand', JSON.stringify(x.stand));
await b.close();
