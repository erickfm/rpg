// DO seatface.mjs AND seat-facing.mjs SEE THE SAME WORLD?  — QUEUE item 22.
//
// `seatface.mjs` filtered colliders to |minX| < 500. The interior belt starts
// at x ~ 600, so it had never seen one interior wall or table, and reported
// "213 of 219 seats look at open ground" on the same world `seat-facing.mjs`
// walks room by room. That is the failure mode BUILDER-BRIEF §7 names: an
// instrument that cannot fail is worse than one that is wrong.
//
// This asserts the two agree, and it is the CEILING it is really testing:
//
//   0. THE SOURCE. Rules 1 and 2 run a COPY of seatface's march, so on their own
//      they would stay green if somebody put the ceiling back in the file — the
//      exact "check that cannot fail" this item exists to remove. Rule 0 reads
//      seatface.mjs off disk and fails if a coordinate ceiling reappears in it.
//   1. COLLIDER SETS. seat-facing keeps every finite box; seatface used to drop
//      every box past x = 500. Same input or the rest is meaningless.
//   2. PER SEAT. No indoor seat may read "6 m of open ground" from seatface's
//      march while seat-facing measures a wall or a solid within 6 m of it.
//      That is exactly the disagreement the ceiling manufactured, and it is
//      decidable per seat rather than in aggregate.
//
// Exit 0 = they agree. Exit 1 = they do not.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/seatface-agrees.mjs
//
// MUTATION-TESTED on this world, measured rather than guessed: the ceiling
// drops 275 of 514 colliders and puts 181 of 202 indoor seats into
// disagreement, and re-adding it to seatface.mjs turns rule 0 red. A check
// nobody has watched fail is a check that does not work.
//
// DERIVED OR COPIED (BUILDER-BRIEF §8): both algorithms below are COPIED, with
// citations, not re-derived. Neither script exports its logic — each is a
// top-level runner with the algorithm inline in a page `evaluate`, so there is
// nothing to import without editing a file this item does not name. Follow-up
// queued to hoist them into scripts/lib/ so this copy can go away:
//   - collider filter          seat-facing.mjs:91-93   vs seatface.mjs:29-35
//   - roomOf / roomDims        seat-facing.mjs:99-101
//   - wall + solid ahead       seat-facing.mjs:120-133
//   - the 6 m march, S = 0.05  seatface.mjs:37-55
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

// ── rule 0: seatface.mjs must not reintroduce a coordinate ceiling ──
// A magnitude test on a collider's x or z is always this bug: the world is one
// belt of rooms at x ~ 600-1100 and a street at x ~ 0, so any such bound
// silently deletes a district. Matched on the source, not on behaviour.
const SEATFACE = fileURLToPath(new URL('./seatface.mjs', import.meta.url));
const src = readFileSync(SEATFACE, 'utf8');
// \d+ not \d: with a single digit the failure message reported the 500 bound
// as "< 5", which is exactly the kind of misquoted number this project loses
// days to. Caught by reading the mutation run's own output.
const CEILING = /Math\.abs\(\s*\w+\.(?:minX|maxX|minZ|maxZ)\s*\)\s*[<>]=?\s*\d+(?:\.\d+)?/g;
const ceilings = [...src.matchAll(CEILING)].map((m) => m[0]);
const rule0 = ceilings.length === 0;

// not named URL: that shadows the global URL class rule 0 uses above
const TARGET = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(TARGET, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, TARGET);
await p.waitForTimeout(900);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const raw = () => window.__ct.colliders().filter((c) => c && isFinite(c.minX) && isFinite(c.minZ));
  const box = (c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ });

  // movers park at x = 999 and shuffle; judge nothing against them
  const first = raw().map(box);
  await new Promise((r) => setTimeout(r, 1200));
  const still = new Set(raw().map(box).map(key));
  const cols = first.filter((c) => still.has(key(c)));

  // ── rule 1: the ceiling seatface used to apply ──
  const capped = cols.filter((c) => Math.abs(c.minX) < 500);
  const dropped = cols.length - capped.length;

  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const inBox = (c, x, z) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;

  const LIMIT = 6.0;

  const seats = window.__ct.seats().map((s) => {
    const { x, z, yaw } = s.pose;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const r = roomOf(x, z);

    // ---- seatface's march, verbatim (seatface.mjs:37-55) ----
    const hitIn = (set, px, pz) => set.find((c) => inBox(c, px, pz));
    const march = (set) => {
      const own = hitIn(set, x, z);
      const same = (c) => own && c.minX === own.minX && c.minZ === own.minZ;
      for (let d = 0; d < LIMIT; d += 0.05) {
        const c = hitIn(set, x + fx * d, z + fz * d);
        if (c && !same(c) && d > 0.3) return +d.toFixed(2);
      }
      return LIMIT;
    };
    const clearNow = march(cols);       // seatface as it stands now
    const clearOld = march(capped);     // seatface as it was

    // ---- seat-facing's rule A, verbatim (seat-facing.mjs:120-133) ----
    let wallAhead = null;
    if (r) {
      const hw = r.w / 2, hd = r.d / 2;
      const tx = fx > 0 ? (r.cx + hw - x) / fx : fx < 0 ? (r.cx - hw - x) / fx : Infinity;
      const tz = fz > 0 ? (r.cz + hd - z) / fz : fz < 0 ? (r.cz - hd - z) / fz : Infinity;
      wallAhead = Math.min(tx, tz);
    }
    const own = cols.filter((c) => inBox(c, x, z));
    const isOwn = (c) => own.some((o) => o.minX === c.minX && o.minZ === c.minZ
      && o.maxX === c.maxX && o.maxZ === c.maxZ);
    let solidAhead = Infinity;
    for (let d = 0.05; d < (wallAhead ?? 12); d += 0.02) {
      const c = cols.find((cc) => !isOwn(cc) && inBox(cc, x + fx * d, z + fz * d));
      if (c) { solidAhead = d; break; }
    }
    // what seat-facing believes is in front of this seat, in metres
    const facingSees = Math.min(solidAhead, wallAhead ?? Infinity);

    return { label: s.label, x: +x.toFixed(2), z: +z.toFixed(2),
             room: r ? r.id : null, clearNow, clearOld,
             facingSees: isFinite(facingSees) ? +facingSees.toFixed(2) : null };
  });

  return { total: cols.length, capped: capped.length, dropped, seats };
});
await b.close();

const { total, capped, dropped, seats } = out;
const indoor = seats.filter((s) => s.room);

// rule 2: seatface says open ground, seat-facing says there is something there
const disagree = (field) => indoor.filter((s) =>
  s[field] >= 6.0 && s.facingSees !== null && s.facingSees < 6.0);
const now = disagree('clearNow');
const old = disagree('clearOld');

console.log(`colliders: ${total} finite · ${capped} survive |minX| < 500 · ${dropped} dropped by the ceiling`);
console.log(`seats: ${seats.length} registered · ${indoor.length} indoor\n`);

console.log(`RULE 0  seatface.mjs carries no coordinate ceiling`);
console.log(rule0
  ? `   PASS  no magnitude bound on any collider coordinate`
  : `   FAIL  ${ceilings.length} ceiling(s) back in the source: ${ceilings.join(', ')}`);

console.log(`\nRULE 1  same collider set as seat-facing.mjs`);
console.log(dropped === 0
  ? `   PASS  no box is filtered out`
  : `   the ceiling would drop ${dropped} boxes — seatface no longer applies it`);

console.log(`\nRULE 2  no indoor seat reads 6 m of open ground where seat-facing sees something`);
console.log(`   seatface as it stands now : ${now.length} disagreement(s)`);
console.log(`   seatface with the ceiling : ${old.length} disagreement(s)`);
for (const s of now.slice(0, 10))
  console.log(`   FAIL  ${s.label.padEnd(26)} (${s.x}, ${s.z}) ${s.room}` +
    `  seatface ${s.clearNow} m vs seat-facing ${s.facingSees} m`);

const ok = rule0 && now.length === 0;
console.log(ok
  ? `\nseatface.mjs agrees with seat-facing.mjs on this world`
  : `\nseatface.mjs does NOT agree with seat-facing.mjs`
    + (now.length ? ` — ${now.length} seat(s) disagree` : ` — a coordinate ceiling is back in the source`));
// A green run must also show the ceiling WOULD have broken it. If it would not,
// this world no longer exercises the bug and the check is proving nothing.
if (ok && old.length === 0)
  console.log(`WARNING: the ceiling would not change the verdict either — this check proved nothing.`);
process.exit(ok && old.length > 0 ? 0 : 1);
