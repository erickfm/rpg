# Item 161 — the two density guards, registered and floored

Worker sixtysix, 2026-08-02. Port **4220** (probed free: `000` before binding).
Baselines measured against build `be9340006`, which is the mainline commit this
work sits on. The after-figures were taken against my own commits, which are
deliberately NOT cited here: they are un-merged, so the rebase that lands them
renames them and the citation would be dead to everyone but me (GOTCHAS 36).

---

## What the row asked, and where it was right and wrong

> **(1)** `scripts/texdensity.mjs` is not registered at all.
> **(2)** `masonry --selftest` is never invoked … because `checks.mjs` never
> passes the flag.

**(1) is true and is fixed.** `scripts/checks-registered.mjs` said so in its own
voice before I touched anything:

```
WRITTEN BUT NEVER REGISTERED — these run exactly never:
  scripts/texdensity.mjs  has a --selftest and is in no tier of npm run checks
```

It is green now.

**(2) IS FALSE AS STATED, and the row should not be verified on it.**
`scripts/checks.mjs:1207` builds every non-canfail check's argv as

```js
const args = [`scripts/${name}.mjs`, ...extra, ...(SELFTEST ? ['--selftest'] : [])];
```

and `masonry` has carried `true` in the selftest column since `6f3fc33a6`
("Register the three orphan checks — after running each one by hand first"),
which is reachable from `add-stick-and-city98`. So the flag **has** been passed
ever since masonry was registered. Verified two ways: by reading the runner, and
by watching it — `node scripts/checks.mjs --selftest --only masonry` prints
`… masonry` and the row goes green.

**The real gap is one axis over, and it is worse than the row's version.** The
run that reported green over zero faces on 2026-08-02 was the **plain** one, and
nothing in `checks.mjs` could have caught that:

* every verdict in `masonry.mjs` is an **absence** — "no stamp disagrees with
  its face" — and an absence is free over an empty set (GOTCHAS 34, 79);
* `--selftest` does catch it, but only under `npm run checks -- --selftest`,
  which is 133 rows with a full `npm run build` and a browser per mutation. That
  is an afternoon, so in practice it is never typed — which is the true content
  of "never invoked".

So registering was necessary and nowhere near sufficient.

---

## What I changed

| file | change |
|---|---|
| `scripts/checks.mjs` | `texdensity` registered, fast tier; `--only <name>`; a sixth column for canfail cases on a row that also carries a `--selftest` flag |
| `scripts/masonry.mjs` | population floor: **fails below 250 stamps**, in the plain run |
| `scripts/texdensity.mjs` | population floor: **fails below 3000 measurable faces**, and `--bless` is refused below it |
| `scripts/canfail.mjs` | new case `masonry-blind` |

**Both floors are measured, not remembered** (GOTCHAS 34's closing line):
305 masonry stamps and 4087 measurable faces on `be9340006`.

`masonry.mjs`, `texdensity.mjs` and `canfail.mjs` are **outside the file the row
named** (`scripts/checks.mjs`). Reported per BUILDER-BRIEF §9. The row's own
DONE WHEN is unreachable without them: with no floor, re-adding the visibility
filter leaves the plain run exiting 0, so the suite goes **green**, which is the
opposite of what the row requires.

### The sixth column, and why the third one would not do

`checks.mjs`'s selftest column is an either/or — `true` runs the script's flag,
a string or array runs canfail cases *instead*. For masonry the two are not
alternatives:

* the **flag** doubles one face's `repeat.x` and proves the *wrong-density
  verdict* can go red;
* **`masonry-blind`** empties the population and proves the *floor under that
  verdict* can go red.

They fail apart, and the historical bug is the proof: with zero stamps there was
no face to double, so the flag was reporting `SELFTEST FAILED` for a reason that
named none of this. Same argument the `footprint` and `seat-facing` rows already
make for carrying more than one case.

### `--only`

`npm run checks -- --only masonry` runs one row in seconds. A mistyped name is
**refused with exit 2**, not silently filtered to an empty green run — that is
the GOTCHAS 34 mode-word failure and it would have been trivial to ship here.

---

## The measurements

Baselines, run by hand before registering anything, exactly the four figures the
row names:

```
masonry     7795 meshes · 4457 textured · 305 carry a masonry stamp
            stamps checkable against geometry: 303
            stamps that DISAGREE with their face by >0.6 px/m: 16
            explained by whole-texel canvas rounding: 16
            FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0        exit 0

texdensity  7795 meshes · 4457 textured faces · 4087 measurable
            303 carry a density declaration, 3784 declare none  (7.4%)
            STAMPED FACES DRAWING AT THE WRONG DENSITY: 0 of 303
            FACES DRAWING A STRETCHED TEXTURE (>= 4x): 188
            backlog 188 against baseline 188 — no owner got worse   exit 0
```

Runtimes, measured not guessed: `texdensity` **3.0 s** plain, **3.1 s**
selftesting — fast tier by this file's own rule (lotwalk moved to slow at 36 s).

### The DONE WHEN's last clause, watched

Re-added `for (let q = o; q; q = q.parent) if (q.visible === false) return;` to
`masonry.mjs`'s traverse — the regression verbatim — and ran the suite:

```
THIS CHECK MEASURED NOTHING: 0 masonry stamps, floor is 250.
  7795 meshes and 1903 textured faces were traversed, so the world built.
checks against http://localhost:4220/:
  ✗ masonry  FAILED (1)
```

7795 / 1903 / 0 is the historical failure to three figures. Reverted; tree clean.

### And the same hole in the new check, which I watched fail to fail

`texdensity.mjs` shipped with the identical fault one axis over. Its verdict is a
**comparison** against per-owner counts, so a blinded run reports a smaller
backlog and passes. Blinded it the same way and set the floor to 0:

```
IMPROVED since 2026-08-03: ?: 21 -> 0, jail: 1 -> 0, props: 14 -> 0,
                           tex-ground: 6 -> 0, civic: 39 -> 0, street: 4 -> 0, lot: 8 -> 0
backlog: 95 gross faces (baseline 188)
no owner got worse.                                                    exit 0
```

Cheerful, green, and about 1895 faces instead of 4087 — in the guard written
*from* GOTCHAS 79. With the floor restored it exits 1 and says so.

### Selftests, through the runner

```
node scripts/checks.mjs --selftest --only texdensity   ✓ texdensity
node scripts/checks.mjs --selftest --only masonry      ✓ masonry +canfail
                                                       ✓ masonry
node scripts/canfail.mjs masonry-blind                 OK masonry-blind CAUGHT
                                                       every mutated file restored byte-for-byte
```

### The whole default suite, through the modified runner

`checks.mjs` is shared, so the runner change was run against the **whole**
registry, not only my two rows: **133 rows**, 18 correctly skipped as
`walks — use --slow`, no runner-level error, and

```
✓ masonry            does each masonry stamp agree with the face it is on?
✓ texdensity         is any textured face in the world drawing a stretched texture?
✓ checks-registered  is every self-testing script actually registered?
```

that last one being the guard that was **red on `texdensity` before this**.

15 rows are red and **every one of them predates this work**; none is in the
density area, and none names a file I touched. For the record so the next reader
does not re-diagnose them: `mirror-walk` (2 of 5 rooms, and its own output says
*"DO NOT ROUTE THIS YET"*), `I-clip` (reporting overlaps of 1.0e9 m — an
arithmetic fault in the instrument), `D-walk`, `glow`, `park`, `spot-coverage`,
`floaters-walk`, `K-pocket-loop`, `K-tyre-has-arch`, `N-post-waiting`,
`L-every-stool-seats-you`, plus the four registry auditors listed below.
`note-hashes` reported **WRONG WORLD**, which is exit 3 — nothing measured
(GOTCHAS 32), not a red.

**One caution for whoever re-runs this.** I invalidated a twelve-minute run by
committing a note halfway through it: `dist/` stays at the commit it was built
from, `localHead()` moves, and every check from that moment on aborts WRONG
WORLD. `checks.mjs` says so in its own closing lines and it is right — do not
commit while a suite is running.

### Sharing `checks.mjs` with item 182

The desk warned mid-item that **worker sixtyseven holds item 182 and is editing
`scripts/checks.mjs` too** — its job there is the `SERVER DIED (unmeasured)`
diagnostic. Merged mainline (`f43bb5254`) before finishing: **it merged cleanly
and there was no conflict to resolve**, because 182 has not landed — mainline's
`checks.mjs` is still byte-for-byte the version I started from (the whole diff
between us in that file is my own additions).

**So the conflict is still ahead, and it will be sixtyseven's or the merge
train's to take.** Where the two of us overlap, precisely:

* my `+canfail` block sits **inside** the `for (const [name, question, …])`
  loop, a few lines above the `const args = […]` spawn;
* I changed that loop's **destructuring line** to take a sixth field
  (`cases = []`) and added an `ONLY` filter as its first statement;
* 182's subject — the rows pushed as `SERVER DIED (unmeasured)` — sits in the
  same loop, at its top and in both post-spawn failure branches.

Neither change alters the other's meaning. **Keep both**: the sixth field and
the `--only` guard are load-bearing for this item's DONE WHEN, and a resolution
that drops the destructuring line silently disables `masonry-blind` — the row
would still read as registered and would simply never run its case, which is the
exact failure class this whole item exists to close.

Re-verified on the merged tree at `f43bb5254`, rebuilt: 7811 meshes · 4477
textured · **305 stamps** (the baseline holds across the merge), and

```
(--only masonry, texdensity, checks-registered — 3 of 132 rows; the rest were NOT run)
✓ masonry   ✓ texdensity   ✓ checks-registered
```

---

## Found and NOT fixed — for the desk to queue

Three checks are **red on mainline for reasons that predate this item**; none of
the offenders is a file I touched.

1. **`aimed` — 86 scripts** still fall back to a hardcoded port. None is mine
   (`masonry`, `texdensity`, `checks`, `canfail` all route through `lib/aim.mjs`).
2. **`mutations-quote-real-source` — 4 dead needles**: `rulings-atm`
   (`ct/bank.ts`), `grade-twice`, `grade-nan`, `glow-pool` (`ct/props.ts`), each
   matching 0x. Four canfail cases are guarding air. `masonry-blind` is not among
   them.
3. **`checks-can-fail` — one row, `w40-bed-vs-door`.** This one is an
   **instrument fault, not a debt**: that row declares two perfectly good canfail
   cases, but its name and its selftest column are on **different lines**, and
   the parser at `checks-can-fail.mjs:95` reads only to end-of-line. Any wrapped
   row reads as undeclared. My own masonry row is deliberately wrapped *after*
   the flag for this reason. Worth a one-line fix to the parser; I did not touch
   it because it is not this item's file and the fix wants its own positive
   control.

Two smaller things:

4. **A fresh worktree cannot run `masonry.mjs` at all.** `shots/` is gitignored
   and absent, so `writeFileSync('shots/masonry.json')` throws `ENOENT` **after**
   the verdict prints and node exits 1 — a green world reported red, with a stack
   trace instead of a diagnosis. `mkdir -p shots` fixes it; several checks in
   `scripts/` write there and presumably share it.
5. **`notes/texdensity-baseline.json` records `recorded: 2026-08-03`**, a day
   ahead of the tree's own dates. Cosmetic, but it is the date a future reader
   will reason about when deciding whether a baseline is stale.
