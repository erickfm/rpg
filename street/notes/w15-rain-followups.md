# Item 24 — w16's three rain follow-ups: two fixed, one shown not to apply

**Root cause, one line:** all three are instruments lying about the rain, not
the rain being wrong — `rain-check.mjs` was measuring 13 stars instead of 2600
raindrops, `rainlive.mjs` was asking the clock a question it had not answered,
and the two star sets turn out not to have the rain's culling bug at all.

**`ct/props.ts` is unchanged.** The item named it because (3) might have needed
it. It did not — see below. No source file was touched, so `npm run fp` has
nothing to compare: the world is bit-identical by construction.

---

## (1) `rain-check.mjs` was passing without ever looking at the rain — FIXED

w16 found two faults. There were **three**, and each alone was enough to make
the pass meaningless.

| # | fault | effect |
|---|---|---|
| a | traversed for `o.type === 'Points'` and kept the **last** of three matches | asserted "12/12 drops world-locked" about a **13-point star set** |
| b | hand-copied the weather as `((Math.imul(h, 2246822519) >>> 0) % 100) < 22` | `ct/props.ts` replaced that with a murmur3 finalizer at 30% plus the opening hour, so it picked hours the world does not call rainy |
| c | sampled immediately, never waiting for `rainLevel` | the wrap had not run, so every delta was `0.000` — **and 0 is a legal "world-locked" answer** |

(b) is the failure `rainlive.mjs`'s own header warns about in so many words:
*"two scripts once carried hand-copies of `rainAt()` and drifted."* It asks the
world's published `scene.userData.rainAt` now.

**Fixed:** select the Points whose material has a `map`; ask `rainAt`; use an
**absolute** hour; wait for `rainLevel > 0.9`; and **fail if no drop moved at
all**. It reports which object it measured, so the substitution cannot recur
silently.

Now: *"measured the 2600-point MAPPED Points set (the rain), not a star field …
rainy ABSOLUTE hour 36 (12:30), rainLevel 0.911 … 16/16 drops world-locked; 16
of them actually wrapped"*, with deltas of exactly −30 and −60 m — the wrap
signature the check exists to see, which it had never once observed.

## (2) `rainlive.mjs`'s `% 24` — REAL, but it was dormant, and I can show both

w16 is right that `clock(h % 24)` asks a different question than `rainAt(h)`
answered. `crosstown.ts:805` sets `totalMin = h * 60 + m` and `hourAbs` is
`Math.floor(totalMin / 60)`, so **`clock(h)` sets the absolute hour to exactly
`h`**, and `rainAt` hashes that through murmur3 — not periodic in 24.

Measured live (`scripts/w15-mod24.mjs`), outdoors on the pavement:

```
clock(36 % 24 = 12) -> rainLevel 0.0000
clock(36)           -> rainLevel 0.9851
```

and statically, over hours 0–95, `rainAt(h)` and `rainAt(h % 24)` **disagree on
8 of the 11 wet hours at or above 24** (68, 71, 76, 78, 81, 90, 91, 92).

**But it was not mis-measuring today**, and the item implies it was. `rainlive`
takes `hours[0]` — the first wet hour from a search that *starts at 0* — and
with 30% of hours wet the first hit is essentially always under 24, so
`h % 24 === h`. It was **0** on every run I did, and the script correctly
reported `rainLevel 0.9914`. Luck, not correctness: it breaks the moment anyone
narrows the search to daylight, which is exactly what `rain-check.mjs` now does.
Fixed, and the comment says why it looked harmless.

## (3) The other two `Points` sets — SHOWN NOT TO APPLY, with the measurement

w16 asked whether either follows the player, because if one did it would have
the rain's bug. **Both do — and that is precisely why neither has it.**

The rain's bug was specific: its object transform never moves, but its
**vertices** are rewritten in world space each frame, and three caches
`geometry.boundingSphere` once. The sphere stayed at the origin while the drops
walked away, so the cull test became "can you see the middle of the map".

The star sets do it the other way round: their vertices are static and their
**parent** moves — `ct/props.ts:2033`, `starDome.position.set(px, 0, pz)`. Three
culls against the local sphere transformed by `matrixWorld`, so the sphere
follows the player for free, every frame, with no cache to go stale.

`scripts/w15-points-audit.mjs`, on the built bundle:

```
  set     frustumCulled  parent    sphere centre dz over a 75 m walk   frames drawn (16 views)
  2600pt rain   false      Scene      0.0 m (fixed in the world)     0
    77pt stars  true       Group    -75.0 m (FOLLOWS the player)   155
    13pt stars  true       Group    -75.0 m (FOLLOWS the player)   155
```

The sphere centre tracks the 75 m walk **exactly**, and both sets are drawn in
**every one of 155 render calls across 16 views** (four positions × four
headings) at night, with culling left on. `onBeforeRender` fires only past the
cull, which is w16's own instrument for this.

**So no change to `ct/props.ts`, and turning culling off for the stars would be
a pointless loss** — it is doing real work for two objects that are correctly
culled. My earlier reading that they "sit at the origin" (their local
`o.position` is `(0,0,0)`) is what makes this look like the rain's case; the
parent transform is the thing to look at.

---

## Mutation tests — the fix is only worth what its failures are worth

| mutation | result |
|---|---|
| shift 16 drops by 7.3 m so the rain "follows the camera" | **FAIL — 0/16 world-locked** |
| **revert the selector to the original** `o.type === 'Points'` (the exact shipped bug) | **FAIL — "13/16 … 0 of them actually wrapped"** |
| skip the `rainLevel` wait | **still PASSES** — see below |
| star audit's clause: any set still culled must nonetheless be drawn | fires on `drawn === 0` |

**The third one is worth reporting rather than hiding.** I expected skipping the
wait to reproduce the inert all-zero run and it did not: the 900 ms between the
two samples is by itself enough for the wrap to run. So fault (c) was never
sufficient on its own — **the all-zero readings came from (a), the wrong
object.** The `!moved` guard is still right and still catches the real shipped
state (mutation 2), but I am not claiming a mutation I did not observe.

## Verified

- `rain-check.mjs`: PASS, 16/16 world-locked, 16 wrapped — **on the built
  bundle** (`npm run build` + `vite preview`), not only on dev.
- `w15-points-audit.mjs`: PASS on the built bundle.
- `rainlive.mjs`: `rainLevel 0.9893  wetness 0.9843` outdoors, 0 indoors.
- `w16-rainlock.mjs` as an independent control: agrees, 16/16.
- No source changed, so no fingerprint comparison is meaningful.

## Found and did NOT fix

1. **`scripts/canfail.mjs`'s `rain` case is guarding air** — caught by
   `mutations-quote-real-source`, which reports `DEAD rain … matched 0x, not 1`.
   It substitutes `'const RAIN_N = 500;'`, and w16 changed that line to
   `const RAIN_N = 2600;` in `fc332c5c5` (`ct/props.ts:87`). **The `rain`
   selftest has patched nothing since**, so `npm run checks --selftest`
   certifies it as mutation-proof while it mutates zero bytes — the GOTCHAS 56
   "checks that slept" family. One line: `'const RAIN_N = 500;'` →
   `'const RAIN_N = 2600;'` (and the replacement to `'const RAIN_N = 6;'` still
   reads correctly). **Not fixed because w19 holds `scripts/canfail.mjs` right
   now** (queue item 21, DOING) — this is a one-liner for whoever is already in
   that file.
2. **`scripts/w16-rainlock.mjs` is now a duplicate of `rain-check.mjs`.** Its
   own header says it exists *because* `rain-check.mjs` was broken; that is no
   longer true and the two assert the same thing. I left it — the item does not
   name it, and it is a useful independent control today — but the desk should
   retire one of them.
3. **`rainlive.mjs` still only tests `hours[0]`**, one hour of the nine it
   prints. Widening it is a real improvement and not this item.
4. **The dev server hot-reloads under a long instrument.** `w15-mod24.mjs` died
   with *"Execution context was destroyed"* mid-`evaluate` because another
   builder saved a file in `src/`. On a shared worktree, anything that holds a
   page for more than a few seconds should point at a **preview**, not at
   `npm run dev`. Worth a GOTCHAS line.

## Derived or copied?

Derived. The wet hours come from the world's published `scene.userData.rainAt`
rather than a re-implementation — which is the specific fault (b) above. `BOX`
(30) is the one constant still hand-typed in `rain-check.mjs`; it was already
there and `RAIN_BOX` is not exported from `ct/props.ts`. **Queue a one-line
hoist** (`export const RAIN_BOX`) if anyone wants that closed properly; I did
not add an export to a file this item only needed me to read.
