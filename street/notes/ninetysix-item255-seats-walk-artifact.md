# Item 255 — "109 of 219" is dead, and the row named the wrong cause

> ### ✅ FINISHED 2026-08-03 by worker onehundredtwentytwo, item 263
>
> This note's closing ask — *"publish `focus` state read-only on `crosstown.ts`
> and teach `seats-walk` that a machine seat exits by Escape"* — is **done**, and
> its prediction was exactly right. `__ct.focus()` now returns `null` for a chair
> and, for a machine seat, the ease progress `t`, a `settled` flag, and where the
> screen is taking the eye. `seats-walk` reads it and judges a machine seat AS
> one.
>
> **The figure is now 189 of 219 passing, 30 failing** — all 89 machine-seat
> failures are gone, and this note's own estimate of "26 worth acting on" was
> right to within the 4 blackjack seats it had grouped with them:
>
> | count | kind |
> |---|---|
> | 17 | `[E]` seated you on a **different** seat |
> | 8 | another `[E]` spot answered instead of the seat |
> | 4 | `"sit at the blackjack table"` — seated, **no screen focus**, and no prompt offering a way up |
> | 1 | no `[E]` prompt at all |
>
> The 87 slot stools are not exempted: they now have to settle their fly-in, land
> the eye on the world's own published focus target, and give the player back the
> chair on the first Escape and the floor on the second.

Worker ninetysix. Port **4520**, built bundle. Both figures, as the row demands.

|  | pass | fail |
|---|---|---|
| **before** (`yaw 0`, eye read 800 ms after sitting) | **110/219** | **109** |
| **after** (approach aimed, eye read as you sit) | **104/219** | **115** |

**The corrected harness reports MORE failures, not fewer. That is the finding,
not a regression** — and it is why this note leads with the composition rather
than the total.

---

## THE ROW'S STATED CAUSE IS WRONG. The approach yaw was never the problem.

The row: *"`seats-walk.mjs` approaches every seat at yaw 0 … a seat the player
can plainly reach is recorded as unreachable purely because the probe walked up
facing a fixed direction."*

Measured before changing anything —
`scripts/probes/w96-seat-aim-convention.mjs`, four headings over 28 seats:

```
yaw 0 (today)            raised the seat's own prompt 27/28  (96%)
atan2(dx,dz) -> pose     raised the seat's own prompt 27/28  (96%)
atan2(dx,-dz) -> pose    raised the seat's own prompt 26/28  (93%)
atan2(dx,dz) -> at       raised the seat's own prompt 26/28  (93%)
```

**Aiming is no better than the constant it was blamed on.** Only **1** of the
109 failures was ever *"no prompt … got null"* — the pure "nothing there" case
the row describes.

Two corrections to `notes/ninetynine-item126...`, which proposed the fix (that
note is now annotated in place):

- its heading `atan2(dx, -(dz))` is **the wrong convention** — this world is
  `atan2(dx, dz)`, 0 facing +z;
- aiming at `at` rather than `pose` is **noise**: `standableNear` picks its point
  *inside* `at`'s own radius, so that bearing averages **0.18 m** long against
  **0.70 m** to `pose`.

## WHAT THE 109 ACTUALLY WERE

Classified by message:

```
 85  seated eye is N, expected N        <- 78% of the total
 11  sat at N,N but the seat is at N,N
  8  no prompt; got some OTHER [E] label
  4  seated prompt should be "stand up", got null
  1  no prompt; got null
```

**83 of those 85 are off by an identical 0.350 m, and every one is
`"sit at the slot"`.** An identical constant across 83 different seats is never
83 broken seats.

### Root cause, one line

**The harness read `camY()` after its four 200 ms movement holds — 800 ms after
sitting — and by then the world had eased the camera onto the slot machine's
screen.**

Traced frame by frame (`scripts/probes/w96-seat-eye-settles.mjs`):

```
"sit at the slot"   want camY 1.395
  first sample 1.369 (err 0.026)   <- CORRECT
  4ms:1.37 71ms:1.30 137ms:1.22 203ms:1.14 270ms:1.08 337ms:1.05 … 1.05
  after 1.2 s 1.050 (err 0.345)
```

It is correct on the first frame and then **sinks 0.345 m over ~340 ms**. That
descent is the FOCUS pass (`crosstown.ts:1234-1247`) taking the eye along the
target face's own normal — the *"integrated overlay"* the user asked for. A plain
chair does not move at all: `"sit down"` and `"sit at the coupon table"` hold
their exact height for the full 1.2 s.

## WHAT I CHANGED

1. **The eye is read as you sit.** The sampler starts **before** `press()` and
   runs across it — `press()` holds E for 90 ms then waits 200 ms, so a trace
   opened after it returns has already missed almost all of a 340 ms ease. My
   own first attempt did exactly that and still failed 81 slots. Each sample
   carries `seated`, so frames from before you sat can never be mistaken for a
   good one. **Not loosened**: tolerance is still 0.04, and a seat that never
   once puts the eye where its pan says still fails on every frame.
2. **The approach is aimed at the seat** — the row asked for it, and a player
   does approach aimed. It is *not* what was inflating the count.
3. **A population floor**: every registered seat must produce a verdict, and the
   world must hold at least 150 seats, or the run exits 3 rather than reporting
   a ratio over almost nobody.
4. **A failure breakdown by kind is printed under the total**, because telling
   people not to misquote a number works far less well than printing its shape
   next to it.

## AND HERE IS THE PART THE ROW COULD NOT HAVE KNOWN

Fixing the eye read removed **all 85** eye failures. They came straight back as
**89 × `seated prompt should be "stand up", got null`** — the *same slot stools*,
failing one leg later.

**Because they are not chairs.** A slot stool seats you and then hands the
machine its overlay; its exit is Escape, not an `[E] stand up`. `seats-walk.mjs`
models a plain chair in all five of its legs, so **every machine station in
`__ct.seats()` will fail at whichever leg it reaches first**, and moving the
count from one leg to another is all any fix inside this file can do.

**The real repair is for the harness to know a seat entered a machine focus.**
That state is not published — `focus` is a closure local in `crosstown.ts:1165`
with no `__ct` accessor — and **`crosstown.ts` is held by item 251
(`DOING ninetyfive`)**, so I did not reach for it (BUILDER-BRIEF §9). One
read-only accessor, in the established `citAvoid()`/`painted()` style, closes
this properly.

## The honest figure, stated plainly

**Of 219 registered seats, 104 pass all five legs. Of the 115 that do not:**

| count | kind |
|---|---|
| **89** | no `stand up` when seated — **a MACHINE seat in its own overlay**, one modelling gap, not 89 defects |
| 17 | `[E]` seated you on a **different** seat |
| 8 | another `[E]` spot answered instead of the seat |
| 1 | no `[E]` prompt at all |

**So the number worth acting on is 26, not 109 and not 115** — and even those 26
want checking one at a time, because 10 of them appeared only once the approach
became aimed and may be the aim lining the camera up with a back-to-back
neighbour rather than real defects.

## Not done, for the desk

- **Publish `focus` state read-only on `__ct`** (`crosstown.ts`) and teach
  `seats-walk` that a machine seat exits by Escape. That is the only thing that
  actually fixes the 89. **Queue it against `crosstown.ts` after item 251 lands.**
- **The 17 wrong-seat and 8 wrong-prompt failures are unexamined.** 10 of the 26
  appeared only with the aimed approach. Worth one session with the aim on and
  off, per seat, before anyone calls them defects — I did not do that.
- The 2 `"sit at the computer"` seats had a 0.140 m eye error rather than 0.350;
  they now pass the eye leg, and one still fails on the seated prompt.
