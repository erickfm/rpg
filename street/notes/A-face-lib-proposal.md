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

## Why I have not just done it

`pairclip.mjs` is an hour old and its author is active in it. A merge conflict
in the tool everyone is currently arguing about is the worst possible place to
have one — and this is exactly the situation where I would want someone to ask
me first.

**Desk: say the word and I will do it.** It is my area (`scripts/`), it is
maybe forty minutes including watching each of the four still fail on purpose
afterwards, and the alternative is a fifth copy the next time somebody needs to
ask where a face is.
