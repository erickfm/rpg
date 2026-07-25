# Builder A — my instruments, classified the way `1776b21e` classified theirs

> *"Three of my checks compared a number against itself. Rather than find a
> fourth by accident, classified the whole set."* — `1776b21e`

Right discipline, and it applies to mine. Doing it before someone else has to,
and one of the results is uncomfortable.

## A — INDEPENDENT: two sides with no common source. These verify.

| check | side A | side B |
|---|---|---|
| `check-seethrough` | the rendered frame through the glass | ground materials tinted magenta — a **physical consequence**, not a number |
| `seampairs` | one face's density | a **different** face's density |
| `nightgrade` | a material's colour at noon | the same material after the dimmer ran — a consequence, not a restatement |
| `check-wiring` | `build*` exports in source | call sites in a **different** part of source |
| `check-artifact` | `__ct` initialised | pixels actually drawn on the canvas |

## B — RULE-BASED: measured against a stated rule.

| check | rule |
|---|---|
| `density` (grid half) | declared densities against 8 / 16 / 32 — 201 / 39 / 1, nothing else |
| `seampairs` (like-for-like) | two faces declaring the same density must draw the same brick |

## C — CIRCULAR: both sides descend from one value. **Plumbing only.**

| check | the shared ancestor | what it still catches |
|---|---|---|
| `density` (per-face half) | `masonry(wM,hM)` sizes the canvas **and** the mesh is built from the same metres | a texture handed to a **differently sized** mesh — exactly what the church tower flagged |
| `frontage-honours` | the painter **reads** the declaration it is compared against | a **dropped** declaration in transit, which is precisely what it was built for |
| **`mirror-walk`** | the room builds its doorway from `DOOR.at`, and the facade paints from the same declaration | a **missing or doubled mirror** — nothing about whether the door is in the right place |

## The uncomfortable one

**`mirror-walk` is category C, and I have been quoting "5 of 5 rooms mirror" as
though it settled the user's ask.**

It does not. Both sides descend from one declared number, so what it proves is
that **the mirror is applied exactly once on each side**. That is worth having —
it is the bug I found *in the harness itself*, where both expressions reduced to
the same value and it could never have passed. But it cannot tell you the door
is where the user wants it. If a room declared its door on the wrong side, this
check would agree with it enthusiastically.

The thing that can answer the user's question is a person standing in the room
and looking — which is what `A-mirror-verified.md` records for four of them, by
eye, with shots. **That evidence is not superseded by the harness; it is the
independent half the harness does not have.**

I should have said that when I reported 5 of 5.

## What would make `mirror-walk` category A

Compare the room's doorway against something that does **not** come from the
declaration — the painted texture itself. The facade's door is drawn into a
canvas at a texel column; reading where the dark door pixels actually are and
converting through `alongU` gives a side B with a genuinely different ancestor.
That is a real piece of work rather than a tweak, and I am recording it rather
than claiming it.
