# BLOCKED — builder H (verifier)

**10 CONFIRMED this stint.** D's unverified rows 12 -> 3, I's 6 -> 4. What is
left is blocked on other people, and in two specific shapes.

## 1. Rows whose SUBJECT I cannot locate

- **big sign should be simpler** — my finder returned a 26 x 17 m building
  facade at (45.2, 15.5, -95.4) and stood me 78 m back from it.
- **pole sign panel too small / skewed** — my frames contained brick, a
  lollipop sign and the WE FINANCE neon, but not the pole sign.

**What unblocks them:** the sign's identity. A mesh name, or the module
publishing its position the way `ct/bodega-corner.ts` publishes its bay. Then
the station is trivial — stand back along the panel's own normal until it
frames — and both claims are easy to read: one message and the name, no phone
number (it moved to the fence, so a number ON the fence is correct).

## 2. Rows whose PREDICATE is not stated

- **the street's 27 untextured ground surfaces** — my filter counted 74 because
  it accepts any box under 0.4 m, which sweeps in bench slats and kerb pieces.
  Needs D's own predicate; then it is a recount.
- **cars on the left row face backwards** — needs one sentence: which row is
  "left" and which way it should face. Not derivable from a transform, and
  guessing is how it came back twice.
- **cars clipping into each other** — needs oriented-rectangle overlap, not the
  radius I used. The fleet publishes `wheelbase`, yaw and the 1.8 m width, so
  it is buildable the moment the facing convention lands.
- **shouldnt be able to select things through objects** — needs a REACHABLE
  station with one solid thing in the line: inside a shop aiming at a street
  spot, or the off-side of a parked car. My attempts tested from inside a wall,
  where a player cannot stand and a ray starting in solid may not register.
- **door re-trigger** — needs an exit affordance or a documented way out. E
  where you land does nothing, so the regression cannot be observed from
  outside.
- **outline traces the object** — needs 3-4 m back from a small object with
  debug on. At 0.9 m a tight box and a large volume look identical.

## The finding worth more than any single row

**Five generic filters today, five wrong sets, zero real faults found:** bench
slats as ground; two bunting runs merged into a 109 m gap; a radius test on
4.5 x 1.8 m rectangles; prompts reporting the nearest spot rather than the
tested one; a building facade as "the big sign".

Against that, **ten confirmations, every one from standing somewhere and
looking** — and the two fastest were rows whose builder named the station:
I's *"verify by standing where a person would sit"* and D's `highlightParity`
affordance, one attempt each.

So the cheapest change to the backlog is not more verifier time. It is **one
line per row when it is marked LANDED: where to stand, or what predicate
settles it.** A row that carries its station is verified in one pass. A row
that does not costs three and may still be abandoned — which is most of what is
above.
