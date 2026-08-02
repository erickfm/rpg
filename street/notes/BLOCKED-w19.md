# BLOCKED-w19 — item 46's subject is not in mainline

**Status: `BLOCKED`, and I am releasing the item rather than holding it.** Per
the desk's standing instruction, and per `notes/archive/BLOCKED-L.md`'s own rule:
**if you read this and `scripts/w21-roof-climb.mjs` exists, it is closed.**

Item 46: *"A player was seen STUCK on the cab roof… Reproduce it under sustained
load… DONE WHEN: either the STUCK reproduces and is fixed, or 20+ throttled
roof-exit runs are clean and the diagnostic stays in as a guard."*
Files: `ct/cars.ts` + `scripts/w21-roof-climb.mjs`.

## Why I cannot do it

**Neither half of the subject is in this checkout.**

1. **`scripts/w21-roof-climb.mjs` does not exist.** Nor does any file matching
   `*roof*` in `scripts/`, nor any `notes/w21-*`. w21's work is still on its own
   branch; it has not reached `add-stick-and-city98`.

2. **There is no standable cab roof — there is no standable anything above the
   street.** The item calls the roof *"the first place in the world a player can
   stand that is not a floor"*, and in this tree that place does not yet exist.

## Measured, not concluded from a grep

`scripts/probes/w19-can-you-stand-on-a-car.mjs` takes each parked car's own
still collider, drops the player onto its middle, lets it settle and reads back
where the world put them:

    214 still colliders, 7 of them car-sized
      car at (-11.33, -68.86)  groundAt over its middle: 0.14
      car at (15.37, -99.12)   groundAt over its middle: 0
      car at (26.37, -106.82)  groundAt over its middle: 0
      ... 6 of 6 at street level

    stood on it: pos (-11.33, -69.926) at storey 0.14, eye y 1.62
      NOT RAISED — the player is at street level.

0.14 is the pavement. **You stand through the car, not on it.**

The source agrees, and this is the whole registry rather than a sample: only two
modules register a ground surface at all — `ct/civic.ts:135` (the library
courtyard) and `ct/park.ts:607` (the park). Everything else is the apartment's
own `aptGround` and `crosstown.ts`'s street rules. **Nothing on a vehicle.**

## What I deliberately did NOT do

**I did not touch `ct/cars.ts`.** The item's own instruction is *"if it is real,
the fix is an escape path, not a smaller roof"* — and I have nothing to escape
from. Editing the fleet against a hazard that does not exist in this tree would
be a speculative change to another builder's in-flight area, and it would collide
with w21's branch on the merge train.

**I did not run the 20+ throttled roof-exit runs.** They would all be "clean",
and they would mean nothing: a roof-exit test against a world with no roof passes
by measuring nothing. That is GOTCHAS 34 exactly, and a green run recorded on
this tree would be worse than no run, because the item would then read as
settled.

## What would close it

Run the item in a tree that has w21's work — after the merge train lands it, or
in w21's own worktree. Then the item is exactly as written and needs nothing from
me. The probe above is a useful first line either way: on a tree WITH the roof it
prints `RAISED`, which is the precondition every other clause depends on.

## Also worth the desk knowing

The item is written as though w21's diagnostic were available to whoever picks
this up. It is not, and the file list (`ct/cars.ts + scripts/w21-roof-climb.mjs`)
is what made that look true. **An item that names a file which does not exist in
mainline is the same class as a check registered against a missing script** —
`checks.mjs`'s own pre-flight guard exits 2 rather than run 55 confident verdicts
about nothing, for exactly this reason. A one-line existence check on the file
list at ranking time would have caught this before it cost a claim.

---

# Item 47 too — same root, and here is the one-line proof

Item 47: *"do NOT build the tyre route onto sedans/hatches; give ONE car a real
one instead… DONE WHEN: the route is walked end to end on the built bundle,
every hop has a margin at least as generous as the pickup's 21 mm at the dt
clamp, and it is mutation-tested red by flattening one step."* File: `ct/cars.ts`.

Part of its basis IS in this tree — `src/main.ts:107` really is
`const dt = Math.min(clock.getDelta(), 0.05);`, so the dt clamp the margins are
bounded by resolves. (Note the item cites it as `main.ts:107`; the file is
`src/main.ts`, not `src/proto/main.ts`.)

But the thing being climbed is not:

    src/proto/fp.ts:9
    export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

**Every collider in this world is a 2D rectangle with no height.** There is
nothing to stand on top of, no step-up code anywhere in `fp.ts`, and the only
`climbable` flag in the tree is `ct/civic.ts:56`, set to `false`. w21's route
work must add a height dimension or a standable registry, and neither is here.

So the three DONE WHEN clauses are all unreachable in this checkout:

- **"walked end to end"** — there is no surface to walk onto.
- **"a margin at least as generous as the pickup's 21 mm"** — the pickup route
  does not exist here, so there is no margin to compare against. The number
  would have to be retyped from the item, which is exactly the hand-copied
  constant BUILDER-BRIEF §8 forbids, and it would be a copy of a measurement
  taken on a *different tree*.
- **"mutation-tested red by flattening one step"** — flattening a step that
  nothing can stand on cannot turn anything red.

I could still have *shaped a bonnet* in `ct/cars.ts` and called it a route. That
would have been the silent workaround: geometry that looks like a climb, cannot
be walked, cannot be measured, and would land on the merge train straight into
w21's own file.

**Both items want the same tree.** Whoever re-ranks them should hold them
together until w21's work lands, and they can then be done back to back by one
builder — 46 is the hazard and 47 is the route, and they are the same subject.

*w19.*
