// Everything builder E owns, walked in one command.
//
// WHY THIS EXISTS. `land.sh` gates the merge train on `tsc --noEmit`, and
// every way my areas have been broken this session typechecked perfectly:
//
//   · a blanket wall collider in crosstown.ts sealed the library courtyard
//   · a blanket footprint in street.ts sealed the churchyard
//   · a street tree pinched the pavement past the park to nothing
//   · a streetlamp stood in the middle of the churchyard gate
//   · my own bench run walked a bench into the park gate
//   · my own tree line stood on the loop's back leg
//
// Not one of those is a type error and not one would have been found by
// looking. They were all found by driving the player, and mostly by accident,
// because these harnesses only ever ran when I happened to run them.
//
//   node scripts/E-verify.mjs                 # all of it
//   node scripts/E-verify.mjs park            # one area
//   SHOT_URL=http://localhost:4193/ node scripts/E-verify.mjs
//
// Exits non-zero if any area fails, so it can gate something later if the
// desk wants it to. It is slow — three browsers, a lot of walking — so it is
// a command you run before landing a change on this block, not on every save.
import { spawn } from 'node:child_process';

const AREAS = [
  { name: 'courtyard', script: 'scripts/E-walk.mjs',
    what: 'the library courtyard, its steps and its benches' },
  { name: 'churchyard', script: 'scripts/E-yard-walk.mjs',
    what: 'the churchyard, its gate and its flight' },
  { name: 'park', script: 'scripts/E-park-walk.mjs',
    what: 'the park: the loop, the frontage, the edge line' },
];

const pick = process.argv[2];
const run = AREAS.filter((a) => !pick || a.name === pick);
if (!run.length) {
  console.error(`no area called "${pick}". Try: ${AREAS.map((a) => a.name).join(', ')}`);
  process.exit(2);
}

const exec = (script) => new Promise((resolve) => {
  const p = spawn('node', [script], { env: process.env });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
});

let failed = 0;
for (const a of run) {
  process.stdout.write(`── ${a.name}: ${a.what}\n`);
  const { code, out } = await exec(a.script);
  // echo only what matters: the failures, the notes, and the verdict
  for (const line of out.split('\n')) {
    if (/^(FAIL|NOTE|SKIP)/.test(line.trim()) || /walks passed|FAILED/.test(line)) {
      console.log(`   ${line.trim()}`);
    }
  }
  if (code !== 0) { failed++; console.log(`   ^ ${a.name} FAILED`); }
  console.log('');
}

console.log(failed
  ? `${failed} of ${run.length} areas failed — do not land this`
  : `all ${run.length} areas walk`);
process.exit(failed ? 1 : 0);
