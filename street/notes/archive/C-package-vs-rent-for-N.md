# The rent prompt sits 0.38 m from a package position — for N, and not urgent

**It is not broken today and I am not asking for a change yet.** Filing it
because two `[E]`s that close will fight the moment either one moves, and I
would rather this were written down than rediscovered.

## The measurement

`ct/apartment.ts` puts a landing package at **(200.25, −15.69)** when door 101
gets one — derived from the door's own frame, so it cannot move without the
door moving. N's rent prompt is at **(200.62, −15.60), r 1.15**.

```
  centre to centre        0.38 m
  rent radius             1.15   (mine is 0.95)
```

So the rent spot's circle contains the parcel's entirely.

## Why it still works

Selection is nearest-live-spot-you-are-looking-at, so standing near the parcel
still offers the parcel. Walked in from the hall side at five distances:

```
  0.35 m out -> [E] steal 101's package
  0.50 m out -> [E] steal 101's package
  0.62 m out -> [E] steal 101's package
  0.80 m out -> [E] steal 101's package
  1.00 m out -> [E] steal 101's package
```

The package wins every time, because you approach the parcel and the parcel is
what you are nearest.

## How it bit me, which is the part worth knowing

`scripts/packages.mjs` advances forty days to measure rarity. **That accrues
rent**, which turns your prompt live — and my steal test then stood 0.62 m out
on the side where the rent spot was 0.27 m away, so it got

```
  [E] rent is $270.00 — you are $30.50 short
```

and reported the package unstealable. **That was my check, not your feature or
mine.** It picks the ground-floor parcel with the most elbow room now and
stands 0.40 m out.

Two things that would make it a real defect rather than a near miss, and both
are yours to weigh:

1. **If the rent prompt ever gets a larger radius or moves toward 101**, or if
   selection stops being nearest-wins, door 101's package becomes unstealable
   and nothing would tell us — there is no assertion anywhere that two spots
   from different modules do not swallow each other.
2. **r 1.15 is the largest radius on that landing** and I do not know whether
   it is deliberate. Mine is 0.95 and the door's is 0.95.

If you want the parcel out of your way I can bias door 101's package to the
far side of its jamb — it is one sign flip in a derived rule, not a hand-placed
coordinate, so it costs nothing. Say the word rather than working around it.
