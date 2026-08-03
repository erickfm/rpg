# w63 — item 174: the cause is one missing call in `ct/street.ts:242`

> *"pedestrians sometimes clip into the fruit in the sidewalk outside the bodega."*

**Handed back un-started. The row's lead is correct and its file list is not:
the fix is `ct/street.ts:242`, which item 174 does not name.** No world file
edited.

## The two lines, side by side

```ts
ct/park.ts:242…  const solid = (b: AABB) => { colliders.push(b); obstacle(b); return b; };   // ct/park.ts:91
ct/street.ts:242 const solid = (b: AABB) => { colliders.push(b);              return b; };
```

`obstacle` is `crosstown.ts:330` — `propColliders.push(b); citAvoid.push(b)` —
so **`ct/park.ts` registers a prop with both the player and the crowd and
`ct/street.ts` registers it with the player only.** The correct pattern is
already in the file next door; street.ts simply never adopted it.

`ct/bodega-corner.ts` receives street.ts's local `solid` (street.ts's own call
site passes it in), so the produce crates at `bodega-corner.ts:519` —
`solid({ minX: cxx - 0.31, maxX: cxx + 0.31, minZ: czz - 0.28, maxZ: czz + 0.28 })` —
land in `street.colliders`, get spread into the player's list at
`crosstown.ts:691`, and **never reach `citAvoid` at all.** A pedestrian's
footprint test (`crowd.ts:285`, `x ± 0.28`) has nothing to find, so it walks
straight through. That is exactly the symptom.

## "Sometimes" is explained, and it is not an approach-angle thing

The crates are invisible to the crowd from **every** angle. What varies is
whether a walker's route happens to pass through them — the lanes sit at
`ROAD_HALF + 1.05 + …` and the crates are on the bodega's corner, so only some
trips cross that ground. The row's suggestion that certain approaches work is
not what the code says: there is no partial case, only "does a route go there".

## How big is it — the number the row asked for

**It is not one crate; it is everything `ct/street.ts` and the modules it hands
`solid` to have ever registered.** Static call sites of that particular `solid`:

| file | `solid(` call sites | reaches `citAvoid`? |
|---|---|---|
| `ct/street.ts` | 10 | **no** |
| `ct/bodega-corner.ts` | 4 | **no** (given street.ts's) |
| `ct/vice.ts` | 2 | **no** (given street.ts's) |
| `ct/park.ts` | 13 | yes — its own `solid` calls `obstacle` |
| `ct/civic.ts` | 11 | not checked; it takes no `solid` from street.ts, its own source needs tracing |

**16 call sites are on the broken path**, and most sit inside per-building loops,
so the runtime count is considerably higher than 16 — every shopfront relief,
recess, awning post and stall the roster lays down the block. I did **not**
produce a runtime number, and I want to be exact about why: `citAvoid` is a
closure local in `crosstown.ts` with no accessor on `__ct`, so no probe can
count it. **That missing accessor is the second half of this item** — the row's
own DONE WHEN asks for *"a probe that fails if a solid prop is missing from
`citAvoid`"*, and that probe cannot be written until `__ct` publishes the list.
`crosstown.ts` is not named by item 174 either.

## What the fix should be, and what it should not be

- **Do not** add the crates to `citAvoid` by hand. Two lists filled by hand
  drift again, which is the row's own point and the reason it exists.
- **The one-line fix** is to make `ct/street.ts:242` match `ct/park.ts:91` —
  street.ts already receives everything it needs or can be passed `obstacle` the
  same way `ct/park.ts` is. One line, and every one of those 16 call sites is
  fixed at once without any of them being touched.
- **Then publish `citAvoid` on `__ct`** and write the guard the row asks for:
  every box in `colliders()` that is not an actor box must appear in
  `citAvoid()`. With the accessor that check is a dozen lines and it can fail —
  revert the street.ts line and it goes red on 16-plus boxes.
- **Trace `ct/civic.ts`'s 11** the same way before calling this closed; it was
  not on my item and I did not follow it.

**→ Item 174 needs `ct/street.ts` and `crosstown.ts` added to its file list.
Everything else about the row is right, including that the one-crate fix is the
wrong fix.**
