# Item 223 — casinodoor registered; TOUCH_MARGIN published; the reachMargin docstring corrected

Worker **eighty**, 2026-08-03. Base `e377bb222`, work landed as `c2c3ac7d5`.
Port **4360** (`ss -ltn` clean before binding; `vite preview --strictPort`).
Verified on the **built bundle**, not dev.

---

## The row was right about both halves, and understated the second

Item 223 said `reachMargin()`'s docstring "describes a predicate `fp.ts` stopped
using". It is worse than that. For a **standing** player, `REACH_MARGIN` is used
**nowhere in `pickSpot`**:

```
fp.ts  const touching = d < s.r + TOUCH_MARGIN;                        aim-free
fp.ts  const looked   = d < reach && offAxis < lookTolerance(s.r, d)
                        && (!seated || d < s.r + REACH_MARGIN);        aimed
fp.ts  const near     = seated ? false : touching;
```

The only surviving uses of `REACH_MARGIN` are the **seated** clause — an `&&` that
can only ever *shorten* the seated reach — and the outer ring the debug volume
overlay draws (`fp.ts` `SpotOutline.volume`). So the constant whose name says
"reach" governs neither half of a standing player's selection.

Docstrings corrected in **`src/proto/crosstown.ts`** (at `reachMargin`) and at the
constant itself in **`src/proto/fp.ts`**, which was telling the same story to
anyone who grepped it. **No predicate and no value changed.**

## `__ct.touchMargin()` is published, and the "no runtime path" claim is exactly true on the bundle

`crosstown.ts` now exports `touchMargin: () => TOUCH_MARGIN`, imported from
`fp.ts` so there is no second copy.

The item said no harness could derive it. Seven harnesses *look* like a
counter-example — they do `await import('/src/proto/fp.ts')` inside the page.
**That path is the dev server only.** Measured, not assumed
(`scripts/probes/w80-touchmargin-reachable.mjs`, against `vite preview`):

```
import('/src/proto/fp.ts')  UNAVAILABLE — TypeError: Failed to fetch
                            dynamically imported module: /src/proto/fp.ts
__ct                        reachMargin()=0.6   touchMargin()=0.15
```

So on the bundle the user ships — the world GOTCHAS 28 says to believe — the
number had **no runtime path at all** before this commit.

## HOW MANY WERE USING THE WRONG CONSTANT: 9 call sites in 6 files, 2 of them registered checks

Comparing against `REACH_MARGIN` (0.6) or a hand-typed `0.6` where `fp.ts`'s
aim-free test uses `TOUCH_MARGIN` (0.15) — a 0.45 m error, 4× the real margin:

| site | what it does | direction of the error |
|---|---|---|
| **`scripts/O-jail-walk.mjs:116`** *(registered, slow)* | `near: d < s.r + reachMargin()` | **FALSE GREEN** — calls the jail [E] "within reach" out to 1.65 m where the world offers it unaimed to 1.20 m |
| **`scripts/O-jail-walk.mjs:212`** *(registered)* | `gap > r + REACH_MARGIN` | false red — 0.45 m stricter than the world |
| **`scripts/A-eye-height-holds.mjs:162`** *(registered)* | `s.d <= s.r + 0.6`, hand-typed | **FALSE GREEN** — counts spots as usable that an unaimed player is not offered |
| `scripts/A-eye-height-holds.mjs:168` | prints `reach (r + 0.6)` | misreports |
| `scripts/D-look-selects.mjs:100` | `if (sp.r + REACH_MARGIN >= 3.0) continue;` — the "proximity cannot explain a hit at 3 m" filter | over-strict; discards good candidates |
| `scripts/D-look-selects.mjs:202` | prints "reach ends at r + 0.6" | misreports |
| `scripts/O-verify-N-rent.mjs:51` | `near: d < s.r + 0.6`, hand-typed | false green |
| `scripts/probes/O-jail-walk-fix.mjs:55` | `near: s.d < s.r + REACH_MARGIN` | false green |
| `scripts/probes/F-diag-owalk.mjs:112, 201` | both of O-jail-walk's, copied | as above |

**Correct, and worth not disturbing:** `scripts/probes/w69-what-a-seat-can-reach.mjs`
uses `reachMargin()` for the **seated** case, which is the one case that really is
`REACH_MARGIN`.

**Hand-typed because there was no runtime path** (all now fixable in one line
each): `A-verify-select-through.mjs:58` (`const REACH = 0.6` — and it is passed
into the page and *never referenced*, so it is dead as well as stale; its own
comment asks for exactly the `__ct` line this commit added),
`A-eye-height-holds.mjs`, `O-verify-N-rent.mjs`, and
`probes/w47-band-model.mjs:25` (`const TOUCH_MARGIN = 0.15` — right constant,
hand-typed).

**None of these were touched.** Every one is a file item 223 does not name
(BUILDER-BRIEF §9). They are listed here precisely enough to queue.

## casinodoor is registered — and the row needed a new shape in the runner

`scripts/checks.mjs`: **137 rows → 138**, default tier (~5 s, does not walk).
It asks what `doors-declared` cannot: whether the [E] actually *fires* over a
band a player can stop in, and whether pressing it puts you inside. That is the
gap `e6c08482` fell through — declaration painted, trigger absent.

**Why `checks-registered` never caught it:** that guard greps for the literal
`argv.includes('--selftest')`, and casinodoor declares its flags through
`lib/flags.mjs`. The blindspot `notes/M-selftest-blindspot.md` records, and that
cost `M-bank-int-walk` seven commits.

**The selftest column had no shape for two flags.** `true` appends the literal
`--selftest` and nothing else, so `--selftest-gone` — the case aimed at the
declaration-never-arrived bug this file exists for — could never have run. The
column now also accepts **an array of flags**, one invocation each, discriminated
on the leading `--`. Exactly one registry row uses that shape (verified by scan;
the only other `['--selftest']` in the file is inside a comment), and a row that
**mixes** flags with canfail case names exits 2 rather than handing `--selftest`
to `canfail.mjs` as a case name.

Both signs of the new branch watched:

- a failing flag reddens its own row and exits 1 (`--bogus-flag` → `FAILED (2)`)
- a mixed column exits 2 with the message, before running anything
- the canfail branch is untouched: `--only health --selftest` still runs
  `canfail.mjs health-dead` and passes (33 s)

## The publication was made load-bearing rather than left as an API nobody asserts

casinodoor's band leg was a **lower bound** its author explicitly flagged:
*"tighten it to an equality once `__ct` publishes the touch margin"*. It is now
the **exact set** of sample points inside the aim-free disc, both terms read off
the world (`r` from `__ct.spots()`, the margin from `__ct.touchMargin()`):

```
r 1.05 + touchMargin 0.15 = 1.2, dz 0.55 → touch chord 2.13 m → x 50.5, 51, 51.5, 52
fired at x [50.5, 51, 51.5, 52]                                     8/8 passed
```

The equality is arithmetic, not a chosen threshold: the sweep warps to yaw 0 with
the door roughly **behind** the walker, so `looked` cannot fire and `touching` is
the only path in. Two further legs guard it — a **population floor** on the
prediction itself (a geometry predicting an empty band would make the equality
vacuous, GOTCHAS 79) and a **containment** leg, because a prompt firing outside
the aim-free disc with the door behind you is the user's *"i select stuff without
even looking at it"* coming back.

**Watched red, both directions:**

| mutation | result |
|---|---|
| `touchMargin()` wired to `REACH_MARGIN` | **RED** — predicts 6 points over a 3.11 m band against the 4 the world fires. That 3.11 m is precisely the figure casinodoor's own header says the stale docstring produced |
| `touchMargin` not published at all | **exit 2**, "CANNOT MEASURE" — not a pass, not a red |

**Stable: 5/5 runs, 8/8, identical band** (`scripts/probes/w80-casinodoor-stability.sh`).

---

## Found and NOT fixed — for the desk to queue

### 1. `checks-can-fail.mjs` parses the registry line by line, and it both lies and miscounts

`scripts/checks-can-fail.mjs:94` matches `^\s*\['([a-zA-Z0-9._-]+)',` per line.
Two consequences, both demonstrated:

- **A false accusation.** A row whose selftest column wrapped onto a continuation
  line reads as an empty column. `w40-bed-vs-door` declares two canfail cases on
  its second line and is accused of having "no way to go red" **on mainline
  today**. I hit this: wrapping my own row made it the second accusation, and I
  kept the column on line one as a workaround rather than edit a file item 223
  does not name.
- **A phantom check.** That same continuation line is *itself* counted as a row
  named `w40-near-outright`, which "declares a failing path" and is therefore
  never questioned. The guard reports **138 registered checks where `CHECKS` holds
  137**.

One parser fix (accumulate continuation lines to the closing `]`) settles both.
Note the guard is **red on mainline already** — the other two names,
`w75-site-contained` ×2, are *correct* accusations: three rows share that script
name and two of them are `false`, and they cannot be put on the `NO_PROOF_YET`
register either, because the staleness check resolves a duplicated name to the
**first** row, which declares. So a duplicated check name cannot be admitted to
the debt register at all.

### 2. `w40-bed-vs-door` is a registered check that can only run on the dev server

`scripts/w40-bed-vs-door.mjs:121` derives `RADIUS` and `TOUCH_MARGIN` via
`await import('/src/proto/fp.ts')`. Against `vite preview` that rejects (proved
above), so the check cannot answer its own question on the built bundle — the
world GOTCHAS 28 says to verify against. `RADIUS` still has no `__ct` publisher;
`TOUCH_MARGIN` now does. The same applies to six probes:
`probes/w40-301-grid`, `w40-301-who`, `w40-227-frame`, `w54-doorway-yaw`,
`w54-firing-station`, `w54-turn-stability`.

### 3. `A-verify-select-through.mjs:58` holds a dead constant

`const REACH = 0.6` is passed into `p.evaluate` and never referenced inside it.
Its own comment names the fix this commit shipped.

---

## Verification run

| | |
|---|---|
| `tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK — __ct initialised`, exit 0, build `c2c3ac7d5` |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0 |
| `casinodoor` | 8/8, 5 runs, exit 0 |
| `casinodoor --selftest` / `--selftest-gone` | both caught their targeted legs |
| `checks-registered` | exit 0 |
| `checks-can-fail` | exit 1 — **same three names as mainline**, no new accusation |
| `citations-resolve`, `no-import-cycles`, `no-silent-pass` | exit 0 |
| `mutations-quote-real-source` | exit 1 — **pre-existing**, 4 dead cases in `bank.ts`/`props.ts`, files this commit does not touch |

Pre-existing and unchanged: `[interior:hotel] NO BUILDING NAME` in the sweep.
