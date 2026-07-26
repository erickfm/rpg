# Three of the user's placement notes, and the one measurement each needed

Builder D. `593b379b4` (crates + awning) and `898ba9653` (cat). All three were
*"that looks wrong"* judgements rather than specifications, so each one is
recorded here as **what the picture showed → what the world measured → what
moved**, because in every case the number explained the picture and the picture
alone would have got a different fix.

The camera these were judged from is `scripts/D-look.mjs` — an investigation
camera, not an assertion, named for what it does rather than its subject
(GOTCHAS §24). `--list` prints the viewpoints; each one is a frame a request was
made in.

---

## 1. *"align these crates so they fit better against this wall"*

`shots/user-crates4.png` · `shots/D-crates-flush.png`, `D-crates-graze.png`

**The wall is two planes, and the crates straddled the step between them.**
That is the whole fault, and it is not visible as a step in the user's shot:

```
x  9.00 … 10.405   corner block's brick pier — flat shell face      z −96.00
x 10.405 …         wing shopfront: plinth + stallriser cap PROUD    z −96.12
```

The crates stood at −96.28 and −96.25. Their backs were therefore at about
−96.0, which is **100 mm inside the wing's plinth** on one side of the step and
adrift on the other, plus a 30 mm stagger between the two. No amount of tidying
one crate fixes that; they had to go onto one plane.

Both now sit on the wing's stretch at one z, backs **15 mm clear** of the proud
face. Clear rather than touching because coplanar faces z-fight in this world
(GOTCHAS §6), and 15 mm reads as flush at any distance a player stands.

**Why not west onto the pier instead**, which would have kept them closer to the
door: two crates need 1.3 m, the pier is 1.4 m wide, and the far end of that
reaches x 9.13 — inside the bodega's `[E]` circle at (7.47, −95.53) r 1.8.
Crates across that approach is exactly what made the shop un-enterable once
already (GOTCHAS §8), and it is not worth re-opening for 70 cm.

**One thing found on the way.** The loose fruit that has rolled out of a crate
was authored at `czz + 0.285` — *behind* the crate's back face. It was already
buried in the shell; flushing the crate to the wall would have buried it in the
plinth. It now lands in front, on the walk, where it is a thing somebody can
see.

---

## 2. *"bodega sign is tilted up which makes no sense should be tilted a bit down no? … like it needs to be rotated 180 degrees"*

`shots/D-bodega-awning.png`

The sixth facing bug, and the first one where **the comment asserted the
opposite of what the number did**:

```ts
awn.rotation.x = -0.18;   // slopes down and away from the face
```

It does not. The bay's local +z is out from the shopfront, so `rotation.x = θ`
sends the outer edge `(0, 0, +0.45)` to `(0, −0.45 sin θ, 0.45 cos θ)` and the
top face's normal `(0, 1, 0)` to `(0, cos θ, sin θ)`. At θ = −0.18 the outer
edge stands **81 mm HIGH** and the top face looks up and **BACK at the wall** —
a sign tipped toward the sky, which is precisely what the user described.

**Derived from what it should FACE** rather than by flipping a sign until it
looked better (GOTCHAS §33): an awning sheds water and shades glass, so its
outer edge is the LOW one and its top face looks up and OUT over the pavement.
That is θ POSITIVE. Outer edge now 2.91, wall edge 3.07, fascia foot 3.15 clear.

**The occlusion was already in the file as a warning.** Two lines above sits
*"recheck this whenever `SHOP_BAND_H` moves, or it covers the name again"* — and
the raised lip was cutting across the bottom of the BODEGA fascia in every shot
taken from the crossing. A warning about a fault that has already happened reads
exactly like a warning about one that has not.

**Audited for a second offender — then RE-audited, because the instrument was
blind.** The first pass looked for meshes carrying a non-zero `rotation.x` or
`rotation.z`: 46 above head height, exactly one declaring surface `sign`. **That
method cannot see a baked rake**, and I proved it on my own ATM later the same
session — its screen and keypad are raked 8.1° and 33.7° and both report
`rotation.z = 0`, because the rake lives in the geometry rather than the
transform. So the audit that concluded "no other sign is tilted" was run with an
instrument that could not have found the counter-example sitting in my own file.

Redone by **world normal** rather than by transform: 86 sign-surfaced meshes,
106 distinct sign faces, 9 of them more than 4° off vertical. All nine are
deliberate — the ATM's three raked panels (+8.1 screen, +33.7 keypad, −25.8
apron), this awning's front and back faces at ∓10.3, and B's leaning bench ad at
(5.6, −35). The conclusion survives: no sign in the world is wrongly tilted up.
It was right by luck, on a count that was wrong — 46/1 against 86/106.

---

## 3. *"cat is dead center in alley i need it right to the right of that news paper on the ground"*

`shots/user-catfinal.png` · `shots/D-cat-sixth.png`, `D-cat-beside-paper.png`,
`D-litter-grate.png`

Sixth position. Note this **replaces** the fifth brief rather than refining it —
the fifth move put the cat dead centre of the mouth view deliberately, and dead
centre is what is now named as the fault.

**"Right" is derived, because it is the part that has been got wrong three
times.** You read this alley from its mouth at x −7 looking −x; forward in this
world is `(sin yaw, 0, −cos yaw)`, so screen right is `cross(forward, up)` =
`(0, 0, −1)`. **Right is −z.**

**Which newspaper — and this one is only answerable by LOOKING.** The litter
list in `ct/props.ts` calls the decal beside the drain `'flattened cardboard'`.
Rendered, at (−10.60, −41.45), it is plainly newsprint: columns, a headline
block, a half-lifted leaf (`shots/D-litter-grate.png`). The plain tan slab
further right at (−9.40, −42.40) is the cardboard. **Reading the label rather
than the picture would have moved the cat to the wrong object** — the same shape
as GOTCHAS §25, where a tool's column meant something other than the word on it.

Placement: the paper's right edge is z −41.725 and the cat's plane is 0.588 m
wide standing on the z axis, so a centre at **(−10.40, −42.05)** leaves the
shoulder about 3 cm off the paper. Beside it, not on it.

Constraints **re-measured at the new spot** rather than assumed to travel with
it — that is how the fifth position ended up 61 mm in the air when the floor was
dished:

| | |
|---|---|
| clear of the grate casting (half-extent 0.375) | 1.33 m |
| open floor between it and the south wall at −43.5 | 1.45 m — not a corner |
| feet / floor | −0.011 against −0.031: the same 20 mm decal lift it had before |
| the sacred 2 m lane | not applicable — `builtlane` measures \|x\| 5…7, this is four metres inside the alley |

---

## Verification

`D-walk` green, all 26 legs, at the build these landed on — including the bodega
street door and the ATM balance, which are the two things a crate collider on
that frontage could have eaten.

## Still open on this corner, and it is not mine

The ATM's ledger row is **LANDED, awaiting the auditor**, not open: both halves
of the desk's ruling are at HEAD and were measured there today —
`scripts/atmmeasure.mjs` reports 8 parts, screen rake 8.1°, keypad 33.7°, and a
tonal separation from the wall of 29–173 levels against the 4% it had before.
The one place it departs from the ruling as worded is written down at
`ct/street.ts:822`: the desk suggested a fascia bottom near 0.75, which would
have given 0.83 m because the top is pinned at 1.58 by the screen height, so it
went to 0.68 and reached the 0.90 m the ruling was aiming at.

**`notes/queues/D-alley.md` is stale** and worth a pass by the desk. Every item
under `## Now` is either landed (cat, grate, ATM, open-site depths — `placeLot`
takes `depth: w` from the frontage, so the lot is square by construction rather
than by a constant) or has moved to G with the vice split (the bank flank, the
GOLDEN ACES marquee). Both `## Next` items I still own are assessed in
`notes/D-bodega-corner.md` and `notes/D-shop-resize.md`, and both conclude with
a number rather than a task.

One stale reference left deliberately: `ct/sidestreet.ts:84` justifies its first
tree from *"the bodega's fruit crates sit at x 9.74…11.26"*, which is now
10.44…11.76. The file has no owner in `OWNERSHIP.md` and the constraint it
protects is unaffected — the tree it is reasoning about is on the SOUTH walk at
z −109.6, and the first NORTH-side tree is at x 21, nine metres clear.
