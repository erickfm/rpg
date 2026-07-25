# The audit's instruments — which ones you can trust cold

> **Before anything else: know which frame your number is in.** Three of this
> audit's wrong findings were the same mistake — comparing two quantities from
> different coordinate spaces. `parameters.width` against the face actually
> mapped; z-offsets across buildings facing opposite ways; **world-space tyre
> tops against a car-local arch line**. Each was precise, reproducible, and
> about two different things.

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

**Fifth hypothesis, tested after `098269aa` landed:** that line 83's
`__ct.stand()` before the warp leaves state behind. **Disproved** — `warp only`,
`stand() then warp`, and `warp only again` all return `[E] sit on the bench`.

**And one new fact: the failure is deterministic.** It reproduces identically on
build `cea5e99e` as it did on `6d151c74`, including after the nearest-spot fix
(`098269aa`) which was aimed squarely at seats. So it is state, not a race.

**The failure does not reproduce by any means I can construct.** The prompt fires
from that point under every condition I tried, including the tool's own reader,
its own timing and its own warp arguments.

### Sixth test: I reproduced its seat-1 sequence verbatim, and it PASSES

Rather than edit A's file I instrumented a copy (`scripts/seatdebug.mjs`) running
the identical steps on the identical seat: `seats[0]`, its own `standableNear`
ring search copied line for line, its `warp(x, z, 0, 0)`, its 140 ms wait, its
`#ct-prompt` reader.

```json
{ "label": "sit on the bench",
  "at":    { "x": -8.65, "z": -19.43 },  "r": 0.75,
  "pose":  { "x": -8.65, "z": -20.38 },
  "chosen":{ "x": -8.60, "z": -19.43, "ring": 0.05 },
  "pos":   [-8.6, 1.62, -19.43, 0.14],
  "elExists": true, "inlineDisplay": "block", "computed": "block",
  "text": "[E] sit on the bench",
  "promptAsToolReads": "[E] sit on the bench" }
```

Same seat, same chosen point (ring 0.05, the first one it tries), prompt element
`display: block`, and the tool's own read returns the prompt.

**So the fault is not in the seat-1 logic at all.** Ruled out by reproduction,
not by argument: the standability ring search, the chosen point, the warp
arguments, the settle time, and the reader all behave correctly on this seat.

Incidental, and not the cause here: `standableNear`'s `blocked()` uses
`window.__ct.colliders()` **unfiltered** — **94 of 310 colliders** are interior
belt boxes at x > 400 or otherwise out of range. They cannot affect a bench at
x −8.65, but any probe ringing near x 400+ would be testing against them.

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

## SOLVED: `seats-walk`'s seat 1 fails because it is the **first warp after page load**

Seven hypotheses in, the answer came from reproducing the tool's *execution
shape* rather than its logic. seats-walk warps in one `page.evaluate`, waits
140 ms **from Node**, then reads the prompt in a **separate** evaluate. My
earlier copy did both inside one evaluate, so the page never ran unattended
frames between them — which is exactly why it passed.

Run the real shape, straight after page load:

```
separate evaluates, 140 ms wait → pos [-8.6, 1.62, -19.43, 0   ]  prompt: null
separate evaluates, 300 ms wait → pos [-8.6, 1.62, -19.43, 0.14]  prompt: "[E] sit on the bench"
separate evaluates, 600 ms wait → pos [-8.6, 1.62, -19.43, 0.14]  prompt: "[E] sit on the bench"
```

**At 140 ms the player's ground height is still 0. By 300 ms it is 0.14.** While
`gy` is 0 the player is 14 cm below the pavement and the seat's prompt does not
fire.

And it is not `gy = 0` in the call that does it — warm the world with one
throwaway warp first and 140 ms is plenty:

```
warp(0,0,0,0) + 250 ms, then warp to the seat:
   gy=0    140 ms → gy 0.14 · "[E] sit on the bench"
   gy=0.14 140 ms → gy 0.14 · "[E] sit on the bench"
```

> **The world takes longer than 140 ms to settle ground height on the FIRST warp
> after page load, and only on the first.** Seat 1 of 57 is the only seat that
> is ever that first warp. Every later seat is already warm, which is why 56 of
> 57 pass and the failure is perfectly deterministic.

### The fix, for whoever owns `seats-walk`

Any one of these:

- wait for `__ct.pos()[3]` to **stop changing** before reading the prompt, rather
  than a fixed 140 ms — the robust version, and it removes the timing constant
- raise the post-load settle above 300 ms
- do one throwaway `warp` after load to warm the ground picker

### What it took, and what that says

Six hypotheses about *state* — gy, the reader, readiness, `__ct.stand` missing,
`stand()` before warp, the per-seat logic reproduced verbatim — all disproved,
because I kept testing what the tool **computes**. The answer was in how it
**executes**: two `page.evaluate` calls with real frames running between them,
which no in-page reproduction can show you.

**A faithful copy of the logic is not a faithful copy of the run.**

### Does the same lag affect MY scans? No — checked, not assumed.

The `seats-walk` diagnosis is a warning to every probe that warps and reads. My
step-finding scans (`steps.mjs`, `church2.mjs`, `regrade2.mjs`) read
`pos()[3]` just **two animation frames** after each warp, which is far tighter
than the 140 ms that failed. So I tested mine rather than assuming they were
fine.

**First exposure — the page-load boundary: not applicable.** All nine of my
warping scripts wait **800–900 ms** after load before their first warp, well
past the ~300 ms the ground picker needs.

**Second exposure — height transitions mid-scan:** a 2-rAF read against a
generously settled 350 ms read, warmed first, across the sharpest transitions in
the world:

```
(  -6,   -9)  2 rAF: 0.14    350 ms: 0.14    agree
(-10.5, -13)  2 rAF: 0.99    350 ms: 0.99    agree     ← top of the library flight
(-10.5, -12)  2 rAF: 0.99    350 ms: 0.99    agree
(-10.5, -14)  2 rAF: 0.99    350 ms: 0.99    agree
(  -6,   -9)  2 rAF: 0.14    350 ms: 0.14    agree     ← straight back down
(   9, -79.5) 2 rAF: 0.51    350 ms: 0.51    agree     ← church flight
( 8.75,-80.5) 2 rAF: 0.409   350 ms: 0.409   agree
(  -6,  -40)  2 rAF: 0.14    350 ms: 0.14    agree

0 of 8 disagree
```

**Once warm, two frames is enough**, even stepping 0.85 m of height in one warp.
The lag is specific to the first warp after page load and does not generalise.

**So every gy figure I published stands** — and two of them are re-confirmed here
by a script that shares no code with the ones that found them:

- the **library flight tops out at 0.99** (found: gy 0.42 → 0.99)
- the **church flight reaches 0.51** (found: gy 0.31 → 0.51)

That is the useful shape for this kind of scare: a defect found in someone
else's tool is a hypothesis about yours, and the cost of checking was one script
and four minutes.

---

# Every instrument, classified by whether its two sides share an ancestor

Three of my checks turned out to compare a number against itself. Rather than
find a fourth by accident, here is the whole set classified. **Read this before
quoting any number I produced.**

## A — Independent: two sides, no common source. These verify.

| instrument | side A | side B |
|---|---|---|
| `lane3.mjs` | `__ct.colliders()` — what movement tests | `RADIUS = 0.36`, the capsule |
| `seampairs.mjs` · `seamreal.mjs` | one face's density | **a different face's** density |
| `floats.mjs` | a mesh's position | every other mesh's extent |
| `enterall.mjs` | the label on the sign | the slab you physically land in |
| `turn.mjs` | the atlas frame shown | the heading you orbit to |
| `rooms.mjs` | one room's measurements | **the other seven rooms'** |
| `globorder.mjs` | a binding's byte offset | the glob literal's byte offset |
| `seats-walk` · `spots-walk` (A's) | a registered spot | whether a body can stand and act there |

**Everything I would defend hardest is in this table**, and the common shape is
that side B is either *another instance of the same kind of thing* or *a physical
consequence*. Neither can be derived from side A.

## B — Rule-based: measured against a stated rule, not another number. These verify.

| instrument | the rule |
|---|---|
| `masonry.mjs` (declared densities) | must be 8, 16 or 32 px/m — **196 / 39 / 1, nothing else** |
| `lane3.mjs` (thresholds) | 0.72 m capsule, 2 m lane, `GOTCHAS` §9 |
| `handed.mjs` | `dot(uDir, right) > 0` — a geometric identity |
| `rooms.mjs` (wall thickness) | the kit's own constant, 0.18 in all eight |

## C — Circular: both sides descend from one value. These verify **plumbing only**.

| instrument | the shared ancestor | still catches |
|---|---|---|
| `doorcross` · `doorpoint` | `DOOR.at` feeds the `[E]` spot **and** the roster | corruption in transit, wrong axis handling, a dropped declaration |
| `masonry.mjs` (per-face) | `(wM, hM)` sizes the canvas **and** the mesh | a texture handed to a differently-sized mesh |
| `guessdoors` | the painter reads the roster it is compared against | nothing — this one is fully circular |
| `doorside2` | interior spot and frontage both from the room's own spec | nothing I can rely on |

**A circular check is not worthless** — it proves a value survives its pipeline —
**but it can never detect that the value is wrong.** Every "N of N agree" I
reported from table C means *"the pipeline is intact"*, not *"the world is
right"*.

## The one line to keep

> **Find the common ancestor before calling agreement a verification.**

Three times I did not, and each time the number was precise, reproducible, and
about nothing. Precision is the tell: `0.00 m`, `0 of 236`, `5 of 5` — real
independent measurements are almost never that clean, and the cleanliness should
have been the warning rather than the reassurance.

## The slow check tier: I could not run it, twice

`npm run checks -- --slow` adds six walking suites (`world-wired`, `spots-walk`,
`steps-walk`, `civic-doors-walk`, `seats-walk`, `interiors-walk`). **Both my
attempts were invalidated by `which-world`:**

1. the first because **I kept committing while it ran** — HEAD moved under it,
   correctly invalidating every check
2. the second on a deliberately pinned world — **and it still reported
   `WRONG WORLD`**

**Diagnosed as far as it is worth taking.** The server was serving exactly the
build I made — `curl` returns `index-DQzpRTqf.js`, which is the newest file in
`dist/` — so it is not staleness. `which-world` compares **the SHA baked in at
build time** against **`git rev-parse HEAD` read fresh by each child check**.

That makes long runs structurally fragile in my setup: **I rebase onto mainline
at the start of every turn**, and a twelve-minute suite spans several turns. Any
rebase during the run moves HEAD out from under a build that cannot move with
it, and every remaining check fails `WRONG WORLD` — correctly.

> **A long check run needs a frozen HEAD, and "rebase every turn" is the
> opposite of a frozen HEAD.** The two are incompatible, and the guard is right
> to refuse rather than measure a world that no longer matches the checkout.

Anyone running `--slow` here should rebase, build, and then **not touch git
until it finishes** — which is a real constraint worth knowing before spending
twelve minutes twice, as I did.

### Third attempt, on a genuinely frozen HEAD: still not completed

I did it properly — rebased, built, started the run, and touched no git command
at all while it ran. **It passed ten minutes without producing a line of
output.** `interiors-walk` alone exceeded nine minutes in an earlier solo run
and did not finish then either.

So after three attempts the honest conclusion is not about my workflow:

> **The `--slow` tier is not runnable in a session that also commits.** Its
> longest member takes over nine minutes on its own, the runner emits nothing
> until every check has finished, and the world guard — correctly — invalidates
> the entire run if HEAD moves at any point during it.

Those three together mean the tier is effectively **write-only**: it exists, it
is registered, and the conditions for observing its result are hard to meet.
That is worth the toolchain owner's attention more than any individual check in
it. **Streaming each result as it completes would fix most of it** — a run that
prints `✓ spots-walk` at minute three is useful even if minute twelve never
arrives.

*(`spots-walk` and `seats-walk` I have run individually, and both pass.
`world-wired`, `steps-walk` and `civic-doors-walk` I have since run directly and
all three pass. **`interiors-walk` has now failed five times, each for a
different reason** — wrong port, preview instead of dev, HEAD moving mid-run, a
`cd` that was already applied, and another builder's dev server on 4185 — and on
the sixth attempt, on my own dev server with everything correct, it ran past the
point where holding a commit cost more than the result was worth. **I stopped
it deliberately rather than let it block work in hand.** It is the one check in
the project I have never seen complete.)*

**So my "28 green, one red" covers the FAST tier only.** The six walking suites
are unrun by me and I am not claiming anything about them. `spots-walk` and
`seats-walk` I have run individually and they pass; the other four I have not.

The first failure is worth recording as a rule: **a long check run and
concurrent commits do not mix.** The guard is doing exactly its job, and the
cost of ignoring that is a twelve-minute run producing nothing.

### The third run did complete — and the failure is precise

```
23 ✓   including frontage-honours, burger-palette, park, wetness, rain,
       basin, kerbcut, bus ×2, trash, glow, shells, footprint, windowlights
 1 ✗   doors-declared  FAILED (1)      ← a real failure
18 ✗   WRONG WORLD                     ← invalidated when I committed mid-run
```

**The six walking suites run LAST.** That is why all three attempts lost exactly
them: they are the tail of a twelve-minute run, so they are the most exposed to
any HEAD movement, and I could not hold still that long.

`doors-declared` failed **as a genuine failure, not a world mismatch** — the
casino's declared door, confirmed on a third independent run.

And `burger-palette` — *"has BURGER BARN gone back to mustard?"* — is registered
and **green**. That check did not exist when I reported the palette as verified
only by eye; it is one of the appearance guards written in response to that gap,
and it now covers a user request that had none.

> **23 green, one real red, and the one red is the defect with a complete
> write-up already attached.** The rest is my own commit, and the six suites at
> the tail remain unrun by me.

## Which of my probes filter out moving colliders — and what that qualifies

After mistaking a stopped citizen for a post, I audited my own scripts for
mover-handling. **Two detectors in a row got it wrong** before I read the files:
the first matched `waitForTimeout(1500)` anywhere and reported everything safe;
the second missed `lane3.mjs`'s idiom and reported it unsafe when it is not.
`lane3.mjs:12` — *"the list is sampled TWICE, a second apart, and anything whose
bounds moved is dropped"*.

| | scripts |
|---|---|
| **drop movers** (two snapshots compared) | `lane3`, `lanewalk`, `corridor` |
| **include movers deliberately** — that is the question they ask | `lanelive`, `reachlive`, `doorslive` |
| **single snapshot, unfiltered** | `tightest` (retracted), `stand`, `aim`, `lot`, `triggers`, `bodega`, `counters`, `wayouts`, `seamnew`, `cand`, `reach` |

### What the third row qualifies — and what it does not

**No verdict changes.** Every door fired and opened when pressed, every seat sat,
every way-out returned you to its own frontage, and `doorslive` — which
*includes* movers on purpose — found **no door ever fully blocked** across eight
samples.

**But the counts are snapshots, not properties.** When I wrote *"the BODEGA
trigger has 109 standable points"* or *"A-1 TAX's nearest edge is 0.6 m
kerb-side"*, those were single frames with whoever happened to be standing there
baked in. `doorslive` proves the size of that effect: **A-1 TAX varies 25 → 73
standable points** depending on who is nearby — a factor of three.

> **Read every standable-point count in my reports as "at that instant", not
> "always".** The rank order and the verdicts hold; the integers do not.

That is a contained caveat rather than a retraction, and it is the last thing the
stopped-citizen error touches. The lesson underneath it is the one already at the
top of this file, arriving from a new direction: **a quantity is not a
measurement until you know what was in the frame when you took it.**

## Is the 1.5 s mover window long enough? Validated, and the error has a direction

G's `19e1e9f9` validated the two-snapshot idiom on their own walk and handed the
same hole back to me: `lane3`, `lanewalk` and `corridor` all decide *"is this
furniture"* by **motion**, so a citizen who stands still across the whole window
is byte-identical in both frames and is kept as furniture. That is the exact
failure behind `3f7b2623`. `scripts/ghosts.mjs` re-runs the corridor measurement
under both windows across the **whole street**, not one band:

```
216 colliders · static by 1.5 s 210 · still static after a further 22s 210
(20 long-window samples)

GHOSTS — boxes the short window called static but which moved later: 0

  short window (what corridor.mjs uses):  0 stretches under 1.00 m · narrowest 1.12 m at east z -85.75
  long  window:                           0 stretches under 1.00 m · narrowest 1.12 m at east z -85.75
```

**Zero ghosts, and the corridor answer is identical under both windows.** As G
says of their own run, that is a property of these movers at this HEAD rather
than a guarantee about the idiom.

### The durable part: ghosts only ever narrow

The long-window static set is a **subset** of the short-window one — a ghost is
a box the long window removes. Removing a collider can only make a passage
**wider or equal**, never narrower. So:

> **A ghost can only manufacture a falsely NARROW finding. It can never produce
> a falsely clear one.**

Every wide/clear verdict I published — the 1.15 m built lane, the 1.12 m
narrowest crossing, *0 stretches under 1.00 m* — is therefore robust to this
bug **by construction**, without needing the long window at all. The single
finding the bug could have produced is a narrow one, and it did produce exactly
one: the retracted 0.77 m "post". That is not a coincidence, it is the only
shape the error can take.

**Practical rule, and the cheap fix.** Run the long window before believing any
*narrow* finding; skip it for clear ones. Better still is G's suggestion, which
I second: have the collider list carry the `userData.mod` tag that `lot`,
`walkup` and `vice` already use, so *"is this a mover"* becomes a **declaration**
rather than an inference from two frames — and this whole class of error stops
existing. That is `ct/props.ts`'s call, not mine.

## Why `interiors-walk` failed six times: it needs a DEV server, not a preview

Worth writing down plainly, because it cost six attempts and I twice blamed the
wrong thing (the port, then another builder's worktree). Against a preview server
it dies with:

```
page.evaluate: TypeError: Failed to fetch dynamically imported module:
  http://localhost:4184/src/proto/ct/doors.ts
```

**It dynamically imports raw `.ts` at runtime.** Only the dev server serves that;
`vite preview` serves the built bundle and has no `/src/…` to give. So the rule
is `npx vite --port <yours>`, never `vite preview`, for this suite. Both of my
successful runs were dev; all six failures were preview or a port I did not own.

## Re-verified after the world-coordinate migration — still 195/195

`2de9134d` moved the interiors off the painter's local offsets and onto the world
coordinates the descriptor publishes, and **deleted the fallbacks** — a change to
door and glazing positioning, which is exactly what I had certified one commit
earlier. Re-run at that HEAD: **195/195 across all eight rooms**, unchanged. The
entry/exit round trip, the landing at `gy=0.14`, the re-entry trigger, the open
landing in all three directions and the interior night lighting all still hold.

### The handedness claim, checked from outside

That commit's justification is *"side and uDir disagree on 7 of the 16
frontages"* — the reason `alongU` must be the only place the mirror is applied.
It is the load-bearing number in the patch, so `scripts/hand.mjs` checks it
against the live `__frontages`:

```
sign(facePos)                      disagrees with uDir on 6 of 16
sign(outward)   [the facade normal] disagrees with uDir on 7 of 16
    BURGER BARN, DINER, THRIFT, A-1 TAX, LIQUOR, PAWN, RADIO
```

**7 of 16 confirmed exactly** — and the probe adds something the commit message
does not say: the seven are precisely the **main-street (`axis:'z'`) frontages**,
every one of them. So the double-mirror trap would have broken *every shop on the
street proper* while leaving all nine side-street shops correct. That is the
half-working shape that is hardest to catch by looking, which is a fair argument
for the helper existing.

### The circularity caveat is unchanged

The migration does **not** lift it. All eight rooms still declare their own
`door: {…}` (`int-diner.ts:58` still reads `at: DOOR.at`), and where a room does
not, `:553` now derives the position *from* `FW.doorWorld` — so comparing an
interior door against the frontage's door still compares a number with itself.
That row stays **[C]**.

## Resolved: the two texture-hash measurements that "do not fit together"

`2e7f51c0` posted a contradiction and honourably stopped short of a conclusion:
`dither()` uses **unseeded** `Math.random()` (measured to differ across loads),
yet `fp` reports all 954 textures byte-equal across two dev loads — while 612 of
954 differ between dev and dist. It matters because CLAUDE.md rests the whole
world-neutrality guarantee on *"textures and structure must match"*.

**Both measurements are true and they do not conflict.** The override is not in
`src/proto/`, which is where it was looked for — it is in the harness, injected
from Node before the page loads:

```js
// scenedump.mjs:22-26
await page.addInitScript(() => {
  let s = 0x9e3779b9 >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
});
// "Test-harness only — the shipped world keeps its live grain."
```

So `dither()` really is unseeded in the world the user plays, **and** it is
reproducible under `fp`. Confirmed: two dev dumps, `954 textures, 0 differ`,
both hashing `951d46e3`.

### And that also explains the third measurement

The seed is **shared** with three.js, which spends four `Math.random` calls per
object on `generateUUID` — so a texture's grain depends on *how many objects were
created before it was painted*. `fpadd.mjs:21` says exactly this: *"creating ANY
object repaints the grain of every texture made after it."* Dev and dist evaluate
modules in different orders (native ESM vs the rollup bundle — the same ordering
`globorder.mjs` reports), so the draw sequence diverges and everything painted
after the divergence gets different noise.

`fpadd`'s own repaint-vs-deletion test settles it — **612 lost, 612 gained**, and
every lost texture has a same-dimension partner gained. Stripping the grain out
and comparing what actually exists:

```
_structure  grain stripped:  1070 distinct kinds, 0 unmatched
_textures   grain stripped:   253 distinct kinds, 0 unmatched
_tints      grain stripped:   345 distinct kinds, 6 unmatched
objects: identical (3489)   uniqueTextures: identical (954)
```

**Dev and dist build the identical world.** Same 3489 objects, same 954 textures,
same dimensions, same geometry. The only genuine difference is 6 tints out of
3489 — the living things, GOTCHAS §1's documented noise floor.

### What this means for the guarantee

The question was posed as a dilemma — *either the hash cannot see paint noise
and the guarantee is weak, or the dev/dist difference is a real visual
difference.* It is **neither horn**. The hash can see paint noise; the noise is
merely pinned. The guarantee is **sound**.

> **New rule, and it belongs in GOTCHAS.** `fp` hashes are comparable only
> **within one build mode**. Run `fp before` on dev and `fp after` on a preview
> and you will get ~2/3 of textures "changed" and every bit of it meaningless.
> Dev-to-dev or dist-to-dist, never across.

The tool was already right — `fpadd` size-matches repaints for precisely this
reason. The gap was in interpretation, not instrumentation.

## Current project state, measured at HEAD `506bd4d2`

The standing question the user's decision rests on. Full suite, both tiers,
against a preview of this HEAD:

```
fast tier   45 of 45 green
slow tier   53 green, 1 red
                ✗ interiors-walk   FAILED (1)
```

**The single red is the instrument, not the world.** `interiors-walk` imports raw
`.ts` at runtime, so it can only run against a dev server; the suite drives a
preview, which serves the bundle. Run against a dev server at this same HEAD it
passes **195/195 across all eight rooms** — measured, above. `af5b68cd` reached
the same conclusion independently and `57fb2010` offers F the two-line fix.

So: **every check in the project passes at this HEAD**, and the one red on the
board is a server-kind mismatch with a passing run standing behind it.

### Answering §31's open sentence: no, it cannot be caught after the fact

GOTCHAS 31 ends *"Neither the dump nor `fpdiff` records which kind of server it
read, so nothing…"*. Four dumps, two per mode, settle whether a reader could
recover it retroactively:

```
dump     source  objects  uniqTex  textures  structure  tints
devA     dev       3489      954  951d46e3  ba64acce  611e839f
devB     dev       3489      954  951d46e3  ba64acce  611e839f
distA    dist      3489      954  4afd7bb6  6caac454  e883664f
sanity   dist      3489      954  4afd7bb6  6caac454  e883664f
```

Every **scalar** field is identical across both modes; only the content hashes
differ. Telling them apart therefore needs a known-good reference from the *same
world state* — which no longer exists after the next commit. **It is not
retroactively detectable and must be stamped at capture time**, a one-line
addition to `scenedump`, whose owner should make it rather than me.

The table also confirms §31's positive half, which had not been shown: both dist
dumps are byte-identical across **separate builds and separate server restarts**,
as are both dev dumps. Same-mode comparison is genuinely stable, so the rule
works as prescribed.

### Re-confirmed six commits later, at HEAD `29ff72f4`

Mainline moved six commits — including a real visual fix (`34a3ed95`, `isGlass`
carrying three meanings) and the wrong-world exit-3 change. Fast tier re-run
there: **45 green, 0 red**.

**Correcting my own figure one commit above:** I first published *"fast tier 23
of 23"*. That was counted off a truncated `tail`, not counted. The tier is **45
checks**. All were green then and all are green now; the count was wrong, the
verdict was not.

One incidental confirmation of the fingerprint's discrimination: across those six
commits `textures` stayed **`4afd7bb6`** while `structure` moved `6caac454` →
`ae0b6301`. The `isGlass` fix changed material state, not painted pixels, and the
two hashes separated exactly that way without being asked to.

**A trap worth recording**, since it cost me two false WRONG WORLD sweeps: a
`vite preview` left running keeps serving the **bundle it started with**, and
because `--strictPort` makes the replacement exit rather than steal the port, a
rebuild-and-restart silently leaves the stale world up. Both times every check
went red at once. Free the port, *confirm it is free*, then start — and read the
served SHA back before trusting a sweep.

## Is `door301`'s missing world-check a class or a one-off? Swept: two real, and one was mine

`da53e530` found that `door301.mjs` **imports `reportWorld` and never calls it** —
so the import makes it look done at a glance while the check has always been
willing to measure whichever build was on the port. Its author notes the fix was
reverted outside their session, so the gap is live. The obvious auditor question
is whether other scripts share it.

**Imports-but-never-calls is a one-off.** Across ~210 scripts that import it,
`door301.mjs` is the only one. But the sharper question is scripts that drive a
browser and never check the world *at all*:

```
browser-driving scripts: 220
of those, never call reportWorld: 6
   check-artifact.mjs   door301.mjs   hand.mjs
   shotdiff.mjs         shotguard.mjs  twoworlds.mjs
```

Read individually, **four are entitled to skip it and two are not**:

| script | verdict |
|---|---|
| `check-artifact.mjs` | opens the **packed artifact file**, not a served build — exempt |
| `shotdiff.mjs`, `shotguard.mjs` | use chromium purely as a **PNG decoder**; never navigate to the world — exempt |
| `twoworlds.mjs` | **mine.** Its subject *is* two servers that differ; the guard would fire on a healthy run — exempt |
| `door301.mjs` | the real gap, already recorded by its owner |
| **`hand.mjs`** | **mine, written this session, with no excuse** |

So the raw count of 6 overstates it by three times: **two real gaps, and I wrote
one of them.** `hand.mjs` has the call now, and it earned its keep on the first
run — it immediately refused a server left stale by my own rebase. Re-run against
a matching world it reproduces the same 7 of 16, so the published result stands.

`twoworlds.mjs` now **declares** its exemption in a comment. That is the point
worth carrying: `door301`'s whole problem was that it *looked* checked, and an
undeclared exemption looks identical to a defect. This project's recurring lesson
one more time — **make it declare, don't leave it to the reader's inference.**

## The "never gets wet" class, enumerated: 19 flat decals still dry

Two agents found the same defect independently and days apart — `b209275c`, the
road's centre lines bone dry while the road darkened 83%; `21c42a66`, the lot's
decals dry while their tarmac went −74%. Both had one root cause: **`dimWorld`
skips transparent materials**, so anything transparent stays dry unless it hand
registers with `ctx.wet()`. A class with a mechanical signature is worth
enumerating once rather than discovering one instance at a time, so
`scripts/wetsweep.mjs` samples every material's colour at a dry hour and a wet
one and joins on material uuid.

**Two things I got wrong first, both recorded in the script so the next person
does not repeat them:**

1. **The wet look takes ~16 s to settle**, not the 2.5 s I first allowed. Measured
   on the road after `clock(14)`: `1.000 → 0.597 → 0.329 → 0.224 → 0.186 → 0.172
   → 0.167 → 0.165` at two-second intervals. Sample early and everything reads
   partly dry.
2. **A median over all materials is meaningless.** Mine came out 0.0% and I
   briefly read that as a broken instrument. Rain darkens **ground**, and ground
   is a small minority of a world made mostly of building. The control has to be
   a named wet surface, not an average.

With a real control — **317 surfaces responded**, top `vice` at 87.9%, road at
83.5%, both recent fixes visibly landed — and each candidate anchored to ground
that actually got wet beside it:

```
TRANSPARENT, UNMOVED, AND LYING ON GROUND THAT GOT WET: 24
```

They split cleanly by height, and the split decides them:

| | |
|---|---|
| **19 × `props`, y 0.01–0.16** — flat on the ground | **real candidates** |
| 5 × untagged `PlaneGeometry`, **y 0.71**, all 1.15 m tall on the x = ±7 facade line | vertical shopfront panels; a wall is entitled not to look like wet tarmac |

The 19, so an owner can find them without re-running anything:

```
0.34×2.80  at (-4.8, 0.02, -103.6)     0.34×3.10  at ( 4.8, 0.02, -91)
5.60×5.60  at (-4.1, 0.02, -37)        5.60×5.60  at ( 4.1, 0.02, -51)
5.60×5.60  at ( 4.1, 0.02, -93)        5.60×5.60  at (20,   0.02, -98.9)
4.40×4.40  at (-22.2, 0.16, -70.7)     4.40×4.40  at ( -9.5, 0.16, -73)
4.40×4.40  at (-34.8, 0.16, -73)       4.40×4.40  at ( -9.5, 0.16, -93)
4.40×4.40  at (-34.8, 0.16, -93)       4.40×4.40  at (-22.2, 0.16, -95.3)
0.42×0.42  at (-11.6, 0.01, -39.6)     0.42×0.42  at (-11,   0.01, -40.4)
0.73×0.55  at (-10.6, 0.01, -41.5)     0.42×0.33  at (-12.6, 0.01, -42)
0.75×0.37  at ( -9.4, 0.01, -42.6)     0.73×0.55  at (  6.5, 0.14, -26.5)
0.42×0.33  at (  6.7, 0.14, -76.3)
```

The two long thin strips sit at **x ±4.8**, the kerb edge rather than the centre
line `b209275c` already fixed — so they are a different set, not that fix failing
to land. The four 5.60 squares lie on the road deck; the six 4.40 squares sit at
kerb height through the park.

**These are candidates, not verdicts.** I have not established that each is meant
to darken — something under an awning, or self-lit, is entitled to stay dry, and
that judgement belongs to whoever owns `ct/props.ts`. What the sweep establishes
is that **nobody now has to go looking**: the class is 19 items long, they are all
tagged `props`, and the list took one command.

**Re-run after `a768f333`** — which found `registerWet` had been published from
`buildProps` at `crosstown.ts:210` while its build-time callers run at `:103`,
and moved it to `ct/tex-ground.ts` at `:66`. The sweep is **unchanged: 19 + 5,
317 responding**. That is the expected result and worth stating rather than
assuming: making the registry *reachable* does not register anybody. The 19 are
still outstanding, and now nothing stands in the way of closing them.

Worth noting the shape of that bug, because it is one this audit has met before
from a different direction. `a768f333` puts it as *"holding `scene` is not the
same as holding it in time"* — which is exactly what `globorder.mjs` reports
about the eager-glob literals, where a binding emitted later in the bundle is
`undefined` at construction. Two unrelated subsystems, one failure: **being
present is not the same as being present yet.**

## A blind spot in my own sweep, and a subsystem that has silently left the wet-look

`e24c959a` found the wet lerp could **lighten** a surface darker than its `WET`
target — dark asphalt **+398%**, the casino runner +70% — and clamped it. My
sweep sorted into *"darkened > 20%"* and *"unmoved < 1%"*, so **anything that
lightened fell between my two bands and was dropped without a word.** The script
now reports that band explicitly. Measured at this HEAD: **0 lightened**, so the
clamp holds and nothing had been hiding in the gap — but the instrument had been
willing not to tell me, which is the part worth fixing.

### The finding that came out of closing it: `vice` responds to nothing

Adding a by-owner tally to the control turned up a change I had not gone looking
for. Responding surfaces **317 → 256**, reproduced exactly on a second run:

```
responding surfaces by owner tag:
    137 × street        47 × tex-ground     28 × lot
     19 × (untagged PlaneGeometry)          10 × (untagged BoxGeometry)
      9 × props          6 × civic

vice: 303 outdoor materials, 0 responding
```

Two builds ago `vice` was the **top responder in the world at 87.9%**. A tag can
move between builds, so that alone proves nothing — the check is by **position**:

```
what is at the old top-responder spots now:
   (48.8, -97.7): 4 materials, best 0.0%  tag=vice
   (49.9, -97.7): 2 materials, best 0.0%  tag=vice
   (50.9, -97.7): 4 materials, best 0.0%  tag=vice
```

**Same coordinates, same tag, 87.9% → 0.0%.** Not a retag — those surfaces stopped
responding to rain, and all 303 of vice's outdoor materials are now dry in a
storm.

**I am not calling it a regression, because it may be intended.** Three commits
touch this: `2bab45b7` let vice join the wet-look, `a768f333` moved `registerWet`
after finding it unreachable, and `5a24c796` deliberately **un**-registered the
casino runner having looked at it. If that last revert came out broader than
intended, this is a regression the size of a whole district; if vice was meant to
come out entirely, it is done and this note is the confirmation. **That call
belongs to vice's owner**, and it is one command to re-check either way.

The reason this was invisible is worth keeping: the world got *greener* while a
district silently stopped responding, because no check counts wet surfaces **per
owner**. It does now.

## RESOLVED: vice responds again — my finding was true for one build

Re-measured at `c05e445a`, one build after I published *"vice responds to
nothing"*:

```
vice: 303 outdoor materials, 62 responding
   (48.8, -97.7): best 87.9%  tag=vice
   (49.9, -97.7): best 87.9%  tag=vice
   (50.9, -97.7): best 87.9%  tag=vice
```

**87.9% restored at the same three coordinates.** The finding was real at
`e24c959a` — reproduced twice there — and it is closed now. Nobody should go
looking for it. A district-sized regression that lived for about one build is
still worth having caught, but the correction matters more than the catch:
**anyone acting on the previous section would be chasing something already
fixed.**

## The fleet, confirmed from outside — and why my "19" was never the whole class

`67299640` found the fleet outside the wet system entirely, one sedan's **33
materials** identical to four decimals in dry and rain, and said *"the fleet
belongs on that list"* — my list. It was right that it belongs and right that it
was missing: **my 19 were filtered to transparent decals lying flat**, which is
the `dimWorld` hole specifically, not the question the script's own title asks.
A filtered count reads as a complete one, so the sweep now reports every owner:

```
EVERY outdoor owner: responding / total, and how high it sits
     28 / 762   lot                         median y 0.73
    137 / 674   street                      median y 7.40
     10 / 644   (untagged) BoxGeometry      median y 0.59
      9 / 373   props                       median y 0.17
     62 / 303   vice                        median y 6.40
      6 / 285   civic                       median y 1.57
      0 / 144   (untagged) CylinderGeometry median y 0.34   ← nothing responds
      0 / 138   walkup                      median y 6.10   ← nothing responds
     19 / 124   (untagged) PlaneGeometry    median y 0.71
     47 / 85    tex-ground                  median y 0.05
      0 / 33    (untagged) BufferGeometry   median y 0.00   ← nothing responds
      0 / 2     cat                         median y 0.02   ← nothing responds
```

The fleet is visible in two rows and neither is tagged. **33 BufferGeometry
materials at median y 0.00** is exactly H's sedan count, arrived at independently.
**144 cylinders at median y 0.34** is the tyre radius in `ct/cars.ts` — the
wheels, 144 of them, none wet.

Two of the four zero rows are entitled to be dry and are **not** findings:
`walkup` sits at median y **6.10** (upper storeys — rain does not run up a wall),
and `cat` is an animal. That is the value of showing height beside the count:
**a zero is only interesting once you know how high it sits.**

The wider lesson for my own reports: `19` was a true number to a filtered
question, published under a heading that read like the whole class. H had to find
the fleet by hand because my list looked complete. **State the filter in the
headline, or the count will be read as the population.**

## Mutation-testing my own negative result — it passes, and the plant lands on the retraction

`31865213` mutation-tested three checks and found two were not fine. That is the
one validation this audit had never applied to itself, and it matters most for
**negative** results — *"0 stretches under 1.00 m"*, *"0 lightened"*, *"no door
ever blocked"*. A negative from a detector that cannot see the thing is
indistinguishable from a negative from a clean world.

Circularity was the first way I found a check could be vacuous. **Insensitivity
is the second.** `scripts/mutate.mjs` tests it by planting a defect in the live
scene and re-running the same arithmetic — nothing under `src/` touched, because
the plant is just an extra entry in the array the probe reads, which is exactly
what a real obstruction looks like to it.

```
210 static colliders

  clean world                         0 tight · narrowest 1.12 m at east z -85.75
  + 0.50×0.50 post mid-west-walk      5 tight · narrowest 0.77 m at west z -27.50
  + 0.50×0.50 box out in the road     0 tight · narrowest 1.12 m at east z -85.75

  detector SEES a mid-walk post:      YES
  detector IGNORES a box in the road: YES

  PASS — "0 stretches under 1.00 m" is a measurement, not a blind spot.
```

Both halves matter. A detector that flags everything is as useless as one that
flags nothing, so the second plant is deliberately harmless — out in the road,
off the walk — and is correctly ignored.

### The plant lands exactly on the finding I retracted

The 0.50 × 0.50 post produces **0.77 m at west z −27.50**. My retracted finding
was **0.77 m at west z −28** — the same number in the same place. That closes the
loop on `3f7b2623` with more precision than the retraction had:

> What I measured then was real, and it was exactly the size and shape of a post.
> It simply **was not furniture** — it was a citizen who had stopped. The
> instrument was right, the inference was wrong, and this plant demonstrates the
> instrument would have reported an actual post identically.

So the corridor result now rests on three independent legs: the number itself,
the long-window ghost check that showed dropping movers can only ever *widen* a
passage, and a planted obstruction the detector catches at the exact figure that
started the whole episode.

## The wet look at night: narrower than "nothing", and worse where it shows

`fd74b028` raised a player-visible one and declined to patch it, correctly —
*"a player walking home at 23:00 in the rain sees a dry road"* — on the basis
that all 62 wet-registered surfaces are bit-for-bit identical dry and rainy at
23:30. Wet streets have been asked for **three times**, so this is worth an
independent measurement rather than a second-hand one.

**Two controls first, because the night pair is 72 hours apart where the day pair
was one hour.** Anything on a multi-day cycle would confound it:

| pair | responded | lightened |
|---|---|---|
| dry 23 vs **rainy** 95 | 51 | 0 |
| dry 23 vs **dry** 71 | **0** | **0** |

The dry-vs-dry control is a clean zero, so the 51 are genuinely rain-driven.

**And a third mover bug of my own, found by that control.** My first night run
reported *"a surface LIGHTENED by 280.9%"* — a clamp escape, if true. It was a
**0.95 × 1.90 plane at kerb height that drifted z −37.7 → −38.3 between runs**:
person-sized, and walking. A citizen sprite keeps its material uuid while it
moves, so it joins to itself with a different colour and lands in whichever band
its lighting fell into. The sweep now joins on **position as well as uuid** —
2890 movers dropped of 4562 — and both the phantom lightening and the phantom
control vanish. That is the third time movers have manufactured a finding in this
audit, and the first time one of my own instruments produced it after I had
written the lesson down twice.

### What the corrected measurement says

```
EVERY outdoor owner at 23:00, responding / total
      4 / 484   street        median y 3.26          16 / 26   tex-ground  y 0.05
      4 / 323   lot           median y 0.80           1 / 76   vice        y 4.54
      9 / 216   props         median y 0.14           0 / 142  civic       y 0.97
     15 / 115   (untagged) PlaneGeometry y 0.74       0 / 84   walkup      y 6.10
```

**"The wet look does nothing after dark" is too strong — and the truth is worse
for the player.** 51 surfaces do respond at night, so the system is not inert.
But `street` collapses from **137 of 674 responding by day to 4 of 484 at
night**, while `tex-ground` holds up at 16 of 26. The part that still works is
the ground plane; the part that stops is **the street itself** — which is
precisely the surface the player is looking at while walking home.

So the report to whoever owns `props.ts` is narrower and more actionable than
"nothing works at night": *the wet look survives the night grade on tex-ground
and dies on street.* I have not diagnosed why, and it is not mine to fix.
