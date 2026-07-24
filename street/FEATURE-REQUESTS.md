# CROSSTOWN '97 — feature requests

Running log of every request from playtests. Claude works from this list
constantly: new requests land in **Inbox**, move to **In progress** while
being built, and to **Done** (dated) once verified in a screenshot and
published to the playable artifact.

## Inbox

## In progress

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

- **Night should feel darker.** The dusk/night curve doesn't get dark
  enough; night reads as dim evening rather than night.

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
