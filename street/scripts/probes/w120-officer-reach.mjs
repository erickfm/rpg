// ITEM 289 — CAN A CLIENT IN THE BANK'S CHAIR REACH THE LOAN OFFICER?
//
// The measurement, not the fix. It reads the world's OWN registry — the seat
// list and the spot list, through `__ct` — and prints, for every spot the bank
// publishes, the distance from the client chair against the seated bound
// `s.r + REACH_MARGIN` that `fp.ts:1139-1140` applies while you are sitting.
// Nothing here is typed by hand: the margin comes from `__ct.reachMargin()`,
// the chair from `__ct.seats()`, the spots from `__ct.spots()`.
//
// Run it standing INSIDE the bank — `spots()` evaluates every `ok()` at call
// time and the loan spots are gated on `room.inside()`, so from the street the
// list is empty and the check would measure nothing (GOTCHAS 50).
//
//   SHOT_URL=http://localhost:4193/ node scripts/probes/w120-officer-reach.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const chair = await p.evaluate(() => (window.__ct.seats() || [])
  .map((s) => ({ label: s.label, x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw }))
  .find((s) => /client chair/i.test(s.label)));
if (!chair) { console.log('REFUSING: no client chair in the seat registry'); await b.close(); process.exit(3); }
console.log(`client chair "${chair.label}" @ ${chair.x.toFixed(2)}, ${chair.z.toFixed(2)}`);

// stand in the room so the bank's `ok()`s are true, then read the registry
await p.evaluate(() => window.__ct.clock(10, 0));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [chair.x, chair.z]);
await waitPainted(p, { frames: 6 });

const rows = await p.evaluate(([cx, cz]) => {
  const margin = window.__ct.reachMargin();
  const radius = window.__ct.playerRadius();
  return {
    margin, radius,
    spots: (window.__ct.spots() || []).map((s) => ({
      label: s.label, x: s.x, z: s.z, r: s.r,
      d: Math.hypot(s.x - cx, s.z - cz),
    })).filter((s) => s.d < 6).sort((a, b) => a.d - b.d),
  };
}, [chair.x, chair.z]);

console.log(`REACH_MARGIN = ${rows.margin}   RADIUS = ${rows.radius}`);
// fp.ts:1139-1148 — the seated clause. Surface to surface: the span a seated
// arm crosses is `d - s.r - RADIUS`, and it must be inside REACH_MARGIN.
console.log('\n  dist    r    seated bound   reach?   label');
for (const s of rows.spots) {
  const bound = s.r + rows.radius + rows.margin;
  console.log(`  ${s.d.toFixed(2)}  ${s.r.toFixed(2)}   ${bound.toFixed(2)}          ${s.d < bound ? 'YES' : 'no '}      ${s.label}`);
}
await b.close();
