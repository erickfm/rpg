## audit/seams — interiors round 2: no new rooms, but two entry triggers are in debt

Queue `## Now` (interiors, a standing item) — re-walked at `bcd2c82`.
Report: `notes/interior-audit.md`, Round 2 appended.

Touched:   notes/interior-audit.md (+Round 2), notes/audit-seams.md
           scripts/triggers.mjs (new — measures trigger margin by walking)
           **nothing under street/src/**
Verified:  walked, with real key input, from three directions per trigger.
Base:      bcd2c82

### State

**Still one kit room.** `int-diner.ts` is the only interior in the tree — F's
burger barn and G's casino are assigned but not committed. The set comparison
from round 1 is unchanged and stands. I did not redo it.

### What I did instead

The same commit that updated my queue routed a finding to D: *crosstown.ts
hand-writes the block's collision as rectangles spanning the whole street,
independent of what any module draws.* That is bullet three of my own item —
"is any room enterable from a spot that a collider swallows" — so I measured it
now rather than waiting for nine rooms to inherit it.

| trigger | r | closest reachable | margin | centre reachable? |
|---|---|---|---|---|
| DINER | 1.05 | 0.21 | **0.84 m (80 %)** | **no — blocked** |
| No. 227 | 1.05 | 0.21 | **0.84 m (80 %)** | **no — blocked** |
| BODEGA | 1.10 | 0.00 | 1.10 m (100 %) | yes |

**Good news first: the bodega blocker is closed.** Full radius available.

**The finding:** the blanket walls stop the player at x = ±6.34; both the diner
and No. 227 place their door spot at ±6.55. Their trigger centres are 0.21 m
inside solid collision and they work only because the radius is five times the
intrusion. Nothing is broken today — what is broken is that **nobody owns the
margin.** It is spent by anything a props builder puts outside a door, and the
bodega proves one prop is enough: blanket wall, then crates, and 0.84 m of slack
went to −0.31.

Two reasons it is mine and not only D's: the diner is the reference the other
nine will copy, so nine more triggers start 0.21 m in debt; and **`buildRoom`
already checks the mirror image of this** — it warns when the way-out landing
falls inside the way-in trigger — but never checks that the way-in spot is
reachable at all. The file that owns the door contract validates one end of it.

Recommend a build-time assert in `ct/interior.ts` beside the check already
there. It needs the collider list handed to it, which is a desk call.

### Pattern, now with four instances

> Values that describe what a module built are being authored somewhere else, by
> hand, as literals. Density per painter instead of from the surface (seam #1).
> A mounted object's position typed instead of taken from its host (floats).
> The block's solid geometry hand-written in crosstown.ts instead of registered
> by the module that drew it (collision).

Worth noting for the desk: the interior kit already does this right — colliders
via `room.solid`, spots via `ctx.spot` — which is exactly why interiors are the
one subsystem where this class has not appeared. It is the model to copy.

Left:      Nothing to compare until F and G land; the instrument is one command.
           I could not enumerate `SPOTS` directly (not exposed on `__ct`), so a
           spot registered by a module I do not know about went untested. Margin
           figures are a snapshot of a budget other builders spend.
