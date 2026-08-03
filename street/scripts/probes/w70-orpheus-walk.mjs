#!/usr/bin/env node
// ITEM 196 — WALK THE ORPHEUS PARTY WALL. Both ways, and prove it is a DOORWAY
// and not a hole in the world.
//
// The user: *"i should be able to walk from one into the other."* That is a
// movement claim, and BUILDER-BRIEF §10 is explicit that movement is walked,
// never screenshotted. Five legs:
//
//   1. hotel  -> casino  through the opening
//   2. casino -> hotel   back again
//   3. the party wall is SOLID 4 m off the opening, both rooms
//   4. the opening is at least 2 m of clear lane — walked at +/-0.9 m of z
//   5. neither room lost its own street door (the way-out [E] still resolves)
//
// Reads the opening out of the world (`__ct.roomDims`) plus ct/interior.ts's
// own PARTY declaration, so it cannot drift from what was built. It does NOT
// re-type the coordinates.
//
//   SHOT_URL=http://localhost:4260/ node scripts/probes/w70-orpheus-walk.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

// the declaration, from the source that built it — one authoring (BRIEF §8)
const src = readFileSync(new globalThis.URL('../../src/proto/ct/interior.ts', import.meta.url), 'utf8');
const m = src.match(/\{\s*west:\s*'(\w+)',\s*east:\s*'(\w+)',\s*at:\s*(-?[\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)\s*\}/);
if (!m) { console.error('could not read the PARTY declaration out of ct/interior.ts'); process.exit(3); }
const PW = { west: m[1], east: m[2], at: +m[3], w: +m[4], h: +m[5] };
console.log(`\n  PARTY WALL as declared: ${PW.west} | ${PW.east}   opening z ${PW.at} +/- ${PW.w / 2}, ${PW.h} m tall\n`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const dims = await p.evaluate(() => window.__ct.roomDims());
const pick = (id) => dims.find((d) => d.id === id);
const west = pick(PW.west), east = pick(PW.east);
if (!west || !east) { console.error('rooms missing from the belt'); process.exit(1); }

const seam = west.cx + west.w / 2;                 // where the wall starts
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2 };
const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y), [x, z, yaw]);
const holdUntil = async (k, ready, capMs) => {
  await p.keyboard.down(k);
  const t0 = Date.now();
  let hit = false;
  while (Date.now() - t0 < capMs) { await p.waitForTimeout(80); if (await ready()) { hit = true; break; } }
  await p.keyboard.up(k); await p.waitForTimeout(150);
  return hit;
};

const out = [];
const check = (ok, name, detail) => { out.push([ok, name, detail]); console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

// ── legs 1 and 2: through, both ways ──────────────────────────────────────
//
// THE FIRST VERSION OF THIS PASSED A MUTATION IT SHOULD HAVE FAILED, and the
// reason is worth keeping. Moving the declared opening to z −14 puts it past
// the hotel's own back wall (z −13), so the kit correctly refused to cut it and
// built the flank solid — and the probe still walked "through", because warping
// to z −14 had put the player in the DEAD GROUND behind the room, where there
// is no wall to stop anyone. The walk was real; it was just not in the rooms.
// So every leg now asserts the whole traverse happens INSIDE both rooms' depth.
// (GOTCHAS 34: a check that measures nothing says so in green.)
const inBoth = (z) => Math.abs(z - west.cz) < west.d / 2 && Math.abs(z - east.cz) < east.d / 2;
const through = async (from, to, dir, z) => {
  if (!inBoth(z)) return { arrived: false, x: NaN, z, why: 'z is outside one of the rooms' };
  const start = dir > 0 ? from.cx : from.cx;        // middle of the room we start in
  await warp(start, z, dir > 0 ? YAW['+x'] : YAW['-x']);
  await p.waitForTimeout(200);
  const goal = dir > 0 ? to.cx : to.cx;
  await holdUntil('w', async () => {
    const [x] = await pos();
    return dir > 0 ? x >= goal : x <= goal;
  }, 14000);
  const [x, , zz] = await pos();
  // and it must have stayed in the rooms, not walked round the back of them
  const arrived = (dir > 0 ? x >= goal - 0.4 : x <= goal + 0.4) && inBoth(zz);
  return { arrived, x: +x.toFixed(2), z: +zz.toFixed(2) };
};

let r = await through(west, east, +1, PW.at);
check(r.arrived, `${PW.west} -> ${PW.east}: walked through the opening`,
  `rest x ${r.x} (target ${east.cx}), z ${r.z}`);

r = await through(east, west, -1, PW.at);
check(r.arrived, `${PW.east} -> ${PW.west}: walked back through it`,
  `rest x ${r.x} (target ${west.cx}), z ${r.z}`);

// ── leg 3: and it is a WALL everywhere else ───────────────────────────────
const blocked = async (room, dir, z) => {
  await warp(room.cx, z, dir > 0 ? YAW['+x'] : YAW['-x']);
  await p.waitForTimeout(200);
  await holdUntil('w', async () => false, 4200);      // just walk into it
  const [x] = await pos();
  return +x.toFixed(2);
};
const offZ = PW.at + PW.w / 2 + 2.0;                 // 2 m clear of the opening's edge
let xr = await blocked(west, +1, offZ);
check(xr < seam, `${PW.west}: the party wall is solid ${(offZ - PW.at).toFixed(1)} m off the opening`,
  `stopped at x ${xr}, wall face ${seam.toFixed(2)}`);
xr = await blocked(east, -1, offZ);
check(xr > east.cx - east.w / 2 - 0.5, `${PW.east}: solid from its side too`,
  `stopped at x ${xr}, its west face ${(east.cx - east.w / 2).toFixed(2)}`);

// ── leg 4: the doorway is a LANE, not a slot ──────────────────────────────
for (const dz of [-0.9, 0.9]) {
  const rr = await through(west, east, +1, PW.at + dz);
  check(rr.arrived, `the opening passes a body walking ${dz > 0 ? '+' : '-'}0.9 m off its centreline`,
    `rest x ${rr.x}, z ${rr.z}`);
}

// ── leg 5: both rooms still have their own way out to the street ──────────
//
// NOT "is any prompt live" — that passed vacuously on the first run, because
// the ATM's spot reports ok() true from anywhere in the world and it was the
// first thing in the list (GOTCHAS 34). The kit's way-out spot is labelled
// 'out to the street' and its ok() is `player.x() >= x0 && player.x() < x1`,
// the room's own SLAB — which is exactly the thing shoving a room to the slab
// edge could have broken. So: standing in each room, EXACTLY ONE way-out spot
// must be live, and it must be within reach of that room's front wall.
for (const id of [PW.west, PW.east]) {
  const room = pick(id);
  await warp(room.cx, room.cz + room.d / 2 - 1.2, Math.PI);
  await p.waitForTimeout(300);
  const outs = await p.evaluate(() => window.__ct.spots()
    .filter((s) => s.ok && s.label === 'out to the street')
    .map((s) => ({ x: s.x, z: s.z, r: s.r })));
  const near = outs.filter((s) => Math.abs(s.x - room.cx) < room.w);
  check(outs.length === 1 && near.length === 1,
    `${id}: exactly one 'out to the street' is live, and it is this room's`,
    `${outs.length} live, ${near.length} of them inside this room's width`);
}

await b.close();
const bad = out.filter(([ok]) => !ok).length;
console.log(`\n  ${out.length - bad}/${out.length} legs passed\n`);
process.exit(bad ? 1 : 0);
