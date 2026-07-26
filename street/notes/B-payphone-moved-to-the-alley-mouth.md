# The payphone: moved to the alley mouth, and rebuilt with depth

Ref `shots/user-phone-booth.png`. The desk ruled MOVE rather than delete, and
named three candidates. I took the **alley mouth** — and the reason is not
taste, it is that it is the only one of the three where the desk's second
requirement is physically possible.

## Why the alley mouth and not the other two

The desk asked for **real depth, a visible side wall, and a top that projects**,
and separately for the 2 m lane to stay sacred. Those two pull against each
other everywhere along the shopfronts:

```
  walk            x -7.00 … -5.06        1.94 m
  walkers run at  x -6.00 ± 0.55         (STRAY, ct/crowd-net.ts)
  so anything against the building line may be 0.45 m deep, at the very most
```

The old phone was 0.30 m deep for exactly that reason, and 0.30 m is why it read
as a printed panel — the user is right and it was not the object's fault.

**The alley mouth is a gap in the building line.** Measured, not assumed: no
collider between `z -43.5` and `z -37.0` on the west side, and the alley floor
runs `x -13.6 … -7.0`. So a **0.62 m** shelter stands entirely *outside* the
walk and costs the lane nothing.

It also answers the desk's own third argument. `ct/crowd-net.ts` has a node
`w-alley` at `(-6, -40)` carrying **no `act`** — the one stop on the west walk
with nothing to do at it. Now there is something.

The bodega corner is an outside-of-bend return, where the walk is *cut back* on
a 3.5 m radius — less room, not more. The bus bench is against a shopfront, so
0.45 m again.

## What it is now

Eight parts instead of one box: back slab, two side wings, a canopy that
projects past both, a shelf with the directory swinging under it, the instrument
bolted proud of the back slab, and a backlit header. 1.00 m wide, 0.62 m deep,
2.30 m tall, standing on the **alley floor** (y 0.005), which is 0.14 m below
the walk, and 5 cm clear of the walk slab's west face — abut, never coincide
(GOTCHAS 6), or it would z-fight the kerb slab down its whole height.

## The three things a screenshot cannot tell you

`scripts/phonebooth.mjs` and `scripts/phonewalk.mjs`:

```
  nearest face to the walk (x = -7.00)    -7.07     CLEAR by 0.07 m
  collider                                x -8.17 … -7.07, entirely outside the lane
  closest walker, 1800 samples / 60 s     1.07 m    clear of the 0.36 m body radius
  header  at 13:00 / 23:00                1.0 / 1.0
  enamel  at 13:00 / 23:00                1.0 / 0.12
```

A full minute of walker samples, not twelve seconds, because a minute is the
bar the desk set — *"a booth dropped into a walking lane will have people
clipping through it within a minute"* — and twelve seconds is that claim not yet
contradicted rather than that claim tested. The closest anybody comes is a
walker at `(-6, -37.06)`, level with the shelter's north edge and 1.07 m off it.

And it is **walked**, not screenshotted: north up the west pavement at
x -6.35 past the mouth, zero lateral drift, arrived; then a turn into the mouth,
reached the phone.

The walk probe did flag a 1.1 s stall at `z -32.9` that repeated at the same
place every run, which looks exactly like a static obstruction. It is not — it
is **a citizen**, at `(-6, -32.22)`, and it repeats because the crowd is seeded
so the same person is in the same place at the same elapsed time. The probe
names who is within 1.4 m now, because "repeats identically" is not evidence of
"static" in a seeded world.

## A defect this turned up, in my own file, wider than the payphone

**`props.lit()` could not hold a light bright.** `register()` hard-coded
`floor: FLOOR_GROUND` and never asked whether what it was grading emits — and
`dimWorld`, which *does* ask, skips anything already in `litSeen`, which is
everything `lit()` has touched. So `props.lit(x)` was the one way into the night
grade that grades a light source like masonry. The header came out at **0.0933
at 23:00**, alongside the enamel.

It honours a **declaration** now — `m.userData.lightSource` — and deliberately
not `isSelfLit`'s heuristic. Running the heuristic there would be much wider
than it looks: `lit()` is called on the bus bench group, and TONY'S PIZZA is
bright saturated ink that would start burning at full daylight after dark. That
is the exact false positive the `printed` opt-out exists to undo.

**So `props.ts` now has both halves of the same declaration**, and other owners
may want them:

| | |
|---|---|
| `m.userData.printed = true` | these bright texels are INK. Grade me. |
| `m.userData.lightSource = true` | this really is lit. Hold me at full brightness. |

Set either on the **material**, at build time. `printed` is documented in
`notes/B-printed-flag-HOWTO.md`; `lightSource` is the same shape and the same
place.

## Left for whoever is next

The desk said: *if the new position still reads badly, tell me and I will take
the decision again with better information.* It reads well from the south
approach and head-on (`shots/pb-approach-s-day.png`, `-night`), which is how
you meet it walking up the west pavement. It is **less visible walking south**,
because you come at it from behind the building line — that is honest for a
thing in an alley mouth, but it is the angle to watch if he raises it again.
