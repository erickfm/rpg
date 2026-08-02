// DO OUTDOOR SEATS LOOK OUT, AND DO SEATED PEOPLE FACE THEIR FURNITURE?
//
// `scripts/seat-facing.mjs` covers the two INDOOR rules and says in its own
// header that it cannot do these two. This is the other half. QUEUE item 28.
//
// Exit 0 = every decidable case is right. Exit 1 = at least one is backwards.
//
//   SHOT_URL=http://localhost:4190/ node scripts/bench-sitter-facing.mjs
//
// ── RULE C: an outdoor seat looks OUT ─────────────────────────────────────
//
// seat-facing.mjs's rule B is indoor-only because outdoors the thing behind a
// seat is a building, and "back to a wall, looking out" is what a bench IS —
// so "something substantial behind me" cannot mean backwards. Its header
// concludes this needs the seat to declare what it is meant to look at.
//
// IT DOES NOT, and the survey is why. Measured across all 17 outdoor seats in
// this world, every one has its nearest solid BEHIND it and open ground ahead:
// park benches 3.4-4.7 m behind and nothing within 8 m in front; the bus stop
// 1.6 m; the car lot chairs 0.6-0.9 m; the tyre stack 1.7 m. Turn any of them
// round and the two numbers SWAP. So the rule is the COMPARISON, exactly as
// rule B is indoors — not a distance, which is what could not be chosen:
//
//     an outdoor seat is backwards if the nearest solid AHEAD is closer
//     than the nearest solid BEHIND.
//
// No `ctx.seat` change, no declared look-at target, and it fails on all 15 of
// the 17 that geometry can decide (see UNDECIDABLE below).
//
// ── RULE D: a seated person faces what they are sitting AT ────────────────
//
// The inequality is the OTHER WAY ROUND from rule C, and that is not a slip.
// A bench sitter looks out at open ground; a person seated at a table, a
// machine or a desk is placed to USE it, so their furniture is in front:
//
//     a seated citizen is backwards if the nearest solid AHEAD is farther
//     than the nearest solid BEHIND.
//
// **AND IT MUST BE READ IN THE CITIZEN CONVENTION, NOT THE SEAT ONE** —
// `citizenSprite` facing is `atan2(vx, vz)`, so 0 = +z and the direction is
// (sin f, COS f). `ctx.seat` yaw is 0 = -z, direction (sin f, -cos f). They are
// 180 deg apart (GOTCHAS 62). Reading the sitters in the seat convention makes
// the casino slot players look 1.55 m into open floor; in their own convention
// they are 0.39 m from the machine they are playing. Same world, same numbers,
// opposite verdicts — which is the whole reason that GOTCHAS entry exists.
//
// This can only be checked at all because `citizenSprite` now publishes
// `mesh.userData.citizenFacing`. It used to keep `facing` in a closure, and
// `mesh.rotation.y` is NOT a substitute: that is the billboard angle, rewritten
// every frame to face the camera, so it measures where the OBSERVER stands.
//
// ── UNDECIDABLE IS REPORTED, NOT PASSED ───────────────────────────────────
//
// Two of the 17 outdoor seats have open ground both in front AND behind (park
// benches at (-12.08, -78.8) and (-21.48, -84.2)). Turning those round changes
// nothing measurable, so this check CANNOT judge them and says so on its own
// output rather than counting them as passes. A check that quietly scores
// unjudgeable cases as green is the family of sleeping guards GOTCHAS 58 is
// about. Covering them needs the seat to declare a look-at target.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const MARGIN = 0.15;   // m — closer than this either way and it is a draw, not a defect

const TARGET = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(TARGET, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, TARGET);
await p.waitForTimeout(900);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const raw = () => window.__ct.colliders().filter((c) => c && isFinite(c.minX) && isFinite(c.minZ));
  const box = (c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ });
  // movers park at x = 999 and shuffle — judge nothing against them
  const first = raw().map(box);
  await new Promise((r) => setTimeout(r, 1200));
  const still = new Set(raw().map(box).map(key));
  const cols = first.filter((c) => still.has(key(c)));

  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const inBox = (c, x, z) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
  const LIMIT = 8.0;
  // COPIED, not re-derived: seat-facing.mjs:69 sets DEEP = 0.80 m as the line
  // between "furniture you are sitting AT" and "a back, a rail, a partition",
  // calibrated in this world against a church pew back at 0.16, a bus bench
  // backrest at 0.30 and a bank partition at 0.18 on one side, and a library
  // reading table at 1.00 and a slot bank at 1.30 on the other. Retyped here
  // because seat-facing.mjs does not export it and is not a file this item
  // names; follow-up queued to hoist it. (BUILDER-BRIEF §8.)
  const DEEP = 0.80;
  const substantial = (c) => Math.min(c.maxX - c.minX, c.maxZ - c.minZ) >= DEEP;

  // distance to the first solid along (fx, fz), ignoring whatever you sit ON
  const march = (x, z, fx, fz, only) => {
    const own = cols.filter((c) => inBox(c, x, z));
    const isOwn = (c) => own.some((o) => o.minX === c.minX && o.minZ === c.minZ
      && o.maxX === c.maxX && o.maxZ === c.maxZ);
    const set = only ? cols.filter(only) : cols;
    for (let d = 0.05; d < LIMIT; d += 0.02) {
      const c = set.find((cc) => !isOwn(cc) && inBox(cc, x + fx * d, z + fz * d));
      if (c) return { d: +d.toFixed(2), size: `${(c.maxX - c.minX).toFixed(2)}x${(c.maxZ - c.minZ).toFixed(2)}` };
    }
    return { d: null };            // null = open ground for LIMIT metres
  };

  const seats = window.__ct.seats()
    .filter((s) => !roomOf(s.pose.x, s.pose.z))
    .map((s) => {
      const { x, z, yaw } = s.pose;
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);       // ctx.ts Seat: 0 = -z
      return { label: s.label, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3),
               ahead: march(x, z, fx, fz), behind: march(x, z, -fx, -fz) };
    });

  const people = [];
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const u = o.userData;
    if (!u || typeof u.citizenFacing !== 'number' || !u.seated) return;
    const e = o.matrixWorld.elements, x = e[12], z = e[14];
    const f = u.citizenFacing;
    const fx = Math.sin(f), fz = Math.cos(f);             // citizens.ts: 0 = +z
    const r = roomOf(x, z);
    // SUBSTANTIAL ONLY, both ways. Without this the rule fires on every person
    // correctly seated with their back to a wall or their own pew back: the
    // first draft failed 5 of 14 on a 0.16 m church pew, a 0.18 m diner
    // partition and two 0.18 m jail walls — the world was right and the rule
    // was wrong. What is left is the class that actually shipped 96 times:
    // a person seated AT a table or a machine, facing away from it.
    people.push({ room: r ? r.id : 'outdoor', facing: +f.toFixed(3),
                  x: +x.toFixed(2), z: +z.toFixed(2),
                  ahead: march(x, z, fx, fz, substantial),
                  behind: march(x, z, -fx, -fz, substantial) });
  });

  return { seats, people };
});
await b.close();

const { seats, people } = out;
const D = (m) => (m.d === null ? Infinity : m.d);
const show = (m) => (m.d === null ? 'open' : `${m.d} (${m.size})`);

// RULE C — outdoor seats: ahead must NOT be nearer than behind
const cUndecidable = seats.filter((s) => s.ahead.d === null && s.behind.d === null);
const cBad = seats.filter((s) => D(s.ahead) < D(s.behind) - MARGIN);
// RULE D — seated people. Only furniture WITHIN REACH counts as "what you are
// sitting at": seat-facing.mjs:68 sets REACH = 0.80 m for exactly this, and
// without it the rule failed a bank customer over a counter 4.79 m behind him,
// which is not his furniture — it is the other side of the room.
const REACH = 0.80;
const near = (m) => m.d !== null && m.d <= REACH;
const dUndecidable = people.filter((q) => !near(q.ahead) && !near(q.behind));
const dBad = people.filter((q) => near(q.behind) && D(q.ahead) > D(q.behind) + MARGIN);

console.log(`RULE C  ${seats.length} outdoor seats — the nearest solid must be BEHIND, not ahead`);
console.log(`   ${seats.length - cBad.length - cUndecidable.length} look out · ${cBad.length} backwards · ${cUndecidable.length} UNDECIDABLE (open both ways)`);
for (const s of cBad)
  console.log(`   FAIL  ${s.label.padEnd(24)} (${s.x}, ${s.z}) yaw ${s.yaw}  ahead ${show(s.ahead)} vs behind ${show(s.behind)}`);
for (const s of cUndecidable)
  console.log(`   ????  ${s.label.padEnd(24)} (${s.x}, ${s.z}) — open ground both ways, geometry cannot judge it`);

console.log(`\nRULE D  ${people.length} seated citizens — must face their own furniture (citizen convention, 0 = +z)`);
console.log(`   ${people.length - dBad.length - dUndecidable.length} face something · ${dBad.length} backwards · ${dUndecidable.length} UNDECIDABLE`);
for (const q of dBad)
  console.log(`   FAIL  ${q.room.padEnd(10)} (${q.x}, ${q.z}) facing ${q.facing}  ahead ${show(q.ahead)} vs behind ${show(q.behind)}`);
for (const q of dUndecidable)
  console.log(`   ????  ${q.room.padEnd(10)} (${q.x}, ${q.z}) — no substantial furniture within ${REACH} m either way`);

if (errs.length) console.log(`\nconsole errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);

// A world with nothing to check must not read as a pass — that is the sleeping
// guard this project has a documented family of.
const nothing = seats.length === 0 || people.length === 0;
if (nothing) console.log('\nFAIL: found no outdoor seats or no seated citizens — the check asserted nothing');
const bad = cBad.length + dBad.length;
console.log(bad || nothing
  ? `\n${bad} seat(s)/sitter(s) face the wrong way`
  : `\nevery decidable outdoor seat looks out, and every seated citizen faces its furniture`);
process.exit(bad || nothing || errs.length ? 1 : 0);
