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
import { reportWorld } from './lib/which-world.mjs';
import { readFileSync } from 'node:fs';

const KERB_H = 0.14, RADIUS = 0.36;

// One entry per room. `cx` is NOT hard-coded — the slab a room gets depends on
// the order rooms are built in crosstown.ts, and that order changes every time
// another builder lands one. It is read back from where the player actually
// arrives instead.
const ROOMS = [
  {
    id: 'casino', label: /GOLDEN ACES/,
    keeper: [3.1, 1.6],      // across the felt from the dealer

    building: 'GOLDEN ACES', at: -3.2, hasWindow: false,
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
    id: 'hotel', label: /ORPHEUS/,
    keeper: [-3.6, -0.65],   // the guest side of the reception desk

    building: 'HOTEL ORPHEUS', at: -3.4, hasWindow: true,
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
    // Both DERIVED now that the room reads the frontage descriptor, not chosen:
    // W is roomWidthFor(13) = 11.8, and doorZ is doorWorldFor = cz + side*(at/k)
    // = -15.5 + (-4.2 / 0.9077) = -20.13. Confirmed by scanning the walk for the
    // prompt: it runs -19.2 to -21.0, centre -20.10. Typing -15.25 here — which
    // is what this row said — is exactly what the descriptor exists to stop.
    id: 'tax', label: /A-1 TAX/,
    keeper: [-2.6, -0.75],   // the client chair

    building: 'A-1 TAX', at: -4.2, hasWindow: true,
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
    // Likewise derived: roomWidthFor(15) = 13.8, door declared at local 0 so it
    // lands on the building centre, cz = -60.5. Scanned: -59.5 to -61.3.
    id: 'pawn', label: /PAWN/,
    keeper: [1.6, -1.6],     // the customer side of the counter

    building: 'PAWN', at: 0, hasWindow: true,
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
    // the desk's number for the "i immediately hit a counter" complaint: two
    // metres of clear depth on the customer side, sampled across its width
    minDepth: [2.0, [-5, -3, -1, 0, 1, 3, 5]],
    // the whole point of the room: the stock is behind the counter and stays
    // there, and the counter runs wall to wall so there is no way round it
    noGo: [
      ['you cannot get behind the counter in the middle', -0.06, -1.4, '-z', 1600, 'z', 1.2],
      ['…nor at the west end', -4.5, -1.4, '-z', 1600, 'z', 1.2],
      ['…nor at the east end', 4.5, -1.4, '-z', 1600, 'z', 1.2],
    ],
  },
];

// ── --selftest: prove this suite can still fail ─────────────────────────
//
// `scripts/checks.mjs` runs the walking suites with `--selftest` and expects
// them to invert known truths and require every one to fail — D-walk's
// convention. Without one this file cannot be added to the shared runner, which
// is why 113 checks guarding the user's own requirements have never been in it.
//
// Three inversions, all in the HARNESS rather than in `src/`: no source is
// touched, so this needs no lock and cannot leave a mutated tree behind if it
// dies. Each targets a check that has caught a real defect this session.
const SELFTEST = process.argv.includes('--selftest');
const only = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);
let rooms = only ? ROOMS.filter((r) => r.id === only) : ROOMS;
const INVERTED = [
  'pawn: the customer side is 9 m deep or better, not a corridor',
  'pawn: you cannot get behind the counter in the middle',
  'pawn: the keeper is looking at you, not away',
];
if (SELFTEST) {
  const r = ROOMS.find((q) => q.id === 'pawn');
  rooms = [r];
  r.minDepth = [9.0, r.minDepth[1]];        // no room in this world is 9 m deep
  r.noGo = [[r.noGo[0][0], -0.06, -1.4, '+z', 1600, 'z', 1.2]];  // aimed at open floor
  r.keeper = [r.keeper[0], -4.6];           // stand BEHIND him: he must read as away
}
if (!rooms.length) { console.error(`no such room: ${only}`); process.exit(2); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
const kitWarns = [];
p.on('console', (m) => { if (/\[interior:/.test(m.text())) kitWarns.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4186/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4186/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };

// ── ASK the world where each door is, never type it ─────────────────────
//
// These rows used to carry doorX/doorZ as literals. They passed anyway when the
// casino and hotel spots drifted 0.25 m (095c7d63) — the 1.05 m trigger radius
// absorbed it — which is the whole problem with a test that types the number it
// is checking. `doorStandFor` is where a player is meant to stand, published by
// the same declaration the room and the facade both read, so this cannot go
// stale and cannot disagree with them.
for (const r of ROOMS) {
  // Through `__ct.doors()`, NOT `import('/src/proto/ct/doors.ts')`. That source
  // path exists only on the dev server, which is what made this whole suite
  // dev-only — and dev is exactly where the door-drop bug (1e49295b) cannot be
  // seen. The runtime API answers the same question in both worlds, so this can
  // now be pointed at a `vite preview` of dist.
  const d = await p.evaluate((name) => {
    const e = window.__ct.doors().find((q) => q.building === name);
    return e && e.stand ? { x: e.stand.x, z: e.stand.z } : null;
  }, r.building);
  if (!d) { console.error(`no declaration for ${r.building} — cannot walk ${r.id}`); process.exit(2); }
  r.doorX = d.x; r.doorZ = d.z;
}

const results = [];
let room = null;
const f2 = (n) => +n.toFixed(2);

// ── the [E] spot sits EXACTLY on the published door ─────────────────────
//
// The casino and the hotel derive their spot from the `face` they declare, with
// their own copy of the 0.75 m standoff, because importing the value from
// ./doors is what dropped their DOOR from the bundle (1e49295b). That duplicated
// constant needs a guard, and in that commit I said this file was it. IT IS NOT,
// and I checked instead of leaving the claim standing: with the casino's standoff
// drifted 0.75 → 1.00, this suite passes 28/28. Every walking check here goes
// through a 1.05 m trigger radius, which swallows a 0.25 m error whole — the same
// blindness I documented for the old typed door constants and then walked into
// again by asserting a guarantee rather than testing it.
//
// `spots-walk.mjs` does catch it exactly ("NOT ON ITS DOOR … 0.25 m away"), so
// the guarantee is real — but it lives in the slow tier, which two builders have
// now failed to get a clean run out of. A constant duplicated in my files should
// be guarded by the suite I actually run, so here it is: no walking, no trigger
// radius, just the two numbers.
{
  const spots = await p.evaluate(() => (window.__ct.spots ? window.__ct.spots() : []));
  const bad = [];
  for (const r of ROOMS) {
    const s = spots.find((q) => r.label.test(q.label ?? ''));
    if (!s) { bad.push(`${r.id}: no [E] spot matching ${r.label}`); continue; }
    const off = Math.hypot(s.x - r.doorX, s.z - r.doorZ);
    if (off > 0.01) bad.push(`${r.id}: spot ${f2(s.x)},${f2(s.z)} is ${off.toFixed(3)} m off the published door ${f2(r.doorX)},${f2(r.doorZ)}`);
  }
  results.push([bad.length === 0,
    'every [E] spot sits exactly on its published door, not merely within reach',
    bad.length ? bad.join('; ') : `${ROOMS.length} spots, all within 1 cm of the declaration`]);
}
const check = (name, ok, detail) => results.push([ok, `${room.id}: ${name}`, detail]);
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 };

// ── walking, measured by ARRIVAL rather than by the clock ───────────────
//
// `hold('w', ms)` measures the stopwatch, not the world. Mainline has just been
// through this with its own probes (6907ea69: "side-walk's four hikes were
// stopwatches too, and one run failed on a sound world"), and I fixed the same
// fault in this file's doorway check — then left it in the lanes and the no-go
// probes directly below it, which is the third time this session I have fixed
// one instance of a pattern and walked past its twin.
//
// The two directions fail differently and the second is the dangerous one:
//
//   a LANE that under-travels reports a false FAIL — loud, and someone looks
//   a NO-GO that under-travels reports a false PASS — it "proves" you cannot get
//     behind the counter because the clock ran out, and nobody ever looks
//
// So both now walk until the player stops moving. A lane also stops as soon as it
// has travelled far enough to prove its minimum, which keeps this no slower than
// the fixed holds it replaces.
const walkTill = async (axis, enough = Infinity, maxSteps = 14) => {
  const a = await pos();
  const along = (c) => (axis === 'x' ? Math.abs(c[0] - a[0]) : Math.abs(c[2] - a[2]));
  let prev = a;
  for (let i = 0; i < maxSteps; i++) {
    await hold('w', 500);
    const c = await pos();
    const step = axis === 'x' ? Math.abs(c[0] - prev[0]) : Math.abs(c[2] - prev[2]);
    prev = c;
    if (step < 0.05) break;                 // stopped: something is holding
    if (along(c) > enough) break;            // proved the minimum, no need to walk on
  }
  return along(prev);
};


// ── the one defect in these rooms this suite CANNOT walk to ─────────────
//
// A room that imports a runtime VALUE from ./doors joins an import cycle with the
// door registry, and a module in that cycle resolves to an undefined namespace in
// the Rollup bundle — so its DOOR is collected in dev and dropped without trace in
// `dist`. That is how GOLDEN ACES was missing from declaredDoors() in the shipped
// artefact for many commits (fixed in 1e49295b).
//
// EVERY OTHER CHECK IN THIS FILE RUNS AGAINST THE DEV SERVER, WHERE THE DEFECT IS
// INVISIBLE BY CONSTRUCTION. Re-add the import and all 107 stay green while the
// door disappears from the build the user actually plays. So this one is read off
// the SOURCE rather than the running world — the only honest way to see it from
// here. `scripts/doors-declared.mjs` catches it properly, but only after a build
// and a preview, which is not where I work.
//
// A `type` import is erased and costs nothing, which is why the six rooms that
// only ever imported the type were never affected.
{
  const src = (f) => readFileSync(new URL(`../src/proto/ct/${f}`, import.meta.url), 'utf8');
  const valueImport = (text) => {
    const m = text.match(/^import\s+([^;]*?)\s+from\s+'\.\/doors';/m);
    if (!m) return null;                                  // no import at all is fine
    const clause = m[1].trim();
    if (clause.startsWith('type ')) return null;          // import type { ... }
    const names = clause.replace(/^\{|\}$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    const runtime = names.filter((n) => !n.startsWith('type '));
    return runtime.length ? runtime.join(', ') : null;
  };
  const mine = { casino: 'int-casino.ts', hotel: 'int-hotel.ts', pawn: 'int-pawn.ts', tax: 'int-tax.ts' };
  const bad = Object.entries(mine).filter(([, f]) => valueImport(src(f)));
  results.push([bad.length === 0,
    'all four rooms import ./doors as a TYPE only, so none is in the registry cycle',
    bad.length
      ? `RUNTIME import from './doors' in ${bad.map(([id, f]) => `${f} (${valueImport(src(f))})`).join('; ')}`
        + ' — its DOOR will be dropped from dist with no error'
      : `${Object.keys(mine).length} rooms checked, all type-only`]);
  // The other four rooms are not mine to fail the run over, but the class is the
  // same and a silent drop costs whoever owns them the same way.
  const others = ['int-diner.ts', 'int-bodega.ts', 'int-burger.ts', 'int-thrift.ts']
    .filter((f) => valueImport(src(f)));
  if (others.length) console.log(`  note  not mine, same risk: runtime ./doors import in ${others.join(', ')}`);
}

for (room of rooms) {

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

  // MEASURED from the room, not typed in the table above.
  //
  // These were literals, and the tax office already produced a false FAIL that
  // way: I typed W = 11.8 while the room built 12.0, and the wall probe reported
  // the player escaping through a wall that was exactly where it should be. Same
  // fault as the door literals in d955a0fc — a number the world owns, copied
  // into the check that verifies it.
  //
  // So the room is asked for its own extents on entry: the floor plane it is
  // standing on gives width and depth, the highest flat horizontal gives the
  // ceiling. The wall test then means "collision agrees with the geometry",
  // which is the thing actually worth asserting.
  const dims = await p.evaluate((cx) => {
    let floor = null, ceilY = 0;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      const g = o.geometry.parameters;
      if ((g.width ?? 0) < 2 || (g.height ?? 0) < 2) return;
      if (Math.abs(Math.abs(o.rotation.x) - Math.PI / 2) > 0.01) return;   // horizontal
      const wp = new o.position.constructor(); o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
      if (wp.y < 0.4 && (!floor || g.width * g.height > floor.w * floor.d)) {
        floor = { w: g.width, d: g.height };
      }
      if (wp.y > ceilY) ceilY = wp.y;
    });
    return floor ? { W: floor.w, D: floor.d, H: +ceilY.toFixed(2) } : null;
  }, CX);
  check('the room reports its own extents', dims !== null,
    dims ? `W ${dims.W} × D ${dims.D}, ceiling ${dims.H}` : 'no floor plane found');
  if (!dims) continue;
  const hw = dims.W / 2, hd = dims.D / 2;
  const LIMX = hw - RADIUS + 0.02, LIMZ = hd - RADIUS + 0.02;

  // ── the window, or the deliberate absence of one ─────────────────────
  //
  // The casino's queue item called this "the first real test of the kit": the kit
  // gives a room a window in the front wall by default and this one must not have
  // one, because a casino does not let you see the floor from the street.
  //
  // Nothing tested it. The `+z` wall probe below is the closest thing and it
  // cannot see this at all — it asserts the wall STOPS you, and a pane of glass
  // stops you exactly as well as brick. The room would have gained a window and
  // every check here would still have passed.
  //
  // So this counts glazing in the front-wall plane, and it is a CROSS-ROOM claim
  // rather than one room's: the casino must have none and the other three must
  // each have some. One number alone would be much weaker — if glazing broke
  // everywhere, "the casino has no window" would pass for the wrong reason and
  // read as a success. Asserting both directions is what makes it evidence.
  const panes = await p.evaluate(([cx, hdv]) => {
    const out = [];
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      for (let q = o; q; q = q.parent) if (q.visible === false) return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (Math.abs((bb.min.x + bb.max.x) / 2 - cx) > 9) return;
      if ((bb.min.z + bb.max.z) / 2 < hdv - 0.45) return;          // the front wall plane
      if (bb.max.y < 0.45 || bb.min.y > 3.2) return;               // the eye-height band
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.some((m) => m && m.transparent)) return;
      out.push(+(bb.max.x - bb.min.x).toFixed(2) + '×' + +(bb.max.y - bb.min.y).toFixed(2));
    });
    return out;
  }, [CX, hd]);
  check(room.hasWindow ? 'the front wall is glazed, as this room asked' : 'the front wall has NO window, as this room asked',
    room.hasWindow ? panes.length >= 1 : panes.length === 0,
    `${panes.length} glazed pane(s) in the front wall${panes.length ? ': ' + panes.join(', ') : ''}`);

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
  check(`the ${dims.H} m ceiling clears the eye`, eye > 0.5 && eye < dims.H - 0.3,
    `eye y=${f2(eye)}, ceiling ${dims.H}`);

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

  // ── the doorway does not leak ────────────────────────────────────────
  //
  // This said "the doorway is the one gap in the collider line — the one place a
  // room leaks", and MUTATION TESTING SHOWED THAT IS NOT WHAT IS THERE. Widening
  // the casino's door from 1.15 m to 3.0 m — 2.6x — moved the stop not at all:
  // z = 4.32 either way. A gap would have opened.
  //
  // What the kit actually builds, read off `__ct.colliders()` in room-local x:
  //
  //   -5.43 .. -3.77   z 4.50..4.68    wall, west of the door
  //   -3.77 .. -2.63   z 4.68..4.86    THE DOORWAY, its own collider, 0.18 m proud
  //   -2.63 ..  5.43   z 4.50..4.68    wall, east of the door
  //
  // The opening is CLOSED, by a box standing slightly forward of the wall line —
  // 4.68 minus the 0.36 m body radius is 4.32, which is the number this check has
  // been reporting all along without my knowing why.
  //
  // So the check is still worth having, but it guards something else than I said:
  // that the kit keeps placing that doorway collider. If it ever stops, a player
  // walks out of the room into nothing and this is what notices. Being wrong
  // about the mechanism did not make the check wrong — it made the comment a
  // false explanation, which is worse for the next reader than no comment.
  //
  // Walk until the player STOPS, not for a fixed time. This was `hold('w', 2600)`
  // and that is the defect this same file already fixed for the prompt walk 100
  // lines up: a fixed hold measures the clock, not the world. 2600 ms covers
  // about 8.2 m, the hotel's run from clearZ to its front wall is 8.4, so the
  // walker was being stopped by running out of time roughly where the wall is —
  // 0.21 m of margin between "the collider held" and "the hold expired", and no
  // way to tell which had happened. A leak of up to a fifth of a metre past the
  // wall would have read as a pass every time.
  //
  // This check reported a spurious FAIL once (z = 9.00) and it is still the only
  // observation of it: five walk-until-stopped runs at that doorway all stop at
  // z = 4.29, and mainline without my change passes too, so it is neither the
  // world nor the change. I have not identified the mechanism. Recorded rather
  // than tidied away, because "it passed when I ran it again" is how a real
  // intermittent leak gets closed.
  await warp(CX + room.at, room.clearZ, Math.PI, 0);
  await p.waitForTimeout(150);
  let doorZ = (await pos())[2];
  for (let i = 0; i < 14; i++) {
    await hold('w', 500);
    const c = await pos();
    if (c[2] - doorZ < 0.05) break;               // stopped: something is holding
    doorZ = c[2];
    if (c[2] > hd + 1.5) break;                   // well out — no point continuing
  }
  check('you cannot walk out through the doorway onto dead ground',
    doorZ < hd + 0.4, `walked at the door until stopped, z=${f2(doorZ)} (front wall at ${hd})`);

  // ── the lanes ────────────────────────────────────────────────────────
  for (const [name, lx, lz, key, , axis, want] of room.lanes) {
    await warp(CX + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const d = await walkTill(axis, want);
    check(name, d > want, `travelled ${f2(d)} m before stopping (want > ${want})`);
  }

  // ── where you must NOT be able to get ────────────────────────────────
  //
  // The inverse of a lane test, and the pawn shop needs it: a room whose whole
  // point is that the far side of the counter is out of reach has to be checked
  // for the gap somebody could squeeze through, not just for the routes that
  // work. A lane test passing tells you nothing about this.
  for (const [name, lx, lz, key, , axis, most] of room.noGo ?? []) {
    await warp(CX + lx, lz, YAW[key], 0);
    await p.waitForTimeout(150);
    const d = await walkTill(axis);          // no early exit: we want the MAXIMUM
    check(name, d < most, `got ${f2(d)} m in before stopping (must be < ${most})`);
  }

  // ── the keeper is looking AT you, not away ───────────────────────────
  //
  // The user found the tax preparer facing his back wall, and it was the fourth
  // handedness bug of the session — GOTCHAS §23 was written for the class. Two of
  // my four keepers were wrong and 109 checks noticed nothing, because none of
  // them asked which way a person was pointed. Their brief named the test:
  // **stand where a player stands and ask whether they are looking at you.**
  //
  // Facing cannot be read off a billboard's `rotation.y` — the plane turns to
  // face the camera every frame. It is in the ATLAS FRAME, and `notes/H-atlas-
  // facing.md` publishes the layout that makes the frame exact:
  //
  //   tex.repeat.x = mirror ? -1/5 : 1/5      ← the mirror flag, in the sign
  //   tex.offset.x = mirror ? (col+1)/5 : col/5
  //   cols = [0,1,2,3,4,3,2,1] over 8 sectors, mirror = sector > 4
  //
  // `[col, mirror] → sector` is a BIJECTION: columns 1–3 each appear twice and
  // the mirror flag separates them, 0 and 4 appear once and never mirrored. So a
  // single reading from a known bearing pins the sector, and therefore the
  // authored facing to ±22.5°. This used to threshold `offset.x` alone, which
  // cannot tell col 4 (their back) from col 3 mirrored (three-quarter back) —
  // the same number, two different answers.
  //
  // Sectors 0, 1 and 7 are front and three-quarter front: looking at you. 2 and 6
  // are profile, 3 and 5 three-quarter back, 4 is square away. A keeper attending
  // to something else on purpose is a choice rather than this bug, so profile is
  // the line to argue with rather than delete.
  if (room.keeper) {
    const [kx, kz] = room.keeper;
    await warp(CX + kx, kz, 0, 0);
    await p.waitForTimeout(150);
    // the sprite picks its frame from where the CAMERA is, so it needs frames
    // after the warp — reading immediately gets the view from the last position
    await hold('w', 60);
    await p.waitForTimeout(500);
    const v = await p.evaluate(([cx, kx, kz]) => {
      const s = window.__ct.scene(); s.updateMatrixWorld(true);
      let best = null;
      s.traverse((o) => {
        if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
        const g = o.geometry.parameters;
        if (!(g.height > 1.4 && g.height < 2.2 && g.width > 0.5 && g.width < 1.6)) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || !m.map) return;
        const wp = new o.position.constructor(); o.getWorldPosition(wp);
        if (Math.abs(wp.x - cx) > 9 || Math.abs(wp.z) > 9) return;
        const d = Math.hypot(wp.x - (cx + kx), wp.z - kz);
        if (!best || d < best.d) {
          const mirror = m.map.repeat.x < 0;
          const col = Math.round(m.map.offset.x * 5) - (mirror ? 1 : 0);
          best = { d: +d.toFixed(2), col, mirror, x: wp.x - cx, z: wp.z };
        }
      });
      return best;
    }, [CX, kx, kz]);
    const SECTOR = { '0f': 0, '1f': 1, '2f': 2, '3f': 3, '4f': 4, '3t': 5, '2t': 6, '1t': 7 };
    const WHAT = ['facing you', 'three-quarter on', 'in profile', 'three-quarter away',
      'facing away', 'three-quarter away', 'in profile', 'three-quarter on'];
    let detail = 'no citizen sprite found in this room', ok = false;
    if (v) {
      const sec = SECTOR[`${v.col}${v.mirror ? 't' : 'f'}`];
      ok = sec === 0 || sec === 1 || sec === 7;
      // recover what they were authored to face, per H-atlas-facing.md
      const camAng = Math.atan2(kx - v.x, kz - v.z);
      const facing = Math.atan2(Math.sin(camAng - sec * Math.PI / 4), Math.cos(camAng - sec * Math.PI / 4));
      detail = `col ${v.col}${v.mirror ? ' mirrored' : ''} → sector ${sec}, ${WHAT[sec]}`
        + ` — authored facing ${f2(facing)} rad ±0.39, from ${v.d} m`;
    }
    check('the keeper is looking at you, not away', ok, detail);
  }

  // ── the customer side has to be a room you can stand in ──────────────
  //
  // The user's complaint about the pawn shop was "i immediately hit a counter …
  // it's like i'm behind the counter", and the desk's fix named a number:
  // "two metres of clear depth minimum". Nothing checked it. The lanes come
  // closest, but a lane asserts you can TRAVEL along the floor, which a
  // corridor also passes — the complaint was about depth, not length.
  //
  // That is the gap mainline keeps closing elsewhere (86460bdd, 5a47d7c6: a
  // request in the user's own words with no check behind it), and this one is
  // worth having because the margin is thin. It measures 2.48 m against a 2.00 m
  // brief, so ONE display case nudged forward eats it, and nothing would say so.
  //
  // Neither end is typed. The front wall comes from `hd`, which was MEASURED off
  // the room's own floor plane above; the obstruction is found by walking into
  // it. Depth is then wall-plane to obstruction-face, so it is a number you could
  // hold a tape to rather than a distance between two body centres.
  //
  // Two things I got wrong writing this, both worth leaving as warnings:
  //
  //  1. I first found the front wall by walking +z INTO it. At x = 0 the pawn
  //     shop's door is at -0.06, so that walk goes straight OUT through the
  //     doorway and reports the wall 0.3 m too far forward. A probe that walks
  //     toward a wall has to know the wall has a hole in it.
  //  2. I first started the walk at local z = 0, assuming that was the customer
  //     strip. It is not at every x: the floor case sits FORWARD of z = 0, so at
  //     x = -3 the walker started behind the case and measured the gap between
  //     case and counter — a bigger number than the thing being checked, which
  //     is the direction that hides a defect. Start at the wall and walk in.
  if (room.minDepth) {
    const [want, xs] = room.minDepth;
    let worst = Infinity, worstX = null, skipped = 0;
    for (const lx of xs) {
      const zStart = hd - 0.55;                    // inside the room, clear of the wall
      await warp(CX + lx, zStart, 0, 0);           // face -z, into the room
      await p.waitForTimeout(150);
      const a = await pos();
      if (Math.abs(a[2] - zStart) > 0.4) { skipped++; continue; }   // something is already there
      let zMin = a[2];
      for (let i = 0; i < 10; i++) {
        await hold('w', 400); const c = await pos();
        if (zMin - c[2] < 0.05) break; zMin = c[2];
      }
      const depth = hd - (zMin - RADIUS);          // wall plane → obstruction face
      if (depth < worst) { worst = depth; worstX = lx; }
    }
    check(`the customer side is ${want} m deep or better, not a corridor`,
      worst >= want && skipped === 0,
      skipped ? `HARNESS: could not stand at ${skipped} of ${xs.length} sample x`
        : `narrowest clear depth ${f2(worst)} m at local x=${worstX} (brief: ${want} m)`);
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

if (SELFTEST) {
  // every inverted truth must have come back red; a green one means that check
  // cannot fail and is decoration
  const missed = INVERTED.filter((n) => {
    const row = results.find((r) => r[1] === n);
    return !row || row[0];
  });
  console.log('\nSELFTEST — three inverted truths, all must fail:');
  for (const n of INVERTED) {
    const row = results.find((r) => r[1] === n);
    console.log(`  ${!row ? 'MISSING ' : row[0] ? 'STILL OK' : 'failed  '}  ${n}`);
  }
  console.log(missed.length ? `\n${missed.length} of ${INVERTED.length} did NOT fail — this suite has a check that cannot fail`
    : `\nall ${INVERTED.length} failed as they must`);
  await b.close();
  process.exit(missed.length ? 1 : 0);
}
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(bad ? 1 : 0);
