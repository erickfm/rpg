// ITEM 179 — LOOK AT THE KNIVES, THE BOLT CUTTERS AND THE GUNS.
//
// The item: *"a screenshot from a customer's standing position."* So the camera
// stands ON THE CUSTOMER FLOOR, in front of the counter, at standing eye height
// — not floating, not behind the counter, and not at the wall. The whole point
// of this room's rebuild was that the player kept reading as being on the wrong
// side of the counter, so a frame shot from the staff strip would be answering
// the wrong question entirely.
//
// Positions come from the room the world publishes (`__ct.roomDims`), never
// from the coordinates I typed into `int-pawn.ts` — if the frontage moves, the
// camera moves with the shop (BUILDER-BRIEF §8).
//
// The clock is pinned: a game day is 24 real minutes, so an unpinned pair of
// runs is two different times of day.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-pawn-hard-stock.mjs <tag>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4191/');
const TAG = process.argv[2] ?? 'now';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /pawn/i.test(r.id)));
if (!room) { console.log('ABORT no pawn room — hook missing, NOT a world fault (GOTCHAS §32)'); await b.close(); process.exit(3); }
console.log(`pawn  cx ${room.cx}  cz ${room.cz}  w ${room.w}  d ${room.d}`);

// Local (x across, z along). Yaw 0 is -z in this world (crosstown.ts:544), so
// yaw 0 faces the back wall — which is where all three new fittings are.
const VIEWS = [
  ['from-the-door', 0, room.d / 2 - 1.6, 0, 0.06],       // standing just inside, the whole back wall
  ['at-the-counter', 0, -room.d / 2 + 2.4, 0, 0.10],     // leaning on the counter, looking up
  ['knives', -4.2, -room.d / 2 + 2.6, -0.55, 0.12],      // the west case
  ['guns', 4.0, -room.d / 2 + 2.6, 0.52, 0.14],          // the east cabinet
];

for (const [name, lx, lz, yaw, pitch] of VIEWS) {
  await p.evaluate(([x, z, y, pi]) => { window.__ct.clock(13, 0); window.__ct.warp(x, z, y, undefined, pi); },
    [room.cx + lx, room.cz + lz, yaw, pitch]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w101-pawn-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  const q = await p.evaluate(() => window.__ct.pos());
  console.log(`${path}  stood at (${q[0].toFixed(2)}, ${q[2].toFixed(2)})  black ${black}`
    + (black > 0.98 ? '   <-- YOU PHOTOGRAPHED THE VOID' : ''));
}
if (errs.length) console.log(`PAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
else console.log('no page errors');
await b.close();
