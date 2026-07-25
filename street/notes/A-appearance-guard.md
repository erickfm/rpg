# Builder A — the one appearance request in my area now has a guard

Landed in **`6070da66`**: `scripts/burger-palette.mjs`, registered in
`npm run checks`.

## Why

`e90c6736` audited every user request against the 30 registered checks:

> The suite covers behaviour and geometry thoroughly and **appearance almost not
> at all** — and appearance is where most of the user's requests live. Every
> unguarded item is something you can only confirm by looking, which means it is
> **confirmed exactly as often as somebody looks.**

Of the unguarded list — wheel arches, blade-sign handedness, the cat and alley
litter, citizens' legs, BURGER BARN's colour — exactly one is mine. The queue
says why it matters: *"burgerFront … kept its mustard through three fixes."*

## What it asserts, and what it deliberately does not

**Asserted:** mustard is absent. Saturated yellow at hue 45–70 on the shopfront
band, which is what *"it is still mustard"* meant. Measured **0.0 %** today;
fails above 15 %. `--selftest` repaints the band `#c9a227` and it goes red.

**Not asserted:** that red is present.

I meant to assert both. I measured "red 18 %" with a quick probe, set the floor
at 8 %, and then the check — which requires saturation ≥ 0.25 — read **1.9 %**
and **failed a world that is correct**. The 18 % was mostly *desaturated*
brick-red: the wall, not the paintwork.

**A threshold carried across from a different metric is how a check cries wolf on
its first day.** Half a guard beats a wrong one, so the red half is documented in
the file as unassertable rather than quietly loosened until it passed — which was
the tempting fix and would have left a number nobody could justify.

## Second one landed: the tree crowns (`bfbd76c5`)

Same shape, same reason it works. The user reported reading a building through a
canopy; the cause was `treeSprite`'s ragged-edge pass biting notches from 0.94 of
the radius **outward**, eating the crown interior.

The sample box is **derived from the generator**, not guessed: the crown is an
ellipse at `(W/2, 20+rand(5))` with radii `RX 23–30`, `RY 16–22`, so x within ±8
of centre and y in 22..30 is inside any crown it can produce.

```
11 canopies, crown-interior holes: 0% ×11        fails above 2%
```

`--selftest` bites a 10×5 hole in one crown and it goes red. Foliage narrower
than 40 px is excluded **by shape** — ivy is foliage but not a crown — so
anything new is covered or excluded on its merits rather than by a name list.

## All four landed

| user's words | guard | measured today | fails at |
|---|---|---|---|
| "it is still mustard" | `burger-palette` | mustard 0.0% of the band | above 15% |
| "you can read a window through the trees" | `tree-crown` | 0% holes in 11 crowns | above 2% |
| "the lit windows are diagonal stripes" | `window-lattice` | 0 lattice matches of 7 testable | any exact residue class |
| "the glass is a black hole" | `shop-interior` | mean luminance 45–76 | below 20, or >20% near-black |

Each was reported by the user in their own words, each was fixed, and each was
then protected by nothing. Every one has a `--selftest` that restores the
original defect and is watched going red.

**The transferable result, and it is the opposite of where I started.** I
accepted `e90c6736`'s framing that appearance cannot be guarded because it needs
eyes. That is true of appearance as **quality** and false of appearance as
**regression**:

- *"red and beige"*, *"a ragged natural silhouette"*, *"a room behind the glass"*
  — judgements. Not checkable, and I did not pretend otherwise: the red half of
  `burger-palette` is documented as unassertable rather than loosened until it
  passed.
- *"it went mustard"*, *"there is a hole in the crown"*, *"they are on a
  diagonal"*, *"it is a black rectangle"* — signatures. Countable, and three of
  the four are **exact** rather than statistical.

The reason it works is that a user complaining tells you the defect, not the
quality. The complaint is already the specification for the check.

## ~~The third candidate, and why I have not built it~~ (built — see above)

The **lit-window lattice**: the user's report was that lit windows formed diagonal
stripes, because the choice was `((f*7 + c*3) % 5) === 0` — a linear congruence
in floor and column, which is a lattice and not a scatter. Fixed with an
avalanche hash.

It has a signature, and a good one: for a lattice, every lit cell satisfies
`(a·f + b·c) % n == k` for some small `a, b, n`. Testing a handful of those is a
sharp, specific test for "this is a lattice again".

**What stops it is that the window grid is not published.** The lit cells live
inside a painted canvas, and recovering `(floor, column)` from pixels means
re-deriving the layout the painter already knows. So it needs a publication —
`userData.windowGrid` on the facade texture, say — *and* a consumer, which is
more than a turn's work and more than I have context for now.

Recorded with the design rather than half-built. The two that landed both took
one turn each precisely because their signatures were already visible from
outside.

Appearance requests resist guarding for a specific reason: **the ask is a
positive quality and the regression is a specific defect.** "Red and beige" is a
judgement; "it went mustard again" is a signature. Only the second is machine-
checkable.

So the tractable form is not *"does it look right"* but *"has the exact thing the
user objected to come back"* — narrower, defensible, and it guards the case that
actually recurred. Three of the remaining unguarded items may have such a
signature; the rest need eyes, and saying so is better than pretending a
threshold covers them.
