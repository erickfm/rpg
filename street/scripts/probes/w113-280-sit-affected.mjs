// ITEM 280 — SIT ON the seats beside every sitter this change moves.
//
// `scripts/seats-walk.mjs` does all 219 and takes longer than a builder should
// spend synchronously (BUILDER-BRIEF §3: make the run smaller, not
// asynchronous). These are the ones that can possibly have been affected: the
// diner's six booth seats, which two moved sitters sit on, and the casino
// lounge's four, one of which is claimed by a third.
//
// Sitting is the check the offer count cannot make. `spots()` says a seat is
// OFFERED; it does not say `rig.sit` accepts the pose, and it does not say you
// can get back up — and a seat you cannot stand up from is the worst bug this
// project ships (BUILDER-BRIEF §11).
//
// Usage: SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-sit-affected.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4690/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });
await reportWorld(p, URL);

// The DINER booths (x ~756..765) and the CASINO lounge (x ~870..880, z > 14).
const seats = await p.evaluate(() => window.__ct.seats()
  .filter((s) => (s.pose.x > 750 && s.pose.x < 770)
    || (s.pose.x > 860 && s.pose.x < 900 && s.pose.z > 13))
  .map((s) => ({ x: +s.pose.x.toFixed(3), z: +s.pose.z.toFixed(3),
    yaw: s.pose.yaw, h: s.pose.h, label: s.label })));
console.log(`${seats.length} affected seats to sit on\n`);

let sat = 0, stood = 0, bad = [];
for (const s of seats) {
  const r = await p.evaluate(async (seat) => {
    // must be standing first — a seated player cannot hop to another seat
    if (window.__ct.seated()) window.__ct.stand();
    window.__ct.sit({ x: seat.x, z: seat.z, yaw: seat.yaw, h: seat.h });
    return null;
  }, s);
  await p.waitForTimeout(140);
  const on = await p.evaluate(() => window.__ct.seated() !== null);
  await p.evaluate(() => window.__ct.stand());
  await p.waitForTimeout(140);
  const off = await p.evaluate(() => window.__ct.seated() === null);
  if (on) sat++; else bad.push(`${s.label} @(${s.x}, ${s.z}) WOULD NOT SEAT`);
  if (off) stood++; else bad.push(`${s.label} @(${s.x}, ${s.z}) WOULD NOT STAND UP`);
  console.log(`  ${on ? 'sat' : 'NO '} / ${off ? 'stood' : 'STUCK'}  ${s.label} (${s.x}, ${s.z})`);
  void r;
}
console.log(`\n${sat}/${seats.length} seated, ${stood}/${seats.length} stood back up`);
for (const m of bad) console.log(`  FAIL ${m}`);
await b.close();
process.exit(bad.length ? 1 : 0);
