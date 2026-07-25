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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const PROPS = 'src/proto/ct/props.ts';
const GROUND = 'src/proto/ct/tex-ground.ts';
const TEXW = 'src/proto/ct/tex-world.ts';   // A's
const CARS = 'src/proto/ct/cars.ts';        // H's
const TOWN = 'src/proto/crosstown.ts';      // desk's, but the parking draw lives in it
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

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
  ['density', TEXW,
    't.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H };',
    't.userData.masonry = { ppm, mult, wMeters: wMeters * 1.4, hMeters, baseY, W, H };',
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

  ['wetness', PROPS,
    'const PUDDLE_C = 0.444;',
    'const PUDDLE_C = 1.6;',
    'wetness.mjs', ['probe'], 'puddles LIGHTER than the road they sit in'],

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
  // The third blinding case. Leaves every puddle in the street and retextures
  // the sheet so wetness.mjs's predicate stops recognising it — population
  // 11 -> 2. Worth having even though the check went red before the floor
  // existed: it went red on `stillFilling`, because the two survivors happened
  // to saturate, which is the right outcome for the wrong reason.
  ['wet-blind', PROPS,
    'const puddleT = declareSurface(pixTex(48, 32, (g) => {',
    'const puddleT = declareSurface(pixTex(48, 34, (g) => {',
    'wetness.mjs', ['probe'], 'the puddles still there but invisible to the check that measures them'],

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

  ['rain', PROPS,
    'const RAIN_N = 500;',
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
  ['footprint-blind', PROPS,
    'const pitGeo = new THREE.PlaneGeometry(PIT_W, 1.0);',
    'const pitGeo = new THREE.PlaneGeometry(PIT_W, 1.04);',
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
  ['footprint-water', PROPS,
    'const PAN_X = ROAD_HALF - 0.22;           // centred in the pan',
    'const PAN_X = ROAD_HALF - 1.60;           // selftest: out in the lane',
    'footprint.mjs', [], 'the pools scattered out into the travel lane'],

  ['footprint-pits', PROPS,
    'const PIT_X = 5.56;',
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

const only = process.argv.slice(2);
const run = CASES.filter((c) => !only.length || only.includes(c[0]));
const results = [];

for (const [name, file, needle, repl, script, args, expect] of run) {
  const src = readFileSync(file, 'utf8');
  const n = src.split(needle).length - 1;
  if (n !== 1) { results.push([name, 'NEEDLE', `matched ${n}x, not 1 — mutation not applied`]); continue; }
  try {
    backupPath = `.canfail-backup-${file.split('/').pop()}`;   // per FILE, never shared
    writeFileSync(backupPath, src);   // the exact bytes back, whatever state they were in
    writeFileSync(STATE, JSON.stringify({ pid: process.pid, file, backup: backupPath }));
    touched = file;
    writeFileSync(file, src.replace(needle, repl));
    try { sh('npm run build'); }
    catch { results.push([name, 'BUILD', 'mutation did not compile — rewrite it']); restore(); continue; }
    let red = false, out = '';
    try { out = sh(`SHOT_URL=${URL} node scripts/${script} ${args.join(' ')}`); }
    catch (e) { red = true; out = String(e.stdout || '') + String(e.stderr || ''); }
    if (!red && /^FAIL/m.test(out)) red = true;
    results.push([name, red ? 'CAUGHT' : 'SLEPT', expect]);
  } finally { restore(); }
}

sh('npm run build');   // leave the tree serving the real world again

console.log(`\ncan my checks fail?   (mutation must go red)\n`);
for (const [name, verdict, note] of results) {
  const mark = verdict === 'CAUGHT' ? 'OK  ' : 'FAIL';
  console.log(`  ${mark} ${name.padEnd(11)} ${verdict.padEnd(7)} ${note}`);
}
const bad = results.filter((r) => r[1] !== 'CAUGHT');
console.log(`\n${results.length - bad.length}/${results.length} checks caught their mutation`);
// Not "is the tree clean" — it may legitimately be dirty and that is the point
// now. The question is whether the file came back byte-for-byte as it was.
const stillWrong = CASES.filter(([, file, needle]) =>
  run.some((r) => r[1] === file) && !readFileSync(file, 'utf8').includes(needle));
if (stillWrong.length) {
  console.error(`\nRESTORE FAILED — ${stillWrong[0][1]} does not hold its original text.`);
  process.exit(3);
}
console.log('every mutated file restored byte-for-byte');
process.exit(bad.length ? 1 : 0);
