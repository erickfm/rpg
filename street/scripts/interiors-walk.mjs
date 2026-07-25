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
    // a start point that is genuinely clear of furniture, and the lane it sits on
    lane: -0.35, laneHalf: 3.6,
    backProbeX: 3.8, frontProbeX: -3.0,
  },
  {
    id: 'burger', label: /BURGER/, W: 11.0, D: 8.5,
    doorX: -(FACE - 0.45), doorZ: -28.25, at: -3.6,
    lane: -1.6, laneHalf: 4.8,
    backProbeX: -4.6, frontProbeX: -4.6,
  },
  {
    id: 'thrift', label: /THRIFT/, W: 8.0, D: 6.5,
    doorX: -(FACE - 0.45), doorZ: -74.94, at: -2.2,
    // the clear cross-room lane runs in FRONT of the rails, between them and
    // the window — the rails themselves are meant to be a squeeze
    lane: 2.4, laneHalf: 3.3,
    backProbeX: 0.6, frontProbeX: -3.2,
    // …and because "dense but walkable" is this room's whole risk, it also
    // gets its aisles walked: between rail rows, and down the open spine.
    aisles: [
      ['between the front two rails', 0.45, 3.3],
      ['between the back two rails', -0.9, 3.3],
      ['down the open spine to the till', 1.8, null],
    ],
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
  const approaches = [
    ['walking north up the walk', room.doorX + 0.3, room.doorZ + 3.0, 0],
    ['walking south down the walk', room.doorX + 0.3, room.doorZ - 3.0, Math.PI],
    ['straight at the door from the kerb', room.doorX + 1.7, room.doorZ, -Math.PI / 2],
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
  for (const [how, sx, sz, yaw] of approaches) {
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
      // the building's own facade wall is supposed to be there — the [E] spot
      // stands 0.45 m off the wall face and the player reaches it from the walk
      .filter((c) => !(c.minX < -14 || c.maxX > 200))
      .map((c) => `x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}`);
  }, [room.doorX, room.doorZ]);
  // a citizen walking over it is not a defect; a prop parked on it is
  const statics = onSpot.filter((s) => {
    const m = s.match(/x (-?[\d.]+)\.\.(-?[\d.]+)/);
    return !(m && +m[2] - +m[1] > 0.4 && +m[2] - +m[1] < 0.6);   // citizen boxes are ~0.5 wide
  });
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

  // ── 3. the walls hold ──
  const probe = async (lx, lz, key, axis, limit, sign) => {
    await warp(cx + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', 3000);
    const a = await pos();
    const moved = Math.hypot(a[0] - a0[0], a[2] - a0[2]);
    const v = axis === 'x' ? a[0] - cx : a[2];
    const escaped = sign > 0 ? v > limit : v < -limit;
    check(`wall holds walking ${key}`, !escaped && moved > 0.3,
      moved <= 0.3
        ? `HARNESS: never left the start point — stuck in furniture at local ${f2(lx)},${f2(lz)}`
        : `walked ${f2(moved)} m, stopped at local ${axis}=${f2(v)} (wall at ${sign > 0 ? '' : '-'}${f2(limit)})`);
  };
  await probe(0, room.lane, '-x', 'x', hw - RADIUS + 0.05, -1);
  await probe(0, room.lane, '+x', 'x', hw - RADIUS + 0.05, 1);
  await probe(room.backProbeX, room.lane, '-z', 'z', hd - RADIUS + 0.05, -1);
  await probe(room.frontProbeX, room.lane, '+z', 'z', hd - RADIUS + 0.05, 1);

  // the doorway is the one gap in the collider line — the one place it leaks
  await warp(cx + room.at, room.lane, Math.PI, 0);
  await p.waitForTimeout(150);
  await hold('w', 3000);
  const doorRun = await pos();
  check('you cannot walk out through the doorway onto dead ground',
    doorRun[2] < hd + 0.4, `walking at the door reached z=${f2(doorRun[2])} (front wall at ${f2(hd)})`);

  // ── 4. the room is walkable end to end ──
  await warp(cx - room.laneHalf, room.lane, Math.PI / 2, 0);
  await p.waitForTimeout(150);
  const laneA = await pos();
  await hold('w', 3200);
  const laneB = await pos();
  check('you can walk the room end to end', laneB[0] - laneA[0] > room.laneHalf * 1.6,
    `travelled ${f2(laneB[0] - laneA[0])} m (want > ${f2(room.laneHalf * 1.6)})`);
  await warp(cx + room.laneHalf, room.lane, -Math.PI / 2, 0);
  await p.waitForTimeout(150);
  const backA = await pos();
  await hold('w', 3200);
  const backB = await pos();
  check('…and back the other way', backA[0] - backB[0] > room.laneHalf * 1.6,
    `travelled ${f2(backA[0] - backB[0])} m`);

  // ── 4b. the tight aisles, for rooms whose whole brief is being crowded ──
  //
  // "End to end" is satisfied by one clear lane, which is not enough for a
  // room designed to be a squeeze: a shop you can only cross by one route is a
  // corridor. Each declared aisle is walked in full.
  for (const [what, az, halfOrNull] of room.aisles ?? []) {
    const half = halfOrNull ?? room.laneHalf;
    await warp(cx - half, az, Math.PI / 2, 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', 3200);
    const a1 = await pos();
    check(`you can walk ${what}`, a1[0] - a0[0] > half * 1.5,
      `travelled ${f2(a1[0] - a0[0])} m of ${f2(half * 2)} (want > ${f2(half * 1.5)})`);
  }

  // ── 5. the way out, and NOT straight back in ──
  await warp(cx + room.at, room.lane, Math.PI, 0);
  await p.waitForTimeout(150);
  await hold('w', 2000);
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

  for (const [what, yaw] of [['out to the road', Math.PI / 2], ['up the walk', 0], ['down the walk', Math.PI]]) {
    await warp(back[0], back[2], yaw, KERB_H);
    await p.waitForTimeout(120);
    const a = await pos();
    await hold('w', 500);
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
