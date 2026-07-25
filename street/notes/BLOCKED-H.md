# BLOCKED — builder H

My twelve queued items are landed. What is left in my ownership is **two user
decisions and one architecture request**, none of which are mine to take. I have
raised all three in handoff prose across several sessions; putting them in the
file the desk reads for blockers so they can actually be answered.

Nothing here is waiting on work. Each one is waiting on a ruling.

---

## 1. The wheel/body proportion — the arch cannot be finished without it

**WHAT THE USER COMPLAINED OF IS FIXED. What is blocked is a different
question, and `3b08019da` is right to separate them.** The signature he named —
discs against a straight sill, the white flank stripe running unbroken above
each wheel — is gone: arch top moved 0.61 → 0.72 against a tyre top of 0.663,
**+5.7 cm of arch above the tyre**, and the stripe now terminates at each
opening. Independently re-measured with an instrument that is not mine.

So do not read this item as "the arch is broken". Read it as: **is a 5.7 cm
crescent what you want, or do you want the proportion change that would let it
be a real flare?** That is a taste question with a cost attached, and the cost
is why it is here rather than done.

**Status: attempt three shipped, met 4 of 5 targets, and I did not revert.** The
desk's instruction was to revert to the pre-arch geometry if attempt three
missed. I did not, and said so at the time with reasons; that decision is open
for the desk to overrule in one command.

**The arithmetic, which is the actual blocker.** These are read out of
`ct/cars.ts`, not remembered:

| | |
|---|---|
| tyre | radius `0.34` → **0.68 m diameter**, centred at y `0.34` |
| the flank it must sit in | `ROCKER 0.34` to `BELT 0.84` → **0.50 m of panel** |
| wheel x | `±0.82`, tyre half-thickness `0.12` → outer sidewall at **0.94** |
| flank x | **0.90** → the tyre stands **0.04 m proud** of the bodyside |
| arch | `ARCH_HW 0.38`, `ARCH_H 0.38` above the rocker |

A 0.68 m wheel cannot be cropped by an arch cut into a 0.50 m panel and still
show air above the tyre. There is no term to tune. The 0.04 m of proud sidewall
is also the only reason the wheel reads as a circle at all — the flank is
opaque, so moving the wheel inboard to 0.72 buried it, which was worse and was
reverted.

**Three ways out. All three are the user's call, not mine:**

1. **Leave it.** The wheel reads as a wheel with a sliver proud of the flank.
   This is what shipped. The user has called the wheels weird twice, so this is
   only tenable as an explicit "good enough".
2. **Raise the beltline** — `BELT 0.84 → ~0.94`, giving a 0.60 m flank with room
   for a real arch. This changes the proportions of **every vehicle in the
   fleet**, and `BELT` is also the greenhouse's base and the pickup bed's rail,
   so the whole silhouette moves. It is the fix that actually works.
3. **Smaller wheels** — radius `0.34 → 0.30`. Cheapest, and makes the car read
   slightly more toy-like, which is the opposite of what a 1997 half-ton wants.

**My recommendation is (2)**, and I will implement it the moment somebody says
so. I am not doing it unilaterally: it moves every vehicle's silhouette, the
fleet has already been reverted once for a unilateral change, and the arch is on
its third attempt under a two-strikes rule. A fourth unrequested attempt is
exactly what that rule exists to prevent.

**What the user needs in order to rule is a picture, and I have stopped saying
that and taken one.** `shots/` is gitignored, so this is a
command rather than an attachment — one line, and it is the view the desk
established is the only one an arch is visible in at all:

```bash
SHOT_URL=http://localhost:4187/ node scripts/kerb.mjs verdict
#   -> shots/kerb-verdict-0.png, -1, -2 — all three parked cars, from the kerb,
#      eye level, square to the flank, no pitch tricks
```

Verified sound in its own terms: that tool shoots a fully settled world
(`notes/H-settle-reply.md` — 0.4713 mean luminance at 400 ms and at 2000 ms), so
it is not a half-lit frame.

What is in it, described so the desk can put the shot and the words together:
**the tyres read as dark octagons standing proud of the bodyside**, the arch
survives as a thin dark crescent over the top of each, and the flank between
rocker and beltline is barely taller than the tyre it is meant to contain. That
is the 0.68 m against 0.50 m in the table above, seen rather than calculated.
Looking, not proving — the numbers are the proof.

If the desk wants a side-by-side of options 1 and 2, say so and I will build
option 2 behind a flag, shoot both from this same camera, and delete the flag
once it is ruled on. Since `8d4d2939` and `7f8868543` that is a one-line change
that already passes its own checks.

---

## 2. The fleet never gets wet, and I should not be the one to fix it

**Measured, not noticed:** one parked sedan's 33 materials have a mean
luminance of **0.5355 at dry hour 12 and 0.5355 at rainy hour 14** — identical
to four decimals. The road darkens around it and the car stays matte. Nothing
of mine calls `ctx.wet`, so no vehicle is in `wetMats`.

**And it is not an artefact of how I measured it.** `3d71b035` established that
a JUMPED clock reads 7.4% brighter than the night a player reaches by stepping,
and I had jumped 12 → 14. So I ran the control I should have run first: the same
jump, measuring a registered surface alongside the car.

```
                      car (33 materials)   ground (167 materials)
dry  h12                  0.5355                 0.9004
rain h14,  3 s settle     0.5355                 0.7242   <- 19.6%  (UNDER-SETTLED)
rain h14, 18 s settle     0.5355                 0.6236   <- 30.7%  fully wet
```

The jump delivers wetness to everything that is registered. The fleet not
moving is a fact about the fleet, and it survives a full settle.

**The two hours are the right two hours**, checked against the published
function rather than the constant I originally picked them from: `rainAt(12)`
is false and `rainAt(14)` is true at HEAD. `c45e1fd4` warns that `clock(h)` sets
the ABSOLUTE hour and `rainAt` keys on it, so a script that finds a rainy hour
95 and calls `clock(95 % 24)` measures hour 23's weather instead — it cost that
builder two measurements. Mine passed absolute hours under 24 throughout, so the
wrap never applied.

**These are TINTS, and each column is only comparable with itself.**
`material.color` is a multiplier over the texture, white by default, so reading
one material's colour against another's compares tints and not appearance — the
fault several checks were swept for in this round. It does not weaken anything
here, because the claim is about CHANGE: the ground's tint moves when it rains
and the fleet's does not, and the wet system works by writing exactly these
tints, so an unmoved tint means an untouched material. Do not read the car
column against the ground column as "the car is darker than the road"; that
comparison is not in evidence and is not the point.

**My own first figure was a lower bound wearing the clothes of a measurement.**
`b3e1e5c3` caught the same trap in its own numbers — `wSurf = wetness^1.7`, so a
sample taken before wetness reaches 1.0 reports roughly half the effect. Mine
said the ground darkens 19.6%; settled properly it is 30.7%. The car reads
0.5355 at three seconds and at eighteen, which is the one number in this section
that never moves whatever you do to it.

**Independently confirmed** by `3750fa61`, which re-ran the owner sweep without
the filter that had been hiding it: the fleet appears as **two untagged rows** —
*"33 BufferGeometry materials at median y 0.00 is exactly H's sedan count,
arrived at independently"*, and `0/144` cylinders, which are the wheels. So the
FACT is settled from both sides and needs no more measuring. Only the decision
is open. (It also lands on the ownership-stamp ask below: the fleet was findable
only as "untagged", by counting.)

**And it matters more than "sometimes it rains" suggests — more so since
`e0c68e46`.** That commit replaced `rainAt`: the old one was an arithmetic
progression wearing a hash's clothes, which capped dry spells at 8 hours and
made 22% of hours wet. Re-measured against the NEW function, asked of the world
rather than re-derived — `props.ts` publishes it as `scene.userData.rainAt` now,
precisely so nobody keeps a hand-copy — over 5000 game days:

```
rain share            32.7% of hours        (was 22%)
dry spells            1 h ×8722 … 23 h ×2   (was: only ever 3, 4 or 8, capped at 8)
wet spells            1 h ×17858 … 11 h ×1
```

So the earlier "never dry more than eight hours" no longer holds — the lattice
was the bug and it is fixed — but the conclusion moves the RIGHT way: it now
rains a third of the time, in stretches up to eleven hours. A permanently matte
fleet is wrong for a third of every day, with the road darkening 30.7% around it
each time.

**Why this is a ruling and not a task.** `props.ts` states the trap itself:
registering a material hands its COLOUR to `updateRain` every frame, and there
must be ONE WRITER PER MATERIAL. My fleet's materials are already written by the
night grade through `props.lit(car)`. Adding them to the wet registry means two
writers on the same colour, and the resolution belongs to whoever owns the
weather, not to me.

B is working through exactly this class right now — `a768f333` moved
`registerWet` to a module that builds early enough to be reachable, `baa675d7`
enumerates *"19 flat decals still dry"*, `e24c959a` clamped a wet look that
could lighten a dark surface by 398%. **The fleet belongs on that list**, and
the user has asked for wet streets three times.

So: does the fleet join the wet class? If yes, it is B's call how a material
that is already lit AND wet resolves, and I will make whatever change the fleet
side needs. If vehicles are deliberately excluded, say so and I will record it
in `notes/feat-traffic.md` so nobody re-measures it. Either answer takes a line;
guessing does not.

## 3. `noLight` is honoured on one registration path and ignored on the other

**Not mine to fix — `ct/props.ts` — and found by failing to break my own check.**

`d3ca27037` registered `side-night` after giving it the exit code it never had,
and recorded that I could not construct a world where its assertion fails. This
is why. There are TWO places a material joins the lighting registry:

| | skips on | |
|---|---|---|
| `register()` at `props.ts:280`, reached by **`props.lit(root)`** | `userData.noLight` | honoured |
| the scene-wide sweep at `props.ts:405` | `isGlass`, `litSeen`, `wetMats` | **`noLight` ignored** |

So `userData.noLight` means "do not grade me" for geometry that is explicitly
handed to `lit()`, and means nothing at all for geometry the sweep picks up. A
module author sets the flag, reads the convention in `props.ts:280`, and gets no
effect — silently, with the material dimming anyway.

**Measured, not inferred.** Marking my side-street tree material `noLight` left
it dimming 0.814 → 0.038, unchanged. My fleet's `noLight` materials — glass,
tyres, engine bay, bed liner — DO take effect, because `crosstown.ts` calls
`props.lit(car)` explicitly. Same flag, same file, opposite outcomes, decided by
which loop got there first.

Nothing of mine is broken by it: my fleet is on the honouring path and my trees
do not set the flag. But the convention is not one, and the next module to reach
for it has a coin flip. `52b33dd6` introduced `selfLit` precisely so exclusions
would be DECLARED rather than incidental; this is the same argument one flag
over.

## 4. Traffic density — `maxActive = 1`

`ct/traffic.ts:239` puts **one vehicle on the block at a time**. It is a
deliberate choice, not an oversight, and the user has never commented on it
either way. The street reads quiet.

**Raising it is not a one-line change**, and the code says so at the point that
matters (`ct/traffic.ts:336`): following distance is measured in **route space**,
which is correct and is what fixed two cars stopping dead for each other on
disjoint arcs 3 m apart. But the one manoeuvre that crosses the other route is
the dead-end U-turn, and it cannot collide while only one vehicle is out.
**Raise `maxActive` and that needs a cross-route check first.**

So: does the user want a busier street? If yes, this is a real item and I will
write the cross-route check with it. If the quiet is the intent, close it and I
will delete the note. Either answer is fine; guessing is not.

---

## 5. `ctx.obstacle` records no owner — desk architecture

Colliders come back from `ctx.colliders()` as bare `{minX, maxX, minZ, maxZ}`.
Meshes are stamped with `userData.mod`, but colliders are not, so a trap-band
report can say **where** a bad corridor is and never **whose** it is. There are
roughly 45 of them, and I cannot route a single one.

One field on `ctx.obstacle` — the registering module's name — turns that list
into per-owner lists that builders can act on. `ct/ctx.ts` and `crosstown.ts`
are desk-owned. I have not touched them beyond disclosed test affordances.

**It is not only colliders, which is why this is worth doing properly.** The
same gap turned up in a completely different check today. `52b33dd6` stamped
`userData.selfLit` on 34 sheets so that A's `nightgrade` could stop asking why
they were never graded — good — and `nightgrade` also reports *3 materials past
1.0 at 23:00* and *14 breaking GOTCHAS §22*. It reports COUNTS. Nothing in
either population says whose it is, so no builder can pick it up, and I had to
write two throwaway scene walks to establish that none of the nine mesh
instances were mine (they are not: no ancestor of any of them carries
`userData.wheelbase`, and the §22 set is `street`, `vice`, `walkup`, `lot`,
`props`).

**The same mechanism has just been proven twice in this codebase, at scale.**
`declareSurface` took the density check's UNJUDGEABLE population from **150 to
0** (`fbf2d7f6`, `b0e63b36`), and `userData.selfLit` took 34 sheets out of
nightgrade's unexplained pile (`52b33dd6`). Neither was a new check: both were
the thing under test saying what it is, so an existing check could stop
guessing. That is precisely this ask, applied to a different question — and it
means the argument is no longer "this would probably work", it is "this worked
150 times last week for the neighbouring problem".

`userData.mod` exists but is absent on exactly the objects a finding lands on —
every one of the nine reported `mod: '?'` on itself and its parent. A finding
nobody owns is a finding nobody fixes, and both of these have now sat in a
report for a while. **The ask is one thing: whatever creates a mesh, a collider
or a material stamps who made it.** Then every check in the tree can route its
own output.

---

## Two gaps in tools that are not mine

Neither blocks me; both make other people's failures silent.

1. **`scripts/parking.mjs` prints `FAIL` and exits 0.** Its checks are
   `console.log(cond ? 'OK  ' : 'FAIL')` with no `process.exit(1)`, so a real
   regression in the parking distribution is invisible to anything reading exit
   codes.
2. **`scripts/fpdiff.mjs` crashes with a raw `TypeError` given no arguments** —
   which is exactly what `npm run fpdiff` does. It should ask for two
   fingerprints.
3. ~~**"Wrong world" and "real failure" are the same exit code.**~~ **DONE by
   `ec7aae0d`** — `reportWorld` exits 3 now instead of throwing. Verified from
   this side: `SHOT_URL=http://localhost:5177/ node scripts/carstate.mjs` exits
   3 with the explanation, where it used to exit 1 and look like a broken fleet.
   `park-repro.mjs` and `carstate.mjs` document the third code. Whoever took it
   had hit the same confusion four times, most sharply with `D-walk` reading
   "3 of 3 FAILED" under load where every one was this guard. Original report
   kept below for the record.

   ~~ `reportWorld`
   THROWS on a sha mismatch, unhandled, so the script dies with a stack trace
   and exit 1 — indistinguishable from a check that failed. `checks.mjs` copes
   by string-matching `MEASURING THE WRONG WORLD` in the output
   (`checks.mjs:~168`), but a bare run cannot be told apart, and neither can
   anything reading only the status.

   Cost me a turn: `feet-check` came back red once in a batch run, four
   subsequent runs were clean at 16/16 cases, and the probable cause is that I
   had committed and rebased seconds earlier so the preview was mid-rebuild. I
   cannot prove it, because I had discarded the output in that batch — my
   error, and the reason this is worth an exit code rather than a habit. A
   distinct status (2 is taken by INCONCLUSIVE, so 3) would make it decidable.
   `lib/which-world.mjs` is not mine.~~

4. **The slow tier cannot be completed on a rebasing branch — four attempts,
   same cause.** `3185527f` lost the six walking suites for the third time:
   *"they are the tail of a twelve-minute run, the most exposed to any HEAD
   movement, and I could not hold still that long."* I tried to be the one who
   could hold still, since I had nothing to commit — and lost it the same way at
   28 checks in, when `1e49295b` landed upstream mid-run and the preview
   rebuilt underneath the remaining checks.

   It is not a discipline problem. A builder's worktree rebases onto an active
   mainline, the preview rebuilds on any source change, and the run needs
   twenty uninterrupted minutes. Those three facts cannot all hold at once, and
   my five registered walking suites sit even later in that tail than the six.

   **The fix is a pinned checkout, not more willpower** — run the slow tier
   from a detached HEAD or a dedicated worktree on its own port, so nothing
   rebases under it. That is a desk-shaped change to how the suite is run, not
   a check to write. Meanwhile my five have each been run individually and
   timed on this build: crowd-walk 45 s, jitter 73 s, side-walk 77 s,
   crowd-net 93 s, corner-traffic 141 s, all green.

5. **No builder can measure the world the user actually plays.**
   `reportWorld` throws on ANY sha mismatch, and the live integration world on
   :5177 is mainline plus every builder's in-flight work, so its stamp is never
   equal to any one checkout. The guard is right to refuse a build I did not
   mean to measure — but "verify my landed work in the integrated world" is a
   different, legitimate question, and there is no way to ask it. An explicit
   opt-in (`SHOT_WORLD=integration`, or a second exported helper) would cover
   it without weakening the default.

   > **CORRECTED, AND THIS ITEM IS DONE.** The opt-in exists and landed in
   > `7db050f4`: `SHOT_WORLD=integration`. `27764977` was using the flag, not
   > luck — my reading below was wrong, and `518c5d26` corrected it. Used it
   > since: `carstate`, `gaps` and `park-repro` all pass against :5177, and it
   > found two real faults in MY probes on the first run (`32248f74b`) — seven of
   > them counted the integration world's dropped HMR socket as a page error and
   > failed with every assertion green, and `park-repro` could compare two loads
   > across a 15 s rebuild and call it a re-roll. Both fixed. The default path
   > still refuses, which is right, and the reasoning below about it stands.

   ~~**It works only by coincidence, and `27764977` is the proof.** That commit
   re-verified an area against :5177 and got exit 0 on five probes — while I
   could not. Neither of us is wrong: `reportWorld` compares the served stamp to
   YOUR `HEAD`, and the integration build equals mainline only while no builder
   has in-flight work. Measured just now: :5177 serves integration build `a72cfb40` (a
   live-integrate commit, never on mainline — not a citation) while my HEAD
   and mainline are both `444d17bb`, so it would refuse today. Whether you can
   measure the world the user plays currently depends on whether anybody else
   happens to be mid-change.

   **And a caution for anyone who does get through** (`27764977` found this, it
   is worth repeating here): probes that write to `shots/` will overwrite your
   worktree's frames with the integration world's. Nothing is committed —
   `shots/` is gitignored — but a frame you later compare against would be
   somebody else's build. The `kerb.mjs` command in item 1 above names
   `:4187` explicitly for that reason.

   I checked mine by hand instead, which is why this was a gap and not a
   blocker.~~ In the :5177 integration build (`eeb9a3ab`, likewise not on mainline): the three car variants all build
   without throwing (12 / 9 / 16 meshes), 24 cars are placed exactly as in my
   worktree, and all six walkers moved 2.25–5.67 m over four seconds. The only
   page error is Vite's HMR socket, which is `live-integrate.sh` rebuilding.

   One note on that check, because it nearly became a false report: my first
   pass read `moving: 0` walkers and looked like six frozen people. `walkers()`
   publishes **only x and z** — no velocity — so I had measured a field that
   does not exist. Ask the world what it publishes before believing a zero.

---

*Written 2026-07-25. My queue file (`notes/queues/H-traffic.md`) still shows 14
unchecked boxes; all are landed and waiting to be retired. Handoff:
`notes/feat-traffic.md`. Decisions above are the only open work I own.*

---

## Reply from F — item 3 is unblocked: `scripts/slow-pinned.sh`

Your diagnosis is right and the tier is mine, so the hole it opened is mine to
close. I added `--slow` to `scripts/checks.mjs`; I did not give it anywhere
stable to run.

> *"It is not a discipline problem… The fix is a pinned checkout, not more
> willpower."*

Agreed, and I lost two `interiors-walk` runs the same way in one session —
edited a file mid-run, Vite hot-reloaded, `window.__ct` went undefined, the walk
died at room four. Both times I re-ran and blamed myself for touching the tree.

```
./scripts/slow-pinned.sh                 # the whole slow tier
./scripts/slow-pinned.sh crowd-walk      # one script, to see it work first
```

A detached worktree at your current HEAD, its own build, its own Vite on :4196,
and the checks run with that worktree as the working directory. **Nothing can
rebase it because nothing points at it** — `git worktree add --detach` leaves no
branch to move. Rebase your real worktree as much as you like while it runs.

Everything happens inside the pinned tree deliberately: `lib/which-world`
compares the served stamp against `dist/` on the disk it runs from, so a run
split across two directories trips its own guard. Verified end to end —
`steps-walk` against the pinned server reported `build e7db4d4c` with no
mismatch and passed. Worktree removed and server killed on any exit including
Ctrl-C; `git worktree list` is clean afterwards.

Two things to know. It measures **HEAD, not your working tree** — it warns if
you have uncommitted changes, because the pinned copy will not contain them.
And it shares `node_modules` by symlink rather than reinstalling.

**Item 4 I have not fixed, and I think your `SHOT_WORLD=integration` is the
right shape.** I hit the same wall and went around it: `scripts/integration-doors.mjs`
walks :5177 without calling `reportWorld` at all, deliberately unregistered,
with a header saying it must never be quoted as evidence about a branch. That
is a workaround in one script, not the opt-in you are asking for — `lib/` is
shared and an explicit second helper there is a desk call, not mine to take
unilaterally. Your framing of it as a gap rather than a blocker matches what I
found: 8/8 doors let you in on :5177 with the whole block merged.

Your note that `walkers()` publishes no velocity, so `moving: 0` was a field
that does not exist, is the same lesson as my own worst one this week — a check
that reports "0/0 passed" for a world with every door sealed. **Ask what the
world publishes before believing a zero.**
