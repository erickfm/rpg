# Handoff — builder E · the library courtyard

> **Status, 2026-07-25.** Everything this note asks for has landed. The
> courtyard is enterable, the steps are climbable, both benches are seats you
> can sit on, and B has moved the payphone off the mouth. Nothing owed; the
> patch files it refers to are spent and deleted. Read on for why the place is
> shaped the way it is.

Queue item: **The library courtyard — DO THIS FIRST.** Done, with one thing
the desk has to land for me (below).

Commit `213b495` on `feat/civic`. Only `ct/civic.ts` changed; `ownership.sh E`
is clean.

---

## What is there now

The whole library mass stands **3.2 m back** from the facade line (x = −7.0 →
its own face at x = −10.2), and the notch is the forecourt. It runs the full
16 m of the frontage, z = −21 … −5.

- **Paving** — its own texture, not the walk's: 1.15 m flags in warm stone
  against the walk's cool grey 1 m slabs, a border course round the edge,
  weeds in the joints and two cracked flags. Painted from the surface's real
  metres at 32 px/m (§5). It is a PLANE at exactly KERB_H, not a slab: all
  four of its edges are closed by something, so there is no edge to show and
  nothing to z-fight with the walk it abuts (§6).
- **The steps, rebuilt** — the old flight was folded inside the 1.8 m entrance
  recess because a projecting one would have eaten the pavement. Now the
  recess is the landing and five treads come down into the courtyard, cheek
  walls stepping down one segment per tread.
- **Furniture** — two benches facing each other across the axis with their
  backs to the party walls, two planters of clipped box in the corners at the
  foot of the cheek walls, a wire bin by the north bench, and a pair of gate
  piers where the party lines meet the pavement.

## Two things that were not in the brief

**Unlit steps read as a ramp.** Everything here is `MeshBasicMaterial`, so a
tread and a riser cut from the same colour are the same colour. The first
flight had five steps in it and you could see two — the contrast has to be
painted in. Treads take the pale stone, risers the dark one. Worth knowing for
anyone building a stair anywhere in this world.

**A setback uncovers the neighbours.** Cutting the notch exposed 3.2 m of
MERIDIAN's and BURGER BARN's flanks, and a flank here is a bare `endM` box —
flat brown, no scale, filling half the view from inside. Both are now faced
with common brick in the same hand as `facadeTex`: sooted, whitewash dado,
ghost of a lower roof, and a downpipe with a hopper head on the north one.

That panel has a **coupling worth writing down**: it must stop below the
neighbour or it stands against the sky, and it cannot ask how tall the
neighbour is (BURGER BARN is not built yet when the library places). It is
15.4 m, which clears the shorter of the two (17.2 m) by 1.8 m, and the top
2.5 m of the paint fades to `endM`'s exact brown so there is no visible top
edge. **Drop either west neighbour below four floors and this needs
revisiting.** Same applies if the church lands next to it.

## What the desk has to land — `notes/E-courtyard-crosstown.patch`

The courtyard is **visible but not enterable** until this goes in. Two facts
live in `crosstown.ts` and nowhere else:

1. the west wall collider runs unbroken down the block, so it has to be
   notched at the mouth, and the courtyard's own solids added;
2. `groundY` only answers KERB_H out to x = FACE + 0.3, so the paving is
   behind the line where the floor drops to 0.

`git apply notes/E-courtyard-crosstown.patch` from the repo root. It is 3
hunks, entry point only — it does **not** touch `ct/street.ts`, because
`ct/civic.ts` now exports one object for it:

```ts
export const COURT = { live, minX, maxX, minZ, maxZ, y, colliders }
```

filled when the library is placed. That was the cheapest wiring I could find:
without it, `obstacle` would have had to be threaded from `crosstown.ts`
through `buildStreet` (D's file) into `buildCivic`, which is a two-owner
change for one courtyard. `buildCivic` also takes an optional `obstacle` and
returns its `colliders`, if the desk would rather wire it that way later.

I applied the patch locally to walk the courtyard, then reverted it — the
commit is `ct/civic.ts` only.

## For builder B — the payphone (`ct/props.ts`), not mine to move

It is at **x = −6.45, z = −11**, collider x −6.95…−5.95, z −11.55…−10.45. Two
separate problems, one of which predates the courtyard:

- It stands **dead centre of the courtyard mouth**, right on the entrance
  axis. Every shot from the street has it in front of the library doors.
- It already **blocks the sacred lane**. With RADIUS 0.36 it blocks
  x −7.31 … −5.59, and the walk is x −7.0 … −5.0. Before the setback the wall
  blocked out to −6.34, so the only way past it was a 0.23 m window at the
  kerb; you effectively had to step into the road. That is pre-existing, and
  it is why `E-walk.mjs` asserts the lane stops *exactly* at the payphone
  rather than asserting it is clear.

Suggested: **z ≈ −6.4, x unchanged** — hard against the north end of the
frontage, flanking the mouth instead of blocking it, and clear of the north
gate pier (which owns x −7.5…−7.0, z −5.5…−5.0). The street tree at x = −5.4,
z = −16.5 is kerb-side and wants no change; it frames the courtyard from the
south.

Once the payphone moves, the courtyard also gives the lane a bypass the solid
wall never did — `E-walk.mjs` proves you can step inside the mouth and walk
straight past that z.

## How it was verified

- `scripts/E-walk.mjs` — **14 checks, all passing** (with the patch applied):
  the frontage lane in both directions; street → courtyard → back out; round
  the steps to both benches; the recessed facade and both party walls holding;
  64 floor samples across the courtyard all at gy 0.14 with none leaking
  behind the facade. This is the file to re-run if anyone touches the
  courtyard or the props on this frontage.
- `scripts/E-courtyard.mjs` — 16 shots under `shots/E-court/`, for LOOKING:
  from the road, along the walk both ways, at the mouth, on the axis, both
  benches, the steps in profile, the paving, and one at 21:40 to check the
  night tint picks it up (it does — everything is swept in by `dimWorld`).
- `bugsweep` over the whole world: no new console errors.
- `health.mjs`: world initialises.

## Not done / notes for the desk

- **Port.** The queue says 4182; that port is held by a stale `vite` serving
  `/home/erick/projects/rpg/street` (pid 499084), which is not a live
  builder's worktree. I took **4188** rather than kill someone else's process.
- The courtyard has no `[E]` spot — the library still does not open. If it
  should, that is a new item and it wants `ct/interior.ts` (F).
- Next in my queue: **the church buttresses fouling the lancets**. Noted from
  the desk that D is moving the church onto the main block over DELI +
  RECORDS, so it will have neighbours hard against both flanks. Two things
  that follow from this courtyard apply directly: the buttresses must be
  derived from the same bay metres as the lancets (same class of bug as the
  planters closing the mouth — two systems, two coordinate spaces, nothing
  reconciling them), and **whatever the church stands against will expose the
  same flat `endM` flanks** this courtyard just had to face. The party-wall
  painter in `ct/civic.ts` is reusable for that.
