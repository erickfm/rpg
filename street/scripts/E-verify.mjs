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
//   SHOT_URL=http://localhost:4182/ node scripts/E-verify.mjs
//
// Exits non-zero if any area fails, so it can gate something later if the
// desk wants it to. It is slow — three browsers, a lot of walking — so it is
// a command you run before landing a change on this block, not on every save.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const AREAS = [
  { name: 'courtyard', script: 'scripts/E-walk.mjs',
    what: 'the library courtyard, its steps and its benches' },
  { name: 'churchyard', script: 'scripts/E-yard-walk.mjs',
    what: 'the churchyard, its gate and its flight' },
  { name: 'park', script: 'scripts/E-park-walk.mjs',
    what: 'the park: the loop, the frontage, the edge line' },
  // Added the day the ground stopped being flat. A decal on a slope is a
  // failure you cannot see — a worn path that sinks into the grass looks like
  // a worn path that stops there — and the first thing this found was not
  // burial at all but every desire line in the park running the wrong diagonal.
  { name: 'drape', script: 'scripts/E-drape.mjs',
    what: 'what is laid on the grass stays on top of it' },
  { name: 'onslope', script: 'scripts/E-onslope.mjs',
    what: 'what stands on the grass is not floating above it' },
  { name: 'coplanar', script: 'scripts/E-coplanar.mjs',
    what: 'no two visible surfaces share a height (§6)' },
  { name: 'jump', script: 'scripts/E-jump.mjs',
    what: 'no boundary of mine can be jumped, now the ground is higher' },
  { name: 'rain', script: 'scripts/E-rain.mjs',
    what: 'the park still gets wet with the relief shading on it' },
  { name: 'lamps', script: 'scripts/E-lamps.mjs',
    what: "B's park lamps still stand on ground that is at KERB_H" },
  { name: 'moundseat', script: 'scripts/E-seat-mound.mjs',
    what: 'the one seat the relief moved still sits at the right height' },
];

// ── is what my modules PUBLISH actually read? ────────────────────────────
//
// `npm run wiring` answers "is the module constructed?", which is a different
// question and does not catch what cost this block the most time. Four times
// a module of mine was built, constructed, and still invisible because a
// SECOND thing it published had no reader in the entry point:
//
//   courtGround   exported, never called   -> the library steps did not climb
//   COURT.colliders  exported, never spread -> the courtyard was sealed
//   civicSeats()  exported, never called   -> the benches were not sittable
//   buildPark     written, never imported  -> the whole park was not in the world
//
// Every one of those typechecks, constructs, and looks right in a screenshot.
//
// The rule is "referenced somewhere other than its own declaration" — NOT
// "referenced outside its own file", which is what I wrote first. It fired
// immediately on `civicSeats`, I checked the world before believing it, and
// the world had eleven bench seats registered: under the register() pattern a
// module wires ITSELF, so its own `register(ctx)` is a perfectly good reader.
// A check that cries wolf gets deleted rather than fixed, and this one nearly
// earned it on its first run.
const MINE = ['ct/civic.ts', 'ct/park.ts'];
const SRC = 'src/proto';
const sources = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}/${e.name}`);
    else if (e.name.endsWith('.ts')) sources.push(`${dir}/${e.name}`);
  }
};
walk(SRC);
const orphans = [];
for (const f of MINE) {
  const text = readFileSync(`${SRC}/${f}`, 'utf8');
  const names = [...text.matchAll(/^export\s+(?:const|function|let)\s+(\w+)/gm)].map((m) => m[1]);
  for (const n of names) {
    let uses = 0;
    for (const s of sources) {
      const body = readFileSync(s, 'utf8');
      for (const m of body.matchAll(new RegExp(`\\b${n}\\b`, 'g'))) {
        // the declaration itself does not count as a use of the thing declared
        const line = body.slice(body.lastIndexOf('\n', m.index) + 1, body.indexOf('\n', m.index));
        if (s.endsWith(f) && /^export\s+(const|function|let)\s/.test(line)) continue;
        uses++;
      }
    }
    if (!uses) orphans.push(`${f} exports ${n}, and nothing anywhere uses it`);
  }
}
if (orphans.length) {
  console.log('── published but unread');
  for (const o of orphans) console.log(`   FAIL ${o}`);
  console.log('   ^ built, constructed, and invisible — the failure tsc and `wiring` both pass\n');
} else {
  console.log('── published but unread: none, every export of mine has a reader\n');
}

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
    if (/^(FAIL|NOTE|SKIP)/.test(line.trim())
        // MEASURING THE WRONG WORLD must show. Without it this reported
        // "5 of 5 areas failed — do not land this" with not one line of why,
        // on a build where every harness passes when run by hand: the children
        // had exited 3 on the provenance guard because I rebased after building,
        // and the banner did not match anything here. A summary that says
        // everything is broken and shows nothing is worse than no summary.
        || /walks passed|FAILED|sinking into it|is floating|same height/.test(line)
        || /boundary holds|park gets wet|ground still agree|relief put it/.test(line)
        || /MEASURING THE WRONG WORLD|is serving build|this checkout is at|Fix:/.test(line)) {
      console.log(`   ${line.trim()}`);
    }
  }
  if (code !== 0) { failed++; console.log(`   ^ ${a.name} FAILED`); }
  console.log('');
}

console.log(failed
  ? `${failed} of ${run.length} areas failed — do not land this`
  : `all ${run.length} areas walk`);
if (orphans.length) console.log(`${orphans.length} export(s) published with no reader`);
process.exit(failed || orphans.length ? 1 : 0);
