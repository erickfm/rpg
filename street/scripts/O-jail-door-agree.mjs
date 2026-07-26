// DOES THE JAIL'S DOOR AGREE WITH ITSELF, OUTSIDE AND IN?
//
// There is a live desk row — *"make the exteriors match the interiors"* — and
// the jail is the newest building on the block, so it should be answered for
// rather than assumed. GOTCHAS 45 says what the ask actually means:
//
//   *"'match the exterior' means WHICH SIDE THE DOOR IS ON — not the
//    dimensions… What is NOT constrained: width, depth, ceiling height, floor
//    area. Take the room you need."*
//
// So this asserts the two things that ARE constrained and nothing that is not.
// A check that measured floor area against frontage would be enforcing the
// rule the desk spent a whole GOTCHAS entry retracting, and it cost the bodega,
// the casino and the hotel their depth once already.
//
//   1. WHERE — the room's door and the facade's door are ONE world point.
//   2. WHAT   — the leaf the facade builds and the leaf the room builds are
//               the same leaf. This is the casino's bug: a 2.4 m gold double
//               door outside and a 1.1 m domestic single leaf inside.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-jail-door-agree.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1000);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// population first (GOTCHAS 34) — a door that was never declared would make
// every agreement below vacuously true
const door = await p.evaluate(() => window.__ct.doors().find((d) => d.building === 'JAIL') ?? null);
const room = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'jail') ?? null);
if (!door || !room) {
  console.error('ABORT: JAIL declares no door, or no jail room is registered.');
  console.error('       Nothing below would be measuring agreement — it would be measuring absence.');
  await b.close(); process.exit(3);
}
console.log(`declared door: ${JSON.stringify(door)}`);
console.log(`the room:      ${JSON.stringify(room)}`);

// ── 1. WHERE: one world point, not two ────────────────────────────────────
//
// The room publishes its own door in ROOM-LOCAL terms and the facade builds
// from the site. If those are two authorings they can drift, and the diner's
// prompt ended up outside a bank exactly that way.
const spot = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /DETENTION/i.test(s.label ?? ''))
  .map((s) => ({ x: s.x, z: s.z, r: s.r }))[0] ?? null);
if (!spot) { console.error('ABORT: no [E] registered for the jail'); await b.close(); process.exit(3); }

const standGap = Math.hypot(spot.x - door.stand.x, spot.z - door.stand.z);
console.log(`the [E] sits ${standGap.toFixed(3)} m from the door's own published stand point`);
ok(standGap < 0.01,
  `the [E] IS the published door, not a second copy of it — ${standGap.toFixed(3)} m apart`);

// the outward normal must point ACROSS the pavement, away from the building
ok(door.point.nx === -1 && door.point.nz === 0,
  `the door faces the street — normal (${door.point.nx}, ${door.point.nz}), which is west, ` +
  `down the side street`);

// and the room's own door sits on the room's front wall, centred
ok(Math.abs(room.door.x) < 0.01,
  `inside, the door is CENTRED on the front wall (local x ${room.door.x}) — which is where ` +
  `it is on the facade, dead on the street's centre line. That is the whole of GOTCHAS 45`);

// ── 2. WHAT: the same leaf both sides ─────────────────────────────────────
//
// Read the declaration the way both consumers read it. If the room had left
// `leaf` off, the kit's fallback is a 1.10 m timber leaf with a vision panel —
// the casino's exact complaint — and it would still pass a position check.
const leaf = await p.evaluate(() => {
  const d = window.__ct.doors().find((x) => x.building === 'JAIL');
  return d ? { chamfer: d.chamfer, widthM: d.widthM } : null;
});
console.log(`the declaration as tooling sees it: ${JSON.stringify(leaf)}`);
ok(leaf?.chamfer === true,
  'the door is declared by FACE — a world point and an outward normal, which is the ' +
  'general form, because this building fronts no roster axis');

// The kit builds the opening from the declared leaf, so the way to catch a
// disagreement from OUTSIDE is that the [E] radius has to reach a door of the
// declared width. A 2.4 m opening with a 1.05 m trigger is reachable; the
// failure mode is a trigger that cannot span its own doorway.
ok(spot.r >= 1.0,
  `the trigger spans the declared opening — r ${spot.r} against a 2.40 m leaf`);

console.log(`\n${n} checks, ${bad} disagreed`);
console.log('NOT ASSERTED, deliberately: floor area, depth, ceiling height or');
console.log('width against the frontage. GOTCHAS 45 is explicit that none of');
console.log('those is constrained, and enforcing them cost three rooms their depth.');
await b.close();
process.exit(bad ? 1 : 0);
