# ninetythree / item 250 — the floor classifiers move to the raycast

All runs on the **dev server, port 4491** — `interiors-walk.mjs` is dev-only
(item 246, and now stated in BUILDER-BRIEF §10). Builds `38df7932f` /
`22c4febe6`.

---

## The number that settles it, measured on this world

```
AABB  sampleFloors keeps      357 meshes
RAY   installRayFloorQuery     7,866 meshes, 93,493 triangles
```

**357 of 7,866.** The row said the size filter hides 7,513 of 7,870; measured
here it hides 7,509 of 7,866, which is the same fact. It is not boxes-versus-rays
— it is the filter in front of the box, and that is why the park's 32×30 m floor
could vanish for being **53 mm** over a 0.600 m size threshold.

Both figures come from the running world in one process
(`sampleFloors` and `installRayFloorQuery` against the same page), so they are
comparable rather than quoted from two sessions.

## Converted — the real classifier uses

| file | sites |
|---|---|
| `scripts/interiors-walk.mjs` | 2 — the "walked out of every room" leak test, and the room-centre positive leg |
| `scripts/probes/w82-classify-belt-endpoints.mjs` | 1 — the FLOORED/VOID classification itself |

Every site `await`ed. Found by grepping the **use** — `!hasFloor(`, `if
(hasFloor(`, `&& hasFloor(`, `hasFloor(…) ?` — not the name.

**The room-centre check called the predicate twice inline**, once for the
boolean and once for the message. Hoisted to a single awaited value: under the
async query the second call would have interpolated a `Promise` into the failure
text of the very check that was already silently green.

## GOTCHAS 90, demonstrated on this file rather than cited

Same broken query (`async () => false` — the predicate answers VOID
everywhere), same room, controls bypassed so the run proceeds:

| | result |
|---|---|
| **`await` kept** | `FAIL library: the floor predicate can see this room's own floor` — **28/29** |
| **`await` removed** | ` ok  library: the floor predicate can see this room's own floor` — **29/29** |

A Promise is truthy. The un-awaited form **passes on a world where the predicate
says there is no floor anywhere**, and prints `FLOORED` while doing it. That is
the negative case watched failing, and it is the proof the `await` is
load-bearing rather than decorative.

## Unmutated results

| | |
|---|---|
| `interiors-walk library` | **29/29** (was 29/29 on the box) |
| `interiors-walk apt301` | **9/9**, ceiling derivable |
| `interiors-walk casino` | 29/30 — `the customer station comes from the world, not from memory` |
| `interiors-walk jail` | 28/29 — `the room keeps its own light after dark` |
| `w82-classify-belt-endpoints`, 12 belt rooms | OWN 287 · PARTY 1 · OTHER 0 · **FLOORED 0 · VOID 0** |

**The casino and jail reds are INHERITED, and I proved it rather than asserted
it:** I ran the pre-conversion file (`git show HEAD~1:…`) against the same
server and got **the identical 29/30 and 28/29 with the identical failing
lines** — and its banner printed `357 floor meshes`, which is where the AABB
figure above comes from, taken in situ.

## THE ONE THE ROW'S OWN GREP RULE COULD NOT FIND

`interiors-walk.mjs` also used **`FLOORS`** — the mesh list, not the predicate —
at the off-belt ceiling derivation:

```js
const ceil = FLOORS.filter(fl => …footprint… && fl.y > gy + 1.6)
                   .reduce((lo, fl) => Math.min(lo, fl.y), Infinity);
```

Deleting `sampleFloors` took that out and the off-belt room died with
`ReferenceError: FLOORS is not defined`. **Grepping the use of `hasFloor`, which
is what item 250 instructs, cannot find a second symbol drawn from the same
import.** Grep the import list too. Recorded in the file.

`sampleFloors` is therefore **restored, for that one use only**, with a comment
saying it must not be "finished". It is not a floor test: a point predicate
returns a boolean, not an elevation, so neither predicate can answer "where is
the ceiling". And the over-claim does not reach it — it is a `Math.min` over
slabs, so the size filter can only make it MISS one, and a miss is caught loudly
by the `Number.isFinite(ceil)` check two lines below.

## LEFT ON THE BOX TEST, AND WHY

Each now carries a header block saying so, so nobody re-opens it:

| probe | why it keeps `makeHasFloor` |
|---|---|
| `w91-floor-predicate-reconcile.mjs` | **its subject IS the box-versus-ray disagreement.** It runs both and reconciles them; `makeHasFloor` is one of the two things being compared |
| `w91-where-is-the-underclaim.mjs` | it validates a fast accelerator **against** `makeHasFloor` on random cells, then locates where the box under-claims. The box is its reference, not its tool |
| `w82-are-interior-floors-sampled.mjs` | it asks whether `sampleFloors`/`makeHasFloor` can see interior floors **at all**, before and after entering a room. The AABB pass is the thing under test |

Converting any of the three would delete the question it exists to ask.

## FOUND AND NOT FIXED

- **The two inherited reds above** — `casino: the customer station comes from the
  world, not from memory` and `jail: the room keeps its own light after dark`.
  Both reproduce on the pre-conversion file. Not floors, not mine.
- **`[interior:hotel] NO BUILDING NAME`** kit warning still takes an otherwise
  clean dev run to exit 1. Also inherited; also visible in `npm run sweep`.
- **I did not run all 13 rooms.** Four were run individually (library, casino,
  jail, apt301) plus all 12 belt rooms through the classifier, which exercises
  the same predicate on the same endpoints. A full `interiors-walk` with no room
  argument is ~30 minutes and BUILDER-BRIEF §3 forbids backgrounding it; it is
  worth one dedicated run before this is marked CONFIRMED.
