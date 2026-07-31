# The player spawns in 301 and cannot use anything in it

Found while trying to verify C's *"i want to be able to close this door"* row.
**It is not C's door.** It is the `[E]` sight gate, and it disables every
interaction in the apartment — the door and the bed alike.

## What a player gets

Walk one step from the spawn point, stand **0.23 m** from *"sleep until
morning"* — a live spot with a reach of 1.35 m — turn through twelve facings,
and nothing is ever offered. `shots/A-eye-height-spawnroom.png`.

## Why

`crosstown.ts` builds the visibility ray from a constant:

```js
const eye = new THREE.Vector3(px, 1.6, pz);
aim.set(s.x, groundPick(s.x, s.z) + 1.1, s.z);
```

But **`rig.pos.y` is height above the current floor, not world y.** It reads
1.62 on the street and 1.62 in a third-floor room; the floor itself is
`apt.gy()`. So the player's true eye is `gy + rig.pos.y`:

| where | floor | true eye | ray built from | error |
|---|---|---|---|---|
| street (bank ATM) | 0.14 | 1.76 | 1.60 | 0.16 m |
| every ground-floor interior | 0 | 1.62 | 1.60 | 0.02 m |
| **apartment 301** | **5.40** | **7.02** | **1.60** | **5.42 m** |

In 301 the ray starts 5.4 m *below the floor the player is standing on* and aims
at `groundPick + 1.1` = 6.5, so it travels up through the floor slab, is stopped
by it, and `canSee` returns false for everything in the room.

301 is the only place in the world with a non-zero floor. It is also the room the
player starts in.

## It is not the arrival latch, and proving that took four tries

`canSee` refuses everything while `landing` is set — *"just arrived here; take a
step first"* — which clears past 1.2 m. Three probes of mine stalled at **1.15,
0.66 and 1.16 m**, each a few centimetres short, and each looked like a result.
The room is small and **walking is relative to facing**, so pressing `w` without
choosing a yaw just walks into whichever wall the spawn happens to face.

Turning first and trying all eight directions clears it at **1.48 m**. Then walk
back and the spot is still dead. So the latch is ruled out by measurement rather
than by argument.

## What this unblocks

- **C's "close this door" row cannot be verified until this is fixed**, and the
  failures E and the auditor both hit are explained by it: E's four presses did
  nothing because the trigger was never armed, and E's instinct was right.
- E's stated reason for not verifying — *"this world draws that prompt ON THE
  CANVAS"* — is separately wrong: it is `<div id="ct-prompt">`, `ct/hud.ts:218`.

## Routing

> **DESK** — `crosstown.ts` is DESK-owned per `OWNERSHIP.md:95`. The eye should
> come from the player's floor rather than a constant. I have not touched it.

`scripts/A-eye-height-holds.mjs`, registered in `checks.mjs` and **red on
purpose**: a check that goes green the day it is written says nothing about the
day it was needed. It asserts the SYMPTOM — is the thing you are standing next to
offered — rather than the eye arithmetic, because a check keyed to the arithmetic
would stay red after the repair, and a check that cannot go green when the defect
is fixed is worse than no check.
