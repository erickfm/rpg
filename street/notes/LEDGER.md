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
| LANDED | E | park topography + mowing stripes | present in `park.ts`, but NOBODY HAS SEEN THEM — the desk has no visual evidence and will not confirm from a grep |
| OPEN | C | cars on the left row face backwards | reported TWICE |
| OPEN | C | cars clipping into each other | reported TWICE |
| OPEN | C | chairs outside the office face the wall | |
| OPEN | C | pole sign panel too small / skewed | |
| OPEN | C | spawn + respawn in room 301 | C owes the desk a coordinate |
| OPEN | C | export the weed tuft for B and E | B and E waiting |
| OPEN | D | ATM inlaid, slanted, lower, a little more detail | ATTEMPT 3 |
| OPEN | D | cat directly ahead from the alley mouth | FOURTH position note |
| OPEN | D | alley floor: dark diagonal streaks | may share a cause with the park |
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
| OPEN | H | tyres clip into the bed cavity | wells need an inner wall |
| OPEN | H | block protruding from wheels on all vehicles | |
| OPEN | desk | PVBLIC vs PUBLIC on the library | user's call, awaiting answer |
| OPEN | AUDIT | verify the ledger | |
