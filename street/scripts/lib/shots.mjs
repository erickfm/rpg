// `shots/` EXISTS BEFORE ANYTHING WRITES INTO IT. Item 191.
//
// THE BUG THIS ENDS. `shots/` is gitignored, so a **fresh worktree does not
// have one**. A check that does `writeFileSync('shots/x.json', …)` then throws
// ENOENT — and in every case measured, it throws **after the descriptive output
// has already printed and before the exit code is decided**. The new builder
// sees a correct-looking run followed by a stack trace and no way to tell which
// to believe. Every new builder paid this on its first run, which is the worst
// possible moment.
//
// ⚠ CREATE THE DIRECTORY, DO NOT CATCH THE ERROR. A check that swallows a write
// failure is how a suite goes quietly blind, and this project has a whole
// family of guards that "slept". `mkdirSync(recursive: true)` is idempotent and
// silent when the directory is already there, so the correct behaviour costs
// nothing and a genuinely un-writable disk still throws.
//
// ⚠ AND `page.screenshot({ path })` NEVER NEEDED THIS. Playwright creates parent
// directories itself — measured, not assumed: with `shots/` deleted,
// `scripts/trash.mjs` (fifteen screenshots into `shots/`) exits 0 with no
// ENOENT. **Only node's own `fs` writes are at risk.** That is exactly why
// `ghosts.mjs` died on its FINAL `writeFileSync` and never on any of the shots
// before it, and it is the difference between a real population of 55 and a
// scare figure of 279. Do not "fix" screenshot-only scripts; there is nothing
// wrong with them.
import { mkdirSync } from 'node:fs';

export const SHOTS = 'shots';

/** Make sure `shots/` is there, and hand back the path so a caller can build on
 *  it instead of retyping the literal. Idempotent; safe to call every run. */
export function ensureShots() {
  mkdirSync(SHOTS, { recursive: true });
  return SHOTS;
}
