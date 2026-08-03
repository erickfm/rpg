# onehundred / item 84 — three loose-end checks, and what the row got wrong

**The row's headline claim is true of ONE of its three files.** It said all
three "print failures and then exit 0". Measured before touching anything:

| file | the row's claim | measured |
|---|---|---|
| `scripts/ghosts.mjs` | prints failures, exits 0 | **TRUE, and worse than stated.** No `process.exit` and no `process.exitCode` **anywhere in the file** — `grep -c process.exit` returns **0**. There was no input, real or imagined, that could make it non-zero |
| `scripts/side-walk.mjs` | prints failures, exits 0 | **FALSE.** `process.exitCode = fails ? 1 : 0`, and I watched it exit **1**. But it *was* red, on a defect that does not exist |
| `scripts/unstick-walk.mjs` | prints failures, exits 0 | **FALSE.** `process.exit(fails.length \|\| errs.length ? 1 : 0)`. Audited all 10 `console` lines against the two fail paths — nothing escapes |

So two of three were already correct about their exit codes, and the interesting
work was elsewhere in each.

---

## 1. `ghosts.mjs` — could not fail, and is not registered anywhere

Fixed: a `verdict()` function, `process.exit(bad.length ? 1 : 0)`, and a
`--selftest`.

**What counts as failure is the corridor answer MOVING, not ghosts being
present**, and that is the file's own reasoning rather than a line I drew. Its
header states the monotonicity: the long-window static set is a **subset** of
the short-window one, so dropping ghosts can only ever make a passage **wider**.
A ghost is conservative — it can manufacture a falsely NARROW finding and never
a falsely clear one. Failing on ghost *count* would have made this permanently
red every time a citizen paused for 1.5 s.

`--selftest` drives the verdict with synthetic input, no browser and no world,
because the failing case needs a citizen to stand still through the whole window
and cannot be arranged on demand. **5 cases, 2 that must pass and 3 that must
fail**, with a population floor asserted first.

**It caught my own fixture on the first run**: the "count differs" case varied
*both* fields and raised two complaints instead of one. My test was wrong, not
the verdict. Kept as a comment rather than quietly corrected.

Second bug, same file: `reportWorld(page, url)` was called `reportWorld(p)`, so
the one line whose whole job is naming the world under measurement printed
`measuring undefined` — the GOTCHAS 48 banner naming no port at all.

> **FOR THE DESK: `ghosts.mjs` is not in `checks.mjs`'s registry at all.** That
> is precisely why "no exit code whatsoever" survived — `checks-can-fail.mjs`
> only audits registered rows, so an unregistered script is invisible to the
> instrument built to catch exactly this. Registering it is a `scripts/checks.mjs`
> edit, which this item does not name.

### ⚠ I HAVE TURNED `checks-registered` RED, ON PURPOSE, AND IT IS CORRECT

Giving `ghosts.mjs` a `--selftest` moved it into `checks-registered.mjs`'s
population — that audit's population **is** "scripts carrying a `--selftest`" —
and it immediately reported the truth:

```
WRITTEN BUT NEVER REGISTERED — these run exactly never:
  scripts/ghosts.mjs  has a --selftest and is in no tier of npm run checks
```

**Measured, so nobody has to wonder whether I broke something else.** Diffing
the audit's full output before and against my change, the ONLY difference is
those lines — nothing else moved:

| | `checks-registered.mjs` |
|---|---|
| before my change | exit **0**, 163 registered, ghosts not mentioned at all |
| after | exit **1**, one complaint, naming `ghosts.mjs` only |

**I did not fix it, and deliberately.** The audit's own instruction is "add it to
`CHECKS` in `scripts/checks.mjs`, or add it to `EXEMPT` in this file WITH A
REASON" — both files are outside this item, and **`scripts/checks.mjs` is held
right now by `onehundredthree` on item 257**, which BUILDER-BRIEF §9 says makes
it hands-off ("another builder holds an item naming the same file → skip it").

Silencing it by dropping the `--selftest` would be fixing a failing check by
loosening it until it passes (§7), on the one file in this row whose entire
defect was that it could not fail.

**This is the FIFTH instance of this exact pattern this week** — item 199 in the
queue already lists `masonry.mjs` measuring zero faces, `texdensity.mjs`
unregistered, `w5-shadow-census.mjs` unregistered and
`w68-watch-vs-panel.mjs` unregistered. **`ghosts.mjs` belongs with item 199**;
it is the same one-line fix in the same file, and batching them costs one claim
instead of two.

---

## 2. `side-walk.mjs` — red for a year-old reason that had nothing to do with cars

It was reporting:

```
FAIL  3 parked cars, all on the road at y=0 (0 found at y=)
```

**All three cars were there, at y=0, on the road, exactly where
`ct/sidestreet.ts` puts them.** The census excluded them with a trailing
`&& o.visible`.

**Root cause: a term that was right stopped being right because something else
moved.** `regionCull` (`crosstown.ts:1377`) hides every top-level exterior child
while the player's `x >= REGION_X` (=100, `crosstown.ts:1340`) — and the player
**spawns inside apartment 301** (GOTCHAS 51), at x = 198.4. This census runs
before anything warps anywhere, so the whole outdoors reads
`visible === false`. The trees and pits assertions never tested `.visible`,
which is exactly why one census line of three failed.

Measured, not reasoned (`scripts/probes/w100-sidestreet-cars.mjs`):

- 3 objects in the box carry `steer`; all 3 are Groups; **0 visible**
- `self.visible=false` while `parent(Scene).visible=true` — culled
  individually, so it is not a parent being hidden
- warp onto the side street → **4** visible, the fourth being a *moving* car,
  which is the very thing the check's early timing exists to exclude

**Dropping `.visible` is safe, and that is measured rather than hoped.** The
reason it was there is the traffic **pool**: `ct/traffic.ts:276` hides a vehicle
when its run ends, and its own comment warns that "a scene-reading check that
ignores `visible` still counts it". That was fixed at the source —
`clear()` now also parks it at `IDLE_XZ = 999` (`traffic.ts:221`), far outside
this census box of x 8..60. The box already excludes every pooled car.

**Proved it can still go red**, on the real file: mutating the expected count
3 → 4 gives `FAIL 3 parked cars…` and exit 1. Reverted. The mutation fired.

Result: `1 CHECK(S) FAILED`, exit 1 → `all side street checks pass`, exit 0.

---

## 3. `unstick-walk.mjs` — a verdict that was a ratio across two populations

`537/531`, recorded by w37 as cosmetic. It is a little more than that: `tested`
counts traps that were genuinely stuck, while `fails` holds those failures
**plus** the `DRIVEN` ones from a different sample counted afterwards — so the
numerator can exceed the denominator.

Each number now reports against the sample it came from. Predicate and exit code
unchanged. Both branches measured:

```
green  all 543 traps release the player, and all 6 driven cross-checks walked away   exit 0
red    0/543 traps are still traps, and 6/6 of the driven cross-checks could not
       walk away                                                                     exit 1
```

The red line is a source mutation (`best > 0.25` → `best > 999`); it fired,
printed six `DRIVEN` FAILs and exited 1. Reverted.

---

## ⚠ FOUND AND NOT FIXED — the most valuable thing in this note

### `unstick-walk`'s canfail case was withheld for a blocker that is GONE

`scripts/checks-can-fail.mjs:53` keeps `unstick-walk` on the item-70 debt
register with this reason:

> `unstick-walk` STAYS ON THIS REGISTER, and w37 (item 77) had a working
> mutation for it and withheld it deliberately. The check is **already red on
> unmutated mainline** — `1/531 traps are still traps`, exit 1, on a real trap
> at (8.50, −94.50) the player can reach. canfail scores CAUGHT on any non-zero
> exit (GOTCHAS §32), so a case here would certify itself whatever the mutation
> did. **FIX THE WORLD FIRST**; the mutation is written up in
> `notes/w37-walking-tier-failpaths.md` and takes a minute to re-add.

**I measured it green today.** Two full runs on build `210891b5f`:

```
586 traps found · 543 genuinely stuck · 543 freed themselves · 0 FAIL · exit 0
```

**The world was fixed and nobody went back for the withheld mutation.** The
blocker w37 named no longer exists, so the case can be re-added — w37 says it
takes a minute and it is quoted in full in `canfail.mjs` where the case would
have gone. That would take `unstick-walk` off the debt register, which is a
count the register's own comment says "can only go down".

**Why no instrument will ever tell you this**: `checks-can-fail.mjs` reports
whether a row *declares* a failing path. It cannot see "the mutation exists,
works, and was withheld because the world was red" — that fact lives only in a
prose comment. The blocker being lifted is invisible to it by construction.

Needs `scripts/canfail.mjs` + one field in `scripts/checks.mjs`. **Neither is
named by item 84**, so this is handed back rather than done (BUILDER-BRIEF §9).

### The row's "SEVEN registered checks exit 0 while red" is not what the audit finds

I did not take the number on trust and I did not write a new instrument for it —
`scripts/checks-can-fail.mjs` already exists and answers exactly this. It
reports **145 registered checks, 121 declaring a failing path**, and names
**four distinct** rows with no way to go red:

```
w40-bed-vs-door · w75-site-contained (listed twice) · world-contained · prompt-not-a-ghost
```

plus **15 on the item-70 debt register**. None of the three files in this row is
among the four. `w75-site-contained` appearing **twice** in that output is
either a duplicated registration or a duplicated report, and is worth one
minute of somebody's time.

---

## Verification

- `ghosts --selftest`: 5/5 correct, exit 0; against the world, exit 0 clean
- `side-walk`: exit 0, all green; mutated → exit 1
- `unstick-walk`: exit 0, 543/543; mutated → exit 1
- `node --check` clean on all three
