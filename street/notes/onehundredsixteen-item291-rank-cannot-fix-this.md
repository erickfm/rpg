# Item 291 — RELEASED, not fixed. Ranking cannot solve this, and here is the proof.

Worker onehundredsixteen, 2026-08-03. Port **4720**, built bundle.
**My changes are reverted; the tree is exactly as I found it.**

## The row's premise is wrong, and it is wrong by 0.468 m

> *"The fix belongs in the ranking, not in the furniture."*

**It does not.** Measured with `scripts/probes/w116-calendar-vs-door-spots.mjs`,
reading the world's own published spots:

```
"close the door"              x199.36  z-17.455  r0.95
"close the door"  (hall side) x200.64  z-17.455  r0.95
"sit on the bed and watch TV" x198.84  z-16.300  r0.70
"read the calendar"           x199.20  z-17.015  r0.60

calendar stand-point -> door stand-point : 0.468 m
calendar stand-point -> bed seat         : 0.801 m
door stand-point     -> bed seat         : 1.267 m
```

`pickSpot`'s **`onIt`** rule is *the spot's centre is inside the player's own
collision capsule* — `RADIUS`, **0.36 m** — and it is **unbeatable by
construction**. Two capsules is **0.72 m**. The calendar's stand-point and the
door's are **0.468 m apart**, so **their `onIt` circles overlap**: walking out of
301 you pass *through* the calendar's `onIt` circle, and while you are in it the
calendar cannot lose to anything.

**And `onIt` must stay unbeatable.** It is what holds `seats-walk`'s standing
assertion, `w40`'s END ONE(b), and — decisively — **the user's own guard rail for
this very item**: *"standing right at a piece of furniture and looking straight
at it must still offer that furniture."* Any rank strong enough to beat `onIt`
destroys the sentence it was introduced to protect.

**So there is no ranking scheme that gives the door that band.** That is not an
opinion; it follows from 0.468 < 0.72.

## Four cuts, each measured, each one narrowing it

`w40-bed-vs-door` on my tree before I touched anything: **exit 1, 3 legs moved** —
the row's numbers reproduce exactly.

| cut | what it did | result |
|---|---|---|
| 1 | `rank` on `Pickable`, ordering **tier 2 only** | 3 → **2** legs red. `the offered door actually acted` went green. Band unchanged from 0.51 m out |
| 2 | rank also orders **tier 1** (`onIt` still first) | still 2 red, but the door won at **0.40 m** where it never had |
| 3 | rank **crosses tiers** (`onIt` > rank > tier > key) | **worse — 3 red.** The ranked door started stealing the *bed's* press: `the offered bed seat actually seated you (close the door -> open the door)` |
| — | **reverted all of it** | tree back to mainline |

Cut 3 is the informative one. It is the strongest form of "make the door high
rank" that still respects `onIt`, and it **still did not win the band** — which
is what sent me to measure the geometry instead of writing a fifth cut.

## There is also a second, separate failure in that guard, and it is not a door

`w40`'s **AIM** leg fails on **bed vs calendar**, with no door involved:

```
0.77 m from the bed, facing the bed -> [E] read the calendar
0.66 m from the bed, facing the bed -> [E] read the calendar
0.54 m from the bed, facing the bed -> [E] read the calendar
0.42 m from the bed, facing the bed -> [E] sit on the bed and watch TV   ← only this one is right
```

**Ranking the door cannot touch this leg at all.** The calendar's stand-point is
**0.801 m** from the bed seat, so it also overlaps the bed's approach. Any fix
that only ranks doors leaves `w40` red on this leg, and the DONE WHEN asks for
`w40` green.

## What I believe the fix is — and why it does NOT contradict the row's ban

The row says, correctly, **do not move or shrink the calendar**: item 270
measured +0.25 m as the hard limit and the user asked for that size and position.

**But the calendar MESH and the calendar's STAND-POINT are two different
numbers.** The ban is on the mesh. The stand-point is
`ct/apartment.ts:3661` — `z: SOUTH_Z + 0.90` — and its own comment says plainly
that the 0.90 m was chosen **to win this exact contest**:

> *"Derived from the door spot rather than chosen: at 0.90 m the door's centre is
> 0.58 m away, outside `fp.ts`'s RADIUS 0.36, so it can only reach tier 3 while
> the calendar (dead ahead, inside its own radius) holds tier 1."*

(Measured today it is **0.468 m**, not 0.58 m — that comment's number is stale
too, and 0.468 m is *inside* 0.72 m, which is why the reasoning it records does
not hold.)

**So the fix is to move the calendar's stand-point off the route between the bed
and the door, and/or shrink its `r` from 0.60, leaving the calendar itself
untouched where the user put it.** That is furniture-adjacent but it is not what
he vetoed: the calendar he asked for does not move, change size, or become
harder to read from in front of it.

**Ranking is still worth having as well** — his instruction was explicit and cut
1 was a real improvement with no regression I could find — but it must land
*after* the stand-point, or it will keep being measured as "no effect" and
tempted into cut 3's over-reach.

## What I did NOT do

- Did not loosen `w40`. It is right and the world is wrong (BUILDER-BRIEF §7).
- Did not move the calendar mesh, shrink it, or touch the aim cone.
- Did not leave any of my four cuts in the tree. `src/proto/fp.ts`,
  `ct/ctx.ts`, `ct/apartment.ts` and `ct/interior.ts` are back to mainline
  (revert commit on this branch), because an unverified change to `fp.ts` — the
  most contended file in the project — in the flat the user is playing is worse
  than no change. I ran only `w40`; I did not get to `seats-walk`,
  `D-look-selects` or `interiors-walk`, and shipping a resolver change on one
  guard's word would be exactly the "first fix will probably be wrong" case.

## For whoever takes it next

1. **Start from the 0.468 m.** Any scheme you invent gets tested against
   `2 × RADIUS = 0.72 m` first, on paper, before you write it.
2. Move `ct/apartment.ts:3661`'s stand-point, not the calendar.
3. Then add rank (cut 1's shape — `rank` on `Spot`, ordering within a tier — was
   clean and typechecked; the diff is in this branch's reverted commit
   `d5caf7a65` if it is useful).
4. Fix the AIM leg too, or `w40` stays red for a reason that has nothing to do
   with doors.
5. Run more than `w40` before believing it.
