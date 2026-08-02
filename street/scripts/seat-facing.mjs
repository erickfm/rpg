// DOES EVERY SEAT LOOK AT SOMETHING?  — a check, not a report.
//
// Five facing bugs have shipped from typed or mirrored yaws: the burger barn
// guy, the librarian, the casino sitter, the park benches and the tax office
// waiting row. `interiors-walk.mjs` asserts "the keeper is looking at you, not
// away" for shop STAFF; nothing asserted anything about the seats the PLAYER
// is put into. This is that assertion, over `__ct.seats()` — so it covers
// seats registered by builders who have not been written yet.
//
// Exit 0 = every seat looks at something. Exit 1 = at least one is backwards.
//
//   SHOT_URL=http://localhost:4189/ node scripts/seat-facing.mjs
//
// ── the two ways a seat is wrong ──────────────────────────────────────────
//
// A. NOSE TO THE WALL. The first solid straight ahead is the seat's OWN ROOM
//    WALL, closer than WALL_MIN. This is the tax office / lot chair class:
//    a yaw that reads fine in isolation and puts you a stride from brick.
//
// B. TURNED AWAY FROM YOUR OWN FURNITURE. Substantial furniture sits within
//    REACH BEHIND you and nothing substantial is nearer in front. You do not
//    sit down with your back 0.37 m from a slot machine bank; if you are, the
//    yaw is mirrored. This is the class the wall test CANNOT see, because a
//    backwards stool in a big room faces open floor.
//
//    IT IS THE COMPARISON THAT MAKES THIS DECIDABLE, not the distance. A first
//    draft failed any seat whose NEAREST furniture was behind it and reported
//    fifteen casino stools that were correct: the floor is crowded enough that
//    a roulette player has a slot bank 0.65 m at his back while the wheel is
//    0.40 m in front of him. Nearest-thing-behind is a fact about the room.
//    Nearer-behind-than-in-front is a fact about the seat.
//
// ── why "substantial" is one number and where it came from ────────────────
//
// Rule B must not fire on the thing you legitimately have behind you: a
// backrest, a rail, a partition, a bollard. It separates those from tables and
// machines on the box's SHALLOWER dimension, measured in this world:
//
//   legitimately behind a seat        offenders it must catch
//   church pew back      0.16 m       library reading table   1.00 m
//   bus bench backrest   0.30 m       casino slot bank        1.30 m
//   bank queue partition 0.18 m       roulette table          2.30 m
//   car-lot tyre stack   0.72 m
//
// DEEP = 0.80 sits in the gap. The margin below it is thin — 0.72 m of tyres —
// so if a new prop lands between 0.72 and 1.00 m deep, widen the rule with a
// second dimension rather than nudging this number until the run goes green.
//
// BEHIND_DEG is set the same way. The one legitimate hit left in the world is
// the casino banquette, whose own 0.90 m bench box reaches 0.14 m past the seat
// point and so is not recognised as what you sit on — it reads 105 deg, i.e.
// alongside. The shallowest genuine offender is a roulette stool at 147 deg.
//
// ── what this check does NOT cover ────────────────────────────────────────
//
// BOTH RULES ARE INDOOR-ONLY, and that is a real gap, not an oversight. On the
// street the thing behind a seat is a building — a bus bench backs onto a shop
// front 0.62 m away and a car-lot chair onto the portacabin at 0.55 m, and both
// are correct, because outdoors "your back to a wall, looking out" is what a
// bench IS. An AABB cannot tell that bench from the same bench turned round, so
// rule B would fire on every one of them. The park benches in the five-bug list
// therefore remain unguarded; guarding them needs the seat to declare what it
// is meant to look at, which is a change to `ctx.seat`, not to this file.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const WALL_MIN = 1.20;      // m — nose-to-the-wall distance that is a defect
const REACH = 0.80;         // m — "furniture you are sitting AT" is this close
const DEEP = 0.80;          // m — shallower than this and it is a back, not a table
const BEHIND_DEG = 125;     // off-axis angle that counts as "turned away from"
const AHEAD_DEG = 60;       // off-axis angle that still counts as "sat at"

const URL = aim('http://localhost:4189/');
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, URL);        // GOTCHAS 26: prove which world, do not name it
await p.waitForTimeout(900);

const out = await p.evaluate(async ({ WALL_MIN, REACH, DEEP, BEHIND_DEG, AHEAD_DEG }) => {
  // MOVERS ARE NOT SCENERY. Cars and the traffic pool park their boxes at
  // x = 999 and shuffle; a seat cannot be judged against a collider that will
  // be somewhere else next frame.
  //
  // THIS USED TO KEEP THE BOXES THAT HELD STILL for 1.2 s, which answers a
  // different question than the one it asks. A citizen who pauses is byte-
  // identical across the window and gets scored as furniture — and a seat
  // "blocked" by a person who then walks away is not a seat defect at all.
  // `__ct.staticColliders()` separates by OBJECT IDENTITY against the two
  // registration hooks (crosstown.ts:1411), so standing still proves nothing
  // and neither does moving.
  //
  // NO COORDINATE CEILING HERE. The report this replaces filtered to
  // |minX| < 500 and the interior belt starts at x ~ 600 — so it could not see
  // a single interior wall or table, and called 222 of 228 seats clear.
  // `staticColliders()` applies no ceiling of its own, which is what keeps that
  // fix intact.
  const cols = window.__ct.staticColliders()
    .filter((c) => c && isFinite(c.minX) && isFinite(c.minZ))
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));

  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const inBox = (c, x, z) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;

  return window.__ct.seats().map((s) => {
    const { x, z, yaw } = s.pose;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);   // ctx.ts Seat: 0 = -z, PI = +z
    const r = roomOf(x, z);

    // WHAT YOU SIT ON IS NOT WHAT YOU LOOK AT. A bench, a pew or a tyre stack
    // whose box contains the seat point would otherwise be reported as the
    // view from 0 m. Excluded by identity, both directions.
    const own = cols.filter((c) => inBox(c, x, z));
    const isOwn = (c) => own.some((o) => o.minX === c.minX && o.minZ === c.minZ
      && o.maxX === c.maxX && o.maxZ === c.maxZ);

    // ── A. what is straight ahead, and is it this room's own wall? ──
    // The wall distance is DERIVED from the room the seat is in (w/d/cx/cz as
    // the room publishes them) rather than measured off a collider, so a wall
    // thickness never has to be retyped here.
    let wallAhead = null;
    if (r) {
      const hw = r.w / 2, hd = r.d / 2;
      const tx = fx > 0 ? (r.cx + hw - x) / fx : fx < 0 ? (r.cx - hw - x) / fx : Infinity;
      const tz = fz > 0 ? (r.cz + hd - z) / fz : fz < 0 ? (r.cz - hd - z) / fz : Infinity;
      wallAhead = Math.min(tx, tz);
    }
    // anything solid between you and that wall means you are looking at a
    // thing, not at brick
    let solidAhead = Infinity;
    for (let d = 0.05; d < (wallAhead ?? 12); d += 0.02) {
      const c = cols.find((cc) => !isOwn(cc) && inBox(cc, x + fx * d, z + fz * d));
      if (c) { solidAhead = d; break; }
    }

    // ── B. the nearest substantial furniture, and its bearing ──
    // Indoors only — see the header. Outdoors every seat has a building behind
    // it and the rule cannot tell that from a mirrored yaw.
    let back = null, front = null;
    for (const c of r ? cols : []) {
      if (isOwn(c)) continue;
      const w = c.maxX - c.minX, dd = c.maxZ - c.minZ;
      if (Math.min(w, dd) < DEEP) continue;              // a back, a rail, a bollard
      const nx = Math.min(Math.max(x, c.minX), c.maxX);
      const nz = Math.min(Math.max(z, c.minZ), c.maxZ);
      const gap = Math.hypot(nx - x, nz - z);
      if (gap > REACH) continue;
      const dot = ((nx - x) * fx + (nz - z) * fz) / (gap || 1);
      const deg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      const hit = { deg: +deg.toFixed(0), gap: +gap.toFixed(2), size: `${w.toFixed(2)}x${dd.toFixed(2)}` };
      if (deg > BEHIND_DEG && (!back || gap < back.gap)) back = hit;
      if (deg < AHEAD_DEG && (!front || gap < front.gap)) front = hit;
    }

    const bad = [];
    if (r && solidAhead === Infinity && wallAhead < WALL_MIN)
      bad.push(`nose to the wall: ${wallAhead.toFixed(2)} m of nothing, then ${r.id}'s own wall`);
    if (back && (!front || back.gap < front.gap))
      bad.push(`turned away from its own furniture: ${back.size} m at ${back.gap} m, ${back.deg} deg off`
        + (front ? `, with only ${front.size} m at ${front.gap} m in front` : ', nothing in front'));

    return { label: s.label, room: r ? r.id : 'outdoor',
             x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3),
             ahead: solidAhead === Infinity ? null : +solidAhead.toFixed(2),
             wall: wallAhead === null ? null : +wallAhead.toFixed(2), bad };
  });
}, { WALL_MIN, REACH, DEEP, BEHIND_DEG, AHEAD_DEG });
await b.close();

const bad = out.filter((s) => s.bad.length);
console.log(`${out.length} registered seats · ${out.length - bad.length} look at something\n`);
if (bad.length) {
  // group, because a mirrored formula produces twenty identical rows
  const by = new Map();
  for (const s of bad) {
    const k = `${s.room}  ${s.label}  |  ${s.bad.join(' + ')}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  for (const [k, rows] of by) {
    console.log(`FAIL  ${k}`);
    console.log(`      ${rows.length} seat${rows.length > 1 ? 's' : ''}, e.g. (${rows[0].x}, ${rows[0].z}) yaw ${rows[0].yaw}`);
  }
}
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n  ${errs.slice(0, 4).join('\n  ')}`);
console.log(bad.length ? `\n${bad.length} seat(s) face the wrong way` : '\nevery seat faces something it could plausibly be looking at');
process.exit(bad.length || errs.length ? 1 : 0);
