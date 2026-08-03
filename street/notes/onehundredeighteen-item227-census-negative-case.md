# Item 227 — the census was already fixed; what it lacked was a negative case

**Worker onehundredeighteen, 2026-08-03. Port 4740. Verified on the BUILT
bundle at `22694fe8e`.**

The row had **no `⟨desk numbers measured⟩` stamp** — it predates the stamping
convention — so it was re-measured before anything was touched, per
BUILDER-BRIEF §6b. It was stale.

---

## 1. The complaint was already fixed, and the row is stale

`scripts/side-walk.mjs` reporting *"3 parked cars, 0 found"* was fixed at
**`210891b5f`** ("item 84: side-walk was RED, and the parked cars were never the
problem"), which dropped an `&& o.visible` term from the census clause.

**The cause, stated once:** `regionCull` (`crosstown.ts:1377`) hides every
top-level exterior child while the player's `x >= 100`, and **the player spawns
inside apartment 301 at x = 198.4**. So at census time the whole outdoors reads
`visible === false`, and a scene census run from a fresh page finds nothing.
It was never a missing fleet — it was a rendering fact answering an authoring
question. This is GOTCHAS 79b, and the file now carries ~35 lines explaining it.

Re-measured, 20 checks, all green, exit 0 quoted from the command:

```
OK   3 parked cars, all on the road at y=0 (3 found at y=0, 3 of them region-culled — not consulted, see the census)
```

**Five runs, zero spread** (`scripts/probes/w118-item227-census-spread.mjs`):

| run | cars | y | region-culled |
|---|---|---|---|
| 1–5 | 3, 3, 3, 3, 3 | 0 | 3, 3, 3, 3, 3 |

**The `3 region-culled` column is the load-bearing number.** All three cars are
culled at census time *today* — so the fix is not passing by luck. Had the
`.visible` term survived, this check would still report 0 right now.

---

## 2. What was actually missing — and it is what the row asked for

The row's real demand was a **population floor**: *"'0 found' out of a
known-nonzero fleet must be a FAILURE, not a line of output."*

The assertion `heights.cars.length === 3` does fail on 0, and
`process.exitCode = fails ? 1 : 0` does exit 1. **But nothing proved it.** The
one registered mutation aimed at this file, `sidewalk-sealed`, records in its
own note that *"the tree/car/pit heights ... stayed OK"* through it. The census
line was the one assertion in `side-walk.mjs` with **no negative case at all** —
which is precisely how it managed to report "0 found" for a day without anyone
being able to tell a broken counter from an empty street.

### The new case: `sidestreet-cars-vanish`

Registered in `scripts/canfail.mjs` beside `sidewalk-sealed`.

```
'car.position.set(x, 0, z);'  ->  'car.position.set(x + 900, 0, z);'
```

**Why this mutation and not a deleted car.** Moving the *drawn* car 900 m east
takes it out of the census box (x 8..60) while leaving the **colliders** exactly
where they were — `carColliderBoxes(kind, x, z, ry, '@side')` at
`sidestreet.ts:181` reads the local `x`/`z`, **not** `car.position`. So the
fleet becomes invisible to a scene census and unchanged to anything that walks
or drives.

**It discriminates, measured:** exactly **1 of 20** checks reddens —
`3 parked cars, all on the road at y=0 (0 found)` — while all four hikes, the
bodega-door reach, the traffic leg (*"never braked for a parked car — slowest
8.50 m/s"*) and all three `[E]` spots stay OK. `1 CHECK(S) FAILED`, exit 1.
A blunter mutation that deleted the cars would have reddened the traffic leg
too and proved much less.

**GOTCHAS 91 checked explicitly:** `car.position.set` at `:153` is the **last**
write to that position — `scene.add` and `o.lit` do not move it — so the
mutation is not overwritten between the change and the assertion.

Through the real harness: **pre-pass green on the unmutated tree, `CAUGHT` on
the mutation, `every mutated file restored byte-for-byte`.** Both signs.

---

## 3. `D-walk` does NOT share the cause — and the world is fine

The row's last clause. **Answer: no, and the finding is better than that.**

`D-walk.mjs` has **no `.visible` filter anywhere** — the only two matches in the
file are prose. It cannot have item 227's bug.

Its failing leg is `and pressing E opens the machine: 3 → 3` (item 279). Driven
both ways from the ATM stand
(`scripts/probes/w118-item227-does-dwalk-share-it.mjs`):

```
tap  press('e')       : 3 full-screen panels -> 3   __hud.panel(): null -> "ct-atm"
held down/up 120 ms   : 3 full-screen panels -> 3   __hud.panel(): null -> "ct-atm"
```

**The ATM opens. Both ways.** `D-walk.mjs:443-452` counts full-screen
`DIV`/`CANVAS` elements over 300×200 at `position: fixed|absolute`, and the ATM
cabinet does not answer that description — so it reads 3 → 3 whether or not the
machine responded. **The check is blind; the machine works.**

**For item 279:** re-point that leg at `__hud.panel()`, which names the cabinet
by DOM id. Do **not** loosen it to "something changed" — assert the id is
`ct-atm`. And **BUILDER-BRIEF §5 is not the cause here**: the single-frame tap
works fine at this spot, measured twice. That was my own first hypothesis and it
was wrong.

---

## 4. Two things I got wrong, recorded because they cost time

1. **My first read was that D-walk's ATM leg was BUILDER-BRIEF §5** (a tap
   inside one frame). It is not — the tap opens the panel. Only asking
   `__hud.panel()` instead of counting DIVs revealed it.
2. **My probe's first verdict was "even a HELD [E] does not open the ATM — that
   is a WORLD defect".** It was keyed off the same blind DOM census the failing
   check uses, so it reproduced the check's error and would have sent item 279
   to fix a world that is correct. Fixed by making the verdict read
   `__hud.panel()`. **A probe that borrows the failing check's instrument
   inherits its blindness** — worth generalising.

---

## 5. Verification

| | |
|---|---|
| `side-walk.mjs` on the built bundle | 20/20 OK, **exit 0** |
| census spread, 5 runs | 3,3,3,3,3 at y=0 — zero spread |
| negative case through `canfail.mjs` | `CAUGHT`, 1/20 red, restored byte-for-byte |
| `npx tsc --noEmit` | exit 0 |
| `scripts/health.mjs` | `WORLD OK — __ct initialised`, exit 0 |
| `scripts/bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, exit 0 |

All exit codes quoted from the command itself, never after a pipe.

**No world source was changed.** `src/proto/ct/sidestreet.ts` is byte-identical
to mainline; the only edits are `scripts/canfail.mjs` (+30) and two probes in
`scripts/probes/`.

## 6. Not fixed, for the desk

- **Item 279 is answered but not closed** — the fix belongs to that row, and
  `scripts/D-walk.mjs` is not named by item 227 (BUILDER-BRIEF §9). The
  diagnosis above should save it most of its time.
- `side-walk.mjs`'s census box and predicate are duplicated in
  `w118-item227-census-spread.mjs`, copied with the line cited rather than
  imported, because the census lives inside a `page.evaluate` in a check script
  with no export. A shared export would be the clean fix (BUILDER-BRIEF §8).
