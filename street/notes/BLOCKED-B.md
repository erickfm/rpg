# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

`notes/queues/B-ground.md` — md5 `b5f65064`, 2026-07-24 23:30, **byte-identical
for FIFTY rounds**. All 16 items landed, each with a commit in
`notes/B-ground-report.md`. `notes/AUDIT-TRIAGE.md` (03:25) routes me nothing.

**Every item I have taken for seven rounds came out of other agents' commit
messages, not my queue** — 54795f10's `declareSurface` ask, 9e1bce93's routed
one-liner, 4906af20's two calls, GOTCHAS 26, then d0fd37fb's watched-fail
standard. That channel works well enough that I am not idle, but it is not a
queue and nobody is choosing my priorities.

The last two items were self-assigned from my own findings rather than from
anyone's ask, which is the honest description: `canfail.mjs` exists because I
could not say my checks worked, and its rewrite exists because its first version
pushed four `wip` commits onto mainline. Useful work, but nobody asked for it,
and I would rather be told what the world needs than keep choosing.

---

## Closed since the last note

**The three unattributable seam faces are `civic`'s.** I measured them, could not
name them, and said so rather than guessing. 95de74b3's stamps answer it by
lookup:

```
civic   alley floor   (-8.6, 0.14, -13)     3.2 x 16 plane, 31.88 px/m
civic   x~11 mass A   (11.15, 13, -70.5)    5 x 26 x 3.7, 8 px/m
civic   x~11 mass B   (11.3, 8.5, -79.5)    13 x 17 x 3.4
```

4906af20 inferred "civic courtyard paving" and "the church" for these and
labelled it inference rather than fact. **The inference was right on all three.**
The three `declareSurface` lines that close the missing-faces list are civic's
owner's, and that is the whole of the list — 18 → 3 → these.

**The `userData.mod` gap I opened is being closed by other people.** 21.5% → 56.4%
(street 449, civic 135, vice 273, cat 2, on top of walkup/lot/props/tex-ground).
1475 meshes still unstamped; not mine to sweep.

**The silent wrong-world class is closed.** 60 scripts still *default* to :4184,
but all 60 now carry `reportWorld`, so every one of them is loud instead of
silent. That was the actual defect, not the port number.

---

## Verified at HEAD, not assumed

Fifteen mainline commits have touched shared infrastructure under my files since
I last checked the whole thing rather than the part I had edited:

```
health          WORLD OK — __ct initialised
sweep           48 shots, no console errors
footprint · glow · park · wetness · kerbcut · trash · bench · basin    0 FAIL
lane            3 stretches under 1.20 m, all by design (below)
ownership       ✓ every changed source file is yours
```

---

## Standing: the three sub-1.20 m lane stretches are BY DESIGN

Restated because the triage still lists lane work and this is the answer:

| where | free span | what pinches it |
|---|---|---|
| east walk z −34.1 | 1.15 m | my bus-stop bench, x 5.070…5.731 |
| east walk z −92.9 | 1.15 m | my street lamp base, x 5.15…5.55 |
| side st north x 44.8 | 1.15 m | nothing — kerb to building face |

The bench is at the kerb facing the road because that is what was asked for over
four passes; the lamp stands `LAMP_OFF = 0.35` off the kerb on a 1.70 m walk.
Going lower means putting the bench and the lamps in the roadway.

**Correcting my own wording, which I have repeated several times.** I have said
"1.15 m against a 0.72 m capsule is comfortable" as though it settled the
question. It does not. 1.15 m is the **built** lane — every lane figure in this
project, mine included, drops the moving colliders, so they all describe a
pavement with nobody on it. `6168c410` measured it as played, movers included:

```
best 1.12 m · median 0.77 m · worst 0.72 m · under 0.90 m in 14 of 20 samples
never below 0.72 m — the capsule width — so never impassable
```

**Not the retracted 0.77.** `3f7b2623` withdrew a *different* 0.77 — `03d90436`
had attributed the street's tightest passage to a static post, and `213bda5d`
showed it was a citizen walking the centre line. The figures above are
`6168c410`'s, measured with movers deliberately included, and they stand.

The lived median is 0.77 m, and at its worst the gap is exactly the player's own
width. That is not an argument for widening anything: citizens on pavements are
the point of having them, and edging past someone is what a busy street feels
like. It is an argument for saying **which** lane a number describes. Mine
described the empty one and I did not say so.

---

## For whoever owns `turn.mjs` — registering it would add a check that cannot fail

`e90c6736` swept every user request for a guard and named the cheapest fix:
register `turn.mjs`, since it is structural, needs no human eye, and would guard
"do the interior people turn through 8 angles" — a direct request currently
protected by nothing. It declined to do it because `scripts/**` is not its.

**There is a precondition, and it is the thing this project keeps being bitten
by.** `turn.mjs` has no verdict. It classifies each figure and prints it:

```
interior (754.83, -0.65) TURNS   8 distinct frames over 8 headings
interior (841.6, -3.52)  TURNS   8 distinct frames over 8 headings
...
exit=0
```

There is no aggregate line and no exit code. **If every figure came back FLAT it
would still exit 0.** Registered as-is it becomes a green row that means
nothing — the same failure as `trash.mjs`'s count verdict, which printed FAIL
and returned 0 for weeks, and the two scripts that went missing under GOTCHAS 24.

The criterion is not a judgement call; the script states it in its own header:
*"Eight angles means the offset (or the mirror sign) changes as you go round. A
flat card that merely billboards will swing its yaw to face you and never change
frame."* So the verdict is "no sampled figure is FLAT", plus a floor on how many
were sampled, so an empty sweep cannot pass either.

**Not writing it.** Which figures are in scope is the author's call, and that is
the half I would be guessing at. Reported with the measurement so it is one
small block for someone who knows, rather than a row that lies for everyone.

---

## Margins, after rain-memory caught its mutation by 0.005 and then stopped

`0fdf2ecd` was a check that had gone toothless while still reporting green. The
obvious follow-up is: what else on this shelf decides on a hair? Measured every
numeric verdict against its own bar:

| verdict | value | bar | margin |
|---|---|---|---|
| `glow` main / side | 13.7× / 18.7× | 3× | large |
| `basin` throat proud | 6.5 mm | 2–22 mm | 4.5 / 15.5 mm |
| `park` emitters per lantern | 2 | ≥ 1 | 1 |
| `park` beside the loop | 0.95 m | ≤ 1.3 m | 0.35 m |
| `park` lamp count | 10 | ≥ 10 | **zero — deliberate** |
| `kerbcut` measured centre | 0.200 | ≤ 0.2 | **zero — accidental** |

**The two zeroes are not the same thing**, and separating them is the point.

`park`'s count is an EXACT structural quantity — four lanterns per leg on two
legs plus one at each end. Ten is not an estimate, so `>= 10` has no margin to
give and shouldn't: that is the bar that would have let the two end lamps vanish
when it was `>= 8`.

`kerbcut`'s was a **quantised measurement judged to finer than its own
resolution**. The profile bins at 0.2 m, the measured centre came out 2.80
against a declared 2.6, and the test was `<= 0.2` — passing by exactly nothing,
one bin edge from failing a kerb that is fine. Widened to two bins, which costs
no detection at all since the mutation moves the cut 16.6 m.

A tolerance narrower than the measurement's resolution is not strictness, it is
noise with a verdict attached.

---

## I was wrong about bus.mjs's lane sweep, and the runner caught it in a day

In `a44af5e6` I looked at that sweep, measured it three times at x = 6.15, and
argued it was safe from citizens because *"everything at or inside 6.22 would
have to block at once"*. I treated that as implausible. The shared runner then
reported **STUCK at x = 6.28** — exactly that — on a world that returns 6.15 on
a re-run a minute later.

The mechanism I dismissed is ordinary: five sequential 9 s walks down one
stretch is forty seconds of exposure, and one citizen standing kerb-side blocks
every inboard position while letting the outermost past. I was not wrong about
what it would look like, only about it being unreachable.

Fixed the same way the two hikes in that file were: still moving when the clock
stops means the lane is open, whether or not the walker reached the line.
`bus-walk` still CAUGHT the severed pavement, so the looser criterion did not
cost the assertion.

**The lesson is about the argument, not the code.** Three identical runs and a
plausible story were enough to persuade me, and neither is evidence about a rare
event — the whole point of a flaky check is that it passes most of the time. The
run that found it was a full-suite run I did because nothing was routed to me.

---

## RETRACTED: there is no settle ramp. I named the mechanism wrong.

`2558b1ba` says the grade does not lerp, and it is right. I checked rather than
took it:

```
23:00 on a FRESH page                 100:0  200:0  400:0  800:9  1600:9
23:00 from an already-running world   100:9  200:9  400:9  800:9  1600:9
```

**The delay exists only on a freshly loaded page.** Once the world is running, a
clock change lands within 100 ms. What I measured in `2bdebbcf` was first-frame
initialisation — my probe set the clock immediately after `waitForFunction`, and
I read the *page's opening state* rather than a half-applied night.

Three things follow, and the second is the one I got most wrong:

1. **"Settle ramp" is a misnomer.** There is no curve to sit on and no cliff to
   be past. The word came from me and it sent people looking for a shape that
   does not exist.
2. **A too-early read returns the PREVIOUS time of day in full**, not a partial
   grade. That is worse than I described: a plausible wrong number rather than
   an obviously wrong one.
3. **The remedy is one wait, not ninety.** `grade-sane.mjs` had 1200 ms on all
   twenty-four hours — 28 s of sleeping for a problem that exists at the first
   one. One settle after load plus a frame each: **41 s → 18 s**, same verdict,
   `grade-nan` still CAUGHT.

The "90 of 129" list built on my framing needs re-reading with this: a script
that sets the clock once, right after load, is genuinely exposed. One that sets
it repeatedly on a running world is not, whatever its sleep length. That is a
narrower set than the number implies, and narrowing it is my job because the
number is mine.

---

## Triage rule for the 90-of-129 settle-ramp list — still valid, wrong name

`159b9c1c` counted 90 of 129 scripts sampling inside the settle ramp and called
it a candidate list. It is worth keeping it a candidate list, because **the ramp
moves colours and nothing else**. A script that waits 600 ms and then measures a
bounding box is not affected by it at all.

The triage question is one grep: *does anything after the wait read
`material.color`, `.opacity`, or a hex string?* Applied to my own five
candidates:

| script | wait | reads colour after it? | verdict |
|---|---|---|---|
| `footprint` | 900 ms | **no** — boxes and positions | not affected |
| `trash` | 800 ms | **no** — clearances | not affected |
| `basin` | 600 ms | **no** — casting geometry | not affected |
| `kerbcut` | 900 ms | **no** — kerb vertex heights | not affected |
| `park` | 1600 ms | yes — floor luminance and emitters | already past the cliff |

**Five candidates, zero defects.** Every colour-reading check on this shelf
already samples past the cliff: `glow` 1200 ms, `wetness` 5000–9000, `rain`
9000, `grade-sane` 1200 (fixed after I found it at 500), `park` 1600. The
sub-second waits are all in front of geometry, which settles when the world
builds rather than on the day/night curve.

Offered because 90 edits is a lot to make on a list where most entries are
probably like mine, and the rule costs one grep per script to apply.

---

## Answer for `A-nightgrade.md`'s open question: it is the SETTLE TIME

`dd561c9a` left this open — the report reads **0** out-of-range while a direct
probe finds 3 at 23:00 and 74 at 19:00 — and said the difference must be in the
probe's surroundings rather than the test. It is narrower than that, and it is
not the BOX filter or `each[m.uuid]`.

**The grade lerps toward its target after a clock jump instead of snapping**, so
what you measure depends on when you look. Counting materials over 1.0:

```
23:00   200ms 0 · 300ms 0 · 500ms 0 · 1000ms 9 · 2000ms 9 · 4000ms 9 · 8000ms 9
19:00   200ms 162 · 500ms 162 · 1000ms 160 · 2000ms 168 · 4000ms 161 · 8000ms 153
```

At 23:00 there is a hard threshold between 500 ms and 1 s: sample before it and
the world reads perfectly in range. **Any probe waiting ≤500 ms after setting
the clock will report zero and be wrong**, which is the "wrong in the reassuring
direction" that note was worried about a third time.

19:00 never settles at all — it is a ramp hour, the count drifts 162 → 153 over
eight seconds, and no single sample there is a fact about the hour.

My own `grade-sane.mjs` waited 500 ms and is now at 1200 ms with the numbers
written in.

### RESOLVED: 9 and 3 are both right, about different things

`nightgrade` keys its collector by **material UUID** (`each[m.uuid]`, `:78`).
Direct probes — mine, and H's in `de551fc7` — count **mesh instances**. Measured
at 23:00:

```
9 mesh-material pairs · 3 distinct materials
  -38.7,-93.8  -38.7,-85.3  -38.7,-78.4  -38.7,-72.8  -38.7,-69.4
  -8.8,-97.4   -8.8,-68.6            all uuid 435cf9   ← seven meshes, ONE material
  -7.6,-85.6                             uuid 02db0d
  -12.8,-73.9                            uuid 2f9303
```

Seven of the nine share a single material instance, so a per-UUID map holds one
entry for all of them. **Neither count was wrong**; nightgrade answers "how many
materials the grade pushed past white" and the probes answer "how many meshes
show it". Both are worth knowing and they are not the same question — three
things to fix, seven places a viewer might see it.

It was not the settle time, which was my first guess and which `f0c13812` has
since fixed for its own reasons; the count is 3 before and after that change.

Worth passing to H specifically: `de551fc7` wrote two throwaway scene walks to
prove none of the nine were theirs. The three distinct materials are the unit of
ownership, and none carries a `mod` stamp — so that answer still has to come from
ancestry, and the no-owner gap that note filed is the real blocker here.

**The original 9-vs-3 difference is not a counting artefact in the population.** `a343e792` closed their
half (a stale build), and I checked mine three ways at 23:00 with a 2.5 s settle:

```
9 materials · 9 meshes · 9 graded      of 5625 materials / 3396 meshes
```

Nine however you count it, so it is not meshes-versus-materials. What the
offenders have in common is **where they are**: five in a row at x −38.7
(z −69 … −94), one at x −8.8, all outside a main-street box and all unstamped
(`mod = ?`). Five identical boxes in a line reads as one repeated object along
the park's west edge. If the other probe is region-filtered, it would see a
subset for exactly that reason — worth checking on their side, and it is their
filter to look at, not mine to guess at.

---

## For density's owner — your stronger selftest is unreachable from the runner

`0d6d1c03` put `density` into `scripts/canfail.mjs` and gave the best argument
anyone has made for that harness: a rebuilt source mutation cannot be repaired
by the frame loop, and *"props.ts re-stamps `userData.selfLit` every frame; the
sky rewrites `scene.background` every frame"* had beaten a scene mutation twice.

**`scripts/checks.mjs:28` still registers density as `true`**, which routes
`npm run checks -- --selftest` to the script's own `--selftest` flag — the scene
mutation that argument was against. The canfail case runs only when somebody
invokes `canfail` directly with no arguments. Mine does, which is why it appears
in my full runs; the shared runner never reaches it.

That is `e8509118`'s point one level in: written, registered in the wrong place,
and green in a way that credits the weaker mechanism. One character fixes it —
`true` → `['density']` — but which mechanism the runner should exercise is the
owner's call, and wanting both is a reasonable answer. Not editing another
builder's row.

Checked my own while I was there, by diffing the case list against the registry
rather than assuming: all 19 of mine are registered and reachable.

---

## Every check I own samples 3 of 24 hours — swept the other 21

The coverage audit went after space: one of two basins, one of nine pools, one
street of three. It never asked about TIME. My checks run at 13:00, 23:00 and
03:00, and the night grade ramps between them.

Swept all 24 hours for material colours out of the 0..1 range:

| hours | out of range | worst component | worst offender |
|---|---|---|---|
| 09–17 | **0** / 5625 | — | — |
| night (20–06) | 9 / 5625 | ≥1.149 | unstamped box at (−7.6, −85.6) |
| 07, 08 | **158** / 5625 | ≥1.08 | `tex-ground` at (4.4, −92.5) |
| 18, 19 | **161** / 5625 | ≥1.02 | `tex-ground` at (4.4, −92.5) |

**Corrected after `a7f2241d`.** It found `nightgrade` skips multi-material
meshes; the probe I published these from had the same blind spot. It walked
`o.material.color` and never looked inside an array, so it saw **2868 of 5625
materials — 51% of the world**. The ramp-hour counts nearly double once the
other half is included: 91 → 158 at 07:00, 93 → 161 at 18:00. Night and full day
are unchanged, because none of the multi-material meshes offends at those hours.

The worst-component figures are marked ≥ because they were measured on that same
51% subset and I have not re-taken them; they are lower bounds, not maxima.
`scripts/grade-sane.mjs` handles arrays correctly, so the committed check never
had this hole — only the exploratory probe and the note I wrote from it.

**This is a measurement, not a defect, and I am not filing it as one.** A colour
component of 1.08 clamps at render, so those materials are pixel-identical to
ones at exactly 1.0. Nothing is visible, nothing errors, and no page error
appears at any hour.

What it does say is that the grade multiplies past white during the two ramps —
the count jumps ten-fold at dawn and dusk and returns to zero in full day. The
worst single offender at those hours is **mine**: the east catch basin casting.
It would matter if anyone ever added tone mapping, or read a material colour
back and trusted it, which is exactly what several of my own checks now do.

The 9 that persist all night are not mine — unstamped, in the park's region, and
`nightgrade` owns that question.

Recorded rather than acted on, because I have twice this session published a
number that explained nothing, and the fix here would be a change to the lamp
grade — a system reverted once already for a unilateral change.

---

## I left four `pgrep -f` waiters running, and one blocked for 3h29m

`6a4aea00` found waiter processes from another worktree stuck on
`until ! pgrep -f "scripts/checks.mjs"`, one of them waiting three hours
twenty-five minutes on somebody else's run. **They were mine.** Four of them,
identified by my own session id in their command lines:

```
2648138  3h29m  pgrep -f "scripts/checks.mjs"     ← the one that commit saw
2546058  4h02m  pgrep -f "node scripts/canfail"
2746050  2h57m  pgrep -f "scripts/park.mjs"
2995358  1h35m  pgrep -f "scripts/bus.mjs"
```

`pgrep -f` is machine-wide and every checkout has a `scripts/checks.mjs`, so
each of these was waiting on whichever builder happened to be running that name
— their own work having finished hours earlier. Killed by PID, after confirming
each was mine, because matching by name is the whole defect.

**The worst of it is not the idle shells.** 2648138 had three `door301.mjs`
runs queued behind its wait. Whenever some unrelated builder's `checks.mjs`
finally stopped, my session would have spawned three browsers into a world I
was no longer looking at, hours after I asked for them, and attributed the load
to nobody.

I wrote up the other half of this in `b56a8f5a` — a zombie preview passes
`pgrep` and serves nothing — and did not join it to the case I was actively
creating. `pgrep` answers neither *is it alive* nor *is it mine*, and I had
already established the first half myself.

Wait on the PID you started, on the artefact, or on the service answering.

---

## A near-retraction I did not make: my probe picked the wrong 16×16

Went to reconcile my "nine registered" against `3750fa61`'s per-owner table and
briefly convinced myself I had published something false. Two probes said so:

```
litter shadows with userData.wet   0 of 14
"first 16x16 material" dry -> rain  1 -> 1     (no response)
```

Both were my selector, not the world. Keyed to litter parentage instead of
texture size:

```
litter contact shadows: 14 found
  dry  1, 1, 1, 1, 1
  rain 0.1644, 0.1644, 0.1644, 0.1644, 0.1644
```

They respond. `scripts/wetsweep.mjs` had been saying so all along — 11 props
still dry and every one a lamp pool — and I doubted the shared instrument in
favour of a throwaway I had written five minutes earlier.

**"The first material matching a size" is not a selector**, it is a lottery in a
world with 5625 materials. It is the same error as reading geometry and texture
size and skipping `map.repeat`: specific-looking, and about something else. I
have now made it twice, and both times the tell was two of my own measurements
disagreeing rather than anything external.

The committed claim stands unchanged. Recording the near-miss because a
retraction of a true statement would have been worse than the original error.

---

## A zombie preview passes `pgrep` and serves nothing

Cost me a false FAIL on `kerbcut` while verifying at HEAD. `pgrep -f "vite
preview --port 4279"` matched, `curl` refused, and the check died with
`ERR_CONNECTION_REFUSED`. The tell that it was infrastructure rather than a
defect was that it produced **zero verdict lines** — an error, not a red. That
distinction is the difference between "the check ran and disagreed" and "the
check never ran", and it is worth reading before believing any failure.

**No repo-level gap.** I went looking: nothing in `scripts/*.sh` decides
liveness by process. `pinned-suite.sh:81` polls `curl -sf` in a loop until the
port answers, which is the right idiom. My `pgrep` was in an ad-hoc shell
command of my own, not in committed code, so this is a note about how I check
rather than a defect anyone needs to fix.

---

## A tier decision for the desk: my three walkers are in the FAST run

`checks.mjs` says the SLOW tier is *"a runtime tier, not an importance tier"*,
and H's real-time suites (crowd-walk 45 s … corner-traffic 141 s) are in it.
Three of mine walk in real time and are **not**:

```
bus      65 s    two hikes past the stop, plus a five-position lane sweep
park     35 s    four legs of the loop
kerbcut  31 s    four hikes across the cut
                 131 s of the default run, out of ~260 s that is mine
```

By the stated rule they belong in SLOW. **I have not moved them**, and the
reason is a coverage judgement rather than a runtime one: they guard the sacred
2 m lane and the curb cut — one of them is the check that caught its own
flakiness in the shared runner last round, and it would not have if it only ran
under `--slow`.

That trade is the desk's to make, not mine to make quietly. Moving them saves
131 s on the command everyone runs and stops the pavement being checked there.

**What I am deliberately not doing is shaving the walks.** Each sweep position
could drop from 9 s to ~5 s now that "still moving" carries the verdict, saving
~20 s. I have twice reasoned my way to a conclusion about these exact walks and
been wrong within a day, and 20 s off a seven-minute suite is not worth a third
attempt at out-thinking a pedestrian.

---

## CORRECTED: I published `registerWet` from a module that builds too late

`f21111e5` said the publication does not close the runner, and it was right —
for a worse reason than the one it gave. It read `scene.userData.wetness` (the
value) and concluded it would have to copy the wet-look curve by hand, which it
correctly refused to do. But I had also published `registerWet`, the real
`ctx.wet`, precisely so nobody has to copy anything.

**It was unreachable.** `buildProps` runs at `crosstown.ts:210`; `buildStreet`,
which places vice, runs at `:103`. Anything props sets on `scene.userData`
arrives a hundred lines after a build-time caller needs it. **Holding `scene` is
not the same as holding it in time**, and I checked the call order only after
someone told me the answer did not work.

Moved to `ct/tex-ground.ts`, which builds at `:66` — before `buildStreet` and
before `buildProps`. Exercised, not just present:

```
published=yes   returns-same-material=true   wetStamp=true
```

So `scene.userData.registerWet(mat)` is `ctx.wet` itself: one registry, one
implementation of the curve, nothing duplicated into `vice.ts`. The two lines
`f21111e5` describes — `wet` into `buildVice`'s signature and its call site —
are still the tidier home if the desk wants a conflict in `street.ts` for it;
this needs no signature change from anyone.

One writer per material still applies and is stated at the export.

---

## ANSWERED for G, part two: the wet registration is reachable now too

`08ad3f0b` swept its own ground after my centre-lines finding and turned up the
casino's brass-threshold runner, dry for the same reason. It was straight about
the size — `#7a2028` at luminance 0.053 is already darker than wet pavement, so
nobody will see that one — and routed the **pattern** rather than the defect:

> *Two shared systems in a row … have turned out to be ones `vice.ts` cannot
> join, not by decision but because the constructor takes four arguments.*

The night half I answered last round. This is the other:

```
scene.userData.registerWet   ctx.wet itself, re-exported
```

Re-exported and not reimplemented, so there is one registry and one way into it.
Any module holding `scene` can now join the wet-look without widening
`ct/ctx.ts` or its own constructor — which covers the runner, the centre lines,
and the next one nobody has found yet.

**One writer per material, and this is the trap.** Registering a material hands
its COLOUR to `updateRain` every frame. A module that registers and then keeps
tinting the same material will fight it, and the loser is whichever runs later
in `ORDER`. Register the surfaces you do not paint yourself. That constraint is
in the source next to the export, because it is the kind of thing that works in
testing and breaks on somebody else's frame order.

Same caveat as `nightFactor`: if the desk would rather this travelled on
`CtxBuild` — where `wet` already lives — that is the better home and this line
becomes redundant. I am not widening another builder's interface to solve a
problem in mine.

Regression checked: wetness, rain, glow and nightgrade all PASS.

---

## Tried the widen-the-pool fix for the floating litter. It does not work.

`e7cf57085` confirmed my finding independently and larger — **11 objects, up to
129×**, with better method than mine (stepped clock, nearest-ground comparison,
self-lit excluded) — and called it the most player-visible open finding it holds.
So I stopped calling it a look decision and tried the option I had argued for.

I had filed two: widen the ground pool decal to match `LAMP_R`, or pull `LAMP_R`
in to match the decal. The first is the one the request supports — *"light AROUND
THE LIGHT POSTS to show up on the objects"* — light on the ground around the post
is the first clause, and it reached 2.8 m while the second clause reached 7.

Widened the street pool 5.6 → 11.2 m. **`shots/look-gutter-after.png`: the cup is
still near-white.** Reverted.

The reason is structural and it kills that option for good. **The pool decal is
ADDITIVE**: at 3.4 m from centre it adds perhaps 0.05 to a ground sitting at
0.008, while the object's own material is at 0.488. A gradient that adds a
twentieth cannot close a gap of sixty. Widening it lights more ground faintly and
leaves the object exactly as bright as it was.

Two things follow:

1. **The remaining option is the other one** — reduce what the material gain
   gives objects, so nothing out-lights its own ground. That darkens objects the
   user asked to be lit, so it needs a ruling rather than my judgement.
2. **A material-colour metric cannot see this fix either way.** I measured
   "objects >5× their nearest ground" before and after and the numbers moved, but
   the metric reads material colour and the decal never touches it — so that
   movement was method noise, not effect. The only instrument that answers this
   question is the screenshot, which is how the defect was found twice.

---

## All 26 canfail cases are reachable — and my audit of that was nearly wrong

The registry has grown since I last checked it end to end: `canfail.mjs` now
carries 26 cases, six of them other builders'. Verified every one is reachable
from `npm run checks -- --selftest`.

**It is, and my first pass said otherwise.** I grepped for bracketed lists —
`['park', 'park-partial']` — and concluded `wetness`, `faces-bands` and
`park-repro` were orphaned. They are registered in the *string* form:

```
['park-repro', 'is the parked arrangement the same on every load?', 'park-repro'],
['faces',      'does any face read as more than one tone?',         'faces-bands'],
```

Both forms are valid; my pattern only matched one. Fifth time this session a
selector that looked specific has nearly produced a false finding, and the fifth
time it was caught by checking the individual names rather than trusting the
sweep. **A grep is a probe**, and every rule I have written about probes this
session applies to it.

Nothing to fix. Recorded because "three checks are unregistered" is precisely
the kind of tidy, alarming claim that gets acted on, and it would have sent three
owners looking for a problem that does not exist.

---

## The park got topography and my lanterns are fine — checked, not assumed

`9890a47ee` gave the park a mound, a dish and ground falling to a corner. My ten
lanterns are placed at `y0 = KERB_H`, a constant, so terrain moving under them
was the obvious risk — the same remembered-coordinate shape as the three I have
already pulled out of this shelf.

Measured: every lantern lens sits at world y **3.74**, identical, while meshes in
the park box span **0.109 to 1.39**.

That looked damning and **it is not a finding.** `shots/pk-topo-row.png`: the
near lantern stands on the path, the row behind it is planted, nothing floats or
sinks. The 1.28 m spread is benches, bins and the terrace — not the ground under
a lantern. The lanterns sit beside the *path*, and the topography work kept the
path level, which is what a path is for.

Recorded as a negative result rather than dropped, because "constant y over new
terrain" is exactly the argument that would have justified a fix, and the picture
is what stopped it. The measurement was real and the inference from it was wrong.

`park` is green at HEAD with all four legs walked and the entry located.

---

## The fast tier's one red is already fixed — `park` is green at HEAD

`9e1d7f76a` ran the fast tier at `cc46ed50` and found 44 green, 1 red:

```
park FAILED (1)  "could not find the gate entry path -- this check cannot answer"
```

Its diagnosis is exactly right — the locator wanted a path quad touching
`site.maxX` and the y filter excluded every candidate. That is the same failure I
hit in `fd47fd53`, and it was fixed there and in `4dae9afe`, both of which landed
after the commit that run measured. At HEAD:

```
loop straights found: 12.8 m at x -32.5, 12.8 m at x -13.25
gate entry at z -96.90, 1.50 m wide
OK  no lantern stands on the entry (nearest is 1.55 m off its centreline)
park exit=0
```

So the tier is **45 green, 0 red** on current mainline. Recording it because a
twenty-minute suite is expensive to re-run, and the next person reading that
report would otherwise spend a round on a locator that already derives itself.

Worth keeping from their run: **the fast tier now runs past twenty minutes and
had to go detached to finish.** Three of the slowest are mine — `bus`, `park`,
`kerbcut` — and I raised the tier question for them earlier; that number makes it
sharper than when I filed it.

---

## CLOSED: the casino runner darkens now, at the number the clamp predicted

The loop from `5a24c796` closes. It wired the entrance runner to `registerWet`,
watched it come out a pale grey-blue mat **lighter** than the wet pavement, and
reverted — a defect in my wet-look formula, not their wiring. I clamped it
(`e24c959a`) and computed what the runner would then do. `cbc1bfc34` has since
registered it for real:

```
runner at (51.3, -96.9)   dry 0.0691 -> rain 0.0429     -38%
```

**Predicted 0.0428 before it was ever registered; measured 0.0429.** The clamp
was right about the case that motivated it, which is the only way to know a
formula fix landed rather than merely compiled.

*And my first probe for it was wrong.* I selected "a dark red material near the
casino" and got 0.592 — far too bright for `#7a2028`, so it was some sign or
awning. Third time this session a loose selector has nearly produced a false
finding, and the third time the tell was a value that made no sense for the
thing I claimed to be measuring. Keyed to `userData.wet` instead, which is
exactly the registration under test.

---

## LOOKED at a wet night and found litter floating on black ground

Every audit above is a measurement. `5a24c796` fixed my wet-look by *looking* at
a red carpet, so I shot my own areas in a condition I had never examined — a wet
midnight — and the picture shows something no check of mine reports.

`shots/look-gutter.png`: the cup and the newspaper are the **brightest things in
frame**, near-white on a pavement that has gone properly dark. Measured at that
moment:

```
fountain cup   (4.8,-54.3)  brightest 0.488  nearest lamp 3.4 m
coffee cup     (5.3,-35.3)  brightest 0.045  nearest lamp 9.6 m
darkest broad ground sheet: 0.008
```

**61× brighter than the ground it lies on**, and the mechanism is sharper than
"per-material tinting", which is what I first wrote. Measured at the cup:

```
no pool decal covers the cup      the cup is 3.4 m from the lamp
road slab origin (0.0, 0.0)       one 10 x 134 plane, material lum 0.007
```

**The two halves of the lamp disagree by 2.5×.** The material gain reaches
`LAMP_R = 7.0 m`; the visible ground pool is a 5.6 m decal — a 2.8 m radius. An
object anywhere between those radii is lit *as if standing under the lamp* with
no light on the ground beneath it. The cup at 3.4 m is exactly there.

The road's own material cannot help: it is a single 10 × 134 plane with its
origin at (0, 0), so it takes one pool value from a point 54 m from the cup —
the park-floor mechanism again, on the biggest mesh in the world.

**Not a bug in the feature.** "Light around the light posts to show up on the
objects and entities under the lights" is what was asked for and what `glow-pool`
guards; a lit cup near a lamp is correct. The defect is that the ground beside it
stays black, so the cup reads as floating.

**Why no check caught it**: `glow` compares near-lamp against mid-block medians
and gets 13.6×, which is the feature working. Nothing compares an object against
*the ground directly under it*, and that ratio — 61× — is the one a player sees.

Not fixing it here. The remedy is either per-slab materials on the walk
(`tex-ground`) or applying the pool by fragment rather than by material — both
substantial changes to a night system that has been reverted once for exactly
that kind of unilateral rework. Filed with the number and the frame.

---

## Remembered coordinates: four found, and the dangerous ones are the quiet ones

Having pulled three out of this shelf reactively — `kerbcut`'s `CZ`, park's gate
detector, park's walk legs — I swept for the rest rather than wait for a fourth
world change to find them. The class splits by how it fails:

**LOUD** — the coordinate stops matching anything, and the check refuses:

```
basin.mjs   BASINS = [{x: 4.7, z: -92.5}, {x: -4.7, z: -105}]
```

Move a basin and it probes empty gutter, finds no casting and fails. Unpleasant
but honest, and it is how park's gate detector announced its own staleness.

**QUIET** — the coordinate still matches *something*, and the check passes:

```
bus.mjs   past = -38 / -31        "past the bench at -35, the pole at -33.5"
```

Move the stop and a walk that never reaches it still clears a threshold three
metres from where the stop used to be. Nothing refuses; the row goes green.
**FIXED** — the bench stamps `userData.benchAd`, so it publishes its own z, and
the thresholds are derived from it and clear it by 3 m either way:

```
the stop, from the world: bench at z -35.00
OK  southbound: 20.3 m, past the stop     OK  northbound: 21.9 m, past the stop
```

Left alone deliberately: `glow`'s region filters and `footprint`'s `onStreet`
window are *scope* declarations, not locations — they say which street this
check is about. A scope that silently narrows is a real hazard, but widening
them to "wherever the world happens to extend" would make the samples
incomparable between runs, which is worse for a median.

---

## The park loop was re-cut and my check half-noticed

`1da5e891` brought the park's loop in off the boundary and turned its corners.
Two things in `park.mjs` were keyed to the old shape, and only one of them said so.

**The gate detector went blind, loudly — FIXED.** It looked for a path slab
*touching* the street edge (`|x + w/2 − maxX| ≤ 0.35`). The loop no longer
touches it, so the detector found nothing and printed `FAIL could not find the
gate entry path — this check cannot answer`. That is the refusal working: it
declined to pass rather than quietly skipping the assertion. Now it derives the
entry as the path piece reaching furthest toward the street, which survives the
park being re-cut — as it has been three times.

```
gate entry at z -96.90, 1.50 m wide
OK  no lantern stands on the entry (nearest is 1.55 m off its centreline)
```

**The walk legs went blind quietly — NOW FIXED, see below.** Both back legs stopped dead:

```
back leg, north to south: 12.3 m along, 0.00 m in the last 1.5 s
back leg, south to north: 10.9 m along, 0.00 m in the last 1.5 s
```

Identical on every run, so it is static geometry and not a citizen. The legs
walk straight lines at `lx0`/`lx1`; a loop with turned corners cannot be walked
in a straight line, so the walker leaves the path and stops against the
boundary. **They still pass**, because 12.3 m clears the 8 m distance bar — a
check reporting success for a walk that no longer follows the thing it is named
after.

Fixed the round after filing it. The loop publishes its own shape — its long
straights are 1.5 m wide path slabs — so the legs are derived from it, and so is
the hold: 80% of the straight's length at the rig's ~2.9 m/s, which covers the
run without piling into the corner at the end.

```
loop straights found: 12.8 m at x -32.5, 12.8 m at x -13.25
OK  x -32.5  leg, south to north: 11.0 m along, 4.71 m in the last 1.5 s
OK  x -32.5  leg, north to south:  9.2 m along, 2.67 m in the last 1.5 s
OK  x -13.25 leg, south to north: 10.6 m along, 5.03 m in the last 1.5 s
OK  x -13.25 leg, north to south: 10.7 m along, 4.99 m in the last 1.5 s
```

Nine to eleven metres of a 12.8 m straight, still moving at the end of every
one. No dead stops, and both straights found by measurement rather than
remembered. `park`, `park-partial` and `park-walk` all still CAUGHT.

If the park is re-cut a fourth time the legs move with it.

---

## Cleared the live red on mainline: §23 was used twice

`19289805` filed it and it was still failing:

```
§23 used twice: "Real is not the same as visible…" and "Anything with a FRONT…"
§23 appears after §32 — out of order
```

A live red in the shared runner is worse than the defect it names, because it
teaches everyone to read past a red — which is the habit I have spent this
session arguing against in other people's checks.

Applied the **standing rule**, which `539ed470` set and used for the same
collision twice before: *"the LATER commit renumbers; existing references point
at the earlier one."* The later entry became §33.

```
notes/GOTCHAS.md: 33 numbered entries, 1 … 33 — unique and in order
```

Not a judgement call and not my documentation: a documented procedure with two
precedents, applied mechanically. I also repointed the one reference that
explicitly meant the newer entry — `scripts/seatface.mjs:3` read *"GOTCHAS 23
(the newer one)"*, which is itself evidence of the collision, and which my
renumber would otherwise have left dangling. The two references meaning the
earlier §23 are untouched, which is what the rule is for.

---

## FIVE MORE stale copies of the rain formula, none of them mine

`04013742` found the fourth in `basin.mjs` — mine, fixed — and its checker
measured exactly how wrong a stale copy is: **disagrees with the world on 16 of
48 hours**, and passed only because hour 0 happens to be rainy under both. A
predicate right on the hour you pick and wrong on a third of the schedule is a
coincidence with a comment on it.

Swept the shelf for the constant rather than waiting to be told a fifth time:

```
scripts/check.mjs        stale copy, does not read the published rainAt
scripts/bugsweep.mjs     ← this one is `npm run sweep`
scripts/verify3.mjs
scripts/rain-check.mjs
scripts/v5.mjs
```

**None are mine** — `basincheck.mjs` also matches but legitimately, since it
exists to compare the stale formula against the world. All five carry
`imul(h, 2246822519) % 100` and none reads `scene.userData.rainAt`.

`bugsweep.mjs` is the one worth looking at first: it is what `npm run sweep`
runs, so whatever hours it picks are the hours the whole project's smoke test
sees. Reported rather than edited — they are other builders' scripts, and I only
know they hold the constant, not what each does with it.

The five of mine that touch weather all ask the world now: `rain`, `wetness`,
`basin`, plus `wetsweep` and `basincheck` which were written that way.

---

## READY: `floorDrain()` — the casting eb936125 asked me for

> *"The grate has no frame, no depth and no thickness against B's proper kerb
> inlet — match that vocabulary, but as a floor drain rather than a kerb-side
> one, and ask B for the casting rather than drawing a second design."*

```ts
import { floorDrain } from './tex-ground';
floorDrain(scene, x, floorY, z);          // 0.60 m square by default
floorDrain(scene, x, floorY, z, 0.45);    // or size it
```

A plain export, so there is no build-order question — call it whenever the alley
floor is placed. `y` is the floor height at that point; the caller knows its own
floor and this does not guess.

Measured against the kerb inlet it is copying:

```
frame top   24.0 mm above the floor
bar top     13.0 mm
rebate      11.0 mm      — identical to the kerb inlet
solids      12           void + 4 frame + 7 bars
```

**It is not the inlet with the kerb deleted.** That casting has a throat — the
opening under the kerb face, with a lintel standing 7 mm proud so it reads as a
mouth at the 20° people stand at. A floor drain has nowhere for a throat to go:
water arrives from every side rather than down a gutter. So the throat and its
surround are dropped and everything else is kept exactly, which is the whole
point of asking for the casting instead of drawing a second one.

Parts carry `userData.basinPart` (`void`/`frame`/`bar`), so a check can find
them by name rather than by size.

Not placed by me — where the alley drain goes is `ct/street.ts`'s call.

---

## ANSWERED for G: props publishes the night factor and the rain now

`4462995c` found `ct/vice.ts` deriving "how dark is it" from `scene.background`
luminance, and `props.ts` lerps the sky toward `RAIN_SKY` when it rains — so a
downpour LIFTS the value that heuristic reads and it puts 12.5% *less* glow on
wet asphalt. Backwards against a brief that asks for colour thrown onto wet
asphalt. It ruled the fix to be mine: *"let the thing that knows say so, instead
of three modules each guessing it from appearances."*

Done, on `scene.userData`, updated every frame from the values props already
computes:

```
scene.userData.nightFactor   0 broad day … 1 fully night
scene.userData.rainLevel     0 dry … 1 downpour
scene.userData.wetness       how wet the GROUND is; lags rain
```

The case that motivated it, measured:

```
23:00 dry night   night=1.000  rain=0.000  background=0.0053
00:00 WET night   night=1.000  rain=0.738  background=0.0476   ← 9x lift
```

The background lifts nine-fold and `nightFactor` does not move. Any module
holding `scene` can read it — no new plumbing, and none of the cross-module
material sampling `4462995c` rightly called worse than the bug.

**On `scene.userData` rather than the `Frame` interface** because `ct/ctx.ts` is
not mine to widen. If the desk would rather it travelled on `Frame`, that is a
one-line addition there and these three writes become redundant; I would not
change another builder's interface to answer a question about mine.

Regression checked: glow, park, wetness, grade-sane, nightgrade and rain all
PASS; grade-nan and rain-memory still CAUGHT.

---

## `h % 24` silently tests a different hour — and my −83.5% was affected

`fc18e7f5` corrected a −83.5% wet-night figure to −46.8% once stepped, naming a
path-dependent dry-night baseline: jumped 0.04500, stepped 0.01335. **0.04500 is
the number I published in the two-paths diagnosis below and divided by.** So my
"night at exactly the daytime strength" is overstated; theirs is the better
measurement and my section is corrected by it.

Chasing why, I found something narrower that affects any script picking a
weather hour:

```
crosstown.ts:567   clock: (h, m) => { totalMin = h * 60 + m }
crosstown.ts:681   hourAbs: Math.floor(totalMin / 60)
```

**The hour you pass IS the absolute hour**, and `rainAt` keys on it. So a script
that searches the schedule for a rainy absolute hour — 95, say — and then calls
`clock(95 % 24)` sets hour 23 and tests whatever *its* weather happens to be.
The time of day still wraps correctly, so nothing looks wrong. `rain.mjs` did
exactly this in two places; fixed to pass the absolute hour.

**My own re-measurement was wrong the same way**, which is how I found it: I
validated a 13-hour dry spell on absolute hours and then stepped through
`h % 24`, so the walk went through a completely different weather sequence than
the one I had checked. Two of my measurements disagreeing, again, and again the
probe was at fault rather than the world.

I could not settle whether my weather fix removes the path-dependence
`fc18e7f5` found — the instrument I built to test it had this bug — and I would
rather say that than publish a third number. What is fixed is the truncation.

---

## DIAGNOSED for c68f09f5: the wet look does not die at night, it is TWO paths

`c68f09f5` routed this to props.ts: *"the wet look survives the night grade on
tex-ground and dies on street. Not diagnosed, and not mine to fix."* Measured at
a dry night against a rainy night, split by which registry a material is in:

```
street     registered    4/4      0.04500 -> 0.00741   -83.5%
street     lit-only    436/556    0.08507 -> 0.08273    -2.7%
tex-ground registered   13/13     0.04500 -> 0.00740   -83.5%
tex-ground lit-only      7/41     0.46959 -> 0.46949   -0.02%
```

**Nothing dies.** Every wet-registered surface responds at night at exactly the
daytime strength — 62 of 62 across all owners, −83.5%. What varies is not
tex-ground versus street, it is **registry versus registry**, and both modules
have members of each.

There are two wet paths in my file and they are thirty times apart:

1. `wetMats` — `updateRain` writes the colour, lerp toward `WET`, full strength.
2. `litList`'s `wetK` term — a secondary tint on graded materials, and at night
   it moves them 2.7%.

So the honest statement is narrower than either "nothing works" or "it dies on
street": **a surface gets the real wet look if and only if somebody called
`wet()` on it.** The rest get a 2.7% nudge that is invisible against a night
floor of 0.045.

That reframes the player complaint too. "A player walking home at 23:00 in the
rain sees a dry road" — the road is registered and goes −83.5%. Whatever that
player is looking at, it is not the road surface.

**Not acting on it unilaterally.** Strengthening `wetK` at night changes the
look of every graded material in the world after dark, and this system has been
reverted once for exactly that kind of change. The actionable half is the
enumeration `baa675d7` already built: anything that should look wet needs
`wet()`, and `scene.userData.registerWet` makes that reachable from any module.

---

## ROUTING: the road centre lines stay bone dry in a downpour

`5333a1ce` found the alley dry in the rain because it was never passed to
`wet()`. That is a completeness question about my registry, so I asked it of the
whole world rather than the one surface, and found another.

Measured at a rainy daytime hour against a dry one, material luminance:

```
wet-registered materials      33, every one darkens 82.9–83.4%
road centre lines             35 segments, 0.2927 -> 0.2927 = 0.0%
```

**A bright dry stripe down the middle of a road that darkens 83%.** Identified
precisely so its author recognises it without a coordinate hunt:

```
0.5 x 134  at (0, -31)     y 0.030   tex 8x32   alphaTest 0.5
0.5 x 48   at (30, -103)   y 0.032   tex 8x32   alphaTest 0.5
        graded = true      wet = false      mod = unstamped
```

They are in the NIGHT registry and not the WET one, so they dim after dark and
ignore the weather entirely. **Not mine** — neither of my two files makes an
8×32 texture, and I checked rather than assumed. The mesh carries no `mod`
stamp, which is exactly the no-owner gap `de551fc7` filed; I could not identify
the author from the scene, only rule myself out.

The registry itself is healthy — 33 of 33 darken uniformly — so this is a
missing `wet()` call, the same shape as the alley, not a broken mechanism.

**43 ground slabs carry no wet registration in total.** Most are plausibly
indoor or covered and I am not filing them; the two centre lines are the ones
that sit on a surface measured to darken 83% around them.

---

## Still needing routing, not self-assignment

1. ~~**The fog line**, `crosstown.ts:504`~~ **WITHDRAWN — measured at HEAD and
   it does not reproduce.** I asked for this every round for weeks on evidence I
   never re-took. The line is now `crosstown.ts:672` and the fog is not grey:

   | hour | fog | sky | darkest graded floor |
   |---|---|---|---|
   | 23:00 | **0.0026** | 0.0053 | 0.030 |
   | 13:00 | 0.2988 | 0.2988 | 1.000 |

   The fog is DARKER than the floor it sits against — black, which is what
   "night fog should go toward BLACK not grey" asked for. Night pass five took
   the floors and the sky down after I wrote the complaint, and the complaint
   went on being repeated. Nobody should spend a line of `crosstown.ts` on it.
2. **Findings B and D need a verdict.** B ("mid-block dark") I recommend closing
   as superseded by night five. D ("parking never re-rolls") is `ct/rng.ts` and
   `ct/cars.ts`.
3. ~~**The lamp-pool flat top**~~ **WITHDRAWN — the measurement does not
   reproduce either.** I cited "77 materials at full daylight, median 1.25 m
   from a lamp" for weeks. At HEAD, 23:00:

   ```
   96 of 428 graded materials saturated · 87 of those are selfLit
   median distance to the nearest lamp: 19.93 m
   ```

   Twenty metres is not a lamp pool. The saturated set is overwhelmingly signs
   and lit windows, which are supposed to be bright at night, and `nightgrade`
   — which owns that question — is green. There was no flat top to rule on.

   The 9 saturated materials that are NOT selfLit are the only residue, and
   they are `nightgrade`'s to judge, not mine to assert. I am not filing them as
   a finding; I have already sent one owner a false positive this session by
   publishing a number without checking the term that explained it.
4. **A `'light'` kind for `SurfaceKind`** — `ct/paint.ts`, A's call. Five of the
   nine textures I declared are light, not material, and `'detail'` is the
   closest honest fit rather than the right one.
5. ~~**`density` is red, and the face is `civic`'s.**~~ **WITHDRAWN — I was
   wrong, and the face was always correct.**

   I routed this to civic's owner with the geometry measured and the conclusion
   guessed: `BoxGeometry 5 × 26 × 3.7` carrying one `40 × 208` canvas, 8 px/m
   across the 5 m face and 10.8 across the 3.7 m ends. Every number there is
   real. The conclusion drawn from them — that it needs per-face maps — is not,
   because `ct/civic.ts:1169` already does the thing I said was missing:

   ```
   towSide.repeat.x = TOWER_D / TOWER_W;
   ```

   The canvas still covers 5 canvas-metres of wall. `5e117dc6` found it from the
   other end: the fault was in `density` itself, which compared declared metres
   against raw face width and ignored `map.repeat`. It passes now, and the wall
   never changed.

   **What I should have done differently is specific.** I checked geometry and
   texture size and stopped, because those two agreed with the failure and made
   a tidy story. `map.repeat` is the third term in that arithmetic and I never
   read it — on a mesh I did not own, to route work to somebody who did not need
   it. "Measured rather than inferred" was true of the numbers and not of the
   conclusion, which is the harder half.

---

*Updated 2026-07-25 after the reportWorld convergence. Report at
`notes/B-ground-report.md`.*
