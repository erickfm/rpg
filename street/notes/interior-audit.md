# Interior audit — the ten rooms as a SET

Four agents building ten rooms on a shared kit. Each can only see their own room,
so the failure mode is that the ten do not agree with each other. Everything
below is measured across all ten and compared, not judged room by room.

> **⚠ CORRECTED — read `## CORRECTIONS` at the foot first.** The casino and
> library figures in the tables below were measured against a build that was
> already stale when I wrote them. Both rooms have since been rebuilt much
> larger, and the corrected numbers change which room is the worst in the set.

Rooms sit on an interior belt at x 440…1160, 80 m apart, `cz 0`
(`__ct.roomDims()`). Walked all ten at 13:00; shots `int-<room>.png`.

---

## SEVERITY 1 — the bodega, and it is the user's complaint exactly

> *"bodega interior is very cramped and also doesnt match the exterior"*

**Cramped, measured.** Same instrument as the sidewalk audit: at each 0.25 m of
depth, the largest CONTINUOUS free run across the room.

| room | median clear aisle | free floor |
|---|---|---|
| **bodega** | **3.85 m** | 82% |
| library | 8.40 | 87% |
| church | 8.50 | 93% |
| thrift | 8.80 | 88% |
| hotel | 9.67 | 89% |
| diner | 10.13 | 81% |
| casino | 10.50 | 81% |
| tax | 11.80 | 90% |
| burger | 12.69 | 81% |
| pawn | 13.37 | 87% |

**The bodega is 2.6× tighter than the set median (3.85 m against 10.13 m) — and
its free floor area is completely normal at 82%, the same as burger and diner.**
That is the precise finding: the bodega does not have less space, it has its
space **cut into strips** by a central shelf run. Two depth-slices measure under
**0.72 m**, which is the player's own width. `shots/bod-c.png` shows it — a single
aisle between two floor-to-head-height shelf walls, running the whole depth.

*This tells the builder what to change: the fitting layout, not the room size.*
Widening the room would not fix it; moving one shelf run would.

**Does not match the exterior, measured.** Room width against published frontage:

| shop | room w | frontage | ratio |
|---|---|---|---|
| burger | 14.8 | 16.0 | 0.93 |
| pawn | 13.8 | 15.0 | 0.92 |
| tax | 11.8 | 13.0 | 0.91 |
| diner | 10.8 | 12.0 | 0.90 |
| thrift | 11.3 | 12.5 | 0.90 |
| **bodega** | **8.8** | **6.05** | **1.45** |

Five shops agree on a rule — interior ≈ 0.90–0.93 of frontage, a sensible wall
allowance. **The bodega is the only one wider than the shopfront it stands
behind**, by 2.75 m. The set's own consistency is what makes this undeniable; it
is not a matter of taste.

Two more bodega mismatches:

- **Built size exceeds declared size.** Geometry spans x 435.4…444.6 (9.2 m) and
  z −5.7…6.5 (12.2 m) against a declared `w 8.8, d 11`. The declaration
  understates the room, so any check trusting `roomDims()` measures the wrong box.
- **Its door is in two places.** `doors()` puts the entrance on a chamfered
  corner at `(8, −95)`, `stand (7.47, −95.53)`; `__frontages` puts the BODEGA door
  at `x 12.82` on the `z −96` face. Related open row: *"the interior door doesnt
  match the exterior doorway"*.

---

## SEVERITY 2 — four of ten rooms cannot be checked against their exterior at all

`__frontages` has 16 entries. **casino, church, hotel and library are absent from
every one of them.** I previously recorded this for the church alone; it is four
rooms, and it is the reason no script can ask "does this interior agree with
where the building stands on the street" for any of the large buildings.

These are precisely the rooms with open user complaints about exterior/interior
disagreement — *"hotel exterior looks nice / interior doesnt match the exterior
however"*, *"make the library interior larger and more ambitious"*. **Nobody can
close those with a measurement until the four buildings publish a frontage.**

One line each, in the same form the other 16 already use. That unblocks the check
for the four biggest buildings in the world.

---

## SEVERITY 3 — where the set does not agree

Not faults on their own; they are the spread a shared kit is supposed to prevent.

| property | range | outliers |
|---|---|---|
| ceiling height | 2.60 → 3.60 m | **bodega 2.60** lowest; library 3.60 highest (church 6.4 is a nave, legitimate) |
| door width | 1.10 → 1.60 m | bodega 1.10 narrowest; library 1.60, church 1.40 (civic, reasonable) |
| frame luminance | **58.8 → 176.5**, a **3×** spread | hotel 58.8, casino 76.4 darkest; burger 176.5 brightest |
| warmth (R−B) | 20.2 → 41.2 | hotel 41.2 and casino 40.5 distinctly warm; the other eight 20–29 |
| textured material fraction | **0.11 → 0.57**, a **5×** spread | casino 0.11 lowest, pawn 0.57 highest |

**The dark rooms are deliberate, and I checked rather than assumed.**
`int-hotel.png` is a moody red lobby with four working ceiling lamps casting
visible pools, a reception counter and a `WEEKLY SINGLE $42` rate card. The low
number comes from the palette, not from missing light. Casino likewise. **Do not
"fix" these two to match the set.**

The one worth a look is **casino at 0.11 textured** — five times less texture than
pawn, in the room the user asked to make *"bigger and more expansive"*.

---

## Patterns — root causes, not instances

1. **The declaration and the geometry disagree, and only the geometry is real.**
   `roomDims()` says the bodega is 8.8 × 11; it is built 9.2 × 12.2. Any audit
   trusting the declaration measures a box that does not exist. This is the same
   shape as the pickup bed, where source constants described a cavity that the
   built wheel housings had already changed.
2. **Free area is not the same as usable shape.** Every room has 81–93% free
   floor, so that number distinguishes nothing. The largest continuous run is
   what separates the bodega from the other nine. *"Cramped" is a statement about
   shape, and only a shape metric finds it.*
3. **What is not published cannot be checked.** Four rooms have no frontage, so
   four of the biggest interior/exterior complaints are unfalsifiable by script.
   The gap is one line per building, and it blocks more than it looks like.

---

## [I] A fault in my own instrument, recorded because it nearly published a lie

I photographed **the street** and labelled it `int-bodega.png`. The warp to
(440, −4.2) was refused — a collider ejected the camera to x 0 — and my check
logged the camera's **height** but never its **position**, so it reported a
perfectly plausible luminance for a room it was not standing in.

My own queue names this defect: *"each check re-warps AND verifies it landed
where it meant to before pressing a key."* I had read that line and still shipped
a check without it. The rerun lands 7 of 10 and says which 3 missed and by how
much. **Verifying the camera's height is not verifying its position** — height
succeeds even when the warp is refused, because the eye offset is applied to
wherever the camera already was.

## What this audit did NOT cover

Doorway **jamb reveals and wall thickness** need per-opening geometry rather than
room-level boxes, and **floor texel density** needs the texture's world scale per
room; neither is in this pass. Also not covered: whether each room's window agrees
with the building's real street position — blocked for four rooms by the missing
frontages above, and worth doing for the other six as a follow-up.

---

# CORRECTIONS

**I measured the casino and the library against a stale bundle.** I rebuilt the
preview at the start of the session and G's interior work landed after it, so the
tables above describe rooms that no longer exist. Corrected against build
`4a311be0a`:

| room | area then → now | median clear aisle then → now |
|---|---|---|
| **library** | 163 → **326 m²** | 8.40 → **2.10 m** |
| **casino** | 95 → **323 m²** | 10.50 → **17.00 m** |

Also corrected: casino frame luminance 76.4 → **57.8** (now the darkest room, not
the hotel) with warmth 40.5 → 27.8; church luminance 132.2 → **163.3**; casino
free floor 81% → **70%**, the lowest in the set.

## SEVERITY 1 (new) — the library is now the tightest room in the world

> *"make the library interior larger and more ambitious"*

It got larger — **163 → 326 m², doubled** — and its **median clear aisle fell from
8.40 m to 2.10 m**, which is now the narrowest of all ten, tighter than the
bodega's 3.85 m that this audit called severity 1 an hour ago.

**This is the bodega's fault, reproduced in a second room.** Free floor is 81%,
completely normal; the space was not consumed, it was **cut into strips** by the
stacks that filled the new footprint. The request was for a bigger library and
the room did get bigger — but a reader walking it now has less continuous room
than in any other interior in the world. *Doubling a room and quadrupling its
subdivision leaves it feeling smaller, and only a shape metric shows that.*

## SEVERITY 1 (new) — the casino interior is twice the building it is in

> *"casino interior is nice but i want more. bigger and more expansive"*

| | interior | exterior footprint | ratio |
|---|---|---|---|
| **casino** | 17 × 19 = **323 m²** | 11.55 × 14.30 = **165 m²** | **1.96×** |
| church | 8.5 × 16 = 136 | 8.00 × 18.00 = 144 | 0.94× |
| hotel | 11 × 9 = 99 | 12.00 × 14.30 = 172 | 0.58× |

It did become more expansive — and it now needs **twice the floor its building
covers**. This is the bodega's "wider than its own shopfront" fault at a much
larger scale: the bodega overran by 2.75 m, the casino overruns by 158 m².

## The "four rooms cannot be checked" claim above was too pessimistic

Three of the four do not need a `__frontages` entry after all — the building's
own collider has a facade, and the published door sits on it, so the footprint is
derivable (church 0.94×, hotel 0.58×, casino 1.96× above). **Only the library
resists**, and for an interesting reason: its door point `(−11, −13)` lies inside
no collider at all, because it is a recessed civic entrance set ~4 m behind the
building line at the top of the forecourt steps.

So the recommendation narrows usefully: **the four buildings would still benefit
from publishing a frontage, but the check is not blocked on it.** What is blocked
is only the library, and only because a recessed door has no wall directly behind it.

## [I] The same stale-build fault, twice in one session, in opposite directions

Earlier today a stale bundle made me count 51 street weed tufts where the current
build has 5 — I would have sent correct work back to OPEN. Here the same fault ran
the other way: it made me publish a report describing two rooms that had already
been rebuilt, and **call the bodega the worst room in the set when the library is
worse.** A wrong report is not safer than a wrong verdict; it just fails quietly.

**Rule, now applied to every verification in this audit: rebuild before measuring,
and read the build stamp in the corner of the shot before believing a number.**
`scripts/lib/which-world.mjs` exits 3 on a SHA mismatch and belongs at the top of
every one of these scripts, including the ones I wrote today.
