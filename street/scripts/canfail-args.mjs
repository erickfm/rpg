// CANFAIL REFUSES A SELECTION IT CANNOT HONOUR — instead of certifying an empty
// set as a pass.
//
// Named for the claim, not the subject (GOTCHAS 24). Its sibling one axis over
// is `mutations-quote-real-source.mjs`, which asks whether the CASES quote live
// source. This asks whether canfail's FRONT DOOR is sound: what it does with an
// argument it does not recognise, and what it does with a case whose quotation
// has rotted. Neither question is visible to the other.
//
// ── why this exists ──
//
// Item 224, found by worker seventyeight: `node scripts/canfail.mjs crowd`
// selected zero cases and printed, in full:
//
//     0/0 checks caught their mutation
//     every mutated file restored byte-for-byte
//
// exit 0. Both sentences true, both about the empty set, and the second is a
// reassurance about files nobody opened. `canfail` is the instrument this
// project uses to prove its other checks can still fail — ten were found in one
// week printing failure and exiting 0, measuring zero faces, or flipping a red
// to green, and every one of those repairs was signed off with this tool. A
// mistyped argument therefore does not waste a run; it hands back the strongest
// evidence in the repo, for a run that verified nothing.
//
// It was fixed. Worker seventynine's report on that fix is the reason this file
// exists, verbatim: **nothing in `checks.mjs` guards canfail's own argument
// handling.** `mutations-quote-real-source` cannot see it — it reads the CASES
// table, and a bad argument never reaches the table. So the repair that closed
// the worst vacuous pass in the suite was itself unguarded, and would have
// regressed silently. That is the same shape as GOTCHAS 49 (published is not
// adopted) and the same shape as the bug it fixed.
//
// Item 229 added a second front-door refusal — the needle pre-flight — and it
// is guarded here for the same reason: four cases had quoted dead source for
// weeks, and the gate that now stops that is one `if` away from being deleted.
//
// ── what it costs ──
//
// Nothing. Every case below is refused BEFORE `canfail` builds or opens a
// browser, which is the property being asserted as much as the exit code: a
// refusal that arrives after the hour has been spent is not a refusal. Three of
// the five legs prove the ORDER by pointing SHOT_URL at a port with nothing on
// it — if the refusal did not come first, the answer would be "NOTHING IS
// SERVING" instead.
//
//   node scripts/canfail-args.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const a of process.argv.slice(2)) {
  // The same strictness this file is about, applied to itself. A guard that
  // accepts an argument it then ignores is the bug one level up.
  console.error(`unknown argument ${JSON.stringify(a)} — this script takes none`);
  process.exit(2);
}

const CANFAIL = 'scripts/canfail.mjs';

// A PORT WITH NOTHING ON IT, and it has to be nothing. Every leg below asserts
// that a refusal beats the server check, which is only evidence if the server
// check would otherwise have fired. 4499 is outside the builder range
// (4180-4199) and outside the live world (5177) on purpose.
const DEAD = 'http://localhost:4499/';

const fails = [];
let ran = 0;

/** Run canfail and hand back what a builder would see. Never throws: a non-zero
 *  exit is the SUBJECT here, not an error. */
function canfail(args, { url = DEAD } = {}) {
  ran++;
  try {
    const out = execFileSync('node', [CANFAIL, ...args],
      { env: { ...process.env, SHOT_URL: url }, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

/** Did canfail print a SCORE? — i.e. issue a certificate.
 *
 *  ANCHORED TO THE START OF A LINE, and the first version of this file was not.
 *  A bare `/0\/0 checks caught/` test failed against a CORRECT refusal, because
 *  the refusal message QUOTES the vacuous output it exists to prevent:
 *
 *      Nothing would have run, and an empty run prints "0/0 checks caught
 *      their mutation" and exits 0 — which reads exactly like the guard you…
 *
 *  So the guard was reading canfail's explanation of the bug as the bug. Caught
 *  on this file's first run, by its own red, and it is the house warning
 *  exactly: your own probe is the likeliest liar. canfail's real verdict is
 *  written at the start of a line (`canfail.mjs`'s closing `console.log`), and
 *  prose about it never is. */
const certified = (out) => /^\s*\d+\/\d+ checks caught/m.test(out);

function check(label, cond, detail) {
  console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) { fails.push(label); if (detail) console.log(`         ${detail}`); }
}

console.log('\ncanfail refuses what it cannot honour\n');

// ── 1. AN UNKNOWN CASE NAME ────────────────────────────────────────────────
// The item-224 bug itself. `crowd` was the reported typo — a prefix of three
// real cases — but a token that resembles nothing is the cleaner assertion,
// because it cannot be rescued by a near-miss suggestion.
{
  const r = canfail(['definitely-not-a-case-229']);
  check('an unknown case name exits 2, not 0', r.code === 2, `exit was ${r.code}`);
  check('…and says NOT A MUTATION CASE', /NOT A MUTATION CASE/.test(r.out));
  check('…and never prints the vacuous "0/0 checks caught their mutation"',
    !certified(r.out));
  // THE ORDER, which is half the value. If validation ran after the build and
  // the server check, this would have died on the dead port instead.
  check('…before the build and the server check (refusal beats NOTHING IS SERVING)',
    !/NOTHING IS SERVING/.test(r.out));

  // POPULATION FLOOR. The refusal lists every case it knows, and that count is
  // the only number here that can quietly go to zero — a CASES table that
  // failed to parse would refuse every name for the wrong reason and every
  // assertion above would still pass. 62 today; the floor is well under it
  // because cases are legitimately retired, and well over zero because zero is
  // the failure being guarded.
  const m = r.out.match(/the (\d+) cases are:/);
  check('…and lists the cases it does know, 30+ of them',
    !!m && +m[1] >= 30, m ? `it offered ${m[1]}` : 'no case list in the refusal');
  if (m) console.log(`         canfail knows ${m[1]} mutation cases`);
}

// ── 2. A FLAG-SHAPED ARGUMENT ──────────────────────────────────────────────
// From the same report: canfail treats every non-port argument as a case name,
// so `--help` was ALSO a silently-green empty run. This is the exact bug
// claim.sh had when it claimed item 93 for an agent called `--help`.
{
  const r = canfail(['--help']);
  check('a flag-shaped argument is refused too, not read as a case name',
    r.code === 2, `exit was ${r.code}`);
  check('…and does not certify anything on the way out', !certified(r.out));
}

// ── 3. VALID AND INVALID TOGETHER — THE DISCRIMINATION CONTROL ─────────────
// Legs 1 and 2 pass just as happily if canfail refuses EVERYTHING, which would
// be a broken tool that scores green here. This is the leg that says it can
// tell the two apart, and it costs no build.
{
  const r = canfail(['glow-pool', 'definitely-not-a-case-229']);
  check('a valid name alongside an invalid one still exits 2', r.code === 2, `exit was ${r.code}`);
  const line = (r.out.split('\n').find((l) => l.includes('NOT A MUTATION CASE')) ?? '');
  check('…and names ONLY the invalid one', line.includes('definitely-not-a-case-229')
    && !line.includes('glow-pool'), `it said: ${JSON.stringify(line.trim())}`);
}

// ── 4. A ROTTED NEEDLE — item 229's gate ───────────────────────────────────
//
// THE INJECTION IS SELF-VERIFYING, and that is not decoration. The obvious way
// to write this leg is to sed a real needle out of a copy — and a real needle
// is exactly the thing that CHANGES, so the day somebody edits that line the
// sed matches nothing, the copy is identical to the original, and this leg
// passes while testing the opposite of what it claims. That is the vacuous
// pass this whole file is about, reintroduced by the guard against it.
//
// So the copy gains a case that could never match any source, and the
// insertion is asserted before the copy is run.
{
  const src = readFileSync(CANFAIL, 'utf8');
  const anchor = 'const CASES = [';
  const NEEDLE = 'THIS STRING IS DELIBERATELY IN NO SOURCE FILE (canfail-args 229)';
  const row = `\n  ['argrot-selftest', PROPS, ${JSON.stringify(NEEDLE)}, 'x',\n`
            + `    'glow.mjs', [], 'selftest: a needle that quotes nothing'],\n`;
  if (src.split(anchor).length - 1 !== 1) {
    check('the selftest can inject a rotted case', false,
      `'${anchor}' appears ${src.split(anchor).length - 1}x in ${CANFAIL} — cannot aim the injection`);
  } else {
    const mutated = src.replace(anchor, anchor + row);
    if (!mutated.includes(NEEDLE) || mutated === src) {
      check('the selftest can inject a rotted case', false, 'the injection did not take');
    } else {
      const dir = mkdtempSync(join(tmpdir(), 'canfail-args-'));
      const copy = join(dir, 'canfail-rotted.mjs');
      writeFileSync(copy, mutated);
      ran++;
      let code = 0, out = '';
      try {
        out = execFileSync('node', [copy, 'argrot-selftest'],
          { env: { ...process.env, SHOT_URL: DEAD }, encoding: 'utf8', stdio: 'pipe' });
      } catch (e) { code = e.status; out = String(e.stdout ?? '') + String(e.stderr ?? ''); }
      check('a case quoting source that does not exist aborts, exit 3', code === 3, `exit was ${code}`);
      check('…and says so, naming the case and its dead quotation',
        /QUOTE SOURCE THAT NO LONGER EXISTS/.test(out) && /argrot-selftest/.test(out));
      check('…and scores nothing — no case is certified on the way out',
        !certified(out));
      check('…before the server check (the abort beats NOTHING IS SERVING)',
        !/NOTHING IS SERVING/.test(out));
    }
  }
}

// ── 5. THE POSITIVE CONTROL — a good selection is NOT refused ──────────────
//
// Everything above is a refusal, and a tool that refused every input would
// score four green blocks. This is the leg that proves the front door opens:
// NO arguments at all, so every case is selected and every needle is audited,
// against the same dead port. Getting as far as "NOTHING IS SERVING" is the
// pass — it means all 62 needles quoted live source and the selection was
// honoured, and it is the one outcome none of the refusals can produce.
//
// It costs one `npm run build` (~0.7 s measured) and no browser.
{
  const r = canfail([]);
  check('a valid selection is NOT refused — it reaches the world',
    /NOTHING IS SERVING/.test(r.out), `exit ${r.code}; got: ${r.out.trim().split('\n').slice(-3).join(' / ')}`);
  check('…so no live needle is rejected by the pre-flight',
    !/QUOTE SOURCE THAT NO LONGER EXISTS/.test(r.out));
  check('…and it is not mistaken for a usage error', r.code === 3, `exit was ${r.code}`);
}

// A floor on the legs themselves — see the CASES floor above for the argument.
if (ran < 5) {
  console.log(`\n  FAIL only ${ran} invocation(s) of canfail — this file drives 5.`);
  fails.push('invocation floor');
}

console.log(`\n  ${fails.length ? 'FAIL' : 'OK  '} canfail's front door refuses `
  + `what it cannot honour, and honours what it can (${ran} invocations)`);
if (fails.length) {
  console.log(`\n  ${fails.length} assertion(s) failed:`);
  for (const f of fails) console.log(`    ${f}`);
  process.exit(1);
}
