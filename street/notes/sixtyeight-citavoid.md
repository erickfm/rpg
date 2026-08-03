# Item 197 — `__ct.citAvoid()`, so crowd avoidance can be asserted

Worker **sixtyeight**, 2026-08-02. `src/proto/crosstown.ts` only.

## Why this was a blocker, in one line

`colliders` stops the **player**; `citAvoid` is what `ct/crowd.ts` steers
**pedestrians** around. Only the first was published, so **the difference
between the two lists was unobservable from outside** — and that difference is
precisely what separates the two open bugs underneath:

- **173** — the crate *is* in the crowd's list and the steering is too weak.
- **195** — the crate was *never put in the list at all*.

A probe could watch a pedestrian walk through a crate. It could not ask whether
the crate had ever been offered to the crowd. Those are different bugs with
different fixes and the observation was the same either way.

## The change

One accessor on `__ct`, beside `colliders()` / `actorColliders()` /
`staticColliders()`, following that precedent exactly rather than inventing a
mechanism:

```ts
citAvoid: () => citAvoid.map((b) => ({ ...b, actor: actorBoxes.has(b) })),
```

Three decisions, all of them the item's own instruction or the file's own
precedent:

1. **Numbers, not the live array.** `colliders()` returns by reference on
   purpose — `interiors-walk.mjs --selftest` walls doors shut by pushing onto
   it — but nothing needs that here, and *"a probe that can mutate world state
   is a probe that can lie."* Each entry is a fresh spread. **Proved, not
   asserted in prose:** the probe pushes onto the returned array *and* writes to
   a returned box, then re-reads; neither reaches the world.
2. **`actor` is computed inside the world**, because it can only be computed
   there. It is an identity test against `actorBoxes`, and identity is exactly
   what does not survive `page.evaluate` — the same point `actorColliders()`
   already makes in its own comment. Cars and citizens push onto `citAvoid` too,
   so without the flag a caller asking "is the fruit stand listed" would have to
   tell a crate from a pedestrian by shape, and a citizen's box is 0.5 × 0.5,
   which is also plenty of real furniture.
3. **A spread, not a hand-written field list**, so `rot`, `minY`/`maxY` and any
   `tag` a box was built with come along. Hand-listing four extents is how a
   published view drifts from the type it publishes.

## Proof — `scripts/probes/w68-citavoid.mjs`, 7 assertions, all green

Including a **population floor** (the list must be non-empty; an empty one would
make every question below it vacuous) and the two **mutation tests** above,
which are the only honest way to claim "the live array does not leak".

## It answered item 195's question on the first run

This is the item's actual DONE WHEN — *"195 can assert that a named prop is in
the list rather than watching for a clip"* — so the probe asks it:

```
static colliders the PLAYER is stopped by:      508
static boxes the CROWD is told to steer around: 136
in the player's list but NOT the crowd's:       359
...of those, on the bodega's stretch of street:   6
```

Two of those six are **0.62 × 0.56 boxes at (10.75, −96.41) and (11.45,
−96.41)** — on the pavement outside the bodega, which is where the user reported
*"pedestrians sometimes clip into the fruit."*

**Note the scale for whoever takes 195.** Its row says the cause is *"one line"*
and names *"16 call sites"*. The call sites may well be 16; the **boxes** they
account for are **359 of 508**, i.e. **71% of the world's static geometry is
invisible to pedestrians.** That is worth knowing before the fix lands, because
adding 359 boxes to the crowd's avoidance set at once is a steering change, not
only a plumbing change, and it may surface 173 rather than resolve it.

**The probe deliberately does NOT assert `missing === 0`.** Item 197 owes the
question being *answerable*; whether the answer is zero belongs to 195. A check
that fails on a bug it does not own is noise, and it would go green the moment
somebody else fixed it — crediting the wrong item.

## Checks

- `npx tsc --noEmit` — clean.
- `npm run sweep` — 96 shots, **0 STATION MISS, 0 COVERAGE**.
- `node scripts/health.mjs` — `WORLD OK`, exit 0, build `55692e0f4`.
- Console errors: **0**.
- Purely additive: one accessor, no existing behaviour touched, no geometry
  moved — so `fp` would in fact have been valid here, and is unnecessary.

## Found and not fixed

- **`staticColliders()` and `citAvoid()` disagree by 359 boxes.** That is item
  195 and it is not mine. Recorded with the number above.
- **Nothing in `citAvoid` carries a name or tag.** Callers key on extents, which
  works and matches how the red-dump probes already do it, but "assert that a
  **named** prop is in the list" is only reachable via its coordinates today. If
  the desk wants literal names, `obstacle()` would need an optional `tag` — a
  small, separate item, and I did not take it because 197 did not ask for it.
