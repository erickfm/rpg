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
// Five verdicts, in the order they can fail:
//
//   population  the room has a raised level at all. Every verdict below is
//               about a climb, and a climb you cannot find passes for free on
//               a world that failed to build one (GOTCHAS §34).
//   climb       holding W at the foot of the flight puts you ON the deck.
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

if (SELFTEST) {
  // TWO mutations in the LIVE collider array — the same array the movement code
  // reads, so there is nothing to rebuild. One must break the climb and one
  // must break the traverse; if either goes green the check is decoration.
  //
  // They are 4.4 m wide because the flight and the deck are 3.0 m wide and
  // GOTCHAS §27's warning is about the mutation that does not actually break
  // the thing: a wall narrower than the walkway is stepped around, the walk
  // still arrives, and the selftest passes while proving nothing.
  await p.evaluate(([fx, fz, dx, dz0, dz1]) => {
    window.__ct.colliders().push({                 // a wall across the flight's foot
      minX: fx - 2.2, maxX: fx + 2.2, minZ: fz - 0.30, maxZ: fz + 0.30 });
    window.__ct.colliders().push({                 // …and one across the deck's middle
      minX: dx - 2.2, maxX: dx + 2.2,
      minZ: (dz0 + dz1) / 2 - 0.30, maxZ: (dz0 + dz1) / 2 + 0.30 });
  }, [foot.x, foot.z, deckX, deckZ0, deckZ1]);
  console.log('SELFTEST: the flight\'s foot and the deck\'s middle are walled — both must go red');
}

// ── climb ───────────────────────────────────────────────────────────────────
// stand on the room floor a stride short of the foot, facing up the flight.
// yaw 0 looks along -z and PI along +z (the CAMERA convention, GOTCHAS §33).
const startZ = foot.z + (climbTowardMinusZ ? 1.1 : -1.1);
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
  [foot.x, startZ, climbTowardMinusZ ? 0 : Math.PI]);
await p.waitForTimeout(300);
const before = await pos();
const afterClimb = await walk('w', async () => (await pos())[3] >= top - 0.04);
report('holding W at the foot of the flight puts you on the gallery',
  afterClimb[3] >= top - 0.10,
  `gy ${before[3].toFixed(2)} -> ${afterClimb[3].toFixed(2)} (deck is ${top.toFixed(2)})`);
await p.screenshot({ path: 'shots/J-lib/walk-1-on-the-gallery.png' });

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
if (SELFTEST) process.exit(fails >= 2 ? 0 : 2);
process.exit(fails ? 1 : 0);
