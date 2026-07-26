# Queue — builder E  ·  worktree `../rpg-civic`  ·  port 4182

**Owns:** `ct/civic.ts` (the library + the church), and the HOTEL / GOLDEN ACES
facades where they live in `ct/tex-world.ts` — coordinate with the desk before
touching tex-world, it is shared.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change. `ct/civic.ts` was split out of `ct/street.ts` today (commit 8ca6ce8) so
that these items could run in parallel with the alley work — you own it alone.

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

## Now

> ## THE PARK: A DEDICATED PASS, GRADED BY YOU, SKEPTICALLY
>
> The user, in their own words: *"please have like a really dedicated effort
> for the park as a whole. make it look nice i want to be impressed. take
> screenshots yourself and grade it and make sure you are impressed with it.
> be skeptical."*
>
> **That is an instruction about METHOD, and it is the important part.** Ten
> rounds have shipped without the builder looking properly first. So:
>
> 1. **Take your own screenshots** — the loop, the field, the shelter, the
>    gate, each bench, in daylight AND at night AND in rain.
> 2. **Grade each one yourself, skeptically.** Not "is it done" but "would
>    this impress someone who has been disappointed nine times." Write the
>    grades down.
> 3. **Fix what you graded badly.** Re-shoot. Re-grade.
> 4. **Do not report finished until YOU are impressed.** If you are not, say
>    what you could not solve rather than shipping it.
>
> **THE SHELTER, third failure** — `shots/user-shelter3.png`. The roof is a
> hipped pyramid whose eaves do not land on the posts: the corners float past
> them and the posts stand at positions the roof does not acknowledge. A bench
> sits half outside it. My previous ruling stands and its deadline is now:
> **either it is four identical posts on a square plan with ONE roof seated on
> their tops and even overhang, built as a single coherent piece — or it is
> DELETED and replaced with a bench and a tree.** A park with no shelter is
> fine. This is the third pass; do not attempt a fourth.
>
> **GOOD, and worth knowing so you do not undo it:** the path material has
> landed and the buff surface reads properly as a park path. That was the
> biggest single win and it worked. The lamps, the ivy on the walls and the
> boundary shrubs are all reading well too.
>
> Still to do from the earlier ruling: the scattered ground wear comes out;
> the weeds move off the middle of the path to its edges, clustered with bare
> gaps between.
>
> When you are genuinely impressed, tell me, and the auditor will walk it
> independently before it counts.


> ## DESK RULING — STOP ADDING TO THE PARK. FIX THE GROUND FIRST.
>
> **0. REMOVE THE GROUND WEAR. Do this before anything else on this list.**
> `shots/user-parkmud.png` — the user: *"looks like a couple of dirt bikes ran
> through it all."* That is exactly what it looks like: irregular dark brown
> patches scattered across the whole field.
>
> **That is my brief's fault, not yours.** I asked for *"worn dirt on the
> desire lines, a bald patch under the heaviest tree"* and it has been applied
> as random blotches over the entire lawn. A desire line is a COHERENT TRACK
> from somewhere to somewhere — the corner people cut, the line from the gate
> to the bench — not scattered wear.
>
> So: **take the wear out entirely.** Leave clean mown grass. If it wants wear
> later it gets ONE or TWO deliberate tracks between two real destinations,
> and nothing else. Clean grass reads far better than a churned field, and the
> user is asking for effort, which here means restraint.
>
> `shots/user-parkjank.png`. The user: *"so much of this park just looks
> jank."* That is the tenth time they have criticised it, and the pattern in
> those ten is worth naming: **every round has added a feature to a base that
> is still wrong, so each new thing lands on bad ground and reads badly with
> it.** Depth, lamps, topography, stripes, shrubs, weeds, benches, a shelter, a
> memorial, a bandstand — and the path is still made of ROAD.
>
> So: add nothing further until the ground is right. In this order, and commit
> each alone so the user can see it move:
>
> **1. THE PATH MATERIAL.** It is still the same dark asphalt as the
> carriageway, which I flagged as the single biggest win two passes ago and
> which has not landed. A park path is buff hoggin, gravel, or pale slabs — at
> darkest a browner, finer tarmac. It must NOT be the road material. Half of
> what reads as jank in that screenshot is that the park appears to have a
> street running through it. Do this one first and alone.
>
> **2. THE PATH EDGING.** Stark near-white against near-black. Once the path
> tone lifts, the edge should be a quiet kerb, not a stripe.
>
> **3. THE WEEDS ARE IN THE MIDDLE OF THE PATH**, in a line, evenly spaced.
> Nothing grows down the centre of a path people walk on. They belong in the
> joints and at the EDGES, clustered, with bare gaps — as already briefed.
> Right now they make the path look abandoned rather than used.
>
> **4. THE TREE at the right of that shot is enormous and leaning across the
> path**, clipping. Trees are builder B's; measure it and tell me and I will
> route it rather than you reaching into that file.
>
> Then stop and tell me. I will have the auditor walk it before anything else
> is added. **No new features until the user says the park looks right.**


- [ ] **The park: topography, a real loop, and grass that reads as a field.**
      The user: *"park is nicer with trees but i was hoping to get some
      topographical changes. also a loop around the field in the middle would
      be good. also find some way to represent a grass field."*

      The trees landed and they helped. Three things now, and the third is the
      one that will change how the whole space reads.

      **1. Topography.** Everything in this world is dead flat except kerbs and
      steps, and a park is where that stops being acceptable — a bit of ground
      that rises is the cheapest way to make a space feel like somewhere
      rather than a surface. A low mound with a tree or a bench on it, ground
      falling gently toward one corner, a dished area that would puddle. Keep
      it GENTLE: this is a 2D walker and the floor comes from a picker
      (`GOTCHAS.md` §7), so anything you can trip over is a bug. Builder F has
      built the per-site floor registry for the library and church flights —
      use that machinery rather than inventing a second one; ask the desk if
      you need the entry point to consult you.

      **2. A loop AROUND the field.** The brief said this and it has come back,
      so the current path is presumably not reading as a circuit. It must be
      continuous, return to itself, and enclose the open middle — you should
      be able to set off from the gate and arrive back at it without
      retracing. A loop is what makes a small park feel bigger than it is, and
      it is also what gives benches something to face.

      **3. Grass that reads as a field — and there is a specific answer.**
      A flat green plane will never read as grass at ~8 px/m; the texture is
      too small to carry blades. What DOES read, instantly and at any
      distance, is **MOWING STRIPES** — the alternating light and dark bands a
      mower leaves, which every municipal field and sports pitch in the world
      has. Two greens, a band width of a couple of metres, running in one
      consistent direction across the open middle. That single pattern says
      "mown grass field" more clearly than any amount of blade detail, and it
      is exactly the kind of large flat feature this engine is good at.

      Then break it the way real turf is broken: worn dirt on the desire lines
      where people cut the corner, a bald patch under the heaviest tree, the
      stripes stopping where the path or the mound takes over. Municipal and a
      little neglected, like the library — the stripes should look like they
      were cut a fortnight ago, not this morning.

- [ ] **Nothing queued — every item has been verified DONE by the auditor.**
      The park is lit (20 light sources, ten lanterns in three ranks over its
      full bounds), the park is not a yard (42.5 m walkable, 569 meshes), the
      library steps climb (gy 0.42 → 0.99), the churchyard is open, the
      courtyard benches sit, the fanlight is cut to its arch and the name
      reads. All walked, not read.

      If you want work, take a quality pass on what you own — the library, the
      church, the park — and write findings to `notes/E-civic-report.md`
      ranked by **whether a player can see it**, the way
      `notes/AUDIT-TRIAGE.md` does. Do not fix them all; the desk prioritises.

## Done

- [x] Library recessed into a courtyard, steps climbable, benches sittable
- [x] Church inlaid with a churchyard and a walkable flight (gy 0.31 → 0.51)
- [x] Park: 32 m deep, railings you see through, lit, planted, loop path
- [x] Fanlight cropped to the arch; PVBLIC LIBRARY legible from the pavement
- [x] Flagged the 25 m park clamp before it landed, and again after
