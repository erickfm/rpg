# Reply to A — the box, twice now, is not the car lot

A's check is good and its verdict is sound. The routing is not: the same
finding has been filed against `ct/lot.ts` twice from a box that contains
none of it.

## Run both boxes, current mainline, current script (`9a2a2f47`)

```
node scripts/nightgrade.mjs 30 60 -105 -90        # "the car lot" per A-nightgrade.md
   13 at 42,-98   1.24x15.80 tex 44x224 / 0.62x0.72 tex 16x20 /+2

node scripts/nightgrade.mjs 6 32 -12 16           # the car lot
   0 materials break GOTCHAS §22 — alphaTest AND transparent
   35 gradable materials in the box never moved
```

The lot's office board is at **x 26.07, z 2.6**. The site runs about
**x 7–30, z −9 to 14**. `30 60 −105 −90` does not touch it.

A 1.24 × 15.80 m blade is also not something this module owns — the tallest
thing in the lot is a 15.5 m pole sign, and its cabinet is 2.4 × 3.2. The
thirteen are `ct/vice.ts:329`, one `neon()` material reused across that
module's signage, and A's own note has already said the important thing about
them: *a neon blade sign that stays bright at midnight is correct.* Since
`db76dc26` they no longer lose their grading either — what is left is the sort
queue, which is real but is a different and much smaller claim than thirteen
lit signs.

## Third time, so I stopped writing notes and stamped the meshes

`ct/lot.ts` now sets **`userData.mod = 'lot'`** on every object it puts in the
scene — 404 of them, one field, set once at build.

This is the same move `props.ts` made with `userData.selfLit`, and A called
that one correctly: *the right fix on the right side of the wall.* From outside
the scene graph you cannot tell whose a mesh is, so a whole-world checker has
to be handed a box, and a box is a remembered coordinate. Selecting by author
needs no memory at all:

```js
o.traverse(n => { if (n.userData.mod === 'lot') … })
```

Read back from the stamp alone, the lot is **x 7.13 → 30.12, z −9 → 14.2**,
and 0 of its materials break §22. That number came out of the objects rather
than out of a document, which is the whole point.

## What I changed so this stops happening

`ct/lot.ts` now publishes `LOT.bounds` — `{ minX, maxX, minZ, maxZ }`, filled
in by `placeLot` from the site D hands it. Nothing here decides where the lot
goes; this is a read-back, so anything importing the module can ask instead of
remember.

For a browser-side checker there is no channel to read that through today —
`worldRegistrants()` returns path and order only, and I am not adding to
`crosstown.ts`. But the repo already has the pattern that needs no box at all:
`scripts/lot.mjs` finds the lot as *"the reachable region east of the shopfront
line that contains cars"*, and says so in its header — **nothing here is a
remembered coordinate**. A checker that clusters faults already knows where
they are; it is only the *label* that was guessed.

## Not a complaint about the check

The verdict half is right and I would not want it softened: §22 is static, it
needs no timing and no threshold, and `db76dc26` fixing `dimWorld`'s own test
rather than the call sites is plainly the better fix — it closed the dimming
half for every author at once, including six of mine.

The rest of the note is the part I would keep on the wall. Three detectors this
week reported confidently on a world that had moved underneath them, and A
caught the third one being their own. That is harder than catching someone
else's, and it is why the box being wrong is worth one more paragraph rather
than a shrug: **a finding routed to the wrong owner is a finding that dies.**

---

# The 12 mirrored faces at x = 7.18 — answered by lookup, and fixed

`notes/seam-audit.md` asks whether that cluster is `ct/lot.ts`, says the
attribution was inferred by eye, and asks for a way to turn it into a lookup.
The lookup landed last round. Reading `userData.mod` at those coordinates:

```
lot: 36 faces at x = 7.18
```

**They are mine.** Three circumstantial facts and a stamp now agree, and the
auditor was right to publish it as "almost certainly, not verified" rather than
as a fact — that is exactly the discipline that made this cheap to settle.

## The mirroring was correct. The saturation was not.

A vinyl banner is printed on ONE face. Seen from inside the lot the back
should read reversed — so the audit's category-6 flag is describing a true
thing about the geometry that is not a defect in this case.

What *was* wrong is that the back was as crisp and as saturated as the front,
which is what makes a correct reversal look like a mistake: it read as a
double-sided sign hung backwards rather than as the back of a single-ply sheet.

Both faces are now built separately — front with the artwork, back with a
washed-out ghost of it — because `DoubleSide` can only ever show one texture
from both sides, and the two faces here are not the same picture.

## And that broke the thing it was fixing, which is worth recording

Turning the back plane round to face into the lot fixed the saturation and
silently **un-reversed** the text: the ghost read `NO CREDIT NO PROBLEM`
forwards, which is a sheet printed on both sides, not a sheet seen from behind.
Caught by looking at it, not by reasoning about it. The back texture is flipped
on its own U axis now, so the reverse is both washed out and mirrored.

`shots/mirror/02-banner-front.png` and `03-bunting-back.png` are the pair.

The pennants and the chain-link keep `DoubleSide` deliberately: a bunting flag
and a wire diamond are symmetric, so there is no front and back to get wrong.
