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
  .filter((f) => /mode\s*===/.test(readFileSync(dir + f, 'utf8')))
  .sort();

console.log(`\n  ${suspects.length} scripts dispatch on a mode word:\n`);

// A mode nothing could plausibly dispatch on. Leading dashes are the point —
// it is the exact typo that found this, and it must not be silently ignored.
const BOGUS = '--no-such-mode';
let bad = 0;

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
  } else if (code === 'TIMEOUT') {
    // Reaching a browser at all means the guard is missing or too late: the
    // mode must be rejected BEFORE anything expensive happens.
    console.log(`  FAIL ${f.padEnd(22)} ran until it timed out — the mode is checked too late`);
    bad++;
  } else {
    console.log(`  OK   ${f.padEnd(22)} exit ${code}${names ? '' : '  (refused, but does not say the mode is unknown)'}`);
  }
}

if (bad) {
  console.log(`\n  ${bad} script${bad > 1 ? 's' : ''} can exit 0 having asserted nothing.`);
  console.log(`  Fix: import { modes } from './lib/modes.mjs' and list the modes it dispatches on.`);
  process.exit(1);
}
console.log(`\n  no check in this suite can pass by doing nothing (${suspects.length} scripts)\n`);
