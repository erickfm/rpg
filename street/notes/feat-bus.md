## feat/bus — the 42 stop, and the bus that serves it

**Base:** `59c1f79` (mainline) · **Commits:** `6856fc0` (stop + bus + traffic), `6c548ef` (it actually stops)

---

### What the player sees

A bus stop on the east walk at z ≈ −34: a painted metal flag on a pole and a
slat bench with an ad on it. Occasionally — about one pass in nine — the 42
comes down the block, brakes, pulls in to the kerb, stands with its doors
open for a few seconds, and pulls away.

### The stop (`ct/props.ts`)

Period-correct for '97: a flag sign and a bench, and nothing else. No shelter,
no timetable case, no real-time display — those are later. The bench sits with
its **back to the kerb** because that is how bench advertising works: the
advertiser bought the eyes of passing traffic, not the riders'. So the ad
(TONY'S PIZZA, 555-0143, two slices $1.75) faces the roadway and the slats
face the walk.

**Placement is driven by the walking lane.** Everything hugs the kerb *inside
the envelope the lamp poles already set*: with the rig's 0.36 m radius the
lamps block out to x ≈ 6.11 and the wall bites at 6.34, and the bench reaches
only 5.66. So the stop is never the narrowest point on the walk — the lamps
still are. It sits in the long clear run between the tree at z = −29.5 and the
lamp at z = −51, clear of the Whitmore door at −44.

### The bus (`ct/cars.ts`, `makeBus()`)

A **30-foot** city transit bus. The RTS — the American city bus of the era —
was built in 30/35/40 ft lengths at 96 or 102 in wide, and the 30 is the only
one that clears the parked cars on a street this narrow. Period details:
sliding **plug** doors front and rear, a **roller** destination sign reading
42 CROSSTOWN (electronic signs existed by '97 but rollsigns were everywhere),
and a **painted livery band** — full vinyl wraps came later. Flat-sided rather
than the RTS's famous curved panels: at 21 px/m a curve reads as noise, so the
curve is implied in the paint.

Doors are on **local +x**. The traffic system flips a vehicle 180° to run the
other way, which swings local +x to the other kerb — so the doors face the
kerb in both directions with no special-casing.

### The traffic system (`crosstown.ts`)

The bus joins the **existing cruising pool** rather than being a parked prop.
Vehicles now carry their own `laneX`, `halfLen` and `speed` in `userData`, so:

- the bus hugs the centre line (`laneX` 1.35) — at 2.2 m wide it cannot share
  the cars' lane without brushing the parked ones;
- it rolls slower (6.4 vs 8.5 m/s);
- its collider matches its real 9.1 m length instead of a car's 5 m.

Roughly one pass in nine is the bus, one in seven the taxi, the rest plain cars.

**Stopping** is southbound-only, for the reason above: a northbound bus has its
doors on the west kerb, where there is no stop. It eases a *target* speed
rather than setting speed directly, so it reads as braking, and swaps the
kerb-side door panel to a leaves-open texture while it stands.

### Verification

| check | result |
|---|---|
| `npm run build` | clean |
| `npm run sweep` | 48 shots, no page errors |
| walkability | walked, not asserted — 26 m at full speed through the stop in **both** directions (`node scripts/bus.mjs walk`) |
| the stop itself | asserted as **motion** (`node scripts/bus.mjs stop`) |

The stop probe is the interesting one: a still cannot show whether a bus
stops, so `scripts/bus.mjs stop` samples the run and asserts it. Current
result — brakes from 6.40 m/s to a standstill, front door comes to rest at
z = −33.54 against a flag pole at z = −33.50 (4 cm out), pulls in to x = 3.55,
holds ~5 s with the doors open, then accelerates away and eases back to the
lane. `window.__ct.bus(z, dir)` puts it on the block on demand and
`window.__ct.busInfo()` reads back position/speed/dwell.

### Shots to look at

- `shots/bs-serving-bench.png` — **the 42 at the stop, doors open.** Look here first.
- `shots/bs-front.png` — the roller sign and the livery, from the road.
- `shots/bs-doors.png` — the kerb side, both plug doors closed.
- `shots/bs-bench-ad.png` / `bs-bench-seat.png` — the bench from the road and from the walk.
- `shots/bs-flag.png` — the flag sign.
- `shots/bs-clearance.png` — the bus against the parked cars it squeezes past.
- `shots/bs-northbound.png` — running the other way, doors to the far kerb.

### Left undone / for whoever picks this up

- **A bus stop is a no-parking zone, and my own red-kerb rule in
  `ct/tex-ground.ts` says red kerb marks exactly that.** The stop frontage
  should be painted red for consistency with the hydrant and corner rules —
  it's a third entry alongside `HYDRANTS`/`KJUNC`, maybe five lines. I did not
  do it because `tex-ground.ts` wasn't in this task's ownership list. Worth
  doing; it is the kind of inconsistency the user spots.
- No pair stop on the west walk, so northbound buses never stop. Adding one is
  a second flag + bench and a mirrored z in the sim.
- Nobody waits at the stop and nobody boards. The citizens walk past it. A
  citizen that stands at the flag and disappears when the bus pulls away would
  be a big win for not much code.
- The bus has no interior — the windows are opaque glass. Fine at this
  distance; would show if the player ever got a head-on close-up at the door.
- The doors open instantly rather than sliding. A 0.3 s slide would need the
  leaves as geometry instead of texture.

### Files

```
street/src/proto/ct/cars.ts    makeBus() + bus textures (side/front/rear/roof/rollsign)
street/src/proto/ct/props.ts   the flag pole, the bench, their textures
street/src/proto/crosstown.ts  bus in the traffic pool; per-vehicle lane/length/speed;
                               the stopping behaviour; __ct.bus / __ct.busInfo
street/scripts/bus.mjs         NEW — shots | walk | stop
```
