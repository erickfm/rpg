// Can any check in this suite pass by doing nothing?
//
// Named for what it asserts (GOTCHAS 24). The defect it guards is one I put in
// five of my own scripts and did not notice for weeks:
//
//     const mode = process.argv[2] ?? 'all';
//     if (mode === 'probe' || mode === 'all') { ...the entire check... }
//     if (mode === 'shots' || mode === 'all') { ... }
//
// Hand it a mode neither branch matches — `--probe` instead of `probe`, the
// flag form most of this suite takes — and it runs no branch, falls off the end
// of the file, and EXITS 0. Green row, one second, zero assertions.
//
// I found it by mistyping `bus --walk`, then found it in trash, glow, wetness
// and basin too. lib/modes.mjs is the fix; this is what stops the fix rotting.
//
// ── why a check and not just the fix ──
//
// canfail cannot see this. It mutates SOURCE and requires the check to go red,
// but it invokes every check with the same correct arguments checks.mjs does,
// so the bad-mode path is never taken. The hole is reachable only by hand,
// which is exactly when nobody is reading the exit code. So the guard needs its
// own guard, and it has to be one that discovers new offenders rather than
// checking a list I maintain — the next script with a mode word will be written
// by somebody who never read this file.
//
// So: find every script that dispatches on a mode, and require each one to
// refuse an unknown one. Discovery is by source, not by a list.
//
// Costs no browser — the guard exits before chromium.launch() — so this runs in
// well under a second and belongs in the default tier.
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
const self = import.meta.url.split('/').pop();
const suspects = readdirSync(dir)
  .filter((f) => f.endsWith('.mjs'))
  // Not itself. The discovery is a source grep and this file necessarily
  // contains the pattern it looks for, so without this it runs itself with a
  // bogus mode, which runs itself with a bogus mode.
  .filter((f) => f !== self)
  .filter((f) => {
    const src = readFileSync(dir + f, 'utf8');
    // IT MUST TAKE ITS MODE FROM THE COMMAND LINE. `mode ===` alone is not the
    // defect: scripts/laneaudit.mjs writes `for (const mode of ['fixtures',
    // 'all'])` and never reads argv at all, so it cannot be handed a mode it
    // does not know — it ignores arguments entirely, which is a different thing
    // and not a fault. I flagged it as one and would have routed a non-problem
    // to its owner, which is exactly what happened with truck.mjs.
    //
    // The condition is a mode DERIVED FROM argv, then dispatched on.
    // Either route counts: reading argv[2] directly, or calling the shared
    // guard, which reads it for you. Testing only for argv[2] excluded every
    // script that had ALREADY adopted lib/modes.mjs — five of mine — so the
    // check would have stopped verifying the ones it had fixed. A guard that
    // stops watching what it repaired is worth less than no guard.
    const takesArgvMode = /process\.argv\s*\[\s*2\s*\]/.test(src) || /\bmodes\(/.test(src);
    if (!takesArgvMode) return false;
    if (!/mode\s*===/.test(src) && !/\bmodes\(/.test(src)) return false;
    // IT MUST HAVE A VERDICT TO LOSE. A script that never sets an exit code is
    // a photo tool, not a check — it makes no claim, so it cannot make one
    // falsely, and exiting 0 having taken no screenshots is a wasted run rather
    // than a wrong answer.
    //
    // truck.mjs is the case that taught me this, and it caught me mid-routing:
    // I had already written two lines of fix into my routing note for its
    // owner before checking whether it asserts anything. It does not — zero
    // occurrences of process.exit or process.exitCode in 78 lines, its shots
    // run unconditionally, and only a `fleet` block is gated at all. Sending
    // somebody a fix for a non-problem costs them a round, and my rate of
    // misleading probes is about one in six, so the check that FINDS the
    // offenders has to be the one that filters them too.
    return /process\.exit(Code)?\b/.test(src);
  })
  .sort();

console.log(`\n  ${suspects.length} scripts dispatch on a mode word:\n`);

// A mode nothing could plausibly dispatch on. Leading dashes are the point —
// it is the exact typo that found this, and it must not be silently ignored.
const BOGUS = '--no-such-mode';
let bad = 0, unknown = 0;

for (const f of suspects) {
  let code, out = '';
  try {
    execFileSync(process.execPath, [dir + f, BOGUS], {
      timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    code = 0;
  } catch (e) {
    code = e.status ?? (e.killed ? 'TIMEOUT' : '?');
    out = String(e.stderr ?? '');
  }
  // Nonzero is the requirement. 2 is the convention lib/modes.mjs uses — "you
  // asked me wrong" as distinct from 1, "the world is wrong" — but a script
  // that refuses some other way still refuses, and this is not the file to
  // enforce a style on scripts other people own.
  const names = out.includes('unknown mode');
  if (code === 0) {
    console.log(`  FAIL ${f.padEnd(22)} exit 0 on ${BOGUS} — it can pass having checked nothing`);
    bad++;
  } else if (code === 3) {
    // GOTCHAS 32: exit 3 means the check NEVER RAN — reportWorld refused a
    // stale or foreign build. That is not a script refusing a bad mode, and
    // counting it as one is a false NEGATIVE that hides a real offender behind
    // a stale dist/. It bit immediately: lamplight.mjs exited 0 on the first
    // run of this check and 3 on the next, having changed not at all, because
    // HEAD had moved underneath it.
    console.log(`  ??   ${f.padEnd(22)} exit 3 — never ran (stale build?). Cannot tell.`);
    unknown++;
  } else if (code === 'TIMEOUT') {
    // Reaching a browser at all means the guard is missing or too late: the
    // mode must be rejected BEFORE anything expensive happens.
    console.log(`  FAIL ${f.padEnd(22)} ran until it timed out — the mode is checked too late`);
    bad++;
  } else {
    console.log(`  OK   ${f.padEnd(22)} exit ${code}${names ? '' : '  (refused, but does not say the mode is unknown)'}`);
  }
}

if (unknown) {
  console.log(`\n  ${unknown} script${unknown > 1 ? 's' : ''} never ran, so this check could not do its job.`);
  console.log(`  Rebuild and re-run:  npm run build`);
  process.exit(1);
}
if (bad) {
  console.log(`\n  ${bad} script${bad > 1 ? 's' : ''} can exit 0 having asserted nothing.`);
  console.log(`  Fix: import { modes } from './lib/modes.mjs' and list the modes it dispatches on.`);
  process.exit(1);
}
console.log(`\n  no check in this suite can pass by doing nothing (${suspects.length} scripts)\n`);
