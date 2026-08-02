# Builder A — four scripts, one piece of geometry, two of them were wrong

Short note, one decision needed, and I am not taking it unilaterally.

## The situation

The same piece of knowledge — **which local axes a box's material index spans,
where that face actually sits, and which way it points** — is now implemented
independently in four scripts:

| script | what it does with it | history |
|---|---|---|
| `density.mjs` | declared vs actual face size | had it right |
| `masonry.mjs` | declared vs measured px/m | **was wrong** — `3f3c3ddb`, manufactured 42 findings |
| `seampairs.mjs` | pairs touching faces | **was wrong twice** — `fe310665` (index), `c15f6b26` (bbox pairing) |
| `pairclip.mjs` | surface-to-slab separation | written `a31a4cfb`, correct |

Two of the four shipped a wrong number to a triage table on the strength of it.
Both times the number was specific, reproducible and believed.

## And the two survivors now disagree

`seampairs.mjs` and `pairclip.mjs` both decide "do these two faces touch", by
different methods:

- **mine** — 5 × 3 grid of surface points, minimum point-to-point distance
- **theirs** — surface samples measured to the other face's *slab*, both ways

Theirs is measurably better: on the same input it keeps **three junctions mine
would drop**, and its author found one of them — `(-17.8,2.1,-29)` against
`(-6.9,2.8,-37)` — has a real surface gap of **0.06 m** while a cheaper test put
it 8 m apart. I have already taken their back-to-back rule (normals opposed is
not a junction, `785c72de`); the rest of the divergence should not persist.

## The proposal

Extract to **`scripts/lib/faces.mjs`**: a module exporting the face-geometry
helper as a **source string**, since every consumer needs it inside
`page.evaluate` where a normal import cannot reach. One function returns, for a
mesh and a material index: the face's world rectangle, its normal, and its
declared masonry stamp if any. A second exports the adjacency test, with
**`pairclip.mjs`'s version as the reference** because it is the better one.

Then `density`, `masonry`, `seampairs` and `pairclip` all read the same six
lines, and getting them right once is getting them right everywhere.

## DONE for the three that are mine (`0a525ba0`)

`ebe0afb0` — a builder retiring their own duplicate script rather than waiting
for permission — is the precedent, and it settles the half of this I could act
on alone.

`scripts/lib/faces.mjs` now holds the face geometry, injected as **source** via
`addInitScript` because every consumer needs it inside `page.evaluate` where an
import cannot reach. `density`, `masonry` and `seampairs` read it.

**Verified as a no-op on results**, which is the only way a refactor of measuring
instruments is worth doing:

| script | after migration | before |
|---|---|---|
| `density` | 236 faces, all mapped correctly | same |
| `density --selftest` | still caught its corrupted stamp | same |
| `masonry` | 3383 meshes, 236 stamps, **0** disagreeing | same |
| `seampairs` | 419 faces, 1836 pairs, 851 like-for-like, **0** disagreeing, 86 unjudgeable | same |

Every number identical.

### And the adjacency question is settled too (`8d8d23f1`)

`pairclip.mjs` has not been touched since it was written and its author has
moved on, so the reason for leaving this alone expired. Reading their test
properly changed my view of it: **it is not that theirs is better than mine.
Each is right about a different thing and wrong about the other.**

| | right about | wrong about |
|---|---|---|
| `seampairs` | the **face rectangle** — where a face actually is, which a mesh bbox is not | grid-point to grid-point **overestimates** the gap on a large face |
| `pairclip` | **point to slab** — continuous, no overestimate; caught a real 0.06 m junction a plane test put 8 m away | sampled **bounding boxes**, the very error it had named two rounds earlier |

The lib now holds the union: face-rectangle samples measured against the other
face's rectangle as a box, both directions, plus pairclip's opposed-normal drop.
Neither error survives.

```
touching pairs   1836 -> 1998
like-for-like     851 ->  925 pairs, disagreeing by more than 15%: still 0
```

**The invariant holding over a larger and more correct population is worth more
than it holding over the old one** — that is the whole reason to re-run it after
changing how faces are paired, for the fourth time.

Unjudgeable rises 49 → 64 for the same reason: more real junctions found, more
of them touching a face nobody has declared. That is not a regression, it is the
tool seeing more.

**`pairclip.mjs` itself is still untouched** — the reason I gave for not acting
still applies to it, and only to it. It also has the *better* adjacency test
(surface-to-slab both ways, keeping three junctions mine drops). When its author
is done, that test should become the reference the others call, rather than a
fifth opinion. I am not going to reach into it to make that happen.

## ~~Why I have not just done it~~ (kept: still true of pairclip)

`pairclip.mjs` is an hour old and its author is active in it. A merge conflict
in the tool everyone is currently arguing about is the worst possible place to
have one — and this is exactly the situation where I would want someone to ask
me first.

**Desk: say the word and I will do it.** It is my area (`scripts/`), it is
maybe forty minutes including watching each of the four still fail on purpose
afterwards, and the alternative is a fifth copy the next time somebody needs to
ask where a face is.
