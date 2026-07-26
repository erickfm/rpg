// YOU CAN CLIMB TO THE LIBRARY GALLERY, WALK ITS LENGTH, AND COME BACK DOWN.
//
// The user named the stair — *"i want to be able to walk up the stairs of the
// library"*, *"i like the stairs, and the idea of a balcony but they are
// inaccessible because of walls"* — and the desk's brief for this room says a
// level change is what makes an interior read as a building rather than a room.
// Nothing asserted it. `scripts/libstair.mjs` samples `groundAt` across the
// floor and prints a picture of the climb, which is a good investigation and
// not a check: no exit code, no walking, and it is in no tier, so it runs when
// somebody remembers it. This makes the claim instead, and it makes it by
// DRIVING THE PLAYER (CLAUDE.md: anything involving movement, collision or
// floors must be verified by actually walking it).
//
// Six verdicts, in the order they can fail:
//
//   population  the room has a raised level at all. Every verdict below is
//               about a climb, and a climb you cannot find passes for free on
//               a world that failed to build one (GOTCHAS §34).
//   climb       holding W at the foot of the flight puts you ON the deck.
//   clearance   the handrail never comes up to meet your head. Measured WHILE
//               CLIMBING against the live rail — this is the figure the
//               verifier could not settle from outside.
//   traverse    from the top you can walk the deck's length. This is what the
//               gallery's new wall shelving could break, and it is the whole
//               of "inaccessible because of walls".
//   guarded     you cannot walk off the open side. The balustrade is a
//               collider and a drop you can step into is worse than no gallery.
//   descend     and you can get back down to the room floor.
//
// NOTHING IS HAND-TYPED. The deck, the flight and its foot are DISCOVERED by
// sampling the room's own floor picker, so moving the gallery moves the check
// with it. GOTCHAS §20: `doorsweep.mjs` finds things by walking and has never
// been wrong; every hand-typed coordinate on this project has been wrong once.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('J-gallery-walk', ['walk', 'all']);
void mode;
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4192/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
// the world is BUILT when __ct appears and DRAWN some seconds later; the walks
// below do not need the picture, but the floor picker settles over frames and
// a warp read too early reports the height you asked for, not the one you get.
await p.waitForTimeout(2500);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const pos = () => p.evaluate(() => window.__ct.pos());

// WALK UNTIL YOU ARRIVE OR STOP MAKING PROGRESS — never for a fixed time.
// GOTCHAS §30: a frame is 17 ms idle and over a second under load, so any hold
// long enough on this machine is a bet on how busy the next one is. `lotwalk`
// went from 3 of 12 green to 12 of 12 on exactly this change.
const walk = async (key, done, capMs = 9000) => {
  const t0 = Date.now();
  let last = await pos(), still = 0;
  await p.keyboard.down(key);
  while (Date.now() - t0 < capMs) {
    await p.waitForTimeout(220);
    if (await done()) break;
    const now = await pos();
    const moved = Math.hypot(now[0] - last[0], now[2] - last[2]) + Math.abs(now[3] - last[3]);
    still = moved < 0.02 ? still + 1 : 0;
    last = now;
    if (still >= 3) break;                       // wedged, not slow
  }
  await p.keyboard.up(key);
  await p.waitForTimeout(150);
  return pos();
};

// ── the population: find the level change by asking the floor picker ────────
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'library'));
if (!room) {
  console.error('ABORT  no library slab — nothing to climb');
  await b.close(); process.exit(3);              // GOTCHAS §32: 3, not 1
}
const survey = await p.evaluate(([cx, cz, w, d]) => {
  const cells = [];
  for (let x = cx - w / 2 + 0.4; x <= cx + w / 2 - 0.4; x += 0.25) {
    for (let z = cz - d / 2 + 0.4; z <= cz + d / 2 - 0.4; z += 0.25) {
      const gy = window.__ct.groundAt(x, z);
      if (gy > 0.05) cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), gy: +gy.toFixed(3) });
    }
  }
  return cells;
}, [room.cx, room.cz, room.w, room.d]);

const top = survey.reduce((m, c) => Math.max(m, c.gy), 0);
report('the library has a level change to climb',
  survey.length > 0 && top > 1.0, `${survey.length} raised samples, highest ${top.toFixed(2)} m`);
if (!survey.length || top <= 1.0) {
  console.log('\nnothing raised — every verdict below would pass for free. Stopping.');
  await b.close(); process.exit(3);
}
const deck = survey.filter((c) => c.gy > top - 0.05);
const ramp = survey.filter((c) => c.gy > 0.05 && c.gy <= top - 0.05);
const deckX = deck.reduce((s, c) => s + c.x, 0) / deck.length;
const zs = deck.map((c) => c.z);
const deckZ0 = Math.min(...zs), deckZ1 = Math.max(...zs);
// the flight's foot: the lowest ramp sample gives the Z, and the MIDDLE of the
// ramp gives the X.
//
// Taking both from the same lowest sample is what my first version did, and it
// put the walker at the extreme west edge of the flight — 0.05 m from the
// handrail's own collider, so the capsule caught the rail's end cap and the
// climb stopped at gy 0.69 of 2.90. That was a true reading of a place nobody
// walks. A handrail you cannot walk through is a handrail; a stair is climbed
// UP THE MIDDLE, and the check has to stand where a player stands or it is
// measuring the furniture. Verified both ways before changing it: west edge
// stops at z 4.27, middle and east side both reach the deck.
const footZ = ramp.reduce((m, c) => (c.gy < m.gy ? c : m), ramp[0]).z;
const rampX = ramp.reduce((s, c) => s + c.x, 0) / ramp.length;
const foot = { x: rampX, z: footZ };
const climbTowardMinusZ = deckZ0 < foot.z;
console.log(`deck x≈${deckX.toFixed(2)}  z ${deckZ0.toFixed(2)}..${deckZ1.toFixed(2)}  at ${top.toFixed(2)} m`);
console.log(`flight foot at (${foot.x.toFixed(2)}, ${foot.z.toFixed(2)}), climbing toward `
  + `${climbTowardMinusZ ? '-z' : '+z'}`);

// THE RAKING HANDRAIL, found rather than assumed, so this can measure against
// it while the player climbs.
//
// C's verification of the handrail row confirmed the geometry independently —
// "exactly ONE raking handrail, 4.10 m at 31.1 degrees, and ZERO short level
// caps" — and then said what it could NOT settle: *"Not verified: the
// 'constant 0.60 m below eye height the whole rake' figure, which needs the
// walk J's own script does."* That was my claim, derived from the constants,
// and a number only its author can produce is not evidence. So the walk
// measures it now.
//
// Picked by SECTION, not by position: the stringers under the treads are also
// raked boxes, and they are 0.36 m deep in section where the rail is 0.09.
const findRail = () => p.evaluate(([cx, cz, w, d]) => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
    if (Math.abs(o.rotation.x) < 0.10) return;             // not raked
    const g = o.geometry.parameters;
    if (g.height > 0.15 || g.width > 0.15 || g.depth < 3) return;   // a rail's section
    const q = o.getWorldPosition(o.position.clone());
    if (Math.abs(q.x - cx) > w / 2 || Math.abs(q.z - cz) > d / 2) return;
    best = { x: q.x, y: q.y, z: q.z, pitch: o.rotation.x, len: g.depth, h: g.height };
  });
  return best;
}, [room.cx, room.cz, room.w, room.d]);
let rail = await findRail();
if (!rail) {
  console.error('ABORT  no raking handrail found on the flight — nothing to measure against');
  await b.close(); process.exit(3);                        // GOTCHAS §32 / §34
}
console.log(`handrail ${rail.len.toFixed(2)} m at `
  + `${(Math.abs(rail.pitch) * 180 / Math.PI).toFixed(1)}°, section ${rail.h.toFixed(2)} m`);
// a box at rotation.x = p has its local +z along (0, -sin p, cos p), so the
// centreline height at a given world z is exact rather than interpolated
const railYAt = (z) => rail.y - Math.sin(rail.pitch) * ((z - rail.z) / Math.cos(rail.pitch));

const EYE = 1.62;                             // the rig's standing eye, from fp.ts
// the railed run's own ends, so the sampler below knows when the player is on it
const zTopOfRail = rail.z - Math.cos(rail.pitch) * rail.len / 2;
const zBotOfRail = rail.z + Math.cos(rail.pitch) * rail.len / 2;

if (SELFTEST) {
  // TWO mutations in the LIVE collider array — the same array the movement code
  // reads, so there is nothing to rebuild. One must break the climb and one
  // must break the traverse; if either goes green the check is decoration.
  //
  // They are 4.4 m wide because the flight and the deck are 3.0 m wide and
  // GOTCHAS §27's warning is about the mutation that does not actually break
  // the thing: a wall narrower than the walkway is stepped around, the walk
  // still arrives, and the selftest passes while proving nothing.
  await p.evaluate(([fx, tz, dx, dz0, dz1, ry]) => {
    // (1) a wall across the TOP of the flight, not its foot. At the foot the
    //     player never gets onto the railed run, so the clearance verdict below
    //     would go red on its POPULATION guard — red for the wrong reason,
    //     which is a selftest that proves nothing about what it claims to test
    //     (GOTCHAS §27). At the top, the player climbs, samples the rail all
    //     the way, and still fails to reach the deck.
    window.__ct.colliders().push({
      minX: fx - 2.2, maxX: fx + 2.2, minZ: tz - 0.45, maxZ: tz + 0.15 });
    // (2) …and one across the deck's middle, for the traverse
    window.__ct.colliders().push({
      minX: dx - 2.2, maxX: dx + 2.2,
      minZ: (dz0 + dz1) / 2 - 0.30, maxZ: (dz0 + dz1) / 2 + 0.30 });
    // (3) and the rail comes UP TO HEAD HEIGHT, which is the only mutation that
    //     tests the clearance verdict for the reason it exists
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
      if (Math.abs(o.rotation.x) < 0.10) return;
      const g = o.geometry.parameters;
      if (g.height > 0.15 || g.width > 0.15 || g.depth < 3) return;
      o.position.y += ry;
    });
  }, [foot.x, zTopOfRail, deckX, deckZ0, deckZ1, 0.55]);
  console.log('SELFTEST: the flight\'s TOP is walled, the deck\'s middle is walled, '
    + 'and the handrail is raised 0.55 m to head height — three verdicts must go red');
}

// RE-READ THE RAIL, LIVE, immediately before the walk that measures against it.
//
// The first version captured it once at startup and measured the snapshot — and
// the selftest RAISED THE RAIL 0.55 m TO HEAD HEIGHT AND THE VERDICT STAYED
// GREEN AT 0.59 m, because the number it compared against was the pre-mutation
// one. That is GOTCHAS §27's warning word for word: "a mutation that does not
// actually break the thing proves nothing, and looks exactly like a check that
// works." I only found it by watching the selftest fail to fail.
//
// Re-reading is also the more correct thing in its own right: the clearance
// claim is about the rail that is in the world when the player walks under it,
// not about one read taken before anything else happened.
rail = await findRail();
if (!rail) {
  console.error('ABORT  the handrail vanished between discovery and the walk');
  await b.close(); process.exit(3);
}

// ── climb ───────────────────────────────────────────────────────────────────
// stand on the room floor a stride short of the foot, facing up the flight.
// yaw 0 looks along -z and PI along +z (the CAMERA convention, GOTCHAS §33).
const startZ = foot.z + (climbTowardMinusZ ? 1.1 : -1.1);
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
  [foot.x, startZ, climbTowardMinusZ ? 0 : Math.PI]);
await p.waitForTimeout(300);
const before = await pos();
// sample the rail against the player's eye at every poll of the climb, so the
// clearance is measured WHERE THE PLAYER IS rather than computed from the
// constants the rail was built from
const clearances = [];
const sampleClearance = async () => {
  const q = await pos();
  const zMin = Math.min(zTopOfRail, zBotOfRail), zMax = Math.max(zTopOfRail, zBotOfRail);
  if (q[2] < zMin || q[2] > zMax) return;                  // off the railed run
  clearances.push({ z: +q[2].toFixed(2), gap: +((q[3] + EYE) - (railYAt(q[2]) + rail.h / 2)).toFixed(3) });
};
const afterClimb = await walk('w', async () => {
  await sampleClearance();
  return (await pos())[3] >= top - 0.04;
});
report('holding W at the foot of the flight puts you on the gallery',
  afterClimb[3] >= top - 0.10,
  `gy ${before[3].toFixed(2)} -> ${afterClimb[3].toFixed(2)} (deck is ${top.toFixed(2)})`);
await p.screenshot({ path: 'shots/J-lib/walk-1-on-the-gallery.png' });

// ── the rail never comes up to meet your head ───────────────────────────────
//
// The population first (GOTCHAS §34): a clearance that is never sampled is a
// clearance that passes for free, and this one samples only while the player is
// ON the railed run.
const gaps = clearances.map((c) => c.gap);
const minGap = gaps.length ? Math.min(...gaps) : null;
const maxGap = gaps.length ? Math.max(...gaps) : null;
report('the handrail stays clear of your head the whole rake',
  gaps.length >= 4 && minGap !== null && minGap > 0.30,
  gaps.length < 4
    ? `only ${gaps.length} samples on the railed run — too few to say anything`
    : `${gaps.length} samples, rail top to eye ${minGap.toFixed(2)}…${maxGap.toFixed(2)} m`
      + ` (spread ${(maxGap - minGap).toFixed(3)} m, so it is a constant, not a taper)`);

// ── traverse ────────────────────────────────────────────────────────────────
// keep going the same way and see how much of the deck you cover. The far end
// is the deck edge; anything short of it is something standing in the way.
const farEnd = climbTowardMinusZ ? deckZ0 : deckZ1;
const afterRun = await walk('w', async () => {
  const q = await pos();
  return Math.abs(q[2] - farEnd) < 0.75;
});
const reach = Math.abs(afterRun[2] - afterClimb[2]);
const available = Math.abs(farEnd - afterClimb[2]);
report('…and you can walk the length of it',
  reach > available * 0.8 && afterRun[3] >= top - 0.10,
  `covered ${reach.toFixed(2)} m of the ${available.toFixed(2)} m ahead of you, `
  + `still at gy ${afterRun[3].toFixed(2)}`);
await p.screenshot({ path: 'shots/J-lib/walk-2-along-the-gallery.png' });

// ── guarded ─────────────────────────────────────────────────────────────────
// push at the OPEN side. Which side that is comes from the geometry: the deck
// hugs one wall, so the open edge is the one facing the room's centre.
const openIsWest = deckX > room.cx;
await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0),
  [deckX, (deckZ0 + deckZ1) / 2, openIsWest ? -Math.PI / 2 : Math.PI / 2, top]);
await p.waitForTimeout(300);
const edgeBefore = await pos();
const edgeAfter = await walk('w', async () => (await pos())[3] < top - 0.5, 4000);
report('the balustrade holds you on it',
  edgeAfter[3] >= top - 0.10,
  `pushed ${Math.abs(edgeAfter[0] - edgeBefore[0]).toFixed(2)} m at the open edge, `
  + `gy ${edgeAfter[3].toFixed(2)} — a fall would read below ${(top - 0.5).toFixed(2)}`);

// ── descend ─────────────────────────────────────────────────────────────────
await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0),
  [deckX, climbTowardMinusZ ? deckZ1 - 0.4 : deckZ0 + 0.4,
    climbTowardMinusZ ? Math.PI : 0, top]);
await p.waitForTimeout(300);
const afterDown = await walk('w', async () => (await pos())[3] < 0.05);
report('and you can walk back down to the room floor',
  afterDown[3] < 0.10, `gy ${top.toFixed(2)} -> ${afterDown[3].toFixed(2)}`);

report('no console errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

console.log(fails ? `\n${fails} FAILED` : '\nall good');
await b.close();
// THREE mutations, three verdicts that must go red. Raised from 2 when the
// clearance verdict was added — a selftest bar that does not move with the
// check lets a verdict quietly stop being falsifiable.
if (SELFTEST) process.exit(fails >= 3 ? 0 : 2);
process.exit(fails ? 1 : 0);
