# Builder A — the seam finding is a box face index, twice

Landed in **`b69f3dd6`**, `scripts/seampairs.mjs`. Companion to `3f3c3ddb`,
which fixed the identical read in `scripts/masonry.mjs`.

## What was escalated

`AUDIT-TRIAGE.md` row 0, graded **player-visible**, routed at **`masonry()` in
`tex-world.ts` + callers** — my file:

> **135 of 239 like-for-like masonry junctions disagree by >15%**, density
> spanning 3.43–46.67 px/m. Every one passes the 8/16 grid check.

## The cause, same as an hour ago

`seampairs.mjs:28` reads `o.material[0]`; `:34` measures `parameters.width`. On
a `BoxGeometry`, material 0 is the **+x face — depth × height**. This is exactly
the read I fixed in `masonry.mjs` in `3f3c3ddb`, where it manufactured 42
disagreements and I showed declared width == box **depth** on 42 of 42 and ==
box **width** on 0 of 42.

The tell was there before I opened the file: **4.09 px/m appears verbatim in
Round 10's table**, as one of the 42 already proven to be a misread. A number
that survives its own refutation into the next round is worth checking first.

## After the fix, and the split that mattered more

```
236 masonry faces · 1540 touching pairs

LIKE-FOR-LIKE (both faces declare the same density): 1228 pairs
   disagreeing by more than 15%:  0

declared-DIFFERENT among the disagreements: 312 — ratios 1.99× to 2.04×
```

The index fix alone was not enough. **The script never computed "like-for-like"
at all** — that split lives only in the note's prose, while the code printed a
single undifferentiated count. So a shopfront band declaring 16 meeting the wall
declaring 8 was counted as a disagreement, when that junction *is* the design:
`SHOP_MULT` is 2, and every one of the 312 lands between 1.99× and 2.04×.

Counting the intended junction makes the number say the opposite of what it
means — and the number is what gets escalated into a triage table. The script
computes the split now, so it cannot drift from its own headline again.

**The 13.6× range is gone with the misread. Like-for-like horizontal density is
one density, across all 1228 junctions.**

## What I cannot close from here, and am not pretending to

The triage grades this **"Yes — photographed. Two walls meeting at a corner with
different brick widths, legible in one glance."**

**A clean measurement does not make a photograph wrong.** If that shot shows a
real seam, it is one of:

- the **2× band/wall junction** — intended, but "intended" and "looks wrong" are
  different claims, and only the second one matters to a player;
- something **`masonry()` did not paint**, which this tool cannot see at all —
  the 9.41 px/m ashlar in `A-density-stamp.md` is exactly that kind of surface;
- two faces that **do not touch by bounding box** and so never became a pair.

Worth re-reading the shot against these numbers before the finding is closed or
re-routed. I am not claiming the photo is nothing — I am claiming the 135 is not
what explains it.

## The live half now has candidates (`409d7433`)

`f604c531` ruled out the 2× band/wall junction **by looking** — the transition
happens behind the fascia on every character front, and the residential ground
floors have no band at all. Good result, and it closes with:

> the live half is the second one, and **I have no candidate for it in
> `ct/street.ts`**

There are candidates, and they are not in `ct/street.ts` — which is why looking
there found none. **This tool could not surface them by construction:** it
collected only *stamped* faces, so "declared masonry standing next to something
`masonry()` never painted" was invisible to the one instrument aimed at seams.

It collects wall-sized unstamped faces now:

```
DECLARED masonry touching UNDECLARED brick-like faces, disagreeing: 140

 u 2.70×   UNDECLARED 5.92 px/m at (-14.1, 2.8, -97.9)   vs declared 16
 u 2.66×   UNDECLARED 6.01 px/m at (-25.2, 2.7, -97.9)   vs declared 16
 u 2.64×   UNDECLARED 6.05 px/m at (-26.9, 2.5, -68.1)   vs declared 16
 u 2.64×   UNDECLARED 6.05 px/m at (-17.1, 3.0, -68.1)   vs declared 16
```

**Four faces at a consistent ~6 px/m** — brick scale, not detail scale —
standing against declared masonry. Those are the ones worth photographing.

**This is a candidate list, not a defect list, and I am not routing it as one.**
The other entries (20 px/m, and 1.45 px/m out by the car lot) are almost
certainly signage and decals, and this tool cannot tell those from brick. The
9.41 px/m ashlar in `A-density-stamp.md` was exactly this kind of face and turned
out to be a legitimate hand-painted surface. It needs eyes — and per
`f604c531`'s own hard-won rule, eyes at **the same angle and distance**, which is
the part that keeps fooling people at corners.

### Eyes came back: all four were ivy (`f79d3fc1`)

`1466eb13` — *"The four ~6 px/m candidates are ivy — f455f4af's list, with eyes
on it"* — read every one and found **ivy on party walls**. Right answer, and the
loop worked exactly as intended: the tool proposed, a person disposed, one pass.

But it cost that pass, and the tool would have re-offered the same four every
run. So the tool learned the rule rather than the exception:

> **Masonry is never a cut-out.**

A face with `alphaTest` is foliage, a fence, a sticker or a sign — you can see
through it, so it is not the brick wall the seam question is about. Ivy is
exactly that (`alphaTest 0.5, DoubleSide`), **and so is whatever of its kind gets
built next year.** A list of things to ignore would have covered the ivy and
missed its successor.

```
candidates: 140 -> 69, and the ivy is gone without being named
```

Then the remainder splits, and the two halves want different people:

```
of those, the undeclared face is itself OFF the 8/16 grid: 63
the rest read 8 or 16 — a provenance question, not a visual one
```

An undeclared face measuring 8 px/m **looks exactly right** — it is simply
painted outside `masonry()`, and nobody can photograph it. The off-grid 63 are
what a picture of mismatched brick could actually be. That is where eyes go next,
and per `f604c531`'s rule, at the same angle and distance.

## And a headline I broke myself in the same commit

Collecting unstamped faces let them leak into the `declared-DIFFERENT` line,
widening its ratio range to 1.18×–11.05× and making it claim something it could
not support. Restricted to pairs where **both** declare, it reads 312 pairs at
1.99×–2.04× again.

That is the third time in this file a summary line has counted something it
should not have, and the **second time it was mine**. The failure is not
carelessness about arithmetic — it is that adding a new population to a tool
silently changes every aggregate already in it.

## Round 12 checked my candidates properly, and the pairing was wrong (`c15f6b26`)

`7d4c345b` did what I asked — put eyes on the list — and went further, checking
whether the junctions I reported exist at all:

> no declared-16 face within 4 m of any of the four. The declared-16 faces are
> shopfront bands — long thin meshes whose bounding boxes span an entire
> frontage — so a bbox-adjacency test pairs one with something metres from any
> part of its actual geometry. **A bounding box is not the shape.**

Correct. And it is **the same error I fixed in two other scripts two rounds
ago** — `parameters.width` is not the width of every face of a box — sitting in
the adjacency test of the third, where I never thought to look for it. I fixed
the reading of faces and left the *pairing* of them naive.

Each face now carries its own world-space rectangle: placed on the correct side
of the box, spanning the correct two axes, sampled on a **5×3 grid** and
transformed by the mesh's own matrix. Adjacency is the minimum distance between
those samples.

The grid rather than the four corners, because **two long walls meeting along
the middle of an edge share no corner** — exactly the junction this tool exists
to find. Corners alone: 1778 pairs. The grid: 1941.

```
the four park boundary walls paired with a declared-16 band:  0   (was 4+)
LIKE-FOR-LIKE pairs: 907, disagreeing by more than 15%:       0
```

The invariant survives the change, which is the reason to re-check it rather
than assume: like-for-like masonry is still one density.

**Also the ivy verdict was itself revised.** `1466eb13` said the four were ivy;
`7d4c345b` says they are the park's boundary walls, with ivy and a tree in front
— the normals settle it. My `alphaTest` exclusion was still the right rule for
the wrong reason: it removes ivy, which is a cut-out, but the four faces it
appeared to remove were the walls behind the ivy, and those are now excluded by
the honest pairing fix instead.

## Where this ended up (`a5a195a8`)

`a86f970d` declared nine more faces, including the x±6.9 family. The seam
question is effectively answered:

```
419 masonry faces · 1998 touching pairs
LIKE-FOR-LIKE (same declared density): 925 pairs, disagreeing:  0
brick vs brick, a real seam question:                           0
one side says it is not brick:                                105
UNJUDGEABLE:                                                   10   (from 150)
   resting on 3 distinct faces, 7 pairs off-grid
no two faces that should draw the same brick draw different brick
```

And it left one of my summary lines false. *"The undeclared face is off the
8/16 grid: 110 — those are the ones a photograph of mismatched brick could be"*
counted every mixed pair. Right when every mixed pair was a candidate; wrong the
moment modules declared, because a face declared `'detail'` is **legitimately**
off the grid — a door handle is not brick and is not meant to be 8 px/m. Over
the population still open it is **7**. The line overstated by a hundred.

### The pattern, now that it has happened four times

| # | line | why it went stale |
|---|---|---|
| 1 | `declared-DIFFERENT … SHOP_MULT is 2` | ratio range grew to 4.03× when flagstone paving entered |
| 2 | same line again | unstamped faces leaked into it |
| 3 | `UNDECLARED` in the examples | meant "no masonry stamp", read as "nobody declared it" |
| 4 | `off the 8/16 grid: 110` | counted answered pairs after the world answered them |

**None was wrong the day it was written.** They go stale because the world
answers the question underneath them and the line goes on describing the
question. That is a different failure from a bug, and it is not caught by tests —
only by re-reading the output as if you had never seen it.

I also broke the script making this fix — moved a computation above the variable
it reads, temporal dead zone — and caught it because I ran it and saw `rc=1`,
not because I reread the diff and called it obvious.

## The pattern across three rounds

| round | claim | actual |
|---|---|---|
| 10 | 42 of 109 faces off-density | box face index (`3f3c3ddb`) |
| 11 | 135 of 239 junctions disagree | same index, plus band-vs-wall counted as a fault |
| 12 | my four ~6 px/m candidates | park boundary walls; **the pairing was my bbox artefact** (`c15f6b26`) |

Both tools were written to check my stamp and both inherited one read. That is
not a knock on the auditor — the seam question is the right question, and nobody
had asked it. It is an argument for the fix I would make next: **the face-index
logic exists in three scripts now and has been wrong in two of them.** It should
be one shared helper that every masonry tool imports, so getting it right once
is getting it right everywhere. `scripts/` is mine; I will do that if the desk
wants it, rather than fixing the same six lines a third time.
