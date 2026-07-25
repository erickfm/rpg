# The used car lot — builder C

`ct/lot.ts`, mine. Built, wired, walked, landed. This note replaces the one
written when it was still an unwired module.

---

## What it is now

A 23.2 m site on the east side, laid out to the plan the user gave:

- a **drive aisle** straight in from the street to the back
- **stock herringboned either side of it**, nose-out, receding
- **the office across the far end**, facing back down the aisle

That layout is the whole thing. 23.2 m of depth only READS if you look ALONG
something — rows parallel to the street hid the depth behind the first row,
where the pavement could never see it, and the lot looked flat from the one
place everybody stands. It also gives the office a job: at the front corner it
was a hut you walked past, and at the far end it is what you drive toward.

## Verified, and how

Three scripts, all in `scripts/`, all reusable by anyone:

| | |
|---|---|
| `lot.mjs` | 32 shots including three after dark |
| `lotwalk.mjs` | holds W eastward off the pavement at 15 values of z and reports how far the rig gets |
| `lot-kerb-seam.mjs` | does B's kerb cut line up with my gate — the half of *"a car must leave"* that neither suite owned |
| `seats-walk.mjs` | every seat in the world: can you WALK to it, and does E sit/lock/stand you (not mine — it replaced my `seatcheck.mjs`, see below) |

**Access.** The opening is clear from z −0.5 to 6.0 — six and a half metres —
and the fence stops you at every other z tested. That check is not optional
and it is not doable from a screenshot: three of my own props were standing in
the driveway and only walking it found them. The best one was the rolling
gate, parked "open" with its leaf and its collider 1.4 m into the gap it was
holding open.

**Seats.** Two chairs by the office door and the three-high tyre stack, all
through F's `ctx.seat()`, all confirmed reachable and sittable.

**The walk is untouched.** Nothing this module builds is west of `x = FACE`.
The barbed arms on the fence lean INTO the lot for that reason.

## Things worth keeping, because each is a rule and not a one-off

| what I built | what it looked like | what it is now |
|---|---|---|
| chain-link on the frontage | **nothing at all from the pavement** — banners hanging in mid-air over a lot with no fence | a fence is not read from its mesh at 15 m, it is read from its FRAMEWORK: rails, line posts, fat terminal posts either side of the opening, barbed arms against the sky. Framework first, mesh second — the order it is built in reality |
| a one-texel wire at 0.3 m per tile | sub-pixel, so alphaTest dropped it entirely | two texels of wire, so enough survives the test to read as a screen |
| `GLYPH` without G H J P Q V X | "BUY HERE PAY HERE" shipped as **"BUY ERE AY ERE"** for several commits | full alphabet, and a missing glyph now draws a solid block — still wrong, but impossible to miss in the first screenshot. A silent blank is indistinguishable from wide kerning |
| the FTC Buyers Guide at fixed coordinates | hanging in mid-air off the rear quarter of a sedan, where there is no glass | it FINDS the lofted cabin in the car H hands back and reads the window off its own bounding box, so it survives H changing the fleet |
| a flag as three panels in a row | three panels each got the whole texture, so the flag flew with **three stars** | one segmented plane with a ripple in its vertices. A tiled texture is not a bent one |
| chairs west of the office | both chair and both approach points inside a solid box: seat registers, prompt appears, you can never walk to it | GOTCHAS §8. I wrote `seatcheck.mjs` for it; `seats-walk.mjs` supersedes it |
| a chair with its back on +x | the seat pose said yaw 0, which is −z, so it sat you square across the arms of your own chair | a model and its seat pose have to agree on which way is front |
| the office name board at 2.05 | lay across the top quarter of the window | both take their height from the same texture now |
| 32 × 24 texels on a 4.6 m office wall | seven per metre — cannot hold a blind slat, let alone a room behind one | 64 × 40, which is what unlocked the blinds, the desk lamp and the room behind them |

## Open, and not mine

**Builder B — the curb cut.** `notes/BLOCKED-C.md` has the ask and the exact
span. The kerb face still stands across the mouth; a car can reach the opening
and cannot drop off the kerb. This is the last piece of "how does a car get on
and off" and it is the only part I could not build.

**~~Builder B — the night dimmer skips transparent materials.~~ WITHDRAWN —
it was mine.** I filed this twice. `props.ts` excluding `transparent: true`
from `dimWorld` is CORRECT: that function owns glass, and blending a graded
colour through a pane is its business. The bug was that a cut-out is not
transparent — `alphaTest` discards the fragment and never blends, so the flag
bought nothing and put six of my own materials on the skip list. Fixed in
`ct/lot.ts` by deleting one flag, `04548554`.

**The rule that IS worth having**, for anyone else: if you set `alphaTest`, do
not also set `transparent`. `scripts/nightgrade.mjs` catches it — average
material colour by class over a world box at noon and at 23:00; everything
should fall except `additive`. Nobody screenshots their own props at 23:00,
so this failure is silent by construction.

**~~Builder H — three car variants.~~ LANDED.** H shipped `CarState`, and all
three are placed: hood up in bay 1 where you pass it on the way in, on a jack
at the back beside the tyre stacks, on blocks in the furthest bay. Still no
vehicle built here — the lot passes state to `makeCar()` and nothing more.

**~~Builder D — the back wall.~~ ANSWERED FROM THIS SIDE.** It is still D's
brick, but it now carries a ghost sign for the tenant before the demolition and
the lot's own two banners, hung 8 cm proud of it. That is what it needed and it
did not need D to do anything. Withdrawing the ask rather than leaving it open
against someone who was never going to see it.

**Builder E — one bench does not sit.** `seats-walk.mjs` is red at HEAD, and
it is not my seats:

```
FAIL  seat 1/57 "sit on the bench" @ -8.65,-20.38
        no "sit on the bench" prompt from the one standable point (-8.6,-19.43); got null
56/57 seats sit, lock, and stand clear
```

All 8 meshes within 1.6 m of it are stamped `userData.mod = 'civic'`, and
`OWNERSHIP.md` has `ct/civic.ts = E`. The label is declared at `civic.ts:826`.
Note `park.ts:409` declares the same string, so grep alone will send you to the
wrong one — the stamp is what disambiguates, which is the whole reason I
started stamping (`cf966b3d`).

Reachability is not the fault: the walker found a standable point and stood on
it. The seat registered and the prompt did not appear there.

**F / G — `interiors-walk` cannot pass in the shared runner, and that is
probably the slow tier's red.** `1d4d7e31` reported it red — *"the one check in
the project I have never seen complete"* finally reaching a verdict — and left
it unread because it was not theirs. It is not mine either, but it is a
two-line diagnosis so here it is.

Run alone against a DEV server it is **195/195 green**. Against the built
bundle it does not run at all:

```
Failed to fetch dynamically imported module: http://localhost:4190/src/proto/ct/doors.ts
```

It reaches into SOURCE at `interiors-walk.mjs:85` and `:90`
(`await import('/src/proto/ct/doors.ts')`), and only a dev server serves
`/src/`. But it is registered in `checks.mjs:151`, and that runner defaults to
a **preview** — the built bundle. So in the default run it cannot pass, and the
red says nothing about the world.

**The world is fine.** 195/195, including every room holding you in.

If it should be bundle-capable, most of what it imports is already on the
runtime affordance: `window.__ct.doors()` returns 8 records carrying
`stand`, `point` and `widthM`, which covers `doorStandFor` and `doorWorldFor`.
`roomWidthFor(w)` is just `max(4, w - 1.2)`. The only thing with no runtime
source is `decl.at`, so that is the one gap to close. Yours to decide — I have
not touched the file.

**Not built, and why.** Privacy slats were on the brief for "the back and side
runs". There are no back or side runs — the site's rear and flanks are D's
brick, and the only chain-link here is the frontage, which exists to show the
stock. If a flank is ever fenced instead of walled, the slats belong there.


## `seatcheck.mjs` is retired — use `seats-walk.mjs`

I wrote `seatcheck.mjs` when the chairs turned out to be inside a solid box. It
warped to each seat's approach point, tested it against the collider list with
the rig radius, and pressed E.

`scripts/seats-walk.mjs` does the same job by WALKING, which is strictly
stronger, and I said the weakness out loud when I wrote mine: **warp reaches
places you cannot walk to.** A test that teleports into a spot and then reports
the spot as reachable is capable of passing a seat no player can get to. Mine
never did — it inflated colliders to approximate the walk — but approximating
the thing the movement code actually does is how a check drifts away from it.

Both were run against the same mutation, a seat moved inside the office box:

```
seatcheck.mjs   inSolid=true, seated=false
seats-walk.mjs  56/57 -> 55/57,  "UNREACHABLE — no standable point
                                  within its 0.66 m trigger"
```

Same catch, and theirs names the reason. Deleted rather than left beside it,
by GOTCHAS §24's second half: two scripts on one subject is how the wrong one
gets run, and the weaker one giving a green is worse than no script.


---

# My guards, and what each was watched doing

`ba497dd7` sets the right bar: a guard watched FIRING at HEAD, not one that
passed when it was written. All eight, re-run at HEAD:

| check | asks | watched failing on |
|---|---|---|
| `lotwalk` | can a pedestrian enter the lot, and only there | `--selftest` walls the frontage in the live collider list → "no opening at all" |
| `lot-frontage` | does the lot take any of the 2 m walk | a prop pushed 0.70 m into the walk → named it; and a drifted `FACE` → "the constants no longer describe the world" |
| `lot-layout` | aisle in, cars either side, office at the back | `--selftest` moves the office to the front → "4% back, wanted 66%+" |
| `door301` | opens, shuts, blocks, refuses to shut on you | `--selftest` jams the doorway → 3 of 7 behaviours fail |
| `doors-declared` | does every declared DOOR arrive | `--selftest` drops one → names the building |
| `entrance-brick` | does the brick run through the entrance bay | `CASE_W` widened to the whole bay in source → 94% stone, red |
| `people-walk` | is every figure from the 8-angle atlas | a hand-drawn figure added in source → `1.00x1.80 (ratio 1.80) @ x=23` |
| `gotchas-numbers` | unique and ordered headings | `--selftest` duplicates a number → names both titles |

Two have no `--selftest` and that is stated in each rather than left to be
assumed: breaking `lot-frontage` or `people-walk` means changing SOURCE, not
the live scene, so the flag cannot do it. Both were mutated by hand this
session and both went red.

**What none of them cover**, so nobody quotes them for more than they are:
every lane figure here is of the BUILT lane on an empty street — citizens are
not colliders (310 boxes, unchanged over ten seconds with six people about).
The lived-lane question is `b0398ead`'s flood fill with movers included, which
finds "car lot mid" reachable in all four samples.
