# Item 251 — `PARTY` published read-only, and the last dev-only check retired

Worker ninetyfive. `src/proto/crosstown.ts`, `scripts/interiors-walk.mjs`,
`notes/BUILDER-BRIEF.md`. Commit `111b46266`. Measured on the **built bundle**
(port 4510, `vite preview --strictPort`) with a **dev** server on 4511 for the
controls.

---

## Root cause, one line

Every builder is told to verify on the built bundle (GOTCHAS 28) by a suite that
contained one check which **404'd on the bundle** — `interiors-walk` read its
declarations out of the TypeScript sources at runtime, and `vite preview` serves
only `dist/`.

## Re-measured before swapping anything

I did not take worker ninetythree's numbers on trust — the whole premise is that
the hook and the source agree, and if they disagreed anywhere the conversion
would silently change what the check tests.
`scripts/probes/w95-item251-source-vs-hook.mjs`, on dev where both are readable:

```
doorStandFor vs __ct.doors().stand   12/12 agree
doorPointFor vs __ct.doors().point   12/12 agree
roomDims() rooms publishing .door    13/13
PARTY hook vs source                 identical
```

Three of the four source imports were therefore already redundant:

- **`doorStandFor` / `doorPointFor`** → `__ct.doors()`, read **once** into a
  snapshot so the `front:`-tuple loop and the `face:`-room loop cannot disagree
  with each other about a door.
- **`roomWidthFor`** → fed `r.W`, **read nowhere**. Deleted.
- **`declaredDoors().at`** → fed `r.at`, whose only consumer is the
  `|| { x: room.at … }` arm of `DOOR` — and **13/13 rooms publish their own
  `door`** via `roomDims()`, so that arm never fires. Deleted. The site that read
  `doorPointFor(n).x` into an `at` field threw it away on the very next line, so
  that one was dead on arrival.

## `PARTY` was the only real gap

`crosstown.ts` now publishes `__ct.party()` as a **per-element copy**, following
the `citAvoid()` precedent. `PARTY` is `readonly` to TypeScript, but **`readonly`
is erased at runtime** — a probe reaching it through `__ct` is plain JavaScript,
so returning the array itself would let a harness splice the world's only party
wall out from under the renderer and then measure the result.

Verified isolated on **both** worlds — after pushing a row *and* writing through
element 0, `party()` still reports 1 row, `hotel/casino`, `at -9`, `w 2.6`.

The harness still exits **3**, not 1, if the hooks are missing: a containment run
that does not know where the party doorways are reports the feature as a **hole**,
and the old unhandled fetch error became exit 1 — "measured, and it is WRONG" —
which read as twelve failing rooms when nothing had been measured (GOTCHAS 32).

## The four-way matrix, `church`, measured

| harness | server | result |
|---|---|---|
| **old** | **bundle** | **exit 3 — "DEV SERVER REQUIRED, nothing measured", 0 checks** |
| old | dev | 29/29 passed, exit 1 |
| **new** | **bundle** | **29/29 passed, exit 1** |
| new | dev | 29/29 passed, exit 1 |

Identical assertions and an identical verdict, now available on the bundle where
before there were none.

**Full run on the bundle: 364/369 passed**, all twelve rooms plus `apt301`.

## The negative case, on the bundle

| | result |
|---|---|
| full run, clean | 364/369 |
| full run, `--selftest` | **328/369 — 41 failures, +36** |
| `church` alone, clean | 29/29 |
| `church` alone, `--selftest` | **26/29** |

The mutation reddens exactly what it targets, not a random spread: **12 of 12**
rooms fail *"the room keeps its own light after dark"* and **12 of 12** fail
*"no static collider is parked on the [E] spot"*, with the landing/reach legs
following from the walled doors. The mutation itself already used
`__ct.doors()`/`__ct.colliders()`, so it was bundle-safe before I started.

## ⚠ I nearly reported a false control

My first attempt at the before/after did `git stash push scripts/interiors-walk.mjs`
— but **the change was already committed, so there was nothing to stash.** Both
"old" runs were the NEW harness, and the old-on-bundle run came back exit 1
having walked the room, which is the opposite of the before-state. I only caught
it because that result contradicted a 404 I had measured ten minutes earlier with
a different probe.

The real control is `git show HEAD~1:./scripts/interiors-walk.mjs` into a
throwaway file **in the same directory** (its `./lib/…` imports are relative), run,
delete. That is what the matrix above is built from. *Verify from the real shell,
not an adjacent one* — and a stash that stashed nothing looks exactly like a stash
that worked.

## Found and NOT fixed

**1. `interiors-walk` exits 1 on a clean bundle run, for two PRE-EXISTING
reasons, and neither is this item.** Anyone reading the exit code alone will
think the conversion failed:

- **5 pre-existing check failures** — `jail: the room keeps its own light after
  dark`, and `casino/hotel/pawn/tax: the customer station comes from the world,
  not from memory`. The latter four are the check reporting its *own* weakness
  by design: no served-spot is published in those rooms, so it falls back to the
  authored pair and says so. Independent of doors, `PARTY`, `r.W` or `r.at`.
- **A kit warning that alone forces exit 1.** `errs` collects
  `[interior:…]` console warnings and line 1883 is
  `process.exit(bad || errs.length ? 1 : liveness)`. **`church` alone scores
  29/29 and still exits 1** on that basis. The warning is
  `[interior:hotel] NO BUILDING NAME` — the hotel's `buildRoom` spec names no
  building, so no `DoorDecl` is consulted and **the hotel is getting the kit's
  generic timber leaf instead of its declared door**. That is a real world
  defect, it is user-visible, and it has no row. Old-on-dev reproduces it
  identically, so it long predates this item.

**2. `scripts/checks.mjs:902` now asserts something false.** Its comment reads
*"The ONLY check that walks into a room in a BUILT BUNDLE. interiors-walk above
cannot: it imports a source path no bundle serves."* `interiors-walk` can now.
`checks.mjs` is not named by this item so I left it (BUILDER-BRIEF §9); it is a
comment-only edit.

**3. `interiors-walk` is registered with `true` in its mutation column**
(`checks.mjs:866`) rather than a named `canfail` case, so its `--selftest` is
driven by the script's own flag and not by the mutation runner. It works — I ran
it — but it is not wired the way `glow`'s four cases are.

## Green

`tsc --noEmit` 0 · `npm run build` 0 · 369 assertions on the bundle, 364 passing
· negative case red both at suite scope (+36 failures) and room scope · the
read-only isolation of `party()` proved on dev and on the bundle.
