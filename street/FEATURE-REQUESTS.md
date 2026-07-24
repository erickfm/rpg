# CROSSTOWN '97 — feature requests

Running log of every request from playtests. Claude works from this list
constantly: new requests land in **Inbox**, move to **In progress** while
being built, and to **Done** (dated) once verified in a screenshot and
published to the playable artifact.

## Inbox

## In progress

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
