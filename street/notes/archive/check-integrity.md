# Checks that cannot fail

**`reach.mjs` is fixed. Seven other registered checks have the same shape, and
one of them is `health`.**

## 1. reach.mjs — fixed, and the fix is proven

Two faults, not one.

**The seed.** It flooded from `__ct.pos()`. The spawn moved to room 301
(x 198.6) — the user asked for that — which is outside this check's grid
(x −46…62), so the seed cell fell off the array, the flood reached one cell, and
the check reported *"1 of 63072 cells reachable"*.

**No verdict at all.** The script ended at `await b.close()`. There was no
`process.exit` anywhere in it: it could describe the world as entirely
unwalkable and still pass.

Fixed:

- seeds from a **street** candidate list, taking the first cell that is actually
  free, and reports which one it used;
- the denominator is now **free cells**, not grid cells — "1 of 63072" flattered
  the failure by counting the inside of every building;
- **near-zero reachability is RED** (`exit 1` under 25%);
- a probe **inside a collider** is now reported as correctly unreachable rather
  than as a failure — three of the existing probes sit inside parked cars, and
  my first pass wrongly failed them;
- an unseedable grid is **`exit 3`, "CANNOT ANSWER"**, not a pass and not a fail.

**Proven, not asserted.** `REACH_SEED=pos` reproduces the original fault:

    normal          exit 0   seeded (-6.2,-40) · 39987 of 40025 free cells (99.9%)
    REACH_SEED=pos  exit 3   CANNOT ANSWER — player at (198.6,-16.3) is off this
                             grid; 40023 of 63072 cells are free, so the world is
                             not empty — the SEED is the problem

The second line is the state the check used to report at exit 0.

## 2. The sweep: seven more, and they announce it

78 registered checks in `scripts/checks.mjs`.

- **18 have no selftest** — no one has ever watched them fail.
- **7 cannot fail at all**: no non-zero exit, no `throw`, no assertion.

| check | what it guards | failure words in its own output |
|---|---|---|
| **health** | *does the world initialise at all?* | `BROKEN` ×2 |
| **mirror-walk** | does each room's door swap sides? | `FAIL` ×2, `failed` ×3, `fails` ×9, `broken` |
| **steps-walk** | are the steps climbable? | `FAIL`, `fails` ×11, `wrong` ×2 |
| **civic-doors-walk** | do the civic doors work? | `FAIL` ×2, `failed`, `fails` ×8 |
| **unstick-walk** | can the player get unstuck? | `FAIL`, `fails` ×9 |
| **jump-walk** | does the jump work? | `FAIL`, `fails` ×7 |
| **floaters-walk** | is anything floating? | `fail`, `fails` ×2, `wrong` ×5 |

**These print the word FAIL and exit 0.** They are not silent about the fault —
they describe it clearly to a human reading the scroll-back, and report success
to anything that reads the exit code. `health` is the starkest: its question is
whether the world initialises at all, and it can say `BROKEN` and pass.

Three more — `feet-check`, `side-walk`, `crowd-walk` — have a single `throw`, so
they can fail on one path. `feet-check` is the check H cited as verification for
the legs-and-feet row; that row is independently CONFIRMED here on atlas
measurement and a walked photograph, so nothing rests on it.

## 3. What I recommend, and what I did not do

**I fixed `reach.mjs` only.** The other seven belong to the builders who wrote
them, and rewriting seven agents' verdict logic mid-flight is how a merge train
derails. This report is the routing.

The change each needs is the one `reach.mjs` just got, and it is small: collect
the failures you already print, and exit 1 if the list is non-empty. The output
does not need to change at all — only its consequence.

**Ranked by what it costs to be wrong:** `health` first (it is the check every
other check assumes), then `unstick-walk` and `jump-walk` (they guard whether the
player can move at all), then the rest.

## 4. The general shape, since it has now appeared nine times

A check that prints a catastrophe and exits 0 is worse than no check, because the
suite's green becomes evidence. This audit has now met that shape in:
`reach.mjs`; the seven above; my own litter census reporting "0 inside a
collider" over an **empty set**; my doors sweep before it had a positive control;
and my crossing sample reporting "no jam" over 90 s in which **nobody crossed**.

*The question that separates a check from a description: **what would have to be
true in the world for this to print red, and has anyone seen it do so?*** Where
the answer to the second half is no, the check is a description wearing a
verdict's clothes.
