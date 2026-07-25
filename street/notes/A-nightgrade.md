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

~~The 13 are the car lot and its 15.8 m banners — still C's.~~ **WRONG, and it
was mine.** See the correction below: they are `ct/vice.ts`. Six owners, six
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

**~~For C:~~ CORRECTED — see below; the 13 are `ct/vice.ts`.** The box has 22
gradable materials that never move, 13 of which break §22. I am not calling the
22 a bug — I cannot see from outside whether that lot is lit on purpose, and it
was finished in `373940c4`. The 13 are a documented rule violation either way.

## `8e473276` closed the guessing half (`5c813dac`)

props.ts now stamps `userData.selfLit` on sheets it grades and **deliberately
keeps bright**, and its commit message says why: this script was handing its
owner *"thirteen tickets for a neon sign and eleven lit window panels doing
exactly what the user asked for — Lit windows and signs must NOT dim with it."*

That is the right fix on the right side of the wall. From outside, "kept bright
on purpose" and "never graded at all" are the same picture; only the module
doing the grading knows which. So the check reads the stamp now:

| box | before | after |
|---|---|---|
| car lot | 22 unexplained | **7** |
| main street | 10 | 10 — nothing there is stamped |

## One line would make this a verdict instead of a report

Still reported and **not failed on**, because two things stay invisible:

- **`wetMats`** — `updateRain` owns them and nothing marks them
- **graded-but-unchanged vs never-handed-to-`dimWorld`** — indistinguishable
  from outside, and most of the world is the latter. That is the whole reason
  the un-boxed number is 417 and answers nothing.

**Request, for whoever owns `props.ts`:** stamp `m.userData.graded = true` where
`dimWorld` actually writes a colour. One line, symmetrical with the `selfLit`
stamp you just added. With it, "was offered to the dimmer and did not move" is
decidable and this check can fail honestly instead of printing a number and
leaving the judgement to a human — which is the state it was in when I found it.

Not blocking me; I have not filed it in `BLOCKED-A.md`.

## CORRECTION: the 13 were never the car lot (`c6ed1c9c`)

C published `LOT.bounds` and checked: the lot's own box has **0**. The thirteen
are **`ct/vice.ts`** — one shared material factory at line 329 setting
`transparent: true` with `alphaTest: 0.35`, feeding the blade signs and
marquees. I verified that myself before repeating it, having already got it
wrong once.

**The tool was right and my prose was wrong.** It printed `34 50 -101 -94`,
which is where the materials are. I looked at it, said "that's the car lot", and
put that name in a note and a commit message. `ct/lot.ts`'s office board is at
x 26.07, z 2.6 — nowhere near it.

That is the remembered-coordinate habit twice in one week, and both times the
constant looked authoritative *because a tool printed it*. The bay camera was
the same shape: three numbers, correct once, trusted long after.

So clusters now print `(unattributed)` unless a module claims the ground, and
the closing text says a cluster is a **location, not an owner**. Attribution
reads `globalThis.__bounds` — `{ name, minX, maxX, minZ, maxZ }` — which is
empty until modules opt in. **No name is better than a name inferred by eye.**

`ct/lot.ts` already publishes `LOT.bounds` for exactly this reason; pushing it
to the registry is one line and the check will name it.

**Routed to whoever owns `ct/vice.ts`, not C.** — and then **DOWNGRADED**, see
below: they are FrontSide, so nobody should be paged for them.

## `cf966b3d` beat my proposal, and the check now reads it (`b9c0e163`)

I proposed `globalThis.__bounds` — modules publish their box, the checker looks
you up. C did something better: **`userData.mod` on all 404 objects `ct/lot.ts`
adds.**

A box is still geography. It is right only while a module's things stay inside
it *and* stay alone in it. A stamp is identity, so it survives being scattered,
moved, or interleaved with someone else's work — which is exactly the case that
misrouted this finding three times.

So attribution asks the objects first, walking up for an inherited mark, and
falls back to a published box only if nothing is stamped. Neither → still
`(unattributed)`.

**Verified rather than assumed:** 373 of 3369 meshes resolve to `'lot'` through
the walk-up. My first probe returned **zero**, and I nearly reported that as the
stamp not reaching the scene — it was testing a **stale `dist`**. One rebuild
and it was 373. Worth recording because it is the same failure as everything
else in this note: the tool was fine and the world it was looking at was old.

No flagged cluster currently sits in lot territory, so the label path is proven
at the data level and not yet exercised in live output. The thirteen still read
`(unattributed)` because `ct/vice.ts` has not stamped.

**The pattern now has three instances**, all one field, all set by the module
that knows the answer: `userData.selfLit` (props), `userData.mod` (lot), and
`declareDoorWorld` (rooms → my painter). Each replaced something a tool outside
was guessing at.

## It fails honestly now — 417 unknowns down to one (`8c0a0ba7`)

`6ced1c20` granted the request above: props.ts stamps `userData.graded` on every
material it writes a colour to, **and** `userData.wet` on the registry
`updateRain` owns. That was the last thing this check could not see.

Every clause is now somebody's own mark, and nothing is inferred:

| clause | whose mark | commit |
|---|---|---|
| `graded` — a colour was written here | props.ts | `6ced1c20` |
| not `wet` — updateRain owns its own curve | props.ts | `6ced1c20` |
| not `selfLit` — kept bright on purpose | props.ts | `8e473276` |
| not additive, not black, unchanged at 23:00 | measured | — |

**World-wide that is one material, and the check now fails on it without a box.**
The 456 never offered to the dimmer are printed as *scope*, not as faults.

The one: `3.90 x 0.12`, untextured, colour 0.079, at **−32.8, 3.1, −83.8**.
Reported as a candidate, not asserted as a bug — but the innocent explanation
was tested and does not hold. `dimWorld` grades by elevation, so a factor of ~1
at that height would explain it; of **71 graded materials within 0.6 m of that
height, 56 do move**. Its neighbours dim and it does not.

### ~~Identified: it is the park shelter's roof~~ — WITHDRAWN, I was wrong

**`b93cc2b1` found the real cause and it is not park.ts's to fix.** The material
is a park rail **3.29 m from a lantern**. The lamp pool caps the grade at
daylight, so it is graded, rewritten every frame, and unchanged — which from
outside is identical to never having been touched. props.ts now stamps
`userData.poolLit`, and with that read, **nightgrade is 0 and exits clean**.

My diagnosis below was wrong. I reasoned from a shared `roofM` and from
`dimWorld` grading once by the first mesh's **elevation** — and the cause is
**horizontal**, which no elevation argument could ever have reached. I did mark
it "likely mechanism, not asserted", and it was still wrong, and `ct/park.ts`
should not have been pointed at. The original reasoning is kept below because
being able to see how a wrong diagnosis looked reasonable is worth more than a
tidy note.

**And I made the file's own mistake a second time.** My first attempt read
`poolLit` from the NOON probe and nothing changed — at noon the lamps are off,
so the flag is not set on anything yet. That is the same error as reading
`transparent` at 23:00 and getting the night's state instead of the module's
intent. *A flag is only true at the hour that makes it true.* It is now written
beside the line rather than learned a third time.

### The original, wrong reasoning



The check printed `(unattributed)` because nothing there carries a
`userData.mod`, so I traced it rather than leave a finding nobody owns.

It is **two** `3.90 x 0.12` boxes sharing **one** material — which is why one
uuid stood for both:

```
ct/park.ts:704   const postM = new THREE.MeshBasicMaterial({ color: 0x5a4a34 });
ct/park.ts:705   const roofM = new THREE.MeshBasicMaterial({ color: 0x4a4e56 });  ← this one
```

Colour `#4a4e56` at −32.8, 3.1, −83.8 and −32.8, 3.1, −82.3. **The shelter's own
posts, 0.4 m below it, do dim** — `postM` was graded and moved. The roof did not.

**Likely mechanism, not asserted:** `dimWorld` grades a material ONCE, by the
first mesh's elevation. That is a documented footgun — my own
`ct/tex-world.ts:709` says *"Separate material instances on purpose"* for
exactly this reason. A single `roofM` shared across shelters takes its grade
from whichever roof happened to be built first, and every other roof inherits
it. If that is the cause, the fix is the same one tex-world.ts already applies:
an instance per shelter rather than one shared.

**Routed to whoever owns `ct/park.ts`.** I have not touched it.

## Retraction: vice.ts should not have been paged either (`d6eacfa5`)

§22 has **two** costs, and I went on failing on both after one was fixed
underneath me:

| cost | state |
|---|---|
| the dimmer skip | **fixed at the source** by `db76dc26` (`isGlass`) |
| the transparent queue | still live — but the harm §22 names is **DoubleSide** geometry picking up sorting artifacts |

Measured: of the flag-pair materials inside `dimWorld`'s reach, **14 are
FrontSide and zero are DoubleSide.** `ct/vice.ts:329` — which owns thirteen of
them — is `side: THREE.FrontSide`. The build was failing and handing that module
thirteen tickets for a harm that cannot occur in its case.

That is the same mistake `8e473276` corrected me for once already: *"handing its
owner thirteen tickets for a neon sign."* Thirteen again, same module, a
different wrong reason.

So the pair now fails only where the harm is real — DoubleSide, today zero. The
FrontSide ones are listed as the rule violation they are, and the judgement is
left with whoever knows why the flag is there. Still worth deleting; not worth
paging anyone.

The build still exits 1 — on the park shelter roof, the one finding that
survives every exemption.

## The arc of this file, which is the actual point

```
417 materials "never moved"   — a number nobody could act on
 84 with the flag pair        — cause and symptom agreed, but the cause went away
 26 after dimWorld's own fix  — the right fix, on the right side
 13 after selfLit             — and those 13 were mine to misroute
  1 after graded + wet        — located, described, one owner to ask
```

Every step down came from a module stamping what only it knew, **not** from this
script getting cleverer. The script's whole contribution was asking the right
question and then refusing to answer it on evidence it did not have.

## The thing worth remembering

This is the third detector this week that was reporting confidently on something
it could not actually see: `desk.sh`'s two dead greps, the bay camera aimed at
the brick beside the glass, and now a night check that could not fail and read
its input at the wrong hour. The bugs they were meant to catch were real and
mostly still are. **A check nobody has watched fail is not a check** — and the
cheapest way to watch one fail is to break the world on purpose and see whether
it notices.

## `nightgrade` skips multi-material meshes — found chasing someone else's finding

`9c1b4e21` swept all 24 hours and found material colours multiplying past white
on the dawn and dusk ramps, routing the persistent ones to me: *"The 9 that
persist all night are not mine: unstamped, in the park's region, nightgrade's
question."*

I added an out-of-range count to `nightgrade` and it reported **0**. The
materials are real — measured directly:

```
23:00   over 1.0: 3    worst 1.149
03:00   over 1.0: 3    worst 1.149
19:00   over 1.0: 74   worst 1.092
07:00   over 1.0: 76   worst 1.080
```

**The difference is `nightgrade`'s own probe.** It collects with

```js
const m = o.material; if (!m || Array.isArray(m) || !m.color) return;
```

so every **multi-material mesh is skipped entirely** — and a box with six
materials is exactly how the walls, bands and castings are built. That is a
coverage gap in my check that has been there since I wrote it, and it is why my
count came back 0 while a probe that walks all materials finds 3.

**I reverted the addition rather than ship a line that reads 0 on a world where
the answer is 3.** A number that is wrong in the reassuring direction is the
worst thing this file could print.

**Fixed in `0c4f7570`.** The collector walks the material array now.

```
materials never offered to the dimmer   456 -> 599     (+143 previously unseen)
graded and did not move                 0, unchanged
GOTCHAS 22 flag pairs                   13 -> 14
--selftest                              still catches its unexcused material
```

**The headline was re-established, not assumed.** Widening a check's population
can turn a clean result into a false one, so *"0 graded materials did not move"*
was re-measured against the larger set rather than inherited from the smaller.
It held.

### Still open: the out-of-range count reads 0 against a measured 3

With the collector fixed, the report that started all this **still reads 0**
while a direct probe finds 3 at 23:00 (worst 1.149) and 74 at 19:00. I do not
know why, and I did not ship it.

**Twice now I have nearly published a count that was wrong in the reassuring
direction on this exact question.** A third would be careless rather than
unlucky, so the next person — or I, with room — should start from the probe that
works:

```js
s.traverse(o => { for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
  if (!m?.color) continue;
  if (Math.max(m.color.r, m.color.g, m.color.b) > 1.001) …
}});
```

That finds them. The same expression inside `nightgrade`'s probe does not, which
means the difference is in the probe's surroundings — the BOX filter, the
`each[m.uuid]` first-write, or the hour the flags are read at — and **not** in
the test itself.
