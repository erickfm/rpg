// Does the world load clean — and in particular does the item-54 trailer trip
// either the parking trap warning or its own `[sedan-climb]` guard?
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-console.mjs
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
const msgs = [];
p.on('console', (m) => msgs.push(`${m.type()}: ${m.text()}`));
p.on('pageerror', (e) => msgs.push(`pageerror: ${e.message}`));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);
// THREE's Clock deprecation, the Canvas2D getImageData hint and the WebGL
// ReadPixels stall are all pre-existing and fire on mainline too — filtering
// them out here rather than widening the pass condition, so a REAL error still
// fails this (BUILDER-BRIEF §7: never loosen a check until it passes).
const NOISE = /THREE\.Clock|willReadFrequently|GL Driver Message/;
const bad = msgs.filter((m) => /error|parking|sedan-climb/i.test(m) && !NOISE.test(m));
console.log(bad.length ? bad.join('\n') : 'no warnings, no errors');
await b.close();
process.exit(bad.length ? 1 : 0);
