# onehundredone / item 179 — knives, bolt cutters and guns, behind the glass

**DONE.** The user: *"pawn shop should contain, knives, bolt cutters, guns, on
top of the regular stuff."*

**"ON TOP OF" WAS TAKEN LITERALLY.** Nothing in `ct/int-pawn.ts` was moved,
resized, recoloured or removed. The tools, the guitars, the brass, the TV stack,
the island case, the west cabinet, the counter and the broker are byte-for-byte
where they were; the diff is one new section of ~120 lines and one added import
symbol. Three fittings went into wall that was empty.

---

## Where, and why exactly there

A real shop puts this stock **behind glass, behind the counter, on the wall the
customer cannot reach** — period-true, and it says *"not for browsing"* without
a word of text. This room's counter already runs **wall to wall at 1.26 m**
(that was the fix for *"it's like i'm behind the counter"*), so anything hung
above it is visible and unreachable at the same time.

There are exactly three gaps in the back wall where that is true, and they are
**the existing art's own extents**, not numbers I chose:

| gap | from | what went in |
|---|---|---|
| x −6.9 … −4.75 | west of the TV stack (x −4.3, w 0.78) | **the knife case**, 2.0 × 1.0 m at x −5.8 |
| x 2.60 … 3.42 | between the guitars (4.4 m at 0.4) and the brass (0.95 m at 3.9) | **the bolt cutters**, 0.8 × 1.2 m at x 3.0 |
| x 4.38 … 6.9 | east of the brass | **the gun cabinet**, 2.4 × 1.25 m at x 5.6 |

Everything is placed against `hw` and `hd`, so a frontage change moves the new
fittings with the old ones. Tightest clearances: **0.025 m** either side of the
brass, **0.10 m** off the tool board, **0.11 m** off the TV stack, **0.10 m** off
the east wall. Vertically all three sit **1.45 → 2.71 m**, which leaves 0.19 m of
wall showing above the counter top and 0.09 m below the 2.8 m ceiling.

**All three are boxes with ONE drawn face** — the TV stack's own pattern,
material index 4 being `+z`. 0.14 m of carcass depth is what makes a case read
as a case rather than as a poster of one.

**No colliders were added.** They are wall fittings above head height behind a
wall-to-wall counter; a collider there would be a second wall in the same place,
which is how the bodega's door got eaten (GOTCHAS §8).

## The three, as drawn

- **Knives** — *"a row of bright verticals under glass"*. Blades point up and are
  the palest thing in the room against oxblood felt, the darkest; at this pixel
  scale **that contrast IS the object**, because a knife drawn as a knife is four
  texels of nothing. Two shelves — one row of anything reads as a sample, two
  reads as stock. Horn / bone / black handles on a 3-cycle, tagged.
- **Guns** — *"a dark angular silhouette against a pale pegboard"*. Five long
  guns racked **upright**, which is both how they are stored and the only way a
  1.1 m object fits a 1.25 m case; rifle and shotgun silhouettes alternate (one
  bore or two, scope or none) so the row is not one shape five times. Two
  handguns on the lower shelf, a central mullion, and a brass lock that says
  this case is the one that stays shut.
- **Bolt cutters** — *"one long shape with red grips, and the red is what sells
  them"*. Three pairs in a descending size run, and they hang **outside** the
  glass on a board of their own: they are hardware, not treasure, and a shop
  that locks its bolt cutters up is telling a different story from the one this
  street tells.

---

## Texture density — the item's explicit condition

> *"the world just went 392 → 188 gross faces, do not add to the count."*

**It did not move.** `interior:pawn` gross is **10 before and 10 after**.

Every canvas is sized `metres × 40` on **both** axes and declares that density,
so each face is **exactly square by construction rather than by luck** — which is
what the gross count measures. This uses `declareSurface(t, kind, ppm)`, whose
third argument **did not exist until today**: it is item 163, which I built two
items ago, and §7b's "declare your density" was literally impossible to obey
before it. `texdensity --all` flags **no face declaring 40 px/m**.

Worth noting for the desk: the existing back-wall art is *not* square — the tool
board is 20 × 33 px/m (1.67), the guitars 21.8 × 30.3 (1.39). Neither is gross
so neither is a defect today, and **I did not touch them**; but the new work sits
next to them at 40 × 40 and the difference is visible in a close frame if anyone
goes looking.

---

## My verdict on the frames, which I have looked at

`shots/w101-pawn-{from-the-door,at-the-counter,knives,guns}-after.png`, shot
from **a customer's standing position on the customer floor** as the item asks —
positions derived from `__ct.roomDims()`, not from the coordinates I typed — at
a **pinned 13:00**.

- **from-the-door** — the whole back wall reads left to right: tools, knives,
  TVs, guitars, bolt cutters, brass, guns. The knife case's white verticals and
  the bolt cutters' red are the two things your eye goes to, which is right.
- **guns** — the cabinet reads unmistakably: pale pegboard, five dark uprights
  with walnut stocks, two tagged handguns below, mullion, brass lock.
- **knives** — reads unmistakably as a knife case.
- **nothing clips.** The pale angular shape below the bolt cutters in the `guns`
  frame is the **existing tethered pen on its pad** at x −1.2 seen close and
  edge-on, not a new object — I checked rather than assuming, because "a grey
  thing I cannot name" is exactly the shape of the finding worker ninetyseven
  refused to guess at in the hotel.

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` (built bundle, :4191) | `WORLD OK`, exit 0 |
| `scripts/interiors-walk.mjs pawn` | **29/30**, 63 of 63 materials judged |
| `texdensity` | `interior:pawn` 10 → **10**; no 40 px/m face flagged |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE** |
| new colliders | **0** |

The single `interiors-walk` FAIL is the pre-existing served-spot instrument debt
that every room reports (`F-keeper-stations-audit.md`), present before and after.

---

## THE BOLT CUTTERS, as the item asked me to comment on

> *"He named a burglary tool between knives and guns. He may well intend them to
> be usable later. Do not build that now — but if making them a real item rather
> than scenery is cheap, say so."*

**It is cheap, and here is the specific reason.** The inventory and the
package-stealing mechanic already exist and are CONFIRMED, and this room already
has a locked cabinet on the west wall with its own `solid()`. Making the cutters
real is: give the board a `ctx.seat`-style spot with a label, and have taking one
add an item — **no new system, no new art, and the object is already drawn at
the size it would need to be.**

What it should NOT be is bolted onto this row. **He did not ask for it**, and
item 180 (the fencing mechanic) is the row that owns what the pawn shop *does*
as opposed to what it *contains*. If the cutters become usable they belong with
180's economy, not with 179's set dressing — a usable burglary tool with no
fence to sell to is half a feature.

---

## FOUND AND NOT FIXED

1. **The existing back-wall art draws non-square** — tool board 1.67 aspect,
   guitars 1.39, brass 1.42. Under the 4× GROSS line so not on any backlog, and
   not mine to change on this row; but they are the immediate neighbours of the
   new work and a pass that squared all three would cost about ten minutes.
2. **`interior:pawn` still carries 10 gross faces**, all pre-existing. Item 162's
   territory.
3. **Items 178 and 180 are untouched**, as the item instructs. I did not go near
   the fencing logic and I did not put packages anywhere.
