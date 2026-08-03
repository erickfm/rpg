# w64 — item 207 released, not abandoned: it must land AFTER 198

Item 207 (*"people still get stuck. they should back up and allow the car to
pass."*) asks, in its own text:

> **⚠ ITEM 198 IS ABOUT TO ADD UP TO 359 BOXES TO `citAvoid`** and is explicitly
> flagged as "a steering change, not just plumbing" that "may surface 173 rather
> than resolve it." **Check whether 198 is claimed; these two must not land
> blind to each other.**

**I checked. 198 is `DOING seventyone`, claimed 21:57 and in flight**
(`QUEUE.md:62`). So I released 207 rather than start it.

## Why that is the right call rather than caution

The two changes are not merely adjacent, they are the **same steering
computation from both ends**:

- **198 changes the INPUT.** It moves 359 of 508 static boxes — 71% of the
  world's static geometry — into `citAvoid`, which is the obstacle set
  `ct/crowd.ts`'s seven steering candidates are tested against.
- **207 changes the SEARCH.** `ct/crowd.ts:614` is `const nt = t + step`; every
  candidate is forward and only the lateral offset varies, so nothing in the
  file can move a citizen backwards at any tuning. Adding a backwards candidate
  changes what the search does with that obstacle set.

Tuning a new backwards-recovery against today's obstacle set and then tripling
that set underneath it means the recovery was tuned against a world that no
longer exists — and 198's own row already warns it "may surface 173 rather than
resolve it". Landing them blind to each other risks a citizen shoved backwards
into the traffic lane or off the kerb, which is the failure 207 names as
forbidden, and it would be discovered by the user rather than by either builder.

## What the next holder should know before starting

Nothing here is a re-investigation — it is what the row and
`notes/w69-car-pins-citizen.md` already establish, collected:

1. **The mechanism is one line and matches his words exactly.**
   `ct/crowd.ts:614`, `const nt = t + step`. All seven candidates are forward.
2. **The desk's old leads are withdrawn.** Moving vehicles ARE in `citAvoid`
   (`crosstown.ts:615`; `traffic.ts:236/308` rewrite the extents every frame).
   The word "parked" at `crowd.ts:21` is a **stale comment** that misled the
   desk — fix it in passing.
3. **`escapeFrom` returns `null` when you are outside a box**, so a citizen
   walled in BESIDE a car is recorded as legal and `stuckT` resets. That is why
   the freeze persists instead of self-correcting.
4. **The pin does not reproduce in ordinary traffic** — sixtynine measured 100 s,
   470 samples, a vehicle present 41% of the time, max jam 0.03 s. The repro
   must make the taxi **dwell**; watching normal traffic and seeing nothing is
   not evidence of a fix.
5. **You cannot plant a box.** `__ct.citAvoid()` returns a MAPPED COPY —
   GOTCHAS 74's shape.

**Take this after 198 lands, and re-measure the obstacle set first**: the
candidate geometry 207 has to steer around is about to triple.
