# The left row is not backwards — and the reason it kept coming back

Builder I, 2026-07-25. First item on my queue, and the oldest unresolved thing
on the user's list: *"cars on the left row face backwards"*, reported twice,
routed three times.

**The fault is not in the world.** It was fixed in `0adf572b0` and has been
correct ever since. What was still broken is everything around it: the ledger
row stayed OPEN, one instrument could not count the cars it was checking, and
the one genuine open question inside the row had been left to "C's call" and
never called.

## What I measured, from scratch

`scripts/I-rows.mjs`, new. It reads each car's heading as the group's own
local −z axis out of its world matrix — **never recomputed from a yaw**, because
a yaw put back through a formula is how this got reported wrong the first time.

```
  11 cars
  aisle centreline z = 2.60

  LEFT  (south, low z)   5 cars      every one   NOSE-out, raked to the STREET
  RIGHT (north, high z)  6 cars      every one   NOSE-out, raked to the STREET
```

Both rows nose-out toward the aisle, both raked the same way, every car in a row
presenting the same face. That is the queue's own test and it passes.

**Which row is "the left row" is not a matter of taste, so it is derived rather
than assumed.** `fp.ts` has `fwd = (sin yaw, −cos yaw)` and
`right = (cos yaw, sin yaw)`. You enter driving +x; facing +x, right is +z. So
the LEFT row is the SOUTH row at low z — and that is the row the check names
LEFT and the row I photographed.

## Seen, not only computed

`shots/I-d-gate-left.png` — standing in the gate mouth, looking down the left
row end-on. Every car presents its front: grille, headlights, bumper, and the
price card in the windshield facing the aisle. The near one has its hood up.

`shots/I-d-mid-left.png` — mid-aisle, broadside to the left row. Fronts to the
camera, `$3495` legible on the glass.

`shots/I-d-gate-aisle.png` — both rows at once from the gate: a chevron of car
fronts converging on the office.

## The instrument defect that kept this ambiguous

`lot-layout.mjs` reports **"18 cars, 18 nose-out"** on a lot that has **11**.

It counts every group under the lot with ≥ 8 meshes, and a car is a group inside
a group — `g0` carries the dressing, `makeCar` returns its own group inside it —
so any car with enough body meshes is counted twice. Seven are. `lot-clearance.mjs`
gets this right by skipping any group nested inside another; that is the rule
`I-rows.mjs` uses.

The nose-out verdict happened to survive the double count, because a child group
shares its parent's heading. **The count did not.** A check that cannot count the
thing it is checking is a check nobody should lean on, and this is the check that
has been standing behind "the rows are fine" for three routings.

I have **not** edited it — `OWNERSHIP.md` says do not edit another agent's
script. Filing it instead: clause 5 of `lot-layout.mjs` should defer to
`I-rows.mjs`, or adopt the nested-group skip. **Desk: this needs routing to
whoever owns that file.**

## The check can fail — proved, not asserted

It went green the first time I ran it, on a fault the user has reported twice,
so green needed its own evidence. `--selftest` turns the south row 180° in the
live scene, reproducing exactly the reported bug:

```
  SELFTEST: turned 5 south-row cars 180 degrees — this must go red
  · LEFT: car at x 11.6 z -3.4 is TAIL-out           (and the other four)
  · the two rows rake OPPOSITE ways — that is a fishbone, not a herringbone
  exit 1
```

The rake clause is new and nothing else in the project asserts it. Nose-out
alone does not make a herringbone: two rows can both be nose-out and still rake
against each other, which reads as two different lots meeting in the middle.

## Answering the question the row was actually left open on

H measured the same geometry and stopped exactly here, correctly:

> *"Both rows face the aisle AND angle WEST, toward the street. If the intent is
> to angle east, into the lot, both rows are mirrored. Geometry cannot tell me
> which was meant — C's call."*

It is now my call, and **west is right. Keep it.** Not a preference — it falls
out of the user's own brief, *"make it make sense like how does one even enter,
drive a car off the lot"*:

- A car nosed west pulls **straight out of its bay and drives at the gate**.
  Nosed east it has to reverse into the aisle and three-point turn to leave —
  on a lot whose whole layout was justified by the drive aisle.
- Walking in, you meet the **fronts**, and the windshield price faces you the
  length of the aisle. Angled east you would walk 23 m past tailgates and read
  the stock only by turning round at the office.
- It is what a display lot does. Customers do not park these cars; staff place
  them to be read from the aisle and driven off the front.

Mirroring both rows east would cost all three and buy nothing.

## What I did not touch

`ct/lot.ts` is unchanged by this item. The world was already right; this commit
is the proof that it is and the guard that keeps it so.

## One thing I noticed for the quality pass, not fixed here

All three "not parked" variants are on the **left row**: hood up at bay 1,
jacked at bay 9, up on blocks at the south back corner — plus the deliberate
empty bay. So the left row is every damaged car on the lot and the right row is
clean stock. Nobody asked for that and it is not what "backwards" means, so it
is not this item. Recording it for the standing quality brief.
