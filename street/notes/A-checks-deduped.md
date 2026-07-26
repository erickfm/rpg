# Registering my five checks found three of them were duplicates

Follow-on from `notes/A-four-fronts.md`. The queue's own items were all closed
and verified, so the next real thing was a debt I had made myself: five checks
shipped over this session, each with *"not registered in checks.mjs and no
selftest"* in its commit message. That is an honest label, not a discharge —
GOTCHAS 24 is that a check nobody runs does not go red, it stops being run.

## What registering them turned up

**Three of the five were already checked in this suite, and better.** I had
appended to the bottom of the `CHECKS` table without reading the middle of it.

| mine | incumbent | why the incumbent wins |
|---|---|---|
| `A-door-mirrors` | `mirror-walk` | WALKS the user's own test — stand inside, go out, turn round — over all five declared rooms. Mine compared geometry and needed a hand-calibrated sign to do it. |
| `A-diner-door-aligns` | `frontage-honours` | *"5 declared doors, every one honoured by the facade."* Mine was the diner alone. |
| `A-shopfronts-backed` | `check-seethrough` | repaints all 1621 ground surfaces magenta and looks for it through 16 shopfronts **plus the bodega bay**. An actual see-through test; mine only asserted an opaque plane exists. `shop-interior` additionally guards "dark but never black". |

All four incumbents were run and were green before I deleted anything, so this
is measured rather than assumed.

Two checks for one claim is the same defect this project keeps fixing one layer
down — the auditor's *"the fault is not that something computes it badly, it is
that two things compute it at all"*. GOTCHAS 24 says do not "improve" a script
that is already there; **the corollary is to check whether the CLAIM is taken
before registering a second answer to it**, and I did not.

The three are deleted, their canfail cases with them — a mutation kept for a
deleted check goes green forever against a file that is not there.

## The two that survive, and why

- **`A-tree-canopy-opaque`** — `tree-crown` overlaps but samples a **box at the
  crown's centre** (x within ±8, y 22…30). It cannot see the lower tufts at
  y 45–60, nor a pocket sealed at the rim. That is exactly where the 303 holes
  were, *after* the rim fix `tree-crown` was written to guard. Mine floods from
  the border, so "hole" is topology rather than a sampled box.
- **`A-diner-block-vs-sky`** — nothing else makes this claim.

Both catch their mutation (`tree-holes`, `diner-block-glare`).

## One mutation slept, and that is the useful part

My first case for the door check replaced `doorAlongU(nm, wM, F.doorCentreM)`
with `F.doorCentreM`, reasoning it would drop the painter back to its own
layout. **It slept.** `frontageOf` already overwrites `doorCentreM` with the
room's declaration before the painter sees it, so the two expressions are the
same number: the check was fine and my mutation broke nothing, while reporting
the reassuring green I would most have believed.

GOTCHAS 27 verbatim — *"a mutation that does not actually break the thing proves
nothing, and looks exactly like a check that works."* The replacement offsets
the door by 1.5 m, which no resolution order can absorb. (That case is gone now
with its check, but the lesson is why this paragraph exists.)

## GOTCHAS.md was 43 entries numbered 1…37

Found by running the full fast tier. The only red, not mine, and old enough to
be furniture — a check that stays red teaches people to ignore the suite.

A second run of 24–28 and a second 37 sat at the foot of the file. **Which of
each pair moved was decided by COMMIT TIME**, because the rule the file states
three times is that the later commit renumbers:

```
tail 24-28   1785019055 .. 1785025469   ->  38-42
main 24-28   1784975855 .. 1784986835   ->  unchanged
37 @1023     1785030023                 ->  43
37 @842      1785029165                 ->  unchanged
```

Nothing changes meaning: those numbers already resolved to the main-sequence
entries for every reader, so a citation aimed at the moved content was broken
before this and is merely findable now.

`§36 after §37` was then **not** a renumber — §36 landed earlier, so 36 is
correctly the lower number and only the blocks were out of order. Swapping the
text was right; renumbering a heavily cited entry to fix a formatting problem
would not have been.

`gotchas-numbers` is green and its `--selftest` still catches a planted
duplicate, so the check was not loosened to make this pass.

## Suite state, honestly

`npm run checks` on the final tree: **25 checks reached, 0 red**, including
`check-seethrough`, `mirror-walk`, `frontage-honours`, `tree-crown`,
`shop-interior`, `checks-registered` and `gotchas-numbers`.

**It did not finish.** `D-walk` wedges and the runner's 180 s per-check timeout
does not fire on it — it sat there for well over ten minutes across repeated
polls. That is not mine and I have not touched it, but somebody should know:
a check that hangs past its own timeout stops the suite behind it, so
everything after `D-walk` in the table is currently unreachable in a default
run. Worth a look by whoever owns it.

Two earlier full-suite attempts were discarded rather than reported, because I
edited `checks.mjs` and `src/` while they ran — a verdict from a world that
changed underneath it is not a verdict. Same reason `interiors-walk` kept dying
earlier: HMR reloading the page mid-walk.

`checks-registered` is down to one stray, `globorder.mjs`, which is not mine.
