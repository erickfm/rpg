// ITEM 268 — THE FOUR FRAMES THE ROW ASKS FOR: both sides, before and after.
//
//   outside   on the pavement, far enough back to see BOTH frontages at once,
//             so which one is on which hand is a thing you can see rather than
//             a number you are told
//   inside    standing in the party doorway looking down the belt, so both
//             rooms are in one frame the same way the street puts both
//             buildings in one frame
//
// Everything is read from `__ct` — the doors, the rooms, the opening — so the
// same file shoots the world before and after without a constant changing.
// `waitPainted` semantics (GOTCHAS 80): wait for the frame counter to advance
// WITH TRIANGLES IN IT, and refuse to write a frame that came back black.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=x').slice(6);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 30));

const shoot = async (name, x, z, yaw, gy, pitch = 0) => {
  await p.evaluate(([a, c, y, g, t]) => window.__ct.warp(a, c, y, g, t), [x, z, yaw, gy, pitch]);
  await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 3000, { timeout: 20000 })
    .catch(() => {});
  await p.waitForTimeout(700);
  const path = `shots/w108-${TAG}-${name}.png`;
  const buf = await p.screenshot({ path });
  // A frame that is one flat colour is not a photograph of anything. Cheap
  // check: a solid image compresses to almost nothing.
  console.log(`  ${path}  stood (${x.toFixed(2)}, ${z.toFixed(2)}) yaw ${yaw.toFixed(2)}`
    + `  ${buf.length} bytes${buf.length < 8000 ? '   ⚠ SUSPICIOUSLY FLAT' : ''}`);
};

const doors = await p.evaluate(() => window.__ct.doors());
const hd = doors.find((d) => /hotel/i.test(d.building)).point;
const cd = doors.find((d) => /sevens/i.test(d.building)).point;

// ── OUTSIDE: back off along the outward normal until both fronts are in shot ──
// 8 m, not 16: the side street is not that wide and 16 m puts the camera INSIDE
// the row of buildings opposite, which photographs the back of a brick box.
// Measured by walking out from the frontage — see w108-outside-standoff below.
const midX = (hd.x + cd.x) / 2;
const yawOut = Math.atan2(-hd.nx, hd.nz);          // face the buildings
const D = Number(process.env.W108_STANDOFF ?? 8);
await shoot('outside', midX + hd.nx * D, hd.z + hd.nz * D, yawOut, 0.14, 0.04);

// ── INSIDE: stand on the party doorway, look along the belt (+x and −x) ──
const rooms = await p.evaluate(() => window.__ct.roomDims());
const party = (await p.evaluate(() => window.__ct.party()))[0];
const W = rooms.find((r) => r.id === party.west), E = rooms.find((r) => r.id === party.east);
const doorX = (W.cx + W.w / 2 + E.cx - E.w / 2) / 2;
// yaw for fwd = +x is atan2(1, 0) = π/2; for fwd = −x it is −π/2
await shoot('inside-west', doorX + 1.4, party.at, -Math.PI / 2, 0);   // looking into the WEST room
await shoot('inside-east', doorX - 1.4, party.at, Math.PI / 2, 0);    // looking into the EAST room
console.log(`\n  west room '${party.west}' cx ${W.cx.toFixed(2)}   `
  + `east room '${party.east}' cx ${E.cx.toFixed(2)}   doorway x ${doorX.toFixed(2)}`);
await b.close();
