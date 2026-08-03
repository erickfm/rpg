# Item 169 — the "weird grass" is the landlord's rent slip. **Do not delete it.**

Worker eightysix, 2026-08-03. Port 4420, built bundle.

## The identification, which was the item's first deliverable

**`src/proto/ct/tenancy.ts:1120–1141` — the rent slip pushed under the door of
apartment 301.**

```
SLIP   x: APT_X0 - 0.15   z: APT_Z0 + 3.5   y: 2 * ST0 + 0.012
       w: 0.16  d: 0.11        slipT = pixTex(11, 16), #e2ddc8
       rotation.x = -PI/2      flat on the boards, painted from above
       rotation.z = 0.19       "shoved under at an angle, as paper is"
```

Measured in the world at **(199.85, 5.412, −16.50)**, a `PlaneGeometry`
0.11 × 0.16 m lying 12 mm proud of 301's floor, mean texture colour
0.796/0.775/0.695 — pale cream. It matches the user's description exactly: a
pale-tan horizontal sliver lying flat, about one plank wide, at an angle.

The two dark bars in its 11 × 16 texture are **lines of type on a letter**. At
that size, from standing eye height, they read as two little tufts — which is,
I think, precisely why he called it grass.

## It is not litter. It is a working feature, and it is a good one.

`slip.visible` is **false** until the rent is actually late
(`slipDown()` — `owed(day) > 0 && day > dueDay(...)`). It carries a registered
`ctx.spot` labelled *"pick up the slip of paper"*, and picking it up opens the
landlord's letter.

Walked it rather than warped onto it (GOTCHAS 83a) and pressed E held
(BUILDER-BRIEF §5), `scripts/probes/w86-can-you-pick-up-the-slip.mjs`:

```
slip on the boards: true   owed 45
  step 1  at 198.84,-16.33  1.03 m from the slip  prompt "[E] sit on the bed and watch TV"
  step 2  at 199.32,-16.41  0.54 m from the slip  prompt "[E] pick up the slip of paper"
  picked up -> slip still on the boards: false
  after Escape, prompt = "[E] sit on the bed and watch TV"
```

The letter it opens (`shots/w86-slip-picked-up.png`):

> **PUSHED UNDER YOUR DOOR** · APT 301. · *I came up. You were not in, or you
> were in and did not answer. I will come again tomorrow.* — V. OKONKWO ·
> **OUTSTANDING NOW: $45.00** · `PAST DUE`

Escape closes it and movement resumes, so it is not the modal trap of §11.

## So I did not clear the floor, and the row's DONE WHEN is wrong

The row says **"the floor of 301 is clear"** and *"decide whether it should be
deleted or moved."* Following that literally deletes N's rent-letter system —
one of the user's own headline requests (*"rent + landlord letters at the
mailboxes"*, CONFIRMED in SESSION-STATE) — and orphans a registered interaction
spot. **The floor of 301 is already clear. The slip is the only thing on it and
it is supposed to be there, only on the days you owe money.**

This is BUILDER-BRIEF §6a: the row's instruction and the user's question
disagree, and the user only ever asked *"what is this"*.

## The other half: is anything leaking into the interiors? No.

The desk offered a hypothesis — outdoor props in raw world coordinates landing
inside rooms parked at x ≈ 199 — and asked for it to be proved or discarded.

**Discarded, measured.** `scripts/probes/w86-foreign-modules-in-rooms.mjs` takes
each room's rectangle from `__ct.roomDims()` (GOTCHAS 86 — asks for `cx`, never
derives it) and lists the `userData.mod` stamps of every mesh inside it:

```
bank 268 · bodega 93 · burger 147 · church 308 · diner 80 · hotel 125
casino 1108 · jail 477 · library 388 · pawn 63 · tax 120 · thrift 172 · apt301 87

0 room/outdoor-module pairs flagged
```

Zero meshes stamped `props`, `tex-world`, `street`, `weeds`, `lot`, `park`,
`civic`, `alley` or `cars` inside any of the 13 rooms. Outdoor modules do carry
their stamps (the same traversal reads `mod=street`, `mod=lot`, `mod=park`
outdoors), so the test can see what it is looking for.

And `w86-pale-slivers-everywhere.mjs` swept all 13 rooms for the *shape and
colour* the user described — flat, thin, small, mean texture luminance > 0.45 and
warmer in red than blue — and returned **exactly one hit in the whole world**,
the slip. So this is one intentional object, not a systematic leak.

## A fact the row had wrong, and it cost me six screenshots

**The player's spawn is not in 301.** GOTCHAS 51 says *"the player SPAWNS INSIDE
301"*; `roomDims()` puts apt301's floor at **y = 5.4** (third storey, `2 * ST0`)
while the spawn is `[198.6, 1.62, −16.3]`. The first six downward shots I took
were of a **different room's** boards one storey down, and they were clean —
which is exactly the sort of clean bill of health §48/§54 warn about. Getting to
301 needs `__ct.warp(x, z, yaw, 5.4, pitch)`; `gy` is the storey, and `pos()`
keeps returning 1.62 regardless, so `pos()` cannot tell you which floor you are
on.

## Found and NOT fixed — for the desk

1. **Nothing to fix here, and that is the finding.** If the user wants the slip
   to read as paper at a glance rather than as a tuft, that is a change to N's
   art on his own feature and a design call he should make — 0.11 × 0.16 m at
   **100 px/m both ways** is deliberate and documented in the file (the first cut
   was 148 px/m across and 71 down, and was fixed for GOTCHAS 5). I am not
   re-tuning it on a guess. **Recommend the desk simply tell him what it is** and
   ask whether he wants it clearer.

2. **GOTCHAS 51 is wrong about the spawn** and should be corrected — it names 301
   and the spawn is three storeys below it. Not my file.

3. **`pos()` does not report the storey.** Anything reasoning about which floor
   the player is on from `pos()[1]` is reading a constant 1.62. `ctx.player.gy()`
   is the real answer and the tenancy spot already uses it.

## Caveat, stated because it is the weak link

The user's screenshot was pasted into chat, not saved to disk, so I could not
compare against the image itself. The identification rests on the match of
shape, colour, angle, size and place **plus** the sweep showing it is the only
object of that description on any floor in the world. I am confident, but that
is the evidence, and it is not a pixel diff.

## Verification

No world source changed for this item — probes only. `node scripts/health.mjs`
→ `WORLD OK`; `npm run sweep` → 0 STATION MISS, 0 COVERAGE.
