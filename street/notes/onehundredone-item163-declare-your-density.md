# onehundredone / item 163 — a surface can state its own px/m now

**DONE.** The user, on the jail, 2026-08-02: *"why aren't we catching these?
what's causing them and do we need to set a rule against them so they aren't
created?"* BUILDER-BRIEF §7b is the rule he asked for — *"every textured surface
DECLARES its density and DERIVES its repeat from its own dimensions"* — and
**there was no way to obey the first half.** `declareSurface` declared a KIND.
`masonry().paint()` is the only thing in the world that stamps a px/m and it
only paints brick. **7.4% of textured faces could declare a density at all.**

Root cause in one line: **the guards could only ever use an invariant that needs
no declaration — *on a correctly mapped face a texel is square* — which catches
a stretched face and is blind to a face that is uniformly, squarely, WRONGLY
dense.** A 4 px/m wall and a 200 px/m sill both score 1.00 on it, and both are on
§7b's list of what has actually reached the user.

---

## The API — three calls, `src/proto/ct/paint.ts`

```ts
declareSurface(t, 'detail', 12)   // I painted this at 12 px/m   (3rd arg is new, optional)
fitRepeat(t, 2.4, 0.8)            // …so on a 2.4 × 0.8 m face, this repeat
boxFaces(t, w, h, d)              // …and on a BOX, one material per face
```

plus **`BOX_FACE_DIMS(w, h, d)`** — THREE's `[+x,-x,+y,-y,+z,-z]` order and the
two real metres each face spans, written **once**. Getting that wrong is this
repo's most expensive recurring mistake: it produced two retracted findings (42
"off-density" faces, 135 "disagreeing" junctions) and `scripts/lib/faces.mjs`
exists solely because of it. `boxFaces` covers the one-texture case; a caller
wanting different canvases per face uses `BOX_FACE_DIMS` + `fitRepeat` directly,
which is what both civic adoptions do.

**`slabTex` stamps its own** — it is sized from real metres at a stated `ppm`, so
it is the one painter in the world that already knew the answer. One argument,
and **every existing `slabTex` call site in the world became a declared surface
without being touched**: 31 faces, instantly, including six that were wrong.

**Nothing was retrofitted.** The item says do not touch 3,782 call sites and I
did not. `masonry` keeps its own richer `userData.masonry` stamp and is read by
the old path; the new `userData.ppm` is a second stamp, not a migration.

### Why `boxFaces` is the one that matters

**Almost every gross face in this world is a box wearing ONE material on all six
sides**, with a repeat computed for whichever side the author was looking at.
`ct/interior.ts`'s `boxMats` already solved exactly this for the interior kit and
its author left the trap written at the call site — *"±x is DEPTH across, ±z is
WIDTH"* — because **all three of its callers had got it wrong**. This is that
solution hoisted out of the interior kit's private ownership.

---

## Measured — `scripts/texdensity.mjs`, built bundle, port 4191

| | before | after |
|---|---|---|
| faces with a checkable density | 327 (**7.8%**) | 535 (**12.7%**) |
| …of which non-masonry | **0** | **208** |
| **civic gross faces** | **39** | **14** |
| world gross faces | 193 | **168** |

**The new verdict found nine defects on its first run**, on the 31 faces
`slabTex` declared for free — including **the single worst face in the world**,
the jail site's `2.4 × 0.05 m` at **1540 px/m against a declared 32**. Every one
of those was previously visible only through the aspect proxy or not at all.

### The adoption, in civic (the item's named category)

**1. `stoneFace` declares and derives.** It hand-computed `wM / ST_TILE`; it now
`declareSurface(c, 'brick', 32)` + `fitRepeat`. Same arithmetic, but the number
is on the texture where the audit can read it. **I also deleted its
`Math.max(0.12, …)` floor** — that clamp fired on any member under 0.18 m and
was itself *making* the defect on the smallest members, which is how an 0.152 m
pilaster came to draw 399 px/m against a declared 32.

**2. The library flight's step sides, sized per face.** The steps are **nested
boxes**: each runs from the ground to its own tread, so its side faces are up to
**4.1 m** tall while the material was built once at a nominal `(1.4, 0.19)`.
**1.48 px/m against a declared 32** — civic's largest single cluster, eight
faces, and invisible to the eye because only the top 0.19 m of each box is not
buried behind the step below.

**3. The church buttress set-offs, sized per face.** Built once at `(1.9, 0.36)`
and handed to every set-off whatever its size; the ±x faces are **0.152 × 0.18 m**.
**399 px/m against a declared 32.** Declared-wrong faces fell **51 → 19** on this
one change.

---

## My verdict on the after-images, which I have looked at

`shots/w101-civic-{library-steps,church-buttress}-{before,after}.png`, both at a
**pinned 13:00** (a game day is 24 real minutes, so an unpinned pair is two
different times of day).

- **library steps — indistinguishable, which is the claim.** No geometry, colour
  or joint moved; the visible top 0.19 m of each step reads exactly as before,
  and now draws at the 32 px/m the code always said it did instead of 1.48.
- **church buttress — a visible improvement.** Before, the sloped weatherings
  crossing each buttress carry **chunky light/dark rectangles** — a 48 px canvas
  crushed into 0.152 m. After, they read as the same fine even stone grain as the
  ashlar around them.

**⚠ My first buttress vantage was useless** and I nearly filed it: 4 m from the
wall at eye level, photographing a lamp post and a passing citizen. The set-offs
are at 1.50, 6.40, 11.40 and 15.40 m — a level frame contains almost none of
them. Both frames were re-shot standing back and looking up.

**`npm run sweep`'s three civic stations are all INDOORS** — `bug-church-far`
and `bug-library-entry` are both interiors — so **nothing in the standing sweep
sees either member I changed.** That is why `probes/w101-civic-stone-look.mjs`
exists rather than a diff of sweep output, and it is worth the desk knowing.

---

## The new verdict can go red — proved, with its own mutation

The existing `--selftest` multiplies `repeat.x` ×5, which makes a face
NON-SQUARE. **It cannot exercise the declared-density verdict at all**, because a
declared face can be perfectly square and still wrongly dense — that is the whole
reason the declaration exists. A second verdict with no mutation behind it is a
verdict nobody has proved can fail, and this file's own header is about exactly
that failure.

So there is a second mutation: pick a declared face **currently within 1.5× of
what it declared**, multiply BOTH axes by 6, and assert **that face by identity**
— never `declWrong.length`, which is 19 on this world whatever the mutation does.
That is the documented trap the first selftest fell into and it is avoided here.

```
selftest: x5 repeat.x on a 1.938×126.5 m face — THIS FACE must appear below
selftest: x6.0 repeat on a 3.4×5.5 m face declaring 32 px/m — THIS FACE must appear too
selftest: caught it — that face is in the list at 5x
selftest: caught it — declared 32, drew 192.35×192 px/m
```

---

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` | 17/17 |
| `node scripts/health.mjs` (built bundle) | `WORLD OK`, exit 0 |
| `texdensity --selftest` | **both mutations caught by identity**, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, 0 STATION MISS, 0 COVERAGE |

`fp`/`fpdiff` deliberately not used: the adoption creates extra texture clones,
which shifts the seeded random stream and repaints every dithered texture after
it (CLAUDE.md).

---

## ⚠ A LIVE RATCHET REGRESSION THAT IS NOT MINE — the desk needs this

**`texdensity` is red, and it was red before I touched anything.**

```
REGRESSION — these owners gained stretched faces:
   interior:hotel: 3 -> 9
```

`a60a6e8f5` — *"Item 96: the hotel's upholstery has a weave; it was flat
colour"*, landed 2026-08-03 05:45 and reached me through a mainline merge —
converted the lobby seating to `slabTex`. **That is correct and it is this
project's own doctrine.** But a 1:1 sheet sized for a chair's front was handed to
its **0.1 m arm ends** unchanged, and it added **six gross faces**.

**It is the perfect statement of why this item exists**: a builder doing exactly
the right thing, with the best tool available, created six density defects
because nothing tied a texture's density to the face it lands on. **`boxFaces` is
the one-line fix** and the six faces are now *named* by the new verdict rather
than merely counted:

```
declared 48.00, draws 250×48    px/m  face 0.1×0.5  m  interior:hotel  at (876.2, 0.7, 9.4)
declared 48.00, draws  50×200   px/m  face 0.5×0.12 m  interior:hotel  at (876.4, 0.4, 9.4)
   …four more
```

**I did not fix it.** It is another builder's just-landed work in a file item 163
does not name (BUILDER-BRIEF §9), and editing across a live landing is the exact
conflict §9 exists to prevent. **I also did not `--bless` it** — blessing away
somebody else's regression is how a ratchet stops meaning anything.

---

## FOUND AND NOT FIXED — for the desk to rank

1. **The hotel upholstery regression above.** Six faces, one `boxFaces` call,
   belongs to whoever holds item 96. **Until it lands, `texdensity` stays red.**
2. **168 gross faces remain** (was 193). Worst owners now `interior:bank` 32,
   `interior:jail` 20, `?` 19, `props` 14, `civic` 14. Item 162's territory.
3. **19 DECLARED faces still draw ≥4× their declared density**, 13 of them
   civic. These are newly *visible* rather than newly broken — the same members
   were wrong yesterday with nothing able to say so. Each is a `stoneFace` call
   passing a nominal size instead of the face's own.
4. **`scripts/texdensity.mjs` is still not registered in `checks.mjs`** — worker
   sixtytwo asked for this under item 107 and it has not happened. One row:
   `['texdensity', 'does every textured face draw at a square, sane density?', true]`.
   Not my file to edit (§9), and the new declared-density verdict makes it worth
   more than it was.
5. **`declareSurface`'s third argument is optional and always will be**, so §7b
   is now *possible* to obey rather than *enforced*. The enforcing move is a
   check that fails on an undeclared textured face above some area — 3,683 faces
   is far too many to switch on today, but the ratchet pattern already in
   `texdensity` is exactly the shape for it.
