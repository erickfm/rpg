# `seated` has landed — the call, for F and G

**One line changes at your end.** Add `seated: true` to the `Look`, and place
the mesh at **the seat you already registered** instead of at the floor.

```ts
import { citizenSprite } from './citizens';

const diner = citizenSprite(
  { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e',
    fit: 'plain', cut: 'short', build: 0,
    seated: true },                     // <- the only new field
  { facing: Math.PI, h: 1.0, w: 1.0 },
);
diner.position.set(seat.x, seat.y, seat.z);   // the SEAT, not the floor
room.add(diner);
```

## The one thing to get right: the origin moves with the pose

| pose | origin is | place it at |
|---|---|---|
| standing | the painted shoe | the floor |
| **seated** | **the hip** | **the seat top** |

That is the desk's ruling and the reason is worth knowing, because it is the
same bug twice: *"five modules and ten rooms each applying their own offset is
exactly how the 12 cm float happened"*. `citizenPlane` owns the offset so you
never compute one. **If you find yourself adding a fudge to the y, stop and
tell me — that means the atlas is wrong, not your room.**

The shoe still lands on frame row 59 either way, so a sitter's feet reach the
floor when the seat is at a sane height, and the standing figure's footprint is
completely unchanged.

## What it looks like, and how it was checked

`shots/seated.png` — standing above seated, all five painted views.

The first attempt folded only the legs and I reverted it: the profile read as
sitting and **the other four views were a standing figure with different
shins**, because the head stayed at standing height. The desk's instruction
after that was *"verify all eight angles, not one — the profile passing is what
made the leg-only fold look plausible"*, so here is the structural check rather
than my eye:

```
col   standTop  seatTop  drop   standFoot  seatFoot
 0        5       14      9        59         59
 1        5       14      9        59         59
 2        5       14      9        59         59
 3        5       14      9        59         59
 4        5       14      9        59         59

all 8 sectors  s0(col0) s1(col1) s2(col2) s3(col3) s4(col4)
               s5(col3 mirrored) s6(col2 mirrored) s7(col1 mirrored)
               every one drop=9
```

**Every angle drops by 9 rows and no angle's feet move.** The 9 is not a taste
number: a straight leg is 21 rows and a folded one about 13, so the upper body
comes down by exactly what the legs give up — the figure sits INTO the frame
instead of off the bottom of it.

## Scope, so nobody waits on more

**Seated only.** Leaning on a counter is a different silhouette and the desk's
call is to ship this and decide leaning from what the rooms actually ask for —
so if your keeper leans rather than sits, say so and it becomes evidence for
the next pose rather than a hand-drawn plane.

Standing adoption is unaffected and does not need me: `citizenSprite` without
the flag is exactly what it was.
