// ITEM 259 — DOES THE WEAVE STILL READ AS A WEAVE?
//
// The fix re-sizes item 96's upholstery sheet PER FACE instead of handing one
// sheet sized to the largest face to all six. The item is explicit: *"DO NOT
// change the upholstery's appearance — the weave was item 96's deliberate
// improvement and the user has not complained about it; only its per-face
// sizing is wrong."*
//
// So the claim under test is "the grain is the same grain, on the faces you
// actually look at, and now also on the ones you did not". `texdensity` says
// the density; this says what it looks like, from standing eye height in front
// of the furniture. Positions come from `__ct.roomDims()`, not from the
// constants in `int-hotel.ts` (BUILDER-BRIEF §8), and the clock is pinned —
// a game day is 24 real minutes.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-hotel-upholstery.mjs <tag>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4191/');
const TAG = process.argv[2] ?? 'now';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /hotel/i.test(r.id)));
if (!room) { console.log('ABORT no hotel room (GOTCHAS §32)'); await b.close(); process.exit(3); }

// Local frame. The suite sits against the east wall at hw − 0.62, the loose
// chairs stand mid-room; both are approached from the customer floor.
const hw = room.w / 2, hd = room.d / 2;
const VIEWS = [
  ['suite', hw - 2.6, hd - 9.5, Math.PI / 2, -0.05],   // face the sofa across the group
  ['chairs', 1.0, hd - 3.6, Math.PI / 2, -0.10],       // the three mismatched chairs
];

for (const [name, lx, lz, yaw, pitch] of VIEWS) {
  await p.evaluate(([x, z, y, pi]) => { window.__ct.clock(13, 0); window.__ct.warp(x, z, y, undefined, pi); },
    [room.cx + lx, room.cz + lz, yaw, pitch]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w101-hotel-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  console.log(`${path}  black ${await blackFraction(p, buf)}`);
}
await b.close();
