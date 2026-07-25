// Refuse flags this script does not understand.
//
// GOTCHAS 34 shape one, in the form that bites scripts taking FLAGS rather than
// a bare mode word (`lib/modes.mjs` covers that case). A script written as
//
//     const SELFTEST = process.argv.includes('--selftest');
//
// silently ignores every flag it does not recognise. So `--self-test`,
// `--selftst`, or a flag that gets renamed later, runs the ORDINARY suite and
// exits 0 — reporting a selftest PASS for a selftest that never ran. Green,
// fast, and indistinguishable from the real thing on the board.
//
// G found this in two of their scripts (`7369c0c69`) after clearing them
// against the mode-word test, which was the wrong test for a flag-taking
// script. Seven of mine had it: every check I gave a `--selftest`.
//
//     import { flags } from './lib/flags.mjs';
//     const { selftest } = flags(['--selftest']);
//
// Exits 2 — not 1 — on an unknown flag, so the runner can tell "this check
// refused to run" from "this check ran and found a fault". A check that cannot
// run must never be mistaken for one that passed.
//
// Positional arguments are left alone; several scripts take a room id or a
// subject name and this has no business judging those.
export function flags(allowed, argv = process.argv.slice(2)) {
  const bad = argv.filter((a) => a.startsWith('-') && !allowed.includes(a));
  if (bad.length) {
    console.error(`unknown flag: ${bad.join(' ')}`);
    console.error(`this script takes: ${allowed.join(' ') || '(no flags)'}`);
    console.error('refusing to exit 0 having checked nothing — see GOTCHAS 34');
    process.exit(2);
  }
  const out = {};
  for (const a of allowed) out[a.replace(/^--/, '').replace(/-(.)/g, (_, c) => c.toUpperCase())] = argv.includes(a);
  return out;
}
