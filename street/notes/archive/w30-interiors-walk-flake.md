# Item 58 — the interiors-walk bodega flake, and the blocker in front of it

**Root cause, one line: `hold('w', 2600)` at §5 does not walk a distance, it
walks however far the frame budget got through — and §5 starts 0.9 m from a door
whose way-out spot has `r = 1.4`, so on a fast frame budget the player walks out
of the FAR side of the trigger and the prompt is gone when it is read.**

Fixed in `scripts/interiors-walk.mjs` (new `holdUntil`, used at §5). Port
**4193** (dev), proved free before use and shut down after.

**Item 58 is NOT fully closed** — see the blocker at the bottom. The cause is
named and fixed and the fix is proven, but the DONE WHEN's *"the check passes 10
consecutive runs"* cannot be executed today, for a reason unrelated to the flake.

---

## The failure shape said it was one bug, not six

w24 measured the failures as `0, 0, 6, 0` and `0, 0, 0, 6` — **six checks failing
together in one run and none in the other three**. Six independent flakes do not
cluster like that. §5 is exactly that shape:

```
:801   await hold('w', 2600);          <- fixed wall-clock walk to the door
:802   const dPrompt = await prompt();
:803   check('… raises the way-out prompt', …)
:806   await press();                  <- a NO-OP if the prompt is not up
:807   const back = await pos();       <- so this is still an INTERIOR position
```

…and then *"E at the inside door puts you back on the street"*, *"you land on the
raised walk"*, the re-entry-trigger check, the second-`E` check and all three
*"the landing is not boxed in"* legs every one read that interior position. One
missing prompt fails six checks.

## Measured, not reasoned — and it inverts the item's guess

`scripts/probes/w30-iw-wayout-flake.mjs` replicates §5's leg exactly (door stand
and room dims read from the live world, `approachHeading` imported from the same
`lib/viewof.mjs` the suite uses rather than retyped — the file's own banner says
never to retype it). 10 runs per cell:

| | CPU x1 | CPU x8 | distance walked |
|---|---|---|---|
| `hold('w', 2600)` as it stood | **8/10** | 10/10 | 0.78 – 1.72 m |
| settle on the prompt (the fix) | **10/10** | **10/10** | 0.33 – 0.53 m |
| mutation: settle on an impossible condition | 5/10 | 10/10 | 0.80 – 1.80 m |

Across both x1 cells of the old behaviour: **7 failures in 20**, consistent with
w24's *"1 run in 4"*.

**The item guessed "a fixed wall-clock wait under load". The wait is right; the
load is backwards.** Under CPU throttle x8 the old code passed **10/10** — and
always walked exactly 0.83 m. Throttling makes the player travel *less*, so it
cannot reach the far side of the trigger. This is the opposite sign to item 50's
`jump-walk.mjs`, which a slow frame **truncated**. **Throttling is not a worst
case for a wall-clock wait, it is just a different case** — and had I only run
the DONE WHEN's throttled runs, this bug would have passed 10/10 and I would have
reported it fixed without touching it.

The 1.4 m is not typed anywhere in my work: it is `ct/interior.ts:1255`,
`r: CH ? 1.4 : 1.0`, *"1.4 on a cut face, 1.0 on a flat one"*.

## The fix, and why it is not a loosening

`holdUntil(key, ready, capMs)` holds the key and stops when the world satisfies
`ready`, with wall-clock only as an upper bound on patience. §5 now walks at the
door until the way-out prompt is actually up.

**The assertion is unchanged.** `check()` still reads the live prompt afterwards
and still goes red if it never appeared. What changed is only that the walk stops
carrying the player back out of the trigger it just entered.

**Mutation-tested, and it is the mutation that matters here:** given a condition
the world can never satisfy, `holdUntil` degrades to the full 2600 ms cap and the
check **still fails 5/10** — so it cannot manufacture a pass. A "fix" to a flaky
check that made the check unable to go red would be the worse bug, and that is
the thing this project has a documented family of.

## THE BLOCKER — `interiors-walk` cannot run at all, for any room

```
the world publishes rooms this suite does not test: apt301
refusing to report on a subset and call it the world — see GOTCHAS 34
```

- `apt301` was added to the room registry **today**, `23e7dcb3b` *"Register flat
  301 in the room registry, so seat-facing can see its seat"*, and is an ancestor
  of both my HEAD and `add-stick-and-city98`. This is mainline, not my worktree.
- The coverage guard exits **2**, and `scripts/checks.mjs:1051` renders any
  non-zero status as `FAILED (n)`. So **`interiors-walk` is a live red check on
  mainline right now** — correctly red, and the guard is doing its job, but
  somebody should know it is not a flake this time.
- So item 58's *"passes 10 consecutive runs under CPU throttle x8"* is not
  executable today. My fix is downstream of the guard and unreachable until
  `apt301` is in `ROOMS`.

**I did not add it, and this is the judgement call worth arguing with.** Every
entry in `ROOMS` gets the full street-approach treatment — there is no
"reached from inside" flag; the loop's only per-room switches are `chamfer`,
`sideStreet`, `east`, `aisles`, `keeper`, `minMeshes`. `apt301` has **no street
door at all**: `ct/doors.ts` does not declare it, it is off the belt at
`y = 2 * ST` (floor 3), and its door is internal to the stairwell
(`ct/apartment.ts:1606`). Dropping it into `ROOMS` would manufacture a wall of
false failures; giving it real coverage means teaching the suite an
inside-reached mode and walking it up w28's staircase. **That is a feature, not
this item**, and doing it inside a flake fix is how a guard gets a hole punched
in it with a comment on top.

## Found and NOT fixed — for the desk

1. **Queue "add apt301 to interiors-walk's ROOMS" ahead of re-running item 58.**
   It is the only thing between the fix above and its acceptance test. It needs a
   decision on whether a non-street room joins this suite or gets an explicit,
   documented abstention plus a named check that does cover it (today: only
   `seat-facing`, for its seat, plus the uncalled probe
   `scripts/probes/apt301-walk-the-rect.mjs`).
2. **`interiors-walk.mjs:838-840` states something false**, and I left the code
   alone: *"crowd and traffic actors are NOT in `__ct.colliders()`, so 'is
   anything in the way' is unanswerable from the array this script reads."*
   **They are.** `ct/crowd.ts:168` calls `o.solid(box)` on every citizen, and
   `__ct.colliders()` (`crosstown.ts:1094`, `colliders: () => colliders`) returns
   the live array by reference — I measured six moving 0.5 × 0.5 citizen boxes in
   it on item 57 (`scripts/probes/w30-trap57-moving.mjs`). That comment is the
   stated reason the landing check is a 3-attempt retry instead of a deterministic
   wait, and the question **is** answerable, so that check could stop being
   probabilistic. I did not do it: the retry works, it is not the cause I
   measured, and widening this item's diff on an unmeasured hunch is the thing
   the brief warns about.
3. **The other fixed waits in §5 were not audited.** I fixed the one that cascades.
   `hold('w', 2000)` in the landing legs and `hold('w', 2600)` in the §1 approach
   are the same pattern and could carry the same overshoot; they did not show up
   because the block fails before reaching them. Same repair if they do.
4. **`w30-iw-flake.sh`** captures a run's exit status *before* piping, because
   `$?` after a pipeline is the last command's status. Worth copying — I watched
   `… | tail -5; echo $?` report 0 for a run that exited 2 while writing this.

## Housekeeping

`node --check scripts/interiors-walk.mjs` parses. No `src/` file was changed, so
the world is untouched and `fp before/after` has no diff to be a diff of. The
suite's own end-to-end run is blocked as described above, so the evidence for the
fix is the probe table, which measures the identical leg.
