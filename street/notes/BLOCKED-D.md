# Builder D — blocked on one thing, and it is a bug I put there

`7b100b65` closes its bodega tally with *"canted bay → **no `__frontages`
entry** → prompt off the walk line → trigger disc centred in the recess. Four
anomalies, one cause."*

I went to publish that missing entry. **There is one already, and it is worse
than missing: it describes the wrong face.**

## Measured, both channels, same build

```
__frontages BODEGA   axis "x"  loWorld 10.4  hiWorld 16.45  facePos -96
                     frontageM 6.05          doorWorld 12.82

doorStandFor('BODEGA')                       (7.47, -95.53)
```

Those are not the same door. They are not even the same wall.

- `__frontages` describes the bodega's **side-street wing** — `BODEGA_WING`
  6.05 m, placed by my `placeBldZ(FACE + 3.4, -94.3, …)` at x 10.4 → 16.45
  facing z = −96 — and puts a door at x 12.82 on it.
- The bodega's actual customer door is on the **canted bay** at (8.0, −95.0),
  normal (−√½, −√½), which is what `DOOR.face` declares and what
  `declaredDoors()` publishes.

**They are about 5 m apart.** Anything deriving a trigger disc, a stand point
or a camera from `__frontages['BODEGA']` aims at a blank shopfront on the side
street.

## Whose

**Mine.** `ct/street.ts` calls `placeBldZ` for the wing with `nm: 'BODEGA'`,
and the shopfront system registers a frontage under whatever name it is given.
The wing legitimately *displays* the name — it is the bodega's side elevation
and its band reads BODEGA correctly — but it should not be the thing that
answers "where is the bodega's door".

## Why I cannot just fix it

`Placement` (`ct/tex-world.ts:322`) is axis-aligned by construction:

```ts
axis: 'x' | 'z';  loWorld / hiWorld;  facePos;  outward: 1 | -1;  uDir: 1 | -1;
```

A 45° face has no `axis` and no single `facePos`. So the bay cannot register a
frontage that is *correct*, and the choice is between three things I should not
make alone:

1. **Stop the wing claiming the name** — register it as `BODEGA WING` or not at
   all. One line in my file. Fixes the wrong answer; leaves the bay with no
   entry, which is where `7b100b65` thought we already were.
2. **Teach `Placement` about a canted face** — an `angle`, or a
   `(origin, along, outward)` vector form. Correct, reusable, and A's type in
   A's file.
3. **Let `declaredDoors()` be the answer for cut faces** and have consumers
   check it — it already carries `face: {x, z, nx, nz}` and already returns
   the right point for BODEGA today.

My preference is 1 now and 2 when someone is next in that type — 1 removes a
wrong answer immediately, which is worth more than adding a right one later.
But 1 alone will make a tool that expects nine frontages find eight, so it
wants saying out loud rather than doing quietly.

**Who:** the desk to pick, A if it is 2.

## Not blocked, and worth folding in

`7b100b65`'s proposed fix — derive every door spot from the published frontage,
radius reaching the kerb and stopping — cannot include the bodega under any of
the three options except 2. Under 1 or 3 the bodega needs its own arm, which is
the thing that note was trying to eliminate. Worth knowing before someone
writes the shared arithmetic and finds it is shared by eight.
