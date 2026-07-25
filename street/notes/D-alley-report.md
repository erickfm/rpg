# Builder D — report

Working from `notes/queues/D-alley.md`: rebase on `add-stick-and-city98`, take
the top unchecked item, commit, re-read. I don't edit the queue — completions
are reported here. Earlier runs are in `notes/archive/`.

Base: `6976f13`. `scripts/ownership.sh D` clean. `npm run sweep` shows the same
warnings as baseline, no new page errors. `scripts/health.mjs` → WORLD OK.

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
