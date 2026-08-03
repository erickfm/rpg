# ninetyseven / item 96 — the hotel lobby, surveyed before anyone rebuilds it

**RELEASED with one fix landed.** The item's own instruction was *"read the
entry, walk the room, and report what you found **before rebuilding it
wholesale**"* — this is that report. I landed the one defect that is
unambiguously a defect and stopped, because **most of what the row lists is the
room's deliberate design, and two of those designs are things the user himself
asked for.**

The user's words, 2026-08-02: **"[screenshot] hotel interior is strange. needs
some work"** (`FEATURE-REQUESTS.md:2476`). Deliberately vague — so the row
listed five things the desk could *see*, correctly refusing to claim a verdict.
Four of the five do not survive contact with the file.

---

## The row's five observations, checked one at a time

| the row saw | what it actually is |
|---|---|
| the sign over the far door looking **MIRRORED** | **STALE — already fixed.** `int-hotel.ts:259` is not a fault report, it is a *fix* record: *"Both now go through the one rule in `vice.ts`"*, and the swing went with it (`LEAF_AJAR`, landed in `24416d198`, the only commit to touch this file since the user's screenshot). The row quotes the comment as if it were an open bug |
| **teal/lavender lobby chairs** against the red | **DELIBERATE, and it is the room's whole thesis.** The file header, line 24: *"four matched lobby chairs → **three that do not match**"*. `int-hotel.ts:973–977` — `0x5a6a5c` grey-green, `0x7a5a3a` tan, `0x6a4a52` mauve. Making them match would delete the point of the room |
| a **very busy carpet** | **DELIBERATE, and it is the user's own earlier instruction.** `:276` — *"Patterned carpet doing far too much rather than plain tile is the instruction, and it is the same instruction the casino got and the user liked the result of"*. It replaced cream-and-ochre tile that read *"municipal"*, which was itself a user complaint |
| a **near-black ceiling** against saturated red walls | **DELIBERATE cause, real symptom — the one worth arguing about.** `palette.ceil = 0x2e1c1e` against `wall = 0x6d2029`: RGB(46,28,30) vs RGB(109,32,41), so the ceiling is ~2.4× darker, with a written rationale (*"the ceiling is darker than the wall so the room feels tall and the light hangs IN it"*). It works in `bug-hotel-entry.png` and it does not in the other two — see below |
| the **clerk as a head with no body** | **NOT REPRODUCED.** He is a full `room.person` sprite off the same atlas as every street citizen (`:781`), standing in the 0.6 m staff strip behind a counter. In `bug-hotel-wide.png` he reads as head and shoulders above the counter, which is what a person behind a counter looks like |

**So: one stale, three deliberate, one unreproduced.** Anyone who works this row
from the row alone will spend the session undoing the room.

---

## WHAT I LANDED — the one real defect, and the row did not have it

**The hotel's own front door was being thrown away.** `DOOR` at
`int-hotel.ts:81` declares HOTEL ORPHEUS's 1.15 m leaf; the lobby has been
wearing **the kit's generic 1.1 m timber leaf** instead.

Root cause, one line: `bName` (`ct/interior.ts:1140`) is
`spec.building ?? fr?.name ?? null`, and **a chamfer room publishes no
frontage** — so `fr` is null and the name had to come from the spec. It never
did. `LEAF` resolved `null` and every reader below took its `??` branch.

The kit has been **screaming about this on every single load** — it is the
*only* `[interior:*]` warning in an otherwise clean 96-shot sweep, and two
registered checks fail on that channel (`scripts/interiors-walk.mjs:284`,
`scripts/G-rooms-walk.mjs:210`).

Fixed by passing `building: DOOR.building` — read off the declaration, not
retyped (BUILDER-BRIEF §8).

| measured | before | after |
|---|---|---|
| `interiors-walk.mjs hotel` (dev :4554) | **29/30**, plus `KIT WARNING [interior:hotel] NO BUILDING NAME` | **29/30**, warning **gone** |
| `bugsweep` occurrences of `NO BUILDING NAME` | **1** | **0** |
| `bugsweep` | 96 shots, 0 STATION MISS, 0 COVERAGE | unchanged |

The single `FAIL` — *"the customer station comes from the world, not from
memory"* — **is present in both runs.** It is pre-existing instrument debt (no
served-spot published in this room, so the check falls back to the authored pair
and cannot falsify it; `F-keeper-stations-audit.md`). Not caused by this change,
and I did not touch it.

---

## WHAT I THINK "STRANGE" ACTUALLY IS — measured, offered as a hypothesis

**The room is a corridor, not a lobby.** `H_W = 11.0, H_D = 26.0, H_H = 3.4`
(`:110`) — **2.4 : 1**, and the depth is the one dimension nothing constrains.
The width is pinned to the 12 m frontage (correctly — that is the
exteriors-match-interiors work); the depth was chosen, and the file says so
outright: *"9 m was a number I chose, not a limit I was given."*

Look at the three sweep frames and it separates cleanly by **which way the
camera points**:

- **`shots/bug-hotel-entry.png` — looking DOWN the length. Handsome.** The
  chandelier run, the key rack, the mahogany desk, the vinyl runner. Nothing
  wrong with this frame; this is the room the file describes.
- **`shots/bug-hotel-wide.png` — looking ACROSS. This is the "strange" one.**
  The top third of the frame is flat near-black; below it a vast unbroken red
  wall carrying **two tiny pictures and one clock** across ~11 m; the lift reads
  as a **corrugated grey roller shutter** with a mustard cylinder standing in
  front of it; the seating group reads as **flat untextured slabs** (they are —
  `MeshBasicMaterial`, no map, `:530`).
- **`shots/bug-hotel-far.png`** — a **large untrimmed red mass fills the right
  ~40% of the frame** with no dado rail on it, under a pure-black ceiling. **I
  did not identify what that mass is and I am not going to guess** — it is
  either the east wall seen very close, or something standing in the room. It is
  the first thing I would put an instrument on.

The dark ceiling is not wrong *by itself*; it is wrong **when there is no
chandelier in frame to justify it**, which is exactly the two frames that look
across the room rather than along it. Same for the wall: 3.4 m of ox-blood with
a dado rail is grand when you are looking down a colonnade of lights and bare
when you are standing side-on to it.

**So the cheapest real improvement is almost certainly not colour — it is
furnishing and breaking up the long axis**, or shortening it.

---

## FOUND AND NOT FIXED

- **The mass on the right of `bug-hotel-far.png`.** Named above. Measure it
  before touching anything else in this room.
- **The lobby suite and chairs are untextured `MeshBasicMaterial` boxes**
  (`:530` `plush`, `:973–977`). Every *surface* in this room declares a density
  (`declareSurface`), but the furniture does not — it is flat colour. That is
  exactly the class BUILDER-BRIEF §7b says nothing checks, because
  `scripts/masonry.mjs` only sweeps faces tagged `userData.masonry`.
- **The lift reads as a garage shutter.** Worth a look next to the file's own
  claim of *"a proper lift with a dial"*.
- **The `customer station` FAIL** above — real instrument debt, pre-existing,
  wants a served-spot published in this room.
- **I did not repaint anything.** The row says do not rebuild wholesale without
  reporting first; this is the report, and the aesthetic half needs the user's
  eye on a frame, not mine.

## WHY IT IS RELEASED, NOT DONE

The user's complaint is visual and open-ended, and **three of the five things a
builder would reach for first are load-bearing design decisions he asked for
himself**. Landing the door defect is real but he will never see it. The next
pass should start from `bug-hotel-wide.png`, not from the row.
