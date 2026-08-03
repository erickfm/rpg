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
const FP = 'src/proto/fp.ts';                 // the player rig — eye height, reach
const TAX = 'src/proto/ct/int-tax.ts';        // the waiting row the user reported
const ATM = 'src/proto/ct/atm.ts';            // the cash machine's screens and keys
// The fascia METRICS, hoisted out of ct/bank.ts so ct/atm.ts can hit-test the
// keys ct/bank.ts draws without closing an import cycle (see the file's own
// header). `rulings-atm` used to quote bank.ts and moved here with them.
const ATMFACE = 'src/proto/ct/atm-face.ts';
const JAIL = 'src/proto/ct/jail.ts';          // O's — the building and its screens
const HUD = 'src/proto/ct/hud.ts';            // the panel framework and its diegetic surfaces
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

  // BLIND THE CHECK, NOT THE WORLD — the third of its kind here, after
  // footprint-blind and glow-blind, and the one that was owed. Item 107 found
  // `masonry.mjs` printing `FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0` and
  // exiting 0 while examining ZERO faces: it skipped `visible === false` meshes,
  // and 5016d26b5's region cull hides every group west of REGION_X plus every
  // unentered interior, which at the default spawn is all 305 stamps in the
  // world. The filter is gone and a population floor stands where it was; this
  // is what proves that floor can still go red.
  //
  // The mutation renames the STAMP rather than touching the geometry, which is
  // the honest form of blinding: every wall is still standing, still painted at
  // exactly the density it was painted at, and the guard simply cannot see one
  // of them. Nothing in src reads the property back — `ct/paint.ts:17` names it
  // in a comment and `tex-world.ts` is the only writer — so the world the player
  // walks is byte-identical in behaviour and only the audit goes dark.
  //
  // WHY NOT MUTATE scripts/masonry.mjs AND PUT THE `visible` SKIP BACK. That is
  // the literal regression, and this file is for breaking the WORLD; a case that
  // edits the checker proves the checker notices being edited. Blinding the
  // population is the class both share, and it is the one that catches a fresh
  // way of going blind that nobody has thought of yet.
  //
  // masonry.mjs is registered with `true` (its own --selftest doubles one face's
  // repeat), so this rides the sixth column of scripts/checks.mjs. The two
  // mutations fail apart, which is the whole reason both are registered: with
  // zero stamps there is no face to double, so the flag reports SELFTEST FAILED
  // for a reason that names none of this.
  ['masonry-blind', TEXW,
    't.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H,',
    't.userData.masonryHiddenBySelftest = { ppm, mult, wMeters, hMeters, baseY, W, H,',
    'masonry.mjs', [], 'every wall still painted the same, and no stamp the density guard can see'],

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
  //
  // NEEDLE RE-QUOTED AND RE-FILED, not redesigned — item 229. It quoted
  // `ct/bank.ts`'s `const M_KEYS_BOT = KERB_H + 1.04, M_BOT = KERB_H + 0.75;`
  // and matched 0x from the ATM fascia dispatch rewrite onward. Nothing about
  // the machine changed: `ct/atm-face.ts` was added as a third module importing
  // neither `ct/bank.ts` nor `ct/atm.ts`, and the eight fascia numbers moved
  // into its `ATM_FACE` declaration so both halves read ONE authoring instead
  // of two. `ct/bank.ts:250` now says `KERB_H + ATM_FACE.bot` — the ruling is
  // still there, it is simply no longer a literal in that file.
  //
  // So the case follows the NUMBER, which is what it was always about. `bot`
  // is one of the two rulings `ct/atm-face.ts` names as such in its own comment,
  // and 0.90 is the pre-ruling value `ct/bank.ts:230` records the user moving
  // it off ("M_BOT 0.90 -> 0.68 -> 0.75", asked for twice).
  ['rulings-atm', ATMFACE,
    '  top: 1.58, screenBot: 1.16, keysBot: 1.04, bot: 0.75,',
    '  top: 1.58, screenBot: 1.16, keysBot: 1.04, bot: 0.90,  // selftest: pre-ruling',
    'D-rulings-hold.mjs', [], 'the fascia bottom back where the ruling moved it from'],

  // ── item 184: the ATM's PIN screen ────────────────────────────────────────
  //
  // THE ORIGINAL BUG, RESTORED IN SOURCE, and it is the user's own words:
  // *"trying to hit cancel on the pin keypad doesnt work cause its also 5?"*
  //
  // `clickAt` used to encode a fascia soft-key press as the STRING OF ITS
  // NUMBER, so a click on CANCEL called `onKey('5')` — and `onKey`'s PIN branch
  // eats digits before it ever reaches the soft-key dispatch. The button was
  // offered with a hand cursor and typed a 5 into the PIN instead of cancelling.
  //
  // This is the mutation to use rather than deleting the CANCEL row, because it
  // reproduces the SYMPTOM the user reported (the screen stays, the digit count
  // goes UP) rather than merely removing the control — and `w67-atm-pin.mjs`
  // asserts on both halves of exactly that. Watched: the walk goes red on
  // `CLICKING CANCEL LEAVES THE PIN SCREEN (screen=pin)` and on
  // `CANCEL did not type a 5 on the way out (pin=3)`.
  ['atm-cancel-shadowed', ATM,
    '  onKey(softKey(b.i, b.right));',
    '  onKey(String(b.right ? b.i + 5 : b.i + 1));   // selftest: digits shadow CANCEL again',
    'w67-atm-pin.mjs', [], 'clicking CANCEL typing a 5 into the PIN again'],

  // ── item 175: the walkable hole in the jail's forecourt flanks ────────────
  //
  // Re-opens the user's bug: *"side of the jail are still bugged and allow for
  // out of bounds."*
  //
  // IT REMOVES THE COLLIDER AND LEAVES THE WALL STANDING, which is the point.
  // Deleting the geometry would make the containment sweep red for a reason
  // anybody would see in a screenshot; removing only the obstacle reproduces
  // the ACTUAL fault — a wall you can see and walk through — and that is the
  // class of bug two green route-walking checks sat over twice. A mutation has
  // to break the symptom, not the diagnosis.
  ['jail-forecourt-open', JAIL,
    '    ctx.obstacle({ minX: site.minX, maxX: FX, minZ: zLine - SCR_T / 2, maxZ: zLine + SCR_T / 2 });',
    '    void FX;   // selftest: the forecourt flanks stop colliding, hole reopened',
    // RETARGETED at the CLASS version (item 215). `w67-jail-contained.mjs` was
    // the jail-only sweep; `w75-site-contained.mjs` is the same fill taking a
    // site name, and it is handed `jail` here so this case still scores the
    // building it was written against and nothing else.
    'w75-site-contained.mjs', ['jail'], 'walking out of the world past the jail forecourt again'],

  // ── item 72: fast-tier checks that had NO declared failing path ────────────
  //
  // Each of these ran on every suite and had never once been watched go red.
  // A dead port already makes all of them exit non-zero, so the "cannot measure"
  // path was covered — what was untested is the path that matters: the world is
  // MEASURED and it is WRONG. That is what these cases exercise.

  // A-eye-height-holds. THE MUTATION HAS TO BREAK THE SYMPTOM, NOT THE
  // DIAGNOSIS, and my first attempt got that wrong in a way worth recording: I
  // raised the player's own eye in `fp.ts` (1.62 -> 2.90), which moves the error
  // column this script PRINTS but not the thing it ASSERTS on. The script says so
  // in as many words — "the assertion is the symptom, not the arithmetic above",
  // because failing on the eye gap would leave it red forever once the gate was
  // fixed. So it stayed green, correctly, and canfail reported SLEPT. A check
  // that does not move under the wrong mutation is not a sleeping check, and
  // filing it as one is how this repo has twice reported working guards as dead.
  //
  // The real mutation is the ORIGINAL BUG: the gate built its ray from a bare
  // 1.6 instead of the floor the player is standing on, so in 301 (gy 5.4) the
  // ray started 5.4 m below the floor, was stopped by the slab, and every [E]
  // in the room went unselectable.
  ['eye-gate-flat', TOWN,
    '      const eye = new THREE.Vector3(px, apt.gy() + 1.6, pz);',
    '      const eye = new THREE.Vector3(px, 1.6, pz);   // selftest: the pre-fix flat eye',
    'A-eye-height-holds.mjs', [], 'every [E] in the spawn room unselectable again'],

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
  // THE CASE WAS ALWAYS SOUND — it changes bytes, and it changes the world by
  // 200x. It was the guard that could not see it under load. See the note by
  // the SLEPT verdict at the bottom of this file.
  ['wetness', PROPS,
    'const dryFor = 48 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'const dryFor = 0.24 * (1 + soak * 1.5) * (1 + nightNow * 1.1);',
    'wetness.mjs', ['probe'], 'the street bone dry on the last drop of rain'],

  ['glow', PROPS,
    'halo.position.set(headX, sidewalkY + LAMP_H - 0.31, headZ);',
    'halo.position.set(headX + 1.4, sidewalkY + LAMP_H - 0.31, headZ);',
    'glow.mjs', ['probe'], 'the glow floating 1.4 m off its lamp head'],

  // `wet-blind` STOOD HERE AND IS GONE, not retargeted. It retextured the
  // puddle sheet so wetness.mjs's predicate stopped recognising it — a
  // blinding case against the pool population floor. Both the sheet and the
  // floor were removed with standing water, so there is no population left to
  // blind: the surviving verdicts read surface COLOUR over time, which cannot
  // silently find nothing. Recorded rather than deleted quietly, because a
  // case disappearing from this list is exactly what it would look like if
  // someone had simply given up on it.

  // ── item 229: BOTH grade cases had to MOVE BRANCHES, and the reason is a
  //    finding, not a rename ────────────────────────────────────────────────
  //
  // Both quoted the CPU pool branch and both matched 0x. `544053b20`
  // ("lamplight per fragment, so a surface is lit because of where it is")
  // moved the warm term AND the gain into `POOL_FRAG`, and the CPU pass now
  // owes a pooled material only its ambient — `ct/props.ts:1494` is the whole
  // of it: `e.m.color.setRGB(e.base.r * amb, e.base.g * amb, e.base.b * amb)`.
  //
  // THAT IS NOT A MOVED LINE, IT IS A MOVED LANGUAGE. `grade-sane.mjs` reads
  // `m.color` out of JS; a fragment shader is invisible to it. So the warm
  // overshoot it was written to catch cannot occur on the surface it reads any
  // more, and its own header is now out of date by the same event — it records
  // "20 of 5536 through the night, 156-166 at the four ramp hours, worst
  // 1.1497 at 23:00", and measured on cd5afdd8f the world gives:
  //
  //     swept 24 hours, 10962 materials each — 0 impossible values
  //     deliberately over 1.0: 0 material-hours, peak 0.0000 — none
  //
  // Zero, not twenty. **The ceiling clause is now green over a population in
  // which nothing can approach the ceiling** — a vacuous pass in a check whose
  // header is an argument against vacuous passes. Filed for the desk rather
  // than fixed here: `grade-sane.mjs` is outside item 229 (BUILDER-BRIEF §9).
  //
  // Both cases are therefore re-pointed at the writes the CPU pass STILL owns,
  // which is what the check can still see. That keeps each one's original
  // question — "would grade-sane notice an impossible colour" — answerable,
  // and it is deliberately NOT a loosening: the mutation still has to travel
  // through the real grade to a real material to be caught.

  // WARMED TWICE. The grade's ceiling is exactly WARM_R: `mul` is capped at 1
  // and `base` is an authored colour, so 1.15 is the most it can produce and
  // grade-sane reads that number out of props.ts rather than repeating it.
  // Applying the warm term a second time — which is what a second writer on one
  // of these materials would look like, or an uncapped pool gain — takes it
  // over the ceiling and nothing else in the suite would notice: it is not NaN,
  // not negative, and clamps at render, so the frame merely looks hotter.
  //
  // It now lands on the NON-pool branch (world geometry, the larger population
  // and the brighter one), because that branch still multiplies a base colour
  // by an ambient in JS. WARM_R twice is 1.3225 against a 1.155 ceiling —
  // chosen over a single application on purpose: `base * amb * WARM_R` tops out
  // at 1.15, which is UNDER the 1.155 bar, so the obvious one-term mutation
  // would have been INERT and certified nothing. Measured, not assumed.
  ['grade-twice', PROPS,
    '        let r = e.base.r * amb, g2 = e.base.g * amb, b2 = e.base.b * amb;',
    '        let r = e.base.r * amb * WARM_R * WARM_R, g2 = e.base.g * amb * WARM_G * WARM_G, b2 = e.base.b * amb * WARM_B * WARM_B;',
    'grade-sane.mjs', [], 'a material warmed twice — over the ceiling the grade can produce'],

  // A NaN IN THE GRADE, which is the failure grade-sane.mjs exists for: it does
  // not throw, does not log, and three.js uploads it happily — you get a black
  // or white mesh and no clue where from.
  //
  // It used to poison POOL_GAIN. POOL_GAIN is still a live constant, but since
  // `544053b20` its only CPU consumer is `mul`, and `mul` no longer reaches a
  // colour — it survives solely to set the `poolLit` flag (ct/props.ts:1479).
  // Poisoning it now produces NaN in a boolean comparison, which is `false`,
  // and a perfectly finite frame. The case would have been INERT even once
  // re-quoted, which is why it is aimed one level up instead: `ambient()`
  // (ct/props.ts:580) is multiplied into EVERY lit material's colour on both
  // branches, so poisoning it is the same blast radius the original had.
  ['grade-nan', PROPS,
    '  const ambient = (floor: number) => 1 - nightNow * (1 - floor);',
    '  const ambient = (floor: number) => (1 - nightNow * (1 - floor)) * NaN;  // selftest: poison the grade',
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

  // Switches the lamp pool off at the source. The halo SHEET still hangs in
  // exactly the right place, so the anchoring half of glow.mjs stays green —
  // which is the point: for weeks that was the only half there was, and the
  // user's actual request was "light around the light posts to show up on the
  // objects and entities under the lights".
  //
  // NEEDLE RE-QUOTED — item 229. It quoted `const POOL_GAIN = 12;` and matched
  // 0x: the constant is now 6.5 (ct/props.ts:561), rewritten with the
  // per-fragment lamplight. The mutation itself is unchanged in meaning — 0 is
  // still "the lamps light nothing" — and POOL_GAIN is still the single source
  // it is read from, now by the shader (`nf(POOL_GAIN)`, ct/props.ts:703) as
  // well as by `poolLit`.
  //
  // THIS CASE DISCRIMINATES. It did not used to, and the history is worth the
  // six lines because the repair is the interesting part.
  //
  // Until item 234 `glow.mjs` was RED on this tree BEFORE any mutation — so it
  // went "red" under every mutation and certified nothing, canfail scoring
  // CAUGHT on any non-zero exit. Measured then, on cd5afdd8f, unmutated:
  //
  //     FAIL main street: under a lamp 0.0450 vs mid-block 0.0450 — 1.0x (59/164)
  //     OK   side street: under a lamp 1.0000 vs mid-block 0.0857 — 11.7x (8/161)
  //
  // Both numbers were artefacts of reading `mat.color`, which `544053b20` had
  // made blind by moving the pool into POOL_FRAG: `base * amb` is per-FLOOR, so
  // near and far on one floor are identical BY CONSTRUCTION and 1.0x was the
  // only answer the main street could give — while the side street's 11.7x came
  // off SELF-LIT neon that reads 1.0000 at noon and at midnight alike.
  //
  // `glow.mjs` now reads PIXELS and normalises each spot against its own
  // daytime luminance, so both halves are honest and the check is green before
  // mutation. Verified on the built bundle, port 4460, item 241:
  //
  //     pre-pass  1 of 1 green before any mutation
  //     mutated   OK  glow-pool  CAUGHT
  //
  // ⚠ AND DO NOT RE-TUNE glow.mjs's BARS EXPECTING THIS MUTATION TO BLACK THE
  // GROUND OUT. `POOL_GAIN = 0` still leaves ~2.1x of lamplight, because the
  // per-fragment pool is not the only thing lighting the ground — the painted
  // 5.6 m ADDITIVE POOL DECAL is separate geometry this constant never touches.
  // A pixel reading necessarily sees both, so "the gain is dead" reads as a
  // halving, not a blackout. glow.mjs's bars are set from that measurement; a
  // bar reasoned from "a dead pool must give 1.0x" SLEPT through this case.
  ['glow-pool', PROPS,
    'const POOL_GAIN = 6.5;',
    'const POOL_GAIN = 0;',
    'glow.mjs', ['probe'], 'lamps that glow but light nothing beneath them'],

  // ── ITEM 150, AND THE TWO WAYS THIS ONE CAN ROT ────────────────────────────
  //
  // `screenslot.mjs` asserts two different things, so it gets two cases: that a
  // multi-material mesh does not CRASH the panel, and that an ambiguous one is
  // DEGRADED rather than guessed at. A single case would leave half the check
  // able to sleep.
  //
  // Removing the degrade puts the original item-150 crash back: `borrowed` is
  // null for a mesh the resolver refused, `onMesh` stays set, and `open()`
  // throws on it — with the movement gate already up, which is the half that
  // traps the player rather than merely looking wrong.
  ['screenslot-blind', HUD,
    'if (!borrowed) onMesh = null;',
    'if (!borrowed) { /* mutated: do not degrade */ }',
    'screenslot.mjs', [], 'a panel that throws out of open() on a multi-material mesh'],

  // The other half: GUESS instead of degrading. `m.length === 1` is the whole
  // of "there is nothing to be ambiguous about"; widening it to `>= 1` makes a
  // six-face box silently paint the panel onto slot 0, which is a visible bug
  // in the world that is very hard to trace back to hud.ts.
  ['screenslot-guess', HUD,
    '} else if (m.length === 1) {',
    '} else if (m.length >= 1) {',
    'screenslot.mjs', [], 'a panel that guesses which face of a box is the screen'],

  // ── AND WHY THERE IS NO `screenslot-freeze` CASE, WHICH IS NOT AN OVERSIGHT ─
  //
  // The dangerous half of item 150 was never the picture, it was the player:
  // `gateUp(true)` raises the gate and captures input BEFORE the surface work,
  // so a throw after it left the world frozen with NOTHING ON SCREEN —
  // `panel()` returning the id while the wrapper sat at opacity 0, Escape the
  // only way out, indistinguishable from a hang. `screenslot.mjs` asserts
  // exactly that state, and it has been WATCHED FAILING on the real pre-fix
  // source: `panel()=ct-atm while the wrapper is at opacity 0`.
  //
  // I tried to add a mutation for it (`backdropUp(true);` -> `throw err;`,
  // rethrowing out of the hang's catch) and it **SLEPT**, for a reason worth
  // recording: after the fix a multi-material mesh never ENTERS the hang —
  // `screenSlot` returns null and `onMesh` is set to null before it — so the
  // hang's catch is unreachable and the mutation does not mutate. Reproducing
  // the freeze now takes TWO independent regressions (something must throw
  // after the gate AND its guard must be gone), and canfail applies one needle.
  //
  // That is the fix working, not a hole in the suite. **Do not "repair" this by
  // adding a case that goes red for some other reason** — a green CAUGHT bought
  // that way certifies nothing, which is the failure this whole file exists to
  // catch. The pre-fix run is the evidence, and `screenslot-blind` already
  // covers the throw that used to reach the gate.

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

  // ITEM 248, REGISTERED BY ITEM 257. Removes the park's ten lanterns at the
  // source: `props.ts:2134` reads `site('park')` and the whole lantern block
  // sits behind `if (parkSite)`, so a null site builds none of them.
  //
  // ⚠ WHAT THIS CASE IS ACTUALLY FOR, AND IT IS NOT WHAT IT LOOKS LIKE. Until
  // item 248, glow.mjs held TWO regions and neither matched the park — 10 of 21
  // stamped lamps fell in NO region, and the file printed four green OKs while
  // never mentioning a third of the world's lamps. **Against that glow.mjs this
  // mutation would have changed NOTHING it printed**, because the park was
  // already unmeasured. So this case does not guard the park lanterns so much
  // as it guards the PER-REGION BARS that made the park measurable.
  //
  // ⚠ IT MUST FIRE THE `stamped` BAR, NOT THE COVERAGE ASSERTION, and 248
  // proved the difference by running it: with the park emptied the coverage
  // assertion ("every stamped lamp lands in exactly one region") **PASSES** —
  // there are no lamps left to be unclaimed. A bar derived from the stamped
  // population cannot see deletion either, which is why `stamped` is declared
  // per region (park 8) rather than computed. Watched here at registration:
  // park stamped 0 of 8. **If this case ever starts being CAUGHT by the
  // coverage line instead, something has moved and the bar has gone to sleep.**
  ['glow-park-dark', PROPS,
    "  const parkSite = site('park');",
    "  const parkSite = null as any;",
    'glow.mjs', ['probe'], 'the park losing all ten of its lanterns'],

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

  // ITEM 219, PUT BACK. This is the bug verbatim, one word of it: the obstacle
  // test in `dimWorld` reads the NODE instead of walking the parent chain, so a
  // milk crate's four uprights land in its own `solidsNear` set, the group's box
  // overlaps them by construction, and the push-out pass shoves each crate clear
  // of its own sides. The scatter is weighted toward the road, which is how a
  // crate walked into the user's thrift-shop doorway.
  //
  // `up === o &&` is the whole mutation: the loop still runs, it just stops
  // being able to see anything above the node — the pre-fix `o.userData?.litter`
  // test exactly, expressed as a change to the line the fix added rather than a
  // rewrite of it, so the needle sits on the code under test.
  //
  // WHY THIS CASE HAD TO WAIT FOR A CHECK. Worker seventyeight fixed the bug and
  // wrote in its own note that nothing guarded the fix: `footprint.mjs`'s "no
  // litter is inside a building or a prop" leg would NOT have caught it and was
  // right not to — the crate was pushed OUT into clear pavement, which is a
  // legal place for a crate. The mutation had nothing to point at until
  // `prop-landing.mjs` existed. That is item 225 and this is its second half.
  ['litter-self-push', PROPS,
    'while (up) { if (up.userData?.litter) return; up = up.parent; }',
    'while (up) { if (up === o && up.userData?.litter) return; up = up.parent; }',
    'prop-landing.mjs', [], 'three milk crates shoved out of their own side panels'],

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

  // ── w36's two, from item 73's walking tier ────────────────────────────────
  //
  // BOTH OF THESE CHECKS PRINTED THEIR FAILURE AND EXITED 0 until this session,
  // so before these cases could mean anything the checks had to be given an
  // exit code at all. That is why each was proved TWICE: the mutation below was
  // run against the fixed script AND against the pre-fix script from git, on
  // the same broken world. `jitter` printed "24 reversals — back-and-forth is
  // present" and exited 0; `integration-doors` printed "8/12 doors let you in"
  // and exited 0. A case registered against either of them a day earlier would
  // have been scored SLEPT for a reason that had nothing to do with the world.

  // The oscillation the user reported — *"this red guy glitches back and forth
  // as he walks sometimes idk why"*. `c.pick` is the lateral offset a walker
  // COMMITTED to; trying it first is what stops a pass being re-decided every
  // frame. crowd.ts's own comment at that line calls re-deriving the choice
  // "the other half of the oscillation", so dropping it restores the real bug
  // rather than inventing a new one. Measured: 0 reversals before, 29 after.
  ['jitter-reversals', 'src/proto/ct/crowd.ts',
    'for (const off of [c.pick, want, want + 0.4 * k, want - 0.8 * k, 0,',
    'for (const off of [want, want + 0.4 * k, want - 0.8 * k, 0,',
    'jitter.mjs', [], 'walkers flip-flopping as they pass, the stickiness gone'],

  // Every door in the belt is reached by standing on its PUBLISHED stand point
  // and pressing [E]. Push that point out of reach and the doors stop letting
  // you in — which is the whole subject of the check. 0.75 m is the standoff
  // the facade and the [E] spot share; 4.5 m is outside anybody's reach.
  // Measured: 12/12 doors before, 8/12 after.
  ['door-standoff', 'src/proto/ct/doors.ts',
    'export function doorStandFor(building: string, standoff = 0.75)',
    'export function doorStandFor(building: string, standoff = 4.5)',
    'integration-doors.mjs', [], 'published door spots too far out to reach the door'],
  // ── w37's, from item 77's walking tier ────────────────────────────────────
  //
  // THE ROOF PUT OUT OF REACH. w21-roof-climb exists for item 29 — walk
  // pavement -> bed -> rail -> ROOF -> hood -> street — so the mutation that
  // breaks its subject is a cab you cannot get on top of. Raising the roof
  // plate from 1.415 to 1.62 leaves the rail at 0.97 and makes the last step
  // 0.65 m, past what the rig can climb: the check prints
  // `MISS 3. CAB ROOF  feet 0.970 (want 1.62)` on every attempt, then
  // `could not get onto the roof in 4 tries` for all four exits. Measured:
  // PASS with 1 spare frame before, exit 1 after.
  //
  // NOT w33's 100-NANOMETRE MUTATION, and that is the finding behind this case.
  // notes/archive/w33-roof-hop-frames.md measured `roofY += 1e-7` taking the hop
  // from 4/4 to 0/4, and item 77 handed it on as ready-made. It does not
  // reproduce: I applied it, confirmed the dev server was serving `1.4150001`,
  // and the check passed with `spare frames: 1`. w33's world was sitting exactly
  // on a frame boundary, so a rounding-width nudge flipped an integer; today
  // there is a whole spare frame and 1e-7 cannot cross it. A case that depends
  // on the world being knife-edged stops proving anything the moment the margin
  // moves, and it would have looked exactly like a passing case.
  //
  // The tier-pinning guard stays green through this on purpose: `carVariant`
  // builds from the same PICKUP_CAB constant, so the panel really is at 1.62
  // and the check fails on REACHING the roof rather than on a mismatched pin.
  ['roof-unreachable', CARS,
    '  roofY: 1.415,       // y1 — the roof plate\'s top face. NOT a round number: see below',
    '  roofY: 1.62,        // selftest: the cab roof lifted out of climbing reach',
    'w21-roof-climb.mjs', [], 'the pickup roof too high to climb onto at all'],

  // ── I-seat-exit's TWO, and they fail apart on purpose ─────────────────────
  //
  // `seat-traps` breaks the thing the check is named for. `seat-nosit` breaks
  // the thing it could NOT see until item 77 — the verdict was
  // `stuck.length ? 1 : 0`, which is a pass over zero assertions, and with
  // nothing in the world sittable it printed "no seat traps the player" and
  // exited 0. A single case against the trap alone would have left that hole
  // registered as proven.
  //
  // Both are one-line refusals in fp.ts, which is the single point every seat
  // in the world goes through — `sit()` and `stand()` are the whole mechanic,
  // and Escape reaches `stand()` too (fp.ts:449), so blocking it there really
  // does leave no key out rather than leaving Escape as an exit.

  // THE USER'S OWN BUG, verbatim: *"pressing e doesnt get me out of it — stuck
  // in the TV seat"*. Measured: 5 of 5 sampled seats trapped, teleport distance
  // 1.18-1.40 m, which is the same 1.0-1.4 m trap band this script's header
  // recorded when it was written.
  ['seat-traps', FP,
    '  stand(): void {\n    this.forceUp = false;\n    if (!this.seat) return;',
    '  stand(): void {\n    this.forceUp = false;\n    if (this.seat) return;   // selftest: E and Escape both refuse\n    if (!this.seat) return;',
    'I-seat-exit.mjs', ['--n', '6'], 'seats you sit in and cannot get out of by any key'],

  // THE EMPTY SAMPLE. Nothing can be sat on at all, so there is no seat to be
  // trapped in and every bucket the verdict reads is zero. Measured on the same
  // broken world, twice: the pre-fix script printed
  // `no seat traps the player: 0 released by E, 0 by Escape.` and exited 0; the
  // fixed one exits 1. Registering this case a day earlier would have scored
  // SLEPT for a reason that had nothing to do with the world.
  ['seat-nosit', FP,
    '  sit(pose: SeatPose): void {\n    if (this.seat) return;',
    '  sit(pose: SeatPose): void {\n    if (!this.seat) return;   // selftest: nothing is sittable\n    if (this.seat) return;',
    'I-seat-exit.mjs', ['--n', '6'], 'a world where no seat can be sat on, scored as "no seat traps you"'],

  // ── the bed-vs-door knob, BOTH ENDS ──────────────────────────────────────
  //
  // `pickSpot` has been swung twice by two OPPOSITE user complaints, and each
  // one can be "fixed" by reintroducing the other. So it gets two cases, one
  // per direction, and w40-bed-vs-door.mjs is only doing its job if both go
  // red — a single case here would certify half a guard.

  // END TWO RESTORED: the near tier wins outright again, exactly as it did
  // between fa5c32e01 and item 85. Aim stops mattering to anything you are
  // touching, so standing by the bed and facing the door offers the bed —
  // *"i dont want sit on bed and watch tv to be the main option if im facing
  // the door to leave"*, put back. Measured: END TWO's every-stride verdict
  // goes red, the AIM and END ONE verdicts stay green, exit 1.
  ['w40-near-outright', FP,
    '    if (near && (looked || onIt)) {',
    '    if (near) {   // selftest: near beats aim outright again',
    'w40-bed-vs-door.mjs', [], 'the bed offered while the player is aimed at the door'],

  // END ONE RESTORED: `onIt` never fires, so a spot whose centre is inside the
  // player's own body is no longer unbeatable and aim takes it away. This is
  // the version I actually wrote first and the walked check rejected — it costs
  // w9's repro and 46 of seats-walk's seats. Measured: END ONE(b) goes red
  // (station 3 offers the bed from inside the doorway), the END TWO and AIM
  // verdicts stay green, exit 1.
  ['w40-looked-dominant', FP,
    '    const onIt = d < RADIUS;',
    '    const onIt = false;   // selftest: standing in it no longer protects it',
    'w40-bed-vs-door.mjs', [], 'a door you are standing in losing to whatever you glance at'],

  // THE SIDE STREET'S WALKS SEALED, at every tree — the `bus-walk` fault on the
  // other street. Only the TRUNK is solid there (0.16 m across) precisely so the
  // walk stays passable; widening it to 3.2 m severs both walks, which is what
  // side-walk.mjs is for ("are both side-street walks clear, doors reachable?").
  //
  // It discriminates, which is why this case is worth having over a blunter one:
  // measured, the four hikes and the bodega-door reach went red (longest stall
  // 10.5 s, 0.5 m covered; door reached only within 5.30 m of a 1.05 m trigger)
  // while the tree/car/pit heights, the traffic leg and all three [E] spots
  // stayed OK. 8 CHECK(S) FAILED, exit 1.
  ['sidewalk-sealed', 'src/proto/ct/sidestreet.ts',
    'mine.push(obstacle({ minX: px - 0.12, maxX: px + 0.12, minZ: tz - 0.08, maxZ: tz + 0.08 }));',
    'mine.push(obstacle({ minX: px - 0.12, maxX: px + 0.12, minZ: tz - 1.6, maxZ: tz + 1.6 }));',
    'side-walk.mjs', [], 'both side-street walks sealed shut at every tree'],

  // THE WALK LINE MOVED INTO THE ROADWAY. `IN` is "one metre in from the kerb:
  // the middle of a 2 m walk", so every node in the network is derived from it;
  // -1.0 puts the whole pedestrian network a metre INSIDE the road, which is
  // what crowd-net.mjs's registered question ("do people route the block, cross
  // only at crossings?") exists to catch.
  //
  // SAME CONSTANT AS `crowd-lane`, DELIBERATELY THE OTHER WAY. crowd-lane takes
  // IN to 1.95 — walkers against the shopfronts, sealing the 2 m lane — and is
  // aimed at crowd-walk.mjs. This takes it the other way, off the kerb, and is
  // aimed at crowd-net.mjs. The two checks own different halves of the same
  // constant and a case for one proves nothing about the other.
  //
  // Measured: `stepped off the kerb away from a crossing` at x=-2.55 (the road
  // is |x| < 5), worst lingering 44.3 s against a 4 s bar, longest freeze 64.5 s
  // against 30 s, and two walkers who never got anywhere. It discriminates — the
  // end-to-end routing, the overlap test and the errand variety stayed OK.
  ['crowd-net-inroad', 'src/proto/ct/crowd-net.ts',
    'const IN = 1.0;',
    'const IN = -1.0;',
    'crowd-net.mjs', [], 'the whole pedestrian network laid a metre inside the roadway'],

  // A CAR THAT LEANS INTO ITS TURN, like a motorcycle. The sign on `-p.turn` is
  // the whole of "leans AWAY from the turn centre: a right turn drops the left
  // side", and corner-traffic.mjs asserts it as a RELATION —
  // `Math.sign(steerPeak) !== Math.sign(leanPeak)` — rather than as a number, so
  // it cannot be satisfied by the arithmetic agreeing with itself.
  //
  // The narrowest case in this file, and deliberately: measured, exactly ONE of
  // the check's twenty assertions went red — `leans away from the turn, not into
  // it (steer -35.0°, roll -3.4°)` — and the other nineteen stayed OK, including
  // both arcs, the yield to the pedestrian, the continuity and yaw-snap tests
  // and the three parked cars. A mutation that trips one named assertion and
  // nothing else is the strongest evidence a check is actually watching.
  ['corner-lean-into', 'src/proto/ct/traffic.ts',
    'const lean = THREE.MathUtils.clamp(-p.turn * a * LEAN_PER_A, -LEAN_MAX, LEAN_MAX);',
    'const lean = THREE.MathUtils.clamp(p.turn * a * LEAN_PER_A, -LEAN_MAX, LEAN_MAX);',
    'corner-traffic.mjs', [], 'cars leaning INTO the corner, like a motorcycle'],

  // `unstick-off` — WITHHELD FOR 6 DAYS BY A BLOCKER THAT EXPIRED, ADDED NOW.
  //
  // The history is the point, and item 258 exists because of it. w37 (item 77)
  // wrote this exact mutation, ran it, watched it go red — and then DID NOT
  // REGISTER IT, correctly: `unstick-walk` was red on unmutated mainline at the
  // time (`1/531 traps are still traps`, on the phantom at 8.50,-94.50), and
  // canfail scores CAUGHT on ANY non-zero exit (GOTCHAS §32), so the case would
  // have certified itself whatever the mutation did. A false green is the most
  // expensive kind here because nobody looks at it twice.
  //
  // THEN THE WORLD WAS FIXED AND NOBODY CAME BACK. That phantom was diagnosed
  // as this file's own rotation-blindness (unstick-walk.mjs:25-32,
  // notes/w38-chamfer-trap-premise.md) and the check has been green ever since —
  // but the withheld case lived only in an English comment, so no instrument
  // could notice the reason had expired. That is what the `WITHHELD:` markers in
  // checks-can-fail.mjs now exist for.
  //
  // THE PRECONDITION, MEASURED BEFORE ADDING THIS, THREE TIMES ON TWO BUILDS.
  // A canfail case is only meaningful against a baseline that is GREEN, so:
  // onehundred twice on 210891b5f, and onehundredfour on 415dafdb1 —
  // `586 traps found · 543 genuinely stuck · 543 freed themselves · 6/6 driven
  // walked away · exit 0`. If you ever re-derive this case, re-derive that first.
  //
  // WHY BOTH CONSTANTS, WHICH IS THE ONLY interesting THING ABOUT THE MUTATION.
  // The rig has TWO redundant rescues: `unstick` pushes you out at
  // UNSTICK_SPEED, and after PATIENCE seconds of getting nowhere it teleports
  // you back to `lastGood`. Kill only the push and the timer still frees the
  // player, so the check stays GREEN on a world with no push at all — a mutation
  // that breaks one of two redundant mechanisms proves nothing. The needle spans
  // all three lines (PASSES unchanged) because canfail applies exactly one.
  ['unstick-off', FP,
    `    const UNSTICK_SPEED = 3.0;              // m/s, comparable to walking
    const PASSES = 4;                       // ample for a corner of two boxes
    const PATIENCE = 0.45;                  // s of getting nowhere before we give up and jump`,
    `    const UNSTICK_SPEED = 0.0;              // canfail unstick-off: the push, gone
    const PASSES = 4;                       // ample for a corner of two boxes
    const PATIENCE = 1e9;                   // canfail unstick-off: the lastGood rescue, never`,
    'unstick-walk.mjs', [], 'the stuck-protection switched off entirely — both the push and the lastGood rescue'],

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

  // THE CANARY'S OWN MUTATION. `scripts/health.mjs` is the command CLAUDE.md
  // hands every new agent for "does the world initialise", and for months it
  // could not go red: it printed `WORLD BROKEN` through console.log and fell off
  // the end of the file, so node returned 0 and `checks.mjs` scored a dead world
  // as a green `ok` row. It was registered here with `false` — no selftest at
  // all — which is precisely how that survived. The check with the least
  // coverage was the one every other check's reader trusts first.
  //
  // WHY THIS NEEDLE. `(window as any).__ct = {` is the last thing the entry
  // point does, so every real initialisation failure — a module that throws, the
  // `const FRONT` collision that passed `tsc` and 500'd in Vite, the world that
  // "stopped initialising" in G-interiors2 — arrives at the browser as exactly
  // this observable state: the page serves, and `__ct` is never there. Withholding
  // the assignment reproduces that state through the WORLD, in source, with a
  // rebuild, rather than inverting an assertion inside the check.
  //
  // It is NOT a blinded stamp, which is the failure GOTCHAS 34 warns about and
  // which `footprint-blind` and `glow-blind` exist to demonstrate. `__ct` really
  // is absent from `window` afterwards — library-pc.ts, slots.ts, blackjack.ts
  // and hud.ts all read it through `__ct?.` and all genuinely find nothing.
  //
  // HONEST LIMIT, because the case is weaker than it looks: this withholds the
  // handle at the END of a world that otherwise built correctly, so it proves
  // health notices the STATE every init failure produces, not that it notices an
  // early throw. Every early throw is a superset of this one — it also prevents
  // line 997 — so a health that catches this catches those; the converse is not
  // established by this case and nothing here claims it is.
  ['health-dead', TOWN,
    '  (window as any).__ct = {',
    '  (window as any).__ct_withheld_by_selftest = {',
    'health.mjs', [], 'a world that serves a page and never finishes initialising'],

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

  // A CROWD THAT NEVER TAKES A STEP — the inversion of crowd-walk's FIRST leg,
  // "they are walking", which had no case here. `crowd-lane` above is the only
  // other one aimed at that script and it is a LANE-GEOMETRY case: it moves the
  // walkable network, and the people keep walking. So the leg that item 218
  // rewrote — the one that pairs two samples of the crowd 1500 ms apart — could
  // have been turned into something that measures nothing and this file would
  // still have said crowd-walk was guarded. That is precisely GOTCHAS 34 inside
  // the tool whose job is catching it, and w72 hit the same shape in item 209:
  // every inversion those two suites had was a geometry leg.
  //
  // `step` is the only thing that advances a citizen along its edge, so zeroing
  // it freezes the cast in place while leaving all six of them in the world,
  // routed, planned and reported by `walkers()`. That is the point: the leg must
  // go red with a FULL POPULATION — 0 of 6 moved, 6 of 6 judged — not as
  // "NOTHING TO CHECK", which would prove nothing about the comparison.
  //
  // Watched, on the built bundle: `they are walking — 0/6 moved >0.2 m in 1.5 s,
  // paired by cast identity (6 of 6 present in both samples, floor 4)`.
  ['crowd-frozen', 'src/proto/ct/crowd.ts',
    'const step = held ? 0 : Math.min(c.sp, follow || c.sp) * dt;',
    'const step = 0;',
    'crowd-walk.mjs', [], 'a crowd that is planned and routed but never takes a step'],

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

const only = process.argv.slice(2).filter((a) => a !== PORT_ARG && a !== '--plan');
const run = CASES.filter((c) => !only.length || only.includes(c[0]));

// `--plan` — what WOULD this run cost, without spending it.
//
// Item 233 asks for the price of the green-before leg to be measured and
// stated rather than estimated in a comment. The leg is keyed on the CHECK, not
// on the case, so the only number that matters is how many distinct check
// invocations the selected cases share between them — and that is knowable in
// milliseconds, before any build. Printing it costs nothing and stops the next
// person from having to re-derive it.
if (process.argv.includes('--plan')) {
  const seen = new Map();
  for (const c of run) {
    const k = `${c[4]} ${c[5].join(' ')}`.trim();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  console.log(`\ncases selected:              ${run.length}`);
  console.log(`distinct check invocations:  ${seen.size}   <- the pre-pass runs this many, with NO build`);
  console.log(`per-case builds:             ${run.length}   <- unchanged by the pre-pass\n`);
  for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(2)}x  ${k}`);
  }
  process.exit(0);
}

// ── A CASE NAME THAT MATCHES NOTHING IS A GREEN CERTIFICATE THAT NOTHING WAS
//    VERIFIED, IN THE TOOL WHOSE ENTIRE JOB IS CATCHING THAT ─────────────────
//
// Item 224, found by worker seventyeight. `node scripts/canfail.mjs crowd`
// selected zero cases and printed, in full:
//
//     0/0 checks caught their mutation
//     every mutated file restored byte-for-byte
//
// exit 0. Both sentences are true and both are about the empty set, and the
// second one is worse than the first — it is a reassurance about files nobody
// opened. Reproduced on this tree before the fix and quoted verbatim.
//
// This is the vacuous pass (GOTCHAS 34), and it lands here of all places:
// `canfail` is the instrument the project uses to certify that its OTHER checks
// can still fail. Ten checks were found this week printing failure and exiting
// 0, measuring zero faces, or flipping a red to green — and every one of those
// repairs was signed off with this tool. A mistyped argument therefore does not
// merely waste a run; it hands back the strongest evidence this repo has, for
// an empty run.
//
// THE FIX IS COPIED, NOT INVENTED. `scripts/checks.mjs:1222-1231` already
// refuses exactly this for `--only`, and has since somebody hit it there. Two
// tools, one shape, one behaviour.
//
// TWO EXIT CODES, BECAUSE THEY ARE TWO FAULTS (GOTCHAS 32):
//   2  you named something that is not a case — a USAGE error, your typo,
//      fixable by typing it again. Same code checks.mjs uses.
//   3  there was nothing to select from at all — NOTHING WAS MEASURED, which
//      by house convention is 3. Not reachable today (CASES is 40-odd rows),
//      and that is the point: a population floor you can only trip by breaking
//      the table is still the assertion that makes "0/0" impossible to print.
if (only.length) {
  const unmatched = only.filter((o) => !CASES.some(([n]) => n === o));
  if (unmatched.length) {
    console.error(`\nNOT A MUTATION CASE: ${unmatched.join(', ')}\n`);
    console.error('  Nothing would have run, and an empty run prints "0/0 checks caught');
    console.error('  their mutation" and exits 0 — which reads exactly like the guard you');
    console.error('  named being proven awake.\n');
    // Matching is EXACT here, unlike checks.mjs's substring `--only`, so the
    // near-miss list is doing real work: `crowd` is a prefix of three real
    // cases and is precisely the typo that was reported.
    for (const o of unmatched) {
      const near = CASES.map(([n]) => n).filter((n) => n.includes(o) || o.includes(n));
      if (near.length) console.error(`  did you mean, for "${o}":  ${near.join('  ')}`);
    }
    console.error(`\n  the ${CASES.length} cases are:`);
    const names = CASES.map(([n]) => n).sort();
    for (let i = 0; i < names.length; i += 3) console.error('    ' + names.slice(i, i + 3).map((n) => n.padEnd(26)).join('').trimEnd());
    console.error('');
    process.exit(2);
  }
}
// The population floor proper. Every check in this suite is now required to
// fail rather than pass when it measured nothing; the tool that imposed that
// rule has to keep it too.
if (!run.length) {
  console.error(`\nNO MUTATION CASES TO RUN — nothing was measured, and nothing is proven.`);
  console.error(`  CASES holds ${CASES.length} row(s)${only.length ? `, selected by: ${only.join(', ')}` : ''}.\n`);
  process.exit(3);
}

// ── PRE-FLIGHT: EVERY NEEDLE MUST QUOTE LIVE SOURCE, AND YOU LEARN IT NOW ────
//
// Item 229. A needle that matches 0x mutates nothing, so the check it is
// supposed to certify is never tested — the empty-set certificate of item 224,
// one level down, and it had FOUR live instances: `rulings-atm`, `grade-twice`,
// `grade-nan` and `glow-pool`, dead for weeks.
//
// The scoring below ALREADY called this out honestly — verdict `NEEDLE`, kept
// out of the caught count, listed by name with its stale quotation, non-zero
// exit. None of that was wrong and none of it is removed. The defect was WHEN:
// it arrived at the END of a run that is a build and a browser per case, ~62 of
// them, so the only way to hear that a quotation had rotted was to spend the
// hour first — and then read a `????` line in a list people scroll past. That
// is precisely how four of them sat unfixed while the suite was used all week
// to certify everybody else's repairs.
//
// A needle is a string in a file. It costs milliseconds and no build to answer,
// so it is answered FIRST, for every selected case, and a rot ABORTS.
//
// EXIT 3, NOT 1, AND THE DIFFERENCE IS THE POINT (GOTCHAS 32). 1 means "I
// measured your guards and one of them is asleep" — a fact about the world.
// This is "I cannot measure them at all, because MY OWN quotations no longer
// match", a fault in this file. Reporting the second as the first is what sends
// somebody to rewrite a check that works.
//
// ONE ROTTEN NEEDLE STOPS ALL 62 ON PURPOSE. The cheaper design — skip the
// stale ones, run the rest — is what the end-of-run report already did in
// effect, and it is how the count got to four: a suite that mostly works keeps
// getting run, and the residue is permanent. The quotations are in this file;
// fixing one is a minute, and `scripts/mutations-quote-real-source.mjs` asks
// this same question in the fast tier so it should never reach here at all.
const rotted = [];
for (const [name, file, needle] of run) {
  let src = null;
  try { src = readFileSync(file, 'utf8'); } catch { /* reported as 0 below */ }
  if (src === null) { rotted.push([name, file, needle, 'the file does not exist']); continue; }
  const n = src.split(needle).length - 1;
  // 2x IS A ROT TOO, and a nastier one: `replace` takes the FIRST match, so the
  // mutation lands somewhere the case never meant and scores whatever it likes.
  if (n !== 1) rotted.push([name, file, needle, `matched ${n}x, not 1`]);
}
if (rotted.length) {
  console.error(`\n${rotted.length} MUTATION CASE(S) QUOTE SOURCE THAT NO LONGER EXISTS — nothing was run.`);
  console.error(`  A needle that matches 0x mutates nothing, so the check it certifies is`);
  console.error(`  never tested. Scoring these as anything but broken would issue this`);
  console.error(`  suite's strongest evidence over an empty set.\n`);
  for (const [name, file, needle, why] of rotted) {
    console.error(`  ${name.padEnd(14)} ${file}  ${why}`);
    console.error(`      no longer contains: ${JSON.stringify(needle)}`);
  }
  console.error(`\n  Re-point each case at the line that replaced it, or retire it WITH A`);
  console.error(`  COMMENT saying what it used to protect — never delete one silently.`);
  console.error(`  ${rotted.length} of ${run.length} selected case(s); the other ${run.length - rotted.length} were not run.\n`);
  process.exit(3);
}

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

// ── RUNNING A CHECK, AND DECIDING IT IS RED. One definition, two callers. ────
//
// This logic used to exist only inside the scoring loop. The pre-pass below has
// to ask the identical question of the identical script, and a second copy that
// drifted by one regex would make the before and after legs incomparable —
// which is the exact failure this whole item is about.
const checkRed = (script, args) => {
  let red = false, out = '';
  try { out = sh(`SHOT_URL=${URL} node scripts/${script} ${args.join(' ')}`); }
  catch (e) { red = true; out = String(e.stdout || '') + String(e.stderr || ''); }
  if (!red && /^FAIL/m.test(out)) red = true;
  return { red, out };
};

// ── CAUGHT MUST MEAN "RED *BECAUSE OF* THE MUTATION" ────────────────────────
//
// Item 233. This file proves a check can fail by breaking the source and
// requiring the check to go red — but it scored CAUGHT on ANY non-zero exit.
// **So a case pointed at a check that was ALREADY RED for an unrelated reason
// passed while proving nothing.** The mutation was never shown to be what
// caused the failure; the case certified air, and it certified it in the tool
// this project has used all week to certify twelve repairs to lying checks.
//
// That is the empty-set defect of item 224 one level out, and it is the same
// discipline every probe here now follows: SELF-TEST BOTH SIGNS. A guard that
// is red on a healthy world and red on a broken one has a colour uncorrelated
// with the mutation, which the `wetness` note further down describes from the
// other direction. One-sided evidence is not evidence.
//
// So: every distinct check is run ONCE on the unmutated tree first. Green
// before + red after is CAUGHT. Already red is `PRE-RED` — a distinct status,
// scored as unprovable, named in the report, non-zero exit — never CAUGHT and
// never a silent pass.
//
// ── WHAT IT COSTS, MEASURED (2026-08-03, `node scripts/canfail.mjs <port>
//    --plan` plus `time` on the two components) ───────────────────────────────
//
// The item's warning was that a green-then-red pair doubles a run that is
// already a build and a browser per case. Measured, it does not:
//
//   62 cases  ->  38 DISTINCT check invocations. The pass is keyed on
//     `script + args`, not on cases, because five cases share `footprint.mjs`,
//     five share `park.mjs` and four share `glow.mjs probe`. `--plan` prints
//     this for any selection, so the ratio is a fact in the log.
//   NO BUILD IS DUPLICATED. The pristine bundle is built ~15 lines above and
//     the pre-pass runs against it unmutated. On this tree `npm run build` is
//     0.49 s and one browser check is ~1.9 s, so the pass is browser time only.
//   IT REFUNDS. A PRE-RED case skips its mutation entirely — no build, no
//     browser. `glow.mjs probe` is red today and carries FOUR cases, so four
//     builds and four checks come straight back off the bill.
//
//   62 x (0.49 + 1.9) = 148 s before;  + 38 x 1.9 - 4 x 2.4 = 62 s net.
//   About +40%, not +100%. Check durations vary, so treat this as the shape.
//
// WHICH DESIGN, AND WHY NOT THE OTHER ONE. The item offered running the before
// leg only for checks NOT in a known-red set. That is cheaper and it is the
// wrong trade: a hand-maintained list of known-red checks is exactly the kind
// of state that rots, and a rotted entry would silently restore the very bug
// this item is about — a case certifying air, now with a comment saying it was
// considered. The measured pass has no list to go stale.
const ckey = (script, args) => `${script} ${args.join(' ')}`;
const BASE = new Map();
{
  const distinct = [...new Map(run.map((c) => [ckey(c[4], c[5]), [c[4], c[5]]])).values()];
  console.log(`\n  pre-pass: ${distinct.length} distinct check invocation(s) across ${run.length} case(s),`);
  console.log(`  on the UNMUTATED tree — a check already red here cannot certify anything.`);
  for (const [script, args] of distinct) {
    const r = checkRed(script, args);
    BASE.set(ckey(script, args), r);
    if (r.red) console.log(`    ALREADY RED  scripts/${ckey(script, args)}`);
  }
  const reds = [...BASE.values()].filter((r) => r.red).length;
  console.log(`  ${BASE.size - reds} of ${BASE.size} green before any mutation.\n`);
}

for (const [name, file, needle, repl, script, args, expect] of run) {
  // THE BEFORE LEG. A check that is red on the unmutated tree is not evidence
  // of anything, so the mutation is not even attempted — which is also why this
  // sits above the build rather than beside the scoring.
  const base = BASE.get(ckey(script, args));
  if (base && base.red) {
    results.push([name, 'PRE-RED',
      `${expect} — scripts/${ckey(script, args)} is ALREADY RED on the unmutated tree, `
      + `so this case proves nothing; fix that check before trusting this guard`]);
    continue;
  }
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
    // THE AFTER LEG. Same helper, same regex, same idea of red as the pre-pass
    // — see `checkRed`. The before leg already ran and was green, or this case
    // would have been scored PRE-RED and never reached here.
    let { red, out } = checkRed(script, args);
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
    // FLAKY IS REAL AND THIS FILE CANNOT TELL YOU WHICH — and the one case that
    // proved it is now FIXED, in the guard rather than here.
    //
    // `wetness` measured CAUGHT, CAUGHT, SLEPT, SLEPT, CAUGHT across five
    // identical invocations. A retry was built here and taken out again,
    // correctly: re-running the check against the same mutated world did not
    // stabilise it, because the non-determinism was never at the level of the
    // invocation.
    //
    // IT WAS THE CLOCK. Drying is `wetness -= dt / dryFor` (ct/props.ts:1925)
    // and dt is clamped at 0.05 s (src/main.ts:107), so the street dries in
    // SIMULATED time — while wetness.mjs sampled it on seven waits of 2000 ms of
    // WALL CLOCK. This file is the loaded case by construction: a full
    // `npm run build` and a browser for every case. Under that load the ladder
    // bought far less simulated time than it asked for, stopped short of the
    // bone-dry street the mutation produces, and every mutation-sensitive
    // verdict passed. Reproduced deliberately with CPU_THROTTLE=20 (a knob
    // wetness.mjs now carries): at x20 the old guard was red on a HEALTHY world
    // for an unrelated clock reason and green on the mutation. Its colour was
    // uncorrelated with the mutation in both directions.
    //
    // The lesson generalises past this one case, and it is the reason to read
    // this comment: ANY guard that measures a rate on a wall-clock wait will
    // sleep HERE and nowhere else, because nowhere else is the box this busy.
    // A SLEPT that will not reproduce on an idle machine is this, until proven
    // otherwise — count frames, or measure the world's own state.
    // CAUGHT now carries BOTH legs: the pre-pass found this check green on the
    // unmutated tree, and it is red now. That is what makes the mutation the
    // cause rather than a coincidence.
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
// PRE-RED JOINS THIS LIST for exactly the reason the other three are on it: the
// case was not scored. It is emphatically NOT a sleeping guard — the guard was
// never given a fair test — and calling it one would send a builder to rewrite
// a check whose only sin is standing downstream of a different broken one.
const unprovable = results.filter((r) => ['INERT', 'NOT-RUN', 'NEEDLE', 'PRE-RED'].includes(r[1]));
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
