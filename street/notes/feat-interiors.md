# Builder F — handoff

Working from `notes/queues/F-interiors.md`: read it, take the top unchecked
item under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here.

---

# RUN 1 — verify and finish the kit and the diner (commit `34167b1`)

## `## Now` → **Verify and finish the kit and the diner** — DONE

Rebased onto `add-stick-and-city98` first (two commits behind; the rebase is
what brought my queue file into the worktree). Then walked everything.

The queue said to treat every line as suspect. That was the right call —
**six defects, four of them in the kit**, so the fix goes to the nine rooms
still to come rather than to the diner alone.

### What was wrong

| # | defect | where |
|---|---|---|
| 1 | you spawned facing the wall you had just walked through | kit |
| 2 | the whole interior went dark at 2am | kit |
| 3 | you could walk out of the doorway into the dead ground between slabs | kit |
| 4 | stepping out landed you inside the re-entry trigger | kit + diner |
| 5 | the door leaf swung through the jamb | kit |
| 6 | `interiorGround` / `INTERIOR_MAX_X` claimed ground no room owned | kit |

**1 — facing.** The kit jumped you in at yaw `Math.PI`. `fp.ts` has
`fwd = (sin yaw, 0, -cos yaw)`, and the door is in the `+z` wall, so `Math.PI`
points you at the door you just came through. Now yaw 0. You also land a
stride deeper than the trigger rather than on top of it.

**2 — the night sweep, and this one is a trap for every other room builder.**
`props.dimWorld` picks what the night may darken by reading each object's own
`position.x` and skipping `|x| > 100` — and that is the **local** position, not
the world one. The kit parked the room group at its world address and hung
local-coordinate children off it, so to the sweep every stick of furniture
looked like it was standing on the street. 96 of 96 interior materials dimmed
at 2am, in a room whose entire premise is that a lit window at 2am means
something. The group now sits at the origin and `put` writes world positions.
`Room.group` carries the reason in a comment; **add through `put`.**

This is also why the door leaf is swung by arithmetic instead of by a pivot
`Group` — a child of a nested group carries a local position, and the leaf
alone went dark while the room stayed lit. Nested transforms are not free here.

**3 — the room leaked.** The doorway is deliberately a gap in the collider
line so the way-out `[E]` spot stays reachable (GOTCHAS §8 — a collider that
swallows a trigger is how the bodega became un-enterable). But nothing stopped
you *past* it: walking at the door carried you out to z = 8.6, through the
front wall and onto dead ground. Blocked on the **far** face of the wall, which
stops you at z = 3.28 while leaving the trigger at 2.95 comfortably reachable.

**4 — the landing.** Exit put you at `-(FACE - 1.1)`, which is 0.65 m from a
1.05 m re-entry trigger: the street prompt still read `into the DINER` and the
next E — the key you are already pressing — took you back. The diner now steps
out *along* the walk, 1.5 m down it, still inside the 2 m lane. **The kit now
warns** when a spec does this:

```
[interior:diner] stepping out lands 0.65 m from the way-in spot, inside its
1.05 m trigger — you will be sucked straight back in. Move outX/outZ at least
1.40 m clear.
```

**5 — the leaf** was a plane positioned at its centre and then rotated, so its
inner half swung back through the jamb. Hinged on the outer face now.

**6 — addressing.** `interiorGround` returned 0 for *any* x past 400, and
`INTERIOR_MAX_X` reserved sixteen slabs whether built or not — which moved the
world's east bound from 260 to **1680**. Both derive from slabs actually
claimed now. See the bodega note below for what that uncovered.

### The front wall now checks its own openings

Queue item 2 was right that nothing validated the door and window. The wall is
built as the runs *between* its openings, which only yields a wall if they are
inside it and disjoint — and the failure is silent, because negative-length
runs are dropped. You get a room with a hole in it and no clue why. All three
guards were proved by deliberately breaking the spec and reading them back:

```
[interior:diner] the window spans -5.95…3.95 but the front wall only runs -4.48…4.48 — dropped
[interior:diner] the window overlaps the opening at -3.17…-2.03 — dropped
```

The door wins any clash: a room with no window is a room, a room with no door
is a bug.

### Interiors are built LAST, and must stay last

GOTCHAS §2 is about the seeded `rnd()` stream, but the same argument applies to
the paint layer's `Math.random`: the fingerprint harness seeds it, so a module
that paints mid-build shifts the grain of **every texture painted after it**.
Built where it was, the diner made `fpdiff` report *71 textures differ* when
not one had changed. Moved to the end of `makeCrosstown`, it is provably
additive. **Ten interiors are coming — leave the call where it is.**

`scripts/fpadd.mjs` (new) is the diff to use for this programme.
`fpdiff.mjs` compares the sorted dumps index by index, so any insertion shifts
the tail and the whole thing reports as changed. `fpadd` compares them as
multisets and splits the answer into *lost* (must be 0) and *gained* (your new
work). Final state: **0 lost textures, 0 lost structure**; the only street
`places` differences are seven pigeons drifting, which GOTCHAS §1 calls the
noise floor.

### Two style misses, both found by looking

- **The plaster canvas was a fixed 32×54** whatever the ceiling height —
  ~12 px/m across and ~18 px/m up, so texels were half again as tall as wide
  and every speck of grain came out a dash. Sized off the same px/m in both
  axes now, and the dirt is weighted toward the floor: an even scatter over a
  big flat wall two metres from your face read as mould, not plaster.
- **The booths were built for giants** — 2.4 m benches around a 2.2 × 1.1 m
  table, sat next to a 1.15 m door. Right-sized to a 1.35 m bench and a
  1.15 × 0.7 m table, and **three** now fit under the window where two
  sprawled. Three is also what makes it read as a diner rather than a room
  with tables in it. They block as **one** collider, not nine: the dividers
  are 0.25 m apart, narrower than the 0.72 m player, so per-bench boxes only
  create slots you wedge into.

Formica also had the GOTCHAS §5 problem — one unrepeated tile stretched over
whatever it landed on, 10 px/m across the counter and 55 px/m across a table,
which is why the tables looked strewn with crumbs next to a clean counter.
Repeat derives from metres now.

### Verification

`scripts/diner-walk.mjs` (new) drives the real rig — enter from the street,
facing, floor height, the floor mesh agreeing with the picker, all four walls,
the doorway, the lane both ways, the way out, the landing not being boxed in,
and the room still lit at 2am. **21/21.** Plus `health.mjs` OK, 48-shot sweep
with no console issues, `npm run build` clean, fingerprint additive.

Two of its checks are there because the harness lied to me first: three probes
originally started inside a collider's 0.36 m pad, where the rig cannot move in
*any* direction, and reported "the wall held" having never taken a step. It now
fails a probe that does not move.

---

## FOR THE DESK — two things that are not mine to fix

**1. `ct/bodega.ts` has a gap in its east wall at z ≈ -21.** Sprinting east
from inside the bodega goes straight through it. This is **pre-existing** — the
old `maxX: 260` bound was covering for it — but moving that bound out to the
interior belt un-hid it, and you could then run 200 m across the dead ground
toward the slabs. I put a wall back at x = 260 in the interior-belt block,
which restores exactly the old behaviour, rather than reaching into a file I do
not own. The gap itself is still there behind it. `bodega.ts` has no entry in
`OWNERSHIP.md`.

**2. `scripts/ownership.sh F` flags `src/proto/crosstown.ts`.** Expected — my
queue grants me "the interior-belt wiring in `crosstown.ts`, which is otherwise
desk-owned", and the script does not know about that carve-out. My diff there
is confined to it: the import, the build call, the collider spread, the east
wall above, the `maxX` bound, and the `groundY` branch. Nothing else.

## FOR BUILDERS G, E AND C — the kit's rules

You furnish in local coordinates and the kit does the rest. Three things will
bite you if you go around it:

1. **Place through `room.put`, never `room.group.add`.** The group is at the
   world origin on purpose; local-positioned children get eaten by the night
   sweep. Same reason: no nested pivot groups for furniture.
2. **Read the console.** The kit warns about openings that do not fit and about
   an exit that lands inside its own trigger. Both are silent bugs otherwise.
3. **Your exit must land ≥ trigger radius + 0.35 m from the way-in spot**, and
   prefer landing *along* the walk rather than out toward the kerb — the 2 m
   lane is sacred (GOTCHAS §9).

If the kit is missing something you need, ask me and I will add it — per the
queue, `ct/interior.ts` is not yours to edit.

---

## Next up

`## Next` in my queue is the **BURGER BARN** interior (the user is already
trying to get in — *"cant go inside burger barn"*), then the **THRIFT STORE**.
Not started.
