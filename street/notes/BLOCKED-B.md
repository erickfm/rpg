# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

`notes/queues/B-ground.md` — md5 `b5f65064`, 2026-07-24 23:30, **byte-identical
for seventeen rounds**. All 16 items landed, each with a commit in
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

**The 9-vs-3 difference is not a counting artefact.** `a343e792` closed their
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
