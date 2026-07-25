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
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

// [name, file, needle, replacement, script, args, what the check should say]
const CASES = [
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

  ['wetness', PROPS,
    'const PUDDLE_C = 0.444;',
    'const PUDDLE_C = 1.6;',
    'wetness.mjs', ['probe'], 'puddles LIGHTER than the road they sit in'],

  ['glow', PROPS,
    'halo.position.set(headX, sidewalkY + LAMP_H - 0.31, headZ);',
    'halo.position.set(headX + 1.4, sidewalkY + LAMP_H - 0.31, headZ);',
    'glow.mjs', ['probe'], 'the glow floating 1.4 m off its lamp head'],

  ['park', PROPS,
    'lens.userData.parkLantern = true;',
    '',
    'park.mjs', [], 'the park lanterns unfindable'],

  ['bus-bench', PROPS,
    'const LEG_TOP = SEAT_Y - 0.02, LEG_H = LEG_TOP - sidewalkY;',
    'const LEG_TOP = SEAT_Y + 0.025, LEG_H = LEG_TOP - sidewalkY;',
    'bus.mjs', ['bench'], 'bench legs coplanar with the seat slats (GOTCHAS 6)'],

  ['basin', GROUND,
    'const PROUD = 0.007;',
    'const PROUD = -0.02;',
    'basin.mjs', [], 'the throat sunk below the casting instead of proud'],

  ['rain', PROPS,
    'const RAIN_N = 500;',
    'const RAIN_N = 6;',
    'rain.mjs', [], 'a storm with six drops in it'],

  // First aim of this one was PIT_CLEAR against trash.mjs, and trash.mjs slept
  // — correctly. It guards the litter SET (count, burial, repeated rotations);
  // the tree pits are footprint.mjs's, below. The mutation was sound and
  // pointed at the wrong tool, which is its own kind of check that proves
  // nothing.
  ['trash', PROPS,
    '    o.position.set(cx, gy - bb.min.y, z);',
    '    o.position.set(cx, gy - bb.min.y - 0.05, z);',
    'trash.mjs', ['probe'], 'every piece of litter sunk 5 cm into the pavement'],

  // Aimed at PIT_CLEAR first and footprint.mjs slept — but the check was
  // right and the MUTATION was inert: PIT_CLEAR is derived from PIT_X for the
  // record and positions nothing, so zeroing it changes no geometry. A
  // mutation that does not mutate proves nothing about the check that ignores
  // it. PIT_X is the constant that actually moves the well.
  ['footprint-pits', PROPS,
    'const PIT_X = 5.56;',
    'const PIT_X = 5.09;',
    'footprint.mjs', [], 'tree pits run flush into the kerb'],
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
const LOCK = '.canfail-mutated';      // which file is mutated right now
const BACKUP = '.canfail-original';   // and exactly what it held before

// Crash recovery, not signal handling. A 2-minute harness timeout SIGTERMed a
// run mid-mutation and node died inside a synchronous `npm run build`, where
// the event loop cannot turn and no JS handler runs — SIGKILL would not run one
// either. So the original bytes go to disk BEFORE the edit and any later run
// puts them back. Survives SIGTERM, SIGKILL and a power cut.
if (existsSync(LOCK) && existsSync(BACKUP)) {
  const f = readFileSync(LOCK, 'utf8').trim();
  if (f) { writeFileSync(f, readFileSync(BACKUP)); console.log(`recovered ${f} from a killed run`); }
  rmSync(LOCK, { force: true }); rmSync(BACKUP, { force: true });
  try { sh('npm run build'); } catch {}
}

let touched = null;
const restore = () => {
  if (touched && existsSync(BACKUP)) { writeFileSync(touched, readFileSync(BACKUP)); }
  touched = null;
  rmSync(LOCK, { force: true }); rmSync(BACKUP, { force: true });
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
    writeFileSync(BACKUP, src);       // the exact bytes back, whatever state they were in
    writeFileSync(LOCK, file);        // on disk BEFORE the edit, so a kill is survivable
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
