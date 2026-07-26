# BLOCKED — builder H

One item blocked on ownership, and three rulings outstanding. Nothing here is
waiting on work.

## 1. "move the truck a bit away from the alley" — needs a DESK edit

The item is small and I know exactly what it needs; I cannot make the change
because the code is not mine.

The parked arrangement is DRAWN from the seeded stream in **`crosstown.ts`**,
which `OWNERSHIP.md` lists as `= DESK`. The draw already runs each car through
`nudgeClear(zDrawn, box, [...propColliders, ...carColliders], 4.5)` — so the
mechanism for "change the constraint the draw works within, do not hand-place
it back" is already there and working. What is missing is one more keep-clear
span in the list it clears against:

```
the alley mouth: AZ0 = -37 to AZ1 = -43.5
```

**The one-line shape of the fix:** add a pseudo-collider spanning the alley
mouth on the alley's own side of the street to the array passed to
`nudgeClear`, with a little margin either side so the sight line into the alley
is open rather than merely unblocked. `nudgeClear` then takes the nearest legal
z automatically and the seeded spread survives, exactly as it does for kerb
props and the bus bench today.

The other candidate home is `ct/gap.ts`, which `OWNERSHIP.md` lists among the
six files with **no name on them** — so I have not taken it either.

**What I need:** either the desk makes that edit, or `ct/gap.ts` is assigned to
me and the keep-clear list is moved into it, at which point I can do this and
any future zone without touching `crosstown.ts`.

Worth noting the constraint is already sound where it applies: measured across
all 411 world colliders, 64 gaps fall in the player's 0.40–0.95 m trap band and
**none of them involves a kerbside parked car** — they are the idle vehicle
pool parked off-map by design and other modules' props.

## 2–4. Three rulings, asked for repeatedly

- **The wheel-arch well colour.** The sill shadow is 90,84,58 and the well is
  83,78,52 — SEVEN LEVELS APART, so they merge into one dark mass across the
  bottom three quarters of the flank. That is the "large soft DARK BLOTCH".
  Darkening the well to about `× 0.18` (→ 62,58,40) separates it, keeps the
  body's hue and stays well clear of the tyre's 16,17,20. **One line. I have
  not done it because the instruction was explicit: "the wells and the arch
  paint you already fixed are good — do not disturb them."**

- **The masonry rounding rule.** I could not wait any longer and shipped the
  density pass on a stated rule: fix the DENSITY, accept a fractional canvas
  rounded to whole texels. Every vertical face on every vehicle is now 32 px/m
  with square texels. **If A's helper rounds the other way — fix the canvas,
  accept a fractional density — say so and I will match it.** The horizontal
  panels (roof/hood 28.2 × 32–60 px/m, bed floor at half density) are still to
  do and will follow whichever rule is confirmed.

- **The side street's east end.** `crowd-net.ts` links s-east (54, −109) to
  ne-corner (54, −97) as "up the closed east end", but the side street's
  asphalt spans x −7…55 and z −98…−108 — so that edge runs **up the middle of
  the carriageway** for ten metres and is not flagged as a crossing. Walkers on
  it are legal by the graph and jaywalking by the world; it is the entire
  residual in my in-the-road measurement. `EEND_X = SIDE_X1 − 1` is "one metre
  in from the kerb", which is only right if there is a kerb at x = 55. **Does
  that end have a pavement?** If yes the ground module should show one and the
  node stays; if no, the ring should close another way or that edge becomes a
  crossing. The file is mine — I just should not invent the answer.
