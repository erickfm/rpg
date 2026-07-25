# Quality pass — the library, the church, the park

Graded the way `AUDIT-TRIAGE.md` grades: by **whether a player can see it**, not
by how cleanly I can measure it.

This started as a look at three finished areas and turned into something else.
The first pass found four things by looking. The second pass — after the park
gained relief — found nine more, and **not one of them was visible in a
screenshot**. They were found by asking the world questions: which mesh is on
top, what is the floor here, do these two surfaces share a height. That is the
finding behind all the other findings, and it is why three new checks exist.

Method: `E-verify` (six areas now), `nightgrade` per area box, and a read of both
files against the gotcha list. Shots in `shots/E-audit/`, `E-mound/`,
`E-shelter/`, `E-park-night/`.

## Still open — route these

| # | finding | can a player see it? | where |
|---|---|---|---|
| 1 | **The library courtyard and the churchyard have NO light source at all.** Not dim — unlit. The courtyard has benches you sit on and steps you climb; at 22:30 you cannot see the doors you are standing in front of | **Yes, and it is the exact complaint the park got** | lamps are `ct/props.ts` (B) |
| 3 | **The gate lamp stands on the park's entry centreline**, 1 m inside the gate at x −7.9, z −83. You side-step it going in | **Yes** | `ct/props.ts` (B), **but the coordinate was mine** |
| 5 | **The park site's ground is a flat plane nobody may displace.** `openSite` in `ct/street.ts` floors each site with one opaque 32 × 30 m plane at `KERB_H`. A module that owns relief cannot cut below it, so my dish and corner fall had to be re-cut as hollows in a crown rather than real depressions | **Not any more** — but it caps how much topography the park can ever have | `ct/street.ts` (D), constrains `ct/park.ts` |

Finding **3** is worth naming as a mistake rather than a defect. I handed B a
table of lamp coordinates so the park would not be re-cut a third time, and one
of them puts a lamp in the middle of my own gateway. I checked those positions
against my colliders and never against the entry path I had drawn myself.

## Found and fixed since

All in `ct/park.ts` or `ct/civic.ts` unless noted. Ordered by what a player
would have noticed.

| finding | what it looked like | how it was found |
|---|---|---|
| **The dish and the corner fall were drawn UNDER the park's own paving** | The two hollows were invisible and the floor picker still lowered you into them — you walked down into a dip that was not there | `E-coplanar`, then measured: at four points the site plane was on top and the grass 16–79 mm beneath |
| **Every desire line ran the wrong diagonal** | The network fanned from the wrong corner of the gate. A mirrored fan still looks like a fan | reading the strip's own vertices after a drape check pointed at them |
| **Both civic flights had never been tested** | Nothing — the world was correct. The harnesses reported "all walks passed" having SKIPPED both climbs for hours | the wired/unwired probe read a shared last-written value |
| **The shelter's bench was not a seat** | You walk 26 m to the thing the loop exists for and it is scenery | `__ct.seats()` had no seat inside it |
| **The shelter roof read as a slab** | Its two slopes bottomed out at exactly the height of the wall plate drawn beneath them, so no part of the pitch was ever visible | looking, at the one angle that shows it |
| **The gate spur ran 0.75 m into the loop's street leg** | Two coplanar path surfaces fighting for depth, in the one place every visitor walks | `E-coplanar` |
| **Two desire lines fought where they cross** | Flicker on the mound you notice and cannot place | `E-coplanar` |
| **The mound bench floated 36 mm at one end** | A gap under a cast end, on 1-in-17 ground | `E-onslope` |
| **Desire lines and the bald patch sank into the grass** | A worn path that fades out over a mound looks like a worn path that stops there | `E-drape` |
| **The shelter's textures broke §5** | Grain that changes scale between two pieces of one shelter: 4.0 px/m across the roof, 114.3 up the front plate, against the world's 8 | computed from the member sizes |

## The checks that came out of it

Three new, all in `E-verify`, all written because the fault they catch is
invisible in a screenshot:

- **`E-drape.mjs`** — what is laid on the grass stays on top of it. A vertical
  ray needs no Raycaster (the page publishes no `three`): point-in-triangle in
  XZ plus one barycentric height.
- **`E-onslope.mjs`** — what stands on the grass is not floating above it.
- **`E-coplanar.mjs`** — no two *visible* surfaces share a height (§6). Names
  which two meshes coincide, with sizes and positions.

**Every one of them was wrong before it was right**, and that is the part worth
recording:

- `E-coplanar` first reported 83 points that were all correct geometry — two
  rectangles sharing an edge, with the ray landing on the boundary line. A hit
  now has to survive a 5 cm nudge, which an abutment cannot do.
- It then reported the UNDERSIDES of stacked boxes. Only upward-facing
  triangles can fight over a pixel you see.
- `E-onslope` first compared terrain to terrain and reported the same 36 mm gap
  *after* the bench had been fixed, because it was measuring the hill.
- `E-drape` asserted the field must be the top surface, which fails wherever
  anything legitimately stands on the grass — at one sample a bench 4 cm up.
- `E-park-walk` asserted the dish was lower than `KERB_H`. A hollow is a hollow
  relative to the ground around it.

A check that fires on correct geometry teaches you to ignore it. Each of these
was fixed rather than tuned to pass.

## And the harnesses themselves

The largest single finding of the pass. **Every floor reading in my four
harnesses teleported the player and read `pos()[3]`** — that is `apt.gy()`, a
last-written value that the citizens on the pavement also write, so the answer
is whoever asked the picker last. It cost real diagnoses in both civic areas: a
single stale read decided which HALF of a suite ran, so both flights went
untested while the runs reported green. `window.__ct.groundAt(x, z)` asks the
picker directly. A median of three does not help — it is not noise, it is a
different question being answered.

Two more, same shape:

- **`E-yard-walk`'s gate probe** was one un-retried walk deciding OPEN vs
  SEALED, so one citizen in the gateway turned the climb into a SKIP and the
  run still said everything passed.
- **`E-verify` echoed only the lines it recognised**, so when every child exited
  3 on the provenance guard it reported *"5 of 5 areas failed — do not land
  this"* with no line of why, on a build where all five pass by hand.

The lane legs now downgrade to a NOTE when nothing static is within 0.8 m: §9 is
the check that most needs believing when it fires, and it went red twice today
for a busy pavement. `E-walk --selftest` exercises that branch — and caught my
first rig, which forced the walk 3 m past the library into the next building's
footprint where a collider legitimately is.

### A six-area pass cannot outrun the merge train

Worth the desk knowing, because it is not a fault in anything and it will bite
anyone who writes a long harness.

`E-verify` takes about twenty minutes over six areas under load. The merge train
rebases builders more often than that, so HEAD moves out from under `dist/`
mid-run and every remaining area exits 3 on the provenance guard. It took three
attempts to catch a window; the successful one reads **`all 6 areas walk`**.

That is the guard doing its job and there is nothing to fix in it — but it does
mean the practical unit of verification here is the individual harness, and an
aggregate is a thing you get when you are lucky rather than a gate you can rely
on. If the desk ever wants `land.sh` to gate on one, it will need either a much
faster suite or a way to pin the tree for the duration.

It is also the clearest argument for the echo fix that went in today. The run
before the good one came back *"5 of 6 areas failed — do not land this"*, and
because the banner is now echoed it said exactly why: the served build was
`9bffa9ed7` and the checkout was `be0767d62`. Before this morning that was five
bare `FAILED` lines on a build where every harness passes by hand, which sends
you looking at the world instead of at the build you are serving.

## Record, do not route

| finding | why not |
|---|---|
| **Both civic doors are closed forever** — you climb steps to a leaf 0.36 m away with no prompt | Scope, not a defect: it needs an interior. `ct/interior.ts` already lists E as a consumer |
| **library ashlar at 9.41 px/m** | Already open as `AUDIT-TRIAGE` R7b |
| **The path's asphalt patch lands at the park entry** | Reads as a tar repair, which is what it is |
| **Hoop rail has no collider** | Deliberate: a knee-high wall you cannot cross would be worse |
| **The church's painted steps sit behind the real flight** | Occluded at every angle you can stand at. Latent if the flight moves |
| **The corner fall reaches only paving level** | Consequence of finding 5, not a defect of its own |

## Clean, and worth not re-checking

- **§22 `alphaTest` + `transparent`** — zero in either file. `nightgrade`: park
  `alphaCut` 1.000 → 0.302, opaque 0.128 → 0.024.
- **§3 ground billboards** — none. **§10 mirrored art** — every `DoubleSide`
  plane is symmetric by construction. **§2 the seeded stream** — no `rnd()` draw
  in either file; the only two matches are comments explaining why not.
- **§9 the sacred lane** — audited by collider and driven on foot, both ways.
- **Wiring** — every export of mine has a reader.
- **The `dimWorld` scare** — I measured a plain material getting *lighter* at
  night and had a note written saying `dimWorld` replaces colour instead of
  multiplying it, which would have made every flat-coloured material in the
  world glow. It is wrong: `props.ts` stamps `userData.graded` on all of them
  and the model is a multiply. What I measured was `POOL_GAIN 12` from a lamp
  head 3.7 m away. Recorded so nobody re-opens it.

_Builder E, 2026-07-25._
