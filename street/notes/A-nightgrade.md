# Builder A — nightgrade now fails; and the car lot still has 13

Landed in **`63422e7e`**, `scripts/nightgrade.mjs` only. Nothing else touched;
`ownership.sh A` clean.

## Why I went near it

C's `3a6e0372` withdrew a bug filed twice against `props.ts`, and the rule it
left behind is a good one: **if you set `alphaTest`, do not also set
`transparent`** — a cut-out discards its fragment and never blends, so the flag
buys nothing and costs the material its night grading, because `props.ts:321`
skips transparent materials.

First thing I did was check my own files against it. `tex-world.ts` and
`paint.ts` set neither flag — clean.

Then the note said *"`scripts/nightgrade.mjs` catches it"*. It does not. It
printed four floats and exited 0.

## Three things wrong under that

**1. The class average is not stable.** Identical source, two runs:

```
23:00  alphaCut 0.891      ← first run
23:00  alphaCut 0.670      ← second run, same commit, same build
```

The grade is sampled 1 s after the clock jumps while the world is still moving.
The variance is larger than the effect. It stays as a headline; it is not a test.

**2. The class average cannot see the bug it was written for.** C's fault was
six materials. Over the whole world six vanish into hundreds — it only showed
because C ran it over the lot's own box. Averages hide small true things.

**3. It read the flag at the wrong time.** Sampling `transparent` in a pass of
its own, after the 23:00 probe, reads the night's state rather than what the
module asked for. It reported the same 85 materials whether or not I had changed
the source, while the average moved — both cannot be true. That is what sent me
looking; `park.ts` has five `alphaTest + transparent` literals and deleting all
five changed the count by zero, which is not a possible outcome for an honest
check. Flags are captured inside the noon probe now.

## What the test is

Per material, **cause and symptom together**:

- carries `alphaTest` **and** `transparent`, read at noon
- is inside `dimWorld`'s own reach — its `Math.abs(o.position.x) > 100` rule,
  local x, quirk included, so it cannot report faults that cannot happen
- and **provably does not move** between noon and 23:00

Either half alone cries wolf. Symptom alone flags 494, because most of the world
is never handed to `dimWorld` at all and from outside that is indistinguishable
from being skipped by it.

## It fails only when given a box, and that is deliberate

World-wide it finds **84** and it must not call them 84 bugs. `dimWorld` also
skips `litSeen` and `wetMats`, neither visible from the scene graph, and **a
neon blade sign that stays bright at midnight is correct**. Intent cannot be
read from outside. So world-wide it is a tally and exits 0.

Give it your module's box and it is a verdict, because then someone who knows
the intent is asking:

```
node scripts/nightgrade.mjs 30 60 -105 -90     # the car lot
```

## For C, routed rather than fixed

**The lot's own box exits 1 with 13 today.** `04548554` deleted one flag;
`ct/lot.ts` still has `transparent: true` in eleven places and thirteen cut-outs
in that box stand at full daylight brightness at midnight. The fix closed the
material, not the class. Whether all thirteen are wrong is C's call — some may
be meant to stay lit, and if so they belong in `dimWorld`'s lit set rather than
hidden behind a blend flag.

I did not touch `lot.ts`. Not mine, and C is active in it.

The other 71 are spread across several modules — tall banners (1.24 × 15.80,
1.10 × 14.20), a 6 m sign board, and a lot of small litter planes. Whoever owns
those can run the check over their own box and get an answer instead of a guess.

## Follow-up, landed in `78309300`: it now hands you the box

The section above told owners to "run it over your own box" and gave nobody a
box. Fixed the way that does not rot: clusters are derived from the flagged
positions, not from a table of named regions, and each is printed as a command
with the shapes named so their builder recognises them.

After GOTCHAS 22 landed, world-wide is **26, down from 84**:

```
 13 at 42,-98  1.24x15.80 tex 44x224 / 0.62x0.72 tex 16x20 /+2
     node scripts/nightgrade.mjs 34 50 -101 -94
  4 at 0,-57   0.26x0.22 tex 14x12 / 0.30x0.24 tex 22x16 /+2
     node scripts/nightgrade.mjs -8 8 -71 -45
  … four more
```

The 13 are the car lot and its 15.8 m banners — **still C's, still exiting 1**.
The rest are litter-sized planes along the main street. Six owners, six
commands, no coordinates to look up.

## Then `db76dc26` moved the ground under all of it (`5f958a70`)

`props.ts` fixed **dimWorld's own test** rather than the call sites:
`isGlass = m.transparent && !(m.alphaTest > 0)`. That is the better fix — it
closes the fault for every author at once instead of hunting them one by one.
Measured immediately after it landed:

| | before | after |
|---|---|---|
| world-wide non-dimmers | 26 | **13** |
| `alphaCut` at 23:00 | 0.670 | **0.377** |

And it invalidated my own script, which went on explaining a cost that no longer
exists. That would have made this the third detector this week reporting
confidently on a world that had moved underneath it — this one mine, twice over.
So the two halves are now reported apart:

- **The verdict is GOTCHAS §22 alone** — `alphaTest` with `transparent`. Static,
  no timing, no threshold. `db76dc26` fixed the *dimming* half of §22 and did
  not touch the other half: the sorted transparent queue, where `DoubleSide`
  geometry picks up artifacts it would never have had.
- **The symptom is no longer a verdict.** "Never moved" cannot tell deliberate
  from broken — `litSeen`, `wetMats` and elevation grading are all invisible
  from outside, and a floodlit lot that stays bright at midnight is correct.
  Reported with its numbers, not failed on, and only inside a box: world-wide it
  is 417, which counts everything never handed to the dimmer and answers nothing.

**For C, with the numbers and without a diagnosis:** the car lot box has 22
gradable materials that never move, 13 of which break §22. I am not calling the
22 a bug — I cannot see from outside whether that lot is lit on purpose, and it
was finished in `373940c4`. The 13 are a documented rule violation either way.

## The thing worth remembering

This is the third detector this week that was reporting confidently on something
it could not actually see: `desk.sh`'s two dead greps, the bay camera aimed at
the brick beside the glass, and now a night check that could not fail and read
its input at the wrong hour. The bugs they were meant to catch were real and
mostly still are. **A check nobody has watched fail is not a check** — and the
cheapest way to watch one fail is to break the world on purpose and see whether
it notices.
