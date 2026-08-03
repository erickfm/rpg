// Item 268 — stand on the pavement facing the two frontages, note the order;
// walk in; note the order. Exactly what the row asks, measured rather than
// argued, with a frame from each side.
//
// ⚠ FIRST, THE ROW'S EVIDENCE IS ON THE WRONG AXIS. It quotes the frontages as
// `cz: 39.45` (hotel) and `cz: 51.225` (casino). The world says those buildings
// stand on the SIDE STREET: `__ct.doors()` puts HOTEL ORPHEUS at world
// (39.51, −96) and SEVENS at (51.29, −96), both with outward normal (0, 0, −1).
// So 39.45/51.225 are world **x**, not z, and the side street runs along x. An
// argument about "lower z" is an argument about an axis these buildings are not
// laid out on.
//
// LEFT/RIGHT IS DERIVED FROM THE RIG'S OWN CONVENTION, not eyeballed.
// `crosstown.ts:1195`: fwd = (sin yaw, 0, −cos yaw). With up = +y,
// left = up × fwd = (−cos yaw, 0, −sin yaw). Project a building's offset from
// the viewer onto that vector; the SIGN is the answer. One function, used for
// the outside and the inside, so the two cannot be computed differently.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));

/** which hand is `pt` on, from `at` facing `yaw`? +1 left, −1 right */
const hand = (at, yaw, pt) => {
  const lx = -Math.cos(yaw), lz = -Math.sin(yaw);
  return Math.sign((pt[0] - at[0]) * lx + (pt[1] - at[1]) * lz);
};
const side = (s) => (s > 0 ? 'LEFT' : s < 0 ? 'RIGHT' : 'dead ahead');

const doors = await p.evaluate(() => window.__ct.doors());
const hd = doors.find((d) => /hotel/i.test(d.building));
const cd = doors.find((d) => /sevens|casino/i.test(d.building));
console.log(`\nHOTEL door  world (${hd.point.x}, ${hd.point.z})  outward normal (${hd.point.nx}, ${hd.point.nz})`);
console.log(`CASINO door world (${cd.point.x}, ${cd.point.z})  outward normal (${cd.point.nx}, ${cd.point.nz})`);

// ── OUTSIDE: stand between the two frontages, facing the way the doors face ──
// The viewer looks along the INWARD normal, which is what "facing the shops"
// means; the yaw is solved from the rig convention rather than typed.
const inward = [-hd.point.nx, -hd.point.nz];
const yawOut = Math.atan2(inward[0], -inward[1]);
const midX = (hd.point.x + cd.point.x) / 2;
const standZ = hd.stand.z - 1.2;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), [midX, standZ, yawOut]);
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 3000, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/w105-handed-outside.png' });
const at = [midX, standZ];
const hOut = hand(at, yawOut, [hd.point.x, hd.point.z]);
const cOut = hand(at, yawOut, [cd.point.x, cd.point.z]);
console.log(`\nOUTSIDE — standing (${midX.toFixed(2)}, ${standZ.toFixed(2)}) yaw ${yawOut.toFixed(3)}`
  + ` (facing the frontages)`);
console.log(`  HOTEL is on your ${side(hOut)}`);
console.log(`  CASINO is on your ${side(cOut)}`);
console.log(`  shots/w105-handed-outside.png`);

// ── INSIDE: walk in through the casino's own door and look the way you land ──
const rooms = await p.evaluate(() => window.__ct.roomDims());
const cr = rooms.find((r) => r.id === 'casino');
const hr = rooms.find((r) => r.id === 'hotel');
const pw = (await p.evaluate(() => window.__ct.party()))[0];

// The room publishes its own door as a LOCAL point plus an outward normal. You
// enter along the INWARD normal, so that is the facing on arrival — derived
// from the room, not from where a warp happened to leave the camera.
const inx = -cr.door.nx, inz = -cr.door.nz;
const yawIn = Math.atan2(inx, -inz);
const insideAt = [cr.cx + cr.door.x - inx * 2.5, cr.cz + cr.door.z - inz * 2.5];
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [insideAt[0], insideAt[1], yawIn]);
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 5000, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/w105-handed-inside.png' });
// The hotel, from inside the casino, IS the party doorway — so use the doorway's
// own world point rather than the hotel room's centre: it is what you can see.
const doorPt = [cr.cx - cr.w / 2, cr.cz + pw.at];
const hIn = hand(insideAt, yawIn, [hr.cx, hr.cz]);
const dIn = hand(insideAt, yawIn, doorPt);
console.log(`\nINSIDE — entered the casino at (${insideAt[0].toFixed(2)}, ${insideAt[1].toFixed(2)})`
  + ` yaw ${yawIn.toFixed(3)} (along its own door's inward normal)`);
console.log(`  the HOTEL room is on your ${side(hIn)}`);
console.log(`  the PARTY DOORWAY to it is on your ${side(dIn)}`);
console.log(`  shots/w105-handed-inside.png`);

console.log(`\nVERDICT: outside the hotel is on your ${side(hOut)};`
  + ` inside the casino it is on your ${side(hIn)}.`);
console.log(side(hOut) === side(hIn)
  ? '  THEY AGREE — the handedness is not inverted between street and interior.'
  : '  THEY DISAGREE — this is the mismatch the user reported.');
await b.close();
