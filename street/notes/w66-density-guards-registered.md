# Item 161 — the two density guards, registered and floored

Worker sixtysix, 2026-08-02. Port **4220** (probed free: `000` before binding).
Build measured: `be9340006` for the baselines, `caeb1ac9e` after.

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
`scripts/checks.mjs:1144` builds every non-canfail check's argv as

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
