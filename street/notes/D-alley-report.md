# Builder D — report

Rebase, take the top unchecked item, commit, re-read, take the next. I don't
edit the queue.

---

# LATEST — used car lot landed; queue now blocked on other builders

`a9133e25` · build clean · sweep no new page errors · `health.mjs` WORLD OK ·
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
| bodega corner bay | **blocked on A** |
| signs (a) + (b) | **not mine any more — G's** |
| window lights | **contended with A's live mandate** |
| shop resizing | **already done** — verify and retire |
| `[E]` spots migration | **half needs a `ctx` change, which is a desk operation** |

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
| collision follows geometry | `1fb7921` | the mandate; walked, four proofs |
| bodega doorway is a real hole | `47ce219` | recessed leaf, boxed reveal, OPEN over the door |
| DINER ⇄ LAUNDRY identities | `8120f44` | diner now **z −55.5 … −43.5, centre −49.5** |
| signs: real structure | `713de4b` | (a) and (b) already fixed; (c) was real |
| BARBER ⇄ THRIFT + park | `e88bbf2` | park site **z −98 … −68, x −14 … −7** |
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
- **OPEN over the door** — done in `47ce219`.
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

# LATEST — collision follows geometry (`1fb7921`)

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

## `## Now` → **Move the church onto the main block** — DONE (`8447e7c`)

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
- **BURGER BARN red + beige** (`d7e0b1f`) — the mustard constants had never
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
| **The bank flank** (raised twice) | `1ce3d303`, `06fe7bd3`, `54905bb9` |
| Open-site depths — two builders blocked | `53969600` |
| Buildings 3.4 m deep / every flank the same brown | `e466c43c`, `4ce8355d` |
| CAFE + HARDWARE become a used car lot, roster half | landed; z -9 … 14.2 |

**Next**

| item | commits |
|---|---|
| Bodega corner bay | `1d5c7515` |
| Signs, both bugs | **not mine** — moved with the casino into `ct/vice.ts` (G) |
| Shop resizing | `bab2a7c3`, plus the band-table refactor before it |
| Window lights | `de401556`, `065a4e53` |
| `[E]` spots out of `crosstown.ts` | `570eb41f` — the `SPOTS.push` block is empty |

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

**E's patch is applied** (`793edfe7`), written out properly rather than as
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
| **0.18 m of sidewalk given back.** The lane audit's headline: every building's collider sat 0.3 m inside its facade, so the "sacred 2 m" was 1.70 m everywhere. Measured the relief — deepest thing at walking height is the jamb at 0.12 — and published `WALK_PROJECTION`. Eight stretches moved problem → tight. | `9f6ba0a2` |
| **The site boundary moved off the walk.** `openSite`'s rail straddled the street line, putting its whole 0.36 m in the pavement on BOTH sites. Routed by C with a measurement. Block-wide: 15 stretches under 1.20 m → **six, none graded problem**. | `5be75c19` |
| **The alley stopped showing sky over its own back wall.** End-wall height derived from the taller neighbour instead of a literal 12.8 that stopped being true. | `ff9c60ff` |
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
