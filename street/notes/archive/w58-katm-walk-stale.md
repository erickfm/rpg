# w58 — item 149: `K-atm-walk.mjs` stale against TAKE CARD

Port **4192**, verified on the **built bundle**.

## The row was half right, and the wrong half was the headline

**TRUE:** `K-atm-walk.mjs:157` expected the ATM to show a `thanks` screen after
TAKE CARD. Commit `1ab300666` — the desk's own one-line change, on the user's
*"take card from atm should immediately get us out of the menu"* — made that row
close the panel outright and reset `screen` to `idle`. The screen no longer
exists, so the check had been failing honestly ever since.

**FALSE, AND IT IS THE ROW'S HEADLINE:** *"The check now prints `1 FAILED` and
exits **0**, making it the **eighth** member of the family found today."*

It does not. `K-atm-walk.mjs:205` is already

```js
process.exit(fails.length ? 1 : 0);
```

and a plain run against the stale expectation **measured `exit=1`** while
printing `1 FAILED`. There was no exit-code defect, and **there is no eighth
member of the exits-0 family here.** The only `process.exit(… ? 0 : …)` in the
file is the `--selftest` path, where exiting 0 *because the mutation was caught*
is the correct semantics, not a sleeping guard.

Worth saying plainly for the desk's count: **the "exits 0" family did not grow
today on the strength of this row.**

## What changed

`scripts/K-atm-walk.mjs` only. No world code.

1. **The expectation now matches the behaviour.** Two assertions replace the
   `thanks` one: the panel is closed, and `screen` is back to `idle` so the next
   player does not find the tail of somebody else's transaction. **The
   assertion was not weakened** — it went from asserting one stale fact to
   asserting two live ones.

2. **A guard that would have slept, fixed while I was in there.** The next block
   tested *"ESC closes it"* — but TAKE CARD now leaves the view **already
   closed**, so that assertion passed without ever exercising ESC. It now
   reopens the machine, asserts it is genuinely up (a CONTROL line), and only
   then presses ESC.

3. **The reopen waits out `DISMISS_LOCKOUT`.** `makePanel` refuses to reopen a
   panel within 500 ms of its dismissal (`ct/hud.ts`), which is what stops a
   caller re-opening from a frame hook the instant the player closes it. My
   first cut reopened immediately, silently got nothing, and reported the
   machine broken — the test being impatient, not the world being wrong.

## How it is proved

- **Green:** 29 OK, 0 FAIL, `exit=0` on the built bundle.
- **It can still go red — proved by breaking the world, not the check.** Reverting
  `ct/atm.ts`'s TAKE CARD row to `screen = 'thanks'` (the pre-`1ab300666`
  behaviour) makes it print **2 FAILED** and `exit=1`, naming both new
  assertions. Restored afterwards; `git status` clean apart from the check.
- **The built-in `--selftest`** (which jams the dispenser) still reports
  `SELFTEST: caught it`.
- Registered in `scripts/checks.mjs:838` with its selftest already declared —
  nothing needed there.

## Found and NOT fixed

1. **The `thanks` screen is now dead code in `ct/atm.ts`.** `Screen` still lists
   it, `rows()` has no case that reaches it, and `onKey` still carries
   `if (screen === 'thanks') { panel?.close(); return; }`. Unreachable and
   harmless. **The row says item 144 covers this — leaving it to that item**
   rather than touching `ct/atm.ts`, which item 149 does not name.

2. This is the second item in a row where **the ATM's ten screens are really
   nine**. Anything briefing "the ATM has ten screens" should say nine until
   144 lands.
