# Item 226 — containment is a classification, not a box; and leg 6 could not see apt301

Queue worker **eightytwo**, 2026-08-03. Port **4380** (`ss -ltn` clean before
binding, `--strictPort`). **No world file changed** — `src/proto/` is clean.

Files: `scripts/interiors-walk.mjs`, new `scripts/lib/floors.mjs`, four probes in
`scripts/probes/w82-*`.

---

## THE REAL ESCAPE COUNT IS 0, AND IT ALWAYS WAS

Item 226 supersedes item 222, which superseded the desk's original claim that
*"you can walk through the casino and hotel walls, 8 and 9 escapes"*. Item 222's
author measured 1 and 0. **I measured 0 and 0**, and classified every endpoint
rather than counting it:

`scripts/probes/w82-classify-belt-endpoints.mjs`, all 12 belt rooms, 288 walks:

```
OWN 287   PARTY 1   OTHER 0   FLOORED 0   VOID 0
```

**Nobody has ever left the world here.** The single non-own endpoint is the
casino walking into the hotel through the **item-196 party doorway** — the
feature the user asked for in those words, *"i should be able to walk from one
into the other"* — at seventyone's exact coordinates (`-x` from local
`-3.79,-8.19`). The desk's 8-and-9 was wrong, item 222's 1 was the doorway, and
the honest number is **zero**.

## Why the check said "escape" when nothing escaped

`interiors-walk.mjs` leg 3 was a per-room **box test**:

```js
const ex = Math.abs(a[0] - cx) > hw + 0.18 + 0.05;
const ez = Math.abs(a[2])      > hd + 0.18 + 0.05;
```

It asks *"are you still inside YOUR OWN room"*, which **cannot distinguish left
the world from walked next door**. Item 196 gave exactly two rooms a doorway to
next door, so exactly two rooms "leaked" — and the ten rooms scoring 0 were read
as proof the check worked, when what they identified was *the ten rooms with no
party wall*.

## What it asserts now

Each endpoint is **classified**, and only one outcome is a defect in the world:

| class | meaning |
|---|---|
| `OWN` | still inside your own room |
| `PARTY` | inside a room this one is **declared** joined to — the feature |
| `OTHER` | inside a room it is **not** joined to — a real leak |
| `FLOORED` | no room, but ground under you |
| `VOID` | no room and **no floor** — the escape |

Two assertions, and **this is not a loosening**:

1. **`you never walk off the world`** — the user's own words, via item 215:
   *"allow for out of bounds."* The player must never stand where there is no
   floor.
2. **`the only way out of the room is a declared doorway`** — the room must
   still hold you. `OTHER` and `FLOORED` fail. They are asserted on rather than
   tolerated **because I measured that they never occur** (0 and 0 above); a
   threshold I invented instead would have been the item-215 mistake.

`PARTY` is read from **`ct/interior.ts` at runtime**, never copied —
`import('/src/proto/ct/interior.ts')` in the page, which vite dev serves
transpiled and the ES module cache already holds. A second party wall added
tomorrow is understood here with no edit. (BUILDER-BRIEF §8; this file has
already paid for a hand-carried copy once, with the pawn shop's `W`.)

## The floor predicate is item 215's, hoisted rather than retyped

`scripts/lib/floors.mjs` — every mesh's bounding box through `matrixWorld` **by
its eight corners**, keeping the thin-in-Y ones a metre across. 359 of them.

`groundAt()` cannot answer this and that is the first thing anyone reaches for:
`groundPick` (`crosstown.ts:1263`) never returns null, so it names a height for
every point in R², void included.

**`w75-site-contained.mjs` still holds the inline original.** Pointing it at the
new module is one line, but it is a registered check that is currently and
CORRECTLY red at the lot, and item 226 does not name it — filed below.

## Three negative cases, each watched to fail

A check I have never watched fail is a check I will argue with (GOTCHAS 27).

| mutation | result |
|---|---|
| harness blind to `PARTY` (`joined → false`) | **RED**: `walked into hotel going -x — casino and hotel share no declared party wall` |
| every floor dropped | **exit 3**, `FLOOR PREDICATE FAILED ITS OWN CONTROLS — nothing measured` |
| belt floors dropped + room membership off | **RED**: `walked OFF THE WORLD` ×3, exit 1, predicate still sound at 233 meshes |

The first is the one that matters: it proves the green is **knowledge of the
declared doorway**, not a loosened threshold. And in that run
`you never walk off the world` **stayed green** while the leak went red — the
two assertions partition exactly as intended.

**A first attempt at that case emptied `PARTY` in `ct/interior.ts` and proved
nothing**: `PARTY` also *builds* the opening (`interior.ts:373`), so removing it
seals the wall and there is nothing left to cross. Mutating the world and the
harness's knowledge of it at once cannot isolate either. `ct/interior.ts` was
restored byte-for-byte (`git status` clean).

I also added a **per-room positive control** — `the floor predicate can see this
room's own floor`. The predicate's startup controls are the road and a point past
the world clamp, both **outdoors**; a predicate that could not see interior
floors would pass those two and then call every interior endpoint VOID, i.e.
report an escape storm that is really instrument blindness. That control caught
the third mutation above, which is precisely its job.

## Leg 6 was blind to apt301 — and the row understated it

The row says leg 6 *"assumes every room sits on z = 0, so it sees 1 mesh instead
of 440"*. **Confirmed, and measured at 436**
(`scripts/probes/w82-party-and-apt301-sampler.mjs`):

```
as written (|z| < 8 about z = 0)     1 mesh,    2 materials
asking the room for cz             436 meshes, 156 materials
```

The one thing inside the old box is an unnamed plane at y 5.33 — the flat's own
floor slab, caught by its width. Everything the leg exists to judge was outside.

**But the row understates the defect: leg 6 never ran for apt301 at all.** It was
inline in the belt loop; apt301 is walked by the off-belt loop, which had no
light leg — **and the "NOT APPLICABLE here" line that loop prints did not name
the light either.** So the flat's lighting was neither tested nor declared
untested. That is the exact GOTCHAS 34 shape this file is otherwise careful
about, sitting inside the file's own coverage guard.

Leg 6 is now a function called by **both** loops, and its sampler asks the
registry for `cz` the way it already asked for `cx`.

**I deliberately did NOT add a storey bound, having tried it first.** It looks
obviously right — 301's ±8 m box takes in the flats above and below — and there
is no constant that does not break something else
(`scripts/probes/w82-storey-extent.mjs`, mesh origins relative to each room's
own floor):

```
ten belt rooms   0.00 .. +3.60      church  0.01 .. +9.50
library          0.00 .. +6.40      apt301  -7.90 .. +5.25
```

Any bound tight enough to isolate one flat of a 2.7 m stack throws away the
church's nave and the library's upper floor — reddening two rooms that are fine
to sharpen a third. And not bounding is cheap here: the leg asserts *no interior
material dims after dark*, so judging the neighbours' materials **broadens** the
population rather than corrupting it.

## Also fixed, same class

`cz` was written as a bare `0` in the belt loop's `standables` grid and in the
containment walk's warps. True of every belt room today, which is what makes it
dangerous — the shortcut is invisibly correct until a room declines to sit where
it was assumed to, and `apt301` already does. Same argument as `cx` at
GOTCHAS 86, one field over.

---

## Verified

Full suite, 13 rooms, against dev on 4380 (`interiors-walk` cannot run on a built
preview — item 164):

```
364/369 passed          (before this item: 362/368)
288 containment runs over 12 belt rooms — 0 ended with no floor
  11 rooms  "24 runs from 6 spread points, 0 ended with no floor"
   1 room   "…0 ended with no floor, 1 crossed a declared party doorway"  (casino)
apt301      9/9 — 0/64 materials dimmed, judged 64 of 64
```

- `npm run typecheck` — **0**
- `node scripts/health.mjs` — **0, `WORLD OK — __ct initialised`**
- `npm run sweep` — **`sweep findings: none (0 STATION MISS, 0 COVERAGE)`**
- `git status src/proto/` — **clean; no world file was changed**

**The 5 remaining failures are all pre-existing and none is containment:**
`jail: the room keeps its own light after dark` (below), and
`the customer station comes from the world, not from memory` at casino, hotel,
pawn and tax — the fallback that `notes/w71-vice-escape-is-a-doorway.md` already
records as pre-existing and unrelated. Exit 1 on any single-room run is the
standing `[interior:hotel] NO BUILDING NAME` kit warning.

### A caution about this run, and about mine generally

**My dev server was killed mid-run by something outside this worktree**, and the
suite kept going against the page it had already loaded. I discarded that run and
re-ran from a fresh server — but I only did so because I happened to notice the
notification. **The floor predicate's population floor cannot catch this**: it
runs once at startup, so a world that dies at room 7 still had 359 floor meshes
at room 0. A run that loses its server midway currently produces a full,
confident, green-looking report. Worth a row; it is the desk's own fourth
concern and the honest answer is that the floor does **not** make it impossible.

---

## FOR THE DESK — found and not fixed

1. **`w75-site-contained.mjs` should import `scripts/lib/floors.mjs`.** It holds
   the inline original of that predicate; there are now two copies, which is the
   defect BUILDER-BRIEF §8 names. One-line change, but to a registered check that
   is correctly RED at the lot and outside item 226 (§9). **Do not let anyone
   "fix" that red while doing it.**
2. **`RoomDims` should publish the room's HEIGHT**, the way item 192 made it
   publish `cx`. It is the missing number that would let leg 6 bound its sample
   box per storey instead of not bounding it. `ct/interior.ts`, not named by 226.
3. **THE JAIL DIMS ONE MATERIAL AT NIGHT — a real red, and NOT mine.**
   `jail: the room keeps its own light after dark` reports `1/97`, stably (2 runs
   of 2, `0 excluded as self-animating`). Located
   (`scripts/probes/w82-which-material-dims.mjs`): a mesh at
   **(1006.37, 2.42, −5.60)**, `#f0f3f6 → #6c6f76`. That is **inside the jail's
   own published footprint** (cx 1000, half-width 6.40 — the mesh is 6.37 out),
   so unlike apt301's two candidates this one really is the room's.
   **My changes cannot have caused it**: the jail takes the belt path, whose box
   is unchanged at 8 × 8 with no y bound, and whose only edit is `wp.z - cz` with
   `cz === 0` for every belt room. This is the night sweep reaching an interior,
   which is exactly what the leg exists to catch. **Worth its own row.**
4. **A run whose server dies midway still reports green.** See the caution above.
5. **`casino: the customer station comes from the world, not from memory` FAILS**
   — pre-existing, unrelated to containment, and already named as such in
   `notes/w71-vice-escape-is-a-doorway.md`. Not mine, not touched.
6. **`[interior:hotel] NO BUILDING NAME`** — the standing kit warning the builder
   brief already lists as expected.
