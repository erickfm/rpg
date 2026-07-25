// Walk every interior in the belt. Interiors cannot be verified from a
// screenshot (GOTCHAS §1) and floors/collision least of all (§7), so this
// drives the real rig: it walks up to the door on the street, presses E, and
// then walks the room until something stops it.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/interiors-walk.mjs [id]
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const FACE = 7.0, KERB_H = 0.14, RADIUS = 0.36;

// One entry per room. The slab centre is NOT hardcoded — it is discovered by
// walking in and reading where you land. Slabs are handed out in build order,
// so hardcoding them means every room's test breaks the day another builder's
// room is wired in ahead of yours, which with four agents on this programme is
// a matter of days.
const ROOMS = [
  {
    // the bodega's door is on a CHAMFER, so its [E] spot is not on an axis —
    // the harness reads it from ct/doors.ts like everything else
    // `keeper` is where a PLAYER STANDS to be served — the customer side of the corner counter.
    keeper: [3.90, 1.60],
    id: 'bodega', label: /BODEGA/, D: 8.4, front: ['BODEGA', 10, -95, 1], chamfer: true,
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — a stool-width out from the service counter.
    keeper: [-1.40, -1.00],
    id: 'diner', label: /DINER/, D: 7.0, front: ['DINER', 12, -49.5, -1],
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — in front of the order counter.
    keeper: [-2.33, -2.00],
    id: 'burger', label: /BURGER/, D: 8.5, front: ['BURGER BARN', 16, -29, -1],
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — at the till, where you are handed your change.
    keeper: [2.20, -1.75],
    id: 'thrift', label: /THRIFT/, D: 6.5, front: ['THRIFT', 12.5, -61.75, -1],
    // …and because "dense but walkable" is this room's whole risk, it also
    // gets its aisles walked: between rail rows, and down the open spine.
    aisles: [
      ['between the front two rails', 0.45],
      ['between the back two rails', -0.9],
      ['down the open spine to the till', 1.8],
    ],
  },
  // ── builder G's three, on the SIDE STREET (north side, facing −z) ──
  //
  // These sat finished and unreachable for a while: written, committed, and
  // never called from crosstown.ts. Their doors are on the side street rather
  // than the block, so the approaches run along x, not z.
  {
    // G's OWN spot, copied from scripts/G-rooms-walk.mjs — across the felt from the dealer
    keeper: [3.1, 1.6],
    id: 'casino', label: /GOLDEN ACES/, W: 10.5, D: 9.0,
    doorX: 51.29, doorZ: -97.0, at: -3.2, sideStreet: true,
  },
  {
    // G's OWN spot, copied from scripts/G-rooms-walk.mjs — the guest side of the reception desk
    keeper: [-3.6, -0.65],
    id: 'hotel', label: /ORPHEUS/, W: 11.0, D: 9.0,
    doorX: 39.51, doorZ: -97.0, at: -3.4, sideStreet: true,
  },
  {
    // room width stays G's explicit 10.0; only the door derives
    // G's OWN spot, copied from scripts/G-rooms-walk.mjs — the customer side of the counter
    keeper: [1.6, -1.6],
    id: 'pawn', label: /PAWN/, D: 8.0, W: 10.0, front: ['PAWN', 15, -60.5, 1],
  },
  {
    // G's OWN spot, copied from scripts/G-rooms-walk.mjs — the client chair
    keeper: [-2.6, -0.75],
    id: 'tax', label: /A-1 TAX/, D: 8.5, front: ['A-1 TAX', 13, -15.5, 1],
  },
];

// Rooms that name a building get their door and width DERIVED from the same
// published frontage the kit and the painter use. Hand-typed door positions in
// a test file go stale exactly the way they did in the rooms — three of them
// did, and a test asserting a stale number is worse than no test.
// The room filter is POSITIONAL, so it must skip flags. `process.argv[2]` took
// `--selftest` as a room name, matched nothing, and the run walked zero rooms.
// …and unknown flags are REFUSED, not skipped. Skipping them was half a fix:
// `--selftst` would drop out of the room filter AND out of the selftest test at
// :165, running the ordinary walk and exiting 0 — a selftest pass for a
// selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const rooms = only ? ROOMS.filter((r) => r.id === only) : ROOMS;
if (only && !rooms.length) {
  console.log(`no room called "${only}" — ids are: ${ROOMS.map((r) => r.id).join(', ')}`);
  process.exit(1);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'warning' && /\[interior:/.test(m.text())) errs.push('KIT WARNING: ' + m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);

for (const r of ROOMS) {
  if (!r.front) continue;
  const [name, w, cz, side] = r.front;
  // From the ROOM's declaration, which is the authority — the facade follows
  // it. Reading `frontageOf` here tested the old direction and failed every
  // room the moment it flipped.
  const d = await p.evaluate(async ([name, w]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    const decl = dm.declaredDoors().find((x) => x.building === name);
    return { z: dm.doorWorldFor(name), at: decl.at, W: dm.roomWidthFor(w) };
  }, [name, w]);
  const stand = await p.evaluate(async ([n]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    return dm.doorStandFor(n);
  }, [name]);
  r.doorX = stand ? stand.x : side * (FACE - 0.75);
  r.doorZ = stand ? stand.z : d.z;
  r.at = d.at; if (r.W === undefined) r.W = d.W;
  if (side > 0) r.east = true;
}

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };

const results = [];
let room = null;
const check = (name, ok, detail) => results.push([ok, `${room.id}: ${name}`, detail]);
const f2 = (n) => +n.toFixed(2);
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 };

// ASK the world how big each room is, do not remember it.
//
// This table carried a `W` and `D` per room, and the pawn shop's read
// "room width stays G's explicit 10.0". That explicit 10.0 was then removed
// from the room (358d82cc) so it takes the kit's rule, roomWidthFor(15) = 13.8
// — and this harness went on believing 10.0 and reported THREE ESCAPES from a
// room that was holding the player in perfectly well. The players stopped dead
// at local x -6.51, -6.53, -6.54: a wall at 6.9, exactly where 13.8 puts it.
//
// A containment check that invents its own idea of where the walls are will
// eventually accuse a sound room, and it did. The kit publishes the RESOLVED
// size now (`__ct.roomDims()`), which is the same fix as the doors: one
// authoring, asked for rather than copied.
const DIMS = await p.evaluate(() => window.__ct.roomDims());

// --selftest: wall every declared door shut from the STREET and require this
// to go red.
//
// This is the largest check I own — 195 assertions across eight rooms — and it
// was registered in scripts/checks.mjs with `false` in the selftest column,
// which by GOTCHAS 27's own closing line makes that column a to-do list I had
// not worked. The other five fire; this one had never been watched fail.
//
// The mutation is a collider pushed onto the LIVE __ct.colliders() over each
// building's PUBLISHED door stand point, so it is the real array the movement
// code tests and the real place a player walks to. Nothing else about the
// world changes: the rooms are still built, still furnished, still lit. Only
// the way in is gone — which is precisely the failure this script exists for,
// the one that had five modules shipped and unreachable.
if (SELFTEST) {
  const n = await p.evaluate(() => {
    let k = 0;
    for (const d of window.__ct.doors()) {
      if (!d.stand) continue;
      window.__ct.colliders().push({
        minX: d.stand.x - 1.4, maxX: d.stand.x + 1.4,
        minZ: d.stand.z - 1.4, maxZ: d.stand.z + 1.4 });
      k++;
    }
    return k;
  });
  console.log(`selftest: walled ${n} declared doors shut — this MUST now go red\n`);
}

for (room of rooms) {
  const built = DIMS.find((d) => d.id === room.id);
  if (!built) { check('the room was actually built', false, 'no room of that id in __ct.roomDims()'); continue; }
  const W = built.w, D = built.d;
  const hw = W / 2, hd = D / 2;
  let cx = 0;   // discovered on entry, below

  // ── 1. can you get in AT ALL, and from every direction someone would try ──
  //
  // This is the part the user actually hit: "cant go inside burger barn".
  // A trigger you can only reach from one angle is a trigger that does not
  // work (GOTCHAS §8 — the bodega's crates ate its door exactly this way).
  // Which way the pavement runs depends on which street the door is on. The
  // block's walks run along z; the side street's run along x. Getting this
  // wrong makes the approach tests walk into a wall and report the door
  // broken, which is exactly the wrong answer to give about a working door.
  const off = room.east ? -1.7 : 1.7;         // toward the road from the facade
  const approaches = room.sideStreet
    ? [
      // ON the door line, not offset off it. The side-street walk outside the
      // casino is pinched by a 0.4 m post at (50.0, -97.65): between the post
      // and the shopfront there is 1.15 m, which is 0.43 m of standing room
      // once the 0.72 m player is subtracted. The only continuous lane past it
      // runs at z = -97.0, which is the door line. Offsetting the test lane by
      // 0.3 or 0.75 put it inside the post and read as a broken door.
      ['walking east along the walk', room.doorX - 3.0, room.doorZ, Math.PI / 2],
      ['walking west along the walk', room.doorX + 3.0, room.doorZ, -Math.PI / 2],
      // the side street's north-side shops face -z, so you come at them from
      // the road side walking +z (yaw π), not -z
      ['straight at the door from the kerb', room.doorX, room.doorZ - 1.7, Math.PI],
    ]
    : [
      ['walking north up the walk', room.doorX + off * 0.18, room.doorZ + 3.0, 0],
      ['walking south down the walk', room.doorX + off * 0.18, room.doorZ - 3.0, Math.PI],
      ['straight at the door from the kerb', room.doorX + off, room.doorZ,
        room.east ? Math.PI / 2 : -Math.PI / 2],
    ];
  // Hold for 4 s, not the 1.5 s the walk actually takes. Citizens are SOLID
  // and one of them WILL be standing on this stretch of pavement sooner or
  // later — but `crowd.ts` turns a citizen non-solid once it has blocked you
  // for 1.4 s, so a player who keeps walking always gets through. A shorter
  // hold tests whether a pedestrian happened to be in the way, which is not a
  // question about the door.
  // The prompt is only up while you are within the trigger, and 4 s of walking
  // is 13 m — so this WATCHES for the prompt as it goes rather than reading it
  // at the end, which would just prove you had already walked past the door.
  // Nudge each start point to somewhere you could actually be standing. The
  // street is not empty: a car parked outside the hotel put the "from the
  // kerb" start inside a collider, the player could not take a step, and the
  // test reported a working door as broken. Same lesson as the citizen on the
  // burger barn's pavement — the harness must not assume the world is clear.
  // It backs off ALONG the approach — straight backwards, away from the door —
  // before it will consider stepping sideways, and it never steps sideways far.
  // The first version searched a plain ring and shifted the hotel's start 1.2 m
  // east to dodge the car, which walked the player up a line that never came
  // within the door's 1.05 m trigger: a working door, reported broken, by a
  // fix for the previous false alarm.
  const standableAt = (x, z, yaw) => p.evaluate(([x, z, yaw, R]) => {
    const cols = window.__ct.colliders();
    const free = (a, c) => !cols.some((k) =>
      a > k.minX - R && a < k.maxX + R && c > k.minZ - R && c < k.maxZ + R);
    if (free(x, z)) return { x, z };
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);          // the way we will walk
    for (let back = 0.4; back <= 6; back += 0.4) {
      for (const side of [0, 0.35, -0.35, 0.7, -0.7]) {     // stay near the door's line
        const nx = x - fx * back - fz * side;
        const nz = z - fz * back + fx * side;
        if (free(nx, nz)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }, [x, z, yaw, RADIUS]);

  // For the head-on approach, back up the door's own normal only as far as
  // there is pavement to stand on. A car is parked right outside the hotel and
  // the strip in front of it is barely a metre deep; starting on the far side
  // of the car and walking at the door just walks into the car, which says
  // nothing about the door. A player would step around onto the pavement, and
  // so does this.
  const backUpTheNormal = (dx, dz, yaw, want) => p.evaluate(([dx, dz, yaw, want, R]) => {
    const cols = window.__ct.colliders();
    const free = (a, c) => !cols.some((k) =>
      a > k.minX - R && a < k.maxX + R && c > k.minZ - R && c < k.maxZ + R);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let last = null;
    for (let d = 0.45; d <= want; d += 0.15) {
      const x = dx - fx * d, z = dz - fz * d;
      if (!free(x, z)) break;
      last = { x, z };
    }
    return last;
  }, [dx, dz, yaw, want, RADIUS]);

  // Two goes at each approach. Citizens are solid and one that happens to be
  // walking the same way as you never triggers the 1.4 s ghost timer — it just
  // stays a step ahead the whole length of the pavement. A second attempt
  // starts from a different moment in the crowd's cycle, which is enough. The
  // casino's east approach failed this way and its walk is otherwise clear:
  // the only thing on it was one 0.4 x 0.4 box, which is a person.
  for (const [how, sx0, sz0, yaw] of approaches) {
    const headOn = /from the kerb/.test(how);
    const backed = headOn ? await backUpTheNormal(room.doorX, room.doorZ, yaw, 2.6) : null;
    const { x: sx, z: sz } = backed ?? await standableAt(sx0, sz0, yaw);
    await warp(sx, sz, yaw, KERB_H);
    await p.waitForTimeout(160);
    await p.keyboard.down('w');
    let seen = null, at = null;
    for (let t = 0; t < 4000 && !seen; t += 130) {
      await p.waitForTimeout(130);
      const pr = await prompt();
      if (room.label.test(pr ?? '')) { seen = pr; at = await pos(); }
    }
    await p.keyboard.up('w');
    await p.waitForTimeout(120);
    if (!seen) {
      // second go
      await warp(sx, sz, yaw, KERB_H);
      await p.waitForTimeout(200);
      await p.keyboard.down('w');
      for (let t = 0; t < 4000 && !seen; t += 130) {
        await p.waitForTimeout(130);
        const pr = await prompt();
        if (room.label.test(pr ?? '')) { seen = pr; at = await pos(); }
      }
      await p.keyboard.up('w');
      await p.waitForTimeout(120);
    }
    check(`you can reach the door ${how}`, !!seen,
      seen ? `prompt "${seen}" came up at ${at.slice(0, 3).map(f2)}`
        : `walked the whole stretch TWICE and the door never announced itself (ended ${(await pos()).slice(0, 3).map(f2)})`);
  }

  // …and independently of any of that: prove nothing STATIC is sitting on the
  // trigger. This is the bodega bug (GOTCHAS §8) asked directly rather than
  // inferred from a walk that could fail for a dozen reasons.
  const onSpot = await p.evaluate(([x, z]) => {
    const R = 0.36;
    return window.__ct.colliders()
      .filter((c) => x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R)
      .map((c) => ({
        w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
        s: `x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}`,
      }));
  }, [room.doorX, room.doorZ]);
  // What counts as "parked on the trigger" is a PROP. Two things are expected
  // to be there and are not defects:
  //   · the building's own facade wall — the [E] spot stands 0.45 m off the
  //     wall face and you reach it from the pavement. Recognised by being
  //     structural: metres long in both directions, not furniture.
  //   · a citizen walking past, which is ~0.5 m square and gone a second later.
  // The first version of this filter recognised the wall by hardcoding the
  // WEST one's coordinates, so the east-side tax office reported its own
  // building as a defect.
  const statics = onSpot.filter((c) => {
    const structural = c.w > 4 || c.d > 4;
    const citizen = c.w > 0.4 && c.w < 0.6 && c.d > 0.4 && c.d < 0.6;
    return !structural && !citizen;
  }).map((c) => c.s);
  check('no static collider is parked on the [E] spot', statics.length === 0,
    statics.length ? statics.join(' | ') : `${onSpot.length} transient (citizen) overlaps, no props`);

  // and the spot really is on the PAINTED door, not merely somewhere near it
  await warp(room.doorX, room.doorZ, -Math.PI / 2, KERB_H);
  await p.waitForTimeout(200);
  check('the [E] prompt is up standing on the painted door',
    room.label.test((await prompt()) ?? ''), `at x=${f2(room.doorX)} z=${f2(room.doorZ)}`);

  await press();
  const inside = await pos();
  // slabs start at x = 400 and are 80 m wide; you land at the door of yours,
  // so the slab you are standing in tells you where the room is
  cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;
  check('E puts you inside a room in the interior belt',
    inside[0] >= 400 && Math.abs(inside[0] - cx) < 40,
    `pos=${inside.slice(0, 3).map(f2)} → slab centre ${cx}`);

  // ── 2. facing and floor ──
  const beforeF = await pos();
  await hold('w', 260);
  const afterF = await pos();
  check('you spawn facing INTO the room, not at the wall you came through',
    afterF[2] < beforeF[2] - 0.05, `forward moved z ${f2(beforeF[2])} → ${f2(afterF[2])}`);
  const gyIn = (await pos())[3];
  check('floor height inside is 0 — not sunk, not floating',
    Math.abs(gyIn) < 0.001, `gy=${gyIn}`);
  // gy is what the rig stands ON; prove the floor MESH agrees with it, or you
  // are standing on an invisible plane a few centimetres off the lino.
  const floorY = await p.evaluate((cx) => {
    let best = null;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.geometry?.parameters) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > 0.2 || Math.abs(wp.z) > 0.2) return;
      if (Math.abs(o.rotation.x + Math.PI / 2) > 0.01) return;   // faces up
      if (best === null || wp.y < best) best = wp.y;
    });
    return best;
  }, cx);
  check('the floor mesh is where the rig thinks the floor is',
    floorY !== null && Math.abs(floorY - gyIn) < 0.03,
    `floor mesh y=${floorY === null ? 'not found' : f2(floorY)}, rig gy=${gyIn}`);

  // ── 3. you cannot get out of the room, from ANYWHERE in it ──
  //
  // This replaces four hand-picked wall probes. Those needed a start point
  // that was clear of furniture, which meant knowing the layout — fine for a
  // room you wrote, useless for one you did not: pointed at builder G's
  // casino they started inside a blackjack table and reported the walls
  // broken. Six rooms by three authors and four more coming; the harness has
  // to find its own footing.
  //
  // So: ask the collider list where you can legally stand, take a spread of
  // those points, and run in all four directions from each. The invariant is
  // simply that you are still inside the room afterwards, which is the thing
  // the four probes were circling anyway.
  const standables = await p.evaluate(([cx, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    const out = [];
    for (let z = -hd + R; z <= hd - R; z += 0.45) {
      for (let x = -hw + R; x <= hw - R; x += 0.45) if (free(cx + x, z)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return out;
  }, [cx, hw, hd, RADIUS]);
  check('there is standable floor in the room at all', standables.length >= 6,
    `${standables.length} clear spots on a 0.45 m grid`);

  // a spread rather than all of them — six runs a room, evenly sampled
  const spread = standables.filter((_, i) => i % Math.max(1, Math.floor(standables.length / 6)) === 0).slice(0, 6);
  let escapes = 0, ranFrom = 0;
  for (const [lx, lz] of spread) {
    for (const key of ['-x', '+x', '-z', '+z']) {
      await warp(cx + lx, lz, YAW[key], 0);
      await p.waitForTimeout(90);
      await hold('w', 1800);
      const a = await pos();
      // "Out of the room" is past the OUTER face of the wall (T = 0.18), not
      // past the inner one. The doorway is a real reveal you can stand in —
      // the diner's lets you reach z = 3.28 against an inner face at 3.5 —
      // and calling that an escape fails a room for having a doorway.
      const ex = Math.abs(a[0] - cx) > hw + 0.18 + 0.05;
      const ez = Math.abs(a[2]) > hd + 0.18 + 0.05;
      if (ex || ez) {
        escapes++;
        if (escapes <= 3) check(`walked OUT of the room going ${key}`, false,
          `from local ${f2(lx)},${f2(lz)} ended at ${f2(a[0] - cx)},${f2(a[2])} — room is ${f2(hw)} x ${f2(hd)}`);
      }
    }
    ranFrom++;
  }
  check('the room holds you in, from every direction, everywhere in it',
    escapes === 0, `${ranFrom * 4} runs from ${ranFrom} spread points, ${escapes} escapes`);

  // the doorway is the one deliberate gap in the collider line, so it gets
  // walked at head-on as well
  // nearest standable spot to the DOORWAY, not merely to its x — picking by x
  // alone can start you at the back of the room behind a counter, walk you two
  // metres into it, and report the door broken.
  const nearDoor = (lx, lz) => Math.hypot(lx - room.at, lz - (hd - 1.3));
  const doorLane = standables.reduce((best, c) =>
    (best === null || nearDoor(c[0], c[1]) < nearDoor(best[0], best[1]) ? c : best), null);
  if (doorLane) {
    await warp(cx + room.at, doorLane[1], Math.PI, 0);
    await p.waitForTimeout(150);
    await hold('w', 3000);
    const doorRun = await pos();
    check('you cannot walk out through the doorway onto dead ground',
      doorRun[2] < hd + 0.4, `walking at the door reached z=${f2(doorRun[2])} (front wall at ${f2(hd)})`);
  }

  // ── 4. the room is walkable end to end ──
  //
  // The widest clear run in x that the room has, found rather than declared.
  const lane = await p.evaluate(([cx, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    let best = { z: 0, x0: 0, run: 0 };
    for (let z = -hd + R; z <= hd - R; z += 0.1) {
      let start = null, run = 0;
      for (let x = -hw + R; x <= hw - R; x += 0.1) {
        if (free(cx + x, z)) {
          if (start === null) { start = x; run = 0; }
          run += 0.1;
          if (run > best.run) best = { z: +z.toFixed(2), x0: +start.toFixed(2), run: +run.toFixed(2) };
        } else { start = null; run = 0; }
      }
    }
    return best;
  }, [cx, hw, hd, RADIUS]);
  check('the room has a clear run across most of its width',
    lane.run > W * 0.55, `widest clear run is ${f2(lane.run)} m at local z=${f2(lane.z)} (room is ${f2(W)} wide)`);

  for (const [what, from, yaw] of [
    ['end to end', lane.x0, Math.PI / 2],
    ['…and back the other way', lane.x0 + lane.run, -Math.PI / 2],
  ]) {
    await warp(cx + from, lane.z, yaw, 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    // long enough for the run that actually exists. A fixed 3.2 s is 10.56 m
    // at the walk speed, so the moment a room got wider than that the test
    // started reporting "blocked" for a player who had simply run out of
    // clock — which is what the burger barn did when the frontage rule took
    // it to 14.8 m.
    await hold('w', Math.round((lane.run / 3.3) * 1000) + 900);
    const a1 = await pos();
    check(`you can walk the room ${what}`, Math.abs(a1[0] - a0[0]) > lane.run * 0.8,
      `travelled ${f2(Math.abs(a1[0] - a0[0]))} m of a ${f2(lane.run)} m run`);
  }

  // ── 4b. the tight aisles, for rooms whose whole brief is being crowded ──
  //
  // "End to end" is satisfied by one clear lane, which is not enough for a
  // room designed to be a squeeze: a shop you can only cross by one route is a
  // corridor. Each declared aisle is walked in full.
  for (const [what, az] of room.aisles ?? []) {
    const half = hw - RADIUS;
    await warp(cx - half, az, Math.PI / 2, 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', Math.round((half * 2 / 3.3) * 1000) + 900);
    const a1 = await pos();
    check(`you can walk ${what}`, a1[0] - a0[0] > half * 1.5,
      `travelled ${f2(a1[0] - a0[0])} m of ${f2(half * 2)} (want > ${f2(half * 1.5)})`);
  }

  // ── 5. the way out, and NOT straight back in ──
  // start from the standable spot nearest the door and walk at it
  await warp(cx + room.at, doorLane ? doorLane[1] : lane.z, Math.PI, 0);
  await p.waitForTimeout(150);
  await hold('w', 2600);
  const dPrompt = await prompt();
  check('walking to the inside of the door raises the way-out prompt',
    /out to the street/.test(dPrompt ?? ''), `prompt=${JSON.stringify(dPrompt)}`);

  await press();
  const back = await pos();
  check('E at the inside door puts you back on the street', back[0] < 100,
    `pos=${back.slice(0, 3).map(f2)}`);
  // the corner return RAMPS down to the crossing, so a chamfered door's
  // landing legitimately sits part way between the walk and the road
  check('you land on the raised walk, not in the road',
    room.chamfer ? back[3] > -0.001 : Math.abs(back[3] - KERB_H) < 0.001, `gy=${back[3]}`);
  check('you are NOT standing in the re-entry trigger after stepping out',
    !room.label.test((await prompt()) ?? ''), `prompt=${JSON.stringify(await prompt())}`);
  await press();
  check('a second E on the landing does not suck you straight back in',
    (await pos())[0] < 100, `pos=${(await pos()).slice(0, 3).map(f2)}`);

  // …and the same orientation question for the landing: on the block the walk
  // runs along z and the road is across x; on the side street it is the other
  // way round. Testing a side-street landing with block directions just walks
  // it into the shopfront and calls the pavement boxed in.
  const landingDirs = room.sideStreet
    ? [['out to the road', 0], ['east along the walk', Math.PI / 2], ['west along the walk', -Math.PI / 2]]
    : [['out to the road', room.east ? -Math.PI / 2 : Math.PI / 2], ['up the walk', 0], ['down the walk', Math.PI]];
  for (const [what, yaw] of landingDirs) {
    // RETRIED, because the thing in your way may not be part of the building.
    //
    // 2 s rather than 0.5 s was the first fix here: a citizen is solid until it
    // has blocked you for 1.4 s (crowd.ts), and a half-second nudge reported
    // that as boxed-in pavement. It was not enough. This went red on the bodega
    // in a full run — "out to the road, moved 0.18 m" — and the landing is not
    // boxed in at all: eight consecutive attempts walked 2.4–3.6 m off it with
    // ZERO colliders ahead. What blocked that one run was a citizen or a car,
    // and the corner landings face live traffic.
    //
    // Crucially a static pre-check cannot see it: crowd and traffic actors are
    // NOT in `__ct.colliders()`, so "is anything in the way" is unanswerable
    // from the array this script reads. What IS answerable is the question the
    // check actually asks — is this landing SEALED — and a seal does not move.
    // So: up to three attempts, pass on the first that gets away. A real box
    // fails all three; a pedestrian fails at most the one it is standing in.
    let best = 0, a, c;
    for (let attempt = 0; attempt < 3 && best <= 0.9; attempt++) {
      await warp(back[0], back[2], yaw, KERB_H);
      await p.waitForTimeout(attempt ? 700 : 120);   // let a walker clear the landing
      a = await pos();
      await hold('w', 2000);
      c = await pos();
      best = Math.max(best, Math.hypot(c[0] - a[0], c[2] - a[2]));
    }
    check(`the landing is not boxed in — ${what}`, best > 0.9, `moved ${f2(best)} m`);
  }

  // ── 5b. the keeper is looking AT you, not away ──
  //
  // Three builders, one bug: the user found the tax preparer facing his back
  // wall, G found two of their four, I found ALL FOUR of mine — every one the
  // literal `facing: Math.PI`, which is -z, the wall behind their own till.
  //
  // DECODE IS H'S PUBLISHED LAYOUT VIA G (`64c13034`, `notes/H-atlas-facing.md`),
  // not my reading of it. `ct/citizens.ts` puts the column in `map.offset.x` and
  // the MIRROR FLAG in the sign of `map.repeat.x`:
  //
  //     mirror = repeat.x < 0
  //     col    = round(offset.x * 5) - (mirror ? 1 : 0)
  //
  // `[col, mirror]` is a bijection over the eight sectors, so one reading from a
  // known bearing pins the authored facing to ±22.5°. Thresholding `offset.x`
  // alone does NOT: 0.8 is col 4 or col 3 mirrored, same number, two answers.
  // I shipped that version to myself first and it passed with the bug put back.
  //
  // `keeper` IS AUTHORED PER ROOM AND THAT IS DELIBERATE. It is where a PLAYER
  // STANDS TO BE SERVED, which room geometry does not contain — and I proved
  // that by trying twice to derive it.
  //
  // ALL EIGHT ROOMS ARE COVERED, including G's four. I first wrote "G's four are
  // covered by G's own harness" — and `scripts/checks-registered.mjs` says
  // `G-rooms-walk.mjs` "has a --selftest and is in no tier of npm run checks",
  // i.e. runs exactly never. So that sentence was false and G's keepers were
  // guarded by nothing. Their four spots below are G's OWN, copied from their
  // file rather than derived by me, because the whole lesson of the two failed
  // attempts is that this coordinate belongs to whoever built the room. "Between the keeper and the room centre"
  // reported G's casino as `in profile` when G has verified it reads `facing
  // you`: the dealer stands across the felt. A room with no `keeper` here is
  // SKIPPED rather than guessed at; G's four are covered by G's own harness.
  // GOTCHAS 34, shape two: a room that simply OMITS `keeper` used to be skipped
  // in silence, so a ninth room would arrive unguarded and nothing would say
  // so — a check passing because it found nothing to check, in code written one
  // commit after I hit that exact bug elsewhere in this file ("0/0 passed" for
  // a world with every door sealed).
  //
  // Absent is now a FAILURE. A room with nobody in it is a real possibility, so
  // there is an explicit opt-out — `keeper: null` — which is recorded rather
  // than skipped. The distinction that matters is between "declared unstaffed"
  // and "nobody thought about it", and only one of those should be quiet.
  if (room.keeper === undefined) {
    check('declares where a customer stands (keeper: [x,z], or null if unstaffed)',
      false, 'no `keeper` in the ROOMS entry — the facing check cannot run');
  } else if (room.keeper === null) {
    check('is declared unstaffed', true, 'keeper: null — no facing check, by declaration');
  } else {
    const [kvx, kvz] = room.keeper;
    await warp(cx + kvx, kvz, 0, 0);
    await p.waitForTimeout(150);
    // the sprite picks its column from where the CAMERA is, so it needs frames
    // after the warp — reading immediately gets the view from the last position
    await hold('w', 60);
    await p.waitForTimeout(500);
    const v = await p.evaluate(([sx, sz]) => {
      const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
      let best = null;
      sc.traverse((o) => {
        if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m?.map?.image || m.map.image.width !== 160) return;   // the atlas
        const wp = new o.position.constructor(); o.getWorldPosition(wp);
        const d = Math.hypot(wp.x - sx, wp.z - sz);
        if (d > 4 || (best && d >= best.d)) return;
        const mirror = m.map.repeat.x < 0;
        best = { d: +d.toFixed(2), mirror,
          col: Math.round(m.map.offset.x * 5) - (mirror ? 1 : 0), x: wp.x, z: wp.z };
      });
      return best;
    }, [cx + kvx, kvz]);
    const SECTOR = { '0f': 0, '1f': 1, '2f': 2, '3f': 3, '4f': 4, '3t': 5, '2t': 6, '1t': 7 };
    const WHAT = ['facing you', 'three-quarter on', 'in profile', 'three-quarter away',
      'facing away', 'three-quarter away', 'in profile', 'three-quarter on'];
    const sec = v ? SECTOR[`${v.col}${v.mirror ? 't' : 'f'}`] : undefined;
    let detail = 'no atlas figure within 4 m of the customer spot';
    if (sec !== undefined) {
      const a = Math.atan2((cx + kvx) - v.x, kvz - v.z) - sec * Math.PI / 4;
      detail = `col ${v.col}${v.mirror ? ' mirrored' : ''} → sector ${sec}, ${WHAT[sec]}`
        + ` — authored facing ${f2(Math.atan2(Math.sin(a), Math.cos(a)))} rad ±0.39, ${v.d} m away`;
    }
    check('the keeper is looking at you, not away',
      sec === 0 || sec === 1 || sec === 7, detail);
  }

  // ── 6. the room keeps its light after dark ──
  const sample = () => p.evaluate((cx) => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.color && !m.transparent) out.push(m.color.getHex());
    });
    return out;
  }, cx);
  await p.evaluate(() => window.__ct.clock(12, 0));
  await p.waitForTimeout(500);
  const noon = await sample();
  await p.evaluate(() => window.__ct.clock(2, 0));
  await p.waitForTimeout(900);
  const night = await sample();
  const dimmed = noon.filter((c, i) => night[i] !== undefined && night[i] !== c).length;
  check('the room keeps its own light after dark', dimmed === 0,
    `${dimmed}/${noon.length} interior materials dimmed by the night sweep`);
  await p.evaluate(() => window.__ct.clock(13, 20));
}

console.log('');
for (const [ok, name, detail] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}\n        ${detail}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
// AN EMPTY RUN IS NOT A PASS.
//
// This printed "0/0 passed" and exited 0 when it walked no rooms at all —
// found while writing the selftest, whose flag the positional filter had
// swallowed. The same green would have come back from a typo'd room name, and
// from a world where every door had been sealed: the more completely broken
// the world, the fewer assertions run, and at total failure the count reaches
// zero and the check reports success.
//
// That is the worst shape a check can have, and it is the one this script was
// written to catch in the WORLD — five modules shipped unreachable because
// nothing asked. It should not have had it too.
if (!results.length) {
  console.log('NO CHECKS RAN AT ALL. That is a failure, not a pass — the harness');
  console.log('never reached a room. Expected ' + rooms.length + ' room(s).');
  process.exit(1);
}
if (errs.length) console.log('\npage errors / kit warnings:\n  ' + errs.slice(0, 8).join('\n  '));
await b.close();
process.exit(bad || errs.length ? 1 : 0);
