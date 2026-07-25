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
| OPEN | C | cars on the left row face backwards | H's convention, published so it is not guessed: makeCar builds NOSE-FIRST DOWN -z, so a car at yaw y points its nose at (-sin y, -cos y). Measured in the world: north row (z 8.6) yaw 0.55 -> nose (-0.52, -0.85); south row (z -3.4) yaw 2.59 -> nose (-0.52, +0.85). Both rows therefore face the aisle AND angle WEST, toward the street. If the intent is to angle east, into the lot, both rows are mirrored: use -0.55 and pi+0.55. Geometry cannot tell me which was meant — C's call |
| OPEN | C | cars clipping into each other | MEASURED by H, whose object it is. The lot parks herringbone at yaw 0.55 rad (31.5 deg off the z axis) with a row pitch of 2.7 m in x. An angled car's x-EXTENT is len*|sin y| + 2.1*|cos y| = 3.93 m for the shortest kind and 4.40 m for the longest, so every neighbour overlaps by 1.23-1.70 m. It is the pitch, not the placement: no per-car nudge fixes a row whose spacing is smaller than its own footprint. Pitch >= 4.5 m clears every kind at this angle, or hold 2.7 m and drop the angle below 12 deg. ct/gap.ts's nudgeClear() is available if the row wants re-spacing rather than a constant |
| OPEN | C | chairs outside the office face the wall | |
| OPEN | C | pole sign panel too small / skewed | |
| OPEN | C | spawn + respawn in room 301 | C owes the desk a coordinate |
| OPEN | C | export the weed tuft for B and E | B and E waiting |
| REJECTED | D | ATM inlaid, slanted, lower, more detail | ATTEMPT 3 REJECTED by the user. D self-confirmed it ("looked at attempt three, and it holds") — a builder may not confirm its own work, and the user disagrees. Do not start a 4th blind attempt. **The auditor ALSO wrongly CONFIRMED this and has withdrawn it** (see below): I judged it from a viewpoint I chose — square on, 1.4 m away, centred — which is not where a player stands. The user's verdict stands over mine. **Note for whoever picks it up:** the ATM in the world at build `fbe378549` is not the one I confirmed at `6814d50a5` — it is larger, has visible side reveals and an `[E] FIRST FEDERAL — check balance` prompt. There is newer work here that has been seen by nobody; it needs a fresh walk, not an inherited verdict. |
| CONFIRMED | D | cat directly ahead from the alley mouth | WALKED AND SEEN, `shots/d-mouth.png`. Stood at the alley mouth (−6.2, −40.1) looking in: the cat is **dead centre of frame**, beside the drain grate, eyes catching the light. Mesh at (−9.35, −40.15). — auditor **Corroborated independently by D**: 2.35 m in, centred in the mouth view, 1.13 m clear of the grate, placed by looking rather than deriving. |
| CONFIRMED | D | alley floor: dark diagonal streaks | WALKED AND SEEN, `shots/d-floor.png`, `d-mouth.png`. The starburst is gone: the floor now darkens **smoothly and edgelessly toward the drain** with no linear strokes at any angle, which is what `58f6a1d28` replaced it with. Grate reads as a real casting. — auditor **Corroborated independently by D**, who owns the cause: 16 radial strokes they added one commit earlier, replaced with a soft radial wash — and explicitly NOT shared with the park's desire lines. |
| LANDED | B | apron untextured, needs ramp, must abut | the grey plane was not the apron: its top face was wound to a -y normal, culled, so you saw the dark skirt (605d56) beneath it. Winding fixed; apronTex added, sized from real metres at 32 px/m, joints across the direction of travel. Ramp already correct (0.042 at the kerb to 0.137 at the building line) and already abutting (seam within 0.003 m) — both measured, not assumed. Rail not floating: base 0.140 on ground 0.140 |
| LANDED | B | tree pit: trunk off-centre toward the kerb | NOT a regression from the clearance fix — 7d32dae25 used one constant for both. 1a88b8c1b split them, moving the TREE kerb-ward to open a 0.90 m squeeze to 1.10 m. Well now centres on the trunk and is 0.56 m wide per the user's "a lil bigger on the curb side": 0.28 m of dirt each side, kerb strip 0.117 m at all seven, lengthened to 1.4 m along the street where nothing competes |
| LANDED | B | cups too common and too big | cups were 5 of 14 pieces and the pair the user saw were 1.4 m apart; now 1 coffee + 1 fountain, 19 m apart on opposite sides, count held at 14 so the litter floor still passes. Scaled 0.58/0.55 on the group: 0.190 m and 0.156 m across, about a sixth of a 1 m paving joint. CAVEAT for the user: reads plainly at conversational distance, a pale speck at 7 m — true-scale behaviour, not a defect, but a size decision if they want it read from across the street |
| LANDED | B | explain the shadow geometry on the forecourt | notes/B-forecourt-patches.md, written to hand to the user. NOT shadows and NOT a wet/night registration split — all 26 civic ground meshes are graded:true, none diverged. They are the library's landing (3.6x4.1 m) and flight (3.2x4.1 m) plus copings, posts and planters, ALL map:none, seven flat tones 0.075-0.405; each is a box with a materials array, which is why one object shows several quads with hard edges. Scope: 123 ground top-faces world-wide are untextured flat colour, ~454 m2; civic has ZERO textured ground materials. plazaTex() exported for a one-line fix in ct/civic.ts, which is not mine |
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
| LANDED | H | tyres clip into the bed cavity | fa26fa7f6 on mainline. Measured first: bed wall x 0.74-0.90, rear tyre 0.70-0.94 topping at 0.68 against a floor at 0.50, so it passed through the wall, 4 cm into the cavity and 18 cm above the floor. Now a box — inner wall floor-to-0.72 just inboard of the tyre, lid over it, and the lid's top face carries the FLOOR's ribbed material so the floor steps up over each well. Van checked: closed body, no visible load space, nothing needed. Floor darkening untouched |
| OPEN | H | block protruding from wheels on all vehicles | CAUSE FOUND, fix is a DECISION not work. It is my own fender flare, added in 7f0909aa4 for "the wheels need to not clip through". Proven by removal, not argued: orbited at standing height, measured that no mesh on any kind dips below the tyre's contact line or passes the flare's outer face, then took the flare out and the block vanished — shots/orb-250.png vs shots/orbNF-250.png. A panel proud of the body is what stops the tyre being outermost AND what reads as a block at 3/4. Three ways out in BLOCKED-H item 1: keep it, revert it (one line), or alpha-cut the flank so the wheel sits inboard and is still seen. Fourth pass on these wheels — desk asked me to bring it back rather than iterate |
| OPEN | desk | PVBLIC vs PUBLIC on the library | user's call, awaiting answer |
| OPEN | AUDIT | verify the ledger | |
| OPEN | C | big sign should be simpler | |
| OPEN | C | the garlands are disconnected | |
| OPEN | D | the atm is still not right | |
| OPEN | E | make the library interior larger and more ambitious. more halls and st | |
| OPEN | F | make sure the people in the buildings are in the right orientation. (b | MEASURED by H, whose atlas it is — all ten keepers, decoded from EACH ROOM'S OWN customer spot (just inside its street door), because sector is relative to the viewer and "facing away" only means anything from where a customer can stand. Scale is 0 = looking at you, 4 = dead away. **bodega 4** — the only one actually facing away. **library 2** — profile, attending to something else. casino/hotel/thrift 1 — three-quarter, fine. **burger 0, church 0, diner 0, pawn 0, tax 0** — facing the customer. So THE BURGER KEEPER NAMED IN THE REPORT IS ALREADY CORRECT: he stands at the back wall z -3.7 facing the door at z +3.7 and the seats between. Fixing him would break him. The keeper matching the user's description is the bodega's, which authors facing -PI/2. The sprites themselves are sound — every keeper's sector changes with the bearing (s0/s2/s4/s6 around a circle), so this is authored facing, not the atlas. Decode table in notes/H-atlas-facing.md |
| OPEN | E | what is the shadow geometry here? did you end up answering what that w | |
| OPEN | F | why are these decorations simply floating in the air in the diner? / t | |
| OPEN | E | park bench looks bad and clips the drinking fountain | |
| OPEN | E | park bench looks awful and clips into fountain, also no shrubs like i  | |
| OPEN | G | make the library interior larger and more ambitious / why is church lo | |
| OPEN | E | look at the park field what is this? / shelter is ugly and the seating | |
| OPEN | F | bodega interior is very cramped and also doesnt match the exterior. so | |
| OPEN | G | hotel exterior looks nice / interior doesnt match the exterior however | |
