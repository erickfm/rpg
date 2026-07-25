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

## The 55 interior-gated spots: I could not verify them, and here is exactly why

`spots-walk.mjs` verifies 80 of the world's 135 `[E]` spots from the street and
names `scripts/interiors-walk.mjs` as the tool that exercises the other **55** —
seats you are not sitting on, and interior way-outs, all gated by `ok()` from
outside. I tried to run it and could not.

**Three things went wrong, and two of them were mine:**

1. **`health.mjs` failed on `page.goto: url expected string, got undefined`.**
   My fault — it reads a URL from the environment and I gave it none.
2. **`interiors-walk.mjs` defaults to port 4185, not 4184.** I ran it against my
   usual preview port, got *"Execution context was destroyed"* and then
   *"Cannot read properties of undefined (reading 'pos')"*, and briefly believed
   the world was crashing. It was not: a 12-second watch showed `__ct` present
   throughout with **no page errors**. I was pointing it at a port with nothing
   on it.
3. **It needs a `vite dev` server, not `vite preview`.** It dynamically imports
   `http://…/src/proto/ct/doors.ts` — TypeScript *source*, which only the dev
   server serves. Every other instrument in this audit runs against the built
   bundle.

With a dev server on 4185 it starts correctly and then **runs for over nine
minutes without finishing** — terminated twice at 300 s and 560 s. It may simply
be that slow (it enters every room); I did not see it hang and I am not calling
it hung.

### What that means for the record

**Those 55 spots are unverified by me.** Not suspect — unverified. I am not
carrying them as a finding and I am not implying anything is wrong with them.

### The bit worth keeping

I nearly reported *"an existing instrument is broken"* on the strength of two
crashes that were my own invocation. The check that stopped me was twelve
seconds of watching `__ct` in a plain page — the same move that has caught every
other error I made this session: **before blaming the thing you are measuring,
measure the thing you are measuring with.**

Practical note for whoever owns the toolchain: the tool covering **40% of the
world's `[E]` spots** is the only one needing a different server from every
other, defaults to a port nothing else uses, and takes longer than nine minutes.
Any of those alone is fine; together they mean it is the instrument least likely
to be run.

### Correction: the unverified set is **18 spots, not 55** — and most are covered elsewhere

I recorded the interior-gated spots as an unverified block. Splitting the
registry properly (`scripts/spotsplit.mjs`) shrinks it a long way:

```
135 spots · 57 seats registered
   live from the street (ok === true):    25
   gated (ok === false):                 110
      of the gated, seat spots:           92   ← seats-walk passes 57/57
      gated, NOT a seat:                  18
```

**92 of the 110 are seat spots.** A seat is *two* ordinary spots — one to sit,
one to stand (`crosstown.ts:157`) — so 57 seats account for most of the gated
registry, and `seats-walk.mjs` already passes every one of them.

The 18 that remain decompose further:

| what | count | covered? |
|---|---|---|
| `take a booth seat` (diner) | 5 | **seats, my label regex missed them** — `seats-walk` covers these too |
| `out to the street` (interior way-outs) | ~5 | what `interiors-walk.mjs` exists for |
| `buy cereal` / `buy soda` (bodega counter) | 2 | not covered by anything I ran |
| `close the door` / `out to the street` (apartment) | 2 | **verified independently** by `door301.mjs` |

> So the genuine gap is roughly **five interior way-outs and two shop counters**
> — not 55 spots, and not an undifferentiated block.

**My first split was also wrong** and I nearly published it: matching seats by
proximity returned **0 of 110**, because `__ct.seats()` does not expose `x`/`z`
at top level. The list printed *"stand up"* spots at bench coordinates and called
them non-seats. Classifying by the label the player actually reads fixed it —
and the label was visible in my own output the whole time.

That is the third time this session that the correct answer was already on my
screen in a column I had not read properly.

## `seats-walk`'s one false negative: four causes ruled out, not reproducible

`seats-walk` fails seat 1/57 — *"no 'sit on the bench' prompt from the one
standable point (−8.6, −19.43); got null"*. I retracted the finding because the
bench demonstrably works. Chasing the cause so its owner does not repeat my
four dead ends:

| hypothesis | test | result |
|---|---|---|
| **`gy = 0`** — line 91 warps with ground 0, and the courtyard is raised | same point at gy 0, 0.14, 0.3, 0.42 | **disproved.** Prompt fires at all four; `pos()` reports gy 0.14 regardless, so the world snaps to real ground |
| **the prompt reader** — `#ct-prompt` vs my text search | read `#ct-prompt` exactly as it does | **disproved.** Returns `[E] sit on the bench` |
| **world not ready** — it is seat *1 of 57*, tested 300 ms after load | fresh page at 300 / 800 / 1500 / 3000 ms | **disproved.** 137 spots registered and the prompt fires at 300 ms |
| **`__ct.stand` missing** — line 83 would be a silent no-op | `typeof window.__ct.stand` | **disproved.** It is a function |

**The failure does not reproduce by any means I can construct.** The prompt fires
from that point under every condition I tried, including the tool's own reader,
its own timing and its own warp arguments.

What is left, and I am not able to test it from outside: something in
`seats-walk`'s accumulated state by the time it reaches that seat — its
`standableNear` returning a point I am not reproducing, or a residue of the
`press`/`hold` key sequence. **That is inside the tool and belongs to whoever
owns it.**

### Two affordances I did not know existed

`__ct` also exposes **`groundAt`** and **`seated`**. `groundAt` would have saved
me the entire gy hypothesis, and probably some of my earlier floor work. Full
list, for anyone else writing a probe:

```
atlases bus busInfo camY clock colliders corridor doors drive gapRule groundAt
hermit modules netRoute people person pos rooms scene seated seats spots stand
traffic views walkers warp yaw
```

I built a ground-height probe by warping and reading `pos()[3]` when `groundAt`
was sitting there the whole time — the same lesson as `spots-walk` and
`seats-walk` already existing: **read the debug surface before writing against
it.**

## Migrated to `scripts/lib/faces.mjs` — the numbers did not move, which is the point

`lib/faces.mjs` landed, and its header names the two scripts its absence broke:

> *"This existed independently in four scripts and was **WRONG IN TWO** of them
> … `masonry.mjs` 42 "off-density" faces, `seampairs.mjs` 135 "disagreeing"
> junctions."*

Both of those were mine. `masonry.mjs` had already been migrated by mainline;
I migrated **`seamreal.mjs`**, the last of mine still carrying its own copy.

**Re-run after migration:**

```
masonry    236 stamps checkable · 0 disagree with their face
seamreal   735 real junctions · 376 agree · 359 disagree
```

**Identical to the pre-migration numbers.** A refactor that changes a result is
a bug report, not a refactor — so the fact that nothing moved is the evidence
the migration was correct.

### Two self-inflicted errors on the way, both caught immediately

1. My migration script added a **second** `import { reportWorld }` to a file
   that already had one — `SyntaxError: Identifier 'reportWorld' has already
   been declared`. Careless editing, fixed by deduping imports.
2. `which-world.mjs` refused to run at all: *"MEASURING THE WRONG WORLD — served
   `c5566b8d+`, this checkout is at `deaeba2f`."* I had rebased and not rebuilt.
   **That is the second time in three rounds the guard has caught me**, and both
   times it was right.

> A guard that has stopped me twice in an hour is not an inconvenience. Without
> it, both runs would have produced confident, plausible, wrong numbers — and I
> would have published them, because I have published exactly that three times
> this session.
