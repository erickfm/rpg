// LOOKING at GOLDEN ACES and HOTEL ORPHEUS — day and, above all, night.
//
// These are for LOOKING, never for proving (CLAUDE.md, GOTCHAS §1). Two runs of
// identical code differ in ~20% of pixels; if you want to show the world did not
// move, use `npm run fp` / `fpdiff` and read GOTCHAS §31 first. Nothing here is
// evidence of anything. It exists so that the one image the whole brief was about
// can be looked at without hunting for camera coordinates.
//
// WHY THIS FILE EXISTS. scripts/playershots.mjs already frames these two
// buildings from both ends of the side street — and every one of those four is in
// DAYLIGHT. The brief for this pair was explicitly nocturnal:
//
//   "these two are the only buildings on the block that are LIGHT SOURCES rather
//    than lit surfaces … a casino and a hotel standing next to each other at the
//    far end of the side street, throwing colour onto wet asphalt, is the single
//    best image available in this game and nothing is currently claiming it"
//
// So the thing the work was for had no picture of it. That file is not mine to
// edit (OWNERSHIP: scripts/** may be added to, not edited across owners), hence a
// new one rather than four more entries in theirs.
//
// The camera positions are lifted from playershots.mjs P1–P4 deliberately: they
// are already reviewed framings, and using the same ones means the day and night
// pairs below can be put side by side.
//
// Usage: SHOT_URL=http://localhost:4186/ node scripts/G-vice-shots.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';

// name, x, z, aim-x, aim-z, pitch
const VIEWS = [
  ['blade-from-west', 30, -100, 44.4, -96.8, 0.45],
  ['blade-from-east', 56, -100, 44.4, -96.8, 0.45],
  ['aces-from-west', 30, -101, 51.2, -95, 0.60],
  ['aces-from-east', 56.5, -101, 51.2, -95, 0.60],
  // under the porte-cochère, which you are meant to be able to walk beneath
  // far enough back to see the canopy and its lit underside; at 3 m you get a
  // wall of glass and a door, which is what the first attempt framed
  ['porte-cochere', 41.5, -103, 39.2, -96.4, 0.30],
];
// 23:00 first: it is the one that matters, and putting it first means a run that
// is interrupted still produced the picture worth having.
const HOURS = [['night', 23, 0], ['day', 13, 0]];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);   // GOTCHAS §26: prove which world, do not just name it

for (const [when, h, m] of HOURS) {
  for (const [name, x, z, tx, tz, pitch] of VIEWS) {
    await p.evaluate(([h, m]) => window.__ct.clock(h, m), [h, m]);
    await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0, pitch),
      [x, z, look(x, z, tx, tz), pitch]);
    // the chase and the spill are driven by a per-frame tick that only runs on
    // frames where the marquee is actually rendered, so give it frames to settle
    // before the shutter — a shot taken too early catches the daylight opacity
    await p.waitForTimeout(1200);
    const file = `shots/G-vice-${when}-${name}.png`;
    await p.screenshot({ path: file });
    console.log(`  ${file}`);
  }
}
await b.close();
