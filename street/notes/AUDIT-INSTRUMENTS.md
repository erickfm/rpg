# The audit's instruments — which ones you can trust cold

Twenty-odd probes under `scripts/` came out of this audit. Some find their own
subjects and can be re-run against any future world; some carry constants
harvested from a run and **will go stale exactly the way every stale coordinate
in this project has gone stale**. That distinction is not visible from the
filename, so here it is.

Written because I left `masonry.mjs` executable with a known bug for six rounds
after retracting the finding it produced. **A retraction in a report does not
repair a script**, and a note about a script does not either — but it at least
tells the next person which ones to re-derive first.

## Self-locating — safe to run cold

These find their subjects from the scene, the collider array, or by walking. No
coordinate in them can rot.

| script | how it finds things |
|---|---|
| `doorsweep.mjs` | walks the pavement and records where `[E]` fires. **Never been wrong** |
| `masonry.mjs` | every texture carrying `userData.masonry`, face indexed per material |
| `seampairs.mjs` · `seamreal.mjs` · `pairclip.mjs` · `pairfix.mjs` | scene-wide face pairing |
| `boxcheck.mjs` | every stamped `BoxGeometry` |
| `floats.mjs` | scene-wide component analysis |
| `whose.mjs` · `people.mjs` | by material signature (`userData.mod`, the 160×128 atlas) |
| `aim.mjs` · `seamnew.mjs` | subjects by geometric signature; cameras verified standable + line-of-sight + landed |
| `rooms.mjs` | walks the interior belt by slab arithmetic from x = 400 |
| `reach.mjs` | flood fill from wherever `__ct.pos()` says the player spawns |
| `stand.mjs` | collider-derived standability |
| `handed.mjs` | every upright mapped face in the world |

## Carries constants — **re-derive before trusting**

| script | what is baked in | how it goes wrong |
|---|---|---|
| **`turn.mjs`** | `SUBJ` includes **citizen positions** | citizens *walk*. Those coordinates were true for one frame |
| `cand.mjs` · `facing.mjs` | specific face coordinates from a density run | faces move when a building is rebuilt |
| `doorline.mjs` · `doorshot.mjs` | `PROMPTS` from a `doorsweep` run | re-run `doorsweep.mjs` and paste the new spans |
| `arch2.mjs` | three parked-car positions | the parked fleet is **drawn**, not placed |
| `pinch.mjs` | pinch locations from a `lane3` run | re-run `lane3.mjs` first |
| `church2.mjs` | a scan box | the box that found the church; the church has moved once already |
| `lane3.mjs` | `WALKS` extents `from`/`to` | derived from `FACE`/`ROAD_HALF` so the *lanes* are structural, but the run extents are hand-set and will silently truncate as the world grows |

## The rule these instruments taught, in one line

Every probe that tried to infer **what a thing is** from its shape has eventually
been wrong — the geometric masonry filter, the door-leaf filter that returned
citizens, the float detector that returned lamp bulbs, the box face measured
against the wrong edge. Every one was fixed by the world **declaring** something:
`userData.mod`, `userData.masonry`, `__frontages`, `declareDoorWorld`.

**Prefer a probe that asks over a probe that guesses.** Where you must guess,
say so in the output, and never let the guess sit in a file that outlives the
report explaining it.

---

## Two of the stale-prone scripts fixed, and one nuance I had wrong

**`turn.mjs` — fixed and it mattered.** Its hardcoded citizen positions are now
found by atlas signature at run time. Doing so surfaced five figures that *walk
away mid-measurement*, which the old version could only have reported as
somebody else's reading. It also extended the interior-keeper result from 4 rooms
to 8, all passing. Written up in `request-audit.md`.

**`arch2.mjs` — fixed, and the constants turned out to still be right.** Made
self-locating (cars found by cluster shape). It found the same three cars at
(3.79, −13.96), (−3.92, −30.04), (3.62, −48.34) — **identical to the values that
were baked in** — and the same tyre top of 0.663 m on every wheel. The wheel-arch
DONE is unaffected.

### The nuance I stated too strongly

I wrote that the parked fleet *"is **drawn**, not placed"* and implied its
coordinates would therefore rot. They had not. The draw comes off a **seeded**
stream (`ct/rng.ts`), so the same build produces the same fleet every run, and a
harvested coordinate stays valid.

What that means, precisely:

> A seeded draw is **stable within a build and fragile across builds.** Nothing
> jitters run to run — but if anything upstream consumes a different number of
> random values, every car downstream moves at once, and a script full of
> harvested coordinates fails *silently and completely* rather than gradually.

So the risk was real and the mechanism was not what I said. **Seeded is not the
same as fixed**, and "it has not moved yet" is not evidence that it will not.

Both scripts now locate their own subjects, so neither depends on the answer.

## `doorshot.mjs` made self-locating — and I broke it first by dropping one line

Rewritten to do its own prompt sweep instead of pasting spans from a `doorsweep`
run. **The first attempt was badly wrong**, and instructively so:

```
381 sample points fired a prompt; 8 distinct doors
   [E] into the THRIFT STORE   west walk   span -104 … -58.5     ← 45 m
   [E] into the THRIFT STORE   east walk   span  -19 … 10        ← on the WRONG WALK
```

The prompt element **stays in the DOM and is hidden by CSS**. Reading its text
without checking visibility returns the *last* prompt that fired, so every
sample after a real trigger inherits it. `doorsweep.mjs` walks the parent chain
testing `display` and `visibility` — I reimplemented the sweep and dropped
exactly the line that makes it correct.

> **The instrument that "has never been wrong" is never wrong for a reason.**
> Copying what it does is not the same as copying the three lines you did not
> notice it needed.

Fixed, it agrees with `doorsweep` to within a sample step:

| door | this run | `doorsweep` |
|---|---|---|
| DINER | −47.5 … −46 | −47.50 … −45.75 |
| THRIFT | −60 … −58.5 | −60.25 … −58.50 |
| A-1 TAX | −21 … −19.5 | −21.00 … −19.25 |
| No. 227 | −44.5 … −43.5 | −45.00 … −43.00 |
| PAWN | −61 … −59.5 | −61.50 … −59.50 |

**28 sample points, 7 doors.** Two centres reported `MISS — not standable`
(BURGER BARN, the bus stop) rather than shot from somewhere convenient.

### One real observation from it

**The BODEGA's prompt does not fire anywhere on the x = ±5.9 walk line.**
`doorsweep` finds it at z −96.00 … −94.75; sweeping that same z range at x = 5.9
produced nothing. Its trigger sits off the line every other door sits on.

That is consistent with two things I already found independently: the bodega is
the one shopfront with a **canted bay**, and the one with **no entry in
`__frontages`**. Three separate probes have now singled out the same shop for
being built differently. Not a defect — but if anything ever goes wrong with the
bodega, that is why no generic sweep will see it.
