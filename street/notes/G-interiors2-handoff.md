# Builder G — handoff

Working from `notes/queues/G-interiors2.md`: read it, take the top unchecked
item under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here.

Prep done while blocked on F is in `notes/G-interiors2-prep.md`; the street-side
door numbers used below were derived and walked there.

---

## READ THIS FIRST — what is current, what is closed

This file is **chronological and long**. It is a record of runs, not a status
page, and several sections are superseded in place rather than deleted. Someone
else's `f214cf76` made the case for an index; this is mine.

**State: all eight queue items are delivered and landed.** `notes/queues/G-interiors2.md`
still shows them unchecked and `## Done` still reads *"nothing yet — you are new"*;
that is the desk's bookkeeping, and the map from each item to its commit is in
**"Every item in `notes/queues/G-interiors2.md`, and where it landed"** below.

**Verification, at current mainline:** `G-rooms-walk` 109/109, `G-vice-walk` 18/18,
`doors-declared` 8 of 8 in the built bundle, ownership clean. Both suites run
against a `vite preview` of `dist` as well as the dev server — see §5 for why that
matters more than it sounds.

### My other notes

| file | what it is |
|---|---|
| `G-interiors2-prep.md` | the door numbers derived and walked before the kit landed |
| `G-vice-shots.mjs` (script) | day **and night** views of the two buildings, for LOOKING |
| `G-offer-interiors-walk.md` | **live offer to F** — two lines that let `interiors-walk` run against `dist` |
| `G-casino-door-fix.md` | **superseded.** Kept only for two negative results that rule out obvious fixes |

### Sections below that are NOT current — do not act on them

- **"FOR F — the room needs three lines in `crosstown.ts`"** and **"BLOCKED ON TWO
  OTHER PEOPLE" §1** — both **resolved and stale**. Rooms are auto-discovered now
  (`ct/interior.ts:136`, `import.meta.glob('./int-*.ts')`), so no hand-wiring is
  needed and none exists. Checked before writing this, not assumed.
- **§5** — a correction I filed against A that was **wrong**; I had measured the
  dev server, which cannot reproduce the defect. Read the retraction, not the claim.
- **§7** — **answered** by C in `38a6e78e`. The three measurements do reconcile.

### What my suites demonstrably CATCH — mutation-tested, not assumed

Following `31865213`, which mutation-tested its three probes and found two were
not fine. Every row here was run: the source was broken, the suite was run, and
the output read. **A check nobody has ever made fail is a claim, not a guard.**

| mutation | result |
|---|---|
| casino ceiling `h` 2.9 → 1.8 | **CAUGHT** — "the 1.8 m ceiling clears the eye, eye y=1.62", plus a kit warning that the door no longer fits |
| doorway `at` −3.2 → +2.0 (walk table still says −3.2) | **CAUGHT** — four checks, led by "walking to the inside of the door raises the way-out prompt: prompt=null". The way-out spot travels with the doorway, so a stale table finds nothing |
| doorway `width` 1.15 → 3.0 | **not a mutation.** Stop unchanged at z 4.32 — see below |
| doorway `width` 1.15 → 5.0 | **not a mutation.** The kit rejects it and builds no door at all |
| pawn `minDepth` bar 2.0 → 3.5 | CAUGHT, 2.68 m |
| casino given a `window` | CAUGHT, "1 glazed pane 3×1.4" |
| chase frozen (`step = 0`) | CAUGHT, "0 of 4 changed" |
| dead bulbs removed, chase running | CAUGHT, "0 permanently dark" |
| blade rear texture mirrored (pixels) | CAUGHT, "61.4% identical" |
| blade rear texture mirrored (`repeat.x = -1`) | CAUGHT, "MIRRORED BY TRANSFORM" |
| runtime `./doors` import restored | CAUGHT by source, while every behavioural check stayed green |
| casino standoff 0.75 → 1.00 | CAUGHT by the exactness check; **all 28 walking checks passed** |
| a no-go probe aimed at open floor | CAUGHT, walked 5.19 m |
| a 1 m collider across the side-street walk | CAUGHT, four frontage checks |

**The two "not a mutation" rows are the useful ones.** Widening the door proves
the doorway is not a hole — the kit closes it with its own collider 0.18 m proud
of the wall — so that check guards the kit's collider, not a gap, and its comment
said otherwise until `df02aeb6`. And a 5 m door is rejected outright, so the suite
goes green for a reason unconnected to the question. **A mutation that does not
build is not a test.**

### The jumped clock does not affect my numbers — re-measured after `3d71b035`

D found a jumped clock gives a night **7.4% brighter** than the one a player
walks into, because the wall-splash sheets only arm if the clock passes through
20:00, and said it affects everyone re-measuring night numbers this round. Every
figure I have published — the 3.12 spill total, the 0.58/0.5/0.34/0.42/0.7/0.58
set — came off a jumped clock, so they needed re-taking rather than defending.

```
JUMPED  13 → 23                 night 1   total 3.12
STEPPED 13 → 18 → 20 → 23       night 1   total 3.12
JUMPED  13 → 0  (wet night)     night 1   total 3.12
STEPPED 13 → 18 → 20 → 23 → 0   night 1   total 3.12
```

**Identical to three decimals, all four.** So the numbers in these notes describe
the night the player reaches, and `G-vice-walk` does not need a stepped clock.

**CORRECTED — that was true of the spill and I stated it too broadly.**
`ccc4d6be` then narrowed the 7.4% to 305 materials across six modules and listed
`vice` among them, at 122. I had measured the six ground sheets and written as
though I had measured the buildings. Re-measured across everything `vice` owns:

```
vice materials compared            56
  identical jumped vs stepped      45
  differ, graded by props          11
  differ, driven by my ticks        0
```

**Nothing I drive is path-dependent; eleven things props grades for me are.** Ten
of those are a single least-significant bit — `#090403 → #080403` — and the
eleventh is a chase bulb caught at a different point in its cycle, which is
animation rather than the clock. So the correction does not change any published
figure, but the claim needed narrowing: *my* numbers are path-independent, not
*these buildings'*.

Two numbers of D's I cannot reproduce and am not disputing: they count 122 where
I count 56 — the same denominator problem as the 78-vs-22 in §"ANSWERING D's
routing", one chase material being shared by ~61 bulbs — and they report a colour
delta of +0.09 where the largest I see is about 1/255. Different hours or a
different aggregate, most likely. **Worth reconciling before either number is
quoted anywhere.**

The reason is worth keeping, because it is an argument for the change rather than
luck: since `5d2c5c9`-era this chain reads the **published** `nightFactor`, a
scalar props recomputes from absolute time every frame. A published number has no
history. The heuristic it replaced read `scene.background`, which is exactly the
kind of state that can carry one — the same class of path-dependence D found in
the splash sheets. **Asking instead of inferring bought robustness I was not
aiming at.**

### The runner soaks at NIGHT too — and two traps for anyone measuring wet

I verified the entrance runner at 15:00, which is daylight rain, and the brief's
image is a **wet night**. `c68f09f5` reports the night wet-look is narrower than
`fd74b028` claimed, so this needed measuring rather than extrapolating. Fresh page
per row, stepped clock:

```
                       night  wetness   runner           walk     road
day dry     13         0      0.000     #7a2028 0.0532   1.0000   1.0000
day rain    13→15      0      0.973     #5e2028 0.0354   0.7970   0.1765
night dry   →19→21→23  1      0.000     #170203 0.0024   0.0450   0.0450
night rain  →23→0      1      0.703     #130203 0.0019   0.0406   0.0139
```

**It responds** — so the fix holds in the conditions the brief actually describes.

**CORRECTED: that −21% was under-settled. The runner is −35%.** The rainy-night
sample above reached `wetness 0.709`, not 1.0, and `wSurf = wetness^1.7` makes
0.709 about half the full effect. Letting the last step soak 14 s instead of 2.2 s
puts wetness at 0.999 and the runner at **0.0024 → 0.00156, −35%**. Every
percentage in the block above is therefore a lower bound, not a measurement.

Re-measured properly across the whole wet registry, dry night vs rainy night:

```
51 of 65 registered surfaces      about -83.5%
14 respond less: twelve 2.7×4.3 sheets -69%, the runner -35%, one strip -28%
```

**51 matches `c68f09f5`'s 51 exactly**, which is the reassuring part — two
instruments, one number.

**And it settles a claim I was about to question.** `f9d326cd` says every
registered surface "responds at night at exactly the daytime strength". My runner
is day **−34%**, night **−35%** — the same strength, once measured at plateau. I
nearly filed the gap between −34% and −21% as a counter-example when it was my own
settle time. The runner sits below the −83.5% norm for a different and correct
reason: the per-channel clamp `e24c959a` added means a surface **darker than
`WET`** cannot be pulled all the way to it, and this one is.

**Trap 1 — the stepped clock soaks the world.** `rainAt` fires on 0, 1, 5, 6, 10,
11, 15 and **20**, and the recommended night path steps *through* 20. My first
"night dry" control came back at **wetness 1.0**: not dry at all, just rained on
an hour earlier and still drying. A dry night needs a path that avoids 20 —
13 → 18 → 19 → 21 → 23 works.

**Trap 2 — wetness has hysteresis, so rows contaminate each other.** Running the
four rows in one page gave "night dry" at **0.958**, carried over from the rain
row two steps earlier: props dries deliberately slowly, and no plausible settle
time undoes it. A fresh page per row fixes it. **Sequential measurement of a state
with memory needs a fresh world, not a longer wait** — and both of my first two
attempts read as findings about the world rather than about the probe.

### GOTCHAS §23 in my four rooms: two keepers were wrong, nothing else is

The user found the tax preparer facing away and asked me to check the other
three. **Two of four were backwards** — preparer and pawnbroker, both at
`facing: Math.PI`, both facing their back wall — and both carried the *same
copied sentence* asserting that PI pointed the other way. Fixed in `15f86d64`,
all four now derived from what they serve. The comment is the part worth
remembering: it was copied along with the constant, and it is why two readings
missed the bug.

**Then swept the rooms for the rest of the class**, since §23 is "anything with a
front", not "anything with a face". Every box whose six materials are not all the
same, asking whether the odd face has something solid 0.5 m in front of it:

```
GOLDEN ACES    36 fronted boxes, 0 facing into something
HOTEL ORPHEUS   0
PAWN            4 fronted boxes, 2 flagged — FALSE POSITIVE
A-1 TAX         0
```

The two flagged are the bottom of a four-TV stack against the pawn shop's back
wall, screens out. What sits 0.5 m in front of them is **the counter**, which is
where a pawn shop's stock is supposed to be — you look at it over the counter,
and the top two TVs clear it and are not flagged. **"Blocked" is not "backwards"
when the blocker is a thing you are meant to see past**, which is the limit of
this probe and the reason it is written down rather than turned into a check.

The casino's 36 are the slot cabinets, and they were already right by
construction: `rotation.y` derives from the same `face` variable that positions
each row, so both rows of a back-to-back bank face their own aisle. That is what
§23 asks for, written before §23 existed.

### My checks do not make the tint-vs-appearance mistake — swept after `114c5bef7`

`MeshBasicMaterial.color` is a tint, white by default, so comparing a flat
material's colour with a textured one's is comparing a colour to a placeholder. I
made that error in prose twice (withdrawn in `8ed8f34bc`, resolved in
`99a6a5d0c`), so the suites needed sweeping for it too. Every colour reading in
both:

| where | what it does | sound? |
|---|---|---|
| `the room keeps its own light after dark` | same materials by index, noon vs night | **delta** ✓ |
| `the brick and stone DO go dark after dark` | same materials, 13:00 vs 02:00 | **delta** ✓ |
| `the chase RUNS` / `some bulbs never light` | luminance ACROSS materials | flat vs flat ✓ |
| the spill and window checks | opacity and pane counts, not colour | n/a ✓ |

The chase one is the only cross-material comparison, and it is safe for a reason
worth stating rather than assuming: `phaseM` and `deadM` are both
`MeshBasicMaterial({ color })` with **no map** (`ct/vice.ts:444-446`), so their
colours are their appearance and comparing them is like with like.

**Re-checked after `f29e7355e`**, which withdrew a *ground-vs-ground* comparison
its author had called sound — *"two different grounds at one instant share
nothing of the kind"*, road texMean 0.2401 against walk 0.4162 on identical
tints. That is the neighbouring error to mine and it lands one line from where
they were correcting themselves about tints, so it was worth not taking my own
word for it.

It does not reach the chase check. Their pair is textured-vs-textured with
*different* textures, so the tints hide a real gap; mine is flat-vs-flat with **no
texture on either side**, so there is nothing to hide. Verified at source rather
than from the constructor call: the only `.map =` assignments in `ct/vice.ts` are
`hazeM` and `lowM` at 1045 and 1053, neither of them a bulb. **Give a bulb a
texture and this stops being true**, which is why the condition is written down.

**Clean — nothing to change.** Third time I have swept my own instruments against
a fault someone else published this session, and the first time the answer was
already right.

### Deleted `G-approach.mjs` and `G-lane.mjs`, and what they were still saying

Auditing my own scripts after `643ceddd9` turned up two I had forgotten: early
diagnostics from before `G-rooms-walk` and `G-vice-walk` existed. Neither is
registered, and **neither has a `--selftest`, so `checks-registered` cannot even
see them** — worse than the red it flags for the other two, because a silent
never-run script looks like nothing at all.

Both were superseded: `G-approach`'s job (the `[E]` spot must be REACHED, not
warped onto) is `G-rooms-walk`'s prompt/enter/exactness checks, and `G-lane`'s is
the registered `builtlane` plus the band measurement in `G-vice-walk`.

**`G-lane` was also actively misleading, which is why this is a deletion rather
than a shrug.** It still runs, and reports three of four side-street lanes
`STUCK at x ≈ 19.4`. That reads as a blocked pavement. Measured with static
colliders instead:

```
x 19.8..20.2   z -97.85..-97.45     one 0.4 m post
```

Real and static — not a citizen — but it leaves a **0.61 m clear centre band**
against the 0.23 m the lane audit accepts. Passable, and 13 m west of my nearest
building. `G-lane` says STUCK because it reports per-lane blockage without ever
computing the band, which is exactly the flaw `G-vice-walk`'s band check was
rewritten to remove. A script that shouts about a sound pavement, that nobody
runs and no tool can see, is a trap for whoever runs it next.

### Every enumerated brief item, checked against what is built

A class I had never verified: the queue items **list content**, and I had checked
structure, collision, facing and lighting without once asking whether the objects
named are there. Swept all four:

| room | the brief asks for | built |
|---|---|---|
| hotel | tile floor, vinyl patch, reception desk, key rack, pigeonholes, dead palm, mismatched chairs, lift with a floor dial, rate card, **one lamp out** | all 11 |
| casino | patterned carpet, **mirrored panels**, slot banks in rows, one felt table, a cage with a grille, **no clock**, no daylight | all 7 |
| pawn | bars inside the window, guitars, brass, glass case with rings and watches, wall of tools, TV stack, everything tagged | all 8 |
| tax | two desks with a client chair each, filing cabinets, fake plant, **a wall clock**, pinboard of IRS notices, strip lighting | all 6 |

**Two of them are the same requirement pointing opposite ways**, and both hold: the
tax office has a wall clock and the casino has none. The casino brief's whole idea
is that you cannot tell the time in there.

Two were measured rather than grepped, because a mention in source is not a built
object: the hotel's **four ceiling fittings, one markedly darker** (`#e0cf9a` ×3,
`#6e6a62` ×1) and its **three mismatched seat pads** — which is right, since "four
matched lobby chairs" is what the room *used* to have.

Only one is guarded by a check, and deliberately: **"one lamp out"**, because it is
a single deliberate defect that a refactor erases in passing. The rest are objects
whose absence would be obvious the moment anyone walked in.

### Checked and clean, so nobody re-checks it

**The side-street terrace junctions**, prompted by `1337cba1` going after a seam
nobody owned. Where my two buildings meet their neighbours and each other:

```
street | vice   at x = 33.45   flush     (hotel meets its west neighbour)
vice   | vice   at x = 45.45   flush     (hotel meets the casino)
```

No gap, no overlap, front faces coplanar at z = −96. East of the casino the
terrace continues into the next brick block, so the walk does not run out into an
open world edge — looked at, day and night, not inferred. `ct/rng.ts`'s comment
says the fog was tuned for a side street "which runs to x=55" and the casino
reaches 57; that is 2 m of slack, and nothing shows.

One caveat on the method, since the numbers above came out of a probe I threw
away: each building contributes both a wall box and a shopfront band, so a naive
sort-and-compare reports a dozen "overlaps" that are one building counted twice,
and the 0.16 m porte-cochère posts show as "gaps". The three junction readings are
the part that survived reading the output properly.

### ANSWERING D's routing: the 78 un-graded `vice` materials are all intentional

`e91df374` swept the world for the glowing-graffiti signature and routed one item
to me: *"G (`vice`, 78) — most likely the casino neon and correct. Worth
confirming rather than assuming, because 78 is a lot to be certain about by eye."*
Confirmed, by enumeration rather than by eye. **Nothing in the graffiti class.**

Every material `props.ts` skips on these two buildings, at 23:00, sampled twice so
the tick-driven ones reveal themselves by changing:

| what | materials | mesh-slots | verdict |
|---|---|---|---|
| additive glow sheets | 10 | 10 | the pavement spill and the two haze sheets — the whole point of the pair |
| tick-driven | 2 | 122 | chase phases, recoloured every frame |
| static, part-opacity | 2 | 72 | the third chase phase caught mid-cycle, and the **8 lit hotel windows** (`vice.ts`: *"every window lit is a full one. Eight is losing money"*) |
| static, full opacity | 8 | 15 | the vertical neon tubes (0.22 × 12.85 and 0.22 × 14.7), the marquee soffit, the porte-cochère canopy lit from beneath, and the **8 dead bulbs** — which are `#4a453e`, luminance 0.06, so "un-graded" but not glowing |

**The count differs and the basis is why:** D reports 78, I measure **22 distinct
materials across 219 mesh-slots**. A chase phase is one material shared by ~61
bulbs, so any count is really a choice about what to divide by. Same population,
different denominator — worth pinning down before the two numbers are compared
anywhere.

**Nothing to fix, and one thing to protect.** These 22 look exactly like the
defect D found, and the difference is intent, not structure. If the `isGlass`
split D proposes lands — actual glazing / self-lit signage / decals that ought to
dim — **these belong in the second bucket and must keep skipping the dimmer.**
Adding `alphaTest` to them, which is the fix that was right for the graffiti,
would put the casino's neon and the pavement spill into the grade and turn the
only two light sources in the world off after dark.

### A dependency I did not know these buildings had

Prompted by `4955621e` — alley graffiti glowing at midnight because
`props.ts:160` treats `transparent && !(alphaTest > 0)` as glass and never offers
it to the dimmer. My facades lean on the same machinery, so I measured them.
**No defect, and the mechanism is worth writing down**, because it is not
something either file says out loud:

```
mod=vice at 13:00 vs 23:00
  opaque                                    20 materials — 14 dimmed, 6 unchanged
  transparent, alphaTest > 0 (dimmer sees)  14 materials —  0 dimmed
  transparent, no alphaTest (dimmer skips)  22 materials —  0 dimmed
```

The six opaque materials that do **not** dim are the two shopfront bands, the
casino's big red panel, the rooftop pylon faces and one near-black post. That is
correct — but not because `ct/vice.ts` asks for it. **`props.ts`'s `isSelfLit`
reads the texture and calls a material signage when more than 8% of its opaque
texels are bright *and* saturated**, then floors it at `FLOOR_SIGN` instead of
grading it toward black.

So these two buildings stay lit after dark **because of a heuristic on their
artwork**, not because of anything declared. Repaint a band greyer, or move that
0.08 threshold, and the casino goes dark at night with no error and nothing in
`vice.ts` to explain it. The `G-vice-walk` spill check would still pass — it
asserts the ground sheets brighten, and those are driven by my own ticks.

If `props.ts` ever grows the explicit stamp H is asking for in `BLOCKED-H` §3,
these surfaces should declare themselves rather than be inferred. Until then this
paragraph is the only place the coupling is recorded.

### Still open, and none of it mine to take

1. **The door-drop CLASS.** The instance is fixed (§ the casino door, `1e49295b`),
   but `civic-doors.ts`, `interior.ts` and `world.ts` still resolve to undefined
   namespaces. They declare no doors today, so nothing is lost — the next module
   that declares one from inside the cycle drops the same silent way.
2. **`ct/doors.ts` has no owner.** D and H have both raised it.
3. **The blade instruction in my own queue item is wrong** and will cause the bug
   it is trying to prevent: it says to flip the rear texture, and the geometry has
   already supplied that flip. See `G-vice-walk`'s blade check, which fails anyone
   who follows it.

---

# RUN 1 — THE CASINO, GOLDEN ACES (commit `2ae3040`)

## `## Now` → **THE CASINO — GOLDEN ACES** — DONE, but **it needs three lines
from F before anyone can walk into it.** See "For F" below. Everything else is
verified.

Rebased onto `add-stick-and-city98` at `ea641af` first. New file,
`ct/int-casino.ts`, 300 lines. Nothing else in `src/` is touched.

## The kit's test: the casino has no window, and the kit did it

My queue set this as the first real test of the kit — *"if it cannot omit a
window, tell the desk rather than working around it."* It can. `RoomSpec.window`
is optional and the front wall is built from the runs between its openings, so
leaving the key out gives a solid wall with only the doorway in it. No kit
change was needed and I have not asked for one.

The walk test proves it rather than assuming it: a probe walks at the front wall
at an x that would be glazing on any other room, and is stopped by wall.

## What the room is

The brief was that this should be the least like the street outside of anything
on the list, so every choice is bent to one idea — a casino is built to make you
lose the thread, of the time, of the weather, and of the way out:

- **no window and no clock**, so there is no daylight and no hour;
- **2.5 m ceiling** over a 1.62 m eye. The kit's own note says a casino "wants
  more"; it wants the opposite, and 0.88 m of headroom is what makes the
  mirrored panels press down instead of being a ceiling you never look at;
- **carpet doing far too much** — a gold diamond lattice, teal rings inside it,
  gold stars on the crossings and cream pips in the middle. No one motif is
  loud; four at once is;
- **two slot banks**, each two rows back to back facing outward, so you walk
  aisles and never see the room;
- **one felt table**, because that is as much table as a neighbourhood casino
  can justify — tables are where the house pays staff;
- **the cage** on the back wall, the furthest point from the door.

Everything here is unlit `MeshBasicMaterial`, so "dim" is not a lighting change,
it is the palette: dark walls, dark ceiling, dark carpet, and the only bright
things in the room are the things a casino wants you looking at — the reel
glass, the felt, and the cage.

## Two things I got wrong, both found by looking

**The mirrored ceiling shipped as a skylight.** First version was a pale
blue-grey panel with a warm highlight raked across it — which is exactly what a
mirror looks like *in daylight*, and it read as frosted glass with the sun
coming through, in the one room whose premise is that there is no daylight. A
mirror has no colour of its own; it is as bright as whatever it reflects, and
this one reflects a dark red room. Redrawn near-black with a faint maroon wash
and thin gold glints. One redraw, so it is not at the two-failures line.

**The light pools were painting the ceiling, not the room.** They hung 0.09 m
under it, and additive blending brightens whatever is *behind* the plane — so
each pool put a blown-out white patch on the mirrors directly above it. Dropped
to 0.35 m below the ceiling and the alpha cut from 0.55 to 0.38.

One more pass after that, which was a quality call rather than a defect: 36
identical cabinets read as a texture repeated rather than a room somebody
filled. There are three cabinet types now — different topper colour, different
reel symbol, and one older cream-bodied machine kept on — laid out by a
**hand-written sequence, not a random draw**. GOTCHAS §2: there is one seeded
`rnd()` and its order is load-bearing, so a new module drawing from it would
move every tree height and pigeon in the world.

## Verification

`scripts/casino-walk.mjs` (new), same shape as F's `diner-walk.mjs` and
including its harness fix — a probe that never moved has not tested anything, it
started inside a collider's pad, so that fails loudly instead of reporting "the
wall held". **26/26.** It caught two real harness lies of my own: the eye-height
probe was hunting the camera in the scene graph where it is not a child, and the
door-approach probe started inside bank B's collider pad.

The room's lanes are set by three colliders that nearly meet, so each is walked
as a route rather than measured in plan: the aisle between the banks both ways,
the gap between the banks and the felt table, the aisle in front of the cage,
and past the table on the wall side. The felt table was resized down from
2.2 m to 1.9 m for exactly this — at 2.2 it closed the wall side to a 0.28 m
band and made the corner a wedge (GOTCHAS §9).

Also: `node scripts/health.mjs` OK · `npm run build` clean · the way in from the
side street, the way out, and *not* being sucked straight back in · the room
still lit at 2am (0/275 materials dimmed).

**Fingerprint, via F's `fpadd.mjs`: 0 lost textures, 0 lost structure —
`ADDITIVE — nothing that existed before was changed or removed.`** The only
`places` differences are seven pigeons drifting, which GOTCHAS §1 calls the
noise floor.

## The street-side numbers

Derived from `street.ts`'s NORTH2 roster and then walked, not eyeballed:

| | |
|---|---|
| GOLDEN ACES spans | x ∈ [45.45, 57.00] on the side street, facade z = -96.0 |
| painted door | u = 0.4946 of a 92-texel shopfront → **x = 51.29** |
| `[E]` spot | (51.29, -97.0), r 1.05 — walked into, capsule stops 0.67 m off the facade |
| step out | (52.84, -97.25), yaw 0, at KERB_H |

The step-out goes 1.55 m *along* the walk rather than back from the door. The
north side-street walk is only the 2 m band z ∈ (-98, -96) and the building
collider eats down to -96.3, so there is about a metre of standing room — you
cannot clear a 1.05 m trigger by stepping back without stepping into the road.
That gives 1.57 m of separation and the kit's own check passes silently.

---

## FOR F — the room needs three lines in `crosstown.ts` and they are yours

`ct/interior.ts` registers the way in and the way out, so I did not have to
touch the entry point for those. But the **build call** is still wired by hand,
the way `buildDiner` is, and that wiring is yours per your queue. My queue says
never to edit `crosstown.ts`, and you are adding the burger barn and the thrift
store to the same block, so a drive-by from me is the conflict `OWNERSHIP.md`
was written about. I wired it locally to run the walk test, then reverted it —
`scripts/ownership.sh G` is clean.

Three lines, in the interior-belt block that must stay last:

```diff
 import { buildDiner } from './ct/int-diner';
+import { buildCasino } from './ct/int-casino';
@@
   const dinerColliders = buildDiner(ctx);
+  const casinoColliders = buildCasino(ctx);
@@
     ...dinerColliders,
+    ...casinoColliders,
```

With those in, `SHOT_URL=http://localhost:4186/ node scripts/casino-walk.mjs`
is 26/26. Without them the file compiles, is unreferenced, and the door on the
side street does nothing.

**This is the same two-lines-per-room tax for the hotel, the pawn shop and the
tax office**, and E's library and C's room 301 after that. Worth deciding now
whether the kit should take a `ctx.obstacle()`-based self-registration instead —
`obstacle` is already on `CtxBuild` — so a room is one call rather than a
three-point edit in the most-contended file in the project. Your call, your file;
I am not asking for it, only flagging that it recurs nine more times.

## Next up

`## Now` still has the **HOTEL ORPHEUS lobby** under the casino. Its door
numbers are already derived and walked (x = 39.51, same walk, same kerb height)
in `notes/G-interiors2-prep.md`. Not started.

`## Next` is the pawn shop and the tax office. **The pawn shop is still blocked
on D**: `pawnFront` in `street.ts` paints no door at all — board, barred window,
stallriser, and no door rect anywhere — so there is no world position for its
`[E]` spot to sit on. Raised in my prep note; still true as of `ea641af`.

---

# RUN 2 — HOTEL ORPHEUS lobby (commit `764547c`)

## `## Now` → **HOTEL ORPHEUS lobby** — DONE

The brief is a gap, not a room: it WAS grand and it is not any more. So every
object is one of two kinds and the lobby is the argument between them.

| what is still grand | what has happened to it |
|---|---|
| a real tile floor | a vinyl runner over the track people walk |
| a mahogany reception desk | nobody behind it |
| a full wall of pigeonholes | most of the keys still on their hooks |
| a proper lift with a floor dial | the dial stopped between floors |
| a planted palm | dead, and nobody has moved it |
| four matched lobby chairs | three that do not match |
| four ceiling fittings | one of them out |

**The rule that made it work: shabbiness drawn as REPLACEMENT, not as dirt.**
The vinyl is a different material from the tile, the chairs are different
shapes, and the dead lamp is a different *colour* from the lit ones rather than
an unlit copy of one — an unlit copy of a lit thing reads as a rendering
mistake, a cold grey shade among three warm ones reads as a dead bulb. A grand
room with grime on it is just a dirty grand room.

3.4 m ceiling, the tallest in the belt, and deliberately: the casino two doors
down is 2.5 m and presses on you. This one has to have somewhere to fall from.

Adopted F's new kit contract in the same commit — builders return `void` and the
kit collects colliders into `interiorColliders()`. That is F having done a
lighter version of the thing I asked for in my prep note, and it means wiring a
room is now one line rather than three edits.

# RUN 3 — A-1 TAX SERVICE (commit `c63b2e4`)

## `## Next` → **A-1 TAX SERVICE** — DONE, taken out of order

Taken ahead of the pawn shop above it because the pawn shop was blocked on D at
the time (see below). The brief is a dare — the dullest room on the list, done
with as much care as the casino, because that contrast is the joke — so the
discipline is the casino's inverted. Every colour is a landlord colour. The
furniture is one system bought at once and never added to. Everything is square
to the walls; the only thing off-axis is the paper on the pinboard, and only
because paper will not stay square. The one ornament is plastic and it is dusty.

The joke needs the care to be real, so the details are the ones you would
actually find: label holders on every drawer, wire in/out trays stacked two
deep, the modesty panel that is the whole reason a client desk looks like that,
and one ceiling tile pushed up out of its grid and never pushed back — the only
sign a person has been in the room, and it was somebody looking for a stopcock.

The casino has no clock on purpose; this room has one on purpose, hung dead
centre over the cabinets where everybody waiting can watch it.

**Two harness lies caught here, both worth knowing about:**

- A lane test was failing on its own stopwatch, not on geometry. 8.58 m walked
  against a 9 m expectation is `2600 ms × 3.3 m/s`, not a wall.
- The "landing is not boxed in" check was failing on a **pedestrian**. Citizens
  are obstacles and they walk the same 2 m lane, so a passer-by parked on the
  landing fails a check that exists to catch static geometry. Scanning the spot
  from a fresh load showed it clear in every direction. It retries now: a wall
  blocks all three attempts, a pedestrian has moved on by the next one.

# RUN 4 — PAWN SHOP (commit `75f9350`)

## `## Next` → **PAWN SHOP** — DONE, with one number still an assumption

The plan came out of the brief's own sentence — *"a pawn shop is built to keep
you at arm's length, and the geometry can say that"*. A 1.25 m counter at chest
height runs the whole room and dies into the east wall, so there is no way round
it; the customer gets a 1.1 m strip and that is the entire floor. The tools, the
TV stack, the guitars and the brass are all visible and none is reachable, which
is the difference between a pawn shop and a junk shop. Bars inside the window as
well as outside, so the daylight is in strips before it reaches you.

**The door needs its own pocket, and that is structural.** The kit lands you at
`(door.at, hd - 1.15)`, so a counter spanning the door's x would have to sit
1.51 m back to keep the landing clear — and 1.51 m of customer floor is not a
pawn shop, it is a shop. Putting the door beside the counter lets the counter
come forward and the brief survives. Worth knowing for any other room that
wants furniture near its door.

**The walk script needed the inverse of a lane test.** A room whose point is
that the far side of the counter is out of reach has to be checked for the gap
somebody could squeeze through — no number of passing lane tests says anything
about that. Three `noGo` probes assert you cannot get behind the counter at
either end or round the tool wall, and the back wall is skipped explicitly
rather than silently passed, because reaching it is what the room prevents.

Also fixed a crash of my own making: `Object.assign` onto `mesh.rotation`
replaces the `Euler` three.js hooks for quaternion updates, and the world
stopped initialising. `health.mjs` caught it before the walk did — which is the
argument for running it first rather than last.

---

## Verification, all four rooms

`scripts/G-rooms-walk.mjs` — table-driven over casino, hotel, tax and pawn, the
same move F made with `interiors-walk.mjs`. It reads each room's slab back from
where the player actually lands rather than hard-coding it, because the slab
depends on build order and that changes every time another builder lands a room.

- **99/99** over my four rooms.
- **F's `interiors-walk.mjs`: 78/78** with my four present, so nothing of F's
  broke.
- `node scripts/health.mjs` OK · `npm run build` clean · `ownership.sh G` clean.
- `fpadd`: **STREET UNMOVED**, **0 textures deleted outright**. It does report
  43 interior textures repainted — that is the grain reshuffle F documented
  between interiors, and it is an artefact of where my LOCAL test wiring went
  (my calls landed before `buildThrift`). Confirmed against the harness's own
  noise floor: two captures of an identical state differ in 0 textures and 0
  structure, so the harness is deterministic and the reshuffle is real but
  benign. **Appending the calls after F's avoids it entirely.**

---

## BLOCKED ON TWO OTHER PEOPLE, and neither is mine to fix

**1. F — four rooms are unreferenced until `crosstown.ts` calls them.** One line
each now, thanks to F's own change. Append them AFTER `buildThrift(ctx);` so the
fingerprint stays clean:

```diff
 import { buildThrift } from './ct/int-thrift';
+import { buildCasino } from './ct/int-casino';
+import { buildHotel } from './ct/int-hotel';
+import { buildTax } from './ct/int-tax';
+import { buildPawn } from './ct/int-pawn';
@@
   buildThrift(ctx);
+  buildCasino(ctx);
+  buildHotel(ctx);
+  buildTax(ctx);
+  buildPawn(ctx);
```

With those in, `SHOT_URL=http://localhost:4186/ node scripts/G-rooms-walk.mjs`
is 99/99. Without them all four files compile, are unreferenced, and four doors
on the street do nothing. I wire it locally to run the tests and revert before
committing every time — my queue says never to edit that file and F is working
in the same block, which is the conflict `OWNERSHIP.md` exists to prevent.

**2. D — `pawnFront` still paints no door.** Raised in my prep note before the
casino and still true. `burgerFront` paints one at `W*0.44`, `taxFront` at
`W*0.5`, `shopfrontTex` at `W*0.48`; `pawnFront` has no door rect at all, just a
board, a barred window and a stallriser. The room is built and walkable with its
`[E]` spot at the convention position (`z = -59.06`, within 6 cm of the building
centre), so this blocks nothing now — but until a door is painted there, the
player presses E at blank barred glazing. `DOOR_Z` in `ct/int-pawn.ts` is the one
line to change once it exists.

## A standing request for the kit, now that it has bitten twice

Still no way to recolour, move or suppress the kit's own ceiling glow, and two
of my four rooms are about their light: the casino wanted warm and dim and
nothing like civic daylight, and the tax office wants cool fluorescent strips —
the kit's warm incandescent blobs read as a different fixture among mine. Both
rooms ship fine because the palette does the heavy lifting and each room owns
its own lamps, so this is not blocking. But `light?: {...} | false` on `RoomSpec`
would let a room say what it is lit by. F's file, F's call.

## Queue state

All four room briefs in my queue are built, walked and committed. Nothing is
left under `## Now` or `## Next` that I can start.

---

# Carried over from BLOCKED-G.md (deleted — the wiring blocker it was written for is gone)

F replaced the two-lines-per-room wiring with auto-discovery in `ct/interior.ts`
(`import.meta.glob('./int-*.ts')`, sorted by path so slab addresses come from
file names). A room lands by existing. All four of mine are live.

**~~One fact outlives that note: `pawnFront` paints no door.~~ CLOSED — see the
PAWN section at the end of this file. The facade paints a door now, centred and
aligned with the declaration.** It is the only shopfront painter in that
file that does not — `burgerFront` uses `W * 0.44`, `taxFront` `W * 0.5`, and the
block default `W * 0.48`. Nothing is broken by it: `ct/int-pawn.ts` puts its
`[E]` spot where the convention would put a door (`W * 0.48` of a 96-texel
front, world `z = -59.06`, within 6 cm of the building centre) and the room
passes 25/25. The visible cost is that the player walks up to blank barred
glazing and gets a prompt from nowhere. A door drawn to any of the three
conventions lands inside the spot's 1.05 m trigger, so when D paints one,
`DOOR_Z` in `ct/int-pawn.ts` is the one line to change. Not a blocker; cosmetic.

Also still true and still not urgent: the kit's room lights cannot be recoloured
or suppressed (bitten twice — casino wanted warm and dim, tax office wants cool
fluorescent), and `ct/props.ts` was never needed for the vice night spill, so the
coordination the desk offered with B is not required.

---

# RUN 5 — THE CASINO AND HOTEL EXTERIORS

## `## Now` → **the exteriors** — DONE, in six commits

The user: *"the front facade of the casino and the hotel are so low effort and
boring. these building are meant to be some of the most insane."* They were
right, and the reason was structural rather than lazy: both buildings were built
by `street.ts`'s generic `placeBldZ`, so a casino and a hotel came out wearing a
barber's clothes.

**1 — the extraction** (`653e1923`). Pure move into `ct/vice.ts`, the same split
that took the library and the church into `ct/civic.ts`. Called from inside the
NORTH2 loop and the signs invoked at the point they used to run, because the
paint layer draws with a seeded `Math.random` under the harness. `fpdiff`:
**textures 422 vs 422 IDENTICAL, structure 1097 vs 1097 IDENTICAL**, two pigeons
1 cm apart. Doing this as its own commit is what made the next five verifiable.

**2 — the frontages** (`39ccb6ef`). Marquee, blade, porte-cochère, glass, spill.

**3 — light in the air** (`0b59a132`). Judged from the corner 45 m away, which
is the view the brief actually names, and it was the weakest of the lot.

**4 — the whole elevation** (`2ba0f89e`). Both buildings were lit at the ground
and dark above it, which is a lit shopfront, not a lit building.

**5 — the blank wall** (`7fa68803`). The casino had four storeys of sash windows
above its marquee, which contradicted its own windowless interior.

**6 — the hotel's blade** (`3572584a`). Two blades side by side is the image.

## The governing idea, and why it needed no help from anyone

**These two are the only buildings in the world that are light SOURCES rather
than lit surfaces.** Everything is unlit `MeshBasicMaterial`, so nothing emits.
Three mechanisms already in the world do the work:

1. `props.dimWorld` skips any material flagged `transparent`. Every bulb, tube
   and spill here is transparent, so the street falls away around them at night
   while they hold. They do not get brighter; everything else gets darker.
2. `fog: false` on the lit parts only, so neon burns through 40 m of haze.
3. The night curve is **read, not written** — `scene.background` carries the sky
   and a `mesh.onBeforeRender` hook reads its luminance, guarded on the
   renderer's frame counter so it runs once per frame. Calibrated off the real
   curve (0.30 at noon, 0.011 after 22:00), measured rather than guessed.

**So `ct/props.ts` was never touched and the coordination the desk offered with
B was not needed.** Worth recording why `props.lit` is the wrong tool even
though the brief suggested it: `lit()` registers an object to CATCH lamplight
from the nearest lamp head. A casino does not catch light.

## Things worth stealing

- **The chase is shared between both buildings.** Bulbs are fixed sockets and
  the chase is which of them are alight — a scrolling texture would carry the
  dead bulb along with it, and a dead bulb is a fixed socket. Three phase
  materials animate ~190 bulbs in three colour writes a frame. Both buildings
  run the same sequence on purpose: in step they read as one lit block, out of
  step as two separate mistakes.
- **Tubes, not stripes**: three passes over one letterform — dark casing,
  colour body, hot core. A stripe is one colour; a tube is all three at once.
- **On this street, screen-right is DESCENDING x.** Three orientation bugs came
  out of that. The street-facing box material is index 5 (−z), not 4, so the
  marquee's copy and the porte-cochère fascia were hung against the brick. A
  plane's normal is +z, which here points into the building. And turning the
  applied letters to face the road made ORPHEUS read backwards — every glyph
  correct, the word reversed.
- **Additive glow must hang clear of the surface behind it.** The first light
  pools sat 0.09 m under the marquee soffit and painted the soffit instead of
  the room.

## Two redraws, neither at the two-failures line

The mirrored ceiling — sorry, the mirrored **panels on the casino's first
version** — shipped pale and read as a frosted skylight with sun coming through,
in the one room whose premise is no daylight. A mirror is as bright as what it
reflects and this one reflects a dark red room. And the house's mark on the slab
was a spade that came out looking like a bird: a suit symbol needs curves and
there are not enough texels to spend on them. `777` needs none.

## Verification

`scripts/G-vice-walk.mjs` (new), **13/13**. The porte-cochère columns are the
only new geometry touching the pavement and that pavement is the tightest in the
world — a 2 m band with the building collider eating to −96.3. Measured: they
leave a **0.68 m clear band**, three times what the street lamps already leave.
The test asserts the honest thing rather than "every lane is open", because a
column you can walk through is not a column: the lane is continuous past both,
the outer lane *does* stop at a column, and you can step around it. It also
checks the redrawn entrances still agree with the `[E]` spots at x 51.29 and
39.51, which is the coupling that would silently strand both doors.

Also: `health.mjs` OK · `npm run build` clean · 48-shot sweep with no console
errors from my code · **95/95** across my four interiors · F's `interiors-walk`
**147/147** with all of mine present.

## Queue state

All five items are built, walked and in mainline. Nothing under `## Now` or
`## Next` is left that I can start. The only outstanding external thing is D's
missing `pawnFront` door, which is cosmetic and recorded above.

---

# RUNS 6–9, and A STATUS TABLE so the queue can be closed

My handoff stopped at RUN 5 while five more runs landed. That gap is probably why
the same eight items keep being re-issued: `## Done` in my queue file still says
*"(nothing yet — you are new)"* and nothing else tells the desk what is finished.
So this section is deliberately a ledger rather than a narrative.

## Every item in `notes/queues/G-interiors2.md`, and where it landed

| queue item | state | commit |
|---|---|---|
| The vertical blade signs read BACKWARDS (§10) | **DONE** | `c39b5b36` |
| The casino interior must match that exterior's vibe | **DONE** | `df223280` |
| The pawn shop is unreadable from inside | **DONE** | `15a13af3` |
| The casino and hotel EXTERIORS | **DONE**, six commits | `653e1923` `03cdac1a` `ae7981b6` `f33b59a9` `7fceb40a` `64a469e8` |
| THE CASINO — GOLDEN ACES (interior) | **DONE** | earlier run, see RUN 1 |
| HOTEL ORPHEUS lobby | **DONE** | `764547c`, see RUN 2 |
| PAWN SHOP interior | **DONE**, then relaid | `75f9350` → `15a13af3` |
| A-1 TAX SERVICE interior | **DONE** | `c63b2e4`, see RUN 3 |

Nothing under `## Now` or `## Next` is left that I can start.

## RUN 6 — the exteriors, four more passes

`ae7981b6` light in the air · `f33b59a9` the whole elevation, not just the
shopfront · `7fceb40a` the blank wall the 1984 refit made · `64a469e8` a hotel
blade to stand beside the casino's rather than behind it.

The one to steal from: **the chase is shared between both buildings.** Bulbs are
fixed sockets and the chase is which of them are alight — a scrolling texture
would carry the dead bulb along with it, and a dead bulb is a fixed socket.
Three phase materials animate ~190 bulbs in three colour writes a frame, and
both buildings run the same sequence on purpose: in step they read as one lit
block at the end of the street, out of step as two separate mistakes.

## RUN 7 — the blades, and why the obvious fix was the wrong one

`c39b5b36`. The construction was already right — two SINGLE-sided planes back to
back, never one `DoubleSide`. What was wrong is that I *also* painted the rear
one flipped. With the planes at `rotation.y = ±π/2` the geometry has already
supplied that flip, and the two mirrors cancel; painting one face flipped
un-cancels them. **So the fix was to remove a flip, not add one.** East was
correct and west was reversed, which is the exact asymmetry to look for.

Verified from both ends of the roadway on asymmetric letters, before and after,
and re-verified against current mainline: from the west HOTEL and ORPHEUS read
correctly, from the east GOLDEN ACES, 777, LOOSEST SLOTS, $2 BLACKJACK, ACES,
HOTEL, ORPHEUS and VACANCY all read correctly.

Related, for whoever is still auditing mirrored blades (`684ccf46`, `2edf2e72`,
`0ae4d9e7`): **the vice.ts blades are not among them.** They are checked from
both approaches and they pass.

## RUN 8 — the casino interior, matched to its facade

`df223280`. Gold valances over both slot banks with bulb runs, bulbs round the
cage and under the mirrors, the 777 on the back wall in the facade's own red
tube, and a chase running all of it at the marquee's tempo. Dim stays; drab goes.

The part worth keeping: **`tube()` is exported from `ct/vice.ts` and imported by
`ct/int-casino.ts`**, so GOLDEN ACES on the front and CAGE and 777 inside come
out of one painter. That is the difference between matching and resembling, and
it cannot drift.

## RUN 9 — the pawn relayout, and the people

`15a13af3`. The lesson generalises and is written at the top of the file:
**"kept at arm's length" is a property of the COUNTER, not of the customer's
floor.** One counter across the back, wall to wall, not wrapping; the whole
front of the room is customer floor; you land in the middle of it facing the
case, the guitars and the cage.

People: `e99d0c07` hotel clerk · `b33dfd6d` pawnbroker · `04213cab` tax preparer.
The casino dealer was done in parallel by `9f4313da`. Two of the four were not
swaps at all — the hotel and the pawn shop had **nobody** in them, and an
untended desk under a full key rack reads as a hotel that has shut.

The tax preparer stands beside his chair rather than sitting in it: the atlas
paints upright figures and a seated pose is not one of its five views, so faking
it would cut his legs off at the shin. **If seated staff are wanted that is an
atlas request for H, not a per-room bodge.**

## Two things I got wrong, recorded because they cost time

**1. I filed a BLOCKED-G.md that was wrong.** I reported the tax and pawn street
doors as unreachable, having scanned the whole east walk and found no prompt. The
measurement was real; the tree was not. I was sitting on a half-migrated pawn
shop where the door declaration had landed but the room still read its own typed
constant, so the facade and the trigger were 1.44 m apart and neither was where I
computed. Mainline finished both migrations, the doors work, and the note is
deleted rather than left to mislead.

**2. Mainline and I built the same things twice.** `8e348e4e` did the pawn/tax
door declarations and `9f4313da` did the casino dealer while I was building the
same two, and I lost a long time resolving rebase conflicts before thinking to
compare branches. Comparing first would have taken a minute. **Ticking items in
the queue as they land is what would have prevented it** — which is the other
reason this ledger exists.

## Verification, current mainline

`scripts/G-rooms-walk.mjs` **98/98** over my four rooms · `scripts/G-vice-walk.mjs`
**13/13** on the frontages · `scripts/people-walk.mjs` — *8 atlas figures inside,
no hand-drawn people left indoors* · `node scripts/health.mjs` OK · `npm run
build` clean · `./scripts/ownership.sh G` clean.

---

# The pawn shop's window is still authored twice — and why I did not fix it

`ct/int-pawn.ts` supplies `frontage` AND overrides `window: { at: 2.6, w: 3.6,
h: 1.5, sill: 0.95 }`. `RoomSpec` says an override is allowed but should be
justified, and there is no justification here — it is the last duplicate number
in my four rooms, and the inside bars are positioned against it, so a roster
change moves the glass and leaves the bars behind.

**I tried to remove it and backed the change out.** Recording the attempt so the
next person does not repeat it:

Dropping the override lets the kit cut the opening from `frontageOf`, which is
correct. The bars then have to follow the DERIVED glazing, and a room cannot see
where that is. `Room` exposes `doorAt` but not the glazing span, so I converted
`F.glazingStartM/glazingEndM` into local x myself, mirroring `interior.ts`'s
`localOf`. Two attempts, both wrong on screen:

1. a panel each side of the doorway — but the pawn's glazing is ONE run with the
   door cut near its end, so the left panel landed on a solid brick pier;
2. deriving the span from `glazingStartM/glazingEndM` through my own copy of the
   conversion — still a wide panel over brick, so my conversion does not agree
   with the kit's.

Bars over a brick pier read as a mistake in a way that missing bars do not, so
the typed override is back and the room is verified at 27/27.

**Since writing that I read the kit and found why both attempts failed, so the
ask can be precise.** `interior.ts` does not use the frontage's glazing run as
it stands — it converts both ends, then **trims the glass to whichever side of
the door has the bigger run**:

```ts
// keep whichever side of the door is the bigger run of glass
if (a < dl && b > dr) { if (dl - a >= b - dr) b = dl; else a = dr; }
```

So the opening is only ever on ONE side of the door, which is exactly what both
my attempts got wrong — the first assumed glass flanks a door, the second used
the untrimmed span. No amount of care in the room would have got there, because
the trimming is a kit decision the room cannot see.

**What would close it: `Room.glazing` — the local `{ at, w }` the kit already
computes as `glaze`, returned the way `Room.doorAt` already returns the derived
door.** It is one line in the return object; the value exists. Then a room can
hang bars, blinds, a grille or a display riser on real glass without re-deriving
anything and without copying the trimming rule, which is the part that would go
stale silently.

I am not replicating those twelve lines in my room. Duplicated LOGIC is how the
door positions drifted in the first place, and this file is where I would be
copying it from. F's file, F's call — until then the typed override stays and
this note is the justification `RoomSpec` asks for.

Two failed attempts is the "two failures then delete" line, so I have stopped
rather than trying a third conversion.

---

# AUDIT-TRIAGE items 3 and 4 — both closed, with evidence

The triage is the auditor's file so I have not edited it. Recording the outcomes
here instead, because item 4 in particular will re-raise itself otherwise.

## Item 3 — "four of eight rooms have no keeper" — STALE, no change needed

`interior-audit.md` R16 sampled people at x ≈ 442, 517, 678, 1002 — slabs 0, 1,
3, 7. My four rooms are slabs 2, 4, 5 and 6, so on that measurement mine were
the empty half.

Re-measured by counting the 160×128 citizen atlas per slab: **8 of 8 occupied,
one keeper each.** `scripts/people-walk.mjs` agrees — 8 figures, no hand-drawn
planes. R16 predates the hotel clerk, the pawnbroker and the tax preparer
landing, so nobody was missing and nobody was added.

The real thing under it was consistency: the casino had moved to the kit's
`room.person()` while my other three still called `citizenSprite` and wired
their own `ctx.onFrame`. All four use the wrapper now (`9748be19`).

## Item 4 — casino ceiling — RAISED 2.50 → 2.90 (`73aeb2a4`)

**Resolved.** For a while `scripts/rooms.mjs` kept reporting `ceiling 2.5` for
slab 2 while the geometry on the same server measured the kit's ceiling plane at
2.90, the mirror at 2.88 and the wall boxes topping out at 2.90 — including
after a full dev-server restart, which is why I flagged it rather than assumed
my own change had not taken. It now reports **2.9** and agrees with the
geometry, so nothing is outstanding here and item 4 should not re-raise. Leaving
the episode recorded because the lesson stands: when a check and the world
disagree, measure the world directly before believing either.

Also worth knowing for anyone raising a room's height: six fittings in the
casino were typed as absolute heights and would have been stranded 0.4 m low —
the valances, four bulb runs and the cage sign. They are measured down from
`room.H` now. A room that hangs things off its ceiling should express them that
way from the start.

## Item 0 — masonry density — `ct/vice.ts` is NOT a contributor

Item 0 routes to `masonry()` "+ callers", and vice.ts is a caller: two shopfront
bands at `SHOP_MULT` and the casino's skin panel at mult 1. Checked with
`scripts/masonry.mjs`:

```
stamps checkable against geometry: 236
stamps that DISAGREE with their face by >0.6 px/m: 0
declared OFF the 8/16 grid: 1  — 32 px/m at (8.3, 0.1, -77), not mine
```

`scripts/seampairs.mjs` reports no disagreeing pair anywhere on the side street
either; everything it lists is the bodega corner around x 8–10. So the two vice
facades can be excluded from that pattern.

---

# For the seam audit: four of the unstamped faces are my glow planes

`scripts/seampairs.mjs` got better at pairing (`dbabd99f`, faces by their own
rectangles rather than mesh bounding boxes) and the improved list now includes
four surfaces from `ct/vice.ts`:

| face | what it actually is |
|---|---|
| `2.56×4.71` at (51.3, 0.1, −99.4) | the casino's spill on the road |
| `2.56×4.85` at (39.5, 0, −99.7) | the hotel's spill on the road |
| `8.89×10.67` at (44.4, 0.2, −97) | the blade's spill on the pavement |
| `1.45×3.56` at (45.2, 5.2, −98.6) | the low haze sheet over the frontages |

**None of them is masonry and none of them can be.** They are additive glow
decals — `blending: THREE.AdditiveBlending`, `transparent: true`,
`depthWrite: false` — whose texture is a radial falloff. Their px/m is not a
brick scale and comparing it to a wall's produces a ratio that means nothing.

The tool already has the right instinct and the right argument for it:

> The fix is not to name ivy — a list of things to ignore is the stale-constant
> habit — but to ask something that is actually diagnostic: MASONRY IS NEVER A
> CUT-OUT.

The same sentence finishes itself one clause further: **masonry is never
additive, and never transparent.** A surface that ADDS light to whatever is
behind it is a glow; a wall occludes. That is diagnostic in exactly the way
`alphaTest > 0` is, it needs no list of names, and it is one condition:

```js
if (!ms && (fw < 2 || fh < 2 || m.alphaTest > 0
            || m.transparent || m.blending === THREE.AdditiveBlending)) return;
```

I have not touched `seampairs.mjs` — it is the auditor's. Flagging it with the
instances so the next candidate list is not four glow planes and a paving slab.

Nothing to change in `ct/vice.ts`: the four surfaces are correct as they are,
and they are the reason the two buildings read as light sources at night.

---

# I watched my own corrected checks fail, and one of them did not

`dbb45d11` makes two silent-pass guards reachable and watches them fail. I had
just spent three rounds fixing my own instruments and had not done that, so I
did — and it corrects something I overstated.

**The experiment.** `095c7d63` found the casino and hotel `[E]` spots drifted
0.25 m from their published door. I had claimed my walk checks were blind to it
because they typed the door position, and that deriving it from `doorStandFor`
fixed that. So I put the drift back — restored the hand-typed
`x: DOOR_X, z: WALK_Z` in `ct/int-casino.ts` — and ran the corrected check.

**26/26. It passed.** The derived check does not catch a 0.25 m drift either.

**Why, and it is obvious in hindsight.** The check stands where the declaration
says to stand and asks whether the prompt appears. The trigger radius is 1.05 m.
A spot 0.25 m off still fires. Deriving the number removed the STALENESS — the
check can no longer be verifying a coordinate the world has moved on from — but
it never gave the check the resolution to see an error smaller than its own
tolerance.

**So the claim in `d955a0fc` was too strong.** "A check that types the number it
is checking is decoration" is right about staleness and wrong if read as "and
therefore deriving it makes the check sharp". Two different properties, and I
conflated them.

**Not adding an exactness check here.** `scripts/spots-walk.mjs` already asks
whether every spot sits on its building's published door, exactly, and that is
the right place for it — it is a world-wide sweep over all 80 spots rather than
four rooms' worth. Duplicating it in my suite would be a second authority on the
same question, which is the fault I have been removing all session.

The division of labour worth stating: **my suite tests that a player standing at
the door can get in; `spots-walk.mjs` tests that the door is where it says it
is.** Neither substitutes for the other, and mine should not pretend to.

---

# My `Room.glazing` ask is not "one line", and it should not be rushed for me

I have been describing this for a dozen rounds as *"one line in `interior.ts`
returning the `glaze` value the kit already computes"*. `notes/A-glazing-handoff.md`
and `44332d50` show that is wrong in two ways, and both are worth correcting
because I am the reason the request exists.

**1. The two-line patch does not compile, and its obvious fix deletes the diner's
window.** A wrote it from reasoning, then applied and measured it: the fields it
references do not exist on the `Frontage` shape, and made to compile with a
side-based mirror it replaces the diner's window — head, transom, apron and sill
— with one solid 4.03 × 2.60 panel, because `fr.side` and `uDir` disagree there
and the mirror lands twice. The form that works converts world → `alongU` with
the frontage's own `uDir` and reuses `localOf`; that one is a genuine no-op, 0 of
226 room meshes changed.

**2. My ask lands on deprecated fields.** `glaze` is computed from
`F.glazingStartM` / `F.glazingEndM`, two of the four fields A has marked
`@deprecated` and the reason `BLOCKED-A.md` exists. If `Room.glazing` ships
reading those, **every room that adopts it becomes a new consumer of an API
somebody is trying to delete** — and my pawn shop would be the first.

**So: do not ship it on my account, and do not ship the quick version.** The
pawn shop's typed `window` override is one duplicated number in one room, with a
written justification and 27/27 on its walk. That is a smaller problem than four
new consumers of a deprecated field. It waits for the world-coordinate form, or
it stays as it is indefinitely — both are fine and neither is urgent.

Recording it because "one line in someone else's file" is the kind of estimate
that sounds like a favour and turns out to be a trap. I made that estimate
repeatedly without having applied it; A applied it and found two failures inside
one attempt.

---

# A-1 TAX mirrors correctly — a third measurement on one of A's four disputed rooms

`notes/A-mirror-harness.md` has the harness calling all four measured rooms
**SAME SIDE** while `A-mirror-verified.md` records those same four walked by hand
as mirroring correctly, and A says plainly that one of the two is wrong, that the
untested half is the side convention, and that validating it against the
hand-verified rooms is the next thing to do. A-1 TAX is one of the four and it is
mine, so here is an independent third measurement of it.

**It mirrors.** Shots taken this round:

| | door | window |
|---|---|---|
| inside, facing the front wall | **RIGHT** | left |
| outside on the walk, facing the facade | **LEFT** | right |

Opposite sides, which is what the user asked for: *"if the door on the interior
is full right then the facade must match."*

**And it is predictable from the declaration, not just visible.** This is the part
worth having, because it is checkable without a screenshot:

```
inside,  facing the front wall (+z local):  fwd (0,0,1)  → right (-1,0,0) = -x
         door at local x -4.2, screen-right is -x         → appears RIGHT
outside, facing the facade (+x world):      fwd (1,0,0)  → right (0,0,1) = +z
         door at world z -20.13 in a frontage spanning -22..-9,
         so it sits toward the -z end and screen-right is +z → appears LEFT
```

Two observers, opposite handedness, one declaration. The mirror is a property of
standing on the other side of the same wall, so it needs no bookkeeping — which
is the argument `ct/doors.ts` already makes.

**So the harness's `observerRight` convention is the half that is wrong**, on this
room at least: `side < 0 ? -1 : 1` outside is a function of the building's side
only, and the two derivations above show the observer's right depends on which
way they are FACING, which is opposite in the two cases by construction. A single
sign flip on the outside term would move A-1 TAX from SAME SIDE to mirrored
without touching the inside term.

Not editing the harness — it is A's. This is the evidence for one of the four,
measured two independent ways that agree with each other and with A's own
walk-through.

---

# PAWN: its facade door exists now, and it cannot be mirror-verified

Two things measured this round, both about the same room.

## 1. The door I reported missing is there — that blocker is closed

For a long stretch I reported `pawnFront` painting no door, with the visible cost
that "the player walks up to blank barred glazing and gets a prompt from nowhere".
**That is fixed.** Standing on the walk facing the frontage there is a recessed
dark doorway dead centre, barred glazing either side of it, PAWN on the fascia and
the three gold balls at one end. It sits where the declaration puts it — `at: 0`,
world z −60.50, the frontage centre.

So the last outstanding item from my old BLOCKED note is gone. Nothing left in the
pawn shop needs another owner except the parked `Room.glazing` ask.

## 2. It is the fifth room A's harness cannot verify, and that is not a harness fault

`A-mirror-harness.md` has PAWN as the one unmeasured room of five, with its front
wall reading at z −2.52 — the back wall — noted as a separate fault. Worth saving
someone the chase: **even with that fixed, PAWN's door yields no handedness
signal, because it is dead centre.** A centred door looks identical from both
sides of its own wall. There is nothing to mirror.

Measured to be sure rather than argued:

| | door | barred window |
|---|---|---|
| inside, facing the front wall | centre | LEFT of the door |
| outside, facing the facade | centre | glazing BOTH sides |

The window is off-centre inside (local x +2.6) so it *would* carry handedness —
but the facade paints continuous glazing on both sides of the door, so there is no
unique counterpart on the outside to compare it against. The kit trims its opening
to whichever side of the door has the bigger run, which is why one room window
faces two facade bays.

**Do not move the door to make it testable.** It is centred because the desk chose
centre when I asked, and changing the world to suit an instrument is backwards.
The right conclusion is that this room is exempt: four of five verify, and the
fifth has no asymmetry to check. If a handedness check over all rooms is wanted,
it should skip rooms whose declared `at` is 0 and say why, rather than report them
as unmeasured.

## 3. The side-street doors were authored twice, in my own file (c953e3a0)

Found while checking whether A's `ct/doors.ts` circular-import finding
(`709ddfed`) was actually biting. It is not, at that HEAD — all eight
declarations resolve, mine included, measured in the browser:

```
declarations collected: 8
A-1 TAX | BODEGA | BURGER BARN | DINER | GOLDEN ACES | HOTEL ORPHEUS | PAWN | THRIFT
doorStandFor: GOLDEN ACES=ok  HOTEL ORPHEUS=ok  A-1 TAX=ok  PAWN=ok
```

So the cycle is **latent, not active** — worth fixing, not urgent.

But looking for it surfaced the same defect one layer down in `ct/vice.ts`:

```
vice.ts:148   const doorU = 0.4944;    // == world x 51.29
vice.ts:239   const doorU = 0.495;     // == world x 39.51
```

against `face: { x: 51.29 }` and `{ x: 39.51 }` in the two rooms. **One fact,
two authorings** — and the silent kind, because the failure is a painted door a
metre from the `[E]` prompt and nothing throws. This is the fourth time this
exact class has come out of my work; the first three were in
`scripts/G-*.mjs` and I had assumed the source was clean because I had been
looking at the checks.

`VICE_DOOR_X` in `vice.ts` is now the only authoring. The band painters derive
`u`; both rooms read `face.x` from it.

### Why the arrow points painter → room, which is backwards

The natural direction is for the painter to ask `doorPointFor` for the
declaration. **That one is not safe yet.** `vice.ts` paints during
`buildStreet`, which runs before any `int-*.ts` module is evaluated, so calling
`doorPointFor` there reads the glob mid-initialisation — precisely A's hazard.
Painter → room adds no cycle at all, because both rooms already import `tube`
from `vice.ts`. **When `doors.ts` is split so its lookup globs nothing, this can
and should invert.**

### The prose was wrong too, and had been all along

Both room headers did the same arithmetic in words, and **both figures in both
files were wrong**: "u = 0.4946 of a 92-texel shopfront" against a real 185
texels at 0.4944, and "0.4948 / 96" against 192 at 0.495. Wrong for as long as
they had existed, with nothing visibly out of place, because prose is not
compiled and no check reads it. Worth stating as its own category: the
two-authorings rule applies to comments, and comments are the copy that cannot
fail loudly.

### Verified world-neutral rather than asserted

- derived `u` lands on the **same texel** as the literal (91 and 95)
- `fpdiff`: **textures IDENTICAL 954/954, structure IDENTICAL 3489/3489**
- the 3 `tints` diffs are the chase recolouring its own shared materials
  mid-animation; the 2 `places` diffs are pigeons 2 cm apart
- `tsc` clean; all 8 declarations still resolve, no `NaN`

## 4. Two faults in MY OWN walk scripts, both found by a failure I nearly dismissed

The commit above verified clean, but the two walks came back **12/13 and
101/102** where both had been green. Neither failure was the change — mainline
with my work stashed passes 102/102, and the fingerprint says no geometry moved
— but "my diff cannot have caused it" is the reasoning that has burned me
before, so I measured instead of arguing.

**`G-vice-walk.mjs` — `runEast(..., 1)` turned a citizen into a facade defect.**
The check reported `x = 34.00`, its own start point. Probing that lane by hand
straight afterwards reached **36.06 — the column, exactly where it belongs**:

```
z=-97.5  landed x=34.00  →  reached x=36.06     (expected band 35.8 … 36.6)
```

`runEast` takes the **max** over its tries and its own comment says "citizens
are obstacles too". For a check of the form *you get this far and no further*, a
retry can only correct a wanderer blocking the start — there was never a reason
to pass `tries = 1`. Fixed to the default 3. The upper bound stays, so a
vanished column still fails.

**`G-rooms-walk.mjs` — the doorway check was measuring the clock.** It held `w`
for a fixed 2600 ms, which covers ~8.2 m; the hotel's run from `clearZ` to its
front wall is 8.4 m. So the walker was stopping *because the hold expired*,
about where the wall is — **0.21 m between "the collider held" and "time ran
out", with no way to tell which**. A leak of up to a fifth of a metre would have
read as a pass forever. Now it walks until the player stops moving, which is the
fix this same file already applied to the prompt walk 100 lines above. I fixed
that one and left its twin directly below it.

**One thing I could not explain, left in the file rather than tidied away.** The
doorway check failed once with `z = 9.00` and that is still the only observation:
five walk-until-stopped probes at that doorway all stop at **z = 4.29**, and
baseline passes too. I do not have the mechanism. It is recorded in the source at
the check, because *"it passed when I ran it again"* is exactly how a real
intermittent leak gets closed.

### The pattern across all three

Every one is the same shape as something I had **already fixed elsewhere in the
same file** — the typed constant, the fixed-time hold, the number copied out of
the world into the check. Knowing the class does not find the instances; only
running the thing and disbelieving the green does.

Also, minor, for whoever maintains the docs: `CLAUDE.md` documents the sequence
as `npm run fp before` → `npm run fp after` → `npm run fpdiff`, but `fpdiff`
takes two paths and throws a `TypeError` on `undefined` without them. It is
`npm run fpdiff -- shots/before.json shots/after.json`.

## 5. ~~For A: the casino's `DOOR` does reach `declaredDoors()`~~ WRONG — I measured the dev server

`A-mirror-harness.md` retracts the consequence it drew about GOLDEN ACES but
keeps the underlying claim:

> The `doors-declared` failure is still real: the casino's `DOOR` never reaches
> `declaredDoors()`, so the `[E]` census and anything driven by it does not know
> that building has a door.

**That does not reproduce.** Measured in the browser at `cb696d3d`, rebased on
current mainline, and separately at `709ddfed` before it:

```
declaredDoors(): 8
  A-1 TAX | BODEGA | BURGER BARN | DINER | GOLDEN ACES | HOTEL ORPHEUS | PAWN | THRIFT
  GOLDEN ACES    point=[51.29,-96]   stand=[51.29,-96.75]
  HOTEL ORPHEUS  point=[39.51,-96]   stand=[39.51,-96.75]
console errors: 0
```

All eight collected, both of mine present, points and stands correct, nothing
`NaN`, no console errors.

**But I am not claiming A was wrong, and the fix should still land.** The
mechanism A traced is real — `doors.ts:75` does an eager
`import.meta.glob('./*.ts')` while every room imports `./doors`, so whether a
room's namespace is initialised when the glob is read **depends on module
evaluation order**. An order-dependent bug that resolves at two HEADs is latent,
not absent, and "it works here" is the weakest possible evidence about it. A's
proposed fix — move the lookup into a leaf `door-util.ts` that globs nothing —
removes the dependence rather than the symptom, and that is the right shape.

**One variable to know about if anyone bisects this.** My `c953e3a0` adds an
import edge, `int-hotel.ts → vice.ts`, and adding any edge perturbs evaluation
order. It does not add a cycle — `vice.ts` imports no `int-*` — and the census
above was taken both before and after it, with 8 of 8 either way. But if this
does start biting, that commit changed the graph and should be in the frame.

**What I am not doing:** touching `ct/doors.ts`. It is not mine, and the useful
thing I can contribute is the measurement, not a patch to someone else's leaf.

### CORRECTION. A and D were right; my instrument could not see the bug.

Everything in section 5 above was measured on the **vite dev server**, and
`D-casino-door-drop.md` (`a7a57c4f`, already on mainline when I wrote it) had
established that the dev server **cannot reproduce this**:

```
vite dev            AT GLOB TIME  []
vite preview        AT GLOB TIME  ["./civic-doors.ts","./int-casino.ts",
                                  "./interior.ts","./world.ts"]
```

D's own words, which I should have read before measuring:

> Anyone debugging this on the dev server will find nothing wrong and conclude it
> is fixed — which is the same shape as measuring the wrong worktree, one layer
> down.

That is exactly what I did, and then committed it as a correction to somebody
else's finding. **Rebuilt and measured the bundle on my own preview port:**

```
__ct.doors() from dist  →  7 buildings
BODEGA | BURGER BARN | DINER | HOTEL ORPHEUS | PAWN | A-1 TAX | THRIFT
GOLDEN ACES: MISSING
```

**A's claim is confirmed, not refuted.** My "measured twice" was measured twice
in the one place the defect is invisible, and the second reading added no
information over the first.

Two process notes, both on me. I picked port 4231 because D's note used it — and
it answered, so I nearly measured **D's dist from another worktree**, which is
the `0a0b104f` trap in the same breath as the dev-server one. Own port, and
`reportWorld` in the script, is not optional. And GOTCHAS 26 says prove the world
rather than name it; a bundler-order bug means the *build* is part of the world.

### What the bundle test does establish, which is new

`c953e3a0` made both rooms' `DoorDecl.face.x` read `VICE_DOOR_X` from `vice.ts`
at module-init time. Against a defect that is precisely about namespaces being
undefined when read, that is a fair thing to be nervous about — an undefined
`VICE_DOOR_X` gives `face.x = undefined` and a `NaN` door. **Measured in the
bundle, it holds:**

| | in `dist` |
|---|---|
| HOTEL ORPHEUS `point.x` | **39.51** — so `VICE_DOOR_X` resolved |
| GOLDEN ACES declaration | dropped, as before my change |
| casino room built and enterable | yes, `[E]` prompts and lands at x 596.80 |
| hotel room built and enterable | yes, x 756.60 |
| console / page errors | **0** |

So the new edge does not add a `NaN` door, and it does not widen the drop. The
casino's declaration is lost for the reason D found — `./int-casino.ts` is in the
undefined set — and it was lost the same way before `c953e3a0`. Both doors still
prompt, open and land in the right room, which matches `9066c566`: the lost
declaration costs a player nothing.

**Still not touching `ct/doors.ts`.** A's structural fix stands, and the reason
to prefer it is stronger than I argued: not "order-dependence is latent", but
that the bundle demonstrably drops a real declaration today.

## 6. For the auditor: the two-snapshot mover filter, and the hole you just fell in

`362ab354` audits your probes for mover-handling and puts `lane3`, `lanewalk` and
`corridor` in the "drop movers" row. My `G-vice-walk` band measurement now uses
the same idiom, so this is about all four.

**The idiom has a residual hole and it is exactly the one that produced
`3f7b2623`.** Two snapshots 1.5 s apart classify by MOTION, so a pedestrian who
stands still across the whole window is byte-identical in both and gets counted
as furniture. Your retraction — *"the mid-walk post was a stopped citizen"* — is
that failure mode; it came from a single-snapshot probe, but the two-snapshot
form does not close it, it only narrows it to pedestrians who stop for longer
than the window.

**Measured rather than argued, on the north side-street walk:**

```
total 216 · static by 1.5 s 210 · still static after a further 8 s 210
boxes the short window called static but that moved later: 0
band 0.44 m from both sets, z -97.08 … -96.66 either way
```

Zero ghosts. The 1.5 s window is sufficient *here*, for these six movers.

**What that does and does not license.** It is a property of this walk at this
HEAD, not of the idiom. The honest reading is the one you already applied to your
standable-point counts: the verdict holds, the number is an instant. If any
mover-filtered check ever reports a gap narrow by about one citizen's width,
re-measure with a long window before believing it — that is cheap and it is the
difference between `lane3`'s 1.15 m standing and `tightest`'s 0.77 m being
withdrawn.

**A cheaper discriminator than time, if you want one:** citizens and vehicles are
pushed by their own modules, so the collider list could carry the `userData.mod`
tag that `lot`, `walkup` and `vice` already use for meshes. Then "is this a
mover" stops being an inference from two frames and becomes a declaration — the
same move that settled the masonry-vs-glow argument for `density.mjs`. That is
`ct/props.ts`'s call, not mine.

## 7. ~~A tension in `scenedump.mjs`'s texture hash~~ ANSWERED by C in `38a6e78e`

> **Resolved, and the answer is worth more than the question was.** All three
> measurements below hold and they are consistent; C found the piece I could not.
>
> **`scenedump.mjs:23-26` replaces `Math.random` in an `addInitScript` before the
> page loads**, seeding it so texture pixels are reproducible *for the
> fingerprint only*. So `dither()` genuinely is unseeded in the world the user
> plays, and `fp` genuinely is reproducible — by design, not by accident. My
> probe that saw `Math.random()` differ across loads was measuring a plain page;
> under `scenedump` it is deterministic. **The two readings were of different
> things**, which is why they would not reconcile.
>
> The dev↔dist difference has a cause too: a seeded LCG is a *sequence*, and the
> two worlds draw from it at different positions — a fixed 30-draw gap, opening
> before the first texture is painted. Same seed, different place in the stream.
>
> **So the CLAUDE.md guarantee is sound**, and stronger than I implied: `texHash`
> hashes real pixel bytes and can see paint noise perfectly well. What I feared
> — that "textures IDENTICAL" might be hiding a real repaint — is not the case.
>
> **The operational rule is now `GOTCHAS.md` §31: `fp` compares dev to dev, or
> dist to dist, NEVER across.** My reading (3) broke that rule, which is why it
> looked alarming. Anyone reaching for the numbers below should read §31 first.
>
> Kept rather than deleted because the withdrawn-probe note underneath is still
> the useful part: texture pixels are only comparable when read the way
> `scenedump` reads them.

## The original note, which stopped at the question

**Not a bug report — a pair of measurements that do not fit together.** CLAUDE.md
tells every builder to prove a change is world-neutral with `fp` / `fpdiff` and
says *"textures and structure must match"*, so what that hash is sensitive to is
load-bearing for everyone.

**Measured:**

1. `ct/paint.ts:50` — `dither()` uses **unseeded `Math.random()`**, exactly as
   CLAUDE.md warns. `Math.random()` demonstrably differs across page loads:
   `0.650184 …` on one, `0.771610 …` on the next.
2. `fp` nevertheless reports **textures IDENTICAL across two dev loads** — not
   merely the same summary hash, the `_textures` arrays are byte-equal, all 954
   entries including the 65 dithered 48×48 ones.
3. Under the same protocol, `fp` reports **612 of 954 textures differing between
   dev and a `vite preview` of `dist`.**

(1) and (2) pull against each other: unseeded noise painted into 65 canvases
should not survive a reload byte-identical. Either those textures are not the
dithered ones, or something makes the paint reproducible that I have not found —
there is no `Math.random` override in `src/proto/`.

**One thing I got wrong on the way, worth recording because it is the trap:** an
ad-hoc probe of my own said those textures *do* differ across loads. It read them
without `scenedump`'s protocol — no `setClock(13,0)`, no waiting on rendered
frames — and its 65 hashes overlap `fp`'s by **exactly 1 of 65** on the same
world. So texture pixels are only comparable when read the way `scenedump` reads
them, and my first version compared the first four in traversal order, which need
not even be the same four textures. I withdrew that reading rather than report it.

**Why it matters despite touching nothing:** if the hash is insensitive to paint
noise, then "textures IDENTICAL" is a weaker guarantee than it sounds and a real
repaint could hide in it; if it is sensitive, then (2) needs explaining and the
dev↔dist difference in (3) is a genuine visual difference between what we test
and what the user plays. **I could not settle which, and I am not guessing.**

Reproduce: `SHOT_URL=<dev> npm run fp devA`, again as `devB`, then
`npm run fpdiff -- shots/devA.json shots/devB.json`.
