# Quality pass — the library, the church, the park

Graded the way `AUDIT-TRIAGE.md` grades: by **whether a player can see it**,
not by how cleanly I can measure it. Nothing here is fixed. Four of these are
mine and I can take any of them the moment you route one.

Method: walked all three areas at 13:20 and 22:30, plus `nightgrade.mjs` per
area box, `E-verify.mjs` (all three walk), and a read of both files against the
gotcha list. Shots in `shots/E-audit/`.

## Route these

| # | finding | can a player see it? | where | evidence |
|---|---|---|---|---|
| 1 | **The library courtyard and the churchyard have NO light source at all.** Not dim — unlit | **Yes, and it is the exact complaint the park got.** The courtyard has benches you sit on and steps you climb; at 22:30 you cannot see the doors you are standing in front of | lamps are `ct/props.ts` (B) | `shots/E-audit/i-night-court.png`, `j-night-churchyard.png`. `nightgrade` per box returns **no `additive` class** in either — courtyard `{opaque 0.029}`, churchyard `{opaque 0.029, alphaCut 0.07}` — against the park's, which has one |
| 2 | ~~**The shelter's bench is not a seat.**~~ **FIXED** — `ctx.seat` registered, facing out of the open side, approach clear of the bench's own collider (§8). 58 seats now. The one destination at the far end of the park is the only bench in it you cannot sit on | **Yes.** Eleven benches on the loop take `[E]`; you walk 26 m to the thing the loop exists for and it does not | `ct/park.ts`, mine | `__ct.seats()` returns 11 bench seats, none inside the shelter |
| 3 | **The gate lamp stands on the entry centreline**, 1 m inside the gate at x −7.9, z −83 | **Yes** — it is the first object in the gateway and you side-step it going in. It does not block: `E-park-walk` enters clean | `ct/props.ts` (B), **but the coordinate was mine** — I gave B that position without checking it against my own entry path | `shots/E-audit/c-kerb-lowangle.png` |
| 4 | ~~**The shelter roof reads as a slab, not a pitched roof.**~~ **FIXED** — the wall plate became a perimeter instead of a solid box, and the slopes overhang it. Its two slopes are hidden under the 0.18 m beam drawn beneath them | **Probably** — it is 26 m from the gate and terminates the park's axis, so it is seen far more often than it is stood under | `ct/park.ts`, mine | `shots/E-audit/b-shelter-roof.png` |

## Record, do not route

| finding | why not | where |
|---|---|---|
| **Both civic doors are closed forever** — you climb steps to a leaf 0.36 m away with no prompt | Real, and the most "unfinished" thing I own, but it is scope rather than a defect: it needs an interior, not a fix. `ct/interior.ts` already lists E as a consumer | `ct/civic.ts` |
| **library ashlar at 9.41 px/m** | Already open as `AUDIT-TRIAGE` R7b. Cross-referenced here so it is not filed twice | `ct/civic.ts` |
| **The path's asphalt patch lands at the park entry** | It is one patch in a per-surface texture and it happens to sit in the gateway. Reads as a tar repair, which is what it is meant to be. Cosmetic and arguably correct | `ct/park.ts` |
| **Hoop rail has no collider** | Deliberate: a hoop is knee-high and you step over it, and a knee-high wall you cannot cross would be worse. Recorded so nobody "fixes" it | `ct/park.ts` |
| **The church's painted steps sit behind the real flight** | Drawn twice, but the real flight and its landing occlude the painted ones at every angle you can stand at. Latent — it matters if the flight is ever moved | `ct/civic.ts` |

## What I checked and found clean

Worth recording so the next pass does not repeat it:

- **§22 `alphaTest` + `transparent`** — zero in either file. `nightgrade` per box:
  park `alphaCut` 1.000 → 0.302, churchyard → 0.07, courtyard clean.
- **§3 billboards on the ground** — every decal is a fixed plane; no `board()`
  call in either file.
- **§10 double-sided mirrored art** — five `DoubleSide` planes, all of them
  symmetric by construction (railings, ivy, leaves, litter, mesh). No lettering
  goes through a double-sided plane anywhere in my files.
- **§2 the seeded stream** — no `rnd()` draw in either file; both carry their
  own LCG, so nothing I own can move a tree height or a pigeon.
- **§9 the sacred lane** — `E-park-walk` audits every collider in the park's
  z-span against x = −7.00 and drives the full 30 m frontage. Green.
- **Wiring** — `npm run wiring` 24/24 constructed; `E-verify`'s own check says
  every export of mine has a reader.

## The one that is mine to answer for

Finding **3** is worth naming as a mistake rather than a defect. I handed B a
table of lamp coordinates so the park would not be re-cut a third time, and one
of them puts a lamp in the middle of my own gateway. I checked those positions
against my colliders and never against the entry path I had drawn myself — the
same class of error as the bench that landed in the gate, and I made it while
being careful about exactly that.

## Found by a later pass, and already fixed

**The shelter's own textures broke §5 the morning they were added** — by me, in
the act of citing the density mandate. A 16 px map with no `repeat` is one tile
stretched over whatever face it lands on, so the density falls out of the
member's size and differs for every one. Measured on what had shipped:

| member | before | after |
|---|---|---|
| roof slope | 4.0 px/m across, 11.0 up | 8.0 / 8.0 |
| front plate | 4.4 across, 114.3 up | 8.0 / 8.0 |
| post | 100 across, 6.4 up | 8.0 / 8.0 |
| ridge | 4.0 across, 47.1 up | 8.0 / 8.0 |

The world's masonry standard is 8 px/m. Fine detail plus a stretch is worse than
no detail: it is grain that changes scale between two pieces of one shelter. A
16 px tile over 2 m is exactly 8 px/m, so every repeat is just metres / 2.

## Since this was written

Findings **2** and **4** are done — both were mine, both were in `ct/park.ts`,
and both turned out to be the same mistake: the shelter is the one piece of
furniture in the park built by hand rather than through the `bench()` helper, so
it missed the `ctx.seat` registration every other bench gets for free, and its
roof was drawn under a slab of a wall plate that hid the pitch it already had.

Findings **1** and **3** are B's file and stay routed.

### One for the desk, about the harness rather than the world

`seats-walk.mjs` came back **56/58** on that build, red on my two library
courtyard benches — *"no prompt from the one standable point"*. It is not
reproducible and I do not believe it:

- the same two seats passed the same harness **57/57** this morning, on code
  that has not changed since;
- walked the way a player meets them — stand 2.4 m out, hold W until the bench
  stops you, press E — **both sit**, along with three park benches and the new
  shelter seat. You stop 0.69–0.82 m from the seat, the prompt is up, and you
  sit and stand clear;
- probing the same point twice in two runs gave PROMPT once and null once,
  which is what a timing artefact looks like and not what geometry looks like.

The harness teleports to a point found by `standableNear` and reads the prompt
140 ms later. My guess is that a teleport onto the approach point lands the
capsule mid-settle, but it is a guess — what I can state is that the reds are
not reproducible by walking, and that the seats work. Flagging rather than
touching: `seats-walk.mjs` is not mine.

The park has also changed under this report since it was written — a re-cut loop,
mowing stripes, and relief (see `E-park-relief.md`) — so the park half of it is
worth re-running rather than trusted.

_Builder E, 2026-07-25._
