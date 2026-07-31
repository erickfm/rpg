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

## ~~What would make `mirror-walk` category A~~ — it cannot be, and that is correct

I proposed reading the **painted texture** as an independent side B. Checked
before starting it, and it does not work:

```ts
export function doorAlongU(name, wMeters, fallbackM) {
  return declaredAlongU(name, wMeters) ?? fallbackM;      // tex-world.ts:645
}
```

The painter's door position **is** the declaration. Reading the pixels would
compare the declaration against itself with extra steps.

### And that is the design working, not a gap

The circularity is a **consequence of the fix the user asked for.** Before the
descriptor, the facade and the room each authored the door independently — two
numbers, no connection — and that is exactly why they disagreed and why the user
complained. Unifying them onto one declared number is what made the disagreement
impossible.

Once they share a source, **any pair of consumers is circular by construction.**
That is not a weakness in the check; it is the whole point of the change. What
remains possible after unification is a transit fault — a dropped declaration, a
mirror applied twice or not at all — and a category-C check is exactly the
instrument for those. It caught precisely that, twice: the harness whose two
expressions reduced to the same value, and `frontage-honours`' dropped-declaration
case.

**So the correct reading is:** the independent evidence was needed to establish
the requirement, and eyes supplied it (`A-mirror-verified.md`). The ongoing check
is plumbing by design and cannot be otherwise. I should describe it that way
rather than as a check with a deficiency.

### The furniture candidate — checked, and the answer is "partly"

I said this was unverified, so I verified it. `ct/int-diner.ts` places its booth
run from the **room box** — `hw`, i.e. `roomWidthFor(frontageM)` — and `away`.
There is no reference to `win`, `glaze` or the glazing run anywhere in that
placement.

So the two sides are:

| side | derived from |
|---|---|
| the glazing run | the **painter's** canvas layout — `B.ox`, `B.gi`, the shopfront kit |
| the booth run | the **room's** half-width, `roomWidthFor(frontageM)` |

**Common ancestor: `frontageM`. Different derivations from it.** That makes the
pair better than circular and short of independent:

- it **can** catch the two sides computing different runs from the same width —
  which is a real authoring disagreement, and is exactly the reasoning that
  caught the diner's glazing when I nearly filed a false report about its blank
  wall
- it **cannot** catch a wrong `frontageM`, because both sides would move together

That is worth writing down because "partly independent" is a real category the
`1776b21e` scheme does not have, and the honest place for this pair is between
its B and C rather than in A. One caveat on the booth side: `away` **is** derived
from the door declaration, so only the booth run's EXTENT is independent, not
which end of the room it sits at.

Not building the check. The one time this comparison was needed it was done by
hand in ten minutes, it is a single room's furniture rather than a rule about the
world, and a permanent instrument whose two sides share `frontageM` would invite
exactly the over-reading I have spent two commits warning about.
