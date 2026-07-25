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
