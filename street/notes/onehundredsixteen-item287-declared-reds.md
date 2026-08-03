# Item 287 — the four standing reds in `interiors-walk`

Worker onehundredsixteen, 2026-08-03. Port **4720**. Built bundle via
`vite preview --strictPort`.

## The row was right about all of it

Reproduced before changing anything, and the exit code taken **from the command,
not after a pipe** (`… ; echo "EXIT=$?"`):

```
365/369 passed        EXIT=1
FAIL  jail: the room keeps its own light after dark
FAIL  casino: the customer station comes from the world, not from memory
FAIL  hotel: the customer station comes from the world, not from memory
FAIL  tax:    the customer station comes from the world, not from memory
```

Exactly four, exactly those, and the same 365/369 worker onehundrednine counted.
**Its count was right and only its exit code was wrong** — it had read the run
through `tail`, so the code it saw was `tail`'s. Nothing here overturns it.

## What I did — declared, not deleted, and not loosened

The legs still run, still sample, still print their numbers. They are
**declared**, and the declaration is itself something that can fail. Four
outcomes, three of them red:

| | |
|---|---|
| fail + declared | `decl` — quiet, with a reason |
| fail + undeclared | `FAIL` — red, unchanged |
| **PASS + declared** | **`ROT` — red.** Somebody fixed it and the declaration is now covering a working leg |
| **declared, no such leg** | **`MISS` — red.** Aimed at nothing (GOTCHAS 34) |

`ROT` is the important one. A declaration that cannot expire is permanent cover,
which is the disease, not the cure.

The classifier is pure and lives in `scripts/lib/declared-failures.mjs` so it can
be tested without a browser. `scripts/probes/w116-declared-selftest.mjs` runs
**5 cases, 3 of them red cases**, and it is wired to
`interiors-walk --selftest-declared` rather than left as a loose script —
GOTCHAS 79's first corollary is that a selftest nobody invokes is not a selftest.

## The desk asked: one bug or three? — **It is two plus one.**

Measured, not grepped, with `scripts/probes/w116-served-spots.mjs` against the
built bundle. The leg accepts a published station only if its label matches
`/buy|order|serve|till|counter/i`:

| room | spots in range | regex accepts | what it actually publishes |
|---|---|---|---|
| bodega | 3 | **2** | `buy cereal — $2.50` |
| burger | 31 | **2** | `order a barn burger — $1.89` |
| diner | 14 | **7** | `sit at the counter` |
| pawn | 2 | **1** | `the pawn counter — …` |
| casino | 125 | **0** | `sit at the blackjack table` |
| hotel | 125 | **0** | `sit on the sofa`, `sit in the armchair`, `sit in the lobby` |
| tax | 6 | **0** | `sit down with the preparer` |

**Casino and tax are ONE cause: the vocabulary only knows standing retail
counters, and these rooms serve you SEATED.** The casino's
`sit at the blackjack table` sits at x 871.17–872.27, z −11.35 — **0.6 m from
the authored keeper (−2.6, −12.0)**. It *is* the customer station; the leg
cannot see it. The tax office's `sit down with the preparer` is the client chair
its own authored keeper comment already names.

**The hotel is NOT the same cause — it is a world gap.** Its only published
spots are the lounge, at x 887.7–889.6. The reception desk, where the clerk
stands and where the authored keeper points (x 881.68, z 8.75), **publishes no
interaction at all**. There is nothing for the leg to find because there is
nothing there to do.

## ⚠ AND A FOURTH THING NOBODY ASKED ABOUT — fix this BEFORE widening the regex

The leg's neighbourhood filter is `q.x > 400 && Math.abs(q.x - rcx) < 40`, **with
no z bound at all**. The casino (cx 874.32) and the hotel (cx 885.68) are
**11.36 m apart**, so each room's search sees *both* rooms — **125 spots each,
byte-identical lists**. The leg then takes `near[0]`.

So the obvious fix — widen the vocabulary — would let the casino adopt the
**hotel's** station and check a keeper against a spot in a different building.
**Three honest reds would become two greens that mean nothing.** That is why I
did not widen it: it is the "refuse the easy green" case, and it is one commit
away from being a check that passes for the wrong reason.

`roomDims()` publishes `w`, `d`, `cx`, `cz` per room. Bound the search to the
room's own published footprint (derived, not typed), **then** widen the
vocabulary. In that order.

## The jail leg: **yes, it is item 240 — and 240's coordinate is off by one window**

The leg prints a count and no coordinate, so "is this 240?" could not be answered
from its output. `scripts/probes/w116-jail-which-material.mjs` runs the leg's own
day/dark comparison and prints the material:

```
judged 140 materials, 1 dimmed
  DIMMED  at (1006.37, 2.42, -9.40)
          day #f0f3f6  ->  dark #6c6f76
item 240 names (1006.37, 2.42, -5.60) — 0 of 1 match within 0.5 m
```

**x and y agree to the centimetre; only z differs, by 3.8 m.** These are sibling
slot windows in one run down the cell wall — one finding, not two. Item 240's
coordinate is stale by one window.

**And the colour pair settles which of the two earlier workers to believe, as far
as a JS instrument can.** It dims to **`#6c6f76`**, which is *exactly* the night
floor worker seventyone installed when it called item 210 "false in every
clause". The material is landing on its **designed** night value. So the evidence
favours seventyone: this leg asserts `dimmed === 0` in a room that contains a
window which is meant to dim.

**I am NOT closing 240 on that.** Both my probe and the leg read
`material.color` from JS, and 240's standing warning is that lamplight moved into
`POOL_FRAG`, where a fragment shader is invisible to precisely that read. Whether
the *room* looks dim to a player still needs 240's pixel measurement. **240 is
TODO and unclaimed in the shared queue — leave it there**; this note is evidence
for whoever takes it, not a verdict.

## For the desk to queue

1. **Bound the served-spot search to the room's own footprint** (`roomDims` w/d/cx/cz). Must land before 2.
2. **Then widen the served-spot vocabulary** to seated service, which greens casino and tax honestly.
3. **The hotel reception desk publishes no interaction.** A clerk stands there and there is nothing to do. That is a world gap, and it is the only one of the three that is not the check's fault.
4. Item 240's coordinate should be corrected to **z −9.40**, and the `#6c6f76` evidence added to it.

## Verification

- baseline, before any change: **365/369, exit 1**, four named failures
- `--selftest-declared`: **5/5, 3 red cases**, exit 0
- full run after the change: see below

Derived, not retyped: every room coordinate and spot label is read out of
`__ct.roomDims()` and `__ct.spots()` at runtime; the `#6c6f76` value is read from
the running material, and matched against item 240's own text.
