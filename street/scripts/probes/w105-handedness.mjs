// Item 268 — "the hotel is the right of the casino outside but to the left
// inside". WHICH IS IT, MEASURED, from both sides.
//
// ⚠ THE ROW'S OWN EVIDENCE IS FLAGGED AS EVIDENCE AND NOT DIAGNOSIS, and the
// first thing to check is whether it can even be read the way it is written.
// It quotes the frontages as `cz: 39.45` (hotel) and `cz: 51.225` (casino) —
// but the main street's z runs about −108 … +16, so **neither number is a world
// z on that street**. They are roster-local. Any handedness argument built on
// them without conversion is an argument about the wrong axis, which is exactly
// the class this item is about.
//
// So nothing here reads the roster. It asks the WORLD where each building's
// door is (`__ct.doors()`, which publishes a world point and an outward normal
// per building) and where each ROOM is (`__ct.roomDims()`), and computes left
// vs right the same way for both — from the player's facing, using the rig's
// own convention.
//
// LEFT/RIGHT IS DERIVED, NOT EYEBALLED. `crosstown.ts:1195`: fwd = (sin yaw, 0,
// −cos yaw). With up = +y, left = up × fwd = (−cos yaw, 0, −sin yaw). Project
// each building's offset onto that and the sign IS the answer.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const w = await p.evaluate(() => {
  const doors = window.__ct.doors();
  const rooms = window.__ct.roomDims();
  const pick = (re) => doors.filter((d) => re.test(d.building));
  return {
    doors: doors.map((d) => ({ b: d.building, x: d.point?.[0] ?? d.point?.x ?? null,
                               z: d.point?.[2] ?? d.point?.z ?? null,
                               stand: d.stand })),
    hotelDoors: pick(/hotel/i), casinoDoors: pick(/casino|sevens/i),
    rooms: rooms.filter((r) => /hotel|casino/.test(r.id)),
    party: window.__ct.party(),
  };
});
console.log('\nrooms   ', JSON.stringify(w.rooms));
console.log('party   ', JSON.stringify(w.party));
console.log('hotel door(s)  ', JSON.stringify(w.hotelDoors));
console.log('casino door(s) ', JSON.stringify(w.casinoDoors));
await b.close();
