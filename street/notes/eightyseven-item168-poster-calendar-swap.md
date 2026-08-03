# eightyseven / item 168 — the poster and the calendar swap walls in 301

**The user:** *"put the calendar where the poster is and the poster where the
calendar is."*

Done, on the **built bundle** (`vite preview`, port **4430**, build `188e78d0a`).

| | was | now |
|---|---|---|
| **poster** (0.52 × 0.70 gig flyer) | SOUTH wall, x −1.05, y RY+1.55, no rotation | **NORTH wall**, x −2.45, y RY+1.66, **`rotation.y = PI`** |
| **calendar** (0.30 × 0.40, 1997) | NORTH wall, x −2.45, y RY+1.66, `rotation.y = PI` | **SOUTH wall**, x −1.05, y RY+1.55, **no rotation** |
| snapshots (control) | NORTH wall, untouched | unchanged |

Each takes the other's x and y **verbatim** — it is a swap of places, as asked —
and each takes **its new wall's rotation**, which is the half that fails
silently.

---

## The trap the item did not name, and it would have thrown at module init

**`NORTH_Z` was declared ~26 lines AFTER the poster.** Hanging the poster on the
north wall means reading `NORTH_Z` at the poster's line, which is a `const` in
its **temporal dead zone** — not a wrong position, a hard throw the moment the
module initialises. The item listed four traps and this was not among them.

Fixed structurally rather than by shuffling one line: **both hanging planes are
now declared together, above the poster**, as `SOUTH_Z` and `NORTH_Z`. That also
retires the bare `AZI(2.085)` literal the south poster used to carry, so the two
walls are now stated the same way in one place.

**They are not mirror images of each other, and the symmetry is the useful part:**
each wall is a box **0.14 deep**, so its room-side face is 0.07 from the
centreline and each hanging sits **0.085 from the centreline / 0.015 proud of the
face**. South is `AZI(2 + 0.085)`, north is `AZI(5.5 − 0.085)`. Confirmed in the
world at **15.0 mm proud on both**.

## The three traps the item did name

- **ENTOMBED.** `AZI(5.5)` is the north wall box's *centreline*; anything hung at
  `AZI(5.49)` is inside the plaster — present, `visible:true`, right x and y, and
  invisible. Both hangings measured **15.0 mm into the room** from their own
  wall's face.
- **MIRRORED.** `texM` is **DoubleSide**, so a wrong `rotation.y` removes nothing
  — it reverses the artwork. **The screenshot settles it: the calendar's
  masthead reads `1997` left-to-right.** A reversed plane would render it
  backwards.
- **DIFFERENT SIZES.** Measured rather than assumed, because the 0.52 × 0.70
  flyer moving into the 0.30 × 0.40 calendar's slot is **the direction that can
  foul** — and it lands on the wall that also carries the three snapshots. The
  poster spans x **−2.71…−2.19**; the snapshots span **−1.82…−1.42**; **370 mm of
  clear wall between them**, and **490 mm** from its left edge to the west wall's
  inner face at `AX(−3.2)`. Nothing overlaps.
  The other direction owes no check: at 0.30 × 0.40 the calendar fits strictly
  inside the footprint the poster vacated, and the south wall carries nothing
  else.

## Verification — `scripts/probes/w87-item168-poster-calendar-swap.mjs`

**13 checks, all green**, 0 console errors, on the built bundle.

The interesting one is **how "mirrored" is tested**: not against a literal
`rotation.y === PI` — which would happily pass a plane on the *wrong wall* — but
by taking each plane's own **+z basis vector out of `matrixWorld`** and asking
whether it turns **into the room**. That is the property that actually matters
and it cannot be satisfied by accident.

**Watched it fail before believing it (`--selftest`).** Three deliberate
breakages in the page, each **CAUGHT by the check that owns it**:

| mutation | caught by | reds |
|---|---|---|
| un-rotate the poster | the MIRRORED check | 1 |
| push it to its wall's centreline | PROUD + wall-plane | 2 |
| slide it onto the snapshots | OVERLAP + x/y | 2 |

The untouched calendar legs **stayed green through all three**, so the checks are
specific rather than a blanket that reddens on any disturbance. Population floor:
each of the three objects must be found **exactly once** inside 301's volume, or
nothing else is claimed.

## Shots I personally looked at

Two, and **two is physically necessary** — the walls face each other, so no
single camera can hold both; a view containing one has the other behind it. Both
from the middle of 301, turning on the spot.

- `shots/w87-168-north-poster.png` — the flyer above the bed, star and masthead
  reading correctly, curled corner bottom-left as drawn, snapshots clearly
  separate to its left. **My verdict: right.**
- `shots/w87-168-south-calendar.png` — the calendar above the TV (its rabbit ears
  are in frame), `1997` legible and correctly handed, the biro-ringed day
  visible. **My verdict: right.**

## Suite

`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**. `node scripts/health.mjs`
**WORLD OK, exit 0**, build `188e78d0a`. `npx tsc --noEmit` **clean**.

## Found and not fixed

- **The desk's line numbers were stale** — the item put the poster at ~2928 and
  the calendar at ~2969; they were at **3074** and **3115**. Both were findable
  from the descriptions, which were accurate, so this cost nothing. Worth knowing
  that the queue's line pointers into this file have drifted.
- **The south wall now reads a little empty**, and this is a judgement the desk
  may want to put back to the user rather than have me act on. A 0.30 × 0.40
  calendar sits where a 0.52 × 0.70 poster was, on a wall that carries nothing
  else, while the north wall now has the *larger* item **plus** the snapshots. It
  is exactly the swap he asked for and I have not second-guessed it — but if he
  meant "these two are in the wrong places" rather than "exchange these two
  rectangles", the balance of the room is the thing he will notice next. **Not
  changed: he asked for a swap of places, and inventing a resize would be
  answering a question he did not ask.**
- Pre-existing red untouched: `[interior:hotel] NO BUILDING NAME`.

## Derived or copied

**Copied, with citation, and deliberately.** The probe hard-codes
`APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7` from **`ct/apartment.ts:124`** and
rebuilds `AX`/`AZI`/`RY` from them, because those helpers are module-local and
not exported. Every other figure in the probe is **derived** from those three
(both wall faces, the room mid-plane, both expected positions) rather than typed,
so moving the apartment moves the check with it. The source itself gained no new
constants: `SOUTH_Z` is the pre-existing `AZI(2.085)` given a name, and `NORTH_Z`
is its old expression moved earlier, unchanged.
