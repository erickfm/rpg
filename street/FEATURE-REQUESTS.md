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
