# Car lot quality pass — 2026-07-25

The queue sanctioned this shape of work for the walk-up ("walk it end to end and
write what is wrong"). The lot had never had one, and it is where nearly every
user complaint of the last two days has landed — the pole sign, the bunting, the
salesman, the chairs, the cars, the clipping. A pass is cheaper than being told.

Ten viewpoints in the order a player meets it: far kerb, gate, aisle, office,
back wall, both rows, turning back to the street, and twice at 23:00.
`shots/lotpass/01..10`. No console errors.

## The one real finding

**39 sheets in the lot never dim.** Sized, with the reason the obvious
workaround does not apply, in `notes/BLOCKED-C.md` under "the signage blocker,
with numbers". `shots/lotpass/10-night-aisle.png` is what it looks like: three
signboards and the price cards at full daylight over a black yard. Not fixable
from my side; it needs the `isSelfLit` opt-out that section has been asking for.

## Two things that looked like defects and were not

Both worth writing down, because both cost me a measurement and either could
have become a "fix" that broke something correct.

**The office signs do not overlap.** From the aisle, the CROSSTOWN AUTO SALES
board appears to cut across the bottom of the WE FINANCE ANYONE banner. Measured:
the board is on the office at x 26.07 and the banner is on the BACK WALL at
x 30.10, four metres behind it. They only line up from the approach angle. The
two "overlapping" pairs the probe did find are the front/back planes of
double-sided sheets sitting 2 cm apart, which is GOTCHAS 10 working correctly.

**The gate arrow points the right way on both faces.** From inside the lot the
rear face's arrow reads as pointing away from the mouth. It is not: computed the
apex direction from each face's own world matrix and the dark wedge's position
in its texture, and both faces give **apex → −z**, with the mouth at lower z than
the mast. The perspective in `08-turn-back.png` is misleading. I nearly "fixed" a
fix that was already correct.

## Verified good

The approach from the far kerb (`01-far-kerb.png`) is the view that matters and
it holds together: pole sign legible at distance, arrow at the gate, bunting
chained across the frontage with span-scaled sag and tied off on real posts,
banners on the chain-link, rows flanking the aisle, office across the back, the
gate open in the middle. Five registered lot checks green. All three seats
offer, seat and stand.

## Checked for floating objects — nothing found, and the probe cannot prove it

The user's most-repeated complaint class is things floating: *"this guy is
floating"*, *"why are these decorations simply floating in the air in the
diner"*, the thrift price card, the GOLDEN ACES sign. Worth pointing at my own
module before being told.

Measured every one of the lot's 419 meshes: world-space lowest corner against
the deck at y 0.14. 98 came back with a gap.

**All of the ones I inspected are correct**, and the probe cannot tell them
apart from a real fault: a windshield price card sits at y 1.03 because it is
on a windshield, a car roof at 0.98 because it is on a car, the office AC unit
at 1.28 because it is in a wall, a balloon at 1.13 because it is tied to an
aerial. "Bottom is above the ground" is simply not the same question as
"nothing is holding it up", and separating the two needs to know what each
object is attached to, which the scene graph does not record.

So this is a **negative result with a stated limit**, not a clean bill: the ten
viewpoints above show no floating object in the lot, and the geometric sweep
adds no evidence either way. The one case where the question WAS decidable —
the salesman — was decidable because `citizenSprite` declares where its feet
are, so a call site could be compared against the ground beneath it. Nothing
else in the lot declares that, and inventing a classifier to guess at it would
be a harness built for its own sake.
