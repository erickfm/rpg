# Item 257 — six stale "interiors-walk is dev-only" claims retired, and `glow-park-dark` registered

Worker onehundredthree. Three commits: `a80e2a909`, `19eefd758`, `4dd086a93`.
All measurement on the **built bundle** — `npm run build` + `npx vite preview
--port 4590 --strictPort`, port proved free with `ss -ltn` first (4590 and 4591
both free; 4186, 4191, 4270, 4271, 4370, 4420, 4430, 4440, 4470, 4490, 4491,
4510, 4520, 4562, 4563 and 5177 were taken).

**§0 caught me: the worktree was at `f5fcd52ac Initial commit`.** Reset to
`add-stick-and-city98` (`2f428391f`) + `npm install`. Then the shared-checkout
guard caught me a second time when I ran `npm run build` from
`/home/erick/projects/rpg/street` out of habit. Both guards worked exactly as
BUILDER-BRIEF §0 says they would. **No `CT_ALLOW_SHARED`.**

---

## Part 1 — root cause in one line

**Item 251 made `interiors-walk.mjs` bundle-runnable but could not edit the
files that *describe* it (BRIEF §9), so six places still told the next reader it
was impossible.** A comment that describes a limitation we removed sends someone
to re-solve it.

### Measured before rewriting a word of it

The item is a hypothesis (§6). I did not take 251's numbers on trust:

```
SHOT_URL=http://localhost:4590/ node scripts/interiors-walk.mjs church
→ 29/29 passed, EXIT 0        against `vite preview`
```

and the harness population `slow-pinned.sh` calls dev-only:

```
grep -n "import('/src/" over interiors-walk, mirror-walk, G-rooms-walk, G-vice-walk
→ 7 hits, and EVERY ONE IS A COMMENT.  Zero runtime source imports remain.
```

### The six, and what each said

| where | the stale claim |
|---|---|
| `scripts/checks.mjs:902` | *"The ONLY check that walks into a room in a BUILT BUNDLE. interiors-walk above cannot"* — the one the item named |
| `scripts/integration-doors.mjs:9` | *"it CANNOT run against a build"*, plus a pointer to `AUDIT-INSTRUMENTS.md` for "why converting it is not a one-line swap" |
| `scripts/integration-doors.mjs:41` | the same claim again, at the `SHOT_URL` line |
| `scripts/slow-pinned.sh:83` | *"four harnesses … are DEV-ONLY and cannot measure the bundle at all"* — **the stated reason the pinned default is `dev`** |
| `notes/AUDIT-INSTRUMENTS.md:672` | §*"Why `interiors-walk` failed six times: it needs a DEV server, not a preview"*, ending *"so the rule is … never `vite preview`"* |
| `notes/AUDIT-INSTRUMENTS.md:1351` | §*"The room suite cannot measure the bundle"* — the section `integration-doors.mjs` cited by name |

**Two more found by a final grep, outside anything the item named** — the DONE
WHEN says *anywhere*, so I did them and I am flagging them:

| `src/proto/ct/apartment.ts:182` | justified publishing the walk-up spawn on `scene.userData` by citing *"interiors-walk … cannot run against the built bundle at all (af5b68cd)"*. **The rule it argues for is right and is now better supported** — that precedent was FIXED, not worked around. Comment-only; `git diff` filtered for non-comment lines returns **nothing**. |
| `scripts/probes/w93-item246-iw-bundle-gap.mjs` | the probe that measured the gap 251 then closed. Marked **SPENT** rather than deleted: run today it prints *0 dev-only import sites*, which is the right answer, and its counting method (size the conflict before choosing between "fix it" and "declare an exemption") is the reusable part. |

`notes/BUILDER-BRIEF.md` §10 was **already correct** — 251 updated it. Nothing to
do there, which is the answer to the item's "grep BUILDER-BRIEF".

`notes/archive/` and the dated handoff notes are **deliberately untouched**: they
are history and rewriting them would make the record lie about what people found
at the time. The two `AUDIT-INSTRUMENTS.md` sections got a dated ⚠ block above
the original text for the same reason — the six failures really happened and the
diagnosis was right on the day; only the conclusion has expired.

### Left alone on purpose, and it is the desk's call

**`slow-pinned.sh`'s default is still `PINNED_MODE=dev`, and its justification is
now void.** Flipping it changes what the standard slow run measures for every
builder — a coverage decision, not a comment fix, and the same asymmetry
`checks.mjs`'s own D-walk comment reasons about. Corrected the claim, wrote down
that the default now stands on nothing, did not move it. **Worth a row.**

---

## Part 2 — `glow-park-dark`, and it must fire the RIGHT bar

Registered in `scripts/canfail.mjs` (after `glow-buried`) and added to the
`glow` case list in `scripts/checks.mjs`. Needle verified live: `  const
parkSite = site('park');` matches **exactly 1×** in `src/proto/ct/props.ts:2134`,
and the whole ten-lantern block sits behind `if (parkSite)`, so a null site
builds none of them.

`node scripts/canfail.mjs glow-park-dark` → **1/1 CAUGHT**, green pre-pass.

### But CAUGHT is not the assertion the item asked for

Item 248's warning is that the **coverage** assertion passes when the park is
emptied, and the per-region `stamped` bar is the thing that must fire. `canfail`
prints only CAUGHT, so I applied the mutation by hand, rebuilt, and read
`glow.mjs`'s own output:

```
mutated:
  ok    all 11 stamped lamps fall in exactly one region (main, side, park)   ← COVERAGE PASSES
  FAIL  the park region stamps only 0 lamp(s) — need at least 8.             ← the stamped bar
  FAIL  the park region contributed only 0 usable … of 0 stamped — need at least 4.
        main: 8/8 usable (bars: 6 stamped, 4 usable)
        side: 3/3 usable (bars: 2 stamped, 2 usable)
        park: 0/0 usable (bars: 8 stamped, 4 usable)
  exit 1

restored (byte-for-byte, `git diff` empty), rebuilt:
  ok    all 21 stamped lamps fall in exactly one region
        park: 5/10 usable (bars: 8 stamped, 4 usable) — 3.81x, 5.03x, 3.69x, 3.34x, 3.91x
  exit 0
```

**248 was right and it is now proved on every run rather than once by hand.** The
coverage line is green under the mutation — there are no lamps left to be
unclaimed — and a bar *derived* from the stamped population would fall with it.
Only a **declared** per-region `stamped` bar sees deletion. That reasoning is
written into the case's comment, along with the tell: **if this case ever starts
being caught by the coverage line instead, a bar has gone to sleep.**

---

## Green, all on the bundle at `4dd086a93`

| | |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run build` | **0** |
| `node scripts/health.mjs` | **0** — `build 4dd086a93`, `WORLD OK` |
| `npm run sweep` | **0** — 96 shots, **0 STATION MISS, 0 COVERAGE** |
| `node scripts/bugsweep.mjs` | **0** — **0 STATION MISS, 0 COVERAGE** |
| `canfail glow glow-pool glow-blind glow-buried glow-park-dark` | **5/5 CAUGHT**, green pre-pass — the existing family is intact, not just the new case |
| `canfail --plan` | `5x glow.mjs probe` (was 4) — the registration is real |
| `interiors-walk church` on the bundle | **29/29, exit 0** |

**`health.mjs` exit 3 twice, and it was right both times.** Both were me
committing *after* building, so the served bundle's sha trailed HEAD. Exit 3 is
"nothing measured", not "broken" — it named the cause and the fix in one line.
Worth recording as the check working, since a builder who reads exit 3 as a red
goes looking at their own change.

---

## Found and NOT fixed — for the desk to queue

1. **`checks-registered.mjs` is RED, pre-existing and not mine.**
   `scripts/ghosts.mjs` *"has a --selftest and is in no tier of `npm run checks`"*
   — so it runs never. **Proved pre-existing rather than assumed:** `ghosts`
   appears in `checks.mjs` exactly once before and after my change, and that one
   hit is `:1323`, a comment (*"reverting the one line gives 18 ghosts"*), not a
   registration. My edit added a string to an array and a comment block; it
   dropped nothing. This is exactly the failure `checks-registered` exists to
   catch, and it is currently catching it and being ignored.
2. **`slow-pinned.sh`'s `PINNED_MODE` default** — see above. Its stated reason is
   gone; the default is not.
3. **A clean full `interiors-walk` run still exits 1 for pre-existing reasons**
   (251 recorded them: the jail light, four `customer station` fails, and a
   `[interior:hotel] NO BUILDING NAME` kit warning that alone forces exit 1).
   **I ran `church` only** — 29/29, exit 0 — because the claim under test was
   *"can it run on a bundle at all"*, not *"is every room green"*. A full
   12-room bundle run is ~10 minutes and belongs to whoever takes the hotel-kit
   row. **I am not claiming the full suite green.**

## Derived vs copied

The `glow-park-dark` needle is **copied** from `notes/ninetyfive-item248-*.md`
with a line-number citation (`props.ts:2134`) and **verified against live source
at 1 occurrence** before registering — canfail's own pre-flight would have said
`NEEDLE matched 0x` otherwise, but a needle that is stale in the note is a needle
that was never really checked. It cannot be imported: `canfail.mjs` mutates
source text, so quoting text is the mechanism, not a duplication.
