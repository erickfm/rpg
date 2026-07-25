// A check must not be able to pass by doing nothing.
//
// ── how this was found ──
//
// I mistyped my own script. `node scripts/bus.mjs --walk` — the flag form,
// which most of this suite takes — instead of the bare `walk` it wants. It ran
// for one second, printed "no page errors", and EXITED 0.
//
// Not one branch had run. The mode dispatch is a chain of
//
//     if (mode === 'walk' || mode === 'all') { ...the entire check... }
//
// and an unrecognised mode simply matches none of them, falls off the end of
// the file, and reaches the exit with nothing failed — because nothing was ever
// asked. checks.mjs would have printed a green row for a bus stop it never
// looked at, and the row would have looked exactly like a real pass.
//
// Then I checked the rest of my shelf. FIVE of my checks did it:
//
//     bus --probe      exit 0        trash --probe    exit 0
//     glow --probe     exit 0        wetness --probe  exit 0
//     basin --probe    exit 0
//
// ── why it is worth a shared file ──
//
// This is GOTCHAS 27 — "a check never watched fail" — in its quietest form.
// The usual version is a check whose assertion is too loose to catch the bug.
// This one is worse: the assertion is fine, and never executes. Every guard I
// have written about proving a check CAN go red was aimed at the mutation, and
// a mutation harness cannot see this at all, because canfail invokes each check
// with the same correct arguments checks.mjs does. The hole is only reachable
// by hand, which is exactly when nobody is watching the exit code.
//
// The pattern is not mine alone — any script with a mode word has it — so this
// lives in lib/ rather than being copy-pasted five times.
//
//   import { modes } from './lib/modes.mjs';
//   const mode = modes('bus', ['shots', 'walk', 'bench', 'stop', 'all']);
//
// Exits 2 (not 1) on a bad mode: 1 is "the world is wrong", 2 is "you asked me
// wrong", and a runner that retries failures should not retry a typo.

/**
 * Read argv[2] as a mode word, or refuse.
 *
 * @param script  name for the error message, e.g. 'bus'
 * @param known   every mode the script actually dispatches on. Include the
 *                default. Keep it in sync with the `if (mode === ...)` chain —
 *                a mode listed here but not dispatched is the same silent pass
 *                wearing a different hat.
 * @param dflt    mode when argv[2] is absent; defaults to the last of `known`,
 *                which is 'all' in every current caller.
 */
export function modes(script, known, dflt = known[known.length - 1]) {
  const m = process.argv[2] ?? dflt;
  if (known.includes(m)) return m;
  console.error(`${script}: unknown mode ${JSON.stringify(m)}`);
  console.error(`  modes are: ${known.join(' ')}   (bare words, no leading --)`);
  console.error(`  refusing to exit 0 having checked nothing.`);
  process.exit(2);
}
