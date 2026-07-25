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
// SAFETY, because this edits source. Refuses to start on a dirty tree, so the
// restore can never eat real work; restores with `git checkout --` in a
// finally AND on process exit, so a throw or a Ctrl-C cannot leave the world
// mutated; and verifies the tree is clean again before reporting.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PROPS = 'src/proto/ct/props.ts';
const GROUND = 'src/proto/ct/tex-ground.ts';
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

// [name, file, needle, replacement, script, args, what the check should say]
const CASES = [
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

  ['footprint-pits', PROPS,
    "const PIT_CLEAR = PIT_X - PIT_W / 2 - (ROAD_HALF + CHAMFER);",
    "const PIT_CLEAR = 0.0 * (PIT_X - PIT_W / 2 - (ROAD_HALF + CHAMFER));",
    'footprint.mjs', [], 'tree pits run flush into the kerb'],
];

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const dirty = () => sh('git status --porcelain src/').trim();

if (dirty()) {
  console.error('REFUSING: src/ has uncommitted changes. This script restores by\n' +
                '`git checkout --`, which would destroy them. Commit or stash first.');
  process.exit(2);
}

let touched = null;
const restore = () => { if (touched) { try { execSync(`git checkout -- ${touched}`); } catch {} touched = null; } };
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });

const only = process.argv.slice(2);
const run = CASES.filter((c) => !only.length || only.includes(c[0]));
const results = [];

for (const [name, file, needle, repl, script, args, expect] of run) {
  const src = readFileSync(file, 'utf8');
  const n = src.split(needle).length - 1;
  if (n !== 1) { results.push([name, 'NEEDLE', `matched ${n}x, not 1 — mutation not applied`]); continue; }
  try {
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
if (dirty()) { console.error('\nSOURCE LEFT DIRTY — restore failed. git checkout -- src/'); process.exit(3); }
console.log('source tree restored clean');
process.exit(bad.length ? 1 : 0);
