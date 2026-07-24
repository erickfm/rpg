# CROSSTOWN '97 — feature requests

Running log of every request from playtests. Claude works from this list
constantly: new requests land in **Inbox**, move to **In progress** while
being built, and to **Done** (dated) once verified in a screenshot and
published to the playable artifact.

## Inbox

- **Add a corner** — the street should turn somewhere; a real corner to
  walk around, not just closed ends.
- **Add a bodega** — classic corner store (pairs with the corner).
- **Hoodie angles** (in this round): side of face barely visible in
  profile, none from back-left; hood color must match the sweater.

## Done — 2026-07-24 round 3

Everything below is live in the artifact and committed.


- **Pigeons still not spooking enough** — bigger flee radius, most fly
  away; keep the rare bold one for interaction.
- **Feed the birds** — e.g. cereal; ties into inventory.
- **Inventory + money.** Player has cash and items.
- **Wallet check on toggle** — user suggested right-click first, then
  shift; shift is sprint, so wallet toggles on right-click.
- **Watch needs an arm** — full forearm/hand raised, not a floating wrist.
- **C = crouch (hold, not toggle).**
- **Pickup truck still doesn't make sense** — rebuilt bed with real thick
  walls, visible dark corrugated interior, textured outer faces.
- **Apartment across the street from the alley, a bit off** — moved to the
  east side (z −35..−53, door at −44), across from the alley (−37..−43.5).
- **Stairs steeper and textured; apartment matches world style** — 28°
  flights, wood-grain treads + painted risers, plank half-landings.
- **Collision with people and everything that makes sense** — citizens are
  solid (they stop a step short of you so they can't trap you); hermit's
  doorway solid; cars/props/walls already were.
- **Hoodie angle fixes** — no face from back-left, sliver in profile, hood
  color matches sweater shading.

- **Graffiti in the alley.**
- **Texture consistency pass.** Brick looks great in one area and bad in
  another. Unify texel density / style across all brick and wall textures.
- **Alley plywood leaning the wrong way** — should lean against the wall.
- **Every building purposeful, no filler.** Hand-authored roster of named
  places on both sides; the walk-up is a real residential building.

## In progress

- **Trees: complete redesign/overhaul.** Billboard sprite trees "look so
  bad in the sidewalk". Replace with real low-poly geometry (faceted
  vertex-lit canopies like the trash bags, leaning trunks), keep the dirt
  pits, keep street-tree scale modest.

## Done

- 2026-07-24 — Trees: same crown size, only trunks vary ("taller, not
  bigger"); dirt tree pits instead of clipping the sidewalk. (Superseded by
  the full tree overhaul above.)
- 2026-07-24 — Pigeons fly away when approached most of the time; the odd
  bold one stays until you nearly step on it.
- 2026-07-24 — Taxi no longer the only traffic: pool of plain cars, one on
  the block at a time, taxi is a rare draw (~1 in 7); cars dwell off-screen
  between passes.
- 2026-07-24 — Fewer people: 8 → 4 citizens.
- 2026-07-24 — Holding jump no longer spams jumps (edge-triggered).
- 2026-07-24 — Pickup truck bed rebuilt: one solid box flush with the
  body, open bed painted on the top face — no gaps at the cab (two
  earlier geometry attempts rejected).
- 2026-07-24 — Dumpster redesigned (per-face textures, stencil on long
  faces only, dark interior, properly hinged propped lid, casters) and
  trash bags rebuilt as faceted 3D lumps instead of a billboard sprite.
- 2026-07-24 — Hoodie citizen: hood made continuous with the sweater in
  all 8 angles (front rim + cowl, profile and 3/4-back wraps).
- 2026-07-24 — Citizen atlas reviewed across all angles (contact-sheet
  screenshot via `__ct.atlases()`).
- 2026-07-24 — Alley gaps closed: filler building ends flush with the
  mouth; brick side walls run the full corridor depth.
- 2026-07-24 — Apartment building: 4-story narrow walk-up with switchback
  stairs; player's place is 301 (3rd floor); overweight hermit neighbor at
  302 across the hall, at his door often-but-not-always in the afternoon.
- 2026-07-24 — Time element: game clock (1 s real = 1 min game), day/night
  sky and fog, look down to check your wristwatch.
- 2026-07-24 — Entrance redesign: dropped "THE SEVILLE" nameplate; plain
  recessed double door, transom with gold "227", buzzer panel, stoop.
