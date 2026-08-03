## Done — 2026-07-25, routed to G (the rename)

- **"the casino is called SEVENS, not GOLDEN ACES"** — facade, blade sign,
  interior signage, the `[E]` prompt, the door label, everything a player can
  read. Granted as a **bounded cross-file mandate for this rename only**, in one
  commit, because *"a key renamed in four files and missed in two is a room that
  silently stops existing, and that failure is far worse than the ownership
  cost."*

  **THE NAME CHANGED ON 2026-07-25. `GOLDEN ACES` AND `SEVENS` ARE THE SAME
  BUILDING.** Every mention of GOLDEN ACES in `notes/` and in the history part of
  this file is left standing on purpose — it records what was true when it was
  written, and rewriting it would make the record lie about what people said and
  found. This line is the pointer that makes those references resolve. Nothing
  functional still uses the old string: 52 occurrences across 28 code and script
  files became 0, verified in the built bundle and not only in dev.

  Also closed in the same pass, both previously reported: *"casino text is a bit
  too blurry"* (the blade was 13.5 px/m and drawn with antialiasing `fillText`;
  it is 27 px/m through the hard-texel painter now) and the shorter word was the
  occasion to re-set the lettering rather than substitute it — one line of
  letters at more than double the old cap height, instead of two stacked lines.

## Open — 2026-07-25, routed to I (car lot)

- **Adopt the ground painters — the driveway apron above all** — *"ADOPTION, one
  line per surface, and it is cheap … ct/lot.ts has 12 untextured ground-facing
  surfaces totalling 82 square metres — the second worst in the world after
  civic. The one the user pointed at is the DRIVEWAY APRON, which he saw as 'a
  large flat untextured grey plane'. Take apronTex for it, and slabTex for the
  yard surfaces that are still bare quads."* Ranked after the two he reported
  twice (left row backwards, cars clipping); both of those are done.

  Carrying B's diagnosis, because it generalises: *"a flat colour is not a
  material. an untextured quad has no grain for the eye to attach to and no
  joints to give it scale, so it reads as a TINT OVER the paving rather than as
  a piece of paving."*

  → **I. PARTLY DONE, and the census does not reproduce against `ct/lot.ts`.**
  Measured with `scripts/I-flatground.mjs`: the lot had **one** flat-colour
  ground surface, the 0.7 m² office door step, now on `slabTex` — every
  ground-facing surface in the module is textured. **The driveway apron is not
  in `ct/lot.ts`.** Walking the ground line across the lot mouth, every surface
  from x 1 to x 9.5 reports `mod: tex-ground` — B's file. The apron proper
  already carries B's own `apronTex` at 32 texels/m. What does read flat is the
  60 × 124 m street ground sheet either side of it, at **0.03–0.11 texels per
  metre along z** against 32/m for the lot deck. Filed to B in
  `notes/BLOCKED-I.md` with the numbers; the user's complaint is real and
  `shots/I-apron-out.png` shows it. See `notes/I-ground.md`.

## Open — 2026-07-25, routed to D (this session)

<!-- The two entries below were LOGGED LATE, by D, after the work had landed.
     Both requests were sent straight to the builder mid-turn rather than through
     the desk, so neither was in this file and neither had a ledger row — the
     work existed and the ASK did not, which is GOTCHAS §19 exactly ("the master
     log simply stopped … the record could not be reconstructed"). Recorded here
     with the user's own words so the log is the log again. -->

- **Cat, sixth note — the right side of the paper trash** (`shots/user-catsix.png`)
  — *"put the cat on the right side of the paper trash … The cat must end up to
  the RIGHT of the newspaper, from the viewpoint of that screenshot. METHOD, and
  please use it because five derived positions have all missed: warp to the exact
  viewpoint of that shot, look, move the cat a little, screenshot from the same
  spot, compare the two images, repeat … Do not compute an offset from
  coordinates."*
  → **D. DONE, by that method.** Seventh position, `(-10.00, -42.35)`, arrived at
  by comparing frames rather than by arithmetic. In the user's shot the cat's
  body touches the printed paper's right corner; it now stands in the open floor
  between that paper and the cardboard to its right, clear of both.
  `shots/user-catsix.png` is checked in beside `shots/D-catsix-after.png` from
  the same viewpoint. **Why five derived attempts missed:** "right" was taken
  from the ALLEY MOUTH's axis, and an offset is only right in the frame it was
  computed for. The check I had written also passed on the rejected position and
  has been rewritten as a claim about where the cat is.

- **ATM fascia bottom to 0.75 m** — *"extend the fascia DOWNWARD to 0.75m"*,
  said three times.
  → **D. DONE.** I had shipped 0.68 on the reading that the "0.9–1.0 m of
  fascia" in the same ruling was the target the number was reaching for — the top
  is pinned at 1.58 by the screen height, so 0.75 yields 0.83 m and only 0.68
  reaches 0.90. Raised twice, answered 0.75 twice: a number the user repeats is a
  decision. Fascia is 0.83 m; screen 1.370, keypad 1.100, both rakes and the
  0.17 m recess unchanged. `shots/D-atm-075-{front,left30}.png`.


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
- **"i need much more diversity on the ads, theyre all basically the same ad just diffr colors almost"** → **C**
- **"a casino slot stool opens a modal and hud.ts BLOCKS keydown while a panel is open — neither E nor Escape reaches the world"** → **K**
- **"one missing ATM line now blocks three rows, and two of them are already green"** → **A** (measured by B from three directions)

  <!-- B: 0 of 511 spots match /balance|atm|cash machine|card/. __atm.open
       works from a console but no player can reach the machine. It makes
       K's ATM row unverifiable, crashes M's bank check before its first
       assertion (TypeError on money(null)), and leaves M's loan money
       chain unreproducible on a row that is already CONFIRMED — the exact
       shape AUDIT swept for. notes/B-one-missing-line-blocks-three-rows.md -->

- **"the stuck seat reproduces deterministically — while seated the prompt reads SIT, not STAND, and that spot is dead"** → **F** (repro by B; C could not get one)

  <!-- B: build 1ddaf50ec, bed in 301. Sit, then E three more times:
       seated stays true, position unmoved, CLOCK UNMOVED — so nothing
       else fired either; it is a dead selection, not a mis-selection.
       The prompt on screen while seated is "[E] sit on the bed and
       watch TV", guarded by !rig.seated, so E resolves to a spot that
       refuses to act. Census re-counted: 149 of 225 matches C exactly,
       but the EXACTLY-0.00 m tier is 69, not "12+" — all casino slot
       stools. notes/B-seat-exit-REPRO-for-F-and-C.md -->

- **"pressing e doesnt get me out of it — the player is STUCK in the TV-watching state"** → **C**
- **"props.ts addLamp has no removal, so a light that should go out has to be deleted instead"** → **B** (mine; raised by C hitting it on the TV) ✅ built

  <!-- B: addLamp returns a remover now. Proven as a cycle on a real
       surface, not on the array: light it (0 -> 3 poolLit, tint 0.0312 ->
       0.3118), remove it (back to exactly 0.0312), light it again, remove
       again, and call the remover twice — harmless. Removal is BY IDENTITY,
       so two fittings at one coordinate cannot put each other out.
       For C: the TV can hold a lamp while on and drop it when off now,
       instead of never registering one. 48-shot sweep clean, alley door
       still POOLED at 0.0787. -->

  <!-- B: lampHeads is a build-time list and nothing takes an entry out.
       C had to delete the TV's registration rather than switch it off,
       and until then the set pooled light on the boards of 301 all
       night — against "make the unilluminated stuff darker", asked four
       times. Confirmed gone: 544 meshes in the 301 belt, 0 poolLit.
       I will add removal if anyone else needs it; nobody does yet.
       notes/B-two-affordance-traps.md -->

- **"pressing e doesnt get me out of it" (stuck in the TV seat)** → **C** measured, root cause is the kit → **F**
- **"how do i stop watching the tv"** → **C**
- **"the tv bezel looks good but i think i want the tv black"** → **C**
- **"tv off unless i sit down to watch it pls"** → **C**
- **"every interior room moved +80 m in x when ct/int-bank.ts was inserted — every ledger station naming an interior coordinate now points at the wrong room"** → **DESK** (found by B verifying)

  <!-- B: measured at build 4b7070163. bodega 440->520, casino 600->680,
       diner 760->840, tax 1080->1160, thrift 1160->1240, and so on. The
       world is right; the stations are stale. I corrected my own five.
       Found because a probe keyed on "the lowest ceiling in the world"
       walked into the new bank and reported its teller as the bodega
       keeper — a superlative is a claim about every OTHER room.
       notes/B-the-interiors-moved.md -->

- **"give the tv a bezel and make the tv play only lots of stupid looking ads. like super 90s stupid"** → **C**
- **"the east-end graph edge still crosses ten metres of carriageway and the paint that marked it is gone"** → **H** (routed by the desk; B has landed its half)

  <!-- B: crossings A and B are on the junction now with coordinates and
       four dropped kerbs, in notes/B-crossings-for-H.md. The east end is
       clean asphalt and continuous kerb. If closing the ring another way
       still needs a legal crossing there, say so and I will put the two
       KRAMP booleans back. -->

- **"i would like a black jack interface. very nice and impressive and try hard"** → **L**
- **"also we need a jail. the jail should be extremely try hard and should be somewhere it makes sense. probably over by the casino tbh lol"** → **O**
- **"i want to be able to watch tv. and i sit on the bed and literally watch tv. lets make it so you press e and then you transition to sitting on the bed and watch tv and it plays something kinda nonsensical. random. lots of things so it doesnt get to repetative"** → **C**
- **"'Screenshot from 2026-07-26 00-55-46.png' why is the door backwards?"** → **C**
- **"'Screenshot user-301-door-face.png' he is standing inside 301 and the 301 number plate is facing him — the door's two faces are swapped"** → **C**
- **"i also want an atm interface and an inventory interface. equally try hard"** → **K**
- **"add a slots interface and game where when i sit down i enter the slots interface and i can play slots. fully make a slots game that works well and pays out and everything. high effort here."** → **L**
- **"'Screenshot from 2026-07-26 00-51-15.png' maybe we could add crosswalks here though? (the WALKING half)"** → **H**
- **"'Screenshot from 2026-07-26 00-51-15.png' maybe we could add crosswalks here though?"** → **B** ✅ built
- **"the side street east-end crossing is being removed — close the walkable ring another way instead"** → **H**
- **"'Screenshot from 2026-07-26 00-50-34.png' remove this cross walk"** → **B** ✅ built
- **"'Screenshot from 2026-07-26 00-49-48.png' left door in casino is reversed"** → **G**
- **"the bodega keeper still shows his back from the counter — H's sector-4 reading is right and the turn was never made"** → **F / H** (found by B verifying, not B's file)

  <!-- B: seen from a station the game validates — the [E] buy cereal prompt
       is up in shots/B-verify-F/keeper-oblique.png, so the world says a
       customer stands there — and the keeper shows hair, no face, no ear.
       Found positionally (the standing figure behind a counter) rather than
       as the first atlas figure in the room, which is what defeated the
       auditor. Resolves to (442.35, -0.70), matching int-bodega.ts's own
       KEEP_AT = CTR_X - 0.55 to the centimetre. STAND AT (441.50, 0.40)
       facing the counter. Ledger row left LANDED deliberately. -->

- **"guy sitting in casino is clipping through his seat"** → **G**
- **"a 14.9 x 15.8 m ground sheet in the car lot carries one 64x64 tile — 4.3 texels/m, an eighth of the mandate on both axes"** → **DESK** (found by B, not B's file)

  <!-- B: turned up by the corrected density sweep (scripts/kerbwalk.mjs). At
       (22, 0.152, 3.2), 235 m2, rep [1,1] on a 64x64 map. It is the lowest
       real density left on any ground surface in the world and the only one
       genuinely stretched — the four "60x124 m at 0.03" meshes I reported
       earlier were kerb ribbons and that number was never a measurement.
       Not my file; routed rather than touched.
       notes/B-ground-density-corrected-for-I.md -->

- **"when the player goes to sleep i want the screen to fade to black"** → **K**
- **"stealing a package gives you a random item that goes in your inventory (the INVENTORY half of C's package feature)"** → **K**
- **"i want all the neighbors in the building to have a small chance of getting a package. every night all the packages go away. the packages never go in front of the door only on the sides of the door. you have an option to steal the package if you steal you get a random item and then it goes in your inventory."** → **C**
- **"neighbor just disappears when he goes away why not make him go in his apt and then close the door"** → **C**
- **"i think the selection options are a bit too wide. i feel like i select stuff without even looking at it"** → **D**
- **"'Screenshot from 2026-07-25 23-39-02.png' we gotta move this phone thing elsewhere or be done with it entirely"** → **B** ✅ built

  <!-- B: MOVED, per the desk's ruling, to the ALLEY MOUTH — and rebuilt as a
       shelter with real depth (0.30 m -> 0.62 m, eight parts, a visible side
       wall and a canopy that projects). The mouth was chosen because it is the
       only one of the three candidates where depth is physically available:
       the walk is 1.94 m and walkers run at x -6.00 +/- 0.55, so anything
       against the shopfronts may be 0.45 m deep at most. Measured: nearest
       face to the walk -7.07, CLEAR by 0.07 m; closest walker in 360 samples
       1.86 m; header held at 1.0 at 23:00 while the enamel drops to 0.12.
       Walked past and walked to. notes/B-payphone-moved-to-the-alley-mouth.md
       -->

- **"instead of calling the casino golden aces call it SEVENS"** → **G**
- **"'Screenshot from 2026-07-25 23-30-58.png' hotel textures are buggy"** → **G**
- **"'Screenshot from 2026-07-25 23-27-45.png' whats wrong with this plant in the tax service place"** → **G**
- **"'Screenshot from 2026-07-25 23-27-24.png' whjats going on here in the library"** → **J** ✅ built

  <!-- J: the object in that shot is the PERIODICALS RACK, not the computers.
       The routing message called them "your computers"; matched against the
       screenshot and against the world, they are the three raked newspaper
       panels in the west alcove, and there is no beige CRT in frame because
       my terminals are LIVE-not-landed and the world he is playing has none.
       That is not a reason to discount it, it IS the report — he named the
       object as something else entirely, which is the test he set. Rebuilt as
       a face-out magazine case in the vocabulary he says works ("the
       bookshelf and the blue display case read instantly"). His terminal
       checklist was separately applied to the real terminals. -->

- **"'Screenshot from 2026-07-25 23-26-31.png' discontinuous railing in library"** → **J** ✅ built
- **"'Screenshot from 2026-07-25 23-25-21.png' whats going on with this cars its like up in a weird way also i hate this pole thats in the way"** → **I**
- **"'Screenshot from 2026-07-25 23-24-37.png' whats going on here? looks like an issue with the sale sign, itsa like embedded in the car"** → **I**
- **"'Screenshot from 2026-07-25 23-09-56.png' dont like how this curb is discontinuous and only 3 slabs, its unrealistic"** → **B** ✅ built

  <!-- B: BOTH FAULTS ARE THE CAR LOT'S DRIVEWAY APRON, which is mine. Found by
       recovering his pose from the traffic cones in the shot. Measured there
       before touching anything: joints ACROSS the walk read at 6.95 m and then
       not again until 1.25 m — a 5.70 m hole — while joints ALONG it read 18
       times in the same strip, identical at 13:00 and 22:30 so it is not the
       night grade. apronTex scored in ONE direction: three ribbons 8.6 m long
       with a joint only at each end. Three slabs, exactly as he says. Scored
       both ways now, on the walk's own flag lines so the pavement runs through
       the drive. And the kerb: it sits at its lip for 7.40 m, which is correct
       for a curb cut, but the face uv cropped kerbTex at a fixed world height
       so the depressed run showed a 1.5 cm slice out of the MIDDLE of the
       profile — no top edge, no grit line, nothing to see. It maps the sheet's
       full height now. notes/B-the-apron-was-the-report.md -->

- **"five mutation guards have STOPPED GUARDING — three are A's, and canfail is not in any gate"** → **A**
- **"'Screenshot from 2026-07-25 23-08-52.png' i think the door needs to open the other way to match the other floors"** → **C**
- **"scripts/floaters-walk.mjs ignores its room argument — a filter that silently does not filter"** → **A**
- **"the driveway apron reads as a large flat untextured grey plane"** → **B** ✅ built

  <!-- B: THE HEADLINE ON THIS ROW WAS MY OWN BAD MEASUREMENT and I have cut it.
       There are no "60x124 m ground sheets at 0.03 texels/m": those are the
       kerb face, arris, gutter pan and red paint — four ribbons that wrap the
       whole block, 0.15 m tall, whose BOUNDING BOX is 60 x 124 m. I divided a
       texture size by a bounding box. Every walk sheet in the world measures
       exactly 32 texels/m in both axes (scripts/kerbwalk.mjs). The apron's real
       fault was its scoring, fixed with the row above. -->

- **"'Screenshot from 2026-07-25 22-07-32.png' why does the lighting catch an invisible wall here?"** → **B** ✅ built
- **"'Screenshot from 2026-07-25 22-06-38.png' lighting on this alley back door looks messed up like it gets cropped by door."** → **B** ✅ built
- **"'Screenshot from 2026-07-25 22-05-35.png' get rid of this weird internal structure inside the library"** → **J** ✅ built
- **"'Screenshot from 2026-07-25 22-05-14.png' library entrance doesnt match exterior"** → **J** ✅ built
- **"'Screenshot from 2026-07-25 22-04-43.png' librarian orientation is so bad. also i want computers in the library"** → **J** ✅ built

  <!-- Retagged G -> J by J, not by the desk. These three are why builder J was
       stood up: they arrived inside five minutes while G was carrying six live
       requests across four rooms, and `ct/int-library.ts` was handed to J.
       Correcting the tag rather than leaving it is GOTCHAS §44 — a routing row
       naming the wrong builder does not read as stale, it reads as work
       somebody else is doing, and the cost is either two builders in one file
       or nobody in it. The desk owns this log; if the desk would rather these
       moved to a Done section, they are all three landed on feat/civicint. -->

- **"'Screenshot from 2026-07-25 22-03-52.png' i like the atm, maybe add another on the left and make the rest of the facade match the same vibe. i love the doors of the bank too."** → **A**
- **"'Screenshot from 2026-07-25 22-02-53.png' can we remove the horiz stripes on the walls with the railing?"** → **C**
- **"shouldnt be able to select things through objects ever"** → **D**
- **"'Screenshot from 2026-07-25 22-01-17.png' front of bodega is a little bit too jankily illuminated. like that exact rectangle doesnt look like the other stuff"** → **B** ✅ built
- **"'Screenshot from 2026-07-25 22-00-33.png' need a bit of space on entry area. maybe instead of slot we kill a row and add seat of some sort"** → **G**
- **"'Screenshot from 2026-07-25 21-59-46.png' hotel looks so bad, rugs all over, off center and stuff. furniture strewn about. awful."** → **G**
- **"yea get rid of outline unless debug is true, we'll probably want that for debug"** → **D**
- **"'Screenshot from 2026-07-25 21-57-05.png' what is this in the corner of the bodega?"** → **F**
- **"'Screenshot from 2026-07-25 21-55-19.png' alley is better but i dont like the color of the alley way. i prefer the look of the other alley"** → **B** ✅ built
- **"'Screenshot from 2026-07-25 21-54-16.png' why is this what is highlighted for opening or closing a door. in general do you think this highlight thing is too hard? maybe we avoid it?"** → **D**
- **"'Screenshot from 2026-07-25 21-53-27.png' top right part of window frame has graphics glitchy ness"** → **C**
- **"the street's 27 untextured flat-colour ground surfaces (the STREET half of the flat-colour fix)"** → **D**
- **"the driveway apron reads as a large flat untextured grey plane (the LOT half of the flat-colour fix)"** → **I**
- **"what is this shadow geometry here? / park paths read as road, not park path (the CIVIC + PARK half of the flat-colour fix)"** → **E**
- **"when i enter bodega i should be facing perpendicular to the wall door. so looking this way (ref shot down the aisles)"** → **F**
- **"'Screenshot from 2026-07-25 21-47-13.png' benches still tilted and clipping trash or whatever that is"** → **E**
- **"'Screenshot from 2026-07-25 21-46-49.png' whys the gazeobo structure look chopped? also should be taller a lil bit"** → **E**
- **"'Screenshot from 2026-07-25 21-46-19.png' the tree is transparent where it shouldnt be"** → **B** ✅ built
- **"'Screenshot from 2026-07-25 21-45-46.png' why is this highlighted for the thrift store?"** → **D**
- **"'Screenshot from 2026-07-25 21-45-18.png' whys my 3rd floor neighbor floating on the 2nd floor?"** → **C**
- **"'Screenshot from 2026-07-25 21-44-52.png' the highlight is not the contour of the full bed but simply the frame?"** → **D**
- **"'Screenshot from 2026-07-25 21-44-36.png' the door isnt high lighted?"** → **D**
- **"door handles on my floor dont match other door handles. pls fix"** → **C**
- **"neighbors door should be closed when neighbor is not out"** → **C**
- **"'Screenshot from 2026-07-25 21-22-35.png' add some detail to this alley, like a gutter pip some vent stuff on the ground, etc"** → **D**
- **"'Screenshot from 2026-07-25 21-20-56.png' bodega exit needs work"** → **F**
- **"'Screenshot from 2026-07-25 21-20-09.png' fence at park looks floating and off"** → **E**
- **"pews in the church clip into the confession booths, lets get rid of some of the rear pews"** → **G**
- **"make sure all the clocks throughout the world (library, diner, etc. tell the time accurately)"** → **F**
- **"'Screenshot from 2026-07-25 21-17-58.png' can we somehow make it so the cat looks up at you?"** → **H**
- **"'Screenshot from 2026-07-25 21-16-51.png' this outline is not around the object, i wanted to be around the object"** → **D**
- **"'Screenshot from 2026-07-25 20-55-30.png' park still needs work. benches are clipping and tilted. also the gazebo shelter type thing in the park is gone, i liked it."** → **E**
- **"'Screenshot from 2026-07-25 20-53-34.png' library interior is better but still jank. i like the stairs, and the idea of a balcony but they are inaccessible because of walls."** → **G**
- **"'Screenshot from 2026-07-25 20-53-04.png' public library still says pvblic library??"** → **E**
- **"also i would like a very narrow, long, and detailed alley in between the pawn shop and my apt building."** → **D**
- **"also i think the neighbor is out looking into my apt way too often"** → **C**
- **"in general i want to be able to interact with things a lot easier and for them to have a little outline highlighted for the selection of it. the door for instance to my apt should be easy to open and close when looking at or by the door frame or the door itself."** → **D**
- **"'Screenshot from 2026-07-25 20-47-52.png' i want to have a fist on the right side of the watch here. it actually should be really minimal considering it would be the top of the fist. no fingers would actually show so i kinda expect a square larger in width than the wrist attached to the right side of the wrist."** → **D**
- **"'Screenshot from 2026-07-25 20-47-21.png' interior of bodega is very cramped and also the door is not on the corner"** → **F**
- **"'Screenshot from 2026-07-25 20-45-15.png' i really like the inner lobby like area to the church its v realistic imo. i like the hjoly waterr at the entrence but its clipping a bit. also the confession box is completely clipping the wall. in general the church needs to be a bit bigger. you can make it wider than it actually is outside too. by matching the exterior i really mean in general positioning. no one is going to take a ruler and measure the width of the inner and outer."** → **G**
- **"'Screenshot from 2026-07-25 20-17-52.png' orientation of things in the church might be off."** → **G**
- **`rainLevel` and `wetness` stay 0 even at an hour `rainAt()` reports as raining** → **B** ✅ built (does not reproduce)

  <!-- B: it HAS a ledger row now — it had none, which is why nothing
       ever chased it. MEASURED: rainAt() calls hours 0,1,10,14,16,17,21
       raining; at 0:30 indoors at the spawn (x 198.6) rainLevel and
       wetness are 0.0000, and OUTDOORS at x -6 they are 0.9803 and
       0.9726. It rains. The 0 indoors is updateRain's own rule — it
       never rains indoors, cut above x 100 — and the player SPAWNS
       indoors, so a probe reading from spawn gets 0 forever and it looks
       exactly like this bug. I made the same mistake myself today on the
       same signal. node scripts/rainlive.mjs prints both side by side. -->
  Noticed by C while wiring `Frame.wet`; `props.ts` is B's, so filed rather than
  chased. `scene.userData.rainAt(62)` returns **true**, but `rainLevel` and
  `wetness` both read **0.000** for ten seconds at that hour — jumped to it, and
  again stepped into it an hour at a time over four hours in case a jumped clock
  was the problem (GOTCHAS: a jumped clock is a world that has never had
  weather). Either the rain never starts, or it keys on something other than the
  absolute hour `rainAt` hashes on. C has NOT touched it and cannot say which.
- **"sleep in your room needs a way to advance the clock — nobody has one"** → **F**
  → **C. BUILT.** `[E] sleep until morning` at the bedside in 301. Snaps to the
  next **07:00**, not a fixed eight hours, so the verb means the same thing
  whenever you use it — 23:00 gives you eight hours, 04:00 gives you three, and
  either way you wake at seven. Measured at four start times: advanced 8.00,
  3.00, 18.00 and 24.00 hours, each landing at 07:00 (plus the few minutes the
  world clock ticks while the ramp runs).

  **Ramped, not snapped, and that reconciles the ruling with the kit rather than
  overriding either.** "No fade" is about not building a full-screen HUD overlay,
  and none was built. But `ctx.clock.advance` documents its 1.5 s ramp as
  load-bearing — *"snapping is what would fight them: the grade would jump a full
  night in one frame and the rain would teleport through its own schedule"* — so
  `overSeconds: 0` would break the sky, the lamps and the rain to save 1.5 s. The
  default ramp is used, and the sweep is visible: 13:00 goes 8.61 h → 17.30 h →
  18.02 h over about two seconds.
- **"casino internals are cool but leave a lot to be desired. i like the improvements but a few too many slot machines and not enough diversity in games/design/tables. also no seats? some if not all of the slots should have seats. also it shouldnt feel so crowded maybe higher ceilings and more space between machines"** → **G**
- **"i like the space in the hotel lobby its eerie. enrich the lobby with furniture decor, etc. i want to be impressed"** → **G**
- **"entrance to bodega looks like this. so ugly and is so crowded. have the agent care and put attention to detail and decor into this bodega i want it to feel real"** → **F**
- **"church entrance geometry is fucked / the church itself leaves a lot to be desired. also this church is catholic wheres the jesus on the cross?"** → **G**
- **"pawn shop exterior leaves a lot to be desired"** → **A**
- **"door at the pawn shop makes no sense"** → **G**
- **"graphics clipping between library and burger barn, might want to refine the library geometry"** → **E**
- **"why so many vertical stripes on the brick?"** → **C**
  → **C. DIAGNOSED AND FIXED — it was NEITHER candidate.** Not the bond: the well
  paints a running bond already, `off = (y/4) % 2 ? 0 : 8` with perps every 16 px,
  so consecutive courses shift half a brick and no two perps line up. Not tiling
  seams either: `repeat.x` is **1.65** across the far wall, which is one or two
  seams, not a field of stripes. **It was a third cause and it was mine** — one
  line I wrote as *"soot and damp streaks"*, drawn as four 2 px bars at fixed x
  running the FULL height of the tile. In a tiled texture any full-height feature
  at a fixed x becomes a stripe; at 1.65 repeats that is ~7 hard bars floor to
  top. Measured against the texture's own median column brightness: those four
  columns sat **11–13 below**, the perps only 5–6. After the fix, 2 columns sit
  3 below and both are perp joints. Staining stays as short broken runs that
  never touch a tile edge, at a third of the weight. Perps also lightened 0.30 →
  **0.16** — the desk was right that they read as bars; they were the same weight
  as the streaks.
- **Should the light well use A's `masonry()` rather than its own brick?** → **A / DESK to rule**
  Asked rather than acted on, as instructed. The well does paint its own 32×32
  tile. Worth being precise about what that did and did not cause: `masonry()`
  would not have prevented this fault — the stripes were an overlay painted ON
  TOP of a correct bond, not a bond error — but the well would still be better
  off deriving its canvas from real metres at the world's one density instead of
  guessing a 32×32 tile and a 1.15 m repeat. `masonry(wMeters, hMeters, baseY,
  mult)` already returns `{W, H, ppm, m(), at(), courses()}`, which looks like
  everything needed; what it does not obviously expose is a way to paint SOOTED
  brick at a much lower key than street masonry. If A exports that, C will switch
  the well over and drop the private tile.
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

  **The patch, and it is TESTED — not a suggestion.** Strip ANSI before matching.
  Line 119 becomes:

  ```sh
  PORT="$(sed -E $'s/\033\\[[0-9;]*m//g' "$SRVLOG" | sed -nE 's#.*Local:.*http://[^:]+:([0-9]+)/.*#\1#p' | head -1)"
  ```

  C ran that against a copy end to end — it pins the tree, builds it, serves it,
  reads the port and completes `door301` against the pinned build, all seven
  clauses green. C did not apply it: `scripts/**` says do not edit another
  agent's script, and this is H's. It is one line whenever H wants it.
- **`props.ts` `isSelfLit` holds ~40 printed sheets and one citizen at full daylight after dark, and classifies inconsistently** → **B** ✅ built
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
- **"for the bench i have no way to sit at the bench from the street cause the e option doesnt come up"** → **B** ✅ built
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
- **"a little too many grasses in the streets. like way too many. should be more rare"** → **B** ✅ built
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
- **"whats going on with the shadow geometry here? i need an explanation for these shadow geometries"** → **B** ✅ built

  <!-- B: I FLAGGED THIS AS A ROUTING MISMATCH AND I WAS WRONG. It IS mine.
       There are THREE shadow-geometry rows: "explain the shadow geometry on
       the forecourt" (B, CONFIRMED by the auditor — the library forecourt
       patches) and two of E's about the park desire lines. E has its own two
       inbox lines at 403 and 675; this one is the third and it is the
       forecourt.
       My fuzzy matcher paired this line with E's row because the WORDING is
       closer, and I published the mismatch without reading the alternatives.
       Third time in three rounds that matcher has misled me — the other two I
       caught before filing. This one I did not. -->
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
- **"cup trash a bit too common and cups are too big"** → **B** ✅ built
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
- **"i like the thought, to make a drive entrance. however it looks graphically bugged"** → **B** ✅ built
- **"tree in the dirt looks janky, i think we need to make the dirt patch a lil bigger on the curb side"** → **B** ✅ built
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
- **"so it should not be cutting off the actual ad for tonys pizza also theres some strange graphical bug on the legs you see its like the same plane as the wood"** → **B** ✅ built
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
- **"make this look nicer, i dont think we need the bottom wood part. also the tonys pizza part i think needsa to have a bezel"** → **B** ✅ built
- **"these people are stuck"** → **H**
- **"i like the triangles but it also just looks low effort do a high effort sleazy used car lot. make it make sense like how does one even enter, drive a car off the lot. do some research into what old sleazy used car lots looked like"** → **C**
  → **C. FIXED.** There is a kerb cut with the walk ramping over it and a gate on
  the cut; lot-kerb-seam confirms the cut lies **entirely inside the gate**, so
  a car can leave across all of it. Plus the period vocabulary: banners
  zip-tied to the chain-link, the pole sign, windshield price cards, tyre
  stacks, bunting and weeds in the cracks.
- **"also i think these are puddles and they look awful honestly / trash cannot be clipping through stuff like this"** → **B** ✅ built
- **"in general we should not encrouch the already cramped sidewalk"** → **AUDIT**
- **"park border with sidewalk looks fucked up, we gotta fix this. in general we should not encrouch the already cramped sidewalk"** → **E**
- **"this is a part of the bodega corner that needs to be fixed i flagged this to you a while ago but its still here"** → **A**
- **"hm i think the tonys pizza sign should go on the back of the bench also i think the bench back should lean back a lil"** → **B** ✅ built
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
- **"make street light a bit more broad in their emitted light (like a wider beam) and make the unilluminated stuff darker. it should feel scarier at night i want to be able to see stars sometimes"** → **B** ✅ built
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
- **"the car lot apron is a large flat untextured grey plane"** → **B**. Three ✅ built
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
- **"i dont like how close the tree bases are to the edge here i think ideal would be with a bit of clearence on the curb side. also the puddle doesnt make sense here. the gutter should have the water in the gutter"** → **B** ✅ built
  — **B: both halves landed and measured.** Clearance on the kerb side was
  0.218 m of walk between the kerb chamfer and the pit edge, the same at all
  seven pits. **SUPERSEDED BY THE USER'S OWN LATER INSTRUCTION** — "make the
  dirt patch a lil bigger on the curb side" widened the well from 0.36 m to
  0.56 m and spent that strip down to **0.118 m**, which is what the world
  measures today and what `footprint` asserts (bar moved 0.20 → 0.10 to match,
  deliberately). Left here rather than overwritten because 0.218 was true when
  it was written; it is simply no longer the current number, and it had begun
  to be quoted as one. The water is 9 sheets, every one of them 0.22 m in from the kerb
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
  lot itself, `ct/lot.ts`). **BOTH DONE.** This line said "built, waiting on D's
  roster" long after the roster placed it — `street.ts` carries `'lot'` in EAST
  and calls `placeLot`, and the ledger has C's half CONFIRMED as walked into,
  with 491 lot meshes in the world. The depth is `depth: w`, taken from the
  frontage, so the lot is square by construction rather than by a constant
  somebody has to keep in step.
- "the front facade of the casino and the hotel are so low effort and boring...
  meant to be some of the most insane" → **G**, extracted into `ct/vice.ts`
- "strange corner for bodega, also collision is odd in this same corner" →
  **D. DONE**, and the BLOCKED note this line carried for a long time was stale —
  it said "visual half BLOCKED on helpers A has not exported" long after `HI`,
  `reveal`, `proud`, `glazed` and `mullions` were all exported from
  `ct/tex-world.ts`. A stale BLOCKED costs more than no entry: it tells the desk
  to route elsewhere and wait. Broken out, because the item reads as four faults
  and is not: the **OPEN neon** was already over the door; the **shopfront
  rhythm** was already one fascia, one opening, one reveal depth, one cill and
  one stallriser; the "**panels at different widths**" were my own misreading of
  the corner's brick piers, which are structure and are what a cut corner looks
  like; and the **collision** half is separately CONFIRMED as the bodega entry
  blocker, walked from three approaches. The one piece that was real — the corner
  paving scored as a square 90° arris against a bay that cuts at 45° — was routed
  to **B** and has landed as a soldier course. Auditor CONFIRMED D's half.
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

## "i think the selection options are a bit to wide"

> *"i think the selection options are a bit to wide. i feel like i select stuff
> without even looking at it."*

Routed to **D**. A walk-back of the earlier "keep the volumes wide and gate on
line of sight" brief — that was right for the through-walls bug and is not this.
With the outline behind the debug flag the prompt is the only selection feedback
there is, so it has to mean *this is what you are looking at*.

Half landed: the aim cone's ceiling came down 35.5° -> 15°, median off-axis
10.8° -> 5.2°. The residue is the proximity rule, which ignores aim by design;
see `fp.ts:lookTolerance` and `scripts/D-offer-rate.mjs`.

## The JAIL site — two blockers cleared for O

> *"THE EAST CROSS BUILDING, ct/street.ts:958-968, needs deleting or shortening…
> PUBLISH ctx.site for the jail, the way the other sites are published."*

Routed to **D** (both parts are in `ct/street.ts`, which is D's). O owns
`ct/jail.ts` and `ct/int-jail.ts` and was blocked on both. Landed: the shell is
deleted, and `ctx.site('jail')` publishes
`{ minX: 57, maxX: 75, minZ: -110, maxZ: -96, y: 0.14 }`. See
`notes/D-to-O-jail-site.md`.


## Rent, a landlord, and letters at the mailboxes

> *"rent that must be paid to a landlord, and letters waiting at the mailboxes
> when he comes in off the street"*

Routed to **N** (new builder; owns the new `ct/tenancy.ts`). The desk's ordering:
the letters come FIRST, because they are how he finds out he owes rent.

Followed by, in the same stretch: *"numbered to match the doors upstairs"*.

Landed so far: C's bank of twelve painted doors is real hardware now — 301 has a
bottom-hinged brass door, a keyhole, a name card and post riding out of the slot
when there is any, and all eight let flats carry number plates in C's own door
numerals. The letters open as a sheet held in both thumbs; fourteen kinds of
1997 junk, a rent notice two days before each rent day, a second notice every
third day it goes unpaid. Rent is DERIVED from the clock, never accumulated, so
sleeping through a week fills the box the same way walking through one does.
Guarded by `scripts/N-post-waiting.mjs`. See `notes/N-tenancy.md`.

Still open: the landlord himself, and paying him.


## A cap on the fleet, and a handoff that loses nothing

> *"yea, i actually ran out of usage cause we had like a million builders. lets
> just make sure we doc everything and dont let anything fall through the
> cracks. you'll handoff your work and we'll set a limit on agents going
> forward. probs 5 or less? idk what do you think?"*

**Kept at the desk — no builder was spawned for it, which is the point.**

The sixteen-agent run exhausted the account's usage and every agent died at
once. Answer to the question: **5 is the right ceiling, and the normal shape is
4 — three builders plus one auditor.** The number matters less than the rule
that came with it: *an agent exists only while it holds an item.* When the
fleet died, 11 of the 16 were reporting DONE with empty queues and were still
alive and still burning. The spend was not sixteen agents working, it was
sixteen agents existing.

Written down in three places, and the cap is binding rather than advisory:

- `PARALLEL-WORKFLOW.md` §10 — the ceiling, the per-item lifecycle rule, the
  1-auditor-per-3-builders ratio, and an honest note on what sixteen actually
  bought (not speed — the failure modes scaled with fleet size, not with work).
  §3 and "why start at two" corrected, since the old *"raise it until merging
  lags"* advice is what reached sixteen.
- `CLAUDE.md` and `START-HERE.md` — the cap, and `SESSION-STATE.md` promoted to
  the first thing anyone reads.
- `notes/SESSION-STATE.md` — rewritten as the handoff: every open row with its
  owner, the seven that have **no** owner, everything uncommitted on disk, and
  which of the user's headline requests are genuinely done.

The finding that mattered most while writing it: **nothing was lost.** Both
unlanded commits and all seven dirty files are notes and verification scripts.
No world code is stranded. Every headline request is CONFIRMED except one —
**blackjack, which is built and unreachable for want of a single `ctx.seat()`
call.** That is the eleventh instance of the project's oldest structural bug:
finished work that cannot reach the world because the line that wires it lives
in someone else's file.


## Three asks that were built but never logged here (backfilled 2026-07-30)

Found by auditing every LEDGER row against this file. All three were briefed
straight into a queue file while spawning a builder, bypassing `route.sh` —
GOTCHAS 47, the desk's own direct dispatches go unlogged. **All three were
built and are CONFIRMED**; nothing was lost except the entry in this file,
which is the file the user reads to see whether he was heard.

> *"create a whole interior for the bank. it should be very nice inside."*

Routed to **M**. The bank was facade-only. LEDGER:292, CONFIRMED.

> *"i would like to enter the bank and be able to apply for a loan"*

Routed to **M**. LEDGER:291, CONFIRMED.

> *"looks really bad rn"* — the diner FACADE, not the blade.

Routed to **A**. LEDGER:124, CONFIRMED for the depth treatment.

**Why this matters more than three lines.** This file is the record of the
user's own words; the ledger is the record of work. When a request reaches the
ledger without passing through here, the user loses the ability to see and
reprioritise it — he cannot reprioritise a queue he cannot see. The fix is not
to remember harder: it is to route through `route.sh`, which writes both.


## The green sedan outside the diner

> *"hey can you move this car back just a bit?"*
> (`Screenshot from 2026-08-01 17-50-42.png` — the green sedan on the east kerb,
> seen broadside from the walk by the lamp post, diner and thrift behind it)

**Kept at the desk** — it is `parked[0] = ['sedan', 1, 1, -13]` in
`crosstown.ts`, which is desk-owned, and it is a one-number change. Writing a
brief would cost more than the edit (PARALLEL-WORKFLOW §10).

**The measurement behind the complaint, which is worth keeping:** the parking
lane's snug limit is `PARK_SNUG = 3.93` and a car's half-width is 1.05, so the
snuggest-parked car's body edge sits at **4.98 against a kerb at `ROAD_HALF`
= 5.0 — two centimetres of clearance.** The file's own comment celebrates this
as "collider never on the walk", which is true and is not the same as *looking*
right. At 2 cm the car reads as riding the kerb, which is exactly what the
screenshot shows.

So this is not only a placement nudge; the snug limit itself is drawn tighter
than the eye accepts.

**Answered:** back **along the street**, not off the kerb. Moved `-13` → `-11`,
two metres against a ~4.8 m car — a reverse into the space behind it. Measured:
the sedan's collider went from z −13.97 to −11.97, the other two parked cars
unmoved.

I got the direction wrong on the first attempt and moved it two metres *forward*
before catching it. The east kerb parks facing **south**, and south is −z, so
reversing is +z. Written into the code comment rather than just fixed, because
this is the same sign trap `GOTCHAS` already records for `atan2(nx,nz)`.

The 2 cm kerb clearance noted above is still unaddressed — it was not what he
was asking about, and it is filed rather than folded in.


## A debug mode that shows collision

> *"can we implement a debug mode where i press a toggle to view collision?"*

Routed to a builder. This is the natural companion to the earlier
*"get rid of outline unless debug is true, we'll probably want that for debug"* —
the same debug surface, so it should be one flag and one key, not two schemes.

Worth more than it looks: **the last week's most expensive bugs were all
invisible collision.** Two thirds of the jail site was solid and nobody could
see it; the thrift keeper stood 5 cm inside a wall; a parked-car gap once
trapped the user with *"im literally stuck here"*. Every one of those would have
been obvious at a glance with collider volumes drawn.

**Done.** Press **V** to toggle. Draws every live collider from
`window.__ct.colliders()` as a wireframe box — green, or red where two of them
form a corridor under 0.95 m (the same `trapAgainst()` rule the parked-car draw
is already constrained by) — plus the player's own square collision footprint
in blue. New file, `src/proto/ct/debug-collision.ts`; a bounded exception added
the toggle + one draw call to `crosstown.ts` and exported `RADIUS` from `fp.ts`,
nothing else in either. Off by default and measurably free when off: scene
object count returns to the exact baseline on toggle-off, and
`npm run fp before/after` came back with `textures`/`structure` bit-for-bit
IDENTICAL — a first version that built its geometry at module-import time did
NOT pass that test (GOTCHAS §2/§31: it was quietly burning `Math.random` draws
off the shared seeded stream on every load, whether the key was ever pressed or
not), which is worth remembering next time a debug tool feels free because
nothing is added to the scene. Full writeup: `notes/debug-collision.md`.


## The bank's outer door and its inner door are different doors

> *"door of the bank doesnt match the inner door of the bank"*

**He named the room, and the room proved the measurement wrong.** The desk had
closed *"make the exteriors match the interiors"* the same day at **12 of 12
match**, with a standing invitation on the status board: *"if you still see a
mismatch, name one room — it'll mean I'm measuring the wrong thing."*

He did, and it does. Photographed both faces of the one door:

| | |
|---|---|
| **outside** (`shots/bank-door-out.png`) | a grand **double** door — two dark glass leaves in a **brass** frame, brass vertical push-bars, grey stone surround under FIRST FEDERAL |
| **inside** (`shots/bank-door-in.png`) | a **single brown wooden** door with a small round **knob** and a plain glass upper panel |

Different leaf count, different material, different hardware. Walk through it
and the door changes behind you.

**Why the audit missed it, stated plainly: it measured the wrong axis.** Every
check on this request — `doorside2.mjs`, `doormatch12.mjs`, the twelve-room
table — asks *which SIDE of the frontage the door sits on*, because GOTCHAS 45
told us it did: *"'match the exterior' means WHICH SIDE THE DOOR IS ON, not
dimensions"*, after over-enforcing width cost three rooms their depth.

That reading was right about **dimensions** and wrong to stop there. The user
has never once complained about a door being on the wrong side. What he
notices — five times now — is that **the door does not look like the same
object from both faces**. GOTCHAS 45 needs a second clause.

Routed with the whole class in view, not just the bank: the same question must
be asked of all twelve rooms, since nothing has ever checked it.


## The ATM's two looks do not agree

> *"i hate the look of the atm. i want it to look more like the graphics of the
> atm we already designed"*

**There are two ATMs and they are drawn in different palettes** — photographed
both on build `caa3f18ce`:

| | |
|---|---|
| **the cabinets** on the bank facade (`shots/atm-cabinet.png`) | two charcoal machines, **green** screens, pale keypads, inset in a stone recess |
| **the interface** that opens when you use one (`shots/atm-panel.png`) | a **beige** bezel with an **amber** CRT, numbered side buttons, CARD and CASH slots, FIRST FEDERAL SAVINGS |

Green-on-charcoal versus amber-on-beige. Use the machine and its screen changes
colour, which is the same class of fault he had just caught on the bank door —
one object that does not agree with itself.

**Desk: which one is "the atm we already designed" is a coin toss from the
transcript, so ASK rather than guess.** He praised the facade ATM earlier
(*"i like the atm, maybe add another on the left"*), which argues the cabinets
are the keeper — but "graphics" more naturally describes the 2D interface. A
wrong guess means redoing a design pass, so it is worth one question.


## Collision should fit the objects, and cars should be climbable

> *"i want the collision to be a bit more accurate to the objects. the cars for
> instance. we should be able to jump on the cars"*

**The cause is one line, and it explains the whole request.** `src/proto/fp.ts:9`:

```ts
export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };
```

**There is no Y.** Every collider in this world is a footprint extruded to
infinite height. A car is not a box you can climb onto — it is a wall that
happens to be car-shaped in plan and unbounded upward. Same for the kerb props,
the dumpster, the tyre stacks and the parked fleet.

So *"more accurate to the objects"* and *"jump on the cars"* are one change, not
two: **give a collider a top.** That means `minY`/`maxY` on `AABB`, and a floor
picker that treats a collider's top face as standable when the player is above
it — which is the same job `ct/interior.ts` and `COURT.climbable` already do for
storeys and library steps, so there is prior art in the codebase.

**This is the most dangerous change anyone could make here.** `fp.ts` is the
movement core, it is desk-owned, and the 2 m sidewalk lane is sacred. Every
existing `ctx.obstacle` call must keep behaving exactly as it does now unless it
opts in, or the whole world silently becomes climbable.

**Timing is good:** the collision debug overlay (press **V**) landed hours ago,
so for the first time this is verifiable by looking rather than by walking into
things. It has already earned this — it is how the user found the car-lot
collider gap.


## The library is cramped

> *"things feel cramped in the library. spread things out."*
> (screenshot with the **V** collision overlay on)

**He diagnosed it with the tool that shipped this morning, and the tool agrees
with him.** The overlay draws a collider **red** when `ct/gap.ts`'s own
`trapAgainst()` finds a corridor under 0.95 m against a neighbour — and the
left half of the library reads almost entirely red: the returns desk, the end
stack and the wall shelving are all inside sub-0.95 m of each other.

Note what that means: this is not only a *feel* complaint. **0.95 m is the
project's own trap threshold** — the number `ct/gap.ts` exists to keep the
parked-car draw away from, because a corridor that narrow is one a player can
enter and not leave. The library is full of them.

This is the third time the library has come back — *"library interior is better
but still jank"*, *"make the library interior larger and more ambitious"* — and
the first time there is a measurement behind the word *cramped* instead of an
argument about taste.

The fix is spacing, not deletion: he has asked for the library to be **more**
ambitious, never smaller.

> *"what is this? why is it looking messed up"* (same session, V overlay on)

A second library fault in the same shot: a **brown plinth or lectern carrying a
white printed panel — a newspaper or an open book — sitting at a drunken angle,
its panel clipping through the shelving behind it** and its base intersecting
the floor. It reads as an object whose rotation was set on the wrong axis, or
which was placed against a shelf that has since moved.

**Not routed separately — forwarded to the library agent already in
`int-library.ts`.** Two agents in one file is how a worktree got corrupted and
the live world broke once already (PARALLEL-WORKFLOW §11); the spacing pass and
this fix are the same file and the same walk.

**Answered: the CABINETS are the keeper.** The charcoal bodies with green
screens on the facade stay as they are; **the interface panel gets redrawn in
their palette** instead of its current beige-and-amber. Consistent with his
earlier *"i like the atm, maybe add another on the left"* — the facade machines
were always the design he liked.


## The library's terminals are computers, and they should boot

> *"change this to being computer not terminal. and lets have windows style pc
> we can actually use"*

Two halves, deliberately split so two agents never touch one file:

1. **The word.** `int-library.ts:1261` reads `label: 'sit at the terminal'`.
   *Terminal* is a dumb glass teletype; what is drawn on that desk is plainly a
   beige mid-90s **PC**. Forwarded to the library agent already in that file.
2. **The machine.** A **new module** that opens a Windows-style desktop when you
   sit at one — a real interface, not a prop.

**They join by SEAT LABEL, which is how this codebase already wires panels to
furniture**: `slots.ts` waits for `'sit at the slot'` and `blackjack.ts` for
`'sit at the blackjack table'`. So the label rename and the new panel can be
built in parallel and meet in the middle, with no shared file between them.

The room already earns it — he asked for *"computers in the library"* and got
three handsome beige boxes with nothing behind the glass. This is the same
shape as the slots and blackjack: the cabinet exists, the software does not.


## You cannot open your own front door from the hall

> *"i can't open the door from the outside of my apt?"*

**Real, reproduced, and the existing check could never have caught it.**

`scripts/A-verify-301-door.mjs` passes — *"MEASURED FINE — the door closes and
opens again from the same spot"* — but it only ever tests **one** spot,
`(199.3, −17.45)`. The hall runs **x 200.0 … 202.4**, so that spot is
**inside the flat**. The check proves the door works from the side the player
is already standing on when he spawns.

Measured from the landing, on build `acbe749e2`:

| where | prompt |
|---|---|
| inside the flat | (the flat's own spots) |
| **hall, just outside the door** | **none** |
| **hall, a step back** | **none** |
| **hall, mid-corridor** | **none** |

The `open/close the door` spot sits at **x 199.36**, radius 0.95 — so its reach
stops at x 200.31, barely short of the hall floor, and the closed leaf is solid,
so you cannot walk to it from outside either. **Shut your door behind you and it
cannot be opened again from the landing.**

Same family as the trap bugs this project keeps hitting — the TV seat, the jail
site — a state you can enter and not reverse. Worse here because it is the
player's own home and the one door he uses every day.

**And it is the third check this week that passed by measuring one side of a
two-sided thing** — after `doorside2.mjs` (which measured door *position* while
the user was complaining about door *appearance*) and `bedcavity.mjs` (which
measured a truck that no longer existed).


## Scroll to zoom, with a limit

> *"i want scroll to be zoom. it shouldnt be able to zoom too much though."*

Queued at rank 5. Nothing handles the wheel in the world today — `grep` for
`'wheel'` in `src/` returns only `ct/hud.ts`, and what it does there matters:

- `hud.ts:168` lists `wheel` in `BLOCKED`, the events a panel swallows while it
  is open;
- `hud.ts:359` gives panels their own wheel hook, `p.spec.wheel?.(...)`.

**So the convention already exists and the world half is simply missing.** A
zoom that scrolls the world while the ATM or the slots are open would be a bug,
and `hud.ts` already prevents it for free.

The camera is `new THREE.PerspectiveCamera(88, ...)` at `crosstown.ts:39` — 88°
is a deliberately wide, slightly fish-eyed 1997 look, so **88 must remain the
resting value** and zoom pulls in from it.

*"Shouldn't be able to zoom too much"* is the whole spec: a clamp, and one that
errs tight. This is a first-person street, not a sniper scope.


## Rain appears in one direction down the street and not the other

> *"its raining if i face one direction down the street but not if i face the
> other"*

**Measured, and there is a strong lead.** `ct/props.ts` draws rain as **500
`THREE.Points` in a 30 m box** (`RAIN_BOX = 30`), and the box is kept around the
player by wrapping each drop a whole box-width when it drifts outside:

```ts
rx - RAIN_BOX * Math.round((rx - px) / RAIN_BOX)
```

Two things fall out of that, both consistent with the report:

1. **The wrap only runs inside `if (rain.visible)`.** Probed live: with rain off,
   the drops still span x −14.9…15, z −15…15 — centred on the **world origin**,
   while the player stood at x 198.6. They are only ever re-centred once rain is
   already falling.
2. **±15 m is short against this street.** The camera's far plane is 220 m and
   the block runs ~130 m. Look *across* the street and the whole view is inside
   the rain volume; look *along* it and almost everything you can see is beyond
   the drops. **That is the same view containing rain and not containing rain,
   depending only on which way you turn** — which is exactly what he describes.

Note the comment above that code: the volume used to be pinned to the camera and
was deliberately changed because *"a personal rain cloud you could never walk out
from under"* was worse. **The fix must not simply revert that** — it needs the
volume to cover the sightline without following the head.

I could not reproduce the asymmetry from a screenshot in the time available, so
this is a lead, not a diagnosis. **Reproduce it first.**


## The used-car pole sign has no thickness

> *"used car sign is completely flat"* (screenshot, looking up at it at night)

**Confirmed in source.** `ct/lot.ts:1109` builds the sign as **two
`PlaneGeometry(SIGN_W, SIGN_H)` faces**, one rotated to each side, offset ±0.03 m
from the mast. There is nothing between them: from below, or anywhere near
edge-on, it is a sheet of paper on a pole.

**Why it is built that way, which the fix must respect.** GOTCHAS 10: a
`DoubleSide` plane renders **mirrored** from behind, and a `HOTEL` blade sign
once shipped mirrored because only the E and L gave it away. Back-to-back
single-sided planes are the standing cure for that. **They cure the mirroring and
they do not give the object any depth** — that is the gap the user is seeing.

**Third time this sign has come back**, and the history matters:

1. *"the pole sign looks off — the panel is tiny against an enormous pole and the
   two faces read as skewed rather than flat or back-to-back"*
2. *"carrying FOUR messages stacked … SIMPLIFY TO ONE MESSAGE … CROSSTOWN AUTO,
   big, legible, and stop"* — fixed, the cabinet went landscape
3. now: it has no thickness

A real pole sign is a **cabinet** — a box with returns down its edges, deep
enough to house the lamps that light it. That is the shape to build, keeping the
two artwork faces exactly as they are so nothing mirrors.


## Pews run up to the altar, and the church's doors disagree

> *"why are there pews where the alter is?"*

**Measured — it is 42 centimetres.** In `ct/int-church.ts`:

- the altar sits at `z = -hd + 2.4` and is 0.75 m deep (line 299/309), so its
  back edge is at `-hd + 2.775`;
- the first pew row is laid at `z = -hd + 3.2` (line 192).

**Clearance: 0.425 m.** A church has a *chancel* — several metres of clear floor
in front of the altar, usually raised a step and often railed, because that is
where the service actually happens. Here the congregation's front row is close
enough to rest a hymnbook on the communion table.

The code comment even says the rows are *"laid from the ALTAR end"* — so the
start offset is doing double duty as both "where pews begin" and "how much
sanctuary there is", and 3.2 m from the wall was chosen for the wall, not for
the altar.

> *"inner door of the church does not match outer doors"*

**Same fault he caught on the bank**, and the church is on the known list: the
twelve-room survey found it mismatched on **leaf count (2 outside vs 1 inside),
glazing (none vs glazed) and hardware**. It is one of the six rooms whose cause
is shared — `ct/interior.ts`'s default door leaf ignoring a room's declared
`leaves`/`frame`/`glazing` — and **a fix for exactly that is sitting in a
worker's branch right now, unverified.** So this may already be answered; the
desk verifies before queueing a duplicate.


## The bodega corner's collision is a staircase of rectangles

> *"whats going on with the collision geometry here? we should fix this so its
> not just a bunch of separate rectangles and its just made properly"*

**He is looking at the cost of the collision primitive itself.** `AABB` is
`{ minX, maxX, minZ, maxZ }` — **axis-aligned**. The bodega's door is a 45°
chamfered corner, and an axis-aligned rectangle cannot be a diagonal, so the
diagonal is approximated by a stair of small boxes. Measured live: **13 colliders
around that corner, four of them tiny** — 0.62×0.56, 0.62×0.56, 0.40×0.40 and
0.24×0.16 m.

**Two consequences, and the second one matters for trust in the tools:**

1. It is not "made properly" and never can be while the primitive is
   axis-aligned. Every angled surface in the world pays this.
2. **The red is largely a false alarm.** The overlay paints a box red when
   `ct/gap.ts`'s `trapAgainst()` sees a sub-0.95 m corridor against a neighbour —
   but adjacent boxes forming *one wall* are not a corridor, and here they are
   nearly touching. **The debug view is over-reporting exactly where the geometry
   is worst**, which is the one place a person will look hardest.

**This is the same root cause as the collider-height item**, and he has now
reported it from three directions without being told they are connected:
*"we should be able to jump on the cars"*, *"collision more accurate to the
objects"*, and now the stepped corner. One primitive is too weak: it has no
height and no rotation.

Queued next to that item so they are considered together rather than patched
apart.


## Park benches sit askew to the path

> *"these park benches are askew. they should be in line with the path."*

**Found, and the cause is a subtle one — the last fix was right in principle and
picked the wrong reference.** `ct/park.ts:1030`:

```ts
const facingIn = (bx, bz) => [bx, bz, Math.atan2(loopCx - bx, loopCz - bz)];
```

Every bench points at **the centre of the loop**. That was a deliberate
improvement: the comment above it records that every yaw used to be a hand-typed
literal, that rebuilding the bench silently reversed half of them, and that
GOTCHAS §27 says *derive facing from what the object should FACE, never from a
constant*. All true, and the rule is right.

**But "face the middle" is a radial direction and the path is a straight run.**
A bench is only square to the path when it happens to sit at the exact midpoint
of its side; anywhere else along that side it rotates toward the centre point and
goes visibly off-square. The further from the midpoint, the more askew — which is
exactly what the screenshot shows.

**The fix keeps the principle and changes the reference: derive the yaw from the
path segment the bench stands on** — square to the run, facing the park side.
On a loop that still satisfies the original requirement (*"it looks INTO the
park, and its back is to the fence"*) while also lining up, so nothing is traded
away.

**Fourth time the benches have come back** — *"benches are clipping and tilted"*,
*"benches still tilted and clipping trash"*, *"park bench looks bad and clips the
drinking fountain"*. Each earlier fix was correct about the thing it fixed.


## The jail has open gaps around it — a regression the desk approved

> *"the jail has empty gaps around it. it needs to be fixed. this is game
> breaking"*

**This is mine.** This morning the jail site was found two-thirds unwalkable, and
the fix set the building back 4 m into a forecourt **and cut its depth from 12 m
to 4 m** (`d8987737e`; `JAIL.DEPTH` is now `4.0` at `ct/jail.ts:108`). The site
runs x 57–75, so the building occupies 61–65 and **ten metres of it are now
open** where twelve metres of building used to stand.

**I checked that change and I checked it wrong.** I photographed the jail from
the middle of the side street, head-on, decided it *"still reads as a substantial
four-storey civic building"*, and wrote on the row that *"the depth change is not
perceptible from the street"*. Head-on is the **one** angle where the building's
own face hides its flanks. From any oblique angle you see straight past it into
nothing, which is what his screenshot shows.

That is the same error I have flagged in three instruments this week — a check
that passes because it only looks at one side of a two-sided thing — committed by
me, on the one occasion the guard mattered most, and against a change I had
already identified as risky because the user has said *"all buildings need to be
much deeper other wise it loks like a fake building"*.

**The fix must keep the walkable forecourt and yard that change bought** — the
site really was two-thirds solid before — while closing the flanks. Restoring
depth alone re-creates the original bug.


## Interaction reach is too wide, and the bed beats the door you are standing at

> *"it should be easy to open and close the door. the radius for interaction is
> far too wide. i dont want to be so far from the bed and the option is still to
> sit on the bed and watch tv"*

**Measured.** The bed's spot declares `r 0.7` at (198.3, −16.3); the door's is
`r 0.95` at (199.36, −17.45). But `fp.ts:463` adds **`REACH_MARGIN = 0.6` to
every spot**, so the bed is actually live out to **1.3 m** — nearly double its
declared radius, and from the doorway that is enough to reach him.

**This is the second half of a complaint he already made.** In July: *"i think
the selection options are a bit to wide. i feel like i select stuff without even
looking at it."* The desk's fix then was to narrow the **aim cone**, 35.5° → 15°
(`lookTolerance`, `fp.ts:474`), and the comment there records exactly that. **The
cone was tightened and the reach never was** — so he is now reporting the half
that was left.

**And it is the same bug as his front door**, seen from the other side. Standing
in the doorway looking in, the bed is straight ahead and inside the cone; the
door is at his shoulder and outside it. The hall-side door spot that just landed
does not settle this on its own — **the bed can still out-reach the door from
the very spot where the door is the obvious thing to use.**

Two things worth separating for whoever takes it:

1. **`REACH_MARGIN` is global.** Lowering it touches every interaction in the
   world, which is why it deserves care rather than a quick nudge. Its comment
   claims 0.60 is *"still under half the sacred 2 m walk, so it cannot make two
   spots across a pavement both live"* — true outdoors, and a bedroom is not a
   pavement.
2. **A door you are standing in should beat furniture across the room**, whatever
   the margins are. That is a resolver question, not only a radius one.


## Tax office waiting seats face the wall

> *"seats in the tax office are reversed"*

**Found: `yaw: 0`, typed.** `ct/int-tax.ts:449` places the waiting row at
`WAIT_Z = hd - 0.62` — hard against the far wall — and hands each seat
`yaw: 0`. This world's forward is `(sin yaw, cos yaw)`, so yaw 0 faces **+z**,
which from that wall is *into* it. The backrests face the room and the seats face
the glass.

**Same cause as the askew park benches, in a different file, and the file itself
already knows better.** Line 185 says *"the preparer's FACING is derived from"*
its chair positions — so the desk chairs derive correctly and the waiting row is
the one place a literal survived. GOTCHAS §27: *derive facing from what the
object should FACE, never from a constant.*

That is now **five** facing bugs from typed or wrongly-referenced yaws: the
burger barn guy facing away, the librarian, the casino sitter clipping his seat,
the park benches pointing at the loop centre, and this. The rule exists; the
enforcement does not.

**Worth a check, not just a fix:** something should fail when a seat's facing
puts a wall in front of it. `interiors-walk.mjs` already asserts *"the keeper is
looking at you, not away"* for shop staff — the same idea applied to seats would
have caught all five.

> *"this door is making it a little too cramped in the back of the library"*

An open door leaf standing proud into the rear aisle, with the stacks opposite —
his own overlay paints the pinch red, i.e. under the 0.95 m trap threshold.
Queued as its own item: the library spacing pass had already been released by
its worker when this arrived, so there is no longer a conflict in that file. It
must be checked **together with** that pass — a spacing fix that ignores a door
leaf swinging into the aisle has not fixed the aisle.

Note this is the *third* distinct fault he has found in that one room tonight —
the cramped stacks, the tilted lectern, and now the door. All were invisible
until the collision overlay shipped this morning.


## Yellow centre line runs straight through the crossing

> *"remove the yellow stripes where the cross walk is. it doesnt look right."*

**He is right and it is a real-world rule, not just taste:** a road's centre line
stops short of a pedestrian crossing. Ours does not — the yellow dashes run
straight over the zebra, so two sets of markings occupy the same asphalt.

**Cause is structural, not a bad coordinate.** `crosstown.ts:73` draws the centre
line as **one plane the whole length of the street** with a repeating dash
texture:

```ts
const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 36 - SIDE_Z0), …);
lineT.repeat.set(1, 38);
```

One mesh, one texture, no knowledge of anything else on the road. It cannot stop
at a crossing because nothing tells it a crossing exists — the crossings are
painted into the ground in `ct/tex-ground.ts`, a different file with a different
owner.

So the fix is to **break the line into segments that stop short of each
crossing**, and to derive those gaps from wherever the crossings are actually
defined rather than typing z values — a hand-typed gap silently stops matching
the moment a crossing moves, which is precisely the class of rot that has cost
this project four instruments this week.


## No pop-up menus — every interface must be diegetic

> *"for all the interactable areas (atm, slot machine, cards, etc.) i dont want a
> dialog to pop up i simply want to sit down and have the game happen in front of
> me. maybe we lock the view once we sit and we create a table view/slot view/atm
> view thats actually a fixed dialog but to the player it just looks like its
> actually the game still. the point is i never want there to be menus popping up
> unless they are embedded to look as if they are in the actual game. i dont want
> to break immersion. so this also applies for inventory."*

**This is a standing design law, not a feature request**, and it retires the
pattern every interface in this world currently uses. `ct/hud.ts`'s `makePanel`
draws a floating bezel — beige or charcoal chrome, a title bar, an `ESC` hint —
centred over the screen. That reads as a *dialog over a game*. He wants the
opposite: the machine's own screen, seen from the chair.

**He has already conceded the implementation**, which makes this far cheaper than
it sounds: *"actually a fixed dialog but to the player it just looks like its
actually the game."* So the panel machinery survives. What changes is that
sitting down **locks the camera to a fixed view of the object**, and the panel is
drawn to sit exactly where that object's screen is — no chrome, no title bar, no
floating box. The illusion only has to hold from one known camera position, which
is the whole reason locking the view makes it tractable.

**Applies to:** the ATM, the slot machine, blackjack, the inventory, and the
library PC that landed tonight. The TV already works this way — you sit on the
bed and watch it in the world — so **the TV is the worked example of what he
wants**, and the others are the exceptions.

**The rule that must not be broken while doing it.** `hud.ts` blocks keydown
while a panel is open, and the user was once trapped in a TV seat: *"no im
telling you i can't get up anything i do once i sit down."* **Locking the camera
adds a second way to trap someone.** Escape must leave, standing must leave, and
both must be proven from inside every one of these views.

**Timing matters:** every new panel built before this lands is more to convert.
The library PC shipped tonight with a floating panel, so this should be settled
before the next interface is drawn.


## Remove the on-screen HUD text

> *"get rid of the overlay descriptions here, controlls and all."*

The bottom-left block — `CROSSTOWN '97 1/1`, *"The small world — one hand-made
street. We grow it from here."*, and the controls strip (`click to look · WASD
walk · Shift run · C crouch · Space jump · E feed · look down = watch ·
right-click = wallet`).

**This is the same law as the no-pop-up-menus request, one line lower down:**
nothing on screen that is not in the world. A title card and a keyboard legend
are the most literal possible break of it.

Keep the `[E]` interaction prompt — that is how the world tells you a thing can
be used, and he has never objected to it. The controls legend is a tutorial that
has outlived its purpose.


## The shadow geometry is still there — and it was never actually closed

> *"what is with these shadow geometries. they're all over the place and i need
> you to get rid of them"*

**He is right, and the record shows it was known.** Yesterday the desk marked
three shadow-geometry rows CONFIRMED after an auditor re-walked them, and I
verified that verdict — **at one location, the civic forecourt.** His screenshot
is a different frontage and the defect is unmistakable: large translucent grey
quads lying across the pavement, the shopfront glazing and the planter.

**The audit's own note said the class was not closed.** In
`notes/AUDIT-shadow-geometry.md`: *"a live scan of this build found 131
untextured ground meshes (~1092 m²) remaining"*, and it named the surviving
instances — the car-lot bays and *"~92 untextured interior floor meshes"*. **Only
the four originally-named spots were ever fixed.** The three rows were true about
those four spots and the desk let them stand for the whole complaint.

**That is the same error I made on the jail**, twice in two days: verify one
instance, retire the class.

**Mechanism, already documented** in `ct/paint.ts:50-93`: a ground mesh with **no
map** sitting beside grained neighbours reads as a translucent shadow patch.
Nothing in this street casts real shadows — it is unlit `MeshBasicMaterial`.
The cure is `slabTex`/`plazaTex`/`apronTex`, already proven at several sites.

**So this is not a hunt. It is a census with a known fix:** find every unmapped
ground-facing mesh and give it a texture. He has now reported it four times.


## Sit at the foot of the bed, not the middle

> *"sitting on the bed should have a perspective more from the foot of the bed.
> please change"*

**Done at the desk** — one number in `ct/apartment.ts`, small enough that a brief
would have cost more than the edit.

The bed itself says which end is which: the dented pillow sits at x −2.86 and the
frame spans −3.05 … −1.15, so the **head is −x and the foot is +x**. The seat was
at x −2.10 — the frame's own centre, level with your pillow — and, more to the
point, **off to one side of the television**, whose cabinet stands at x −1.56.
So the old view watched the set at an angle across the mattress.

The seat now reads **`TV_X`**, the set's own centre line as declared where the
cabinet is built, rather than a copy of it. Move the television and the seat
follows. (A hand-typed second number is what left `bedcavity.mjs` measuring a
truck that no longer existed and `doorside2.mjs` failing a door that was fine —
GOTCHAS 58.)

Measured: the spot moved x 198.30 → 198.84. Looked at it from the seat — the TV
is now square in the middle of the view with the poster above it, instead of off
to one side.

- **"i dont want sit on bed and watch tv to be the main option if im facing the door to leave"**
  (2026-08-02) → **routed to a builder as queue item 85, top of the queue.**
  Direct consequence of `fa5c32e01` (item 0b), which the desk approved: `pickSpot`
  now tracks `bestNear` and `bestLooked` as two tiers with near winning outright.
  That fixed the user's earlier *"i dont want to be so far from the bed and the
  option is still to sit on the bed"* and created its mirror image. The two
  complaints are the same knob at opposite ends, so the fix has to satisfy both
  at once rather than swing back.

- **"[screenshot] this doesnt look integrated. i want when i hit e here to adjust my
  position and perspective and lock it to be looking at the atm and for the screen on
  the literal atm be the overlay that i can use my mouse to click through. the mouse
  cursor should be like a lil hand almost like win98 cursor"** (2026-08-02)
  → **routed to a builder as queue item 86, top of the queue.**
  This is the concrete form of the standing design law the user gave on 2026-08-01:
  *"i never want there to be menus popping up unless they are embedded to look as if
  they are in the actual game. i dont want to break immersion."* Item 0c removed the
  panel CHROME; this removes the panel. The ATM is the template — slots, blackjack and
  the library PC follow the same pattern once it works.

- **"also not all car and object collidable boxes are consistent. some cars have full
  height others are aligned with the vehicle. i love the car with the trailer thing btw
  keep that tysm"** (2026-08-02) → **routed to a builder as queue item 87.**
  Correct, and a direct consequence of staging: the collider-height work deliberately
  converted ONE object (the pickup) and later the sedan+trailer, leaving every other
  vehicle as a full-height wall. The staging was right — it is why the change was safe —
  but the half-converted state is now visible to the player. **The trailer is explicitly
  KEEP: the user named it.**

- **"[screenshot] bench is a lil too close to the path. also the path looks awful"**
  (2026-08-02) → **routed to a builder as queue items 88 (bench spacing) and 89 (the
  path's look).** Split because they are different work: one is a measurable clearance,
  the other is a look the user has now rejected twice. `ct/park.ts:120` already records
  the bench as **0.36 m out onto the walk**, so the encroachment was known and
  under-weighted. The path was reworked once before, after *"THE PATHS READ AS ROAD"*
  (`ct/park.ts:31-43`) — this is the second rejection of it.

- **"[screenshot] look at this path corner it looks so messed up"** (2026-08-02)
  → **routed to a builder as queue item 90.** Same park frame as items 88/89; the
  corner is drawn separately (`ct/park.ts:307-328`, a rotated 0.3 m patch per turn)
  so it is its own defect, not the surface. Third park complaint in one sitting.

- **"[screenshot] what is this floating thing in the church?"** (2026-08-02)
  → **routed to a builder as queue item 91.** It is the painted statue that is
  supposed to sit on a bracket above the votive stand (`ct/int-church.ts:651, 683`).
  The statue reads; the bracket does not, so it floats against the wall.

- **"[screenshot] would love more detail here, also the window is misaligned?"**
  (2026-08-02) → **routed to a builder as queue item 92.** The east wall of the church:
  a large blank plaster field with the rose window high, the crucifix below it and the
  sanctuary lamp to the right. `ct/int-church.ts:744` says the window belongs "at
  centre" — in the frame it is visibly off the crucifix's axis, so one of the two is
  wrong. Fifth report of this sitting; the desk is at its 5-agent cap, so this is
  queued rather than spawned.

- **"[screenshot] this guy is sat in the pew but is clipping the pew geometry.
  additionally if you sit in his pew you sit where he sits and that just breaks
  immersion."** (2026-08-02) → **routed as queue items 93 (the clip) and 94 (seat
  occupancy, a framework gap).** Split because the second is not a church bug: the desk
  grepped the whole world and **no seat anywhere knows whether it is occupied** — there
  is no `occupied`/`taken`/`reserved` concept at all. The casino stools carry seated
  NPCs on the same terms, so the collision is waiting there too. Sixth report this
  sitting; queued rather than spawned, fleet at its 5-agent cap.

- **"[screenshot] lighting needs a full refactor. it isnt consistent anywhere. this is a
  prime example. the lighting only affects the street but not the sidewalk. it doesnt
  affect the car at all."** (2026-08-02) → **routed as queue item 95, top of the queue,
  and it is the largest item on the board.** The desk measured the cause: the world is
  unlit (671 `MeshBasicMaterial` uses, no real lights) and lamplight is faked by tinting
  materials that **opt in** to a registry — and there are **several private registries**
  (`ct/sidestreet.ts` `lampHeads`, `ct/traffic.ts`, `ct/crowd.ts`, `ct/vice.ts`'s `lit()`),
  not one. Anything that never registered is never lit. So the inconsistency is
  structural, exactly as he says, and not a list of oversights to patch.

- **"[screenshot] hotel interior is strange. needs some work"** (2026-08-02)
  → **routed as queue item 96.** Eighth report this sitting. Deliberately vague from the
  user, so the item names what the desk can SEE in the frame without claiming a verdict:
  a near-black ceiling against saturated red walls; a very busy carpet; teal/lavender
  lobby chairs against the red; the clerk reading as a head with no body behind the
  counter; and the sign over the far door looking MIRRORED — which `ct/int-hotel.ts:259`
  records as a fault that has already happened once in this exact file.

- **"[screenshot] sevens casino front looks so messed up. take influence from vegas
  thanks."** (2026-08-02) → **routed as queue item 97.** Ninth report this sitting, and
  the THIRD user complaint about this same facade — `ct/vice.ts:117` records "the blur
  the user reported on the marquee" and `:141` records *"the LEFT leaf is reversed"*.
  Concrete defects visible in the frame: **SEVENS is clipped at both ends** (reads
  "EVEN"), the marquee's second line is clipped (**"$1 BLACKJA"**), and a black vertical
  bar floats over the left edge of the facade. Plus the standing direction: Vegas.

- **"when i try to enter the casino there's like a distance far away i can enter (i dont
  like this), then a distance i can't enter, then when im at the door i can enter again.
  make sure we review these things. this just seems messy and idk how you are missing
  this sort of stuff"** (2026-08-02) → **routed as queue items 98 (the bug) and 99 (the
  instrument that would have caught it).**
  **Why it was missed, plainly:** every check in this project **warps to a coordinate
  and presses E**. `scripts/interiors-walk.mjs` alone has 13 `warp()` calls. Nothing
  ever walks an approach and watches the prompt continuously, so a discontinuous prompt
  band — offered, not offered, offered — cannot be seen by any instrument we own. A
  builder hit the same class last night: a check that warped had never once tested the
  thing it was named for.

- **"[screenshot] slots similarly need to be embedded into the game like i mentioned
  with the atm. fixed perspective. embedded interactable overlay to make it look
  realistic and immersion forward."** (2026-08-02) → **routed as queue item 100, which
  DEPENDS on item 86 (the ATM) and must not be started before it.** The user is
  confirming the pattern is general, which is exactly why 86 was scoped to build the
  mechanism into the framework rather than into `ct/atm.ts`. Item 100 is the second
  application of it; blackjack and the library PC are the third and fourth.

- **"[screenshot] when folks sit, they clip, fix this"** (2026-08-02, casino slot stool)
  → **folded into queue item 93, which was widened from the church pew to EVERY seated
  sprite in the world.** Second sighting of the same class: the desk had already written,
  when queueing the church one, that "the casino stools carry seated NPCs on the same
  terms, so the collision is waiting there too". It was. Not filed as a new item —
  splitting one job across two rows has already cost this session two duplicate-work
  incidents.

- **"[screenshot] you can remove the craps table. too complicated. lets develop the
  roulette table though. maybe a big wheel you can spin too would be fun"** (2026-08-02)
  → **routed as items 101 (remove craps), 102 (develop roulette) and 103 (the big
  wheel).** Note craps is referenced in **7 files** including `L-blackjack-reachable.mjs`
  and `L-games-in-artifact.mjs`, so removal is not just deleting a table. Roulette
  already has five walkable approaches (w15's work) — 102 builds the game on top of
  that, and should use the diegetic framework from item 86 rather than a DOM panel.

- **"[screenshot] front door of jail graphics are messed up"** (2026-08-02)
  → **routed as queue item 104.** Diagonal hatching across the door panels that does not
  match the panelling, and the two leaves do not align. Note `d3770c506` re-sized every
  jail MASONRY face's texture to the face it sits on last night (a texture painted for
  4 m had been stretched over a 14 m wall) — the door is a different system (`ct/doors.ts`
  declaration + the shared kit leaf) and may simply not have been reached by that fix.
  The frame is also very dark, which is item 95 (lighting), not this.

- **"[screenshot] jail interior front door also looks bad and doesnt match outside"**
  (2026-08-02) → **routed as queue item 105.** THIRD building with this exact complaint:
  *"door of the bank doesnt match the inner door of the bank"* and *"inner door of the
  church does not match outer doors"* both preceded it. There is a `doormatch12.mjs` and
  a CONFIRMED ledger row claiming exteriors match interiors 12 of 12 — **so the check
  says match while the user keeps seeing mismatches.** That is the more valuable half.

- **"[screenshot] bench texture is off and sitting looks nonsensical"** (2026-08-02,
  jail interior bench) → **sitting folded into item 93 (now its THIRD sighting: church
  pew, casino stool, jail bench); the bench TEXTURE queued as item 106.**

- **"[screenshot] interior jail textures look off. again why aren't we catching these?
  what's causing them and do we need to set a rule against them so they aren't
  created?"** (2026-08-02) → **answered with numbers and routed as item 107 (the
  world-wide sweep) plus a new standing rule in BUILDER-BRIEF §7b.**
  **Why we are not catching them:** the density checker (`scripts/masonry.mjs`) only
  sweeps faces tagged `userData.masonry`. Pillars, doors, benches and floor tiles are not
  masonry, so nothing checks them. **343 texture creations exist against 267 density
  declarations** — ~76 textured surfaces never declare a density at all, so there is
  nothing to compare them against. And `masonry.mjs:22` records an earlier version
  reporting "42 of 109 masonry faces as wrong when none were", which biased it toward
  silence. **The cause:** a texture's repeat accepted as a default or typed by hand
  instead of derived from the face it lands on.

- **"[screenshot] mug looks messed up"** (2026-08-02, the flat 301 windowsill)
  → **routed as queue item 108.** Reads as a white blob on the sill — the handle does not
  separate from the body at player distance, and it sits proud of the sill edge.

- **"doors in apt are flush with wall on every floor except my floor"** (2026-08-02)
  → **routed as queue item 109.** Correct, and structural: `ct/apartment.ts` special-cases
  301 throughout — `:249` "DOOR_GAP is the real hole in the west wall that 301's doorway
  is cut", `:264` "301's doorway only opens on floor 3", `:585` "West wall leaves 301's
  doorway gap on floor 3". So 301 gets a cut opening with jambs and a reveal (`:506`);
  the other seven flats get a leaf on an uncut wall. Same shape as the vehicle-collider
  report (item 87): the thing the player uses got the real treatment and its siblings
  did not.

- **"[screenshot] can we move the watch arm thing as a whole over to the left a little
  bit?"** (2026-08-02) → **done by the desk directly, not queued.** One number:
  `ct/hud.ts:740` `left: calc(52% + 77px)` → `calc(46% + 77px)`. The whole arm moves
  because the cuff, strap and face all live inside `watchWrap`. Told the user the exact
  figure so he can ask for more or less rather than another screenshot round-trip.

- **"[screenshot] rain seems extra intense now. thats fine but i want a drizzle to also
  exist and be more likely than the downpour featured here"** (2026-08-02)
  → **routed as queue item 110, top of the queue.** Cause found exactly:
  `ct/props.ts:251` `stormAt(h) = 0.62 + 0.38 * uniform` — range **0.62–1.00, uniform**,
  so the weakest storm in the world is already 62% strength and drizzle cannot occur.
  The 0.62 floor was put there deliberately to answer his PREVIOUS complaint that rain
  was too faint (`:249-250`). **Third knob today with a user complaint at both ends**,
  after the bed/door prompt and the interaction reach — so the fix must satisfy both,
  not swing back.

- **"[screenshot] for the watch i would like the rest of the arm (to the left) rendered
  as well. should be simple. just a continuation of the arm"** (2026-08-02)
  → **routed as queue item 111, top of the queue.** Not done at the desk despite being
  small: the forearm already runs to the left edge OF ITS OWN CANVAS (`fillRect(0, 6,
  104, 66)`), so extending it means widening the canvas — and the wrap is centred with
  `translateX(-50%)`, so a wider canvas shifts the watch face RIGHT (undoing the move he
  just asked for) and shrinks every pixel unless the fixed `width:484px` scales with it.
  Three coupled numbers and a result the desk cannot see without running it.

- **"when i jump off of stuff i teleport straight down. please fix this"** (2026-08-02)
  → **routed as queue item 112, top of the queue.** A regression from the collider-height
  work: before it, nothing could be stood on, so nothing could be stepped off. Cause
  located: `fp.ts:553` `airY = Math.max(0, airY + vy*dt)` — `airY` is height above THE
  GROUND, and world Y is `groundY(x,z) + airY`. Standing on a roof, the ground IS the
  roof and `airY` is 0; step off and `groundY` returns the street in the same frame, so
  the player arrives at street level instantly. Second effect: `:549` gates jumping on
  `airY === 0`, which is true the instant you step off — so stepping off a car also
  hands back a fresh jump in mid-air.

- **"[screenshot] fix the wheel on this cheap car"** (2026-08-02, the $695 hatch on the
  used-car lot) → **routed as queue item 113.** The near-front wheel reads as a large
  dark shape displaced forward and down, detached from the arch. Checked first whether it
  was deliberate: `ct/lot.ts:1596` defines the treatments as `soap | burst | card | slip |
  sold | bare` — all **windscreen** effects — so there is no "up on blocks" concept and
  this is not intentional. The car is `{ kind: 'hatch', col: 5, price: '$695', treat:
  'soap' }` at `:1612`.

- **"[screenshot] shadow fence still here. shadow geometry in general needs to be
  removed"** (2026-08-02) → **routed as queue item 114, top of the queue. FIFTH report of
  this class.** Why "still": the previous fix (`2d3eba3f7`) was explicitly scoped to
  *"4 real GROUND-QUAD defects"*. The plane in this frame is **vertical** — a translucent
  sheet crossing the pavement — which that audit never covered. Strong lead for why they
  read as ghosts: `ct/lot.ts:159` records that `props.ts`'s `dimWorld` **skips any
  material with `transparent: true`**, so translucent planes stay bright while the world
  around them dims. There are **68** `transparent: true` materials in `ct/`.

- **"library is crowded in some areas and spacious in others. try a different layout
  thanks"** (2026-08-02) → **routed as queue item 115.** Note the history: the library
  has already had a spacing pass ("things feel cramped in the library. spread things
  out.") and four separate trap-gap fixes. This asks for a LAYOUT, not another widening.

- **"give people umbrellas if they're out walking and it rains"** (2026-08-02)
  → **routed as queue item 116.** New feature. Ties to the weather work: `stormAt` is
  published on `scene.userData` and item 110 is making drizzle vs downpour distinct, so
  an umbrella has a natural threshold to key off.

- **"make zoom a little stronger"** (2026-08-02) → **done by the desk directly, not
  queued.** `crosstown.ts:49` `FOV_MIN` 64 → 52, so the pull-in range goes 24° → 36°.
  The original spec was *"it shouldnt be able to zoom too much though"* and the code
  comment says it *"errs tight rather than guessing wide and walking it back"* — this is
  that walk-back, invited by its own author. `FOV_STEP` stays 3, so the extra range is
  four more notches rather than coarser ones.

- **"make the ads on the tv actually representative of the businesses we created thus far
  a lot of these ads are pretty good, but they need the business in reference. also i like
  the video hut ad so please add a video hut business ty"** (2026-08-02)
  → **routed as items 117 (point the ads at real businesses) and 118 (build VIDEO HUT).**
  Measured: the ad roster in `ct/apartment.ts:~2440` already carries real ones (pawn,
  bodega, BURGER BARN, the bank loan) alongside inventions with nothing behind them
  (SLICE O MATIC, MIRACLE MOP, HAIR IN A CAN, AB BLASTER 3000, CARPET BARN, the psychic
  line, VIDEO HUT). Meanwhile **casino, diner, hotel, library, thrift and tax have no ad
  at all.** The user's instinct is exactly right and cuts both ways.

- **"ads play too fast too. slow it down a bit"** (2026-08-02) → **done by the desk
  directly.** `ct/apartment.ts` gains `TV_PACE = 1.4`, applied at both places `tvLeft` is
  set. One multiplier rather than editing 20 `secs` values, because the RELATIVE lengths
  are the writing — a price card is meant to be shorter than a five-line list — and this
  preserves that shape. A 3.0 s card becomes 4.2 s; the 5.6 s bodega list becomes 7.8 s.

- **"add a vcr player to the tv we have. also make sure the top of the ad isn't getting
  cut off by the tv. we can reduce the bezel a little bit."** (2026-08-02)
  → **routed as items 119 (the ad being clipped by the bezel) and 120 (the VCR).** The
  bezel was itself a user request — `ct/apartment.ts:2494` records *"give the tv a
  bezel"* and `:2507` a follow-up on its colour — so this is a third pass on it and the
  file already warns *"the bezel must frame the glow, not swallow it"*.

- **"its fine if the diner seat isnt reachable from one side. just make sure geometries
  allow for access"** (2026-08-02) → **a RULING on the item-85 trade-off, written into
  item 126.** He accepts the new look-preference behaviour; the acceptance becomes
  *reachable from somewhere*, not *reachable from everywhere*. Consequence the desk
  flagged into the row: `seats-walk` stations the player at **yaw 0**, one fixed pose per
  seat, so under this ruling it is asking the wrong question — some of the 12 lost seats
  may be the check measuring something he has just said he does not care about. Suspect
  the check before the world.

- **"i get awful performance drops in my room not sure why. can we also get an fps
  counter?"** (2026-08-02) → **FPS counter done by the desk directly (press F); the
  performance drop queued as item 128.** The counter is toggled, not pinned — he had the
  standing HUD text removed, so a number nailed to a corner forever is that complaint in
  a new coat. It reports the **worst frame in the window** alongside the mean, because
  his report is about *drops* and a mean hides those. Lead for 128: the TV in 301
  repaints its whole canvas and re-uploads the texture **9 times a second**
  (`ct/apartment.ts:2683`, `tvRedraw = 0.11`).

- **"scroll wheel needs to be more effective? i need to scroll way too much to get zoom
  moving. i want it to be much more sensitive"** (2026-08-02) → **done by the desk
  directly.** `FOV_STEP` 3 → 7, so the full 36° range is about five notches instead of
  twelve. **Partly the desk's own doing:** widening `FOV_MIN` 64 → 52 one message earlier
  answered his complaint about zoom *reach* while making the *effort* worse — range and
  step are coupled and only one was changed. Recorded in the source so the pair stays
  together next time.

- **"[screenshot] casino sign still a lil janky. maybe we get rid of the one on the side
  here? add more flair to the bulbs themselves instead?"** (2026-08-02)
  → **routed as queue item 132.** Follow-up to item 97, which he can now read: SEVENS and
  the marquee are legible. The remaining object is the **vertical blade** ("SEVENS" set
  vertically). Note the interaction: item 97 gave that blade a lit leading edge (it was
  the "black bar"), and **item 121 is queued to give HOTEL ORPHEUS the same treatment** —
  if the SEVENS blade goes, 121 needs re-deciding rather than cancelling, since ORPHEUS
  is a different building and he has not commented on it.

- **"[screenshot] fix the wheels on the trailer"** (2026-08-02) → **folded into item 113,
  widened from the $695 hatch to "displaced wheels, world-wide".** Second sighting of the
  same shape: a dark blob detached from the vehicle. Note the trailer is NEW — built
  today in `crosstown.ts:1060+` for the sedan climbing route — and its wheels are
  constructed there, not in `ct/cars.ts` with the fleet's. So this may be one cause or
  two; the item now says to establish which before fixing either.

- **"the atm interface is so good. but the mouse cursor is a bit misaligned. like the
  stick part of the cursor."** (2026-08-02) → **routed as queue item 133.** Praise for
  item 86 noted. The cursors are 16×16 pixel art at 2× scale with hotspots declared
  separately (`ct/hud.ts:555-558`): arrow `0 0` "the point", hand `9 0` "the fingertip".
  A declared hotspot that disagrees with where the art puts that feature is exactly a
  "misaligned" cursor. The arrow's tail also steps diagonally x4→x8 across rows 11–15 and
  wants checking against the head.

- **"i think just make all drops falls then we can work back from there."** (2026-08-02)
  → **RULING on item 130, which was the only thing blocked on the user.** No threshold:
  every drop becomes a fall, kerbs included. The desk added one engineering note — put
  the threshold in as a **named constant set to 0** rather than hard-coding it, because
  *"work back from there"* means he expects to tune it by feel and that must be one
  number, not a re-implementation. Flagged the stairs as the risk: a staircase is a
  sequence of small drops and could become a bouncing descent.

- **"its weird it feels like my mouse doesnt work right in my room??"** (2026-08-02)
  → **routed as queue item 134, TOP — a live regression from today's diegetic ATM work.**
  Desk diagnosis: `ct/hud.ts:931` calls `document.exitPointerLock()` when a diegetic
  panel opens (correct — a locked pointer reports no `clientX/clientY`, which is the bug
  that made the first ATM click freeze the cursor). But **the ONLY `requestPointerLock`
  in the codebase is `main.ts:32`, on click** — nothing restores the lock when the panel
  closes. So after using the ATM the player is left unlocked, mouse-look degrades to the
  drag-to-look fallback, and it persists until he happens to click. Not room-specific;
  the room is just where he ended up.

- **"no so its not on the atm the atm works great. its in the room. my room. its not on
  click either"** (2026-08-02) → **the desk's pointer-lock diagnosis was WRONG; item 134
  retired and the report folded into item 128.** Checked afterwards: nothing in
  `ct/apartment.ts` touches camera, pitch, yaw or mouse, so the room does not override
  look. Working hypothesis, his to confirm: **the mouse complaint and the performance
  complaint are one bug** — mouse-look is sampled once per rendered frame, so long frames
  turn the camera in jumps, which feels like a broken mouse in exactly the room where he
  already reported drops. That is now the second desk diagnosis disproved on this one
  report; both are written into item 128 so nobody repeats them.

- **"its like my mouse moves slower when im looking into my room from the hall"**
  (2026-08-02) → **routed as queue item 135, TOP. This detail cracked it.** *Slower*, not
  choppier, means input is being DISCARDED. Traced: `main.ts:47-50` accumulates
  `movementX/Y` correctly, `fp.ts:459` applies the full delta with no per-frame clamp,
  and `main.ts:113` resets once per frame — all sound. **What is missing is
  `getCoalescedEvents()`.** Browsers merge multiple physical mouse samples into one
  `mousemove` and align delivery to the frame; the merged samples are only recoverable
  through that API, which the project never calls. Long frames → fewer events → less
  accumulated delta → the camera turns less for the same hand movement. Explains why it
  is worst *looking into* the room rather than standing in it.

- **"still feels weird to look around at the door frame to my room. idk what changed but
  it seems like a recent change. not on click behavior or anything. its just from looking
  around"** (2026-08-02) → **routed as queue item 140, TOP.** Desk's leading suspect is
  item 85 (the pickSpot facing gate, landed today): before it, the nearest spot won
  outright so the prompt was STABLE while turning; now turning changes which tier wins —
  and 301's doorway is the worst place in the world for that, with the bed seat, door
  spot and sleep spot all overlapping (1.27 m apart, touch circles 0.85 m and 1.10 m,
  measured by w40). NOT the perf fix: `canSee` is yaw-independent and deliberately not
  keyed on yaw, so turning cannot change its answers.

- **"yea facing the window in my room makes the game feel slow. like my mouse moving
  across the screen feels like it drags"** (2026-08-02) → **routed as queue item 141,
  TOP. This is almost certainly THE cause, and it is not what item 128 fixed.** Desk
  measured: **there is no interior/exterior culling anywhere in this project** — nothing
  is ever hidden for being indoors, and the only culling is three.js's default frustum
  test. So facing the window puts the whole exterior inside the frustum and it draws
  THROUGH the aperture: every building, citizen and raindrop. Facing away, the exterior
  falls outside the frustum and costs nothing. Explains every version of his report
  including "looking into my room from the hall" — the window is in view from there too.
  **Item 128 (the [E] raycast, 7,832 tests/frame) was real and worth fixing, but it was
  not the thing he is feeling.**

- **"instead of getting out of the atm view or the slots or literally whatever. instread
  of using esc for that lets make it e"** (2026-08-02) → **routed as queue item 143.**
  Applies to every machine — ATM, slots, blackjack, library PC — so it belongs in the
  panel framework, not per-machine.

- **"nah i havent noticed the mouse dragging anywhere else"** (2026-08-02)
  → **item 135 (getCoalescedEvents) DEMOTED, not closed.** The drag was a symptom of the
  long frames in 301, and item 141 removed those (4,012 draw calls → 182). The
  coalescing bug is REAL — the browser merges mouse samples during long frames and the
  project never recovers them — but it now has no observable effect, so it drops below
  everything the user has actually reported. Kept because any future long frame
  resurfaces it.

- **"for the atm why do we not use the number button at the bottom?"** (2026-08-02)
  → **item 123 promoted to the top of the queue on his eye.** Answer: the 12-key pad is
  drawn by `ct/bank.ts` (it is the cabinet, not the ATM software) with its layout as
  literals inside a closure, so the diegetic work could not hit-test it and drew a PIN
  pad on the CRT as a stand-in — flagged at the time rather than hidden. The obvious fix
  closes an import cycle (`ct/bank.ts:8` imports `openAtm` from `ct/atm.ts`), which
  GOTCHAS 28 records as silently dropping a module **from the built bundle only**: dev
  perfect, ATM absent from the published artifact. Needs a third module.

- **"take card from atm should immediately get us out of the menu"** (2026-08-02)
  → **done by the desk directly.** `ct/atm.ts` — TAKE CARD used to `go('thanks')`, and
  the close for that screen lives inside the KEY HANDLER, so the machine sat on THANK YOU
  until you pressed another key. It now resets to idle and closes on the spot. Left the
  now-dead `thanks` screen queued as item 144 rather than deleting it blind.

- **"slots overlay is not embedded like atm? is it still in flight? its been a while"**
  (2026-08-02) → **it was NOT in flight. Desk error: item 100 was correctly gated on item
  86 landing, the gate cleared hours ago, and the desk never promoted it — it sat 21st
  while every later report was ranked above it.** Now top of the queue with the framework
  seam guide cited.

- **"church could be darker"** (2026-08-02) → **routed as queue item 145.**

- **"inside door of the church is still mismatched from the doors outside"** (2026-08-02)
  → **folded into item 105 as the decisive evidence.** THIRD door-match report (bank,
  church, jail) and the SECOND on this door. Desk found why the earlier "fix" did not
  take: `db8322269` hoisted `CHURCH_FACE` so five literals agreed about **where the door
  is** — it never touched what the leaf **looks like**. And `scripts/doormatch12.mjs`
  references the church five times, so the check covers it and passes. **The check
  verifies POSITION and reports a match; the user is judging APPEARANCE.** That is the
  whole class, and it is why he keeps seeing what our checks cannot.

- **"[screenshot] the mug is messed up"** (2026-08-02, close-up) → **SECOND report; item
  108 promoted to the top with the cause found.** `ct/apartment.ts:1906-1912`: the body
  `CylinderGeometry(0.038, 0.034, 0.095, 8)` and the handle `TorusGeometry(0.026, 0.008,
  4, 8)` **share one material** (`mugM`, `0xd8d2c4`) — identical colour, so nothing
  separates them and it reads as one blob. The handle's **4 radial segments** make a
  square ring rather than a curve. It IS correctly rotated (`rotation.y = PI/2`), so
  orientation is not the fault.

- **"[screenshot] fix this chair"** (2026-08-02) → **routed as queue item 146.** Back
  panel appears to float above the seat with a separate rail above it, against a
  blue-grey wall over a wood floor and a maroon rug — builder to identify the room from
  the frame.

- **"[screenshot] jail door is still messed up"** (2026-08-02, daylight) → **SECOND
  report; item 104 promoted with a much stronger lead than the desk's first guess.** The
  daylight frame shows what the dark one hid: **the door is SEE-THROUGH** — masonry
  coursing and the stone reveal are visible through the leaves. Not the texture-density
  problem the desk guessed. Desk found: `ct/interior.ts:924` is a glazing material at
  **opacity 0.55**; `ct/int-jail.ts:65` declares `glazing: 'none'` and `ct/jail.ts:510`
  *comments* "Steel, two leaves, no glazing" while pointing at `int-jail.ts` for the
  declaration. **If the exterior leaf does not read that declaration, the outside door is
  glazed while the inside is solid** — which is simultaneously this bug and the
  inside/outside mismatch class of item 105.

- **"im just saying after we click the first take card, just flash thank you farewell
  screen and release the player"** (2026-08-02) → **done by the desk directly.** The
  screen was right and *waiting for input* was the fault — the desk had removed it
  entirely on the previous instruction rather than putting it on a timer. TAKE CARD now
  shows the farewell and releases after **1100 ms** via the file's existing `after()`
  helper (*"a step the machine takes on its own"*). A keypress skips the wait. Both paths
  go through one `endSession()` so the machine is reset identically, and it is **guarded
  on `screen === 'thanks'`** — the timer fires on a wall clock, so leaving during the
  flash would otherwise close whatever panel is open a second later. **Item 144 (the dead
  thanks screen) deleted — it is live again. Item 149 stands: `K-atm-walk` still exits 0
  while printing a failure, which is the real defect there.**

- **"can we apply the same sort of thing we applied to the atm and apply it to the
  mail?"** (2026-08-02) → **routed as queue item 155.** Third application of the diegetic
  framework after the ATM (86) and slots (100). **But the mail is NOT a screen** —
  `ct/tenancy.ts` owns a bank of mailboxes in the walk-up lobby (*"a bank of mailboxes is
  the one thing in a walk-up lobby"*), and reading mail is holding a letter, not
  operating a machine. That is a design question, not a port.

- **"[screenshot] fix this"** (2026-08-02, an office with filing cabinets and a corkboard)
  → **folded into item 93 as the FOURTH room.** A figure and a chair intersect. Previously
  reported in the church pew, a casino stool and the jail bench.

- **"[screenshot] whats going on here with the light reflecting against the invisible
  wall?"** (2026-08-02, night) → **routed as queue item 156, TOP — likely a regression
  from today's lighting rewrite (item 95).** A wedge of lamplight on a building face with
  a HARD EDGE where it stops, reading as light hitting a surface that is not there. Desk
  hypothesis, offered as a lead only: the lamplight is registered **per material**
  (`register()` walks meshes and patches each material's shader), so two adjacent faces
  of the same wall built from different materials — one patched, one not — would give
  exactly this hard boundary. The desk has been wrong on lighting twice today, so this
  is explicitly a candidate.

- **"theres still 2 take card options. it should be take card and then the exit not take
  card > take card"** (2026-08-02) → **done by the desk directly.** The MENU's TAKE CARD
  sent you to a screen whose only button is also TAKE CARD. It now goes straight to the
  farewell. The `card` screen stays for the path that reaches it after a withdrawal
  (`receipt` → NO → `card`), where the machine really is handing the card back and it is
  the first time you have been asked.

- **"i need the pc in the library to be like the atm too. intergrated overlay. realistic
  setup"** (2026-08-02) → **routed as queue item 157.** FOURTH application of the
  framework. **Carries a known constraint the others did not:** `ct/library-pc.ts:377` is
  a free-text search field, and item 143 had to add a `PanelSpec.typing` opt-out because a
  global `[E]`-to-close made the letter *e* untypable — *Emma* and *Frankenstein*
  unsearchable.

- **"[screenshot] remove this weird table in the library"** (2026-08-02)
  → **routed as queue item 158.** A table jutting from a shelf end at an angle,
  intersecting the shelving.

- **"[screenshot] too much arm here i think it shou;ld have a bit of a steeper
  angle maybe?"** (2026-08-02,
  `/home/erick/Pictures/Screenshots/Screenshot from 2026-08-02 20-29-35.png`)
  → **routed as queue item 165, which supersedes 111.** THIRD report on the watch
  arm. In the frame the forearm runs almost perfectly horizontally across the
  full width of the bottom of the screen — a long flat slab. He proposes the fix
  himself: a steeper angle.

- **"make the liquor store a mattress store"** (2026-08-02) → **routed as queue
  item 166.** The liquor store is facade-only — one row in `ct/street.ts:296`,
  no interior module, no `[E]` spot, no ad references — so this is a signage and
  frontage change, not a new building.

- **"[screenshot] mug handle still looks off, please try"** (2026-08-02, pasted
  image, close-up from the doorway) → **routed as queue item 167.** THIRD report
  on the mug, and the SECOND after a fix that measured correct by construction.
  Item 108's fix joined the handle to the cup and proved it with numbers; he is
  still telling us it reads wrong.

- **"put the calendar where the poster is and the poster where the calendar
  is"** (2026-08-02) → **routed as queue item 168.** Both are in the player's own
  room, `ct/apartment.ts`: the gig-flyer poster on the south wall at
  `AX(-1.05), RY + 1.55, AZI(2.085)` (0.52 × 0.70, unrotated), the 1997 calendar
  on the north wall at `AX(-2.45), RY + 1.66, NORTH_Z` (0.30 × 0.40,
  `rotation.y = PI`). A straight swap of two wall hangings.

- **"[screenshot] what is this weird grass on the ground"** (2026-08-02, pasted
  image, looking down at the floorboards indoors) → **routed as queue item 169.**
  A small pale horizontal sliver lying flat on the apartment's wooden floor.
  `ct/apartment.ts` contains no grass or weed geometry of its own; seven other
  modules produce some (`props.ts`, `tex-world.ts`, `street.ts`, `weeds.ts`,
  `lot.ts`, `park.ts`, `civic.ts`).

- **"[screenshot] benches need space away from the path"** (2026-08-02,
  `/home/erick/Pictures/Screenshots/Screenshot from 2026-08-02 20-33-21.png`)
  → **routed as queue item 170, which supersedes 88.** SECOND report. The first
  was *"bench is a lil too close to the path. also the path looks awful"* and
  named one bench; this one says **benches**, plural — a clearance rule for every
  bench in the park, not a nudge to one.

- **"[screenshot] shelter roof is still bugged in terms of graphics"**
  (2026-08-02, pasted image, standing under the park shelter in rain) →
  **routed as queue item 171.** The underside of the shelter roof reads as a
  dense high-frequency stripe grid. "Still" — the shelter's timber has been
  through a density fix before (`ct/civic.ts:403` refers back to it) and
  `ct/park.ts:1715` already warns about scale changing between two pieces of
  the same shelter.

- **"[screenshot] try to add some y diversity here. the height is soooo flat."**
  (2026-08-02, pasted image, the park seen from the street) → **routed as queue
  item 172.** The park already has a gaussian relief system (crown +0.10, mound
  +0.30 over σ 3.1, dish -0.09, corner -0.10) but it is capped by a hard
  constraint its own author documented: *"The park site is floored by one flat
  32 × 30 m plane at KERB_H, drawn by `openSite` in ct/street.ts, and it is not
  mine and does not move."* The same comment names the fix: *"If ct/street.ts
  ever lets a module own its site's ground, the crown can come off and the
  hollows can be real."*

- **"[screenshot] people still get stuck. they should back up and allow the car
  to pass"** (2026-08-02, a citizen pinned between the taxi and the kerb) →
  **routed as queue item 173.** "Still" — a repeat. `ct/crowd.ts:21-26` describes
  `citAvoid` as *"solid props people steer AROUND — trees, lamps, parked cars"*,
  and `:197` already mentions people *"frozen on the carriageway either side of
  a parked car."*

- **"pedestrians sometimes clip into the fruit in the sidewalk outside the
  bodega"** (2026-08-02) → **routed as queue item 174.** The produce crates are
  built in `ct/bodega-corner.ts` (~439-473) and that module registers player
  collision through a `solid()` callback; whether the crates are also added to
  the crowd's separate `citAvoid` list is the thing to check first.

- **"[screenshot] side of the jail are still bugged and allow for out of
  bounds"** (2026-08-02, night, a gap of open sky between the jail and the brick
  building west of it) → **routed as queue item 175.** "Still" — a repeat. Two
  jail walk checks already exist and pass (`scripts/O-jail-walk.mjs`,
  `scripts/w15-jail-walk.mjs`), so this is a blind spot in the checks as much as
  a hole in the world.

- **"make it a combo orpheus hotel and casino. connect them internally and
  outside. i should be able to walk from one into the other"** (2026-08-02)
  → **routed as queue item 176.** `HOTEL ORPHEUS` (`ct/street.ts:332`, w 12,
  5 floors) and `SEVENS` (`:333`, w 11.55, 4 floors) are **already adjacent** —
  consecutive rows in the EAST roster — which is what makes this feasible
  without moving anything else on the street.

- **"[screenshot] bodega is a bit crowded and lots of clipping inside"**
  (2026-08-02, pasted image, the counter end) → **routed as queue item 177.**
  Same family as the library crowding report (item 115).

- **"pawn shop should contain, knives, bolt cutters, guns, on top of the regular
  stuff. it should also serve as a fence for the stuff you steal from neighbors.
  speaking of, i havent seen a single package outside my neighbors doors?"**
  (2026-08-02) → **routed as queue items 178 (packages), 179 (pawn stock) and
  180 (fencing).** ANSWER TO HIS QUESTION: he has not seen a package because
  **none is ever placed.** `PACKAGE_TABLE` and `rollPackage()` exist in
  `ct/inventory.ts:165,247` and have **no consumers anywhere in `src/`**. The
  comment at `:158` records the half-finished handoff: *"builder C is putting
  packages on the walk-up landings."* Builder C never landed it.

- **"trying to hit cancel on the pin keypad doesnt work cause it's also 5? once
  you enter 4 digits it auto submits please. also the first time you go to the
  atm it saves your pin"** (2026-08-02) → **routed as queue item 184.** He is
  right about the collision: `ct/atm.ts:437` consumes any digit as a PIN digit
  and returns, so the numeric shortcut for the CANCEL fascia button (`:179`)
  can never fire while the PIN screen is up. Note also that **no PIN is stored
  anywhere today** — `:442` opens the menu on any four digits.

- **"the load [loan] application process should also be like atm and whatnot.
  you sit and its the loan process as an integrated overlay"** (2026-08-02)
  → **routed as queue item 185.** FIFTH tenant of the diegetic framework, after
  the ATM (86, done), slots (100), mail (155) and the library PC (157).
  **It overrules a deliberate decision:** `ct/int-bank.ts:1161` states the loan
  was built as three `[E]` interactions *"rather than as a screen over it,
  because every other verb in this world is an `[E]` on an object you can walk
  up to and this one should not be the exception."* The user has now asked for
  the exception, so per BUILDER-BRIEF §6a his words win.

- **"[screenshot] get rid of shadow texture here pls"** (2026-08-02, the alley
  mouth by the phone booth and dumpster) → **routed as queue item 186.** SIXTH+
  report of this class — `ct/jail.ts:928` already logs item 114 as *"his FIFTH
  report of the class"*. **It is not a shadow.** `ct/paint.ts:52-60` carries the
  diagnosis: an untextured ground quad *"reads as a TINT OVER the paving rather
  than as a piece of paving"*; 123 such surfaces, ~454 m², already named as the
  cause of four earlier complaints. `scripts/w5-shadow-census.mjs` exists and is
  **not registered in `checks.mjs`.**

- **"make people different heights pls"** (2026-08-02) → **routed as queue item
  187.** Height variation already exists but is coarse: `ct/crowd.ts` has six
  cast members with fixed `hs` values (1.09, 0.91, 0.97, 1.05, 0.94, 1.02) and
  **no per-instance jitter**, so a street full of people shows the same six
  heights repeated.

- **"[screenshot] this is inside the bodega as you walk in it is on the left by
  the coffee"** (2026-08-02, 22:05:46) → clarifies the fixture item 177's builder
  could not find. It is **not a magazine rack** — it is the front display panel
  of the unit beside the coffee station. Logged against item 177's follow-up.

- **"the watch angle is a bit too steep. i liked it better before but idk maybe
  theres a nice middle ground?"** (2026-08-02) → **routed as queue item 200.**
  Item 165 took `WATCH_TILT` from -5° to -18°; he wants between the two.

- **"[screenshot] the pedestrians dont cross at the cross walk"** (2026-08-02,
  two citizens standing in the roadway near the corner by RADIO, with the
  painted zebra clearly visible further up the street) → **routed as queue item
  201.** The crowd network already has the concept: `ct/crowd.ts:232` — *"`road`
  on an edge is what 'cross at the crossing, and only at the crossing' comes
  to"*, and `:239` counts `crossings`.

- **"[screenshot] truck collision isnt accurate to the truck but the other truck
  is? it seems odd. seems like all trucks should be one object that are all the
  same no?"** (2026-08-02,
  `/home/erick/Pictures/Screenshots/Screenshot from 2026-08-02 22-08-24.png`,
  taken in the V collision-debug view) → **routed as queue item 202, which
  supersedes 87.** SECOND report of this class, and this time he proposes the
  fix himself: one collider definition per vehicle kind. `ct/cars.ts` already
  has a `CarKind` type and `makeCar(kind, …)`.

- **"the look of the slot machine is bad. i want it to look fun and lively and i
  wantr to have the classic slot machine look and the classic slot machine
  symbols."** (2026-08-02) → **routed as queue item 203.** The symbols are
  already the classic set (`ct/slots.ts:45` — SEVEN, TRIPLE BAR, DOUBLE BAR,
  BAR, CHERRY, BLANK on a real 22-stop reel), so this is about how they are
  DRAWN. Likely relevant: `:818` states the palette is deliberately *"the
  room's, read off `ct/int-casino.ts` rather than chosen"* — five muted casino
  tones, which is the opposite of lively.

- **"get rid of the trash crate in front of the thrift store. or move it
  somewhere else"** (2026-08-02) → **routed as queue item 204.** He offers both
  options, so the builder may choose. THRIFT's frontage is `cz: -61.75`,
  `w: 12.5`, `side: -1` (`ct/int-thrift.ts:48`). A "milk crate" prop exists in
  `ct/props.ts` (`:447`, `:1246`).

- **"[screenshot] this is what the slot machine looks like to me. it is
  incredibly ugly and nothing like a classic slot machine. in fact describe the
  image to me first then edit your code"** (2026-08-02) → **supersedes item 203
  with item 208, which now carries the desk's actual DESCRIPTION of his frame
  rather than a guess.** He asked to be shown we looked before we changed
  anything — a fair demand after two measured-correct fixes he rejected.

- **ANSWER to "[screenshot] what is this weird grass on the ground"** (item 169,
  closed 2026-08-03): it is **not grass and not a bug**. It is the landlord's
  **rent slip pushed under 301's door** — `ct/tenancy.ts:1120-1141`. The builder
  walked to it and pressed E: *"[E] pick up the slip of paper"* → **PUSHED UNDER
  YOUR DOOR / OUTSTANDING NOW: $45.00 / PAST DUE**. It deliberately did NOT
  delete it, because the row's "DONE WHEN: the floor of 301 is clear" would have
  destroyed the rent-letter system. The desk's leak hypothesis is discarded:
  zero outdoor-module meshes in any of the 13 rooms.

- **"[screenshot] theres this here that cuts across the entry way. also the hotel
  is the right of the casino outside but to the left inside. again these interior
  exterior mismatch."** (2026-08-03,
  `/home/erick/Pictures/Screenshots/Screenshot from 2026-08-03 09-15-18.png`)
  → **routed as queue items 267 (the rail) and 268 (the handedness).** THIRD
  report of the interior/exterior mismatch class — after the jail doors and the
  church door, both of which turned out to be world-wide rather than local.

- **"push everything. yes lets do 25 deg. leave the sidewalk bus stop alone for
  now. move the calendar a bit to the right, make it bigger, and make it
  interactable in the same sort of integrated overlay view."** (2026-08-03)
  → **pushed (748 commits, auto-deploys to Pages).** Aim tolerance **25°**
  decided — item 98 returns to TODO with the number. The bus-stop pinch
  (item 269, 1.15 m lane) is **DEFERRED at his instruction, not fixed.**
  The calendar is **routed as queue item 270** — SIXTH tenant of the diegetic
  framework.

- **"[screenshot] umbrella looks so janky"** (2026-08-03,
  `Screenshot from 2026-08-03 11-21-57.png`) → **routed as queue item 271.**
  The canopy sits directly on the head with no shaft visible and both arms down.
  Note `ct/crowd.ts:297` already records a first cut at 0.95 m reading "as a HAT
  rather than a brolly" — it was widened to 1.14 m and still reads as a hat.

- **"[screenshot] people sitting still looks bad because they have no legs??"**
  (2026-08-03, the diner booths) → **routed as queue item 272.** Torso and head
  above the seat, nothing below the waist. `ct/citizens.ts:102-103` DOES draw
  seated legs ("hip 47, knee forward, shin down to the same 59"), so the cause is
  open: the flag, occlusion by the booth back, or seat height.

- **"[screenshot] some bookshelves are flat?"** (2026-08-03,
  `Screenshot from 2026-08-03 11-23-42.png`) → **routed as queue item 273.**
  In his frame the wall runs read as flat painted boards, and one free-standing
  unit centre-right is a **completely blank brown panel with no books at all**.
  `ct/int-library.ts:302-308` records this exact failure — a book plane left at
  the wrong rotation *"hangs on the END of the bay… while the sides of every
  stack — the faces you actually walk between — were blank brown board."*

- **"[screenshot] mug should be empty"** (2026-08-03,
  `Screenshot from 2026-08-03 11-26-55.png`) → **routed as queue item 274.**
  FOURTH mug report — and notably he does NOT mention the handle, so items 108
  and 167 are settled. The dark disc at `ct/apartment.ts:2136-2139`
  (`CircleGeometry(MUG_R - 0.006)`, `0x4a3524`) reads as coffee; he wants the mug
  empty. ⚠ That disc exists on purpose: without it the top reads as a solid peg.

- **"to look at your watch you need to look straight down (couple deg of
  tolerance)"** (2026-08-03) → **routed as queue item 275.** MEASURED, and the
  arithmetic disagrees with his experience: the gate is `rig.pitch < -0.95`
  (`crosstown.ts:2002`) = 54.4° below horizontal, and the pitch clamp is ±1.3 rad
  (`fp.ts:515-516`) = 74.5°, so on paper there are **20° of range**, not "a
  couple". Something makes the effective window far smaller than the gate.

- **"[screenshot] npcs still get stuck"** (2026-08-03,
  `Screenshot from 2026-08-03 11-31-21.png` — two citizens stationary on the
  pavement beside the bus bench, with SLEEP CENTER behind them)
  → **routed as queue item 276.** ⚠ **This looks like the pinch he DEFERRED an
  hour earlier** (item 269: the walking lane is **1.15 m** there against a sacred
  2 m; the player stops permanently 3.7 m in; **moving the bench cannot fix it**
  because the shopfront alone leaves 1.63 m). He deferred it believing it cost
  only his own passage. **If it is also stranding citizens, the trade has
  changed and it is his call to reopen 269.**

- **"when i exit overlays my mouse stops working as well"** (2026-08-03)
  → **routed as queue item 277, top of the queue.** Traced by the desk:
  opening a diegetic overlay deliberately calls `document.exitPointerLock()`
  (`ct/hud.ts:1244`) so the pointer can click the screen — correct. But the ONLY
  `requestPointerLock` in the whole source is `src/main.ts:32`, on a **canvas
  click**, gated `current?.pointerLock && !input.locked`. **Nothing re-acquires
  the lock when an overlay closes.** Offered as a lead, not a verdict.

- **"ok for 110, i want you to need to look straight down, it is confused. im
  asking for that. it isnt that way"** (2026-08-03) → **corrects item 275, which
  the desk had INVERTED.** His earlier line — *"to look at your watch you need to
  look straight down (couple deg of tolerance)"* — was **a request describing the
  behaviour he wants**, not a complaint about the current one. The desk read it
  as a bug report and wrote a row telling a builder to WIDEN the window. He wants
  it **narrowed**: essentially straight down, with a couple of degrees of play.
  The holding worker (onehundredten) was messaged directly.

- **"just make the door high rank pls"** (2026-08-03) → **decision recorded on
  item 291.** The way out of a room outranks the furniture in it. Applies to the
  calendar and the bed in flat 301, and by extension to any room's exit.
