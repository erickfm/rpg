// Walk every interior in the belt. Interiors cannot be verified from a
// screenshot (GOTCHAS §1) and floors/collision least of all (§7), so this
// drives the real rig: it walks up to the door on the street, presses E, and
// then walks the room until something stops it.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/interiors-walk.mjs [id]
import { chromium } from 'playwright';

const FACE = 7.0, KERB_H = 0.14, RADIUS = 0.36;

// One entry per room. The slab centre is NOT hardcoded — it is discovered by
// walking in and reading where you land. Slabs are handed out in build order,
// so hardcoding them means every room's test breaks the day another builder's
// room is wired in ahead of yours, which with four agents on this programme is
// a matter of days.
const ROOMS = [
  {
    id: 'diner', label: /DINER/, W: 8.6, D: 7.0,
    doorX: -(FACE - 0.45), doorZ: 9.6, at: -2.6,
  },
  {
    id: 'burger', label: /BURGER/, W: 11.0, D: 8.5,
    doorX: -(FACE - 0.45), doorZ: -28.25, at: -3.6,
  },
  {
    id: 'thrift', label: /THRIFT/, W: 8.0, D: 6.5,
    doorX: -(FACE - 0.45), doorZ: -74.94, at: -2.2,
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
    id: 'casino', label: /GOLDEN ACES/, W: 10.5, D: 9.0,
    doorX: 51.29, doorZ: -97.0, at: -3.2, sideStreet: true,
  },
  {
    id: 'hotel', label: /ORPHEUS/, W: 11.0, D: 9.0,
    doorX: 39.51, doorZ: -97.0, at: -3.4, sideStreet: true,
  },
  {
    id: 'tax', label: /A-1 TAX/, W: 12.0, D: 8.5,
    // EAST side of the block, so the facade is at +7.0 and you approach from +x
    doorX: FACE - 0.45, doorZ: -15.25, at: -4.2, east: true,
  },
];

const only = process.argv[2];
const rooms = only ? ROOMS.filter((r) => r.id === only) : ROOMS;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'warning' && /\[interior:/.test(m.text())) errs.push('KIT WARNING: ' + m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

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

for (room of rooms) {
  const { W, D } = room;
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
      ['walking east along the walk', room.doorX - 3.0, room.doorZ - 0.3, Math.PI / 2],
      ['walking west along the walk', room.doorX + 3.0, room.doorZ - 0.3, -Math.PI / 2],
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
    check(`you can reach the door ${how}`, !!seen,
      seen ? `prompt "${seen}" came up at ${at.slice(0, 3).map(f2)}`
        : `walked the whole stretch and the door never announced itself (ended ${(await pos()).slice(0, 3).map(f2)})`);
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
    await hold('w', 3200);
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
    await hold('w', 3200);
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
  check('you land on the raised walk, not in the road',
    Math.abs(back[3] - KERB_H) < 0.001, `gy=${back[3]}`);
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
    await warp(back[0], back[2], yaw, KERB_H);
    await p.waitForTimeout(120);
    const a = await pos();
    // 2 s, not 0.5 s: a citizen standing on the landing is solid until it has
    // been in your way for 1.4 s (crowd.ts), and a half-second nudge reports
    // that as boxed-in pavement. This failed exactly that way on the tax
    // office in a full run while passing on its own.
    await hold('w', 2000);
    const c = await pos();
    check(`the landing is not boxed in — ${what}`,
      Math.hypot(c[0] - a[0], c[2] - a[2]) > 0.9,
      `moved ${f2(Math.hypot(c[0] - a[0], c[2] - a[2]))} m`);
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
if (errs.length) console.log('\npage errors / kit warnings:\n  ' + errs.slice(0, 8).join('\n  '));
await b.close();
process.exit(bad || errs.length ? 1 : 0);
