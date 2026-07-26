## Open — 2026-07-25, routed to D (this session)

- **ATM too high, and it does nothing** (`shots/user-atm.png`) — *"the screen is
  at roughly chest-to-eye height; a real ATM screen is 1.30-1.40 m with the
  keypad lower, because it must work for someone in a wheelchair and for someone
  tall without stooping … 'doesn't work' is a request for an interaction … What
  is not an answer is a machine that looks usable and ignores you."*
  → **D. DONE.** Screen centre was 2.25 m above the pavement against a 1.74 m
  eye height; now 1.35 m with the keypad at 1.00 m, so you look slightly down at
  it. Registered its own `[E]` with `ctx.spot()`: *"FIRST FEDERAL — check
  balance"*, then the balance from `purse.cash`, which is the same object the
  wallet reads.

- **ATM attempt three — INLAID and SLANTED, and lower** (`shots/user-atm3.png`)
  — *"you have swung from far too much to too little while STILL not doing the
  two things asked for twice: INLAID and SLANTED … cut a RECESS into the bank
  wall, about 0.15 m deep, a little larger than the machine … the machine face
  inside that recess is RAKED, not vertical."*
  → **D. DONE, and this time measured rather than intended.** The reason two
  attempts missed the same two words was not a number: I had composed the rake
  as mesh `rotation.y` then `rotation.z`, which is Euler-order dependent, and it
  never produced the tilt I thought it did. Baked into the geometry in a known
  order instead, then measured — **screen 8.1° up, keypad 33.7° up** (closest to
  horizontal), apron −45° as the underside, all square to the wall. Recess 0.15 m
  with the opening larger than the machine on all four sides, and three reveal
  tones — lit head, dark jambs, sill between — because one flat grey was what let
  the last one read as laid on. Lowered: screen 1.37, keypad 1.10, bottom 0.90
  above the pavement. Only the four details asked for. `shots/D-atm3-standing.png`.

- **The ATM overshot — subtract, and rake it** (`shots/user-atm2.png`) — *"it
  reads as a display case or a vending machine, not as an ATM in a wall. THE
  SIZE IS THE MAIN FAULT … Yours is maybe three times that … THEN THE IDEA THEY
  ACTUALLY WANT: 'something slanted inlaid'."*
  → **D. DONE, attempt three.** Cut from 1.10 x 2.10 m to **0.68 x 1.05** — 2.3 m²
  down to 0.7 m². Bronze cabinet gone, thin reveal only; FIRST FEDERAL shrunk to
  a strip above the screen; recess shallower at **9 cm**. And RAKED: three
  panels whose normals point out and up, screen at 9° off the wall and the
  keypad shelf at 24°, so you read one and type on the other looking down.
  `shots/D-atm2-oblique.png`.

- **Cat, fourth position note — put it DIRECTLY AHEAD** (`shots/user-catplace.png`)
  — *"centred in that view, out in the open alley floor a few metres in front of
  the camera … reproduce that exact viewpoint … move the cat until it sits in
  the CENTRE of the frame at a few metres, then screenshot from that same spot
  and check."*
  → **D. DONE, and by that method.** Five iterations, screenshots driving each.
  Now at **2.35 m in, dead centre of the alley opening** from the pavement.
  Two things only the pictures could show: centred at 3.6 m it silhouetted
  against a milk crate sitting on the sight line and read as clutter, so it came
  forward until it reads first. 1.13 m clear of the grate, crates 2.2 m at its
  back, and the alley has no 2 m lane. `shots/D-cat-frommouth.png`.

- **The ATM must be INLAID, not painted** — *"Right now the ATM is PAINTED INTO
  bankBand's texture — a flat rectangle on the facade plane — which is why it
  reads flat and why 'too high' and 'doesn't work' both landed on it … Build it
  as a niche: cut the recess back from the facade plane by 12-18cm with a
  visible reveal on all four sides."*
  → **D. DONE, one object, one commit.** Real geometry: 12 parts, face set back
  **150 mm** behind the facade plane, reveal on all four sides, bronze surround
  at the cut. The recess needed a real hole — the shell's +x face is one opaque
  quad, so anything behind it is occluded — so `bankBand` now `clearRect`s the
  opening and the band material carries `alphaTest`. The 1997 vocabulary as
  listed: hood over the screen, green CRT behind its own bezel, 3×4 rubber
  keypad with function keys down both screen edges, card slot with a lit arrow,
  cash slot with shutter, separate receipt and deposit slots, FIRST FEDERAL
  plate, and CIRRUS/PLUS/STAR/HONOR decals. Wear at the touch points: middle
  keypad column worn pale, scratched screen surround, a half-peeled sticker.
  Screen at **1.35 m above the pavement** — and the pavement is KERB_H, which
  the painted one measured from the band base 14 cm lower. `[E]` still answers
  with the real purse. `shots/D-atm-oblique.png`, `D-atm-standing.png`.

- **Diagonal streaks on the alley floor** (`shots/user-alleylines.png`) — *"long
  thin dark diagonal streaks running across the paving, on top of the soft dark
  ovals. They read as smears or as a rendering artefact, not as anything … a
  stain in an alley should follow where water runs or where something was
  dragged, not cut diagonally across the whole floor."*
  → **D. DONE, and they were mine — added one commit earlier.** Not a per-metre
  painting regression and not B's: I painted 16 strokes converging on the drain
  to say "water runs here". Sixteen strokes radiating from a point is a
  STARBURST, and from standing height a starburst on the floor is diagonals
  across the whole alley. It drew the flow rather than the mark the flow leaves.
  Replaced with a soft radial wash — a gully leaves DAMP, which darkens toward
  the drain and has no edges to mistake for lines. The soft ovals are untouched.

- **Move the cat further right** (`shots/user-alleylines.png`) — *"it is out of
  the corner now, which is better, but the user wants it further right, toward
  the crate and grate side. That also puts it where you see it on the way in
  rather than tucked beside the dumpster."*
  → **D. DONE.** Third move. z −39.8 → −41.2, out in the open between the crates
  and the grate. "Right" derived rather than guessed: the alley mouth is the
  plane x = −7, so you walk in along −x and right is −z — which runs from the
  dumpster past the crates to the grate, matching the second half of the
  request. Shot in `shots/D-alley-walkin.png`.

- **The alley cat is in the corner** (`shots/user-alleygrate.png`) — *"pressed
  into the angle where the two walls meet - the one place in the alley a cat
  would not sit: nothing to watch, no line of retreat, and barely visible from
  the alley mouth."*
  → **D. DONE.** Was a mechanical row at the rear wall on the south flank; now
  beside the dumpster on its open side with a clear run to the mouth.

- **The alley grate is four dark lines** (`shots/user-alleygrate.png`) — *"no
  frame, no depth, no thickness … should be recognisably from the same world …
  If the casting is B's asset, ask me and B exports it rather than you drawing a
  second one - a second grate design is exactly how this project ended up with
  two of everything."*
  → **D. DONE, and by the route asked for.** The casting was B's and was a local
  rather than an export, so I asked and did not start. **B exported
  `floorDrain()`** — the kerb inlet's vocabulary with the throat dropped,
  because a yard gully takes water from every side. One grate design in two
  correct variants; I drew nothing. 12 solids, 7 bars, **11 mm rebate** so it
  reads as a hole rather than stripes, frame 24 mm proud, set at the bottom of
  the dish. The paving now falls 6 cm over 2.6 m into it and **the player falls
  with it** — the floor you walk is the floor you see, checked by standing on
  the mesh's own vertices. Staining converges on it. See
  `notes/D-alley-grate.md`, `shots/D-drain-standing.png`.

# CROSSTOWN '97 — feature requests

Running log of every request from playtests. Claude works from this list
constantly: new requests land in **Inbox**, move to **In progress** while
being built, and to **Done** (dated) once verified in a screenshot and
published to the playable artifact.

## Inbox
- **`scripts/slow-pinned.sh` cannot start its own server, so the whole slow tier is unrunnable** → **H**
  Filed by C; the script is H's (its header says the `--slow` tier is). It builds
  and serves the pinned tree fine, then dies with *"the server never reported a
  port"* while Vite has plainly printed one. Line 119 matches
  `s#.*Local:.*http://[^:]+:([0-9]+)/.*#\1#p`, but **Vite 8 colourises the port
  number**, so the raw line is `localhost:` `ESC[1m` `24684` `ESC[22m` `/` and the
  digits are not adjacent to the slash. It would have worked until Vite started
  bolding the number. Strip ANSI before matching, or loosen the pattern. This
  matters more than a broken script usually would: `slow-pinned.sh` is the
  designated way to check anything against the BUILT BUNDLE rather than dev, and
  `notes/BLOCKED-C.md` §0 records a whole week of dev-only claims that did not
  describe what ships. Right now nobody can run that tier at all.
- **`props.ts` `isSelfLit` holds ~40 printed sheets and one citizen at full daylight after dark, and classifies inconsistently** → **B**
  Filed by C with measurements; `props.ts` is B's. Two faces of one detector.
  **(a) Printed signage.** 39 sheets in the lot are held bright and are not
  declared lights — hot fraction **8.6% – 97%** against an 8% threshold.
  `shots/lotpass/10-night-aisle.png` is the lot at 23:00 with three signboards
  and the price cards glowing over a black yard. Darkening below the line is
  what fixed the bunting (13.3%, one point over) and it does **not** generalise:
  at 62–97% the sheet IS its artwork, and the 85.3% one is the pole sign the
  user has just had enlarged and re-contrasted *for legibility*.
  **(b) It disagrees with itself on identical objects.** The lot salesman is
  stamped `selfLit=true` at **13.2%** hot and dims **0.0%** noon→23:00. Six
  street pedestrians, same `citizenSprite`, same atlas generator, one of them
  **23%** hot, are stamped `selfLit=false` and dim **95.5%**. A hotter sheet is
  being called "not a light" while a cooler one is called a light, so the
  threshold is not what is deciding it.
  **The ask:** an opt-out `isSelfLit` honours — a userData flag meaning
  "printed, not lit, grade me". ~40 materials in `ct/lot.ts` would take it the
  round it lands, and `scripts/mods-dim.mjs` is written and waiting to guard it.
- **"sleep in your room" needs a way to advance the clock; nothing in the tree can** → **DESK**
  Filed by C. `grep -rn advanceTime src/proto/` returns nothing. The user asked
  to be able to sleep in 301; the room, the bed and the door are all built and
  the only missing piece is `ctx.advanceTime(minutes)` wired in `crosstown.ts`
  to `totalMin += minutes`. Both files are DESK-owned, which is why this has sat
  rather than moved. Two decisions come with it and are yours: whether a fade is
  worth doing, and until-morning versus a fixed span.
- **`scripts/reach.mjs` reports the whole world unreachable, at exit 0** → **AUDIT**
  Filed by C, who caused it and cannot fix it — `reach.mjs` is the auditor's
  script (created in `338e8a4aa`) and OWNERSHIP forbids editing another agent's.
  It seeds its flood fill at `window.__ct.pos()` (line 30) and its grid is the
  street world only, `X0 = -46 … X1 = 62`. The player now spawns in room 301 at
  **x 198.6**, outside that grid, so the seed cell falls off the array and it
  reports **"1 of 63072 cells reachable"** with every probe "not reachable" —
  **and exits 0**, so it never goes red. It just quietly tells anyone who runs it
  that the world is unwalkable. One line: seed from a street point rather than
  from the player, and exit 3 if the seed is outside the grid or blocked, so it
  cannot silently measure nothing again (GOTCHAS 32/34).
- **"confirm the remaining LANDED rows"** → **AUDIT**
- **"the library stair needs buildRoom to accept a floor function"** → **F**
- **"the brick area outside my room is too deep in. and i dont want there to be another window in the area. i do like the pipe though. i just want the length of that area to be less. the opposite wall should be closer to the window"** → **C**
  → **C. ALREADY LANDED** in *"Light well: shallower, plain far wall, pipe
  untouched"*, which answers all three clauses. Depth
  **2.4 → 1.2 m**, so the opposite wall is half as far and reads as a gap and
  then brick rather than a shaft. The window on the far wall is gone and it is
  plain brick. The pipe is untouched — its position is expressed against the far
  wall rather than as a literal coordinate, so it stayed in its corner as that
  wall came in. Judged from standing at the window
  (`shots/walkup/w3-standing.png`) and from the glass (`w2-at-glass.png`).
- **"put this librarian behind the desk"** → **G**
- **"for the bench i have no way to sit at the bench from the street cause the e option doesnt come up"** → **B**
- **"side benches have backs which are backwards?"** → **E**
- **"tons of people always get stuck at this cross walk. the walk logic should allow people to walk around things"** → **H**
- **"maybe the aces sign belongs on the other end of the casino building?"** → **G**
- **"these signs block each other can you fix"** → **G**
- **"align these crates so they fit better against this wall"** → **D**
- **"the bus bench cannot be sat on from the street — no [E] prompt appears"** →
  **B**. Seat exists via ctx.seat(); check in order: (1) which SIDE the sit spot
  is on — the bench faces the road so the approach is from the pavement behind
  it and from both ends; (2) trigger RADIUS vs normal walking distance; (3) a
  COLLIDER eating it (GOTCHAS 8 — happened to the bodega crate and the diner
  blanket wall). ctx.seat() is F's if the fault is in the helper.
  → **C. NOT REPRODUCIBLE — checked, it works.** Diagnosed rather than left for B
  to chase, since this is the same class as the lot chairs I had just debugged.
  Both spots are live, radius 1.4, at (6.15, −35.45) and (6.15, −34.55). The
  prompt *"[E] sit at the stop"* appears standing on either offer point, 1 m
  away, and while walking north up the pavement into it; E seats you and E again
  stands you up. Whatever it was, it is fixed. **Worth knowing how this fools
  you:** my own first pass on the lot chairs "found" two dead seats because it
  measured where the walk ENDED rather than whether the offer was ever in range —
  I had walked straight past the trigger into a wall. A second run reported three
  dead seats because pressing E left the player SEATED for the next test. Both
  were my harness, not the world.
- **"the church interior is reversed i think. the entrance/exit is at the alter?"** → **G**
- **"i asked for more expansive interiors for casino and for hotel. so far they look the same size. no additional depth"** → **G**
- **"bodega sign is tilted up which makes no sense should be tilted a bit down no? i actually think the orientation is the issue here. like it needs to be rotated 180 degrees"** → **D**
- **"gazebo shelter is fucked / bin is in the sign? overall fix the park"** → **E**
- **"needs grass variation and more random placing. some clustering potentially. this looks so unnatural"** → **E**
- **"the doors are misaligned. i think the worker doesnt realize they need to confirm the logic independently per side of the car"** → **H**
- **"textures on vehicles need a deep review and fix"** → **H**
- **"cat is dead center in alley i need it right to the right of that news paper on the ground"** → **D**
- **"a little too many grasses in the streets. like way too many. should be more rare"** → **B**
- **"gap in the door sucks. also i dont like that it says stand back when you wanna close the door. it should always be able to open/close"** → **C**
  → **C. BOTH FIXED.** (1) The leaf was 0.91 m in a 0.95 m clear opening with
  its pivot 0.02 inside the jamb, so there was a 2 cm see-through strip at the
  hinge AND another at the strike — a leaf narrower than its opening cannot be
  shut, only nearly shut. It closes onto the WALL FACE rather than into the
  reveal, which is what lets it be WIDER than the hole: 0.99 m with the pivot
  0.02 past the jamb gives 0.02 of overlap at each side and no line of sight.
  Checked from both sides and at 23:00 — `shots/walkup/g-room.png`,
  `g-hall.png`, `gn-room.png`. **And then a third strip, at the HEAD:** the
  report named a vertical gap so I fixed the two vertical ones and stopped. The
  leaf topped out at 7.475 against a doorway head at 7.50, leaving 0.025 m of
  lit hall straight over the door — invisible at eye height, obvious the moment
  you look up. Found by measuring the shut leaf's world extent against the
  opening's rather than trusting the head-on shots I already had. All four
  edges now: jambs +0.020 each, head +0.050, with the 0.030 undercut at the
  floor kept. (2) The 'stand back' refusal is gone; the label
  is now only ever *open the door* / *close the door*. What made the refusal
  unnecessary is F's `unstick()` (fp.ts:191), which already sums escape vectors
  from everything the rig is inside and eases it out — so the shut leaf just
  publishes its collider like anything else and the closing door pushes you
  clear. Measured: shutting it while standing squarely in the swing moves you
  **0.20 m** and leaves you outside every collider. One rule, not two; the
  swept-volume test `doorClear` was deleted with the refusal it served.
- **"there should be a bit of a gap out of the window and then just a brick wall. almost like a little room outside the window that is just brick"** → **C**
  → **C. BUILT, then refined.** The well is real geometry — 1.9 m across and
  **1.2 m deep** of sooted brick, with both side returns, a floor three storeys
  down in the dark, a drainpipe down the corner and a fire escape landing.
  Refined on the user's follow-up: depth halved from 2.4 so it reads as a gap
  and then brick rather than a long shaft, and the dark window on the far wall
  removed — it was the desk's suggestion rather than the user's, and the far
  wall wants to be plain. The drainpipe is untouched, as asked.
- **"just do what i want for this bespoke minor window ask"** → **C**
  → **C.** Same ask as the row below; resolved there.
- **"would like a view out of my window but the view it just a small gap and then brick wall lol"** → **C**
  (desk's relay: *"a painted city backdrop beyond the gap — rooftops, water
  towers, fire escapes, a slice of sky, lit windows at night ... nobody is ever
  going to stand in that light well and check. Make it read well from standing
  at the window and from the bed, and stop there."* This supersedes an earlier,
  over-engineered brief about moving the window to the street facade and
  matching a bay on the elevation, which the desk withdrew.)
  (second correction, which reverses the first: *"DISCARD the painted city
  backdrop entirely — no rooftops, no water towers, no sky. THE USER WANTS THE
  BRICK ... build that as a real little space ... it should feel like a room
  you cannot get into."*)
  → **C. FIXED, and the brick is now real.** The window opening is untouched;
  what changed is that the view stopped being a painting and became geometry
  you look through. A 1.9 m x 2.4 m brick shaft with the far wall, both side
  returns, and a floor three storeys down in the dark. **Width was the whole
  problem** — the first build was 3.24 m across, which exactly fills the cone
  you can see through a 1.3 m opening from across the room, so the returns fell
  outside the view and it read as a flat brick sheet again: the same fault as
  the painting, rebuilt in geometry. Narrow is what puts both side walls in
  frame converging away from you, which is the cue for depth. Sooted brick at
  about a third of the room's brightness, a dead window opposite that never
  opens, a drainpipe down the corner, a fire escape landing a storey below.
  Judged from standing at the glass and from the bed.
- **"this guy is floating"** / **"your car lot salesman's feet end above the asphalt with a visible gap ... DIAGNOSE WHOSE IT IS ... if STREET pedestrians float too, then it is the sprite anchor itself"** → **C to diagnose, H to fix**
  → **C. DIAGNOSED, NOT MINE.** It is the atlas, and it is world-wide. Every
  citizen — the salesman and all six street pedestrians — is placed on the
  ground to **0.000 m**, so no call site is passing a wrong y. Every citizen
  also floats **0.108–0.129 m**, because the atlas frame has **4 empty pixel
  rows below the feet** out of 64 and `citizenSprite` translates the origin to
  the frame's bottom edge rather than to the feet. The spread is only each
  figure's height scale. Numbers and method in `notes/C-salesman-float.md`.
- **"verify the eight LANDED rows"** → **AUDIT**
- **"casino interior is nice but i want more. bigger and more expansive / the interior door doesnt match the exterior doorway"** → **G**
- **"the interior door doesnt match the exterior doorway"** → **F**
- **"hotel exterior looks nice / interior doesnt match the exterior however / casino text is a bit too blurry"** → **G**
- **"bodega interior is very cramped and also doesnt match the exterior. so if the door for the bodega is on a cut corner (literally) then the interior should match"** → **F**
- **"look at the park field what is this? / shelter is ugly and the seating is off center, quality is bad for the park overall"** → **E**
- **"make the library interior larger and more ambitious / why is church locked"** → **G**
- **"park bench looks awful and clips into fountain, also no shrubs like i asked earlier and the grass ask seems also to have been ignored"** → **E**
- **"why are these decorations simply floating in the air in the diner? / thrift store should be larger, its a bit too crowded"** → **F**
- **"what is the shadow geometry here? did you end up answering what that was?"** → **E**
- **"make sure the people in the buildings are in the right orientation. (burger barn guy is facing away from you always)"** → **F**
- **"make the library interior larger and more ambitious. more halls and stair ways"** → **E**
- **"the atm is still not right"** → **D**
- **"verify the ledger"** → **AUDIT**
- **"the lot's pole sign ... is carrying FOUR messages stacked ... SIMPLIFY TO ONE MESSAGE. A pole sign is read from far away and at speed; it gets the NAME and nothing else, or the name plus one short line at most. CROSSTOWN AUTO, big, legible, and stop. Drop the phone number entirely — it is already on the fence banner ... Drop USED CARS or fold it into the name as a small strapline. The arrow can stay if it points at the entrance; if it points nowhere, drop that too. Fewer, bigger, legible. And check it reads from the far side of the street"** → **C**
  (supersedes the earlier "panel is tiny against an enormous pole / faces read as skewed" row — same fix, simpler and bigger)
  → **C. FIXED.** Phone number dropped entirely (it is on the fence banner,
  where you can read it). USED CARS folded into a bottom-band strapline. The
  cabinet went LANDSCAPE, which is what buys the size: 'CROSSTOWN' is 53 glyph
  units wide against 5 tall, so the portrait panel was setting the type size.
  CROSSTOWN 0.31 → 0.51 m, AUTO 0.31 → 1.19 m, and the 0.92 m of unreadable
  digits gone. Contrast fixed too — it was cream on red inside a red panel.
  Read from the far kerb at 13.7 m and obliquely at 24.2 m
  (`shots/polesign/`). The arrow stays because it does point at the entrance —
  after fixing the REAR face, which shared the front's texture and so pointed
  at the back fence.
- **"the bunting/garlands in the lot are disconnected ... the pennant runs end in mid-air rather than meeting the posts they should be tied to, and the runs do not join each other. (1) EVERY RUN MUST TERMINATE ON SOMETHING ... (2) THE RUNS SHOULD CHAIN: real lot bunting is one continuous string zigzagging from post to post around the perimeter ... build it as a chain of points and draw the runs between consecutive pairs. Also let it SAG properly between supports, deeper on the longer spans, and make the sag consistent with the span length rather than a fixed droop."** → **C**
  → **C. FIXED.** The topology was already a chain — four poles, consecutive
  swags sharing an endpoint. The fault was that the string is not where the
  arithmetic put it: the pennant texture draws its line along one EDGE of the
  sheet and the code put the sheet's CENTRE on the catenary, so the string
  rendered 0.31 m above every point it passed through, including both ends.
  One offset, not four loose runs. Rebuilt as explicit tie points with the
  cloth hanging BELOW the chord; all four post tops now have a string endpoint
  on them to **0.000 m**, against 0.31 m before. Ties: both fence corners, both
  gate posts (so the 9.28 m mouth is one span and nothing stands in the drive)
  and the pole sign's mast. Sag is 8.5% of span, capped — the gate crossing is
  now the deepest thing there and the 1.24 m stub no longer droops like a
  hammock.
- **"what is this diner sign? it's not legible and its strange? doesnt make any sense not sure what you were trying to go for here. pls fix"** → **A**
  → **A. FIXED.** It said EAT stacked down the plate and could not be read.
  Checked GOTCHAS 10 first — a DoubleSide plane rendering mirrored from behind,
  which shipped on the casino and hotel blades — and it is **not** that: this
  blade is a `BoxGeometry`, which gives every face its own correctly-oriented
  UVs. Ruled out by walking past and reading it from both directions.

  It was arithmetic. The plate is `masonry(0.95, 1.55)` at 16 px/m = **15 × 25
  texels**; the border takes two rows top and bottom, leaving ~19 for three
  letters at an 8 px font whose centres land 5 px apart. Every letter overlapped
  its neighbours by about three pixels, and shrinking to fit leaves three pixels
  of ink per glyph. **Three stacked letters do not fit on that plate at any
  size**, so it is a **coffee cup** now — a symbol reads where letters cannot,
  and the fascia beside it already says DINER.

  Two further silhouette fixes once it was a cup: one texel of plate between the
  handle and the body (they had merged into a blob), and a saucer sized off the
  body rather than the plate (at 12 texels it was wider than the 11-texel border
  bars and read as a third stripe).

  **And a defect the user had not reported, in the same sign:** it never went
  dark. I had only judged it at 13:00. `props.ts` decides what carries its own
  light by looking at the sheet — bright *and* chromatic — and my enamel cream
  cleared that test by two points, so the plate was graded a light source and
  stayed the brightest thing on a night street. Night luminance 152 → 55.
- **"whats going on with the shadow geometry here? i need an explanation for these shadow geometries"** → **B**
- **"atm needs a bit more detail like a tiny bit more also needs to be a bit lower to the ground and i want the atm to be inlaid and slanted in"** → **D**
- **"especially more of this kind of thing in the park"** → **E**
- **"big fan of these grass textures put em in more places and especially more of this kind of thing in the park"** → **C**
  → **C. SHIPPED AS AN EXPORT, so B and E get the same weed rather than drawing
  a second one.** `ct/weeds.ts`: `weedTuft({ x, z, y?, scale?, tone?, seed? })`
  returns the group without adding it. Two crossed quads (a single plane
  vanishes edge-on), `alphaTest` never `transparent` (which would land it on
  dimWorld's skip list), one cached texture and material per tone. The lot's
  own placement went 24 → 44 tufts. The park and the street are E's and B's to
  place. `tone: 'dry'` exists for pale paving and grass, where the default
  palette is green-on-green and vanishes — it has never been looked at in
  place, so shoot it against your own ground first.
- **"the paths and the graphics in the park need a big deep review"** → **AUDIT**
- **"the park is a bit better but i think needs some shrubs on the edges. also the paths and the graphics in the park need a big deep review"** → **E**
- **"what is this block that sticks out from the wheels of all vehicles. please fix"** → **H**
- **"cup trash a bit too common and cups are too big"** → **B**
- **"the inner clipping of the tires in the pickup was never fixed"** → **H**
- **"put the cat like directly in front of where im looking in this screenshot as opposed to the inner corner"** → **D**
- **"two cups in one small frame, one under the bench and one in the gutter, and
  both are nearly as long as a paving slab is wide"** → **B**. Two fixes: (1) cut
  cup FREQUENCY hard so the two cups are the rarest of the five approved types,
  and never two of a type within sight of each other; (2) SCALE them down to a
  real 15-20 cm drink cup, judged against the paving joints, then check they
  still read at standing height. The oversizing was the desk's earlier
  instruction for legibility and has overshot.
- **"cat needs to be more to the right side of the alley"** → **D**
- **"it was better before this is too much and ugly i was thinking something slanted inlaid"** → **D**
- **"i want the atm to be inlaid into the building and more detailed"** → **D**
- **"i like the thought, to make a drive entrance. however it looks graphically bugged"** → **B**
- **"tree in the dirt looks janky, i think we need to make the dirt patch a lil bigger on the curb side"** → **B**
- **"this looks bad with the lines on the ground, also move the cat to the right"** → **D**
- **"also make me spawn in my room"** → **C**
  → **C. FIXED — you now wake up in 301.** The coordinate had been exported and
  asserted for several rounds; what was missing was the one line in
  `crosstown.ts` that uses it, which is a DESK file I had been told not to
  touch and which the user overrode explicitly. The floor has to be seeded
  first: `aptGround` picks the storey nearest the last height and refuses to
  step up more than 0.6 m, so from a lastGy of 0 the first query three storeys
  up resolves to the lobby — right x/z, wrong floor. Walked, not
  screenshotted: WASD in all four directions holds at floor 3, and bed → door →
  hall → switchback → lobby steps 5.40, 4.05, 2.70, 1.35, 0.00.
- **"make sure none of the cars in the lot are clipping into each other"** → **C**
  → **C. FIXED.** Measured box against box at real dimensions with an OBB/SAT
  test (`scripts/lot-clearance.mjs`), not centre spacing — the fleet is MIXED,
  so a gap that clears two sedans overlaps a pickup. Rotation derived first,
  then measured. Now: 18 cars, **closest pair 0.422 m**, **closest
  car-to-fixture 0.290 m** — no overlap anywhere, and inside the 30-60 cm
  honest gap asked for. The fence, office, pole sign and cones are checked as
  fixtures by the same test.
- **"park is nicer with tres but i was hoping to get some topographical changes. also a loop around the field in the middle would be good. also find some way to represent a grass field"** → **E**
- **"inside of the thrift store leaves a lot to be desired as well"** → **F**
- **"tax person looks like they are backwards"** → **G**
- **"facade of the thrift store building is lazy and chopped off at points"** → **A**
- **"cat is too much in the corner and the grate in the center is such a lazy design. make it match some of our other grate designs"** → **D**
- **"the chairs are backwards"** → **C**
  → **C. FIXED.** Both chairs face OUT at the stock, and they are no longer a
  matched pair: **0.50 rad apart with one pushed back 0.31 m**. Asserted by
  lot-layout. Both are registered with `ctx.seat()` and verified end to end —
  offer, sit, stand up.
- **"atm too high and doesnt work"** → **D**
- **"cars facing wrong way on left side of car lot"** → **C**
  → **C. FIXED AT THE SOURCE.** Each car's heading is derived from which side of
  the aisle its bay is on, `mirrorYaw(θ) = π − θ`, because a far row is a MIRROR
  of the near row and not a copy — adding 180° to one row as a constant is
  exactly what would break again next time. lot-layout: **18 of 18 nose-out**.
- **"wheel arches"** → **AUDIT**
- **"make sure all requests have been accomplished to the quality i would expect"** → **AUDIT**
- **"make the exteriors match the interiors"** → **F**
- **"make sure all requests have been accomplished to the quality i would expect"** → **AUDIT**
- **"i cant sit at the benches at the library"** → **F**
- **"make sure all requests have been accomplished to the quality i would expect"** → **AUDIT**
- **"the people inside these places are always flat"** → **H**
- **"same with the casino tbh. iterior should match the exterior in vibe. also the text needs to not be backwards"** → **G**
- **"i need the internals of the orpheus to match the exterior. the exterior is so fun and glammy the inside should match"** → **G**
- **"also the bodega entrence is not where the facade door is. do not change the facade i love it just make the entrence where i press e actually aligned / bodega is also a bit small and sad"** → **F**
- **"lets have the agents if they ever work on a citizen to be able to see the style necessary se some examples at the very least of the kinds of citizens we have"** → **H**
- **"church i still cant walk into i cant walk up the stairs or go in, same as library"** → **F**
- **"maybe the shittiest park ive ever seen please come at this with some more life and energy jesus"** → **E**
- **"pawn shop interior is janky and odd. i immediately hit a counter. its like im behind the counter i dont get it"** → **G**
- **"make the exteriors match the interiors"** → **A**
- **"instead of doing what i asked which is change the exterior to match the interior you changed the interior to match the exterior. thats annoying"** → **F**
- **"i like the feel and the vibe, i dont like the execution why is there just signs floating? also why can i not walk in. i would like lines of cars on the right and left as i enter with the actual office in the back of the lot"** → **C**
  → **C. FIXED.** The chain-link exists and the banners hang on it rather than in
  mid-air. lotwalk: the frontage stops you everywhere except the gate (opening
  z −0.7…6.3, 8 of 27 samples). lot-frontage: nothing encroaches the 2 m walk.
  lot-layout: rows flanking the aisle at centre z 2.60, office across the back.
- **"this looks bad because th efront of the bank doesnt match the side fix this"** → **D**
- **"so it should not be cutting off the actual ad for tonys pizza also theres some strange graphical bug on the legs you see its like the same plane as the wood"** → **B**
- **"i want to be able to close this door and also what is this poster on the wall?"** → **C**
  → **C. FIXED.** 301's door is an `[E]` open/close with the leaf swinging and
  the collider following it; door301 holds **all seven behaviours** — opens,
  shuts, blocks the doorway while shut, and refuses to shut on you. The poster
  was redrawn as one readable thing rather than an unidentifiable field of
  colour.
- **"i cant sit at the benches at the library"** → **E**
- **"make the exteriors match the interiors"** → **F**
- **"make the exteriors match the interiors"** → **A**
- **"the entrence to the tax service is not aligned with the door of the facade"** → **F**
- **"the glas here needs to be cropped to fit within the arch. like the windows above the doors i mean / the name is obscured"** → **E**
- **"I WANT TO BE ABLE TO WALK UP THOSE STAIRS"** → **F**
- **"make this look nicer, i dont think we need the bottom wood part. also the tonys pizza part i think needsa to have a bezel"** → **B**
- **"these people are stuck"** → **H**
- **"i like the triangles but it also just looks low effort do a high effort sleazy used car lot. make it make sense like how does one even enter, drive a car off the lot. do some research into what old sleazy used car lots looked like"** → **C**
  → **C. FIXED.** There is a kerb cut with the walk ramping over it and a gate on
  the cut; lot-kerb-seam confirms the cut lies **entirely inside the gate**, so
  a car can leave across all of it. Plus the period vocabulary: banners
  zip-tied to the chain-link, the pole sign, windshield price cards, tyre
  stacks, bunting and weeds in the cracks.
- **"also i think these are puddles and they look awful honestly / trash cannot be clipping through stuff like this"** → **B**
- **"in general we should not encrouch the already cramped sidewalk"** → **AUDIT**
- **"park border with sidewalk looks fucked up, we gotta fix this. in general we should not encrouch the already cramped sidewalk"** → **E**
- **"this is a part of the bodega corner that needs to be fixed i flagged this to you a while ago but its still here"** → **A**
- **"hm i think the tonys pizza sign should go on the back of the bench also i think the bench back should lean back a lil"** → **B**
- **"what is this black stripe on the back of the pick up truck"** → **H**
- **"what up with this car and its wheels? THEY LOOK SO WEIRD"** → **H**
- **"deeper used car lot like make it square"** → **D**
- **"can you just amke the new module incorporation automatic?"** → **F**
- **"make written-but-never-wired impossible"** → **A**
- **"what happened to the used auto lot?"** → **F**
- **"maker gravity a tiny bit stronger"** → **F**
- **"whats up with this kids face? its multi color?"** → **H**
- **"right side of bank facade should match front, also all buildings need to be much deeper other wise it loks like a fake building"** → **D**
- **"theres still a diner entrance by the bank. i think we have to make sure all press e to enter options are aligned with the doors on the facades"** → **F**
- **"make street light a bit more broad in their emitted light (like a wider beam) and make the unilluminated stuff darker. it should feel scarier at night i want to be able to see stars sometimes"** → **B**
- **"this red guy glitches back and forth as he walks sometimes idk why"** → **H**
- **"i want the people inside the buildings to be as detailed and quake-view like as the pedestrians on the street / make the jump a tiny bit higher"** → **F**
- **"pickup looks great but the wheels need to not clip through, maybe we need to have some inlaid wheel things pickups have / on the car idk if the doors make sense"** → **H**
- **"park should be much deeper, like 4-5x deeper. and make it nice, a nice park with trees and a litle field maybe even a play area but not necessary maybe just a field with a walking route around the field?"** → **E**

### 2026-07-25 — lot priority order, items 1-4 (→ builder C, `ct/lot.ts`)

The user, giving priority order and noting the first two had been reported
**twice**:

> *"(1) CARS BACKWARDS ON THE LEFT ROW ... derive each car's heading from which
> side of the aisle it is on, because a far row is a MIRROR of the near row and
> not a copy. (2) CARS CLIPPING INTO EACH OTHER: measure box against box at
> real dimensions, not centre spacing — the fleet is MIXED. Do the rotation
> first, then measure. Target is no overlap with a small honest gap, 30-60cm.
> Also check the fence, office, pole sign, cones and board. (3) DROP THE 'TODAY
> ONLY' SANDWICH BOARD — the user does not like it. (4) THE POLE SIGN LOOKS OFF
> — the panel is tiny against an enormous pole and the two faces read as skewed
> rather than flat or back-to-back. Make it much bigger relative to the mast,
> and if it is double-sided use two single-sided planes back to back per
> GOTCHAS 10."*

**All four routed to C.** (1) and (2) were already built and verified — nose-out
derived per side, 21/21; clipping measured with an oriented-box test, 6 overlaps
to 0, closest 0.42 m — but had not reached the played world: **34 of my commits
were sitting unlanded because the merge train had not been run.** `land.sh
--dry` lists five builders and 116 commits waiting. That is why the same two
items were reported twice. (3) and (4) done fresh.


### 2026-07-25 — no car may clip another (→ builder C, `ct/lot.ts`)

> *"make sure none of the cars in the lot are clipping into each other. You are
> laying stock in rows either side of a drive aisle, and the lot is packed -
> that is exactly the condition where two bodies overlap. Check every pair: box
> against box, at their real dimensions, not their centre spacing. Report the
> minimum clearance you find. Two things that make this likelier than it looks:
> the fleet is MIXED - a pickup, sedans and a van are not the same length or
> width, so a spacing that works for two sedans will overlap a pickup and its
> neighbour; and you are about to rotate the left row 180 degrees for the
> facing fix, which changes which end of each car is where and can turn a
> clearance into an overlap. Do the rotation FIRST, then measure. Real lots
> park tight - 30 to 60 cm between cars is authentic and looks right - so the
> target is not generous spacing, it is NO OVERLAP with a small honest gap.
> Also check they do not clip the fence, the office, the pole sign, the cones
> or the sandwich board. Builder H owns the car models and knows their true
> extents; ask me if you need them rather than assuming from the mesh."*

**Routed to builder C.** Rotation landed first, then measured:
`scripts/lot-clearance.mjs`. Six overlaps found and fixed; closest pair now
0.42 m.

### 2026-07-25 — spawn in room 301, not on the street (→ builder C for the number, builder F to land it)

> *"The user wants to SPAWN IN THEIR ROOM rather than on the street. The spawn
> is crosstown.ts:460 - 'new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }' - which is
> the entry point and builder F's to edit, so DO NOT change it yourself. What I
> need from you is the number: the exact world position and yaw a player should
> start at inside 301, and the ground height, delivered the way builder D
> delivers roster spans. Pick it properly rather than the room's centre - waking
> up should have a viewpoint. Standing beside the bed facing into the room, or
> facing the window, so the first thing they see is the room and the street
> beyond it rather than a wall. Confirm it by warping there and looking. Two
> things to check while you are in there: the floor picker must resolve
> correctly at spawn (GOTCHAS 7 - the walk-up has stacked storeys with
> hysteresis, and starting on the wrong storey is worse than starting on the
> street), and the player must not spawn inside the bed, the dresser or the door
> leaf you just made closable. Give me the number and I will hand it to F."*

**Routed to builder C for the measurement**, F to make the edit. C does not
touch `crosstown.ts`.


### 2026-07-25 — the car lot faces the wrong way, twice (→ builder C, `ct/lot.ts`)

> *"shots/user-lotfacing.png - the LEFT row presents tailgates and rear lights
> to the drive aisle while the RIGHT row presents noses. A lot displays stock
> NOSE-OUT toward the aisle: that is how a customer reads the cars walking in,
> and how they drive out. Both rows present fronts. THE LIKELY CAUSE, and this
> project has now hit it three times in different clothes: a row on the far
> side of an aisle is not a COPY of the near row, it is a MIRROR, so its
> heading must rotate 180 degrees. If both rows come from one loop with a
> shared yaw and only the x offset flipped, the far row is backwards BY
> CONSTRUCTION. That is exactly the defect that made the interiors disagree
> with their facades - handedness is not preserved when you mirror a layout,
> and code that copies rather than reflects will always get the second one
> wrong. So fix it at the SOURCE: derive each car's heading from which side of
> the aisle it is on, not by adding 180 to one row as a constant, so a row
> added later cannot come out backwards. The rest of the lot reads well - WE
> FINANCE ANYONE, the CALL 555-0199 banner, the office, the TODAY ONLY board,
> the cone, the bunting and the salesman all land. This is one rotation."*

> *"Second item, and do it IN THE SAME COMMIT as the car-row rotation - it is
> the same fault twice in your file. shots/user-lotchairs.png: the blue and
> orange chairs outside the office are turned so a person sitting in them would
> face the BUILDING. Chairs outside an office face OUT - at the lot, at the
> cars, at the street. Nobody waiting to hear about their credit sits facing a
> wall a metre away. While you are there: they are dead straight and perfectly
> parallel, which reads as placed rather than used - two plastic chairs outside
> a portacabin sit at slightly different angles with one pushed back further.
> Vary them. And check both are registered with ctx.seat(): a chair that is
> visibly a chair and cannot be sat in is worse than no chair."*

Both **routed to builder C** — `ct/lot.ts` is C's. Landed together in one
commit, as asked.


- **"the trunk sits hard against the kerb-side edge of its pit, most of the dirt
  on the building side — it is not centred"** → **B**. Diagnosed: NOT a
  regression from the kerb-clearance fix. `7d32dae25` (that fix) used one
  constant for both — `tx = s * PIT_X`, concentric. `1a88b8c1b` later split them
  to widen a 0.90 m walking squeeze to 1.10 m, moving the TREE kerb-ward to
  `TRUNK_X = 5.46` and leaving the pit at `PIT_X = 5.56`. Dirt is 0.18 m
  kerb-side against 0.38 m building-side.
- **"the car lot apron is a large flat untextured grey plane"** → **B**. Three
  parts: texture it at the world's density with its own cross-travel scoring;
  make it RAMP from walk level to road level with flared wings; abut rather than
  overlap the sidewalk paving (GOTCHAS 6). Plus: check whether the fence base
  along its right edge is sitting at the old walk height instead of following
  the ramp down.
- **"the thrift interior is measurably the thinnest room in the world… rails of
  clothing packed so tight the garments compress, doubled up where there is no
  room; a wall of shoes; chipped crockery; a rail of coats too heavy for it,
  sagging; a bin of loose belts; a glass case at the till; handwritten card
  signs; a mannequin at a wrong angle; boxes not yet sorted; fluorescent tubes
  with one out. The floor should be hard to cross in a straight line."** →
  **builder F** ✅ density pass landed: 297 → 476 lines, the bodega used as the
  reference rather than the diner. Walks 27/27 with the spine to the till still
  open.
- **"the thrift EXTERIOR is lazy and chopped off"** → **builder A**. F has built
  the window display the glass looks into — a dressed form and the better stock
  on a plinth at the front wall, deliberately the one tidy corner in the room.
- **"i dont like how close the tree bases are to the edge here i think ideal would be with a bit of clearence on the curb side. also the puddle doesnt make sense here. the gutter should have the water in the gutter"** → **B**
  — **B: both halves landed and measured.** Clearance on the kerb side is
  0.218 m of walk between the kerb chamfer and the pit edge, the same at all
  seven pits. The water is 9 sheets, every one of them 0.22 m in from the kerb
  line and inside the 0.45 m gutter pan, none up on the pavement. Guarded by
  `scripts/footprint.mjs` with four mutations behind it (`footprint`,
  `footprint-pits`, `footprint-water`, `footprint-blind`). Left in the Inbox
  for the desk to move — flagging it here so it does not read as outstanding.
- **"car lot needs to be deeper. i like your initial aesathetic but i want it refined and a try hard version of it. get the typical car price signs yknow?"** → **C**
  → **C. FIXED.** 23.2 m of depth with the rows receding to the office across the
  back, so you see cars behind cars. The windshield price cards are in — the
  user has since confirmed the $695 card reads.
- **"im literally stuck here. i think we need some sort of stuck protection or something smarter around collision and blocking"** → **F** ✅ `fp.ts` depenetration: sums an escape from everything overlapping, eases out at bounded speed, falls back to last-good after 0.45 s. 177/177 traps escaped (`scripts/unstick-walk.mjs`).

## Done — 2026-07-25, builder A (the facades)

- **"facade of the thrift store building is lazy and chopped off at points"** ✅
  Both halves real, both in `ct/tex-world.ts`. CHOPPED: the window display was
  painted and the doorcase stamped over it, cutting the "50c" card in half —
  and `facadeWindows` counted whole BAYS instead of windows, which dropped a
  window that fits on nine of nineteen fronts and left every facade on the
  block 0.625 m left of centre. The second one did reach the neighbours, as the
  user guessed: the same door-chop was in the block default (~10 shops) and the
  burger barn. LAZY: the character front carried LESS built detail than the
  quiet shop next door — no transom, flat stallriser, no handle — and its
  clothes rail was one unbroken stripe because the hanger width and the step
  both rounded to 5 texels.

- **"we need much better facades for the tax service, diner, burger barn,
  thrift shop, casino, and hotel especially"** ✅ *for A's four.* Every bullet
  of the brief now honoured on THRIFT, A-1 TAX, DINER and BURGER BARN: set-back
  glass with a reveal, projecting fascia and stallriser, transom over the door,
  mullions, something in the window, signage as a made object, and wear where
  hands and weather reach. The tax banner was the last sign that was flat text
  stamped on a band. The diner has a **projecting blade** over the pavement —
  the one item on the user's list nobody had built.

  ✅ **…and for G's two as well** — the user said "casino, and hotel
  **especially**", so this stayed open-looking while it was in fact done. They
  are **G**'s (`OWNERSHIP.md`: `ct/vice.ts = G`), not E's. Every bullet, checked
  against the facade rather than against A's wording, because the two fronts use
  their own vocabulary and a word-search says they are missing:

  | the user's bullet | GOLDEN ACES | HOTEL ORPHEUS |
  |---|---|---|
  | set-back glass with a reveal | doors set in a reveal, `vice.ts:261` | door surround, `:344` |
  | projecting fascia | gold fascia + bulb row, `:276` | canopy / porte-cochère |
  | stallriser | black granite base below 0.55 m, `:222` | rusticated stone base below 0.4 m, `:313` |
  | transom over the door | gold head on the glazing line, `:262` | head band, `:345` |
  | mullions | bronze mullion per bay, `:252` | bronze mullion per bay, `:337` |
  | something in the window | mirrored bronze glass, deliberate — a casino does not let the street see its floor (`:225`) | the lobby, which is why it is the one room with a front window |
  | wear where hands and weather reach | grime at fascia and at 0.62 m, `:287` | grime + dither |

  The door heads land on the line the glazing already has — `gy0 - 6` against the
  bronze rail at `gy0 - 3` — which is the alignment A's transom commit argues is
  what makes a door read as part of the front rather than pasted onto it.
  The user's verdict on this elevation was *"that exterior is the best thing in
  the world right now"*.

- **"make the exteriors match the interiors"** / **"i need the facades to line
  up with the interior. so if the door on the interior is full right then the
  facade must match"** ✅ — **this is the most re-reported request in this file
  (four times, across A and F), so it is measured two different ways here.**

  The user's own test — stand inside, note the side, walk out, turn round:
  all 5 declared rooms mirror, the tax office included.

  And the way they actually phrase it elsewhere — *"the entrence to the tax
  service is not aligned with the door of the facade"*, *"all press e to enter
  options are aligned with the doors on the facades"* — is about the **[E] spot
  versus the painted door**, which is a different quantity and was not covered
  by the first test. Measured, in world metres:

  ```
  BURGER BARN  painted -25.11   [E] -25.11
  DINER        painted -46.61   [E] -46.61
  THRIFT       painted -59.32   [E] -59.32
  A-1 TAX      painted -20.13   [E] -20.13
  PAWN         painted -60.50   [E] -60.50
  ```

  Exact on every shop you can walk into. Shops with no interior have no [E]
  spot, which is correct — you cannot enter a records shop. The bodega is the
  documented chamfer case and is exempt by the user's own later words: *"do not
  change the facade i love it just make the entrance where i press e actually
  aligned."*

- **"this is a part of the bodega corner that needs to be fixed i flagged this
  to you a while ago but its still here"** (pavement through the shopfronts) ✅
  Walked it rather than trusting the check, including the side street as the
  brief asked: bodega, main block and all six side-street shops show a lit
  ceiling, a stocked shelf and a dark floor behind the glass. No pavement
  through any of them.
- **"i need the facades to line up with the interior. so if the door on the interior is full right then the facade must match"** → **A**

### 2026-07-24, session 3

- **"make wetness last a lil after it stops raining"** → **builder B**
- **"also make rain cause some puddles"** → **builder B** (same item; the
  ground needs its own `wetness` state instead of reading `rainLevel`)
- **"make entire library building a bit recessed so there like a courtyard
  public 3rd space area"** → **builder E** (new — owns the civic buildings)
- **"pillars of the church seem not fully thought out. they block the windows
  i think?"** → **builder E**. Real cause: the lancets are painted in texel
  space, the buttresses placed in metres, and nothing reconciles the two.
- **"the sign up top is completely floating. make sure for stuff like this we
  pay more attention."** → ~~builder E~~ → **builder G** (GOLDEN ACES is
  `ct/vice.ts`, G's), and a standing sweep for unsupported objects → **auditor**
  ✅ **verified fixed 2026-07-25**: the casino roof deck tops out at y 17.2 and
  the sign's legs run y 17.16 → 19.44, so they land on it. Measured, not eyed.
- **"i want more detail for both the hotel and golden aces casino facades"**
  → ~~builder E~~ → **builder G** ✅ delivered in `ct/vice.ts`; the user's reply
  to the result was *"that exterior is the best thing in the world right now"*.
- **"i want to build out the insides of the following: burger barn. diner.
  library. tax service. pawn shop. bodega. thrift store. my room. the casino.
  the hotel. ill let you divide all that up its pretty intense."** → split four
  ways behind a shared room kit (`ct/interior.ts`): **F** diner + burger barn +
  thrift ✅, **G** casino + hotel + pawn + tax, **E** library, **C** room 301.
  The bodega ✅ was rebuilt on the kit once D's door blocker cleared.
  **9 of the 10 are in the world.** Eight are in the interior belt — every one
  entered, held-in and exited by `scripts/interiors-walk.mjs` (195/195), each
  with a keeper on the 8-angle atlas — and room 301 is C's walkup, off the belt,
  with its door guarded by `scripts/door301.mjs`. Every `[E]` that reaches any
  of them is checked by `scripts/spot-coverage.mjs`.
  **Outstanding: the library** (E), which has a climbable flight and a
  locked-door response at the top until its interior lands.
- **"i want the cars to turn the corner and for the details to extend out that
  way trees crub, cars, etc. i want the pedestrians to also go out that way and
  have more complicated paths"** → **builder H** (new — traffic and nav)
- **"replace records and deli with church. you can swap those. make sure seams
  are all good post swap too"** → **builder D** (the roster is street.ts; E
  owns how the church looks, D owns where it stands)
- **"needs to be darker at night"** → **builder B**, folded into its in-flight
  flat-night item
- **"library is exactly the same no copurt yard or anything i asked for"** →
  **builder E**, courtyard promoted to the top of its queue
- **"cant go inside burger barn"** → **builder F** ✅ room and `[E]` both exist; the spot derives from the door declaration, and `scripts/interiors-walk.mjs` walks in and out of it every run.
- **"colors on burger barn arent right"** → **builder D** (still red + mustard;
  asked for red + white or red + beige, second time of asking)

### 2026-07-24, session 3 continued
_(The desk stopped logging here for a stretch and reconstructed it afterwards.
Nothing was lost — every item was routed and is in a queue or landed — but the
master record had a gap, which is what this section closes.)_

**Landed**
- "needs to be darker at night" + "light around the light posts to show up on
  the objects and entities under the lights" → **B** ✅
- "street lights light effect looks odd" → **B** ✅ reverted per the watch
  precedent; halo re-anchored to the lens
- "truck bed needs to be a bit deeper and black in the bottom" → **H** ✅
- "textures on back of truck are janky" → **H** ✅
- "move the truck a bit away from the alley" → **H** ✅
- "for every seat in the game i want to be able to sit down" → **F** ✅
  `ctx.seat()` with 29 seats
- "legs on these people is still off from the side, looks backwards on the
  feet" → **H** ✅ shoe given a toe, standing pose given two legs
- "tree looks transparent in parts" → **A** ✅ ragged-edge notches were eating
  the crown interior
- "all the lighting on the windows goes up and to the right" → **A** ✅ it was
  `((f*7 + c*3) % 5)`, a lattice
- "what is this?" (produce crates) → **D** ✅ attempt three, twelve separate
  fruit rather than one dome
- "replace laundry with diner" → **D** ✅ identity swap, run totals untouched
- "swap barber for thrift, then grocery and barber turn those into a small
  park" → **D** ✅ ground cleared
- "make meridian and laundry a bank instead" → **D** ✅ 19.2 m; also resolved
  the long-open Corporation item
- "inlay the church and give it some stairs... and a lil courtyard" → **E** ✅
- "i want to be able to walk up the stairs of the library" → **E** ✅ shared
  stair mechanic, used by both
- "we need much better facades for the tax service, diner, burger barn, thrift
  shop" → **A** ✅ (casino + hotel are separate, below)

**In flight**
- "park should be deeper" → **E**
- "turn hardware and cafe into a used car lot" → **D** (roster) + **C** (the
  lot itself, `ct/lot.ts` — built, waiting on D's roster)
- "the front facade of the casino and the hotel are so low effort and boring...
  meant to be some of the most insane" → **G**, extracted into `ct/vice.ts`
- "strange corner for bodega, also collision is odd in this same corner" →
  **D** — visual half BLOCKED on helpers A has not exported
- "what is this it looks bad" (catch basin) → **B**
- trash programme → **B**: three rig rounds. Approved and shipping: coffee cup,
  fountain cup, folded newspaper (reworked grimier/thinner), flattened
  cardboard, milk crate, plus two gutter decals liked in situ. Rejected: the
  banded rectangle, all instances removed.
- "i feel like nothing im communicating to you is actually happening" → traced
  to three finished interiors never being constructed in `crosstown.ts`;
  **still not fixed at time of writing**


## In progress

- **Re-cast the block.** Replace the current shop rosters with: fast food,
  casino (placed "out and away" — far end of the side street where it sinks
  into fog), a corporation, a library, a taxes place, a hotel near the
  casino, pawnshop, thrift shop, and a Catholic church. Bodega stays.
  THE KEY POINT: the library and the church cannot be shopfront bands with
  a name on them — they need their own facade vocabulary or the request
  fails. Library: *"nice but old, a hallmark of the benefit of public
  funding and a fervor for public spaces 40 years ago. no longer around"* —
  i.e. inherited civic grandeur, stone, tall windows, steps, engraved
  frieze; grand but unmaintained. Church: *"catholic, beautiful"* — stone,
  arched doorway, lancet windows, rose window, tallest thing on its
  stretch. Corporation should read blander/more modern than its
  neighbours; that contrast against the library is the point.
  Full brief in the alley worktree as `BRIEF-ROSTER.md`.

- **Bus, bench, bus stop.** Wants a bus stop on the block — a bench, a stop
  sign/flag or shelter, and an actual bus. The bus should presumably use
  the existing traffic system (there is already a cruising-car pool and a
  rare taxi) rather than being static.

- **Sidewalk + kerb detail pass.** The kerb is an untextured sharp
  rectangle (flat `kerbFaceM` 0x97928a, a 0.14 m box edge) — it reads as a
  grey bar, not concrete or granite. And the corner doesn't behave like a
  real corner: the walks meet in a square butt joint instead of turning.
  Wanted:
  - Textured kerb face — real kerbs are cast/cut in segments with vertical
    joints every few feet, a slightly rounded (battered) top edge rather
    than a sharp 90°, staining and chipping down at road level.
  - **A gutter pan** — real streets have a concrete strip (~0.3–0.6 m)
    between the kerb and the asphalt, distinctly lighter than the road.
    Its absence is a big part of why the kerb currently reads as a bare
    rectangle sitting on tarmac.
  - **A proper corner return** — kerbs curve around a corner on a radius
    (~3–6 m at a city intersection), and the sidewalk follows that curve.
    Right now the walks just abut at 90°.
  - Kerb ramp at the corner (ADA, so period-correct for '97), gutter
    running to a catch basin at the corner low point.
  - Sidewalk slab detail: scoring joints, staining, patches — attention to
    detail generally, it's the surface the whole game is walked on.

- **Watch: make it read as looking down at your own wrist.** Asked for
  several times now and every attempt has come back as *an arm sticking
  out with a fist in front of you* — wrong. The framing the user wants:
  the visible section is the **wrist**, the forearm runs off the **left**
  edge of the frame (cut off, not drawn as a whole limb), and the **hand**
  is on the **right** of the watch. Horizontal wrist across the view, no
  foreshortened fist pointing at the camera. The feeling to hit is the
  ordinary one of glancing down at your own wrist — not a raised arm posed
  in front of your face. (History: whole-arm version → reverted;
  fist+forearm version → reverted; currently wrist-only.)

- **Sleep in your room.** Wants to be able to enter 301 and sleep — a real
  gameplay verb, not just a lit interior. Implies a bed to interact with,
  an `[E] sleep` prompt, and time passing (advance the clock, fade out/in),
  which ties into the day/night curve.

- **Stairwell top: needs a floor and a railing.** See
  `shots/user-stairtop.png`. At the top landing the floor simply ENDS at
  the stairwell opening — you can walk straight off into the flight below.
  Wanted: (1) a proper landing floor around the opening, which **must not
  block walking down the stairs**; (2) a guard railing along the top of the
  stairs so you can't step off the edge. Also the pale centre core wall
  reads as a floating grey slab and is too high.

  THE CATCH: the floor here is not a mesh you can just add — height comes
  from the floor-picker `ground(x,z)` in `ct/apartment.ts` (the one with
  hysteresis that makes stacked storeys work for a 2D walker). So "add a
  floor" means extending the landing plateau in that function while
  leaving the sloped stair region intact, and adding the railing as a
  collider. Get this wrong and you either fall through or can't descend.

- **The street is too tidy.** Cars are parked too perfectly — spacing and
  alignment read as placed rather than parked. Wanted: less clean overall.
  Nudge parking positions/angles off-true, and scatter small litter — a can
  in the gutter, that kind of thing.

- **Building edge seams.** Visible vertical seams/gaps where one building
  meets the next — confirmed in `shots/tr-two-trees-e.png` between No. 227
  and ARCADE.

- **The alley cat is not a cat.** Confirmed in `shots/al-cat-close.png`: a
  ~10 px grey blob with two eye dots, sunk in a cardboard box — it reads as
  a mouse. **Drop the cardboard box entirely** and draw a proper, cute cat
  at a readable size: recognisable ears, tail, curled or sitting pose.

- **Alley side walls are mirror-identical.** Left and right are literally
  the same texture, which reads as artificial. They should differ — and
  earlier note: some of them are missing brick entirely while the rear wall
  (which the user likes) has it. Screenshots in `shots/al-*.png`.

- **Rain should belong to the world, not the camera.** It followed the
  player exactly — a personal rain cloud you could never walk out from
  under. FIXED: drops now live in world coordinates and only wrap by a
  whole box width when they fall outside the volume around you.

- **Ceiling lamps in the walk-up look wrong.** See
  `shots/user-ceilinglamp.png`. Two distinct problems: (1) **there is no
  fixture at all** — it's a bare glow decal on the ceiling, no shade, no
  bulb, no ceiling rose, so it reads as a smudge rather than a light;
  (2) **it's a smooth radial gradient in a world that is entirely
  hard-edged nearest-filtered texels** — the blur is wildly off-style
  against every other surface. Fix: model an actual period flush-mount
  (shallow opal dome, or a schoolhouse globe on a short stem), painted at
  the world's texel density, and replace the smooth gradient with a
  tighter stepped/dithered glow that matches the pixel style.

- **Door number plate is mangled.** See `shots/user-doorplate.png`. The
  "401" plate on the upper-floor door is (a) a stark near-WHITE rectangle,
  far brighter than anything else in the muted interior palette, and (b)
  the numerals are smeared and barely legible — the text is being drawn at
  a size that doesn't land on the texel grid, so it aliases into mush.
  Same root cause as the clipped entrance plaque. Fix: draw numerals at a
  texel-aligned size, and tone the plate to brass or brushed aluminium
  rather than pure white.

- **The neighbour is a flat cutout.** See `shots/user-hermit.png`. The
  hermit is a single front-facing sprite — it never turns. Every person on
  the street already uses the Quake-style 8-angle billboard
  (`citizenAtlas` 5 views x 2 frames + `viewFor(rel)` picking the sector in
  `ct/citizens.ts`). The neighbour should use that same system so he reads
  as a person in the world rather than a standee.

- **Delete the alley plywood and the trash bags.** See
  `shots/user-alley-junk.png`. The big tan panel behind the REZO tag is the
  leaning plywood sheet — it reads as a mysterious door, not as junk
  against a wall. Remove it. The two black lumps on the ground are the
  trash bags; they read as rocks/blobs and have been redrawn twice without
  landing. Remove them too. Removing both must not leave floating
  colliders or a bare patch where they sat.

- **Bodega as a true corner shop: chamfer the corner ALL THE WAY UP.** See
  `shots/user-corner2.png`. The kerb/corner return itself is landed and the
  user loves it ("this corner looks so good") — that stays. What's wanted
  now is architectural: **cut the building corner at 45 for its FULL
  HEIGHT**, ground floor to roofline, not just a ground-floor nick, and put
  the bodega door in that cut face. This is the real corner-store form —
  a canted corner bay running the whole elevation, with the entrance in it.
  Needs: the chamfered facade bay full height (brick above, shopfront
  below), door + awning + OPEN moved onto the cut face, the `[E] enter`
  trigger moved to match, the interior door realigned to the new opening,
  and the kerb/sidewalk in front of it still walkable.

- **Night should feel darker.** DONE — night wash peak 0.34 -> 0.58, dusk
  ramps harder, sky night colour deepened. Streetlamps now read as the
  light source. See `shots/night-night.png`.

- **Apartment entrance overlaps.** Ground-floor windows collide with the
  buzzer panel, the plaque and the door signage — things are drawn on top
  of each other instead of laid out. Wants a real **quality review** of
  that facade: screenshot it, look for texture overlaps, gaps/seams, and
  anything drawn at the wrong depth, then fix the layout so each element
  has its own space.

- **Rename THE WHITMORE.** User doesn't want the walk-up named after an
  Anglo surname. The world already carries an LA lineage (the placa
  graffiti research), so a Spanish building name fits and is true to real
  LA walk-ups (El Royale, Las Palmas, El Mirador, Villa Carlotta).
  Going with **EL MIRADOR** — "the lookout", which suits a building you
  climb to the third floor of. One-line change on the brass plaque if you
  want a different one.

- **Alley side walls have no brick.** The rear wall is right and the user
  likes it, but the left and right walls (the left one carries the REZO
  tag) are untextured — so the alley reads as discontinuous, brick behind
  and flat colour to either side. Give the side walls the same brick as the
  rear wall, continuous around the corner.

- **Trees: crowns bigger and more varied; dirt pit shorter.** Placement on
  the sidewalk is right and the pit **width** is good — the user fits past
  it, keep that exactly. Two changes: (1) crowns should be **bigger and
  more varied** between trees — they currently read same-y and undersized;
  (2) the pit is too **long** — it fills two tile blocks down the walk;
  shorten along the street axis while keeping the width.

## Done — 2026-07-24 reverts + wet streets + citizen nav

- **Watch reverted.** The arm/fist version was worse — back to the wrist-only
  close-up. (The `player` outfit config stays for the held wallet + future
  clothing.)
- **Tree crowns reverted** to the original bushy sprite (the rewrite looked
  worse than ever). Kept the kerb-side walkable placement from the earlier
  pass so you can still slip past them.
- **Wet streets when it rains.** The roads and sidewalks darken + cool toward
  a wet slate as the rain builds (tinting the unlit ground materials on the
  rain curve), so the whole ground reads soaked, not just the falling rain.
- **Citizens no longer phase through props.** They walk clear home lanes
  between the kerb clutter and the wall, and actively steer AROUND any solid
  prop ahead (tree, lamp, hydrant, parked or moving car) — sidestep first,
  turn back if truly boxed. They still phase only through YOU (and only when
  stuck), never through the things you collide with.

## Done — 2026-07-24 hands, crowns, citizens, hoodie

- **Hoodie no longer striped.** The torso's shading was two hard 4 px
  light/dark bands that lined up with the hood shading + bright drawstrings
  into one vertical stripe. Softened to 2 px rim lighting, dropped the centre
  seam, dimmed the drawstrings. Reads as rounded cloth now (helps every
  citizen, not just the hoodie).
- **Watch has an arm.** First-person: a relaxed fist + wrist + the watch +
  a sweater forearm running off the bottom of the frame. Sleeve/skin come
  from a new `player` outfit config — the seam for a real wardrobe later
  (a tee would just leave the forearm bare). Watch kept at its spot/angle.
- **Wallet is held, not a menu.** Now an open bifold gripped in both thumbs,
  centred and sliding up into first-person view like the watch — ID + your
  pockets on the left leaf, cash on the right. No more corner popup.
- **Bigger, varied tree crowns.** Rewrote the crown: a solid core + bushy
  lobes on a wider canvas, with per-tree seeded size/shape/palette so no two
  heads match. Dapples clamped inside the crown (no more stray streak).
- **Fire hydrant** gets the tree treatment — kerb-hugging with a tight
  collider, off the walking lane.
- **Feet stop when the person stops.** The walk cycle only advances while a
  citizen is actually moving; halted people stand with feet together instead
  of marching in place.
- **Citizen collision: temporary phase.** People are solid and halt a step
  short, but if held against you for ~1.4 s they give up and squeeze through,
  going non-solid only until they're clear (>1.4 m), then solid again. Fixes
  the softlock without making anyone permanently walk-through-able.

## Done — 2026-07-24 walkability + polish pass

- **Trees no longer block the walk.** The trunk + pit sat dead-centre of the
  2 m walk, and with player RADIUS 0.42 the lanes on either side were ~0.16 m
  — impassable. The bed is now a 0.8 m planting strip flush against the kerb
  (road side) with a tight trunk-only collider, opening a ~0.4 m clean lane
  on the building side. Verified by walking straight past a tree on the
  sidewalk (8.3 m, no stop).
- **No more softlock when boxed in.** A citizen walking up behind you while a
  tree/car/building held the other three sides could wall you in — they were
  solid and only stopped a step short. Now a citizen's collider is disabled
  whenever they're within 1.15 m of you: solid at a distance, always
  passable up close. Swept the block hugging the wall through citizen
  territory — 0 frames unable to move.
- **Streetlamp de-junked.** Kept the bishop crook the user liked but removed
  the diagonal brace strut (the "third length" jutting from the L). Clean
  pole + arm + a downlight head that hangs off the arm's end.
- **Raindrops smaller.** Streak point size 0.5 → 0.3.

## Done — 2026-07-24 night lamps + corner/exit fixes

- **Stuck exiting the bodega — fixed.** The old exit dropped you at
  `(8.7,-97.2)`, only 0.35 m from the "into the BODEGA" re-enter trigger
  (r=1.1) and wedged against the fruit-crate collider — so you'd get sucked
  straight back in, or press into the crates and not move. Now you step out
  to `(11,-97.3)` facing across the side street: clear of every collider and
  2.3 m outside the re-enter radius. Verified with a real WASD walk-out test
  (moves freely in 3 directions; the 4th correctly stops at the solid
  crates).
- **Corner sidewalk no longer jank.** Two real defects at the turn: (1) the
  west walk (wrapping to z=-110) and the south side-street walk both covered
  the SW corner square `x-7..-5, z-108..-110` — two coplanar tops = z-fight
  shimmer. South walk now starts at x=-5 so they abut. (2) The east walk's
  south END face at the SE convex corner was `walkDark` (an unfinished dark
  notch) while the side-street kerb picked up at x=7 — it now carries the
  light kerb face so the raised edge WRAPS the corner cleanly.
- **Night streetlamps.** Sodium-vapor heads on bishop-crook cast-iron poles,
  staggered down the block between the tree pits + a pair at the corner.
  Dark iron by day; at dusk the lens warms and an amber halo + road pool
  fade in on the same night curve as the sky (additive glow, billboarded
  halo — same technique as the interior bulbs). Verified day/dusk/night.

## Done — 2026-07-24 graphical-bug sweep

- **Side-street asphalt no longer smears** — `asphaltTex()` hard-coded
  `repeat(3, 30)`, tuned for the tall/narrow main road (10×134 m). Reused
  as-is on the wide/short side-street plane (62×10 m) it stretched each
  tile to ~21 m wide × 0.33 m deep, so the dither and cracks smeared into
  long horizontal streaks across the whole corner. Texture repeat is now
  derived from each plane's real metres (~3.4×4.5 m tiles); the main road
  is byte-identical, the side road matches its grain. Verified across the
  full corner sweep (bugsweep.mjs). Rest of the world reviewed clean.

## Done — 2026-07-24 quality pass, continued

- **LA graffiti** — researched cholo placa lineage (Bojórquez/Prime):
  hand-built 5×7 square block glyphs, ALL CAPS shoulder-to-shoulder,
  upright, one color (black/silver), hard underline with a flick. No
  bubbles, no lean.
- **Trees walkable + fitted** — crown slimmed to 1.6 m (fits inside the
  2 m walk, bottom well above head height); sidewalk slabs are now a
  uniform 1 m grid on every walk, and the dirt pits are exact 2×2-slab
  blocks snapped to that grid.
- **Hoodie chin** — removed the jacket-colored cowl band that covered
  the chin in front views.

- **Sprite trees restored** — the low-poly canopy trees were worse: lost
  the Quake-style rotating-sprite look and blocked the sidewalk. Back to
  the painted cutouts, keeping the good parts: fixed crown texels (taller
  = longer trunk only), dirt pits, trunk-only collision so the walk stays
  walkable.
- **Corner road graphical bug fixed** — the main-road and side-road
  planes overlapped 8 mm apart and z-fought; they now abut exactly at the
  corner.

## Done — 2026-07-24 quality pass (commit 8842d05)

- **Rain never falls indoors** — cuts instantly on entering a building.
- **Stairwell overhauled**: dimmed interior (darker wallpaper, painted
  per-storey ceiling shadows), solid centre core wall, sloped flight
  undersides, real handrails, legible door plates.
- **Graffiti redrawn from research**: REZO is a proper two-color
  throw-up (overlapping bubbles, shine, drips); SNAK and KOBRA are
  one-line handstyle tags. Names are invented writer pseudonyms.
- **Watch reverted** to the wrist-only close-up per playtest.
- **Working mode**: smaller batches, screenshot-review every piece
  against the early rounds' bar before shipping.

## Done — 2026-07-24 round 4 (live in artifact)

- **Graffiti + trash bags style-matched** — tags redrawn at shop-sign
  texel size (chunky pixel spray, muted colors); bags are low-segment
  lumps wearing a painted, dithered plastic texture instead of smooth
  vertex shading.

- **The corner** — the main street turns east at its south end into a
  hand-authored side street (FLOWERS, TAILOR, CHOP SUEY, OPTICIAN north;
  GARAGE, THRIFT, MISSION, BILLIARDS, SMOKES south; RADIO closes the west
  stub; the east end sinks into the fog). Kerbs, dashes, and ground rules
  wrap the turn.
- **The bodega** — owns the corner: shopfronts on both street faces,
  striped awning, neon OPEN, fruit crates, and a walk-in interior
  (checker lino, stocked gondolas, humming cooler, counter + register +
  shopkeeper). Buy cereal ($2.50) or soda ($1.25) with real cash.
- **E to go inside places** — one prompt-driven key: doors show
  "[E] enter …" when near; E also buys at the bodega and still feeds the
  birds when nothing else is in reach.
- **Rain from time to time** — hash-driven rainy hours, camera-following
  streaks, sky flattens while it falls.
- **Sad alley cat in a cardboard box** — by the south alley wall, one
  flap open.
- **Building renamed** — "THE WHITMORE" on a brass plaque; SEVILLE gone
  (user note about it referred to a stale build — the transom says 227).
- **Alley brick behind the dumpster fixed** — seamless 7×12-brick tile,
  no baked edge highlight, no repeating seams.
- **Trash bags read as bags** — near-black plastic with a sharp top
  sheen instead of grey stone.
- **Pickup bed lowered and recessed** — tub sits inside the body with a
  slab rim showing all round, rails just above the beltline.

## Done — 2026-07-24 round 3 (live in artifact, commit 2ec33e2)

- Pigeons: bigger flee radius (3.5), fewer bold holdouts; **E scatters
  cereal** that draws birds in and lets you get close while they feed.
- **Inventory + cash** ($14.50, 3 cereal to start); **right-click wallet**
  (leather bifold, bills, item list) — user suggested shift, but shift is
  sprint, so right-click.
- **Watch got its whole arm**: curled hand, knuckles, thumb, wrist watch,
  forearm into a jacket cuff.
- **Hold-C crouch** (eased camera dip, slower steps).
- **Pickup rebuilt again**: real open bed — thick walls flush with the
  slab, dark corrugated floor visible over the rails, textured tailgate.
- **Apartment moved across the street from the alley, a bit off** — east
  side (z −35..−53, door at −44); the building is a real residential
  facade (barred ground-floor windows, no shop band).
- **Stairs steeper (28°) and textured** — wood-grain treads, painted
  risers, plank half-landings.
- **Collision with people and everything sensible** — citizens are solid
  and halt a step short of you (can't trap you); hermit's doorway solid.
- **Hoodie final fixes** — no face from back-left, only a sliver in
  profile, hood shading matches the sweater exactly.
- **Graffiti in the alley** (REZO / SNAK / KOBRA tags).
- **Texture consistency pass** — facades, shopfronts, and residential
  ground floors all parametrized by building width; one brick density
  everywhere incl. the alley; sign bands cap at ~12 m.
- **Alley plywood** now leans back against the wall.
- **Every building purposeful** — hand-authored rosters: west DINER,
  LAUNDRY, PIZZA, PAWN, alley, MUSIC, BARBER, GROCERY, HOTEL; east BOOKS,
  HARDWARE, CAFE, ARCADE, No. 227, LIQUOR, DELI, CINEMA, BANK.
- **Trees fully overhauled** — low-poly faceted canopies on leaning
  trunks in dirt pits; no billboards.

## Done — 2026-07-24 rounds 1–2 (commit 18a7897)

- Trees taller-not-bigger + dirt pits (superseded by the full overhaul).
- Pigeons fly away when approached; rare bold one stays.
- Taxi made rare: traffic pool, one car on the block at a time.
- Fewer people (8 → 4).
- Jump edge-triggered (no hold-spam).
- Pickup bed painted-top rebuild (superseded by round 3 real-wall bed).
- Dumpster + trash bags redesigned (faceted 3D lumps).
- Hoodie hood made continuous with the sweater.
- Citizen atlas reviewed across all 8 angles (`__ct.atlases()`).
- Alley sky gaps closed (flush buildings + brick side walls).
- 4-story walk-up with switchback stairs, room 301, hermit at 302
  (afternoon-ish hours).
- Game clock (1 s = 1 min), day/night sky+fog, look-down wristwatch.
- Entrance: dropped "THE SEVILLE"; door + gold "227" transom + buzzer.
