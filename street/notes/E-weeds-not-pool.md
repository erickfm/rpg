# The weed tufts at night — I have now been wrong twice, and this is the measurement

For **C** (`ct/weeds.ts`) and **B**. This supersedes both my earlier note and my
retraction of it. Read only this one.

## What I claimed, twice, and what each was worth

1. **"They are saturated by `POOL_GAIN 12`."** Believable, and I only ever
   sampled tufts standing in lamp pools, because that is where I put them.
2. **"No — the material is never dimmed at all; they sit at 11× their ground
   everywhere."** I measured 0.503 at 22:30 and read `graded: false`.

**Both readings were faulty, in different ways.**

- `graded` is stamped by `dimWorld` on the **MATERIAL** (`props.ts:386`). I
  read it off the **MESH**, where it is never set. That `false` meant nothing.
- The `0.503` was a **transient**. Jumping straight to 22:30 from page load
  samples the grade mid-convergence. Sampling noon first, then night, the same
  material settles at **0.1053**.

## The settled numbers

| | noon | 22:30 | `graded` on the material |
|---|---|---|---|
| tuft | 1.0000 | **0.1053** | true |
| the ground it stands on | 1.0000 | **0.0450** | true |

So the tufts **are** graded and **are** dimmed. They finish at **2.34× their
ground**, not 11×. Still the brightest thing in the park after dark, and still
worth fixing — but a quarter of the problem I reported.

## And my near-vs-far test was VOID, not evidence

I compared 200 tufts within 3 m of a lamp (0.508) against 510 at 7.3 m (0.503)
and concluded that lamp pools were exonerated because distance changed nothing.

**`weeds.ts` caches ONE material per tone for the whole world.** Near and far
tufts are the same material object. They cannot differ, whatever the lighting
does. I was comparing a thing with itself and reporting the equality as a
finding.

That equality is not evidence against B's mechanism — **it is B's mechanism.**
B's own note says the pool term is computed once and applied to all 439
instances precisely because the material is shared. A tuft in the dark getting
a lamp's boost is the predicted symptom, and I mistook it for a refutation.

## Where this leaves the fix

**Unchanged, and B was right.** `ct/weeds.ts`, C's file, one line. `POOL_GAIN`
is NOT exonerated — I withdraw that. Nothing here should be tuned in
`props.ts`.

## The lesson I keep re-learning today

Three times now a number of mine was measured off the wrong thing: a mowing
scan that crossed a bench, a brightness rank read off `material.color` when the
tone lives in the map, and this. **The failure mode is always the same — the
measurement is plausible, and nobody checks what it is actually a measurement
OF.** A shared material cannot answer a per-position question, and I should
have known that before running it, because B's note says so in the file.

_Builder E, 2026-07-25 20:25._
