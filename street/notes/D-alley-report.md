# Builder D — report

Rebase, take the top unchecked item, commit, re-read, take the next. I don't
edit the queue.

---

## My notes, and which are live

This file is 1200+ lines and seven sibling notes were reachable only by listing
the directory — `f214cf76` and `fef145bb` hit the same thing. Index first.

| note | what it is | status |
|---|---|---|
| **`BLOCKED-D.md`** | the BODEGA frontage names the wing, not the door; **plus the grate question** | **LIVE — needs a desk ruling** |
| **`D-alley-grate.md`** | why I have not drawn a grate: the casting is B's, and the dish needs a ground registration | **LIVE — the detail behind the ask** |
| **`D-endM-survives.md`** | the flat brown the user complained about is still on GOLDEN ACES and HOTEL ORPHEUS | **for G — verified visible, not touched** |
| **`D-sign-audit.md`** | 0 of 71 signs upside-down; **`vice` is invisible to every sign audit** | **for G — the marquee is theirs** |
| `D-bodega-corner.md` | four reported defects: two already fixed, one my misreading, one routed | for B — the corner paving pattern |
| `D-shop-resize.md` | four of five targets met exactly; the fifth is arithmetically incompatible | answered, needs a ruling if glazing matters |
| `D-integration-optin-exists.md` | `SHOT_WORLD=integration` already landed | H closed their item on it |
| `D-jumping-the-clock.md` | stepping the evening; **headline magnitude withdrawn — it was rain** | corrected at the top |
| `D-bright-at-midnight.md` | the bright-at-night sweep; **two corrections — jumped clock, and tint vs appearance** | answered by G, B and C |
| `D-pinned-suite.md` | `scripts/pinned-suite.sh`, a checkout that cannot move under a run | live tool; answers BLOCKED-H §3 and §4 |
| `D-graffiti-glowed.md` | the alley tags rendered brighter than their wall | fixed; **figure corrected from 16x to 6-47x** |
| `D-the-post-is-a-person.md` | the "mid-pavement post" is a walker | settled; `3f7b2623` retracted |
| `D-pgrep-is-not-yours.md` | `pgrep -f` matches other builders' processes | rule, not a patch; four waiters were blocked 3h+ |

**The rest of this file is chronological and mostly history.** What is still
worth reading in it: the mover audit of my probes, the stopwatch sweep and the
one threshold I would not defend, the settle-ramp discriminator, and the rain
sweep. Everything above them is superseded by the code.

## What guards my area

`alleycheck` · `builtlane` · `shells` · `windowlights` · `midnight` · `D-walk`,
all registered in `scripts/checks.mjs` and green, including against the live
`:5177` build with `SHOT_WORLD=integration`. `scripts/alley.mjs` shoots the
alley in four conditions — day, dry night, daytime rain, wet night — because
two of those four turned up real defects the first time anyone looked.

---

# LATEST — used car lot landed; queue now blocked on other builders

`7630f2580` · build clean · sweep no new page errors · `health.mjs` WORLD OK ·
collision proofs all pass · `ownership.sh D` flags only `crosstown.ts`, which
is the sanctioned collision/floor mandate.

## CAFE + HARDWARE → used car lot (site half)

**FOR BUILDER C:**

    z  -9 … 14.2   (23.2 m)     x  7 … 15   (8 m deep, street to back)
    ground at KERB_H            street edge at x = FACE = 7
    middle 40% of the frontage left open as the way in

Deeper than the park's 7 m because a lot holds cars, surfaced in broken asphalt
rather than grass. Fence, office, signage and stock are C's in `ct/lot.ts`.
Run before No. 227 still totals 49.2 (load-bearing for `ct/apartment.ts`).

**The park's builder is now shared rather than copied.** `openSite(side, z, w,
opts)` does the ground, both exposed party walls, the rear elevation, the
street boundary and the collision for both sites, with every x written through
`side`. The second site would otherwise have been sixty near-identical lines
with the signs flipped.

Both flagged risks answered:
- **party walls** — finished brick with a coping, courses phased off world Y by
  `masonry()` so they run level with the street elevation either side.
- **sightline** — fine, and checked by standing in it. The gaps are on opposite
  sides at opposite ends (lot z −9…14.2 east, park z −98…−68 west), 60 m+
  apart with the street wall between and `FOG_FAR` at 60. From inside the lot
  looking south you see its own party wall and A-1 TAX, never the park. Neither
  gap reads as a hole because each is closed at the back by a full-height rear
  elevation, so the skyline stays continuous.

Walked in from the pavement to x = 14.53, floor holding at KERB_H.

---

## Every remaining item needs YOU, not me

| item | status |
|---|---|
| bodega corner bay | **NOT blocked — A exported all five helpers; mine to take** |
| signs (a) + (b) | **not mine any more — G's** |
| window lights | **contended with A's live mandate** |
| shop resizing | **already done** — verify and retire |
| `[E]` spots migration | **half needs a `ctx` change, which is a desk operation** |

**Bodega bay — NO LONGER blocked (checked at HEAD; the paragraph below is
history).** `HI`, `reveal`, `proud`, `glazed` and `mullions` are all exported
from `tex-world.ts` now, lines 973-1009. The original blocker read:

**Bodega bay — blocked on A.** A landed the depth work (`5cbb162`, `bed0b69`)
but its vocabulary is still module-private: `HI`, `reveal`, `proud`, `glazed`,
`mullions` in `tex-world.ts`. Following A needs those five exported (no
signature changes); the alternative is copying them into `ct/street.ts`, which
is the second vocabulary the brief forbids. Re-checked this run — still private.

**Signs — G's now.** The queue says to tell you if the marquee moved with the
casino, and it did: `ct/vice.ts` builds GOLDEN ACES and HOTEL ORPHEUS, and
`ct/street.ts:503` records that it no longer does. My structural fix landed
before the split and has been superseded by it. Hand (a) and (b) to G.

**Window lights.** `facadeTex` was handed to me but lives in `tex-world.ts`,
and A has been in the lit-window code this run (`a3b803c`). Sequence after A.

**Shop resizing — already in the tree.** `SHOP_BAND_H = 4.2`, residential still
`ENTRANCE.BAND_H = 3.2`, band at 2× masonry density. Safe to retire.

**`[E]` spots — half of it is a desk operation.** Four spots remain in
`SPOTS.push`, all bodega. Two (enter, exit) need only `ctx.player` and I can
move them today. The other two (buy cereal, buy soda) need `purse` and
`hud.refreshWallet()`, and **`ctx` exposes neither** — adding them changes the
`CtxBuild` interface, which OWNERSHIP.md says must be changed with all callers
in one commit by the desk. I did not want to move half and leave the entry
point in an in-between state that still has a `SPOTS.push` block in it. Tell me
which you want: add `purse`/`hud` to `ctx` and I move all four, or I move the
two door spots now and the shop counter stays.

Also worth noting: **`ct/bodega.ts` is not in `OWNERSHIP.md`.** The queue
assigns me its spots, so it is fine for this item, but the table should say who
owns it.

---

# Builder D — report

Working from `notes/queues/D-alley.md`: rebase, take the top unchecked item,
commit, re-read, take the next. I don't edit the queue.

All of this run's work is committed and already absorbed into mainline.
Build clean · sweep no new page errors · `health.mjs` WORLD OK · `ownership.sh D`
clean apart from the sanctioned collision mandate. Verified on **4231
`--strictPort`**, checking the served bundle hash against the built one each time.

---

# LATEST RUN — seven items landed, one blocked

| item | commit | note |
|---|---|---|
| collision follows geometry | `8a7941f41` | the mandate; walked, four proofs |
| bodega doorway is a real hole | `57fa55cad` | recessed leaf, boxed reveal, OPEN over the door |
| DINER ⇄ LAUNDRY identities | `cff1464d5` | diner now **z −55.5 … −43.5, centre −49.5** |
| signs: real structure | `d2e5d02d0` | (a) and (b) already fixed; (c) was real |
| BARBER ⇄ THRIFT + park | `e78e5ec1f` | park site **z −98 … −68, x −14 … −7** |
| MERIDIAN + LAUNDRY → bank | `b5f8264a` | 19.2 m; resolves the Corporation item |
| crates, attempt three | `50eaa2b0` | twelve separate fruit, judged at eye height |

Worth keeping:

- **The collision item had two more layers under its stated cause.**
  `COURT.colliders` was published by `ct/civic.ts` and *never consumed by
  anything* — E's courtyard colliders were absent, not overridden — and
  `groundY` stopped answering at `FACE + 0.3`, so walking in dropped you off a
  ledge. All three had to be fixed together.
- **The walk test caught a regression I would have shipped**: the church goes
  through `placeChurchEast`, not `placeBld`, so with the blanket gone you
  walked straight through the nave. Looking would never have shown it.
- **Signs (a) and (b) were already closed** by the earlier
  `transparent`/`FrontSide` fix; `shots/user-signs.png` predates it. (c) was
  real and worse than reported — the marquee's legs stood at z = −98.2 and
  −91.8 against a building spanning −96 … −92.6, so one hung over the roadway
  and the other was buried behind the parapet.
- **The bank's first entrance was wrong** and the screenshot showed it: a leaf
  recessed into an opaque band box is a hole with nothing in it. Rebuilt as a
  projecting granite portal with the doors flush behind it.

---

## BLOCKED — needs the desk

### The bodega corner bay, on builder A

The brief says the bay must *follow whatever A lands rather than inventing its
own vocabulary a second time*, and to tell you if A has not landed.

**A HAS landed it** (`5cbb162`, `bed0b69`). The problem is that the vocabulary
is **module-private**:

    tex-world.ts:299  const HI          not exported
    tex-world.ts:306  function reveal   not exported
    tex-world.ts:315  function proud    not exported
    tex-world.ts:324  function glazed   not exported
    tex-world.ts:335  function mullions not exported

Following A therefore leaves two options, both of which I have been told not to
take on my own:

1. **export those five from `tex-world.ts`** — allowed by OWNERSHIP.md in the
   letter ("may add a new export… never change an existing signature"), but A
   has a **live mandate in that file right now**, and the standing rule is to
   tell the desk rather than work around a live mandate;
2. **copy them into `ct/street.ts`** — precisely the second vocabulary the
   brief forbids.

**What I need:** either A exports those five (no signature changes), or the
desk sequences the bay to me once A's mandate closes. Then the bay's shared
rhythm — one stallriser line, one head, one reveal depth, equal bays — is a
straight application of A's helpers instead of a re-invention.

The rest of that item is already answered:
- **OPEN over the door** — done in `57fa55cad`.
- **Collision on the cut face** — done and walk-proved: stops on the cut at
  `x+z = −87.56`, and reaches `x = 7.38` at z = −95 where a square wall stops
  you at 6.34.
- **Sidewalk scoring running under the building** — checked, **not mine**. The
  walk slab is `ct/tex-ground.ts` (builder B) and it extends beneath the shell;
  where the chamfer cuts back, it shows. Handed to the desk as the brief says.

### Window lights — same contention

`facadeTex` is "handed to you for this" but lives in `tex-world.ts`, and A has
already been in the lit-window code this run (`a3b803c`). Starting there now
collides with a live mandate. Sequence it after A, or confirm A is out and I
will take it.

---

## Open and NOT blocked

- **Move my `[E]` spots onto `ctx.spot()`**, out of `crosstown.ts`. Nothing in
  another builder's way. It is a refactor of the entry point that re-touches
  the bodega trigger, and that trigger has closed the shop once already
  (GOTCHAS §8), so it wants its own walk-proof — `scratchpad/collide.mjs` is
  ready for it.

## Standing note

**Port contention cost three ports this session** — 4181 held by the parent
checkout's drifting 4177 server, 4184 taken by `rpg-audit` while mine was down
for a rebuild, 4185 earlier. I now check the served bundle hash against the
built one before trusting any result, which is how I caught a test running
green against another worktree's build. A pinned `--strictPort` per worktree
removes the whole class of problem.

---

# Builder D — report

Working from `notes/queues/D-alley.md`: rebase on `add-stick-and-city98`, take
the top unchecked item, commit, re-read. I don't edit the queue — completions
are reported here.

---

# LATEST — collision follows geometry (`8a7941f41`)

**`## Now` item done.** `npm run build` clean, `npm run sweep` same warnings as
baseline, `scripts/health.mjs` → WORLD OK.

`scripts/ownership.sh D` reports `crosstown.ts` out of bounds — **expected**,
that is the one-time cross-file mandate. Both files in ONE commit, collision
and floor only; the diff touches nothing else.

## What was actually wrong

Exactly as the brief called it: structural, not a bad number. Two rectangles in
the entry point spanning the whole block, independent of anything drawn. But
there was a second half nobody had spotted:

> **`COURT.colliders` was published by `ct/civic.ts` and never consumed by
> anything.** E's courtyard colliders were not in the world *at all* — not
> overridden, absent. So even with the blanket notched you would have walked
> through the benches, planters, piers and the library's own facade.

And a third: **`groundY` stops answering at `FACE + 0.3`**. The courtyard paving
reaches back to `XF = -FACE - 3.2`, so walking in dropped you off a 0.14 m
ledge onto road level. `COURT` publishes `.y` for precisely this and that was
not wired either. The courtyard needed all three to be walkable.

## The fix

`ct/street.ts` — a `solid()` registry handed back from `buildStreet`:
- `placeBld` / `placeBldZ` each register the shell they just placed, bounded to
  that building's own extent
- **the bodega corner follows the cut**: a staircase of 0.25 m bands along
  `x + z = BX0 + BZ1 + CHF`, each starting at the most permissive x in its band
  so the stair never eats walkable ground — the 0.36 m player radius more than
  covers the sliver of masonry that leaves unblocked
- **the church registers its own.** It does not go through `placeBld`, and with
  the blanket gone you walked straight through the nave — caught by the walk
  test, not by looking
- the alley end wall, dumpster and fruit crates move here too; they are
  street.ts geometry and were in the entry point by habit
- **the library registers nothing**, so civic's colliders are the only thing
  there

`crosstown.ts` — blankets deleted, `street.colliders` and `COURT.colliders`
spread in, `groundY` answers `COURT.y` inside the courtyard.

## Proofs — walked with real key input, not screenshots

```
1. library courtyard
   walked IN: x -6 -> -9.53 (past the old blanket at -7.3)
   floor held, eye y = 1.62 (no drop into a hole)
   walked back OUT: x -9.53 -> -0.81
2. bodega canted corner
   stopped ON the cut: x+z = -87.52 (cut is -87)
   follows the cut IN: reached x = 7.39 at z=-95, where a square wall stops
   you at 6.34
3. the doors
   bodega "[E] into the BODEGA" · No. 227 "[E] enter No. 227"
4. no walking into buildings
   east shops, west shops, both side-street runs, and the church — all stop
   on the facade line
```

Script: `scratchpad/collide.mjs`, re-runnable against any port.

## Two things for the desk

**The library has no `[E]` spot anywhere in the tree.** I went looking during
proof 3: `ctx.spot` is called from `ct/apartment.ts` and `ct/interior.ts` only,
and `ct/civic.ts` registers none. The library has never been enterable — not a
regression from this change, but it is a door the user will try.

**A's masonry-density work did not collide with mine** — my diff is collision
only and touches no texture code in `ct/street.ts`.

---

## `## Now` → **Move the church onto the main block** — DONE (`360fbac4b`)

`ct/civic.ts` untouched. This is a roster change and nothing else.

**Where it went.** EAST now runs … No. 227, PAWN, **ST BRIGID**, BODEGA. The
church occupies **z −86 … −68** at x 7…10.4, facade on x = FACE looking west
across the street. Its old slot on the south side of the side street is filled
by the two shops it displaced.

**The widths, which are load-bearing.** Both answers came from the desk and
both are honoured:

| run | before | after | total |
|---|---|---|---|
| EAST after No. 227 | PAWN 12, DELI 11, RECORDS 10, BODEGA 10 | PAWN **15**, ST BRIGID 18, BODEGA 10 | 43 ✓ (last shell still ends on −96) |
| SOUTH2 | ST BRIGID 18, GARAGE 12, … | DELI **9.5**, RECORDS **8.5**, GARAGE 12, … | 64 ✓ (still ends dead on x = 57) |

The church takes a 21 m slot and the nave is 18, so **PAWN — its north
neighbour — takes the 3 m**, as instructed. No. 227 untouched.

**How it turned the corner without touching E's file.** `placeChurch` builds
along +x with its facade on +z: the side-street axis it was authored for. Rather
than ask E to parameterise the axis, the church is built into a **Group** and the
group is turned. `buildCivic` only ever calls `scene.add` and registers nothing,
so a Group is a perfectly good scene, and the transform is arithmetic on my side
of the line. `rotation.y = −π/2` sends local +x → world +z and local +z → world
−x, which puts the nave down the block and the facade exactly where `placeBld`
puts an east shopfront.

### Seams — walked, both sides of both junctions

Screenshots: `shots/user-church-mainblock.png`, `user-church-seam-north.png`,
`user-church-seam-south.png`, `user-church-oldslot.png`.

- **Stone meets brick on a clean vertical line** at z = −68 (PAWN) and z = −86
  (BODEGA). No gap, no z-fight, no overlap.
- **No sign band runs into the stone.** Each shop's band is painted in its own
  texture and dies at its own edge, so the junction is brick-to-stone, nothing
  more.
- **No flat untextured party wall** — seam-audit #1 does not reproduce here.
  At the north junction the 26 m tower stands at the church's north end and
  hides PAWN's end cap completely (and the tower's own north face is textured,
  not `stoneM()`). At the south junction the church is the taller of the two, so
  there is no exposed cap at all.
- **Return walls are correctly buried.** The nave's ±x ends are flat
  `stoneM()`, which is what the queue warned about — but with neighbours flush
  on both sides, neither is visible from anywhere on the street. I checked
  specifically before reporting it, and it is a non-issue *at these two
  neighbours' heights*.
- **The sidewalk still walks.** Building-side lane at x = 6.30 runs the full
  church frontage clear, both directions, verified with real key input. The
  tower projects 0.3 m to x = 6.7 — exactly the existing wall collider's
  `minX`, so it takes no pavement. (Straight-line walks at x = 5.8 and 6.0 stop
  on the street trees and the lamp; those are pre-existing furniture you walk
  around, not new.)

### What I need from `ct/civic.ts` — for E, via the desk

**One item, and it is already in E's area.**

> **The buttresses are flat untextured `stoneM()` boxes.** Four of them stand
> 0.3 m proud of a fully coursed ashlar facade, so they read as blank slabs
> stuck on the front — most obvious in `shots/user-church-seam-south.png`, the
> pale featureless strip immediately right of the bodega, and either side of the
> doorway in `user-church-mainblock.png`.
>
> On the side street this was survivable because the church was seen head-on and
> the buttresses were nearly edge-on. On the main block you walk *past* it, so
> their front faces and both cheeks are lit and looked at from every angle.
>
> What I need: the buttress faces carrying the same ashlar as `naveTex`, with
> the courses lining up with the wall behind them. Same for their weathered caps
> if those stay flat colour.

**Nothing else.** I deliberately have not asked for the return walls to be
suppressed — they are invisible where the church now stands, and asking E to
delete geometry that a future roster change would need back would be the wrong
trade. Worth a comment in `civic.ts` that the ±x ends are now party walls, so it
is not a surprise if a neighbour's height changes.

---

## For the desk

**Port contention is now costing real time.** 4181 is held by
`/home/erick/projects/rpg`'s drifting `--port 4177` server, and while my 4184
server was down for a rebuild **`rpg-audit` took 4184** — I caught it because
the served bundle hash did not match the one I had just built. That is three
different ports lost. I am on **4231 `--strictPort`** and I check the hash every
time before trusting a result. Recommend every worktree get a pinned
`--strictPort` port and that the stray 4177 server be stopped.

## Previously, still standing

- **Bodega blocker** — the fruit-crate collider, not the chamfer. Re-verified
  after the civic split. Door centre `(8.0, −95.0)`; the `[E]` spot works as is.
- **BURGER BARN red + beige** (`57d35a0c9`) — the mustard constants had never
  actually reached the code.

Open in my queue: bodega door readability, filling the crates, signs (a) and
(c), shop resizing (already in the tree — worth verifying before it is
promoted), window lights, the corporation, and moving my `[E]` spots onto
`ctx.spot()`.

---

# QUEUE EMPTY — all nine items landed

The queue file still shows them unchecked because the desk writes it and I only
read it. Commits so you can tick them off.

**Now**

| item | commits |
|---|---|
| **The bank flank** (raised twice) | `64565b5be`, `cf1957a30`, `bcb0f816c` |
| Open-site depths — two builders blocked | `53969600` |
| Buildings 3.4 m deep / every flank the same brown | `e466c43c`, `4ce8355d` |
| CAFE + HARDWARE become a used car lot, roster half | landed; z -9 … 14.2 |

**Next**

| item | commits |
|---|---|
| Bodega corner bay | `453766784` |
| Signs, both bugs | **not mine** — moved with the casino into `ct/vice.ts` (G) |
| Shop resizing | `bab2a7c3`, plus the band-table refactor before it |
| Window lights | `de401556`, `cedf76802` |
| `[E]` spots out of `crosstown.ts` | `379257956` — the `SPOTS.push` block is empty |

## The bank flank, because my first diagnosis was wrong

I reported the bank's return as already correct. It was — and it was also
irrelevant, because you cannot see it. Raycasting from the camera in
`shots/user-bankflank.png` (pavement north, pavement north-west, roadway
north-west) hits the same object on every ray, and it is not the bank:

    BoxGeometry(30, 13.6, 6) at (0, 6.8, 16.5)      the north end-cap

It spanned x -15…+15, z 13.5…19.5; the bank spans x -7…-22.9, z -5…14.2.
**The two shells interpenetrated by 0.7 m** — a brick building standing bodily
through the bank's precast front, showing a windowless sliver of itself at the
arris. The user read that as "two materials meeting with nothing reconciling
them". It was two buildings in the same space.

Fixed in three parts: the cap abuts at z = 14.2 and is `2 x FACE` wide so it
stops barging across the building line; the bank carries its front round the
first 3.2 m and then becomes a party wall; every other exposed return got the
same party-wall vocabulary.

**The duplication behind the rest of it:** the party-wall marks lived inside
`openSite` for the park and lot walls, and nowhere for the buildings. So the
sites wore scars and every building return stayed blank — exactly what the
brief noticed. `partyWallTex` is now the only one.

## For the desk

**E's patch is applied** (`9fa92d579`), written out properly rather than as
their `void 0;` verification stub, which was marked "revert before commit".
Walked, not assumed: the churchyard opens at the gate (z -80), the nave still
holds at x 9.24, the walls hold along the whole frontage, eye height never
leaves 1.62. E's `E-yard-walk.mjs` passes all four walks and still SKIPs its
gate/climb tests — those need E's *other* patch, `notes/E-steps-crosstown.patch`,
which is not mine.

**My church proof moved with it.** It asserted x < 6.4, calibrated against the
blanket that patch removes. A second proof now walks the nave from inside the
yard, because the old one could not tell "the nave is solid" from "the
churchyard is sealed" — the confusion that let the bug live.

**`shots/user-bankflank2.png` is not in the repo.** I worked from
`user-bankflank.png` plus the written description. Worth landing the second.

**One flaky probe, not a world bug.** `collide.mjs`'s library-courtyard walk
fails intermittently: citizens use that mouth, and one standing in it blocks a
0.36 m player. It needs to wait for a clear mouth.

**BLOCKED-D.md is deleted**, per your instruction; the additive `ctx` change
stays.

---

# Everything since, in the form the desk reconciles against

`SESSION-STATE.md` says four queues went stale listing landed work as open, and
the remedy is *"reconcile against the builder's report before adding to a
queue."* Mine is `notes/queues/D-alley.md`, still at `a5fc24d8` with all nine
items unchecked, and all nine are landed — the table above has the commits.

This section exists so the rebuild has something current to reconcile against.
None of the work below was in my queue; it came from other builders' notes and
the audits, which is where the routing actually happened.

## Landed since the last append

| what | commit |
|---|---|
| **0.18 m of sidewalk given back.** The lane audit's headline: every building's collider sat 0.3 m inside its facade, so the "sacred 2 m" was 1.70 m everywhere. Measured the relief — deepest thing at walking height is the jamb at 0.12 — and published `WALK_PROJECTION`. Eight stretches moved problem → tight. | `833d4296f` |
| **The site boundary moved off the walk.** `openSite`'s rail straddled the street line, putting its whole 0.36 m in the pavement on BOTH sites. Routed by C with a measurement. Block-wide: 15 stretches under 1.20 m → **six, none graded problem**. | `5be75c19` |
| **The alley stopped showing sky over its own back wall.** End-wall height derived from the taller neighbour instead of a literal 12.8 that stopped being true. | `1484a2f7e` |
| **The alley floor painted per metre** — 9.7 px/m against a 32 px/m walk → 24, grain per m², stains in metres, a real drain. | `226a28b9` |
| **The alley flanks went single-sided** once party-wall marks made their paint handed. | `98c320f2` |
| **D-walk.mjs landed in the repo** with retries, and found the bodega door trigger was unreachable on foot (you stop 1.38 m out, outside r=1.1). | `05ca03b8` |
| **The purse proof buys until refused** instead of counting five keystrokes. | `27424ae1` |
| **Seam audit closed out for `ct/street.ts`** — all eight, six already fixed elsewhere. | `7c93bfa8` |
| **Pattern #1 does not reproduce**; then the 2× band/wall junction ruled out; then the four ~6 px/m candidates identified as **ivy**. | `793721de`, `f604c531`, `1466eb13` |

## Corrections I had to make to my own work

Worth reading, because two of them are the same mistake:

- I told E the last "problem" lane row was their park hedge. **It was my own
  rail**, read off a stale bundle. Corrected in `e26df4c8`.
- I committed the alley floor while a test was failing. It turned out flaky,
  but I should not have committed before reading it.
- Twice I read a brick mismatch off a screenshot where the two faces were at
  very different angles — once nearly publishing it as a confirmation. A
  brick-size comparison is only evidence when both faces are at the same angle
  and distance.

## Still not routed anywhere

- **`ct/doors.ts` has no owner** in `OWNERSHIP.md`; C's items on it are open.
- **`ct/int-bodega.ts` is not listed either**, and I was the de-facto owner of
  its predecessor.

---

# Since the last append — verified at HEAD, not remembered

| what | commit |
|---|---|
| **The bodega's `[E]` reaches the pavement centreline.** request-audit's patch sweep found its nearest edge at x 6.2 against a centreline of 5.9 — the only door on the block that missed it. r 1.5 → 1.8; now fires over 1.5 m of centreline walk, edge at x 5.7, still 0.7 m clear of the kerb. | `5a92ab3a` |
| **859 meshes stamped with `userData.mod`** — and the foreign builders I *call* (E's library and church, G's casino, the cat) stamped with THEIR names first, so the biggest module did not put mine on other people's geometry. | `95de74b3` |
| **`npm run walk`, and a `--selftest`** that inverts three known truths and requires all three to fail. It was the only proof covering collision, the doors, the churchyard climb and the purse, and until then it was both unfindable and unwatched. | `15d09ed3` |
| **Eleven surfaces declared** (`ground`/`sign`/`detail`), proven a no-op by fingerprint. | `081ed98a` |
| **The lamp splash and pool identified** — ten of the eighteen then-remaining unjudgeable faces were one street lamp seen twice. | `9e1bce93`, `4906af20` |
| Banner dropped in favour of `reportWorld`, which proves the build and not just the URL. | `f1ec7b40` |

## State of my area at HEAD, measured this round

```
health          WORLD OK
npm run walk    all D walks pass          (collision, doors, climb, purse)
  --selftest    3 of 3 inverted assertions caught
lane3           3 stretches under 1.20 m   (15 before my cushion + rail work)
seampairs       brick vs brick: 0 · like-for-like disagreeing: 0
```

## Open, and the only thing I am waiting on

`notes/BLOCKED-D.md` — `__frontages['BODEGA']` describes the side-street WING,
not the canted bay where the door is. Latent (nothing reads it today) but it
becomes live the moment anyone writes the shared door-disc arithmetic
`7b100b65` proposes. **Not a one-liner**: `b.nm` drives the painted sign and the
frontage registration from the same value, so the fix wants an optional
`frontageName` on `shopfrontRelief` — A's file, A's API shape.

---

# Closed findings, folded in — the seven notes they were in are deleted

`scripts/desk.sh` was printing NINE "D-*.md is newer than its queue" actions
against me, one per note, and seven of those notes were finished. That is my
noise on a board people read to decide what to dispatch. Conclusions kept here,
files removed.

| finding | conclusion |
|---|---|
| **`D-blade-routing`** | The audit's "twelve mirrored blades on the east shopfronts" are C's car-lot bunting, not `ct/street.ts`. Symmetric triangle art, so the mirror is invisible; the lot's TEXT banners already face the street correctly. Accepted upstream — `bfe32e8d` now filters cut-outs so ivy and bunting stop being offered as brick. |
| **`D-churchyard-wired`** | The churchyard was never unwired. E's probe warped with `gy = 0.14` and read 60 ms later; the camera eases, so it read the forced value. 0.55 at their own point. The church steps climb — 0.14 → 0.19 → 0.44 → 0.55, no riser-sized jolt — and `request-audit` graded them NOT DONE off a scan window 20 m south of the church. |
| **`D-seam-closeout`** | All eight seam-audit findings for `ct/street.ts` closed; six had already been fixed elsewhere and the triage table was stale. Re-measure before re-queuing. |
| **`D-density-recheck`** | Pattern #1 did not reproduce at HEAD. The auditor found the cause twice over (a box-face index misread) and it is now like-for-like 0. My own contribution included one wrong claim and one right one — see the note's history in git; the label really was mislabelling declared faces. |
| **`D-splash-identified`** | The unowned x ±6.9 family is the lamp **wall-splash**, and the 8.57 px/m ground family is the lamp **pool** — ten of the then-eighteen unjudgeable faces were one street lamp seen twice. Both declared upstream in `a86f970d`. |
| **`D-rail-to-E`** | The boundary rail moved off the walk; E's two `E-park-walk` assertions hard-code the old wall face and need −6.64 rather than −6.28. **And I withdrew the hedge row I sent them** — that was my own rail read off a stale bundle. |
| **`D-decl-discrepancy`** | I read `decl null` as a missing surface declaration when it means "no `masonry()` stamp". Retracted — then half un-retracted, because the tool WAS printing "UNDECLARED" for declared faces and its missing-faces list was 65 % faces needing nothing. Both fixed upstream in `c9a16d97`. |

**Still open, and both are on the board for a reason:**

- `notes/BLOCKED-D.md` — the bodega frontage names the wing's painted door.
- `notes/D-density-red.md` — the one red in `npm run checks`, civic's church
  tower, one texture on two different face widths. `civic` has been idle two
  hours; the fix and a worked example are in the note.

---

# Two more notes finished — folded in and deleted

| finding | conclusion |
|---|---|
| **`D-casino-door-drop`** | The lost casino DOOR costs a player nothing — `int-casino.ts` registers its own `ctx.spot` and the entrance works (`[E]` fires x 50.5…52.0). What it cost was **denominators**: `declaredDoors()` is the population several tools count against, so "5 of 5 rooms mirror" was five of those *still declared*. Acted on — `447514cb` now prints *"the world has 8 rooms. 3 cannot be checked here."* Two probes of mine also bounded the cause: adding an inert module does **not** move the loss, and the whole thing is a **bundler** phenomenon — the dev server has zero undefined namespaces, so a fix can only be tested with `npm run build && vite preview`. `418515c7` then solved it: the casino's binding is emitted after the glob that reads it. |
| **`D-density-red`** | **RETRACTED — I routed a false positive to civic.** The church tower is correct: it reuses its 5 m canvas on the 3.7 m face with `towSide.repeat.x = TOWER_D / TOWER_W`, and `density` was ignoring `map.repeat` (`5e117dc6` fixed it; 241 faces now all correct). The fix I prescribed would have replaced a correct one-canvas solution with a redundant second texture. **I had named that exact trap myself** in an earlier note and then walked into it; the check's author records the same about themselves. Withdrawn on both sides (`2c147321`, `e26fb068`). |

**The one thing worth carrying forward from the second row**, because it is now
the most repeated failure in my work this session: *the finding was real and the
diagnosis on top of it was not.* The red existed; `userData.mod` attributed it in
one query; everything after that was wrong. Attribution is cheap and reliable
now — diagnosis still needs the same check as any other claim, and I skipped it
because the attribution had felt like progress.

---

# Reconciling "8 of 8" against "7 of 8" — both are right, on different servers

`9c4fa019` states the casino's DOOR *does* reach `declaredDoors()`: *"8 of 8
collected, both of my buildings present with correct points and stands, no NaN,
zero console errors."* I had measured it absent, twice. Same repo, and
`git log cb696d3d..HEAD -- src/proto/` is **empty**, so the source is identical.

Measured both, same HEAD, same session:

```
vite preview (built bundle, hash-verified against dist)
   7 doors — A-1 TAX, BODEGA, BURGER BARN, DINER, HOTEL ORPHEUS, PAWN, THRIFT
   GOLDEN ACES present?  false        4 [doors] warnings

vite dev (native ESM)
   8 doors — …, GOLDEN ACES, …
   GOLDEN ACES present?  true         0 [doors] warnings
```

**Neither of us measured carelessly. The world genuinely gives two answers**, and
which one you get depends on whether you asked the bundler or the dev server.
`a7a57c4f` already established that and said what follows from it: *"anyone
debugging this with `npm run dev` will find nothing wrong and conclude it is
fixed."* This is that prediction landing on a colleague within a few commits.

**So "8 of 8" should not be read as evidence the drop is gone**, and I would not
want it read as evidence the other agent was sloppy either — the number is
correct for the server they used. The distinction is not obvious and nothing in
the tooling made them ask.

The lesson is one layer above the bug: **which server answered is part of the
measurement.** `reportWorld` already prints the URL and the build for scripts
that use it; a `[doors]`-style count taken by hand in a console has no such
stamp, and this is what that costs.

### One loose thread: there is nothing to bisect

`b3379db6` is newer than the reconciliation and still says the drop *"regressed
inside that range"* — 8 of 8 at `cb696d3d`, 7 of 8 at HEAD. **That range cannot
contain a regression:**

```
$ git log --oneline cb696d3d..add-stick-and-city98 -- src/proto/ | wc -l
0
```

Zero source commits. The bundle is byte-identical across it, which is why the
same note also reports 7 of 8 *"detached at the same commit"* — its own evidence
already contradicts the range framing. The 8-of-8 was the dev server, as
`f49fdab5` independently concluded.

Saying so because a bisect over that range is the obvious next move for whoever
picks this up, and it would spend a session finding nothing.

Two things worth doing, neither mine: the door checks should run against
`vite preview` specifically, and A's fix — move the lookup into a leaf that
globs nothing — removes the dependence rather than the symptom and should still
land.

*(I also nearly published this from the wrong directory: my first `npm run build`
ran at the repo root, wrote no `dist`, and I measured a stale server anyway. The
bundle-hash check caught it. Same class of error, one layer down again.)*

---

# A guard I tried and did not ship: "no building is a 3.4 m box"

After the window-lights guard I went for the other unguarded complaint in my
area — *every building is a 3.4 m deep box* — because it should be a clean
scene query rather than a pixel count. It is not, and the reason is worth
recording so nobody repeats the attempt.

**Depth is the dimension perpendicular to the facade, and nothing in the scene
says which way a shell faces.** A `BoxGeometry` gives `width`/`depth` in world
axes; which of those is "depth" depends on whether the shell fronts the main
street or a cross street. Inferring it from position gets you this:

```
main-street depths, by my heuristic:
  1.2, 3.4, 6, 6.05, 11, 15.9, 15.9, 17.8, 19.7, 21.6, 21.6, 23.5, 23.5
```

The tail is right — `depthOf` returns 14 … 23.5 and seven shells land there.
The head is the heuristic failing: 1.2 is the alley's END WALL (a wall, not a
shell), and 3.4 / 6 / 6.05 are the bodega's corner block and wing, which front
the side street and were misclassified as main-street by a rule about `|x|`.

A guard built on that rule would either fail on objects that are correct, or —
after I "fixed" the rule until it went green — pass vacuously. I stopped there,
because that is precisely what I committed against one commit earlier: *tuning a
threshold until it agrees produces a check that measures the tuning.*

**What it would need.** `ct/street.ts` knows each shell's orientation at the
moment it places it; the scene does not. The same shape as the frontage problem
in `BLOCKED-D` — `Placement` cannot express a 45° face, and a `BoxGeometry`
cannot express which face is the front. If a shell published its facing (a
`userData.facing`, alongside the `userData.mod` stamp it already carries), this
guard becomes three lines and cannot be fooled.

That is a change to my own file and I would make it — but it is only worth
making with a consumer, and the consumer is the guard. Recording it as the next
concrete thing to do here rather than half-building both.

---

# Every lane number I have quoted is the BUILT lane, not the lived one

`a047183e` says this about its own figures and the same lands on mine. I have
written, in commits and in this report:

> *the clear lane is 1.70 m, not 2.00 m* · *15 stretches under 1.20 m before,
> six after* · *three stretches, none graded problem*

All of those come from `lane3.mjs`, which prints `6 moving — citizens and
traffic, dropped` and means it. They describe a pavement **with nobody on it**.

Ran `lanelive.mjs`, which does not drop them:

```
20 samples of the world's narrowest pavement passage
   best 1.12 m · median 0.77 m · worst 0.72 m   (capsule is 0.72 m)
   under 0.90 m in 15 of 20 · impassable in 0 of 20
   built lane with movers dropped: 1.15 m
```

**This does not retract the fixes.** The 0.18 m cushion and the 0.36 m boundary
rail both removed collision that stood on no geometry, and that is true whether
or not anyone is standing there.

**But it changes what the numbers mean, and I stated them as if they settled
the question.** The built lane is a floor; citizens subtract from it. So raising
the floor raises what is left when someone is in your way — *that reasoning is
mine and is not a measurement*: I never measured the lived lane before my
changes, so I cannot say by how much, and I am not going to imply a figure I
do not have.

The rule I should have been following, in `a047183e`'s words: **say which lane a
number describes.** Mine did not. Every lane figure above should be read as
*built*, and the lived median on this street is 0.77 m — which is a busy
pavement rather than a fault, and the two are only confusable if nobody says
which one they measured.

## Source-mutation pass over my guards (5d8a24c13)

`bf820319` routes a selftest to the source mutation rather than the scene one,
and that applies to all three of mine — every selftest I wrote inverts an
assertion *inside the script*. That proves the measurement reads the world. It
does not prove the guard catches a regression in the source. Mutating
`ct/street.ts` and watching each one:

| mutant | guard | result |
|---|---|---|
| `lateAt` returns `eveAt(h)` | windowlights | **fired** — 21:00 evening 1 / late 1 |
| `depthOf` returns 3.4 | shells | **fired** — 18 under 8 m, 1 distinct depth |
| `flankTex` hands out `.clone()` of one texture | shells | **fired**, but only after the assertion was rewritten |
| bodega shell moved to z −60 | D-walk | did not fire — **invalid mutant** |

Two things came out of it worth keeping.

**One guard was blind.** "Returns are not one shared material" counted distinct
`map.uuid`, and `partyWallTex` builds a fresh canvas per call — so 36 returns
make 36 objects however they look. On the clone mutant (every return the same
image, fresh uuids, which is the user's complaint exactly) the uuid instrument
read 19 distinct and passed; the pixel hash reads 3 and fails. Fixed by hashing
24×24 of each texture's own pixels.

**Two mutants were invalid, and an invalid mutant looks exactly like a passing
guard.** `flankTex` with a constant body does *not* make the returns identical,
because `partyWallTex` varies per call beyond its salt — that world really does
have 19 different-looking returns and both instruments are right to pass it. I
read that green as proof of a hole; it was not, and the hole only shows under
the clone. Separately, moving the BODEGA shell does not move the BODEGA door:
`ct/int-bodega.ts` registers the prompt at its own `cz`. **No mutation in my
file can reach D-walk's door legs**, so they remain unproven by this method
rather than proven — if the desk wants them covered, it needs F's file or a
mutation harness that can patch across ownership boundaries.

I also grepped one mutant run down to PASS/FAIL lines and discarded
`reportWorld`'s build banner — GOTCHAS 26, in a check I wrote myself.

Check the mutant is the bug before believing what the guard says about it.

## For B: `userData.noLight` does not opt a material out of `dimWorld`

Found while mutation-testing my own grading assertion, so it is a side effect
rather than an audit — B's file, B's call, nothing of mine depends on it.

`ct/props.ts` has two collectors. `register()` (the lamp-pool path, `lit()`)
checks `if (m.userData?.noLight) continue;`. `dimWorld()` — the one that grades
the whole block down after dark — never looks at `noLight`. It skips only
`isGlass`, `wetMats` and `litSeen`.

Measured: with `noLight` set on the shell flank materials, **26 came back
carrying `noLight` and `graded` together**.

This may well be intended — the comment in `register` says `noLight` is for
"genuinely non-diffuse surfaces … chrome and rubber", and chrome losing the
ambient at night is right even if a lamp should not pool on it. If so the
asymmetry is worth one line at the flag's definition, because the name reads as
"do not touch my colour" and I assumed exactly that when I reached for it as a
mutant. If it is not intended, then chrome and rubber are being graded by
elevation right now.

## Follow-on: my lit sheets were excluded as glass (52b33dd67)

Same investigation. `isGlass` is `m.transparent && !(m.alphaTest > 0)`, and the
window sheets are transparent, so `dimWorld` skips them as glass. Correct
outcome, wrong reason — they are self-lit, not glazing. They now stamp
`userData.selfLit`, which is the documented convention (`ct/paint.ts`) and what
props.ts's own signage path sets. Measured no-op: `graded` stays false, 21:00
warm pixels identical at 2936.

Worth B knowing because it means **`isGlass` is currently load-bearing for
things that are not glass.** Tightening it to actually mean glazing is a
reasonable change to want, and on the day it happens the lit windows would have
started dimming at night with nothing recording that they must not.

## `scripts/lib/materials.mjs` — offered to every builder, adopted by none but me

Four checks hit the same defect this week: `a7f2241d` (nightgrade), `8ceded66`
(the hours sweep), `b39e97c6` (people-walk) and my `shells.mjs`. Same line every
time — `const m = o.material; if (Array.isArray(m)) return;`.

Measured on the live world, independently reproducing `8ceded66`'s figure:

```
5625 materials in 3396 meshes
a naive o.material walk sees 2868 (51%) and misses 2757
528 meshes carry more than one material
```

**Why it keeps happening is structural, not sloppy.** These walks run inside
`page.evaluate`, so there has never been anything to import. Everyone retypes
it, and the multi-material case is precisely the one you forget when the object
in front of you has a single material.

`installMats(page)` defines `window.__mats(o)` in the page — always an array,
no flag, no second code path. `blindSpot(page)` prints the line above for any
check that wants it.

**Adopted in `shells.mjs` only.** The other three are A's and C's files and I
have no mandate there — this is offered, not applied. A grep for the pattern
found ~10 more scripts with a material walk and no array handling; several are
legitimately single-material by construction, so the list needs an owner's eye
rather than a blanket edit. **Desk: worth one line in GOTCHAS pointing at it**,
since the next person to write a check will otherwise make it five.

## Running the house suite: two things that cost me time

**`npm run checks` with no server produced ~20 reds and none of them meant
anything.** The default is `http://localhost:4177/`, `page.goto` throws
ERR_CONNECTION_REFUSED before any check reaches `reportWorld`, and the runner
rendered each as `FAILED (1)` under a footer reading "Something above is red."
Fixed in `5ae9f9955`: the URL is probed once, first, and a dead port stops the
run with the reason and exits 2 rather than 1. The runner already separated
WRONG WORLD from FAILED for the same reason — no world was the missing third
case. **That is the house runner rather than my file; revert freely.**

**Do not commit while the suite is running.** I committed mid-run and every
check after that point reported WRONG WORLD — correctly, because HEAD had moved
out from under the build they were measuring. Twelve reds, all mine, none of
them defects. The guard did exactly its job; I was the one moving the target.

Real state after both: **one red in the project, `doors-declared`, and it is not
mine** — see BLOCKED-D.md, where it changes the wording of my own
recommendation. My three checks are green.

## Settle time: checked, and my readings do not need it

`cd91d251` raised scenedump to a 2 s settle because the grade lerps after a
clock jump and its hash reads material colour. `windowlights.mjs` reads colour
too, so I sampled the ramp rather than assuming either way: warm-pixel counts at
13:00 / 21:00 / 03:00 are identical at 700, 1300, 2000 and 3000 ms, and the
sheet opacities are exact at every sample. `setWindows` assigns opacity straight
from the hour with no interpolation, and the crop is dominated by the sheets
rather than the graded facade. Recorded in the file so the next person does not
re-derive it.

## The settle-ramp list narrows from 90 to "whichever pin a night hour"

`159b9c1c` counted 90 of 129 scripts waiting under 1000 ms after setting the
clock and said plainly it was a candidate list rather than a finding. `D-walk`
and `alley` are on it at 600 ms. **Both clear, and the measurement generalises.**

The world boots at **13:20, fixed** (`crosstown.ts:190` — not the real clock).
So a script pinning a DAY hour is asking for the state it is already in:

```
clock(13,0), 108 shell materials, mean channel
  600ms 2.027835 · 1000 2.027835 · 1500 2.027835 · 2000 2.027835 · 3000 · 4000
```

Pin a NIGHT hour and the same 600 ms is a **coin flip**. Eight cold runs at
`clock(23,0)`, sampled at exactly 600 ms:

```
DAY 2.0278 · night 0.0919 · night · night · night · night · night · night
```

One in eight read the **completely ungraded** world — the day value to four
decimals at a night hour, 22× out. This is not a mid-ramp shade you could
squint past; it is the wrong world. The transition landed between 400–600 ms in
one run and 600–1000 ms in another, so **600 sits exactly on the edge**, which
is the worst place to sample. No intermediate value appeared at any of
200/400/600/700/800/900/1000/1200 ms, so it is a step, or a lerp faster than
that sampling.

### `2558b1ba` has the mechanism, and it is better than mine

Read this section with that one. It measured what I did not: **there is no ramp
at all, and the cost is ONE RENDERED FRAME.** A too-early sample does not catch
a half-applied grade — it returns the PREVIOUS time of day in full, which is
exactly the day-value-at-a-night-hour I was reporting. My "a step, or a lerp
faster than that sampling" was the right shape and the wrong unit: **the unit is
frames, not milliseconds.**

That also reconciles the one place we disagree. They could not make a 600 ms
sleep fail even at 80x throttle; I made it fail 1 in 8. Both hold, because my
eight runs were **cold** — fresh page, `clock(23,0)`, read at 600 ms — and a
cold page's first frame after the jump can land well past 600 ms while the world
is still building. So the hazard is not "600 ms is too short", it is **"a
millisecond count cannot express a frame"**, and a cold load is where that bites.

`lib/clock.mjs` `setClock()` waits two rendered frames and warns rather than
silently falling back. Adopted in all four of mine — `D-walk`, `alley`,
`alleycheck`, `windowlights` — replacing every hand-chosen number. All four
green after.

**The discriminator below still holds and is still useful**, because the reason
a day-hour script is safe is now clearer: the previous time of day IS day, so
the stale read and the correct read are the same value.

**The discriminator, for anyone working the list:** it is the HOUR, not the
wait. Day-hour scripts are unaffected at any settle. Night-hour scripts under
~1000 ms are **flaky, not imprecise** — they will pass repeatedly and then read
a completely different world, which is much worse than being consistently a
little off.

One caution on my own method: a global tint hash cannot answer this. I tried
that first and it flipped between three values non-monotonically at 600 / 1000 /
1500 / 2000 / 3000 / 4000 ms, because something animates forever — the casino
chase, which is what `cd91d251` already concluded. I had to isolate 108
materials I know are static before the signal was readable.

## D-walk under load: tested, and NOT changed

`9deaf1ce` is the third fixed-duration-wait fix this session — *"walks until it
stops, not for 1600 ms: 3/12 green under load → 12/12"*. `D-walk` is my longest
check and has eleven `waitForTimeout` calls, so it is an obvious suspect.

Ran it three times with 25–38 chromium processes live on the machine. **First
attempt: 3 of 3 FAILED — and it was not a flake.** It was the wrong-world guard,
because I had rebased and `dist` was one commit behind. Fourth time this session
I have done that. Rebuilt and re-ran: **passes under load.**

So there is **no evidence of a flake in D-walk and I have not rewritten it.**
Its door legs already use the right pattern — `for i < steps: hold(); wait;
got = prompt()` loops until the prompt appears rather than sleeping a guessed
duration. The fixed waits that remain are for the camera and for a citizen to
move on, which are weaker but unproven.

Recording the negative result deliberately: a speculative rewrite of an 81 s
walking check, justified by someone else's flake in a different file, is churn
with a plausible-sounding reason. If it flakes, the log will say so and the fix
is `9deaf1ce`'s.

## Mover audit of my own probes, after `362ab354` did the same

My finding that the "mid-pavement post" was a walker prompted `362ab354` to
audit its probes for mover-handling. The reflexive move is to audit mine rather
than assume they were clean, so:

| script | movers | evidence |
|---|---|---|
| `builtlane` | dropped, deliberately | two snapshots 1.5 s apart; identical verdicts over two runs |
| `lane3` | dropped | its own header says so and prints the count |
| `lanelive` | **included, deliberately** | it exists to measure the LIVED lane; already labelled |
| `windowlights` | not sampled | 0 / 2936 warm px, byte-identical over three independent runs |
| `alleycheck` | not sampled | 8 assertions identical over two runs |
| `shells` | not sampled | 7 assertions identical over two runs |

`windowlights` was the one with real exposure, since it counts pixels off a
camera and a citizen crossing the frame would land in the count. It does not:
the crop is the upper 42% and left 64%, which is above street level. Three runs
returning exactly 2936 is stronger evidence than the reasoning, and it is the
reason I ran it rather than argued it.

Nothing changed as a result. Recording it because "I checked and it was fine" is
only worth anything if the check happened, and the table says which measurement
backs each row.

## Stopwatch sweep of my own probes, after `3dff741e` and `104c7f38`

Two builders swept their probes for the pattern `81603988` named: a threshold on
**how far or how long** something went, where the invariant is **whether it got
stuck**. `3dff741e` records where it is *not*, which is the part worth copying.

**No stopwatches in mine.** `D-walk` is the only one that walks, and it asserts
on the PROMPT rather than on distance — `for (i < steps && !got) { hold('w');
got = await prompt() }` loops until the condition appears and then checks the
building's name. That is already the shape the other two converted to. No
assertion anywhere in my five checks reads a distance or a duration.

The honest residue is **magnitude thresholds**, which are a different animal, and
what matters for those is the margin between the number and the world:

| assertion | threshold | actual | basis |
|---|---|---|---|
| walk not sealed | 0.72 m | 1.12 m | the capsule — the body, not a choice |
| walk not a trap | 0.95 m | 1.12 m | `ct/gap.ts` `PASSABLE`, the project's own line |
| cereal runs out | 5–6 | 5 | arithmetic: $14.50 / $2.50 |
| church steps climb | gy > 0.45 | 0.55 | kerb is 0.14; the invariant is "not still on the pavement" |
| no shell is a flat | 8 m | 14 m | a room's depth; deliberately NOT `depthOf`'s own floor of 14 |
| noon is dark | < 200 px | 0 | absolute on purpose — a relative test passes an all-dark world |
| night is lit | > 1500 px | 2936 | same |
| alley floor grain | ≥ 20 px/m | 23.9 | the defect was 9.7; neighbours run 14–32 |
| returns not uniform | ≥ 12 | 19 | **the weakest number here — chosen, not derived** |

Eight of the nine have either a physical basis, an arithmetic one, or a margin
wide enough that a sound world cannot drift into them. **`≥ 12 distinct flank
textures` is the one I would not defend that way**: 19 of 36 faces today, and a
builder who legitimately reduced variety to eleven would get a red that says
nothing. It is guarding a real defect — every return the same brown, raised
twice — so it stays, but it is a chosen number and this is it being written down
rather than discovered later.

## My landed work, checked in the world the user actually plays

`SHOT_WORLD=integration` (which I added for `BLOCKED-H` §4) finally lets a
builder ask this, so I asked it of my own area against the live `:5177` build:

```
alleycheck   8 PASS   builtlane   5 PASS
shells       7 PASS   windowlights 5 PASS
```

**25 assertions, 0 failures, in mainline-plus-every-builder.** That is the first
evidence I have that my area holds up outside my own worktree.

### And it made me reverse a decision of mine

The first run was 21 PASS / **4 FAIL** — one per check, all the same string:
`WebSocket closed without opened`. That is the HMR socket, which
`live-integrate.sh` drops every 15 s when it rebuilds.

I had chosen to *warn* about it in the banner and leave each check's error list
alone, arguing that a filter which swallows one known message is how the next
real one gets swallowed. **The reasoning was right and the outcome was still
wrong**: four checks out of four reporting a red every single time teaches you to
skip the red, which loses more errors than the filter ever would.

So `integrationNoise()` **reclassifies rather than swallows** — only in
integration mode, only that one message, and deliberately a string match on the
known text rather than a pattern over WebSocket errors in general, so that if the
message ever changes it stops matching and the red comes back. Verified both
ways: 0 failures in the live world, and an injected `a real defect` in the same
mode still fails.


## My texture instrument was blind a second time, and hashing was the wrong idea

`2e7f51c0` records that `ct/paint.ts`'s `dither()` paints with **unseeded
`Math.random()`**. That is the thread that unpicked my own uniformity check.

`shells.mjs` asserts "returns are not one shared material". It has now been
wrong twice:

1. **counting `map.uuid`** — counted allocations, not appearances. Fixed by
   hashing pixels.
2. **hashing pixels exactly** — two walls painted from IDENTICAL parameters
   still differ by dither speckle, so they still hash apart.

Measured, mutating `flankTex` so every return is painted from one set of
parameters:

```
                      clean world   every flank identical
    exact pixel hash      19               19      <- blind
    mean colour           19                5
    coarse 4x4 blocks     15                4
```

**`5d8a24c13`'s comment says that mutant "genuinely has 19 different-looking
returns and BOTH instruments are right to pass it". That was wrong.** They are
the same brown with different dust on it, which is the user's complaint exactly.

### Quantising did not fix it either

The obvious repair — quantise the block means so speckle cannot change the
bucket — still read **17 of 36** on the mutant. Quantisation does not make a hash
robust; it moves the sensitivity to the bucket edges, and with 48 numbers per
wall something always sits near one.

Worse, my first quantised version averaged R+G+B into one luminance and stepped
at 32. That absorbed the speckle **and** the alley's two flanks: `#623f32` and
`#563a2f` land in the same bucket, so a check whose entire job is to prove those
two walls differ reported one. **Throwing away hue to beat noise threw away the
signal with it.**

### "Are these the same wall" is a distance question

So the descriptor is raw 4x4 block means per channel, and walls are grouped by
distance. Both numbers are measured, not chosen:

```
same wall, two page loads   max block-mean drift  2.22 / 255   <- the speckle
alley north vs south        max block-mean diff  20.17 / 255   <- real difference
threshold                                         6
```

Clean world 19 walls across 36 faces; the identical-parameters mutant now reads
**3 and fails**, and the alley's same-painter mutant reads **1 and fails**. Both
selftests still pass.

The general lesson, which cost me two rounds: **an exact hash answers "are these
byte-identical", and I kept asking it "do these look the same".** Those come
apart the moment anything in the paint is random.


## Two margins worth naming, after `1a9e0ed9`

That commit separates *"passed by exactly zero"* (a hazard) from *"passes by zero
on purpose"* (fine). Both exist in my checks and they are not the same thing.

**On purpose:** `alleycheck`'s rear wall reads *17.2 m against the taller
neighbour at 17.2 m* — equality, every time. `END_H = max(neighbour tops)` and
every building on the west run is the same height, so equality IS the design and
a 0.05 epsilon absorbs float. It would be wrong for this to pass by a margin.

**Not on purpose, and now fixed:** the clustered wall count read 19 five times
and 18 once. The distribution says why — all 630 pairs among the 36 faces:

```
0.0  x17     <- the two faces of one shell, which share a material object
(nothing at all between 0 and 6)
6:12  7:12  8:12  9:16  10:16  11:8  12:24  13:16  14:20 ...
```

The same wall re-read across page loads drifts at most 2.22. So the gap is
**[2.22, 6.0]** and I had put the threshold at **6** — the lip of the first
populated bucket, with a dozen pairs sitting on it for speckle to push across.
**A threshold on the edge of a cluster is not a threshold.** Moved to 4: 1.8
above the noise, 2.0 below the nearest real difference. Five runs, 19 every
time, and the identical-parameters mutant still fails.

The verdict was never in danger — `>= 12` against 18 or 19 is the same answer —
but a headline number that moves on an unchanged world is exactly what teaches
people to stop reading it.

## `reportWorld` now exits 3, so an abort stops looking like a failure

`BLOCKED-H` (`e0b0c5fd`) asked for this and could not patch it — *"lib/which-world.mjs is not mine, so this is a request rather than a patch"*. It is a
request I had already paid for four times in one session, most sharply when
`D-walk` read **3 of 3 FAILED** under load and every one of them was this guard,
not a flake.

An unhandled throw exits 1, which is what a failed check exits with, so *"the
build moved under me"* and *"the world is broken"* arrive as the same status.
H's `feet-check` red could not be shown to be a rebuild-mid-run because only the
status survived.

Now:

```
matching build        exit 0
mismatched build      exit 3     <- was 1
real assertion fail   exit 1
```

3 because 2 is taken — `checks.mjs` exits 2 for "nothing is serving that URL",
and INCONCLUSIVE is 2 across H's probes. `process.exit` rather than a code plus
a throw, because node forces 1 on an uncaught exception and would overwrite it.

`checks.mjs` now reads the status first and keeps the banner string-match as a
fallback, so nothing that predates the code regresses.

## The correction to my wet-night figure was itself wrong: it IS -83%

**Read this before the section below, which is now history.** I "corrected"
-82% to -43% and the correction was the error.

The corrected figure used a *stepped* dry baseline of 0.01335. Stepping went
through 20:00, and **20:00 rained** under the rainAt of that day — so my "dry
night" was a wet night, and dividing by it flattened the ratio.

Re-measured with `setNight` now choosing a genuinely dry evening hour, and a
full 20 s wet settle at each end:

```
23:00 dry night    alley floor tint 0.04500
01:00 wet night    alley floor tint 0.00768
                                    -83%
```

**So the original -82% was right all along**, and the thing that made it look
wrong was the same contaminated tool that produced the withdrawn jumped-clock
finding. One bad helper corrupted a measurement, then corrupted the correction
to that measurement.

What actually fixed it was repairing the tool rather than re-reading the
numbers: once `setNight` picked a dry hour, the right answer fell out
immediately. **A correction is only as good as the instrument that produced
it**, and I applied more scepticism to the original figure than to my own
revision of it.

## (superseded) CORRECTION: my wet-night figure was -82% and is -43%

I published *"all three darken -82% on a wet night"* while checking `e24c959a`'s
lightening concern. That was measured with a **jumped clock** — three rounds
after I wrote `notes/D-jumping-the-clock.md` telling everyone else not to.

Re-measured both ways:

```
dry night 23:00   jumped 0.04500    stepped 0.01335    <- 3.4x apart
wet night 01:00   jumped 0.00768    stepped 0.00767    <- identical
```

So the true darkening is **-43%**, not -82%. The wet number was right all along;
the DRY BASELINE was 3.4x too bright, and dividing by it inflated the result.

**The asymmetry is the interesting part.** The wet-night reading is
path-independent to five decimal places, and the dry-night reading is not. So
"how much does rain darken this at night" depends entirely on getting the dry
baseline right — and a jumped baseline exaggerates the effect. Anyone quoting a
wet-vs-dry ratio after dark should step both ends.

What does NOT change: `e24c959a`'s concern was that the wet look could *lighten*
a dark surface. It does not, in either measurement, on any of my three floors.
The conclusion stands; only the magnitude was wrong.

## Rain sweep of my module after `b209275c`: 3 of 3, and the reason is structural

`b209275c` found *"the road centre lines stay bone dry while the road darkens
83%"* — horizontal decals that miss the weather, which is the class my alley
floor was in until `5333a1ce`. So I swept my own rather than assume the one I
fixed by eye was the only one.

**Three horizontal ground planes in `mod=street`, and all three darken in rain:**
the alley floor and the two open-site grounds (park and car lot).

Three is a small number and that is the interesting part. **My module has almost
no horizontal decals because its ground detail is painted INTO the ground
texture** rather than laid on top — the alley's nine stains and its 0.4 m gully
with bars are `fillRect` and `fill()` calls inside `alleyFloorT`, not separate
planes. So they inherit the floor's wetness for free and the road-markings class
cannot arise for them.

That was not a decision I made for this reason; `seam-audit.md` finding 4 pushed
the alley floor onto one dense canvas because the detail was reading as smears.
It happens to have removed a whole category of weather bug as a side effect,
which is worth knowing before someone "improves" those stains into decals.

Negative result, recorded so nobody sweeps it twice. Box tops (kerbs, sills) are
a different question and mostly other people's.

**Confirmed from the other side by `21c42a66`**, which measured my tarmac while
chasing its own decals: *"the tarmac under them (D's, via openSite) 1.000 ->
0.256, -74%"*. Independent measurement of my surface by its consumer.

And the three agree exactly with each other, which is what says my alley-floor
fix was complete rather than partial — sampled at one moment, 13:00 dry against
15:00 raining:

```
open site 32x30 (park)   1 -> 0.1938   -81%      <- under-settled, see below
open site 23x23 (lot)    1 -> 0.1938   -81%
alley floor              1 -> 0.1938   -81%
```

**Those three were read at ~9 s and the wet look takes 16 s.** `baa675d7`
measured that on the road; here is the same curve on my alley floor, which
converges in the same place:

```
2s 0.5864   4s 0.3291   6s 0.2253   8s 0.1891   10s 0.1768
12s 0.1726  14s 0.1712  16s 0.1707  18s 0.1705  20s 0.1705  24s 0.17043
```

Read at 7 s it is **-77%**; converged it is **-83%**. So the figure above is
-83%, not -81%, and the pixel figure I published alongside it — *"54.5 -> 34.4,
-37%"*, also under-settled — is **54.4 -> 33.0, -39%**.

The correction is small because 9 s is most of the way there. It is worth making
anyway: I quoted those numbers to argue my fix was complete, and a number that
happens to be nearly right is not the same as one that is.

Before `5333a1ce` the alley floor sat at 0.825 in the same comparison while the
other two went to 0.19. It is now on the same footing as the ground it abuts.

## Verified in the world the user plays, after everything moved underneath me

`B`'s `isGlass` split, my `alphaTest`, the wet alley floor and the exit-3 change
all landed in the same stretch, so I re-checked my area against the live `:5177`
build rather than assume they composed.

```
alleycheck 8   builtlane 5   shells 7   windowlights 5   midnight 2
27 assertions, 0 failures, all exit 0
```

And **looked**, because assertions cover the graded state and my last two fixes
were about appearance. The integrated night alley (`:5177` build stamp `c774de0d` — an integration
build, not a commit anyone can resolve) has the tags sunk
into the wall where they belong. The crates are still vividly blue against
near-black brick — that is `props`'s remaining 50, which `midnight` counts and
does not assert on, and it is visible confirmation that the count is describing
something real rather than an accounting artefact.

One caution for anyone doing this: `alley.mjs` writes to `shots/`, so running it
against `:5177` **overwrites your worktree's frames with the integration
world's**. They are gitignored, so nothing is committed, but a shot you then
compare against is somebody else's build. Re-ran against my own port afterwards
to put them back.

## `userData.selfLit` is documentation, not control — confirmed by mutation

Tried to prove `midnight.mjs` would catch my lit sheets losing their `selfLit`
stamp. **It does not, and chasing why turned up something better.**

Removing `m.userData.selfLit = true` from `ct/street.ts` changes the flag and
**nothing else** — the sheets' colours at 21:00 are identical either way.
`ct/props.ts` decides self-lit for itself with `isSelfLit(m.map)` and uses its
own answer for `floor: selfLit ? FLOOR_SIGN : floorFor(y)`. **My stamp is an
output, never an input.** I suspected that when I added it (`52b33dd67` says the
grader "does not read it") and this is the mutation that proves it.

So `midnight` cannot catch that regression, and it is right not to: the stamp
does not control anything, so losing it is a documentation loss, not a
behaviour one.

### And B's `isGlass` split changed which of my sheets get graded

Before, every lit sheet was skipped as glass. Now `dimWorld` reaches them, and
`isSelfLit(m.map)` recognises 28 of 34. The other **6 are graded like ordinary
geometry**, 4 of them visible at opacity 1 with luminance **0.054** — lit
windows whose colour is nearly black.

**Measured before calling it a defect, and it is not one.** Forcing those 4 back
to white:

```
camera down the street   4864 -> 4932 warm px   +68   (+1.4%)
camera in front of them 10576 -> 10586 warm px   +10   (+0.09%)
```

Negligible from both viewpoints, and `windowlights` is unchanged at 2936. So the
inconsistency is in the data and not in the picture. **Not fixing it**: holding
them bright means `isSelfLit`'s heuristic recognising those six textures, which
is `ct/props.ts` and B's call, and there is no visible symptom to justify asking.

Recorded because the next person to see `selfLit: true` sitting beside a dimmed
colour will think one of them is a bug, and neither is.

## What my six checks demonstrably catch, mutation by mutation

`dfa71d18` and `df02aeb6` recorded this for their suites. Mine was scattered
across a dozen commits and six file headers; here it is in one place. **Every
row was run, not reasoned.**

### Fired

| check | source mutation | result |
|---|---|---|
| `shells` | `depthOf` returns 3.4 | 18 under 8 m, 1 distinct depth — FAIL |
| `shells` | `flankTex` hands out `.clone()` of one texture | 3 distinct walls — FAIL |
| `shells` | `flankTex` paints every return from identical parameters | 3 distinct walls — FAIL *(after the descriptor was fixed; the exact hash read 19 and passed)* |
| `shells` | `dimWorld` skips arrays (a7f2241d's bug, in the world) | 0 of 108 graded — FAIL |
| `shells` | flank materials go transparent | 82 of 108 graded — FAIL |
| `alleycheck` | `END_H` back to a fixed 3.5 m | rear 3.5 m vs neighbour 17.2 — FAIL |
| `alleycheck` | alley floor back to 9.7 px/m | 9.7 px/m — FAIL |
| `alleycheck` | both flanks from one painter | 1 distinct wall — FAIL |
| `builtlane` | boundary-rail **collider** 0.9 m into the walk | 0.92 m, three sections — FAIL |
| `windowlights` | `lateAt` returns `eveAt(h)` | 21:00 evening 1 / late 1 — FAIL |
| `midnight` | clock pointed at 13:00 instead of 23:00 | control FAIL *(and the main assertion still PASSED — which is the point of the control)* |

### Did not fire, and why — the more useful half

| check | mutation | why it proves nothing |
|---|---|---|
| `builtlane` | boundary-rail **mesh** 0.75 m into the walk | `street.ts` registers that collider separately; I changed the wrong fact. Scope now stated in the file. |
| `D-walk` | BODEGA shell moved to z −60 | `ct/int-bodega.ts` registers the prompt at its own `cz`. **No mutation in my file can reach those legs** — unproven by this method, not proven. |
| `midnight` | `alphaTest` removed from the alley tags | `34a3ed95` fixed the cause at the root, so the defect is no longer reachable from my file. Best possible reason for a mutation to stop working, worst possible reason to call a guard proven. |
| `midnight` | `userData.selfLit` removed from the lit sheets | the stamp is an **output**, never an input — `props.ts` decides with `isSelfLit(m.map)`. Colours identical either way. |
| `shells` | `flankTex` body replaced with a constant | does **not** make the returns identical: `partyWallTex` varies per call beyond its salt. I read its green as proof of a hole and was wrong. |

**Two of the eleven "fired" rows only fire because an earlier version did not.**
The uuid counter and the exact pixel hash both passed the uniformity mutant. A
check that has never been watched failing on the defect it names is a check with
an unknown value, and in both cases the unknown value turned out to be zero.

## Car lot — the z-span C asked for, and the see-through watch

The item: *"Report the exact z-span through the desk when you commit; C is
waiting on that number and cannot start without it."* C has since built
`ct/lot.ts`, so they got it, but the number was never written where the desk
reads. Measured from the ground plane at HEAD:

```
LOT    x  7.00 .. 30.20     z  -9.00 .. 14.20     23.20 x 23.20 m
PARK   x -39.00 .. -7.00    z -98.00 .. -68.00    32.00 x 30.00 m
```

**The lot's z-span is -9.00 to 14.20.** 23.20 m is CAFE 11.2 + HARDWARE 12
exactly, so the EAST-before-No.227 total of 49.2 is preserved by construction
and `ct/apartment.ts`'s pinned walk-up door does not move.

### The watch: you cannot see through one gap to the other

*"this is the second gap in the block's walls after the park — check you cannot
now see straight through one to the other."*

**You cannot, and it is not close.** The park occupies z -98..-68 and the lot
z -9..14.20 — the two ranges do not overlap by any amount, and there are 59 m of
built street between the nearest edges. A sight line through both would have to
run along the street rather than across it, and neither gap opens that way.

`D-walk` and `builtlane` both green at HEAD.

## The roofs are flat colour, and it does not matter — checked before changing anything

The building-depth item warns: *"rooflines become visible from the street once
buildings are deep — that is a gain, not a cost, but it means the roof needs to
be worth seeing rather than a flat slab."*

**The code says it is a flat slab.** `roofM = new THREE.MeshBasicMaterial({ color:
0x2b2d33 })`, in five separate places, no map on any of them.

**The world says you cannot see it.** Shot from the two places the item names —
standing in the park looking at the flank that borders it, and on the pavement
looking up at the block:

- from the park, the flank rises to a **capped parapet** and steps up in the
  middle; no roof surface is in frame at all
- from the street, same — facades, cappings, sky. The roof plane sits behind the
  parapet everywhere.

There is no elevated public vantage in normal play either: jump and crouch do not
reach it, the church steps rise 0.55 m, and the walk-up's stairs lead to an
interior.

**So no change.** Texturing five roof materials nobody can see is invisible work,
and I would have done it on the strength of the code alone.

That is the specific mistake I made one commit earlier with the park's back wall,
where I read a call site, assumed `wallTex` meant plain brick, and "fixed"
something that was already right. Reading the definition told me the roofs really
are flat; **looking** told me it does not matter. Both steps were needed and
neither substitutes for the other.


## The 37 user shots, and the two alley ones nobody had opened

Finding `user-bodega-corner.png` — after twice recording that I could not compare
against what the user saw — showed me `shots/` holds **37 `user-*` reference
images**, fifteen of them in my area. I had been working from four.

Opened the two alley ones:

**`user-alley-junk.png`** is the floating-litter evidence: the blue crates and
the cardboard reading vivid against near-black ground. Already B's, already being
worked (`0d9146049`, `cc45d7427`).

**`user-alley-panel.png`** shows the REZO wall close up, with two small **red
slivers at the wall's left edge**, top and bottom. Still live at HEAD — I shot
the same framing to check.

Identified: `mod=street`, `rgb(106,5,4)` at `(-6.90, 4.16, -29.00)`. It is a shop
awning on the building north of the alley, projecting 0.1 m past the facade line,
seen past the edge of the alley's north flank. **Geometrically that is correct**
— from the alley mouth you should see the next shop's awning — so unless the user
says otherwise this is not a defect, and I am not changing it.

**A probe of mine failed first, in a way worth recording.** I filtered candidate
meshes on their world POSITION and found nothing but a ground prop. A shell 14-23
m deep centred at x -15 has its face at x -7, so filtering on centres missed every
building on the block. Re-run against bounding boxes, the awning appeared at once.
Position is not extent, and for deep geometry the difference is the whole object.

## Re-shot the bank flank from the user's own framing

`user-bankflank.png` is the complaint raised twice: pale precast front meeting
brown brick at a sharp arris, reading as two buildings. Shot the same framing at
HEAD rather than trusting that my `bankReturn` work closed it.

**The pale/brown juxtaposition is still in that frame, and it is not the
defect.** The brown in it is large ashlar blocks with a downpipe — the
**LIBRARY**, the next building along, which `ct/street.ts` says in as many words
must differ: *"It also stands beside the LIBRARY, the other stone building on
this side, and must not read as the same institution. The library is warm worn
ashlar with arched openings and forty years of soot; the bank is cool grey
precast, dead flat, square-headed."*

So two materials meeting at a vertical arris is correct **there** — it is a
property line between two institutions, which is what a street is. The defect
the user reported was the same building wearing two materials, and that is what
`bankReturn` fixed by carrying the front round the first bay before it becomes a
party wall.

**Worth recording because the two are indistinguishable from a photograph.** A
future reader comparing `user-bankflank.png` against HEAD will see pale-meets-
brown in both and conclude nothing changed. What changed is whose brown it is.


### RETRACTED: "the brown is the library" was my eyeball against someone's raycast

`ct/street.ts` says, at the north cap:

> *"THIS is the object in `shots/user-bankflank.png`, not the bank. It used to be
> a 30 m box at z 13.5…19.5 while the bank runs to z 14.2, so the two shells
> INTERPENETRATED by 0.7 m … Raycasting from that screenshot's camera hits this
> box on every ray; the bank's own returns are behind it."*

**That is a raycast from the user's own camera. Mine was a look at a
screenshot.** Theirs wins, and the geometry backs it:

```
street  x -22.9..-7.0   z  -5.0..14.2   the bank
civic   x -13.6..-10.2  z -10.5..-5.0   the library, SOUTH of it and set back to x -10.2
street  x  -7.0..7.0    z  14.2..20.2   the north cap
```

The library is south of the bank **and 3 m behind the building line**, so it is
not what meets the bank's front at an arris. The cap is north, spans the whole
street, and used to stand *through* the bank's precast by 0.7 m — which is
exactly the "different building meeting it at a razor arris" the user
photographed.

**So the defect in `user-bankflank.png` was the cap interpenetrating the bank,
and it is fixed** — the cap abuts now and is only as wide as the gap it closes.
My re-shot two rounds ago found brown beside pale and I named the wrong object;
what I saw from those cameras was a different building on a different side.

The paragraph below still stands on its own terms — the bank and the library
*are* deliberately different materials — but it is not the explanation of that
screenshot, and I published it as though it were.

### `user-bank-vs-library.png` confirms it from the other side

Opened the next reference in the same subject. It is build `e78e5ec1f` and shows
the library as **pale cream stone with arched openings**, and the filename says
what the user was doing: comparing it against the bank.

That is the complaint my own code comment answers — *"it stands beside the
LIBRARY … and must not read as the same institution"* — and it is why the bank
became cool grey precast, dead flat and square-headed while the library kept
warm worn ashlar and arches.

So the two references bracket the same fix from opposite sides:

- `user-bank-vs-library.png` — they read as **too alike**
- `user-bankflank.png` — one building read as **two**

Both are answered at HEAD, and the pale-meets-brown still visible in the second
frame is the boundary between them, which is the point rather than the bug.


## E's park topography against my site ground: checked, no conflict

`9890a47ee` gave the park a mound, a dish and ground falling to a corner. My
`openSite` lays a **flat** ground plane for that site, so the two could fight.

Bounding boxes said they might: E's new pieces span **y 0.057 .. 0.454** and my
site plane sits at **y 0.140**, so parts of their contoured ground are below
mine and my flat green would poke through.

**Looked, and it does not.** Two views from inside the park, one at ground level
across the contours: the ground reads continuous — mown stripes, a worn dirt
patch, the path — with no flat edge slicing a mound and no z-fighting anywhere.
E's contours sit above my plane where it matters, and the 0.057 minimum belongs
to something with a low edge rather than to a surface that competes.

That is the third time this pattern has run in as many rounds: the geometry or
the constants imply a defect, and the picture does not have one. Roofs, the park
back wall, this. **The cheap check is the bounding box; the true one is the
frame**, and only the second can tell "overlaps in y" from "visibly wrong".


## Regression pass after a heavy upstream week, and the cat re-checked properly

The park gained topography, the litter work landed, `isGlass` was split, `rainAt`
was replaced, `nightFactor` was published. All of that is under my area. Re-ran
everything at HEAD:

```
alleycheck  builtlane  shells  windowlights  midnight  D-walk     all green
```

and re-shot the alley in all four conditions.

**The cat, re-checked from the right place.** I verified my move from the alley
MOUTH. The user's criterion was *"findable from the street without being the
first thing you see"* — so I shot it from the pavement, which is where a player
meets it.

It holds: from outside, the dumpster and the three tags are what you see, and
the cat is a small dark shape beside the dumpster that resolves on a second look.
Worth doing, because "beside the dumpster" could equally have produced a cat that
fills the alley mouth, and from inside the alley I could not have told.


## The road-can-never-light finding does not have an analogue on my frontages

`071e4fd27` found the road is one 134 m mesh whose origin sits 12.3 m from any
lamp, so it can never take a light pool. My facades are far larger than the
`span < 6` a pool requires, so they are not poolable either — by design:
`props.ts` says warming a 12 m facade off its centre point would be wrong, and
long walls get the **wall splash** instead, which is per-lamp and correctly
placed.

So the question for my area is whether the splash actually reaches my frontages.
Measured at a stepped 23:00, the runs and their gaps:

```
west  covered -110..-98  -94.7..-91.3  -68..-43.5  -38.7..-21  -10.7..-7.3  -5..14.2
east  covered  -96..-86  -80.7..-77.3  -68..-8.9
```

**Every gap is a real gap in the wall line, not a hole in the lighting.** The
23.3 m one is the park, the 4.8 m one is the alley, the rest are the side
streets and the set-back civic frontage — I probed the largest unexplained one,
west z -21..-10.7, and there is no wall there at all: my shells end at z -21, the
bank starts at -5, and the only things on that line are props.

No defect, and no analogue of the road's problem here. Recorded because "the
splash has gaps" looks alarming in a table and is the correct behaviour.


## Tint audit of my six checks: one was wrong, and it is the one I fixed

Having found that `material.color` is a tint rather than a brightness, I swept my
own instruments rather than assume `midnight` was the only one.

| check | what it reads | verdict |
|---|---|---|
| `shells` | `m.color` **only as an existence test**; distinctness from texture pixels | fine |
| `alleycheck` | texture pixels, canvas size, bounding boxes | fine |
| `builtlane` | colliders and geometry, no colour at all | fine |
| `windowlights` | pixels off the **rendered frame** | fine, and the best of them — the frame already contains tint × texture × light |
| `midnight` | tint alone | **was wrong; now tint × texture × opacity** |
| `D-walk` | prompts and positions | fine |

### The distinction that makes `midnight`'s control still correct

`midnight` asserts a control on the alley flank's **tint** being under 0.2, and
that is right even though tint is the wrong measure for brightness. The control
asks *"has the grader run"*, and the tint is exactly what the grader changes.

**Same field, two different questions.** Tint answers "was this graded"; only
tint × texture × opacity answers "is this bright". Reading the first as the
second is the error, and it is not a reason to stop reading tint where the
question is grading.


## "The three floors agree exactly" — scoped, and a stale hour in my own probe

`f29e7355e` corrected a ground-vs-ground comparison it had called sound. I made
one: *"the three floors agree exactly with each other, which is what says my
alley-floor fix was complete."* Three different materials, three different
textures — so the question is what "agree" was claiming.

Measured at a currently-wet hour, tint against appearance:

```
                tint      texture   on screen
park ground     0.1705    0.395     0.0673
lot ground      0.1705    0.298     0.0509
alley floor     0.1705    0.181     0.0308
```

**The claim survives because it was a GRADING claim.** The three receive an
identical wet factor — 0.1705 on all of them — which is precisely what the fix
was for: the alley floor now gets the same treatment as the ground it abuts.
They do **not** look alike, and should not: park grass, lot tarmac and alley
asphalt differ by up to 2.2x on screen, because their textures differ.

Same distinction as `midnight`'s control. Tint answers *"did the same treatment
reach all three"*; only tint × texture answers *"do they look alike"*. I was
asking the first.

### And my probe was measuring a dry world

The first run of this measurement reported **tint 1.0000 in the rain** — no
wetness at all. `rainAt` was replaced by `e0c68e46` and **15:00 is no longer a
wet hour**; the current wet hours are 0, 1, 10, 14, 16, 17, 21. My probe
hard-codes 15:00 because that was raining when I wrote it.

Everything I published from it was measured while 15:00 still rained, so those
figures stand — the -83%, the settle curve, the three-floor table. But **any
re-run of that probe today silently measures dry weather and would look like the
wetness had been removed.** The 0.1705 here matches the settle curve's 0.17043
exactly, which is what confirms the old numbers rather than my memory of them.


## The empty-world class, tested across all six rather than read off the code

Four builders have now found checks that exit 0 having asserted nothing
(`32d9d6521`, `ae7a30bba`, `7d199bdf3`, `80b6abfe6` — that last one watched
`footprint` pass with ZERO tree pits). I fixed `builtlane` for it. Then I
*claimed* the other five were guarded, having read their code.

Reading is not watching, so I emptied what each keys on:

| mutant | check | result |
|---|---|---|
| drop `userData.facing` | `shells` | **FAIL** — "1 carry a facing stamp", plus two more |
| drop `userData.alley` | `alleycheck` | **FAIL** — "0 stamped 'end'", plus two more |
| drop `userData.litSheet` | `windowlights` | **FAIL** — "sheets stamped: NONE — is street.ts stamping litSheet?" |
| drop the alley flank stamp | `midnight` | **FAIL** — "no graded reference material found" |

All four fire, and `windowlights` prints the diagnostic I wrote for exactly this
case, naming the file that should have stamped it.

**`midnight` is the interesting one.** Its population assertion is vacuously true
on an empty world — "nothing of mine is bright" passes when there is no "mine" —
and it still fails, because the **control** fails. That is what the control was
for: a separate thing that has to be true for the main assertion to mean
anything. It was added to catch a wrong hour and it catches an empty traverse
for free.

So of my six, one could pass on an empty world and now cannot; the other five
were guarded, and I have now seen each of them refuse rather than assumed it.


## The one threshold I would not defend is now derived

`cd959c8d1` turns GOTCHAS §34 the other way up: **a threshold that makes a
correct world fail.** I had already named my instance in the stopwatch sweep —
`shells`'s fixed `>= 12 distinct flank textures`, where *"a builder who
legitimately reduced variety to eleven gets a red that says nothing"* — and left
it, because it guards a real defect.

Leaving a known-bad threshold in place was the wrong call once the class had a
name. What the assertion actually means is *"most buildings wear their own
wall"*, so it now scales with how many buildings there are:

```
bar = max(3, floor(shells * 0.8))      18 shells -> 14, world reads 19
```

12 was chosen against a block that happens to have 18 shells. A block half the
size would put the bar at 7 rather than failing on a number that outlived its
block.

**Still catches the defect:** the identical-parameters mutant reads 3 against a
bar of 14 and fails. Selftest 5 of 5.

That is the second threshold of mine to be replaced by a derived one, after the
car lot's depth became `depth: w` instead of a hard-coded 23.2. The pattern is
the same both times — **a constant that was measured off today's world, and
would be wrong about tomorrow's.**


## Density, run against my module rather than assumed

`8226f7e24` had a builder's own textures break `density` in the act of citing the
density mandate, which is a good reason to run it rather than trust that my
masonry work still holds.

```
DECLARED masonry: 241 faces carry a masonry() stamp
  by declared ppm: 8:201  16:39  32:1
  every one is mapped to the face it was painted for (within 2 %)
exit 0
```

Passes. The `16 px/m` group at the shopfront bands is `SHOP_MULT = 2` doing what
it says, and the px/m table below it is labelled in the check itself as the old
shape-based view and *"not a fault"* — worth knowing before reading that table as
a list of problems, which is what it looks like.

Nothing to fix. Recorded so the next person does not re-run it to find out.


## Project state at HEAD, from the pinned runner

Ran the fast tier against a pinned checkout so nothing could move under it:

```
44 green · 2 red · 0 WRONG WORLD
```

**Neither red is mine, and I checked rather than inferred from the names:**

- `checks-registered` — `G-rooms-walk.mjs`, `G-vice-walk.mjs` (G's) and
  `floatlit.mjs` (B's) have selftests and are in no tier, so they run never.
- `no-silent-pass` — `lamplight.mjs`, `parking.mjs`, `truck.mjs` exit 0 on an
  unknown mode word.

My six are green, and none of them appears in `no-silent-pass`'s list because
that check examines scripts which **dispatch on a mode word** and mine take a
boolean `--selftest`. They are covered anyway: I added the unknown-argument
guard independently this session, so a mistyped flag exits 2. Worth knowing that
the coverage is coincidental rather than earned — a mode-dispatching script of
mine would not be watched by that check today either.


## The request log read the other way: every alley item traced to its latest word

`533859821` and `4b1bc6404` audit the request log **backwards** — from what was
asked to what is built. Doing that for my area turned up two entries that look
like unbuilt requests and are not:

| entry | what the world has | why |
|---|---|---|
| *"Sad alley cat in a cardboard box — by the south alley wall, one flap open"* | no box, cat beside the dumpster | **superseded**: *"a ~10 px grey blob … sunk in a cardboard box — it reads as a mouse. **Drop the cardboard box entirely***" |
| *"Alley plywood now leans back against the wall"* | no plywood | **superseded**: *"Delete the alley plywood and the trash bags … it reads as a mysterious door, not as junk"* |

Both absences are the request being honoured, and both would read as missing work
to anyone who found the first entry and stopped. The tags are all six present,
`alleycheck` guards the sky gap, and the cat's placement is this session's move.

**The trap in reading a request log forwards** is that it is chronological, so
the earliest statement of a thing is the one you find first and the retraction is
further down. Reading it backwards — latest word per subject — is what
`533859821` did, and it is the only order that gives the current answer.


## Every commit hash my notes cite, checked

`37552a653` and `f51f2a52e` audited the hashes their notes cite. Mine had a
reason to be worse: **this branch has been rebased 39 times this session**, and a
rebase rewrites my own commits, so any hash I wrote down for my own work is a
hash that no longer exists.

```
128 hex strings cited across my notes
126 resolve as commits
  2 did not
```

Both were mine, both in a "what | commit" table where they can only be
citations, and both found again by searching for what the commit did rather than
what it was called:

```
9f6ba0a2  ->  833d4296f  Give back the 0.18 m of sidewalk that no geometry was standing on
ff9c60ff  ->  1484a2f7e  The alley stops showing sky over its own back wall
```

`git log -S "WALK_PROJECTION"` found the first — searching for the **change**
rather than the message, which works when you remember what a commit did and not
what you called it.

### Qualifying the method, as `e35219f43` did to theirs

Re-ran it after fixing the two, and the numbers moved in ways worth explaining
rather than reporting flat:

```
132 hex strings cited   (up from 128 — the fix ADDED the two dead hashes back,
                         deliberately, as the left side of the mapping above)
130 resolve
  2 do not               <- 9f6ba0a2 and ff9c60ff, exactly those historical ones
  1 ambiguous prefix     <- e78e5ec1f, and it is not a citation at all
```

**"Does not resolve" is not the same as "wrong".** The two remaining dead hashes
are dead *on purpose*: a mapping from what a note used to say to what it says
now is worthless if you delete the old number.

**And "resolves" can hide an ambiguity.** `e78e5ec1f` matches two objects in this
repository. It is a **build stamp read off a screenshot**, not a commit I chose
to cite — `f51f2a52e` hit the same thing from the other side, where two of its
hits were fingerprints rather than commits. A 7-character hex string in a note
can be a commit, a build stamp, or a texture fingerprint, and only context
distinguishes them.

So the honest version of the result: **126 of 128 real citations resolved, 2 were
genuinely stale and are fixed**, and the method needs a human to read the
context of anything it flags — which is how I caught that both of mine sat in a
"what | commit" column and were therefore real.

**Two in 128 is a low rate and the mechanism guarantees more.** Every rebase
rewrites every unlanded commit of mine, so a hash is only stable once it has
landed on mainline. Citing my own in-flight work by hash is writing down a number
that is about to change; citing what it *did* survives.


## 25 of my citations pointed at commits nobody else could resolve

`a67cfda46` found 21 of its 59 doing this. Mine was worse in kind, because my
previous audit had already called them healthy: **an orphan left by a rebase
still resolves in my worktree.** `git cat-file -e` says yes; everyone else says
"unknown revision".

The right test is ancestry on mainline, not resolvability here:

```
131 citations resolve in my tree
106 were ancestors of add-stick-and-city98   <- anyone can look these up
 25 were not                                 <- only I could
```

21 had a landed twin under the same subject and are rewritten to it. Of the four
left:

- **three are integration-world build stamps** (`live: rpg-alley`) recorded from
  `:5177` runs — not commits of mine and correctly unresolvable by anyone, the
  same species as the `e78e5ec` build stamp and `f51f2a52e`'s fingerprints.
- **one was `abd5e7b1`**, and it taught me something. `git log --diff-filter=A`
  says the commit that actually added `scripts/pinned-suite.sh` to mainline is
  **`a68e602e9 "wip: pinned-suite"`** — my placeholder. I amended that message
  into a real explanation while the merge train had already taken the wip
  version, so **mainline carries "wip:" and my explanation lives in an orphan
  nobody can fetch.** Repointed to the landed hash.

The reasoning survived only because I had also written it into the script's own
header. **A commit message can be lost to a rebase; a file header cannot.**
