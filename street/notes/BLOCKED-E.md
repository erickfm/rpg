# BLOCKED — builder E

**Two live asks, and my queue has nothing left I can take.** Everything in it
is done; what remains is one line in the entry point and one file that is B's.
Kept in the order they cost the user something.

---

## 0. ~~Three finished requests were not in the world~~ — ALL LANDED

`courtGround`, `civicSeats` and the church footprint are all in. The library
steps climb, the courtyard benches sit, and the churchyard is open — verified
by `scripts/E-walk.mjs`, `scripts/E-yard-walk.mjs` and F's `seats-walk.mjs`
against mainline with nothing patched. Nothing owed. The three patch files in
`notes/` can be deleted.

## 1. THE DEPTH LANDED WITHOUT THE CLAMP — 25 m of park is unreachable

**Updated.** D's `depth` is **32.0** now. `bounds.minX` in `crosstown.ts` is
still `-FACE - 6.4` = **−13.4**. Walked and confirmed: you enter the park,
walk west, and stop dead at x = −13.40 with 25 m of it in front of you.

This is exactly the case this file warned about before the depth landed —
*"deepening the site alone builds a park you can see and not enter"* — and it
is now live. **One line, and it is the entry point's.** For the full 32 m:

```ts
bounds: { minX: -FACE - 33, … }     // -40, clearing the rear wall at -39
```

I have laid the park out at its TRUE size rather than at the clamp, because
built to the clamp it was a 6 m strip of path in front of 25 m of bare grass
inside 13 m walls, which is what the gate looked into. Every metre becomes
walkable the moment the bound moves and nothing in `ct/park.ts` needs
changing. Until then `scripts/E-park-walk.mjs` reports the loop's back leg as
a NOTE rather than pretending it passes.

## 2a. LAMPS — for builder B, exact coordinates, nothing to guess

The park has **zero light sources**. At night it is black, and everything in
it — the trees, the memorial, the benches, the loop — is invisible. This is
the biggest thing left in it and lamps are `ct/props.ts`, so they are B's.

**The park has been re-cut twice, so these are measured off the CURRENT
geometry** (`ct/park.ts`, site x −39…−7, z −98…−68; loop legs street x −8.60,
back x −35.80, ends z −96.30 and z −69.70; path 1.5 m wide).

All of them stand on the FIELD side of the path so the pool falls across it,
0.45 m off the path edge. Nothing of mine is at these points — the benches are
on the street side at x −7.43, the framing trees at x −10.95.

| where | x | z |
|---|---|---|
| street leg | **−9.80** | −93.0, −86.0, −79.0, −72.0 |
| back leg | **−34.60** | −93.0, −86.0, −79.0, −72.0 |
| south end leg | −33.0, −26.0, −19.0, −12.0 | **−95.10** |
| north end leg | −33.0, −26.0, −19.0, −12.0 | **−68.50** |
| at the gate, inside the piers | −7.90 | −83.0 |
| over the memorial | −12.00 | −73.20 |

Warm, on the same night curve as the street's, pooling the same way, and
registered with `lit()` so the park's own furniture takes the light. Post
height can be shorter than the street's bishop-crooks — a park lamp is a
column, not a crook — but that is B's call.

If B would rather I placed plain posts in `ct/park.ts` for him to adopt into
the night registry, say so and they will be there in one commit.

## 2. ~~Trees~~ — DONE, in ct/park.ts

Resolved by building them rather than waiting. The auditor's *"bare lawn,
three blank brick walls"* is a wall problem, and only a canopy standing in
front of a wall breaks it. There is a run along all three boundaries every
~6 m plus a line framing the field, built as crossed alpha panels that do not
turn — B still owns the STREET trees, the billboard cutouts; a park tree is
walked under and seen from every side, so it could not be one of those.

## 4. My `## Next` items now belong to builder G

The queue still lists **GOLDEN ACES roof sign floats** and **HOTEL ORPHEUS /
GOLDEN ACES facades want more detail**. Both are now `ct/vice.ts`, which
`notes/OWNERSHIP.md` gives to **G** ("casino + hotel exteriors, split out of
street.ts"). I have not touched them.

The sign diagnosis, if it is useful to whoever takes it: the board is 9.2 m
wide in z on a building only 3.4 m deep, so its legs at z = −91.8 and −98.2
land outside the roof they are supposed to stand on. It cannot be fixed by
moving the legs — the board has to narrow to the roof, or gain a deck.

With those reassigned and the depth blocked, **my queue has nothing I can
take**. Shots for everything above are in `shots/E-park/`, `shots/E-court/`
and `shots/E-church/`.

_Builder E, 2026-07-25. Live: **1** (the clamp, desk) and **2a** (lamps, B).
Everything else here is closed and kept only as a record._
