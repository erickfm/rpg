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

**The 12 mirrored faces are MINE, and they are fine.** `whose.mjs` attributed
them to `ct/lot.ts` by position and said in its own header that the claim was
circumstantial. The stamp settles it — `owner: lot` on all twelve — so here is
the rest of the answer rather than leaving someone else's open question open.

They are the **bunting**. `SWAGS = 3`, `SEGS = 4`, and the script finds exactly
**12**, at `FENCE_X`, 1.93 m apart along the frontage. Each segment is a
`PlaneGeometry` rotated `y = π/2` and then tilted `z = atan2(...)` to follow the
parabola of the sag, and that combination reads as handedness-flipped to a test
comparing a plane's up against its normal. Half of any hanging swag will.

It is invisible and it cannot be otherwise: `pennantT` is a repeating pattern of
symmetric red-and-white triangles with **no text of any kind** (grep for
`fillText` in it returns 0), and the material is `side: DoubleSide`. There is no
front to get backwards.

Worth separating the two things, because a mirrored face IS worth finding: the
test is a good one, and on anything carrying words it would have caught the
real defect. On bunting it is telling you which way a flag hangs.

**Stamp coverage, for `BLOCKED-H` §3.** H asks that whatever creates a mesh
stamp who made it, so findings can be ROUTED instead of counted, and records
having twice written throwaway scene walks to prove a finding was not theirs. I
have written that walk twice too. The number, measured at HEAD:

```
1921 of 3396 meshes carry userData.mod  (57%)
   449 street   392 lot   347 walkup   273 vice
   268 props    135 civic   55 tex-ground   2 cat
1475 cannot answer "whose is this" at all
```

So the ask is not abstract: **43% of the world is unattributable**, and that is
the population every future misroute comes from. Not mine to fix — stamping at
the creation points is H's ask of the desk — but the argument now has a figure
under it, and `scripts/whose.mjs` already exists to re-measure it.

**~~The 13 glowing-at-midnight candidates.~~ EXAMINED — all deliberate, now
declared.** `e91df374` swept the world for its graffiti bug's signature
(transparent, no alphaTest, ungraded, not `selfLit`, brighter than 0.5 at 23:00)
and routed the counts honestly, saying outright that the signature cannot
separate deliberate from missed: *"C's 13 unexamined."*

Examined. **All 13 change with the clock; none is the bug.**

```
12 decals + the ghost sign   day v=1  ->  night v=0.727     (my own dim loop)
the pole-sign halo           day op=0 ->  night op=0.551    (a light coming ON)
```

The 0.727 is `1 - 0.47 * f.night` with `f.night = 0.58`, and the halo is
`0.95 * 0.58` — the same two numbers from opposite ends, which is what tells
you it is one system working rather than two coincidences.

They were undeclarable, not undimmed. props.ts's `dimWorld` correctly skips
`transparent`, so this module dims its own decals — and from outside, "dimmed
by its own module" and "nobody dims it" are the same picture. Now stamped:
`graded` on the decals (props.ts:290 defines it as *"was offered to the dimmer
and did not move is decidable from outside"* — the flag says the colour is
OWNED, not who owns it), and `selfLit` + `graded` on the halo and its ground
pool, which are lights and must never dim.

**And 8 more of mine that nobody had routed yet.** Running the same signature
turned up `walkup: 8` — the walk-up's ceiling-lamp glows and their ceiling
spill. Constant on purpose: a hallway lamp does not switch off at noon, which
is the same thing `interiors-walk` asserts when it checks the rooms keep their
own light after dark. Stamped `selfLit` too, before someone spent an afternoon
routing them back to me.

```
lot 13 -> 0        walkup 8 -> 0
textures / structure / tints all IDENTICAL across the change; 3 pigeons drifted
```

**The lot did not get wet, and my own night fix was wrong by 87x.** The block
was sweeping modules for rain response (`b209275c`: the road's centre lines
bone dry while the road darkens 83%). Mine had the same hole, for the same
reason, and looking at it properly turned up something worse than the hole.

`ct/lot.ts` never called `ctx.wet()` — the helper was aliased at line 191 with
zero call sites. Measured in the lot at the SAME hour of day, one dry and one
rainy, so the day grade is held constant:

```
the tarmac under them (D's, via openSite)   1.000 -> 0.256   -74%
my decals painted on it                                        0%
```

Now registered, and they track it: `0.693 -> 0.211`, -69.5%, 23 of 23.

**The part I got wrong.** I dimmed those decals myself, with `1 - 0.47*f.night`,
and defended the constant in this file as *"the factor the world's own grader
was measured applying to this lot"*. The ratio says otherwise:

```
                 decal   tarmac   ratio
  noon, dry     0.6933   1.0000   0.693
  noon, RAIN    0.1552   0.1705   0.910
  23:00, dry    0.0070   0.0077   0.910
  23:00 RAIN    0.0070   0.0077   0.910

  23:00 under my 0.47   0.727  vs  0.0077  =  94x the tarmac
```

**And re-measured a THIRD time, stepped rather than jumped** — `3d71b035`
found a jumped clock is 7.4% brighter than the night a player reaches. Only the
"dry" rows move, and they move a long way: noon dry reads 0.6933/1.0000 jumped
and 0.1978/0.2362 stepped, because **the world never offers a dry spell longer
than 8 hours** and so a stepped arrival always follows recent rain. See
`notes/C-weather-is-periodic.md`. The ratio — which was the point — holds at
0.84 to 0.91 throughout.

**Re-measured at HEAD and these numbers are the corrected ones.** The table I
first published was taken with a 5 s settle and before `e24c959a` clamped the
wet look, and both were wrong in my favour: `baa675d7` measured that the wet
look takes ~16 s to settle, not 5, so my rainy readings were caught mid-soak.
The conclusion is unchanged and the band is tighter than I claimed — 0.910 in
three of the four conditions rather than a 0.69-0.91 spread.

An oil stain eighty-seven times brighter than the asphalt it is on. The whole
argument for dimming them by hand was that an untouched decal *"gets BRIGHTER
relative to the tarmac as the sun goes down"* — and my fix left it doing
exactly that, just less. It read fine in every screenshot because 0.727 on a
black yard looks like a lit stain rather than a wrong one.

The ratio now holds between 0.69 and 0.91 in all four conditions, which is what
a stain has to do. `ctx.wet()` was the right home all along: these ARE ground
surfaces, the registry carries the ground grade AND the wet tint, and
`updateRain` is its single writer — so this also removes a two-writer hazard
this file was one frame from, since `Frame` exposes `night` but no wetness.

Textures and structure IDENTICAL across the change; the tints move, on purpose.

**Checked against the floating-litter sweep, and the lot is clean.** `0d9146049`
shot a wet midnight and found litter reading 61x the ground it lies on — the
same shape as my own decals reading 94x the tarmac. Worth checking my area
rather than assuming the decal fix covered it, since the lot has a cone, a
sandwich board, tyre stacks and price cards.

At a rainy 23:00 with the 18 s soak allowed for, 32 materials in the lot read
bright against a deck at 0.0065. They split:

```
  28  inside CAR groups   mean 0.1032   H's fleet — already routed, 67299640
   4  loose props, mine    mean 0.1088   three frontage banners and one box
```

Mine are fine: every one is `graded`, and they fall 87-96% between noon and
23:00. The banners are vertical vinyl on a fence, so they take the night grade
but not the wet tint — which is correct, since rain does not pool on a hanging
sign the way it does on tarmac. Nothing here is the litter defect.

Recording a negative result rather than nothing, because the next person to run
that sweep will see 32 bright materials inside the lot's box and the useful
fact is that 28 of them are H's and already known.

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

**Re-run at HEAD after this week's rewrites, because the table above was
written before them.** All six selftests still fire. The three that need a
SOURCE mutation were done by hand, and two of them were not fine:

| mutation | before | after |
|---|---|---|
| `CASE_W` 2.5 → 5.6, stone floods the bay | CAUGHT, names `CASE_W` | unchanged |
| `FENCE_X` pushed 1.08 m into the walk | "red", but for the WRONG REASON | CAUGHT, names the intrusion |
| a 1.00×1.80 hand-drawn figure, `alphaTest 0.3` | **SLEPT** | CAUGHT |

**`lot-frontage` was stealing its own finding.** A fence in the pavement came
back as *"THE CONSTANTS IN THIS SCRIPT NO LONGER DESCRIBE THE WORLD — re-read
ROAD_HALF / WALK / FACE from ct/rng.ts"*, and exited before measuring the walk.
Red, so I would have ticked it; a reader would have gone to `rng.ts`, found all
three constants correct, and never learned a fence was in the pavement. The two
directions are different faults and only one is about constants — east of the
line means the frame of reference moved, west of it IS the defect.

Letting it fall through to the collider analysis was my first fix and it was
worse: the mutation then came back **green**, because this module registers no
collider for its chain-link (the site wall under it already stops you), so a
fence 1.08 m into the pavement changes no free-centre band at all. That is the
lesson worth keeping: **GOTCHAS 9 is not "can you walk the 2 m", it is that the
2 m is THERE.** A fence you walk straight through is not a preserved pavement.
The band measurement and the mesh test answer different questions and neither
implies the other.

**`people-walk` was guarding the convention instead of the rule.** It required
`alphaTest === 0.5` exactly — the value every existing figure happens to use,
and the one thing a newly hand-drawn person has no obligation to type. The same
cutout at 0.3 was invisible. Widening it to any cutout immediately turned up a
false positive that had been hiding behind the narrow test: a 1.10×1.95 cutout
in the walk-up, person-shaped to the centimetre, whose texture repeats 3.67×6.5
— a grille. Dimensions were never going to separate those. Tiling does, and it
is the same fact the atlas test already leans on: a figure wears its texture
once; anything repeating across itself is a surface.

Two have no `--selftest` and that is stated in each rather than left to be
assumed: breaking `lot-frontage` or `people-walk` means changing SOURCE, not
the live scene, so the flag cannot do it. Both were mutated by hand this
session and both went red.

**What none of them cover**, so nobody quotes them for more than they are:
every lane figure here is of the BUILT lane on an empty street — citizens are
not colliders (310 boxes, unchanged over ten seconds with six people about).
The lived-lane question is `b0398ead`'s flood fill with movers included, which
finds "car lot mid" reachable in all four samples.


**Withdrawn:** `notes/C-wet-at-night.md` — I claimed the wet look does nothing
after dark. It was an under-settled dry sample, and the claim is retracted in
full there.
