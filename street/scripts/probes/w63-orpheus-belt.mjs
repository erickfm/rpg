#!/usr/bin/env node
// ITEM 176: CAN YOU ACTUALLY WALK FROM THE HOTEL INTO THE CASINO?
//
// The row calls the internal doorway "a real engineering problem, not
// decoration", and says the blocker is the region cull. Before building
// anything, ask the world where the two rooms ARE — because if they are not
// adjacent, no amount of cull work makes a doorway walkable and the answer is a
// different mechanism entirely.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w63-orpheus-belt.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const r = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  const pick = (id) => dims.find((d) => d.id === id) ?? null;
  return { n: dims.length, all: dims.map((d) => ({ id: d.id, cx: d.cx, cz: d.cz, w: d.w, d: d.d })),
    hotel: pick('hotel'), casino: pick('casino') };
});

console.log(`\n  ${r.n} rooms in the interior belt, in slab order:`);
for (const d of r.all) {
  console.log(`    ${d.id.padEnd(12)} centre x ${String(d.cx).padStart(7)}  z ${String(d.cz).padStart(6)}`
    + `   ${d.w} x ${d.d} m   -> spans x ${(d.cx - d.w / 2).toFixed(1)} .. ${(d.cx + d.w / 2).toFixed(1)}`);
}
if (r.hotel && r.casino) {
  const gap = Math.abs(r.casino.cx - r.hotel.cx) - r.hotel.w / 2 - r.casino.w / 2;
  console.log(`\n  HOTEL centre x ${r.hotel.cx}, CASINO centre x ${r.casino.cx}`);
  console.log(`  centres are ${Math.abs(r.casino.cx - r.hotel.cx).toFixed(1)} m apart`);
  console.log(`  DEAD GROUND BETWEEN THEIR WALLS: ${gap.toFixed(1)} m`);
  console.log(gap > 2
    ? '\n  => A LITERAL DOORWAY IS IMPOSSIBLE. The two rooms do not touch and cannot,\n'
      + '     because ct/interior.ts:45 gives every room its own 80 m slab from x 400.\n'
      + '     "Walk from one into the other" has to be an [E] that jumps you, dressed\n'
      + '     as an interior door — the same mechanism every street door already uses.\n'
    : '\n  => the rooms touch; a real opening is possible\n');
} else {
  console.log('\n  hotel or casino not found in the belt');
}
await b.close();
