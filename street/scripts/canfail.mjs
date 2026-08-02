// CAN MY CHECKS FAIL? Break the guarded thing on purpose; the check must notice.
//
// d0fd37fb closed the same question for A's shelf and named the excuse I had
// been living on: "it fired for real once" is exactly the evidence a stale
// camera offers. Two of my scripts were silently lost to name collisions this
// week (GOTCHAS 24) and the suite stayed green through both, so a check I have
// not watched fail is a check I have no reason to trust.
//
//   node scripts/canfail.mjs            every mutation
//   node scripts/canfail.mjs glow park  just these
//
// Each entry breaks ONE thing a check exists to catch, rebuilds, runs the
// check, and expects it to go red. A mutation the check sleeps through is the
// finding — that is a check that has stopped working, and it looks identical
// to a passing one from the outside.
//
// SAFETY, because this edits source. It restores from a BYTE COPY of the file
// it took before editing — not from git — so uncommitted work survives a run
// untouched and there is no reason to commit anything first.
//
// The first version refused to start on a dirty tree and restored with
// `git checkout --`. That is safe but it made me commit to get clean, and on a
// branch that auto-merges every 15 seconds four `wip` commits went to mainline
// before I noticed. A tool whose safety rule pushes you into a worse habit has
// only moved the failure.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const PROPS = 'src/proto/ct/props.ts';
const GROUND = 'src/proto/ct/tex-ground.ts';
const TEXW = 'src/proto/ct/tex-world.ts';   // A's
const CARS = 'src/proto/ct/cars.ts';        // H's
const TOWN = 'src/proto/crosstown.ts';      // desk's, but the parking draw lives in it
const STREET = 'src/proto/ct/street.ts';    // D's
const ALLEY = 'src/proto/ct/alley.ts';      // D's, split out of street.ts by 23e12c691
const CAT = 'src/proto/ct/cat.ts';          // D's
const CORNER = 'src/proto/ct/bodega-corner.ts';  // D's, split out of street.ts
const BANK = 'src/proto/ct/bank.ts';        // D's, split out of street.ts
const CASINO = 'src/proto/ct/int-casino.ts';  // the 96 slot stools
const TAX = 'src/proto/ct/int-tax.ts';        // the waiting row the user reported
// AIM IT OR IT REFUSES. There is no default any more, and that is the fix for
// the whole class this file kept falling into.
//
// The default WAS 4177, which is also `npm run preview`'s port, so on a machine
// with nine builders it is whoever started one first. Mutations then go into
// THIS tree while the world being measured belongs to somebody else's, every
// case passes, and every case is scored SLEPT. That has now cost two separate
// rounds: an earlier author reported 0/3 SLEPT and it was 3/3 against their own
// port, and five guards were reported as having STOPPED GUARDING when all five
// plus crowd-lane CAUGHT once aimed correctly. Nobody was careless either time;
// the instrument answered a question it had no way to ask.
//
// A default that is usually wrong is worse than no default, because it produces
// a confident number instead of an error. So: no SHOT_URL and no port means
// exit 2 and nothing is measured.
//
//   SHOT_URL=http://localhost:4188/ node scripts/canfail.mjs
//   node scripts/canfail.mjs 4188 density
//   ./scripts/guards.sh                       # picks a port, builds, runs it
const PORT_ARG = process.argv.slice(2).find((a) => /^\d{4}$/.test(a));
const URL = process.env.SHOT_URL ?? (PORT_ARG ? `http://localhost:${PORT_ARG}/` : null);
if (!URL) {
  console.error(`\n  CANFAIL WAS NOT AIMED — nothing was measured.`);
  console.error(`  This used to default to :4177, which on this machine is whoever started a`);
  console.error(`  preview first. Measuring another builder's world while mutating THIS tree`);
  console.error(`  reports every guard as asleep, and that has cost two rounds already.`);
  console.error(`\n  Aim it at a world built from THIS tree:`);
  console.error(`    ./scripts/guards.sh                                  # does it for you`);
  console.error(`    SHOT_URL=http://localhost:<your port>/ node scripts/canfail.mjs`);
  console.error(`    node scripts/canfail.mjs <port> [case ...]\n`);
  process.exit(2);                                        // usage, not a finding
}

// [name, file, needle, replacement, script, args, what the check should say]
const CASES = [
  // A's, added by A. The scene-mutation selftests on the appearance guards are
  // safe today only because nothing rewrites a texture per frame — and "safe
  // today" is a fact about today's code, which is the argument bf8203196 made for
  // routing density here. This one restores the ORIGINAL BUG in source: the
  // linear congruence the user saw as diagonal stripes.
  ['window-lattice', TEXW,
    'return ((h ^ (h >>> 16)) >>> 0) % 100 < pct;',
    'return ((f * 7 + c * 3) % 5) === 0;   // the congruence the user reported',
    'window-lattice.mjs', [], 'lit windows back on a diagonal lattice'],

  // ── A's two, added by A. Both mutate the thing the check exists to catch,
  // and both are in tex-world.ts, so a source mutation reaches them where a
  // runtime one might not — the failure mode that beat A's own selftests twice
  // (props.ts re-stamps userData every frame; the sky is rewritten every frame).
  //
  // NO seethrough CASE, and the reason is worth more than the case.
  //
  // Two mutations were tried and the check SLEPT through both, correctly.
  //
  //   hide every shopfront's interior backing  — a shopfront front is a solid
  //     box, so the backing only matters where the face is a real cut-out, and
  //     exactly one is: the bodega's canted bay. Removing backings world-wide
  //     removes nothing anyone could see through.
  //   hide the BAY's backing, the historical bug verbatim — still nothing,
  //     because D's rebuild put masonry behind the chamfer. The bay is now
  //     prevented twice over: a backing in front of a wall.
  //
  // So there is no single-line source mutation that produces see-through any
  // more, which is a statement about the world being sound rather than about
  // the check. A case that is permanently red teaches people to ignore this
  // suite, so it is not here. check-seethrough keeps its own --selftest, which
  // hides faces AND backings together and does go red.
  // The density stamp is what pattern #1 is verified against. Claim a face was
  // painted for a width it was not, and density.mjs must notice the canvas does
  // not fit the face it landed on.
  // NEEDLE RE-QUOTED, not redesigned. A's stamp gained `ppmW`/`ppmH` and wrapped
  // onto two lines, so the single-line quotation stopped matching and this case
  // was guarding NOTHING — `density.mjs` had no mutation behind it and would
  // have looked exactly as green as one that did. canfail said so plainly
  // ("RESTORE FAILED ... does not hold its original text"), which is the only
  // reason it surfaced. Fifth stale needle this week; a mutation case is a
  // hard-coded quotation of somebody's source, and a REFACTOR breaks it
  // silently where a bug never would (GOTCHAS 24's neighbour).
  //
  // The mutation is unchanged in meaning: claim the masonry was painted for a
  // width 1.4x what it was mapped to. This is A's case in my file — the
  // quotation is repaired, the property under test is untouched, and A should
  // say if the case wants retiring rather than repairing.
  ['density', TEXW,
    't.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H,',
    't.userData.masonry = { ppm, mult, wMeters: wMeters * 1.4, hMeters, baseY, W, H,',
    'density.mjs', [], 'masonry painted for a width it was not mapped to'],

  // Restores the fencepost the user photographed as "chopped off at points":
  // size the window run as whole BAYS rather than as what the windows span.
  // The run then centres on something 1.25 m too long and every facade on the
  // block sits left of centre — which is what it did for months, uniformly
  // enough that it read as a style. In SOURCE, because the property under test
  // is the arithmetic, not the stamp the runtime selftest can reach.
  ['facade-run', TEXW,
    'const spanOf = (n: number) => (n - 1) * BAY_M + WIN_W;',
    'const spanOf = (n: number) => n * BAY_M;   // whole bays, the original fencepost',
    'facade-run.mjs', [], 'the window run pushed off centre on every facade'],

  // Moves the kerb line the guard protects out to infinity rather than
  // neutering the function: same effect (nothing is ever pushed clear), but it
  // still typechecks, and an uncompilable mutation tests nothing.
  ['footprint', PROPS,
    'const KERB_X = ROAD_HALF;',
    'const KERB_X = 9999;',
    'footprint.mjs', [], 'litter allowed to straddle the kerb'],

  ['kerbcut', GROUND,
    'const DRIVES: { x: number; z: number; hw: number }[] = [',
    'const DRIVES: { x: number; z: number; hw: number }[] = [].concat([] as never[]) as any; const _DRIVES_OLD = [',
    'kerbcut.mjs', [], 'the car lot has no curb cut at all'],

  // MOVES the cut instead of removing it. kerbcut.mjs samples everything
  // relative to CZ = 2.6, a remembered coordinate — the cut is derived from the
  // lot's AISLE_HW, which is another builder's, so it can move without anyone
  // touching this script. Before the cross-check this mutation would have found
  // uncut kerb at 2.6 and had no way to tell "moved" from "missing".
  ['kerbcut-moved', GROUND,
    '  { x: ROAD_HALF, z: 2.6, hw: 3.4 },     // the car lot, east kerb',
    '  { x: ROAD_HALF, z: -14.0, hw: 3.4 },   // selftest: cut moved down the block',
    'kerbcut.mjs', [], 'the curb cut somewhere the lot is not'],

  // THE ALLEY DISH IS TWO HALVES AND EITHER ONE ALONE IS A BUG, so both are
  // mutated. This is the defect the feature was deferred over (`177b0e332`):
  // dishing the paving you can SEE without registering the floor you WALK gives
  // a player striding flat across a visible bowl — and it looks finished from
  // any screenshot, which is why a camera was never going to catch it.
  // REPOINTED at ct/alley.ts. 23e12c691 split the alley out of street.ts and
  // both needles below went with it, so for a while these two cases matched
  // NOTHING — canfail said so plainly ("NEEDLE matched 0x, not 1"), which is the
  // only reason this was caught rather than sitting green and guarding air. A
  // mutation case is a hard-coded quotation of somebody's source; it is the one
  // kind of test that a REFACTOR breaks silently and a bug never does.
  // RUN THESE AGAINST YOUR OWN PORT, and read the warning below before believing
  // a SLEPT. This file's default URL is 4177 — which is also `npm run preview`'s
  // port, so on a machine with nine builders it is whoever started one first.
  // My first run of the three cases below reported:
  //
  //     FAIL rulings-cat     SLEPT
  //     FAIL rulings-awning  SLEPT
  //     FAIL rulings-atm     SLEPT      0/3 checks caught their mutation
  //
  // and the check was fine. 4177 was serving build 6fdc3d2ca — another
  // builder's tree — so the mutations went into MY source and the world being
  // measured never had them. The same three cases against my own port:
  // 3/3 CAUGHT. `SHOT_URL=http://localhost:<yours>/ node scripts/canfail.mjs`.
  //
  // GOTCHAS §32 already records the other face of this: canfail scores CAUGHT on
  // any non-zero exit, so a wrong-world abort (exit 3) certifies as a catch —
  // a false GREEN. This is the mirror, a false RED, and it is the more expensive
  // one: a green you may not look at twice, but a red sends somebody to rewrite
  // a check that works. I was one step from doing exactly that.
  //
  // ── the cases ──
  //
  // THE USER'S RULINGS, mutated in the WORLD rather than in the check.
  //
  // D-rulings-hold already ships a --selftest, and that is a DIFFERENT
  // instrument: it inverts the script's own assertions in-process, which proves
  // the predicates are the right way round and proves nothing about whether the
  // check would notice the world moving under it. GOTCHAS §27 is explicit —
  // "never let a check's tolerance be set by an argument, set it by a mutation"
  // — and the mutation it means is to the thing being measured.
  //
  // One case per ruling, each restoring the exact defect the user reported, so
  // a check that has quietly stopped watching one of the four goes red on that
  // one alone rather than hiding behind the other three.

  // The sixth cat note: it stood ON the printed paper's corner.
  ['rulings-cat', CAT,
    '      [-10.00, -42.35],  // where the pictures agreed, not where arithmetic pointed',
    '      [-10.60, -41.45],  // selftest: back on the printed paper',
    'D-rulings-hold.mjs', [], 'the cat standing on the paper the user moved it off'],

  // The sixth facing bug: the awning tipped up at the sky, its raised lip
  // cutting across the bottom of the BODEGA fascia.
  ['rulings-awning', CORNER,
    '    awn.rotation.x = 0.18;    // outer edge LOW: slopes down and away from the face',
    '    awn.rotation.x = -0.18;   // selftest: tipped back at the sky again',
    'D-rulings-hold.mjs', [], 'the awning sloping up and hiding the sign again'],

  // The fascia bottom the user named three times.
  ['rulings-atm', BANK,
    '  const M_KEYS_BOT = KERB_H + 1.04, M_BOT = KERB_H + 0.75;',
    '  const M_KEYS_BOT = KERB_H + 1.04, M_BOT = KERB_H + 0.90;  // selftest: pre-ruling',
    'D-rulings-hold.mjs', [], 'the fascia bottom back where the ruling moved it from'],

  ['alleydish', ALLEY,
    '    a.ground((x: number, z: number) => (dishAt(x, z) < 0 ? dishAt(x, z) : null));',
    '    /* selftest: the visible half only — no floor registered */',
    'alleydish.mjs', [], 'the player walking flat over a dip they can see'],

  // The inverse, and it is NOT redundant. The first mutation leaves the mesh
  // dished and the picker flat; this leaves the picker dished and the mesh
  // flat, which is a player sinking into paving that is visibly level. A check
  // that compared either half against a formula instead of against the other
  // would sleep through exactly one of these two, and it would look identical
  // to a passing run.
  ['alleydish-flat', ALLEY,
    '        pos.setZ(i, dishAt(-FACE - 3.3 + pos.getX(i), (AZ0 + AZ1) / 2 - pos.getY(i)));',
    '        pos.setZ(i, 0);   // selftest: flat paving, picker still dishes',
    'alleydish.mjs', [], 'the player sinking into visibly level paving'],

  // RETARGETED. This mutated PUDDLE_C to make the puddles lighter than the road
  // — the contrast inversion, and the best case in this file. Its subject was
  // deleted by the desk on 2026-07-25, so it now guards what wetness.mjs still
  // asserts: that the street STAYS WET after the rain stops. Drying almost
  // instantly is the failure the user would actually notice, and it is the half
  // of the weather system that was kept and liked.
  ['wetness', PROPS,
    'const dryFor = 48 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'const dryFor = 0.24 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'wetness.mjs', ['probe'], 'the street bone dry on the last drop of rain'],

  ['glow', PROPS,
    'halo.position.set(headX, sidewalkY + LAMP_H - 0.31, headZ);',
    'halo.position.set(headX + 1.4, sidewalkY + LAMP_H - 0.31, headZ);',
    'glow.mjs', ['probe'], 'the glow floating 1.4 m off its lamp head'],

  // Switches the lamp pool off at the source. The halo SHEET still hangs in
  // exactly the right place, so the anchoring half of glow.mjs stays green —
  // which is the point: for weeks that was the only half there was, and the
  // user's actual request was "light around the light posts to show up on the
  // objects and entities under the lights".
  // A NaN IN THE GRADE, which is the failure grade-sane.mjs exists for: it does
  // not throw, does not log, and three.js uploads it happily — you get a black
  // or white mesh and no clue where from. POOL_GAIN feeds the multiplier every
  // lit material takes, so poisoning it poisons the colours without touching
  // any geometry. Every other check on this shelf stays green through it, which
  // is the point.
  // WARMED TWICE. The grade's ceiling is exactly WARM_R: `mul` is capped at 1
  // and `base` is an authored colour, so 1.15 is the most it can produce and
  // grade-sane reads that number out of props.ts rather than repeating it.
  // Applying the warm term a second time — which is what a second writer on one
  // of these materials would look like, or an uncapped pool gain — takes it to
  // 1.32 and nothing else in the suite would notice: it is not NaN, not
  // negative, and clamps at render, so the frame merely looks slightly hotter.
  // `wet-blind` STOOD HERE AND IS GONE, not retargeted. It retextured the
  // puddle sheet so wetness.mjs's predicate stopped recognising it — a
  // blinding case against the pool population floor. Both the sheet and the
  // floor were removed with standing water, so there is no population left to
  // blind: the surviving verdicts read surface COLOUR over time, which cannot
  // silently find nothing. Recorded rather than deleted quietly, because a
  // case disappearing from this list is exactly what it would look like if
  // someone had simply given up on it.

  ['grade-twice', PROPS,
    '        e.base.r * mul * (1 + (WARM_R - 1) * k),',
    '        e.base.r * mul * (1 + (WARM_R - 1) * k) * (1 + (WARM_R - 1) * k),',
    'grade-sane.mjs', [], 'a material warmed twice — over the ceiling the grade can produce'],

  ['grade-nan', PROPS,
    'const POOL_GAIN = 12;        // what a lamp hands back, against the deep floor',
    'const POOL_GAIN = NaN;       // selftest: poison the grade',
    'grade-sane.mjs', [], 'a NaN quietly poisoning every lit material'],

  // BLIND THE CHECK, not the world — the sibling of footprint-blind. The lamps
  // still glow; the stamp glow.mjs pairs them by is simply gone from one of the
  // two places that sets it, so the check finds fewer halos than there are. Its
  // mismatch test is an EQUALITY (paired vs stamped), which 0 of 0 satisfies,
  // and its verdict is an ABSENCE, which is free over an empty set. The floor
  // is what turns that into red.
  ['glow-blind', PROPS,
    "    halo.userData.lampPart = 'halo';\n    halo.position.set(headX,",
    "    halo.userData.lampPart = 'halo-selftest';\n    halo.position.set(headX,",
    'glow.mjs', ['probe'], 'the lamps glowing but their halos invisible to the check'],

  ['glow-pool', PROPS,
    'const POOL_GAIN = 12;',
    'const POOL_GAIN = 0;',
    'glow.mjs', ['probe'], 'lamps that glow but light nothing beneath them'],

  ['park', PROPS,
    'lens.userData.parkLantern = true;',
    '',
    'park.mjs', [], 'the park lanterns unfindable'],

  // The WALK half of park.mjs, which the case above does not touch. Widening
  // the lamp collider to 2.4 m walls the loop the legs walk. Added because I
  // loosened that criterion — distance alone was one pedestrian from flipping
  // — and a criterion I loosened without a mutation behind it is a criterion
  // I have only assumed still works.
  // Darkens SOME of the park's lanterns, not all: the two end lamps stop being
  // built, so eight remain and sixteen sheets stay lit. The old bar was "8 or
  // more sheets lit" against a world that lights 20, so this passed — six
  // lanterns could have gone black behind it. This is the park the auditor
  // found "NOT lit — ZERO light sources".
  // BURIED LIGHT. Puts the park pool decal back at +0.02 off the base slab,
  // which is inside ct/park.ts's LIFT stack (field 0.5, paths 1.0, litter 1.5,
  // bald ring 2.0, desire lines 2.5, on a 0.006 unit). The lanterns still emit
  // and every existing park verdict still passes — the light is simply drawn
  // under the ground detail where they cross. Three of ten pools, worst 18.6%
  // of its area, which is what this looked like when I found it.
  // The street twin of park-buried. Drops the 5.6 m street pool a centimetre
  // BELOW the road it lies on, so the roadway itself covers it: the lamps still
  // glow, the near/far tint ratio is unchanged because that is a property of the
  // material and not of what is drawn over it, and the light is simply not
  // there. Every other verdict in glow.mjs stays green.
  ['glow-buried', PROPS,
    'pool.rotation.x = -Math.PI / 2; pool.position.set(headX, 0.02, headZ); scene.add(pool);',
    'pool.rotation.x = -Math.PI / 2; pool.position.set(headX, -0.01, headZ); scene.add(pool);',
    'glow.mjs', ['probe'], 'the street lamplight drawn UNDER the road it falls on'],

  // INSIDE THE HILL. park-buried drops the decal into ct/park.ts's LIFT stack
  // and is caught by the coverage test; this drops it BELOW the terrain, which
  // that test cannot see — it looks for opaque meshes drawn over the decal, and
  // the ground is a mound sampled through groundAt rather than a lid. The park
  // runs from 0.104 at its edge to 0.403 at the centre, so -0.20 is under it
  // everywhere.
  ['park-sunk', PROPS,
    'pool.position.set(x, y0 + 0.05, z); scene.add(pool);',
    'pool.position.set(x, y0 - 0.20, z); scene.add(pool);',
    'park.mjs', [], 'the park lamplight buried inside the hill it is meant to light'],

  ['park-buried', PROPS,
    'pool.position.set(x, y0 + 0.05, z); scene.add(pool);',
    'pool.position.set(x, y0 + 0.02, z); scene.add(pool);',
    'park.mjs', [], 'the park lamplight drawn UNDER the ground detail it falls on'],

  ['park-partial', PROPS,
    '    for (const cz of [lz0 + 0.95, lz1 - 0.95]) {\n      makeParkLamp((lx0 + lx1) / 2, cz);\n    }',
    '    for (const cz of [] as number[]) {\n      makeParkLamp((lx0 + lx1) / 2, cz);\n    }',
    'park.mjs', [], 'the park lit everywhere except its two ends'],

  ['park-walk', PROPS,
    'obstacle({ minX: x - 0.16, maxX: x + 0.16, minZ: z - 0.16, maxZ: z + 0.16 });',
    'obstacle({ minX: x - 2.4, maxX: x + 2.4, minZ: z - 2.4, maxZ: z + 2.4 });',
    'park.mjs', [], 'the park loop walled shut at every lantern'],

  // The WALK half of bus.mjs. Widening the street-tree trunk collider to 1.2 m
  // severs the east pavement at every tree, which is the fault that actually
  // happened once — I moved the pits inboard and left 4 cm of lane. Added
  // because I replaced that walk's criterion, and a criterion I loosened
  // without a mutation behind it is one I have only assumed still works.
  ['bus-walk', PROPS,
    'obstacle({ minX: tx - 0.08, maxX: tx + 0.08, minZ: pz2 - 0.12, maxZ: pz2 + 0.12 });',
    'obstacle({ minX: tx - 1.2, maxX: tx + 1.2, minZ: pz2 - 1.2, maxZ: pz2 + 1.2 });',
    'bus.mjs', ['walk'], 'the east pavement severed at every street tree'],

  ['bus-bench', PROPS,
    'const LEG_TOP = SEAT_Y - 0.02, LEG_H = LEG_TOP - sidewalkY;',
    'const LEG_TOP = SEAT_Y + 0.025, LEG_H = LEG_TOP - sidewalkY;',
    'bus.mjs', ['bench'], 'bench legs coplanar with the seat slats (GOTCHAS 6)'],

  ['basin', GROUND,
    'const PROUD = 0.007;',
    'const PROUD = -0.02;',
    'basin.mjs', [], 'the throat sunk below the casting instead of proud'],

  // ONLY THE WEST BASIN. Flipping its `side` builds it mirrored into its own
  // kerb, and the east one is untouched — so this fails if and only if the
  // probe actually looks at both. It probed the east one alone until now, and
  // graded the catch basin DONE on it; `side` flips the sign on every proud
  // face, so a fault there could live on the west forever.
  ['basin-west', GROUND,
    'basin(-ROAD_HALF, -105, -1);   // west gutter, above the inside bend',
    'basin(-ROAD_HALF, -105, 1);    // selftest: built inside out',
    'basin.mjs', [], 'the west basin mirrored into its own kerb'],

  // NEEDLE RE-QUOTED, not redesigned — the sixth stale needle this month, and
  // the only one that had a second-order cost (see `applied` at the foot of this
  // file). `2bb64f49f` took the drop count from 500 to 2600 because rain "was
  // never heavy", and this quotation went on saying 500, so the case patched
  // ZERO BYTES from that commit until now.
  //
  // NOT `fc332c5c5`, which is the commit the report of this arrived citing.
  // That one is the sibling piece of the same rain work — its own message says
  // "5x the drops is 5x the posts", so RAIN_N was ALREADY 2600 when it was
  // written — and `git show fc332c5c5 -- src/proto/ct/props.ts` contains no
  // RAIN_N line at all. The two are parallel branches, neither an ancestor of
  // the other, both merged into mainline three minutes apart. Recorded because
  // this is the twin-hash trap `hashes-resolve` was written for, and it caught
  // a reader who was looking straight at it.
  //
  // The property under test is untouched: a storm with six drops in it.
  //
  // AND 6 MUST STAY UNDER 100 (w22, from the first end-to-end run of this
  // harness). `rain.mjs` locates the storm with `c.isPoints &&
  // position.count > 100`, so a buffer of 6 makes the particle system
  // undiscoverable and the "is it raining" leg goes red. Raise that threshold
  // and this case silently stops proving anything — the same coupling that let
  // the needle rot, one level up.
  ['rain', PROPS,
    'const RAIN_N = 2600;',
    'const RAIN_N = 6;',
    'rain.mjs', [], 'a storm with six drops in it'],

  // Reinstates the exact bug the user reported — "make wetness last a lil after
  // it stops raining" — by drying the street 200x faster, so the ground follows
  // the rain instead of remembering it. The request had an implementation
  // (props.ts:1103) and no check, which is one refactor from being withdrawn
  // with nobody seeing it go.
  ['rain-memory', PROPS,
    'const dryFor = 48 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'const dryFor = 0.24 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'rain.mjs', [], 'the street forgetting the weather the moment rain stops'],

  // First aim of this one was PIT_CLEAR against trash.mjs, and trash.mjs slept
  // — correctly. It guards the litter SET (count, burial, repeated rotations);
  // the tree pits are footprint.mjs's, below. The mutation was sound and
  // pointed at the wrong tool, which is its own kind of check that proves
  // nothing.
  // Puts something on the street that the user never approved. First aim was to
  // DELETE a drop and require the missing-type check to fire, and trash.mjs
  // slept — correctly: every one of the five has at least two placements, so
  // removing one line removes an instance and not a type. Fourth mutation this
  // session I have aimed wrong, and the fourth time the check was right.
  //
  // Renaming a CALL was no better: drop() looks the name up in the catalogue, so
  // an unknown one places nothing at all and the count merely falls by one.
  // Two wrong aims at the same target, both of which the check was right to
  // sleep through.
  //
  // The catalogue KEY is the single point that removes a whole type: rename it
  // and all three 'milk crate' calls find nothing. Count goes 14 -> 11, which
  // also proves the count verdict now reaches the exit code — before this it
  // printed FAIL and returned 0.
  ['trash-set', PROPS,
    "    ['milk crate', () => {",
    "    ['crate withdrawn by selftest', () => {",
    'trash.mjs', ['probe'], 'a whole approved litter type gone from the street'],

  ['trash', PROPS,
    '    o.position.set(cx, gy - bb.min.y, z);',
    '    o.position.set(cx, gy - bb.min.y - 0.05, z);',
    'trash.mjs', ['probe'], 'every piece of litter sunk 5 cm into the pavement'],

  // THE POPULATION, not the position. Every other footprint case moves
  // something and asks whether the check notices; this one leaves the tree pits
  // exactly where they are and makes the CHECK unable to see them — the pit
  // predicate in footprint.mjs matches a 1.0 m plane, so 1.04 is still a tree
  // pit on the street and no longer a tree pit to the check.
  //
  // Before the floors landed this SLEPT, and loudly:
  //
  //     on the main street: 31 litter meshes, 0 tree pits, 9 water sheets
  //     OK  nothing straddles the kerb line (0)     ... every line OK, exit 0
  //
  // The clearance verdicts are all absences, and an absence is free over an
  // empty set. footprint-pits cannot catch this because it moves PIT_X, leaving
  // the pits matching the predicate — a mutation that keeps the population
  // intact proves nothing about whether the population is checked.
  //
  // THE NEEDLE MOVED WITH THE FIX. This used to widen the pit plane from 1.0 to
  // 1.04, because footprint.mjs identified a pit by that exact dimension. It
  // reads the userData.groundProp stamp now — which is what stopped the check
  // going blind when the well was lengthened to 1.4 m — so blinding it means
  // breaking the STAMP, not the geometry. Same defect, same verdict, one layer
  // more honest: the pits are still there, still the right size, and the check
  // cannot see them.
  ['footprint-blind', PROPS,
    "pit.userData.groundProp = 'tree pit';",
    "pit.userData.groundProp = 'tree pit renamed by selftest';",
    'footprint.mjs', [], 'the tree pits still there but invisible to the check that guards them'],

  // Aimed at PIT_CLEAR first and footprint.mjs slept — but the check was
  // right and the MUTATION was inert: PIT_CLEAR is derived from PIT_X for the
  // record and positions nothing, so zeroing it changes no geometry. A
  // mutation that does not mutate proves nothing about the check that ignores
  // it. PIT_X is the constant that actually moves the well.
  // Puts the water back where the user complained it was: "the puddle doesnt
  // make sense here. the gutter should have the water in the gutter". Moving
  // GUT 1.6 m off the kerb scatters the pools into the travel lane. The request
  // was built and then never asserted — footprint.mjs COUNTED the sheets and
  // asked nothing of them — so a pool in mid-road read as nine happy puddles.
  // Aimed at GUT first and footprint.mjs slept — correctly. GUT places the
  // LITTER decals; the pools are PAN_X, "centred in the pan". Third mutation
  // this session I have pointed at the wrong constant, and each time the check
  // was right and my aim was wrong, which is its own argument for running them.
  // RETARGETED, because the thing it guarded is gone. It used to shove the
  // pools out of the pan; the desk removed standing water entirely on
  // 2026-07-25 after five passes, so there are no pools to shove and the old
  // needle matched 0x — a case that silently stops guarding, which is the
  // third time this has bitten me after fixing what sat underneath it.
  //
  // The assertion is now the OPPOSITE one — that no standing puddle exists —
  // so the mutation that proves it is a puddle coming BACK. This re-adds one
  // 48x32 transparent sheet in the gutter, which is exactly what a sixth
  // attempt would look like, and footprint must go red on it. That is the
  // enforcement behind "do not re-add them" rather than a comment hoping so.
  ['footprint-water', PROPS,
    'for (let i = 0; i < 7; i++) { rnd(); rnd(); rnd(); rnd(); rnd(); }',
    `for (let i = 0; i < 7; i++) { rnd(); rnd(); rnd(); rnd(); rnd(); }
  {
    const _t = declareSurface(pixTex(48, 32, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 48, 32);
    }), 'ground');
    const _m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.2),
      new THREE.MeshBasicMaterial({ map: _t, transparent: true, depthWrite: false }));
    _m.rotation.x = -Math.PI / 2;
    _m.position.set(ROAD_HALF - 0.22, surfaceY(ROAD_HALF - 0.22) + 0.005, -30);
    scene.add(_m);
  }`,
    'footprint.mjs', [], 'a standing puddle re-added after the desk removed them'],

  // Needle updated with the fix: PIT_X is derived from TRUNK_X now rather than
  // written as a literal, because the well is centred on the trunk. 5.09 still
  // shoves it flush into the kerb, which is the state this case exists to catch.
  // THE EXACT ERROR THE AUDITOR REJECTED. The soldier course edging the bodega's
  // cut corner was laid 90° to the face, because after `rotation.x = -PI/2` the
  // plan spin happens in the already-rotated frame and the sign reads backwards.
  // Flipping it here puts the band's long axis back along the face NORMAL —
  // square across the joint it exists to terminate — and footprint must say so.
  //
  // Worth having as a case rather than as a memory: my own first probe asserted
  // the wrong one of `dx+dz==0` and `dx-dz==0` and certified the broken version
  // as correct. A mutation cannot be fooled by an inverted comparison; it either
  // goes red or it does not.
  // NEEDLE MOVED WITH THE FIX. This flipped the sign of a hand-derived atan2;
  // ct/bodega-corner.ts now publishes `yawAlong` and props.ts uses it directly,
  // so there is no derivation left to break. Turning the published axis a
  // quarter turn reproduces the same defect — the band across the joint it
  // exists to terminate — against the code as it now stands.
  ['course-across', PROPS,
    'soldierCourse(scene, cx, cz, BAY.yawAlong, BAY.faceWidth, 0.42, KERB_H,',
    'soldierCourse(scene, cx, cz, BAY.yawAlong + Math.PI / 2, BAY.faceWidth, 0.42, KERB_H,',
    'footprint.mjs', [], 'the bodega course laid across the face it edges, as the auditor found it'],

  ['footprint-pits', PROPS,
    'const PIT_X = TRUNK_X;',
    'const PIT_X = 5.09;',
    'footprint.mjs', [], 'tree pits run flush into the kerb'],
  // ── H's four. Every mutation here is one I performed by hand and watched go
  // red this session; encoding them makes it repeatable rather than a claim in
  // a commit message.
  //
  // NO gaps CASE, and the reason is the useful part: putting a vehicle on an
  // [E] spot takes TWO coordinates, because the parking draw sets x from
  // PARK_SNUG and z from the seeded stream, and a door sits on the pavement at
  // neither. My first hand attempt moved only z and the check correctly stayed
  // green — the car was 2.6 m away on the carriageway. A single find/replace
  // cannot express it, and a case that does not actually break the thing tests
  // nothing. gaps.mjs is registered with no selftest rather than a fake one.
  ['carstate-bay', CARS,
    'const bayM = new THREE.MeshBasicMaterial({ color: 0x14161a });',
    'const bayM = new THREE.MeshBasicMaterial({ color: new THREE.Color(body) });',
    'carstate.mjs', [], 'an open hood over body-coloured metal — the truck-bed bug'],

  // The hood is a lid RESTING on the beltline. Drop it 0.1 m and it is buried
  // inside the slab, which is exactly what the literal 0.89 would have caused
  // the moment BELT moved.
  ['carstate-hood', CARS,
    // The sedan's, specifically: the same call appears once per kind, and
    // canfail requires a needle that matches exactly one place.
    'hood.position.set(0, BELT + 0.05, -(half + 0.95) / 2 + 0.02);',
    'hood.position.set(0, BELT - 0.05, -(half + 0.95) / 2 + 0.02);',
    'carstate.mjs', [], "the hood buried inside the slab it should rest on"],

  // Parking off the UNSEEDED stream. The world still looks right; every
  // fingerprint downstream of it quietly stops being evidence.
  ['park-repro', TOWN,
    'const zDrawn = z0 + (rnd() - 0.5) * 2.4;',
    'const zDrawn = z0 + (Math.random() - 0.5) * 2.4;',
    'park-repro.mjs', [], 'parking that re-rolls on every load'],

  // Pushes every walkable node 0.95 m further from the kerb, so citizens stand
  // against the shopfronts. A stopped body then seals the 2 m lane (GOTCHAS §9)
  // instead of leaving a gap beside it. Watched by hand when the check was
  // written — 153 of 714 samples sealed, tightest gap 0 m — and encoded here
  // because crowd-walk was registered with no selftest at all, which GOTCHAS 34
  // is the house rule about.
  ['crowd-lane', 'src/proto/ct/crowd-net.ts',
    'const IN = 1.0;',
    'const IN = 1.95;',
    'crowd-walk.mjs', [], 'citizens standing where a stopped body seals the walk'],

  // The three-band face, restored. 10 texels of head cannot carry 3 texels of
  // shading either side without reading as skin discolouration.
  ['faces-bands', 'src/proto/ct/citizens.ts',
    "g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(cx - 5, oy + 8, 1, 12);",
    "g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(cx - 5, oy + 8, 3, 12);",
    'faces.mjs', [], 'a face banded into three tones'],

  // ── A's TWO from the facade work, registered late and deliberately ────────
  //
  // I shipped five checks saying "not registered, no selftest" in each commit
  // message. That is an honest label on a debt, not a discharge of it: GOTCHAS
  // 24's whole point is that a check nobody runs does not go red, it stops
  // being run, and 27's is that one nobody has watched fail is one you will
  // argue with.
  //
  // Registering them found something better than the debt: THREE OF THE FIVE
  // WERE ALREADY CHECKED HERE, and better — mirror-walk walks the user's own
  // test over all five rooms, frontage-honours covers every declared door
  // rather than the diner's, and check-seethrough repaints the ground magenta
  // and looks for it through each facade. Those three of mine are deleted, and
  // their cases with them. See the note in scripts/checks.mjs.
  //
  // A mutation kept for a deleted check is worse than no mutation: it goes
  // green forever, against a script that is not there.


  // THE GLASS BLOCK, restored to the value that made it the brightest surface
  // in the world. Watched red by hand when the check was written (51 brighter
  // than the sky); here so it stays watched.
  ['diner-block-glare', TEXW,
    "const BLOCK = '#6f7b76';",
    "const BLOCK = '#b9c4c2';   // the lightbox the user was looking at",
    'A-diner-block-vs-sky.mjs', [], 'a glass block brighter than the sky'],

  // THE JOINERY DECLARATION, reverted to the accident it replaced: hand the
  // relief the ROSTER colour for every shop, as ct/street.ts does, and the
  // diner is back to a mustard-brown cornice and cill wrapped round a
  // stainless front — the fault the whole facade stretch started from, at a
  // 170 degree hue gap. Nothing guarded that repair until this case existed,
  // and the next character painter added to tex-world.ts would have
  // re-introduced it silently.
  ['joinery-roster', TEXW,
    "return characterOf(name) === 'diner' ? DINER_STEEL : rosterTrim;",
    'return rosterTrim;   // the accident: the roster colour for everyone',
    'A-joinery-matches-fascia.mjs', [], 'mouldings a different material from the fascia they frame'],

  // THE CANOPY SEAL, removed — the enclosed pockets come straight back. This is
  // the one whose mutation matters most, because the rim-constrained notches
  // LOOK sufficient and are not: 303 enclosed texels across 11 crowns survived
  // aiming alone, and only the flood-fill closes them.
  ['tree-holes', TEXW,
    'if (d[i * 4 + 3] !== 0 || out[i]) continue;',
    'if (true) continue;   // stop sealing enclosed pockets',
    'A-tree-canopy-opaque.mjs', [], 'holes punched clean through a tree crown'],

  // ── SEAT FACING: two cases, because the check has two rules and they fail
  // apart. `scripts/seat-facing.mjs` is the first guard on the FACING CLASS
  // rather than on one instance of it — five backwards-yaw bugs have shipped
  // here one at a time, and it went red on 105 seats the day it was written.
  //
  // Both mutations are in SOURCE and both restore a bug that actually shipped.
  // There is no runtime alternative: the only handle a harness has on
  // `__ct.seats()` would break the check's VIEW while leaving the world intact,
  // which GOTCHAS 34 says proves nothing. (w19)
  //
  // RULE B — turned away from your own furniture. The 96 casino slot stools,
  // mirrored back to the historical bug verbatim: the bank of machines sits at
  // `bz` and each stool at `bz + face * 1.02`, so the cabinets are always in the
  // −face direction; writing the ternary the other way round sat every player
  // with their back 0.37 m from the machine they had just pressed [E] to play.
  //
  // This is the clause a wall test structurally CANNOT reach — the casino floor
  // is 11 m across, so a backwards stool is looking at open floor and every
  // nose-to-the-wall predicate in this repo passes it. Chosen for that reason
  // rather than because it is the biggest number.
  ['seat-facing', CASINO,
    'x: room.wx(sx2), z: room.wz(sz2), yaw: face > 0 ? 0 : Math.PI, h: STOOL_TOP,',
    'x: room.wx(sx2), z: room.wz(sz2), yaw: face > 0 ? Math.PI : 0, h: STOOL_TOP,   // the mirrored ternary that shipped',
    'seat-facing.mjs', [], '96 slot stools with their backs to the machines'],

  // RULE A — nose to the wall. The tax office waiting row, turned round into the
  // plaster it is bolted to. The seat sits at `WAIT_Z + 0.04` = `hd − 0.58`, so
  // `yaw: Math.PI` leaves 0.58 m of nothing and then the room's own front wall —
  // inside the check's 1.20 m WALL_MIN with margin to spare.
  //
  // NOT the same defect the user reported in this room, deliberately. His
  // *"seats in the tax office are reversed"* turned out to be the BACKREST MESH
  // on the wrong side of a correct `yaw: 0` (int-tax.ts:450-456 records the
  // measurement), and an AABB check cannot see a backrest. This mutates the yaw
  // that was wrongly blamed, because that is the thing seat-facing is able to
  // decide — a case must break what the check claims to catch, not what the
  // ticket said. (w19)
  ['seat-facing-wall', TAX,
    'x: room.wx(cx), z: room.wz(WAIT_Z + 0.04), yaw: 0, h: 0.47,',
    'x: room.wx(cx), z: room.wz(WAIT_Z + 0.04), yaw: Math.PI, h: 0.47,   // selftest: the row turned into the wall',
    'seat-facing.mjs', [], 'the waiting row facing plaster 0.58 m away'],

];

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const dirty = () => sh('git status --porcelain src/').trim();

// CRASH RECOVERY, not signal handling. The first version trusted process
// handlers, and a 2-minute harness timeout SIGTERMed a run mid-mutation and
// left the park lantern stamp deleted in my tree. Signals cannot save this:
// the process spends most of its life blocked inside a synchronous
// `npm run build`, where the event loop cannot turn and no JS handler runs —
// and SIGKILL would not run one anyway.
//
// So the mutation is recorded on DISK before it is applied, and any run that
// finds a stale record undoes it first. Survives SIGTERM, SIGKILL and a power
// cut, and only ever reverts the one file it wrote down.
const STATE = '.canfail-state.json';   // { pid, file, backup }

// ONE AT A TIME. Two of these ran concurrently once — a background full run and
// a foreground subset — and they shared a single backup file. One process wrote
// the OTHER file's original bytes over props.ts, which came out of it holding
// tex-ground.ts and 1481 lines shorter. Nothing reached a commit, but the
// working tree was destroyed and only `tsc` caught it.
//
// The backup is per-file now, and the state file carries the owning PID so a
// second run refuses instead of interleaving. Both were needed: per-file names
// alone would still have let two runs fight over the same file.
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

if (existsSync(STATE)) {
  let st = null;
  try { st = JSON.parse(readFileSync(STATE, 'utf8')); } catch {}
  if (st && st.pid && st.pid !== process.pid && alive(st.pid)) {
    console.error(`REFUSING: canfail is already running as pid ${st.pid}.\n` +
                  `Two runs share the source tree and will overwrite each other.`);
    process.exit(2);
  }
  // Crash recovery. Not signal handling: a 2-minute timeout SIGTERMed a run
  // mid-mutation and node died inside a synchronous `npm run build`, where the
  // event loop cannot turn and no JS handler runs — SIGKILL would not run one
  // either. So the original bytes go to disk BEFORE the edit, and the next run
  // puts them back. Survives SIGTERM, SIGKILL and a power cut.
  if (st && st.file && st.backup && existsSync(st.backup)) {
    writeFileSync(st.file, readFileSync(st.backup));
    console.log(`recovered ${st.file} from a run that died as pid ${st.pid}`);
    rmSync(st.backup, { force: true });
    try { sh('npm run build'); } catch {}
  }
  rmSync(STATE, { force: true });
}

let touched = null, backupPath = null;
const restore = () => {
  if (touched && backupPath && existsSync(backupPath)) writeFileSync(touched, readFileSync(backupPath));
  if (backupPath) rmSync(backupPath, { force: true });
  touched = null; backupPath = null;
  rmSync(STATE, { force: true });
};
process.on('exit', restore);
// SIGTERM as well as SIGINT, and this is not defensive padding — a 2-minute
// harness timeout SIGTERMed a full run mid-mutation and node exited WITHOUT
// firing the 'exit' handler, leaving the park lantern stamp deleted in my
// working tree. The next run refused to start because of it, which is the
// only reason it was noticed rather than committed.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { restore(); process.exit(130); });
}


// ── IS "SLEPT" EVEN PROVABLE? ────────────────────────────────────────────────
//
// A SLEPT verdict says "the mutation was applied and the check passed anyway".
// This file never verified the first half. It mutates source, runs `npm run
// build`, and then measures whatever SHOT_URL happens to serve — and if that
// server is not serving THIS build, the world under test never had the
// mutation and every case reports SLEPT. The header above already records one
// author losing a round to that (0/3 SLEPT against 4177, 3/3 against their own
// port), and it happened again: five guards were reported as having stopped
// guarding, and all five plus crowd-lane CAUGHT when re-run aimed correctly.
//
// A false RED is the expensive direction. It sends someone to rewrite a check
// that works, and the rewrite is how a guard that DID work stops working.
//
// So the two halves of the honest question are mechanised rather than left to
// the reader, because they want opposite fixes:
//
//   served bundle != our bundle   the world measured is not the world we built.
//                                 NOTHING WAS MEASURED. Never a SLEPT.
//   our bundle unchanged by the   the mutation compiled to identical bytes, so
//   mutation                      it cannot produce a defect. The CASE is
//                                 wrong and wants retargeting, not the check.
//
// Vite content-hashes the entry bundle, so "did the build change" is a string
// compare and costs nothing. A DEV server serves source rather than a hashed
// asset; there the mutation reaches the world through HMR by construction, and
// this says so rather than pretending to have proved it.
// The query string matters: a dev server serves `/src/main.ts?t=1785047070979`,
// and a pattern anchoring the extension to the closing quote misses it and
// returns null. My first version did, and since "no entry" was fatal it would
// have exited 3 against EVERY dev server — canfail broken outright by the fix
// meant to make it trustworthy. Caught by running it against 4177 and 4188
// before believing it, which is the whole lesson of this note.
const entryOf = (html) =>
  (html.match(/src="([^"?]+\.(?:js|ts|tsx))(?:\?[^"]*)?"/) ?? [])[1] ?? null;
const localEntry = () => {
  try { return entryOf(readFileSync('dist/index.html', 'utf8')); } catch { return null; }
};
// UNREACHABLE and UNRECOGNISED are different answers. Nothing serving is exit 3
// — the check never ran. A page we cannot parse is merely unproven, and must
// not take the suite down with it.
// WHY it could not be read, not just that it could not. A bare null here spends
// a case's whole cost and then says `served null`, which is indistinguishable
// from a dead server, a stale build and a page that will not parse — and
// `wetness` has been reporting exactly that on every multi-case run while
// scoring CAUGHT on its own. A reason costs one property.
// RETRIED ONCE, and the reason is the whole finding.
//
// undici pools keep-alive sockets per origin. The startup probe opens one;
// `vite preview` then closes it while minutes go by rebuilding and running a
// browser, and the next fetch reuses the dead socket and throws
// UND_ERR_SOCKET before it ever reaches the server.
//
// That fires on the FIRST case that does not go red — because a red case never
// gets here — so it lands precisely on a SLEEPING GUARD and scores it NOT-RUN.
// Measured: `wetness` was NOT-RUN on both full runs and on a four-case run, and
// CAUGHT on three single-case runs, which is exactly this shape. The harness was
// quietly converting its most important finding into "could not be scored".
//
// A fresh connection is the fix; a second attempt gets one, because the dead
// socket is evicted on failure. Not a retry of the MEASUREMENT — the check is
// never re-run (see the note about wetness in the loop) — only of reading the
// page, which is idempotent.
const servedEntry = async () => {
  let why = null;
  for (const attempt of [0, 1]) {
    try {
      const r = await fetch(URL, { cache: 'no-store', headers: { connection: 'close' } });
      const html = await r.text();
      const entry = entryOf(html);
      return { up: true, entry,
        why: entry ? null : `HTTP ${r.status}, ${html.length} bytes, no module <script src>` };
    } catch (e) {
      why = `${String(e.cause?.code ?? e.message)}${attempt ? ' (twice)' : ''}`;
      if (!attempt) await new Promise((r) => setTimeout(r, 250));
    }
  }
  return { up: false, entry: null, why };
};
const HASHED = (e) => !!e && /\/assets\/.*-[\w-]{6,}\.js$/.test(e);
// THE DEV-SERVER PROOF, and it is the one that matters here: both ports on this
// machine serve `/src/main.ts`, so the bundle comparison above would be skipped
// exactly where the problem was reported. A Vite dev server will hand back the
// transformed module for any source path, so "did my edit reach the world" is a
// hash compare on the file the case actually mutates — generic, one GET, and no
// per-case witness string to keep in step with somebody's source.
const servedModule = async (file) => {
  try {
    const r = await fetch(`${URL.replace(/\/$/, '')}/${file}`, { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  } catch { return null; }
};
const digest = (t) => (t === null ? null : createHash('sha1').update(t).digest('hex').slice(0, 12));

const only = process.argv.slice(2).filter((a) => a !== PORT_ARG);
const run = CASES.filter((c) => !only.length || only.includes(c[0]));
const results = [];
// EVERY CASE WHOSE FILE WE ACTUALLY WROTE TO. The restore check at the foot of
// this file is about putting back what we took; a case that never matched was
// never taken, and conflating the two produced a false alarm — see there.
const applied = [];

// the bundle with NOTHING mutated, to tell an inert mutation from a real one
sh('npm run build');
const PRISTINE = localEntry();
const S0 = await servedEntry();
if (!S0.up) {
  console.error(`\n  NOTHING IS SERVING ${URL} — nothing can be measured.`);
  process.exit(3);                                            // GOTCHAS 32
}
const SERVED0 = S0.entry;
// Anything that is not a content-hashed bundle is treated as unproven, and the
// bundle comparison is simply not run. That covers a dev server, where the
// mutation reaches the world through HMR by construction.
const DEV = !HASHED(SERVED0);
if (DEV) {
  console.log(`  ${URL} serves ${SERVED0 ?? 'an unrecognised page'} — not a hashed bundle,`);
  console.log(`  so a mutation reaches it via HMR and the built-vs-served proof is skipped.`);
} else if (SERVED0 !== PRISTINE) {
  console.error(`\n  MEASURING THE WRONG WORLD — nothing was measured, and no case is scored.`);
  console.error(`    ${URL} serves ${SERVED0}`);
  console.error(`    this tree built  ${PRISTINE}`);
  console.error(`  Every case would report SLEPT, and every one would be a false red.`);
  console.error(`  Fix: point SHOT_URL at a server for THIS tree.\n`);
  process.exit(3);
}

// what each mutated file looks like SERVED, before anything is touched
const PRIS = {};
for (const f of [...new Set(run.map((c) => c[1]))]) PRIS[f] = digest(await servedModule(f));

// …and what each one looks like ON DISK, which is the only honest way to
// answer "did I give it back". The end-of-run assertion used to re-read every
// case's NEEDLE instead, so a needle that had gone stale — which is a fault in
// this file, not in the tree — reported `RESTORE FAILED` and exited 3 about a
// tree that was byte-perfect. Measured on the first end-to-end run: `rain`'s
// needle had rotted from 500 to 2600, and canfail told me it had corrupted
// props.ts. That is the worst thing a source-editing tool can say when it is
// not true; the natural response is `git checkout --`, which is exactly how
// uncommitted work gets destroyed. The two questions are now separate.
const ORIGINAL = {};
for (const f of [...new Set(run.map((c) => c[1]))]) ORIGINAL[f] = digest(readFileSync(f, 'utf8'));

for (const [name, file, needle, repl, script, args, expect] of run) {
  const src = readFileSync(file, 'utf8');
  const n = src.split(needle).length - 1;
  if (n !== 1) { results.push([name, 'NEEDLE', `matched ${n}x, not 1 — mutation not applied`]); continue; }
  applied.push([name, file, needle]);   // we are about to WRITE this file — see the restore check
  try {
    backupPath = `.canfail-backup-${file.split('/').pop()}`;   // per FILE, never shared
    writeFileSync(backupPath, src);   // the exact bytes back, whatever state they were in
    writeFileSync(STATE, JSON.stringify({ pid: process.pid, file, backup: backupPath }));
    touched = file;
    writeFileSync(file, src.replace(needle, repl));
    try { sh('npm run build'); }
    catch { results.push([name, 'BUILD', 'mutation did not compile — rewrite it']); restore(); continue; }
    // DID IT REACH THE WORLD? Checked BEFORE spending a browser on it, because
    // a case that cannot be scored should not cost a minute to not score.
    if (DEV && PRIS[file] !== null) {
      const now = digest(await servedModule(file));
      if (now !== null && now === PRIS[file]) {
        results.push([name, 'NOT-RUN',
          `${expect} — ${URL} still serves the UNMUTATED ${file}; nothing was measured`]);
        restore(); continue;
      }
    }
    let red = false, out = '';
    try { out = sh(`SHOT_URL=${URL} node scripts/${script} ${args.join(' ')}`); }
    catch (e) { red = true; out = String(e.stdout || '') + String(e.stderr || ''); }
    if (!red && /^FAIL/m.test(out)) red = true;
    // Only a mutation that CHANGED THE WORLD can be slept through. Without
    // this, "the server is not ours" and "the mutation does nothing" both wore
    // the SLEPT badge, and neither is a fault in the check.
    if (!red && !DEV) {
      const mine = localEntry(), s = await servedEntry(), theirs = s.entry;
      if (mine === PRISTINE) {
        results.push([name, 'INERT', `${expect} — mutation compiles to identical bytes; retarget the CASE`]);
        continue;
      }
      if (theirs !== mine) {
        results.push([name, 'NOT-RUN',
          `${expect} — ${URL} served ${theirs ?? `nothing readable (${s.why})`}, we built ${mine}`]);
        continue;
      }
    }
    // FLAKY IS REAL AND THIS FILE CANNOT YET TELL YOU WHICH. `wetness` measured
    // CAUGHT, CAUGHT, SLEPT, SLEPT, CAUGHT across five identical invocations —
    // so a 43-case suite reports it asleep roughly half the time, and several
    // flaky guards land together as a cluster of SLEPTs that reads exactly like
    // sudden rot in one module. That is the likeliest reading of a
    // five-at-once report.
    //
    // I BUILT A RETRY HERE AND TOOK IT OUT AGAIN. Re-running the check against
    // the same mutated world does not stabilise it: when wetness sleeps it
    // sleeps on the retry too, so the non-determinism is at the level of the
    // built world or the run, not the invocation. Shipping the retry would have
    // put a mechanism in the one tool whose whole job is trustworthiness
    // without evidence that it detects anything — the exact fault this file
    // exists to catch. Whoever removes wetness's non-determinism should own
    // that, and it is B's: the case mutates ct/props.ts.
    results.push([name, red ? 'CAUGHT' : 'SLEPT', expect]);
  } finally { restore(); }
}

sh('npm run build');   // leave the tree serving the real world again

console.log(`\ncan my checks fail?   (mutation must go red)\n`);
for (const [name, verdict, note] of results) {
  const mark = verdict === 'CAUGHT' ? 'OK  ' : verdict === 'SLEPT' ? 'FAIL' : '????';
  console.log(`  ${mark} ${name.padEnd(11)} ${verdict.padEnd(7)} ${note}`);
}
const bad = results.filter((r) => r[1] !== 'CAUGHT');
// NEEDLE JOINS THIS LIST, and it belongs here for the same reason the other two
// do: the case was not scored, and that is not the same news as a guard asleep.
//
// It is here now because of what the restore check above used to do by accident.
// The `density` case's own comment records it — *"canfail said so plainly
// (RESTORE FAILED ... does not hold its original text), which is the only reason
// it surfaced"* — so for five stale needles running, the way anyone found out
// was a message about a corrupted source tree, which was not true and did not
// name the case. Repairing that (see the restore check) removes an accidental
// reporter, so the honest one has to get louder rather than quieter: a stale
// needle is now called out by name, in its own block, with the count.
//
// `bad` still contains it, so the exit code is unchanged and non-zero. This adds
// a sentence; it does not forgive anything.
const unprovable = results.filter((r) => ['INERT', 'NOT-RUN', 'NEEDLE'].includes(r[1]));
if (unprovable.length) {
  console.log(`\n${unprovable.length} case(s) could not be scored — NOT sleeping guards:`);
  for (const [n, v, why] of unprovable) console.log(`  ${v.padEnd(8)} ${n} — ${why}`);
}
console.log(`\n${results.length - bad.length}/${results.length} checks caught their mutation`);
// Not "is the tree clean" — it may legitimately be dirty and that is the point
// now. The question is whether the file came back byte-for-byte as it was.
//
// ONLY THE CASES WE ACTUALLY WROTE, and that is a bug fix, not a relaxation.
//
// This used to ask a different question: for every case in `CASES` sharing a
// FILE with anything in this run, is that case's needle present? A stale needle
// answers no — not because a restore failed, but because the text was never
// there. Measured on this tree, with `rain` quoting a `RAIN_N` that `2bb64f49f`
// had changed:
//
//     node scripts/canfail.mjs footprint
//     OK   footprint   CAUGHT  litter allowed to straddle the kerb
//     1/1 checks caught their mutation
//     RESTORE FAILED — src/proto/ct/props.ts does not hold its original text.
//
// Nothing was wrong. `footprint` ran, caught its mutation and restored cleanly,
// and the tree was untouched — `git status` clean. But ONE stale needle in
// props.ts made every run touching props.ts (footprint, trash, glow, wetness,
// bus, rain, rain-memory, crowd-lane…) announce a corrupted source tree and
// exit 3, which by the house convention (GOTCHAS §32) means "aborted, nothing
// measured" — so `checks.mjs --selftest` scored eight healthy guards as failed.
//
// That is the expensive direction of this file's own warning: a false RED sends
// somebody to fix a check that works, and "your source tree did not come back"
// sends them somewhere much worse than that. A stale needle already has an
// honest verdict of its own (`NEEDLE`, scored not-CAUGHT, non-zero exit); it
// does not also need to masquerade as data loss.
//
// So the population is `applied` — the cases we opened the file for. If we did
// not write it, we cannot have failed to put it back.
//
// AND THE TEST IS THE BYTES, not the needle (w22, merging the same fix arrived
// at independently). Restricting the population to `applied` removes the false
// alarm, which was the expensive half; but "the needle is present again" is
// still a weaker claim than "the file is as I found it". A restore that wrote
// back a DIFFERENT file containing the same needle passes a needle test and
// fails this one, and this one is the question the header promises to answer —
// "it restores from a BYTE COPY … so uncommitted work survives a run untouched".
// `ORIGINAL` holds a digest of each file taken before anything was written;
// `applied` still names which case last held the pen, because "which one" is
// the first thing you want to know.
const stillWrong = Object.keys(ORIGINAL)
  .filter((f) => digest(readFileSync(f, 'utf8')) !== ORIGINAL[f]);
if (stillWrong.length) {
  const f = stillWrong[0];
  const by = applied.filter(([, file]) => file === f).pop();
  console.error(`\nRESTORE FAILED — ${f} does not hold its original bytes.`);
  console.error(`  ${by ? `Last written by case '${by[0]}'. ` : ''}`
    + `Its backup is .canfail-backup-${f.split('/').pop()}.`);
  process.exit(3);
}
console.log('every mutated file restored byte-for-byte');
// …and for a stale needle, THE TEXT THAT NO LONGER MATCHES. The block above
// says which cases could not be scored; this says what to do about it, which is
// the part that costs time otherwise — re-aiming means diffing a quotation
// against somebody else's source, and the quotation is right here.
const stale = results.filter((r) => r[1] === 'NEEDLE');
if (stale.length) {
  console.error(`\nthe stale quotations, verbatim — these guards are UNPROVEN, not passing:`);
  for (const [n] of stale) {
    const c = CASES.find((x) => x[0] === n);
    console.error(`  ${n} — ${c[1]} no longer contains: ${JSON.stringify(c[2])}`);
  }
}

// A STAMP, so a sleeping guard is discoverable without running this again.
// The whole reason five guards could be reported as asleep is that nothing on
// the routine path knows when this last ran or what it said: checks.mjs does
// not run canfail and land.sh does not gate on it, so every dashboard stays
// green while a guard guards nothing. `land.sh` reads this file and says so.
// Only written for a FULL run — a three-case run says nothing about the suite.
if (!only.length) {
  writeFileSync('.canfail-last.json', JSON.stringify({
    when: new Date().toISOString(),
    build: (() => { try { return execSync('git rev-parse --short=9 HEAD').toString().trim(); }
                    catch { return null; } })(),
    url: URL,
    caught: results.length - bad.length,
    total: results.length,
    asleep: results.filter((r) => r[1] === 'SLEPT').map((r) => r[0]),
    unprovable: unprovable.map((r) => `${r[0]}:${r[1]}`),
  }, null, 2) + '\n');
}
process.exit(bad.length ? 1 : 0);
