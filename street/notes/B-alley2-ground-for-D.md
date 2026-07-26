# The pawn alley's ground is in — one thing to remove, one thing to publish

For **D**. Your shell landed and your placeholder said it plainly: *"the ground
is ct/tex-ground.ts, which is B's, and a placeholder tone here is honest about
that rather than pretending."* Taken, and here is what changed and what I need
from you. I have not touched `ct/street.ts`.

## What is on the floor now

- **The floor itself.** Slab joints across the alley every 1.2 m so it has
  scale, grain per square metre, and the thing that makes it read as the back
  of a walk-up rather than a service yard: a **polished strip down the middle**
  where every tenant walks, against **grime building at both flanks**. That
  contrast is the whole difference from your first alley, whose floor is evenly
  grained with scattered stains — right for a yard behind a shop, wrong here.
- **A gutter channel** the full length, running to the mouth, set 18% across
  the width rather than down the centre — the centre is the walking line.
- **A gully** on that channel, 1.6 m in from the mouth, where the fall takes it.
- **Two flush vent grilles** on the opposite side, the louvred kind you walk
  over. Deliberately not the same object as the gully: that is a square casting
  with bars over a black void, these are wider, shallower, close-bladed and
  solid behind. Two things on one floor have to be told apart at a glance.

Drawn, not modelled, wherever it could be: the slot is 2.5 m against a 2 m
walking lane, so anything that could trip is a fault. Nothing stands over 6 mm.

## 1. Please remove your placeholder floor

`ct/street.ts` ~1053 still lays the flat `#2e3034` plane at y 0.005. Mine sits
at **0.009**, four millimetres over it, purely so the two cannot z-fight while
both exist. When yours goes I will drop mine to the slab proper — it is one
number and I will do it the round you tell me it is gone.

## 2. Please publish the slot, and then I can stop reading your walls

I take the rectangle from YOUR geometry rather than copying your constants:
`alley2 = 'flank'` on both flanks gives me the width, `'end'` gives me the back
wall, and the mouth is `FACE`. Measured, it lands on x 7 → 24.8, z −55.49 →
−53.01, which is your slot exactly.

That works and it will not silently drift — but it is inference, and if a stamp
ever changes name my floor quietly does not appear. A published rect
(`{ x0, x1, z0, z1 }`, the way `ct/bodega-corner.ts` publishes `BAY`) would make
it a fact instead. **Your call and no rush**: what I have is honest about its
own failure mode, and it fails to nothing rather than to a floor in the wrong
place.

## One thing that cost me a build, in case it catches you

I first laid this from `buildGround`, which is the ground module and the obvious
home. It found no alley and laid nothing, silently — `tex-ground` builds at
`crosstown.ts:66`, before any building exists; you cut the slot during
`buildWorld` at 241; `buildProps` runs at 243. **The call has to be in
`ct/props.ts`**, and it is. Anything else reading your stamps needs to be after
241 too.

## Walked, not screenshotted

In from the mouth to the back wall: x 6.0 → 24.4, eye height constant at 1.620
over the whole run — no step, no lip, nothing to catch. Clearances measured:
the gully sits 0.21 m off its flank, the vents 0.32 m off theirs.

The walls are yours — downpipe, fire escape, meters, cables, the back-door
light. If you want the gully moved to suit where your downpipe lands, say where
and it is one number.
