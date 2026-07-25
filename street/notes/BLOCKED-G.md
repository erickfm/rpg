# Builder G — blocked

**One thing, and it is cosmetic rather than structural.** Everything in my queue
is built, walked and live in mainline — including the pawn shop, which is no
longer blocked on wiring.

---

## RESOLVED since the last version of this note: the wiring

F did not wire `buildPawn` — F deleted the whole idea. `ct/interior.ts` now
auto-discovers rooms:

```ts
const mods = import.meta.glob('./int-*.ts', { eager: true });
```

So a room lands by existing, sorted by path so slab addresses are a property of
the file name rather than of bundler order. Adding an interior now touches
exactly one file: the one that owns the room. **All four of mine are live**, and
the "two lines in `crosstown.ts`" tax I was reporting every run is gone.

Worth knowing for anyone who was working around it as I was: I had a local
wiring patch I applied and reverted on every commit, and it silently stopped
doing anything. My test suite passed anyway, which is how I noticed — the room
was already being built without me.

---

## STILL BLOCKED: `pawnFront` paints no door — D

Raised before I built the casino and still true. `street.ts`'s `pawnFront`
draws a board, a barred window and a stallriser, and no door rect anywhere. Its
three neighbours in the same file all paint one:

| painter | door at |
|---|---|
| `burgerFront` | `W * 0.44` |
| `taxFront` | `W * 0.5` |
| `shopfrontTex` (block default) | `W * 0.48` |
| **`pawnFront`** | **none** |

**This does not stop anything working.** `ct/int-pawn.ts` puts its `[E]` spot
where the house convention would put a door — `W * 0.48` of a 96-texel front,
world `z = -59.06`, within 6 cm of the building centre — and the room passes
25/25. What it means is that the player walks up to blank barred glazing and
gets a prompt out of nowhere. A door painted to any of the three conventions
above lands inside the spot's 1.05 m trigger, so when D paints one, `DOOR_Z` in
`ct/int-pawn.ts` is the single line to change and I will change it.

`street.ts` is D's. My bounded mandate there covers the casino and hotel
exteriors only, which is not this.

---

## Two observations for other owners, neither a blocker

**1. A car is parked across the HOTEL ORPHEUS entrance.** `ct/sidestreet.ts`
parks a hatch at `x0 = 39` on the north kerb; the hotel's door is at `x = 39.51`
and its step-out lands at `41.06`. The car's collider reaches the pavement edge,
so stepping out of the hotel you cannot walk straight out into the road — 0.44 m
and you are against it. Both directions along the walk are clear, the door and
the step-out both work, and a car pulled up outside a hotel is arguably the
world working rather than a fault. Flagging it because it was not chosen: the
`x0 = 39` in that roster and the `39.51` in mine are the same doorway by
coincidence. If anyone wants the entrance clear, moving that car a few metres
either way does it.

**2. The kit's room lights still cannot be recoloured or suppressed**, and it
has now bitten twice — the casino wanted warm and dim, the tax office wants cool
fluorescent strips, and the kit's warm blobs read as a different fixture among
mine. Both rooms shipped anyway because the palette does the work and each room
owns its own lamps. `light?: {...} | false` on `RoomSpec` would settle it. F's
file, F's call, not urgent.

**3. `props.ts` was not needed** for the casino/hotel night spill, so the
coordination the desk offered with B is not required. `dimWorld` already skips
`transparent` materials and `scene.background` already carries the night curve,
so the two frontages drive themselves off a `mesh.onBeforeRender` read. Written
up at the top of `ct/vice.ts`.

---

## State, re-verified against mainline after the park / car lot / sidestreet landings

| | |
|---|---|
| casino interior | live, 26/26 |
| hotel interior | live, 26/26 |
| tax interior | live, 25/25 |
| pawn interior | live, 25/25 — no longer wiring-blocked |
| casino + hotel exteriors | live, 13/13 |
| F's rooms with all of mine present | 147/147 |
| world sweep | 48 shots, no console errors from my code |
