# w63 — item 173: lead (1) is FALSE, checked before I released the item

I claimed item 173 (*"people still get stuck. they should back up and allow the
car to pass"*), established this much, and then **released it back to TODO
untouched** because it is a deep behavioural change to the crowd sim with a
deterministic-reproduction probe attached, and I did not have the budget left to
verify it to the standard the 2 m lane deserves. It is `TODO` again and nothing
in the world was touched. This note exists so the next holder does not spend
their first half hour where I spent mine.

## Lead (1) — "a moving vehicle is not in `citAvoid`" — is WRONG

The row reasons from `ct/crowd.ts:21–26`, which describes `citAvoid` as *"solid
props people steer AROUND — trees, lamps, **parked** cars"*, and infers that a
moving taxi may be invisible to the avoidance. **The word `parked` in that
comment is stale.** Both kinds of vehicle box go in:

```ts
crosstown.ts:583   carColliders.push(cb); citAvoid.push(cb);          // the parked fleet
crosstown.ts:615   vehicleBox: (b) => { vehicleBoxes.push(b);
                                        citAvoid.push(b);
                                        actorBoxes.add(b); return b; }  // ct/traffic.ts — MOVING
```

`vehicleBox` is the hook `ct/traffic.ts` registers every moving car, bus and
taxi through, and it pushes straight into `citAvoid`. So the crowd **does** know
about the taxi in his screenshot, and *"the avoidance never knew about it"* is
not the explanation. **Do not start there.**

## Lead (2) is the right thread, and here is what is already built

`ct/crowd.ts`'s *"being somewhere illegal, and leaving"* block is a real
recovery, not a stub, and it is better than the row implies:

- `escapeFrom(box, x, z, line)` scores **all four** axis exits rather than taking
  the minimum translation, with cost `push distance + 1.4 × distance from the
  walk line` — deliberately, so a walker pushed out of a kerbside car is not
  shoved into the road. The 1.4 has a stated reason: *"below about 1 the
  shortest push still wins next to a kerbside car, which is the case this
  exists for."*
- `unstick(c, dt)` sums the escape from **every** box the walker is inside,
  moves at `UNSTICK = 1.4` m/s (*"walk out, do not teleport"*), and falls back to
  the last legally-occupied node after `PATIENCE = 1.2` s.

**So the question is not "why is there no recovery" — it is why this one does not
finish in time.** The shape I would investigate first, and did not get to
proving:

1. **It only fires once you are already INSIDE a box.** It is a rescue, not a
   yield. The user asked for *"back up and allow the car to pass"*, which is
   behaviour BEFORE the overlap — a walker that sees a vehicle box closing on it
   and steps back off the line.
2. **1.4 m/s against a car that is faster.** If the taxi advances faster than the
   push, the walker never clears the box and is carried along inside it.
3. **Opposed escapes cancel.** `unstick` SUMS the push from every box. Pinned
   between the car and the kerb collider, the two contributions point opposite
   ways and can sum to nearly zero — which looks exactly like the screenshot: a
   citizen standing still beside the car. **That is the first thing I would
   measure**, and it is cheap: log `px, pz` for a pinned walker.

## What the probe needs to do

The row is right that it must reproduce a pin deterministically. `__ct.drive()`
already forces a vehicle through on demand (`crosstown.ts`'s test affordance —
*"force a movement through the junction NOW, rather than waiting out a 18–42 s
gap"*), and `__ct.walkers()` reports every citizen's position, `jam` timer and
activity. Between them a probe can put a car on a walker rather than wait for
one, which is what turns *"sometimes"* into a test.
