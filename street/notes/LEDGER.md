# Request ledger

One line per user request. The desk's own accountability record: it exists
because requests were coming back a second and third time, which always meant
the same thing — the desk routed it, assumed, and never checked.

**Format is parsed. Keep it.**

    | STATUS | owner | request (user's words, trimmed) | evidence |

`STATUS` is one of:

- **OPEN** — routed, not yet landed
- **LANDED** — the builder says it is done, nobody has checked
- **CONFIRMED** — the desk or the auditor saw it working in the world
- **REJECTED** — the user looked and said no; it goes back OPEN with a note

**LANDED is not done.** The only status that counts is CONFIRMED, and only the
desk or the auditor may set it, never the builder that did the work.

`scripts/ledger.sh` lists everything not CONFIRMED. Run it before telling the
user anything is finished.

| STATUS | owner | request | evidence |
|---|---|---|---|
| CONFIRMED | F | wheel arches read as arches | +0.057 m arch above tyre, walked from the kerb |
| CONFIRMED | E | library steps climbable | gy 0.42 → 0.99 |
| CONFIRMED | E | church steps + churchyard | gy 0.31 → 0.51, in through the gate |
| CONFIRMED | E | park lit | 20 light sources, ten lanterns, three ranks |
| CONFIRMED | E | park not a yard | 42.5 m walkable, 569 meshes |
| CONFIRMED | F | library courtyard benches sittable | `[E] sit` on the frontage |
| CONFIRMED | F | interior people on the 8-angle atlas | 4 rooms, 8 distinct frames each |
| CONFIRMED | G | casino + hotel blades read correctly | both directions, from the street |
| CONFIRMED | D | burger barn red + beige | no yellow remains |
| CONFIRMED | C | car lot: enterable, office at back, rows | walked in |
| CONFIRMED | D | bodega entry blocker | three approaches |
| CONFIRMED | B | night: road darkened, lamps reach objects | measured |
| CONFIRMED | desk | world stops reloading under the player | two runs, no change |
| CONFIRMED | D | alley grate matches the kerb inlet | frame, bars and depth visible in the user's own shot |
| CONFIRMED | C | TODAY ONLY board removed | only a comment remains recording its removal |
| CONFIRMED | E | park: "some way to represent a grass field" (mowing stripes) | WALKED AND SEEN, `shots/pk-field.png`, `pk-relief.png`, `pk-day-*.png` (13:00). Broad lighter/darker bands run the length of the field and read unmistakably as mown grass from both ends and from the mound. Visible by day, correctly invisible at night (`pk-night-*.png`). — auditor |
| OPEN | E | park: "topographical changes" | MEASURED, NOT CONFIRMED. groundAt on a 0.5 m grid, 3717 samples over the whole site: range **0.365 m** (0.140 → 0.505), peak at (−24, −84.5). But the median IS 0.140 and **85.2% of the park is flat at 0.14 m**; p90 is 0.219. Crossing the middle at z −83 a walker meets 0.14 → 0.40 → 0.46 → 0.31 → 0.14, so it is FELT underfoot. It is not SEEN: in `pk-relief.png` (stood west of the crest, eye level, looking along the rise) and `pk-field.png` (full length of the field) the far railing, benches and boundary are visible across the entire width with nothing occluded behind a crest, and the horizon reads flat. The desk's test is whether a player STANDING IN THE PARK SEES rising ground; they do not. — auditor |
| OPEN | C | cars on the left row face backwards | reported TWICE |
| OPEN | C | cars clipping into each other | reported TWICE |
| OPEN | C | chairs outside the office face the wall | |
| OPEN | C | pole sign panel too small / skewed | |
| OPEN | C | spawn + respawn in room 301 | C owes the desk a coordinate |
| OPEN | C | export the weed tuft for B and E | B and E waiting |
| LANDED | D | ATM inlaid, slanted, lower, a little more detail | recess 0.15 m, opening larger on all 4 sides; normals MEASURED screen 8.1° / keypad 33.7° up; screen 1.37, keypad 1.10, base 0.90 above walk; shots/D-atm3-standing.png |
| LANDED | D | cat directly ahead from the alley mouth | 5th position, placed by LOOKING not deriving: 2.35 m in, centred in the mouth view, 1.13 m clear of the grate; shots/D-cat-frommouth.png |
| LANDED | D | alley floor: dark diagonal streaks | NOT shared with the park — they were mine, 16 radial strokes I added one commit earlier; replaced with a soft radial wash; shots/D-alley-floor.png |
| OPEN | B | apron untextured, needs ramp, must abut | |
| OPEN | B | tree pit: trunk off-centre toward the kerb | possible regression from the clearance fix |
| OPEN | B | cups too common and too big | oversizing was the desk's instruction |
| OPEN | B | explain the shadow geometry on the forecourt | user asked for an EXPLANATION |
| OPEN | E | park: shrubs at the edges | |
| OPEN | E | park paths read as road, not park path | biggest single win left in the park |
| OPEN | E | park: black rectangles + diagonal streaks | |
| OPEN | A | thrift facade lazy and chopped off | |
| OPEN | A | shopfront backing plane — pavement shows through glass | raised TWICE |
| OPEN | A | diner blade illegible | check GOTCHAS §10 first |
| OPEN | F | thrift interior too thin | thinnest room in the world |
| OPEN | G | tax preparer faces backwards | GOTCHAS §23 |
| OPEN | G | "the front of the bank doesnt match the side fix this" — flat brown flanks | RAISED TWICE. Measured at HEAD: 12 untextured 0x53382e faces on GOLDEN ACES + HOTEL ORPHEUS (vice.ts:371). Every other building on the block was fixed; these two were split into ct/vice.ts before that work and did not travel. Added by D, who is barred from the file |
| OPEN | G | "all buildings need to be much deeper otherwise it looks like a fake building" | Measured at HEAD: both vice shells are still BoxGeometry(w, h, 3.4). Same split as the row above. Added by D |
| OPEN | H | tyres clip into the bed cavity | wells need an inner wall |
| OPEN | H | block protruding from wheels on all vehicles | |
| OPEN | desk | PVBLIC vs PUBLIC on the library | user's call, awaiting answer |
| OPEN | AUDIT | verify the ledger | |
