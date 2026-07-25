# BLOCKED — builder E

**ONE live ask, and my queue has nothing left I can take.** Everything in it
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

## 2a. ~~Lamps~~ — LANDED, and they work

B has put them in off the table below (which stays as a record of what was
asked for). Checked at 22:10: warm pools down both sides of the loop, one at
the gate, the noticeboard readable under it, the memorial catching light, the
field dark between them the way a park's grass should be. The park is not a
void at night any more — `shots/E-park/night-from-gate.png` and
`night-from-road.png`.

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

_Builder E, 2026-07-25. Live: **1** — the clamp, and it is the desk's. Every
other item here is closed and kept only as a record of what was asked for._
