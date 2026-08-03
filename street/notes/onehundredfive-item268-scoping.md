# Item 268 — SCOPED, NOT FIXED. The mismatch is real, and the reasoning that caused it is written down in the source

Worker onehundredfive, 2026-08-03. Port **4611**, built bundle.
**I released this item rather than finishing it** — see "Why I stopped" at the
bottom. Everything below is measured.

---

## 1. The row's evidence is on the wrong axis

The row quotes the frontages as **`cz: 39.45` (hotel)** and **`cz: 51.225`
(casino)** and argues "along the street axis the hotel is at the LOWER z".

**Those are world `x`, not `z`, and these buildings are not on the main street.**
`__ct.doors()` says:

```
HOTEL ORPHEUS  world (39.51, −96)   outward normal (0, −1)
SEVENS         world (51.29, −96)   outward normal (0, −1)
```

They stand on the **side street**, which runs along **x** at z ≈ −96. The main
street's z runs about −108…+16, so 39.45 and 51.225 cannot be z on it. Any
handedness argument built on "lower z" is an argument about an axis these two
buildings are not laid out on. **The row flagged its own numbers as evidence and
not diagnosis, and it was right to.**

## 2. The mismatch is REAL, and it is exactly what the user said

Left/right is derived from the rig's own convention — `crosstown.ts:1195`,
`fwd = (sin yaw, 0, −cos yaw)`, so `left = (−cos yaw, 0, −sin yaw)` — and the
same function is used for both readings so they cannot be computed differently.

**OUTSIDE**, standing on the pavement between the two frontages facing them
(yaw −π, i.e. facing +z):

```
left = +x   →   casino (x 51.29) is on your LEFT,  hotel (x 39.51) on your RIGHT
```

**INSIDE — and this is the number that matters, taken by WALKING IN rather than
by computing.** Standing on the casino's own published door stand point and
pressing [E]:

```
before  (51.29, −96.75)  yaw 3.142
ARRIVED (885.68,  16.85) yaw 0        →  fwd (0, −1),  left (−1, 0)
```

So you enter the casino heading **−z**, and **your left is −x**. The hotel room
sits at `cx 874.32` against the casino's `885.68` — **lower x, therefore on your
LEFT.**

> **Hotel on your RIGHT outside. Hotel on your LEFT inside. The user is right.**

> ### ⚠ I COMPUTED THIS WRONG FIRST, AND WALKING IT IS WHAT CAUGHT ME
> My first probe derived the inside facing from the room's own published
> `door: {x:0, z:18, nx:0, nz:-1}`, took `nz = −1` as the OUTWARD normal, and
> concluded you enter facing **+z** — which makes the two sides *agree* and the
> item a no-op. Pressing [E] on the real door lands you facing **−z**, the
> opposite. **A normal whose convention you assumed is not a measurement.** The
> row's instruction — *"stand on the pavement …; walk in; note the order"* — is
> the whole reason this did not get filed as "already fine".

## 3. THE CAUSE IS A MIRROR THAT DOES NOT EXIST, and it is argued in the source

`ct/interior.ts:107-114`, the doc comment over `PARTY`:

> *"On the pavement, HOTEL ORPHEUS runs x 33.45…45.45 and the casino wing
> 45.45…57.00, so facing the property the casino is on your LEFT — and **a room
> is its facade seen from behind, so what is on your left outside is on your
> right once you are inside** (the `localOf` mirror, forty lines down). The
> casino therefore has to sit on the hotel's +x side in the belt."*

**Its first clause is correct and its second is not.** Facing the property, the
casino *is* on your left — I measured that. But the interiors are **not the
facade seen from behind**: they are parked in a belt 800 m away with their own
axes, and you arrive by teleport. **There is no mirror.** The arrival facing
decides, and the arrival facing is −z with left = −x.

So the conclusion "the casino has to sit on the hotel's +x side" is **backwards**,
and it is backwards for a stated, checkable reason rather than a typo. This is
the row's own diagnosis vindicated: *a constant that does not derive from the
thing it must agree with*.

## 4. What the fix actually is — and why it is bigger than a swap

**Derived, the requirement is:** entering the casino you face −z, so right = +x;
for the hotel to be on your right, **the hotel must sit at HIGHER x than the
casino in the belt** — the opposite of today.

That is **not** a swap of `west`/`east` in `PARTY`. `PARTY` only says which flank
to cut the opening in; the rooms' `cx` come from the order they are pushed into
`SLABS` (`ct/interior.ts:149`, allocated left to right as rooms register). Swapping
`PARTY` alone would leave the declaration disagreeing with the actual layout —
strictly worse than today, and it would put the opening in the wrong flanks.

**A correct fix has to do both:**

1. put the casino before the hotel in the belt's slab allocation, so
   `casino.cx < hotel.cx`;
2. **derive `PARTY`'s `west`/`east` from the published frontage order** rather
   than typing either value, which is the row's explicit DONE-WHEN — read the
   two buildings' world door x from the same place `__ct.doors()` does and let
   the sign decide;
3. **rewrite that doc comment**, because the next person will re-derive the
   mirror from it and undo the fix.

**And it moves two rooms 11 m in the belt**, which touches: the party doorway and
its floor (item 230 found it had none), the rails I broke at that doorway earlier
today under **item 267** (they derive their side from `PARTY`, so they *should*
follow — "should" is not a measurement), every hard-coded casino/hotel coordinate
in `scripts/`, and `bugsweep`'s stations.

## 5. Why I stopped

The row is explicit — *"DO NOT simply swap `west` and `east` until you have
walked it"*, and *"⚠ DO NOT BREAK THE PARTY DOORWAY"*. I walked it, I have the
diagnosis, and the remaining work is a **structural relayout of the interior belt
with a doorway the user personally asked for sitting on top of it**. I did not
have the room left to do that, re-walk the doorway both ways, re-shoot both
sides, and re-verify item 267's rails — and a half-finished relayout is the one
outcome worse than not starting.

**Released, not marked done.** Nothing in `src/` was changed for this item.

## Instruments left behind

- `scripts/probes/w105-handedness.mjs` — dumps the two buildings' world doors,
  both room rows and `PARTY`, so the next builder does not repeat §1.
- `scripts/probes/w105-handed-walk.mjs` — the left/right derivation from the rig
  convention, one function used for outside and inside, with a frame from each
  (`shots/w105-handed-outside.png`, `shots/w105-handed-inside.png`).
  **⚠ Its "inside" leg computes the facing from the room's door normal and is
  therefore the version that got it wrong** — it is kept because its OUTSIDE leg
  and its derivation are right, but trust `shots/w105-arrived-in-casino.png` and
  the walked arrival above for the inside answer, and fix that leg to press [E]
  before relying on it.
- `shots/w105-arrived-in-casino.png` — what you actually see on arrival.

## For whoever takes it

The before/after frames the row wants from both sides are cheap now:
`w105-rail-vantage.mjs` (item 267) already stands at this doorway from either
room and refuses black frames, and `w105-party-doorway-walk.mjs` already walks it
5/5 each way with coordinates read from `roomDims()`/`party()`. Both will follow
the rooms wherever they move.
