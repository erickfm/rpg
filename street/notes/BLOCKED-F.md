# BLOCKED — F — I am producing errors faster than findings

My queue is empty (0 live, 0 awaiting a check) and has been for some time; I
have been working other builders' unverified rows, which is the standing rule
when F is clear.

**I am stopping because my error rate has turned.** Fourteen instrument
mistakes this session, and the last one is a straight repeat: I retyped a
heading bug — `atan2(nx, nz)` where it must be `atan2(-nx, nz)` — that I had
diagnosed, fixed, and written up in `interiors-walk.mjs` a few hours earlier.
It walked me 200 m off the map while "verifying" the bodega.

The earlier errors were new mistakes and each produced something useful once
caught. This one produced nothing and cost a row.

## What is genuinely done and safe to rely on

- **My rows: all confirmed.** 0 live, 0 awaiting a check.
- **My rooms** — bodega, diner, thrift, burger, church — all green in
  `interiors-walk`, keeper stations now derived from published serve spots
  rather than typed.
- **Kit work**: `room.clock()`, `clockFace()` for facades, `room.person()`
  tagging, `chamfer` doors with a real doorway, `floor` levels, `scripts/lib/
  viewof.mjs`.
- **Verified for others tonight**: B's night lighting, B's alley detail, C's
  park, C's room 301 (spawn, respawn, sleep, TV, door faces), C's car lot
  (2 of 3), C's TODAY ONLY removal, A's ATM, A's pawn frontage, A's
  floaters-walk fix, D's re-entry regression cleared, G's casino/hotel/tax/pawn,
  G's slots, G's blades, E's library, the bank, the jail, the desk's reload row.

## What is open and who needs it

- **D's `bodega entry blocker`** — I did not verify it. Untouched.
- **B's two alley lighting rows** — reachable and measured (69% darker, no
  light of its own) but the row text is truncated AND the cited screenshots are
  not in the repo. Needs B, who was there.
- **The slot cabinet swallows E** — confirmed, reproducible; ESC works and is
  advertised. A consistency fault, not a `hud.ts` fault.
- **The tax office clock** is still painted, and **no exterior clock in the
  world moves** — `clockFace()` exists for both.
- **46 ledger rows cite user screenshots that are not stored anywhere.**

## The one recommendation I would leave

Every durable thing I did tonight has the same shape — **tag the object,
publish the spot, export the helper** — and every repeated failure was me
re-deriving by hand something that already existed correctly. The heading
calculation should be a function next to `viewof.mjs`, not a line people retype.
