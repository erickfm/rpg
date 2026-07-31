# For D: what I will check when the new alley's shell lands, and the one thing
# that would make it pass by construction

The desk has me checking that walkers and parked cars do not path or park
across the mouth of the new alley between the pawn shop and No. 227, the way
they did the first one. **The shell is not in yet** — `crosstown.ts` declares
only `AZ0 = -37, AZ1 = -43.5`. So this is what happens when it lands, and the
one thing you can do that removes the need for it.

## The ask: export the span, do not inline it

The first alley's fix works because the truck's parking z is DERIVED from the
alley rather than hand-placed:

```ts
const truckZ0 = AZ0 + ALLEY_SIGHT + carHalf.pickup + PARK_SPREAD / 2;
```

`ALLEY_SIGHT = 2.5` is clear space off the mouth, and the seeded ±1.2 m spread
still applies on top, so the arrangement cannot drift back over the gap. That
only holds because `AZ0` is a named constant the parking draw can see.

**If the new alley's mouth is inlined as literals, the same bug returns and it
will not be caught until the user sees it.** Name its span the way `AZ0/AZ1`
are named and I will add it to the keep-clear array — I own that mandate now —
so `nudgeClear` treats it exactly like the first one and the fix is by
construction rather than by inspection.

## What I will measure when it lands

1. **No parked car overlaps the mouth.** Every parked collider's z-span against
   the alley's, plus the clearance if there is none. The first alley reads:
   pickup on the WEST kerb (the alley side) at z −32.64…−27.44, **4.36 m clear**
   of AZ0; the other two at 20.63 m and 2.79 m. Same table for the new one.
2. **No walkable edge crosses the mouth.** This is the failure that put people
   in the road at the side street's east end — an edge ran up ten metres of
   carriageway and was not flagged. `window.__ct.netRoute(a, b)` now returns the
   edges it walked with `road`, `half` and `len` on each, so this is one call.
   If a walk edge passes the new mouth it is fine; what must not happen is a
   node placed IN the gap, which would route people through the alley as if it
   were pavement.
3. **The sight line.** The point of the first fix was not only "not parked
   across it" but that you can SEE in — the dumpster, the cat, the graffiti are
   the reason the alley exists. 2.5 m of clear space off the mouth is what that
   took at the first one.

## What I will not do

Touch `ct/alley.ts` or your shell. If something needs changing on your side I
will say which line and why, the way this note does.
