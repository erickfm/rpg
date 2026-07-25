// Walk builder G's interiors — the casino and the hotel lobby.
//
// Interiors cannot be verified from a screenshot (GOTCHAS §1) and floors and
// collision least of all (§7), so this drives the real rig: it walks UP to the
// door on the street, presses E, and then walks the room until something stops
// it. It never warps onto a trigger — warp does no collision resolution, so
// warping onto a spot proves only that the number was typed correctly.
//
// F's scripts/interiors-walk.mjs does the same for the rooms F owns. That file
// is F's; this one is mine. Same shape on purpose, including F's harness fix:
// a probe that never moved has not tested anything, it started inside a
// collider's 0.36 m pad, and that fails loudly instead of reporting "the wall
// held" having never taken a step.
//
// Usage: SHOT_URL=http://localhost:4186/ node scripts/G-rooms-walk.mjs [id]
import { chromium } from 'playwright';

const KERB_H = 0.14, RADIUS = 0.36;

// One entry per room. `cx` is NOT hard-coded — the slab a room gets depends on
// the order rooms are built in crosstown.ts, and that order changes every time
// another builder lands one. It is read back from where the player actually
// arrives instead.
const ROOMS = [
  {
    id: 'casino', label: /GOLDEN ACES/, W: 10.5, D: 9.0, H: 2.5,
    doorX: 51.29, doorZ: -97.0, at: -3.2, hasWindow: false,
    // a z that is clear right across the room, for the ±x wall probes
    clearZ: 3.0,
    // an x clear of furniture, for the ±z wall probes
    frontProbeX: 0, backProbeX: -3.0, backProbeZ: -3.0,
    doorApproach: [-3.2, 2.4],
    lanes: [
      ['the aisle between the slot banks, east', -4.2, -0.35, '+x', 2200, 'x', 4.6],
      ['…and back west', 0.9, -0.35, '-x', 2200, 'x', 4.6],
      ['the gap between the banks and the felt table', 1.5, 3.0, '-z', 2200, 'z', 3.0],
      ['the aisle in front of the cage', -4.2, -3.0, '+x', 2200, 'x', 4.6],
      ['past the felt table on the east wall side', 4.6, 3.0, '-z', 2200, 'z', 3.0],
    ],
  },
  {
    id: 'hotel', label: /ORPHEUS/, W: 11.0, D: 9.0, H: 3.4,
    doorX: 39.51, doorZ: -97.0, at: -3.4, hasWindow: true,
    clearZ: -3.9,
    frontProbeX: -1.6, backProbeX: -1.6, backProbeZ: 0,
    doorApproach: [-3.4, 2.4],
    lanes: [
      ['along the reception desk, toward the back', -3.0, 3.0, '-z', 2400, 'z', 5.0],
      ['…and back toward the door', -3.0, -3.6, '+z', 2400, 'z', 5.0],
      ['across the lobby in front of the lift', -4.5, -3.9, '+x', 2600, 'x', 7.0],
      ['between the chairs and the east wall', 4.3, 3.4, '-z', 2000, 'z', 3.0],
      ['behind the chairs, along the window', 0, 3.85, '+x', 1600, 'x', 2.5],
    ],
  },
  {
    id: 'tax', label: /A-1 TAX/, W: 12.0, D: 8.5, H: 2.75,
    doorX: 7.0 - 0.45, doorZ: -15.25, at: -4.2, hasWindow: true,
    clearZ: 2.5,
    frontProbeX: -1.6, backProbeX: 4.0, backProbeZ: 0,
    doorApproach: [-4.2, 2.4],
    // the walk out is south along the EAST walk, so the landing probes differ
    landing: [['out across the street', -Math.PI / 2, false], ['south along the walk', 0, true], ['north along the walk', Math.PI, true]],
    lanes: [
      ['between the two desks', -0.6, 2.5, '-z', 2000, 'z', 4.0],
      ['the staff lane behind the desks', -4.5, -2.8, '+x', 2200, 'x', 6.0],
      ['across the front of the office', -5.0, 2.5, '+x', 3400, 'x', 9.0],
      ['east of the desks, down to the plant', 4.0, 2.5, '-z', 2000, 'z', 4.0],
    ],
  },
  {
    id: 'pawn', label: /PAWN/, W: 10.0, D: 8.0, H: 2.8,
    doorX: 7.0 - 0.45, doorZ: -59.06, at: -0.06, hasWindow: true,
    // the customer floor — the whole front of the room now, not a corridor
    clearZ: 2.0,
    // an x on the front wall that is solid: the door is at -0.06 and the
    // window spans 0.8 to 4.4, so -3.0 is pier
    frontProbeX: -3.0, frontProbeZ: 2.0,
    // the back wall is behind the counter and reaching it is what the room
    // prevents — asserted under noGo instead
    skipBack: true,
    doorApproach: [-0.06, 2.0],
    landing: [['out across the street', -Math.PI / 2, false], ['south along the walk', 0, true], ['north along the walk', Math.PI, true]],
    lanes: [
      ['across the customer floor, east', -4.2, 2.0, '+x', 2600, 'x', 7.5],
      ['…and back west', 4.2, 2.0, '-x', 2600, 'x', 7.5],
      ['from the door down to the case', -0.06, 3.2, '-z', 2000, 'z', 4.0],
      ['round the west side of the floor case', -4.3, 2.6, '-z', 2000, 'z', 4.0],
      ['between the floor case and the counter', 0.9, 0.0, '-x', 1800, 'x', 3.5],
    ],
    // the whole point of the room: the stock is behind the counter and stays
    // there, and the counter runs wall to wall so there is no way round it
    noGo: [
      ['you cannot get behind the counter in the middle', -0.06, -1.4, '-z', 1600, 'z', 1.2],
      ['…nor at the west end', -4.5, -1.4, '-z', 1600, 'z', 1.2],
      ['…nor at the east end', 4.5, -1.4, '-z', 1600, 'z', 1.2],
    ],
  },
];

const only = process.argv[2];
const rooms = only ? ROOMS.filter((r) => r.id === only) : ROOMS;
if (!rooms.length) { console.error(`no such room: ${only}`); process.exit(2); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
const kitWarns = [];
p.on('console', (m) => { if (/\[interior:/.test(m.text())) kitWarns.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4186/', { waitUntil: 'networkidle' });
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
  const hw = room.W / 2, hd = room.D / 2;
  const LIMX = hw - RADIUS + 0.02, LIMZ = hd - RADIUS + 0.02;

  // ── the way in ───────────────────────────────────────────────────────
  //
  // Walk in SHORT steps and stop the moment the prompt comes up, rather than
  // holding 'w' for a fixed time and reading the prompt at the end. A fixed
  // hold covers ~3 m at walking pace, which sails straight through a 1.05 m
  // trigger and out the far side — and it only ever passed on the rooms where
  // something happened to stop the player mid-walk. The pawn shop's stretch of
  // walk is clear, so it overshot and the room looked broken when it was not.
  await warp(room.doorX, room.doorZ - 1.3, Math.PI, KERB_H);
  await p.waitForTimeout(200);
  let promptOut = null;
  for (let i = 0; i < 10 && !room.label.test(promptOut ?? ''); i++) {
    await hold('w', 140);
    promptOut = await prompt();
  }
  check('walking up to the door on the street raises the prompt',
    room.label.test(promptOut ?? ''), `prompt=${JSON.stringify(promptOut)}`);

  await press();
  const inside = await pos();
  check('E puts you inside an interior slab (x ≥ 400)', inside[0] >= 400, `pos=${inside.slice(0, 3).map(f2)}`);
  if (inside[0] < 400) continue;                    // nothing below can mean anything
  const CX = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;

  const beforeF = await pos();
  await hold('w', 260);
  const afterF = await pos();
  check('you spawn facing INTO the room, not at the door you came through',
    afterF[2] < beforeF[2] - 0.05, `walking forward moved z ${f2(beforeF[2])} → ${f2(afterF[2])}`);

  // ── the floor ────────────────────────────────────────────────────────
  const gyIn = (await pos())[3];
  check('floor height inside is 0 (not sunk, not floating)', Math.abs(gyIn) < 0.001, `gy=${gyIn}`);
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
  }, CX);
  check('the floor mesh is where the rig thinks the floor is',
    floorY !== null && Math.abs(floorY - gyIn) < 0.03,
    `floor mesh y=${floorY === null ? 'not found' : f2(floorY)}, rig gy=${gyIn}`);

  // read the eye off the rig — the camera is not a child of the scene and
  // hunting it there always returns nothing
  const eye = (await pos())[1];
  check(`the ${room.H} m ceiling clears the eye`, eye > 0.5 && eye < room.H - 0.3,
    `eye y=${f2(eye)}, ceiling ${room.H}`);

  // ── the walls hold ───────────────────────────────────────────────────
  const probe = async (lx, lz, key, axis, limit, sign, note) => {
    await warp(CX + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', 2600);
    const a = await pos();
    const moved = Math.hypot(a[0] - a0[0], a[2] - a0[2]);
    const v = axis === 'x' ? a[0] - CX : a[2];
    const escaped = sign > 0 ? v > limit : v < -limit;
    check(`wall holds walking ${key}${note ? ' — ' + note : ''}`, !escaped && moved > 0.3,
      moved <= 0.3 ? `HARNESS: never left the start point (stuck in furniture at local ${f2(lx)},${f2(lz)})`
        : `walked ${f2(moved)} m, stopped at local ${axis}=${f2(v)} (wall at ${sign > 0 ? '' : '-'}${f2(limit)})`);
  };
  await probe(0, room.clearZ, '-x', 'x', LIMX, -1);
  await probe(0, room.clearZ, '+x', 'x', LIMX, 1);
  await probe(room.frontProbeX, room.frontProbeZ ?? room.clearZ, '+z', 'z', LIMZ, 1,
    room.hasWindow ? 'the front wall under the window' : 'the WINDOWLESS front wall');
  if (!room.skipBack) await probe(room.backProbeX, room.backProbeZ, '-z', 'z', LIMZ, -1);

  // the doorway is the one gap in the collider line — the one place a room leaks
  await warp(CX + room.at, room.clearZ, Math.PI, 0);
  await p.waitForTimeout(150);
  await hold('w', 2600);
  const doorRun = await pos();
  check('you cannot walk out through the doorway onto dead ground',
    doorRun[2] < hd + 0.4, `walking at the door reached z=${f2(doorRun[2])} (front wall at ${hd})`);

  // ── the lanes ────────────────────────────────────────────────────────
  for (const [name, lx, lz, key, ms, axis, want] of room.lanes) {
    await warp(CX + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const a = await pos();
    await hold('w', ms);
    const c = await pos();
    const d = axis === 'x' ? Math.abs(c[0] - a[0]) : Math.abs(c[2] - a[2]);
    check(name, d > want, `travelled ${f2(d)} m (want > ${want})`);
  }

  // ── where you must NOT be able to get ────────────────────────────────
  //
  // The inverse of a lane test, and the pawn shop needs it: a room whose whole
  // point is that the far side of the counter is out of reach has to be checked
  // for the gap somebody could squeeze through, not just for the routes that
  // work. A lane test passing tells you nothing about this.
  for (const [name, lx, lz, key, ms, axis, most] of room.noGo ?? []) {
    await warp(CX + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const a = await pos();
    await hold('w', ms);
    const c = await pos();
    const d = axis === 'x' ? Math.abs(c[0] - a[0]) : Math.abs(c[2] - a[2]);
    check(name, d < most, `got ${f2(d)} m in (must be < ${most})`);
  }

  // ── the way out, and NOT straight back in ────────────────────────────
  await warp(CX + room.doorApproach[0], room.doorApproach[1], Math.PI, 0);
  await p.waitForTimeout(150);
  await hold('w', 1400);
  const dPrompt = await prompt();
  check('walking to the inside of the door raises the way-out prompt',
    /out to the street/.test(dPrompt ?? ''), `prompt=${JSON.stringify(dPrompt)}`);

  await press();
  const back = await pos();
  check('E at the inside door puts you back on the street', back[0] < 100, `pos=${back.slice(0, 3).map(f2)}`);
  check('you land on the raised walk, not in the road', Math.abs(back[3] - KERB_H) < 0.001, `gy=${back[3]}`);
  const afterPrompt = await prompt();
  check('you are NOT standing in the re-entry trigger after stepping out',
    !room.label.test(afterPrompt ?? ''), `prompt=${JSON.stringify(afterPrompt)}`);
  await press();
  const sucked = await pos();
  check('a second E on the landing does not suck you straight back in',
    sucked[0] < 100, `pos=${sucked.slice(0, 3).map(f2)}`);

  // Can you leave the landing in every direction? This is asking about static
  // geometry — a landing boxed in by a wall or a prop is a shipped bug. But
  // CITIZENS are obstacles too and they walk the same 2 m lane, so a passer-by
  // standing on the spot fails this for a second and means nothing. Retried:
  // a wall blocks every attempt, a pedestrian has moved on by the next one.
  // Which way can you leave the landing? Two different questions live here and
  // the first version conflated them.
  //
  // ALONG the walk is the one that matters: if both ways down the pavement are
  // shut you are boxed in and that is a shipped bug. ACROSS, toward the road, is
  // not — cars park at that kerb, and on the side street ct/sidestreet.ts parks
  // one directly outside the HOTEL. A car between you and the road is the world
  // working, not a fault, and asserting 0.9 m of clear tarmac there would fail
  // for a correct reason. So the road direction is measured and REPORTED but
  // does not decide the check.
  const dirs = room.landing ?? [['out across the side street', 0, false], ['east along the walk', Math.PI / 2, true], ['west along the walk', -Math.PI / 2, true]];
  for (const [k, yaw, mustPass = true] of dirs) {
    let best = 0;
    for (let attempt = 0; attempt < 3 && best <= 0.9; attempt++) {
      if (attempt) await p.waitForTimeout(1600);        // let whoever it is walk on
      await warp(back[0], back[2], yaw, KERB_H);
      await p.waitForTimeout(120);
      const a = await pos();
      await hold('w', 500);
      const c = await pos();
      best = Math.max(best, Math.hypot(c[0] - a[0], c[2] - a[2]));
    }
    if (mustPass) check(`the landing is not boxed in — ${k}`, best > 0.9, `moved ${f2(best)} m (best of 3)`);
    else console.log(`  note  ${room.id}: ${k} — moved ${f2(best)} m${best <= 0.9 ? ' (something is parked at the kerb)' : ''}`);
  }

  // ── the room keeps its light after dark ──────────────────────────────
  // props.dimWorld() skips |x| > 100 so interiors stay lit round the clock —
  // and the kit's group sits at the world origin precisely so its children
  // carry world positions and are skipped too.
  const sample = () => p.evaluate((cx) => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > 7 || Math.abs(wp.z) > 7) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.color && !m.transparent) out.push(m.color.getHex());
    });
    return out;
  }, CX);
  await p.evaluate(() => window.__ct.clock(12, 0));
  await p.waitForTimeout(500);
  const noon = await sample();
  await p.evaluate(() => window.__ct.clock(2, 0));
  await p.waitForTimeout(900);
  const night = await sample();
  const dimmed = noon.filter((c, i) => night[i] !== undefined && night[i] !== c).length;
  check('the room keeps its own light after dark',
    dimmed === 0, `${dimmed}/${noon.length} interior materials were dimmed by the night sweep`);
}

// the kit warns about openings that do not fit and exits that land inside
// their own trigger; both are silent bugs otherwise
room = { id: 'kit' };
const mine = kitWarns.filter((w) => rooms.some((r) => w.includes(`[interior:${r.id}]`)));
check('no kit warnings for these rooms', mine.length === 0, mine.length ? mine.join(' | ') : 'none');

console.log('');
for (const [ok, name, detail] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}\n        ${detail}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(bad ? 1 : 0);
