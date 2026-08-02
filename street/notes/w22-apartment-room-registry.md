# w22 — the apartment was invisible to `seat-facing.mjs`

Queue item 32. Port **4183** (4188 was taken; so was every other port in
4180–4199 by the end of the run — the built-bundle check ran on **4212**).

## Root cause, one line

The walk-up predates `buildRoom`, so it never claimed a slab, and
`interiorRooms()` — the thing `__ct.roomDims()` returns — was `SLABS.map(...)`
and nothing else; a room that is not a slab did not exist to the registry.

## Genuinely absent, or filtered out?

**Genuinely absent.** The item asked which, so, with the evidence:

- `SLABS.push(...)` happens at `ct/interior.ts:1318`, inside `buildRoom` and
  nowhere else. `ct/apartment.ts` never calls `buildRoom` — it is a four-storey
  building with a stair shaft and its own floor picker, and the kit has no
  concept of a storey.
- `__ct.rooms()` returned exactly the twelve `int-*.ts` ids. No apartment under
  any name.
- The one apartment seat came back `room: 'outdoor'` from `seat-facing.mjs`'s
  own `roomOf()`. That is not a filter rejecting it — there was no rectangle to
  match against.

That mattered more than "one rule was skipped". Rule A needs `r.w/d/cx/cz` to
find the wall ahead; rule B is literally `for (const c of r ? cols : [])`. With
no room, **both** rules are skipped and the seat is reported as clear. The check
that had just caught 105 backwards seats scored the bed in flat 301 — the seat
the player uses most, in the room he spawns in — without looking at it.

## What changed

**`ct/interior.ts`**

- `RoomDims` is now a named exported interface instead of an inline return type.
- `declareRoom(r)` — a **dims-only** registration for a room the kit did not
  build. `interiorRooms()` returns `SLABS ∪ DECLARED`.
- `interiorGround`, `interiorMaxX`, `interiorMaxZ` and `interiorRoomIds` stay
  **slab-only, deliberately.** Pushing the walk-up into `SLABS` to get it into
  the registry would have handed its four storeys to a one-height `gy` and shoved
  the world's east bound 80 m further out. `interiorRoomIds` answers a different
  question anyway — *"did `int-<id>.ts` build its room?"* — which is what
  `interiors-wired.mjs`, `world-wired.mjs` and `ct/civic-doors.ts` ask it, and a
  room with no `int-*.ts` file has nothing to be wired to.
- `RoomDims.y`, the room's floor height. See the bugsweep finding below.

**`ct/apartment.ts`**

- Flat 301's extent hoisted to one set of constants (`R301_X0/X1/Z0/Z1/CX/CZ/
  W/D/H/DOOR_Z`). Its two side walls, the four pieces of its window wall, its
  floor, its ceiling, its door skin and the registry entry now all read those.
  Six numbers had been hand-typed in eight places and the registry had none of
  them — §8's "derive, never retype", and the reason this bug was possible.
- `declareRoom({ id: 'apt301', … })` at the foot of that section.

Registered: `w 3.06  d 3.36  cx 198.4  cz -16.25  y 5.4`. `w`/`d` are the wall
centrelines less one `WALL_T`, because `RoomDims.w/d` means *wall face to wall
face* everywhere else and a check that mixes the two conventions reads a 7 cm
lie on every wall. **Derived, not copied**: `WALL_T` and `ST` are already in
scope in that block, so nothing here is a second authoring of anything.

## DONE WHEN — both halves, and the mutation test

> `seat-facing.mjs` reports a non-zero seat count for the apartment

`scripts/probes/apartment-in-registry.mjs`, resolving seats through the check's
own `roomOf()`:

```
  before   17 outdoor,  no apt301 row
  after    16 outdoor,   1 apt301   (198.44, -15.58) "sit on the bed and watch TV"
```

> and goes red when an apartment seat is deliberately turned to face a wall

Turned the bed seat to `yaw: Math.PI`, at the north wall:

```
FAIL  apt301  sit on the bed and watch TV  |  nose to the wall: 1.01 m of nothing, then apt301's own wall
      1 seat, e.g. (198.44, -15.58) yaw 3.142
1 seat(s) face the wrong way          exit 1
```

Reverted; 219 of 219 green again, on dev **and on the built bundle** (`vite
preview`, 4212).

## Verdict on the after-images

`shots/probe-apt301-from-the-seat.png` — from the seat, at the seat's own yaw:
the flat's blue papered walls, the wood floor, the chest of drawers with the
ashtray on it, the TV on its crate dead ahead, the poster above it, and `[E] sit
on the bed and watch TV`. That is flat 301 on floor 3 and the seat is looking at
the television. The room the registry now claims is the room the player is in.

`npm run fp before` / `after` across the change: **textures, structure and tints
IDENTICAL** (1460 / 8315 / 8315), `places` differs by **one** object — a mesh at
(-5.73, 0.14→0.15, -21.56), a 1 cm drift on the street, 200 m from anything I
touched. `fpdiff`'s own classifier calls it DRIFT, not a move. Every substitution
in `apartment.ts` is an exact-equal constant, so this is what it should be.

`node scripts/bugsweep.mjs` — **zero STATION MISS**, no COVERAGE errors, no new
console issues (only the pre-existing THREE.Clock / getImageData / GL warnings).

Walked, not screenshotted: `scripts/probes/apt301-walk-the-rect.mjs` warps to the
room centre and holds each direction to the stop. No direction walks past a
declared face — the rect contains the room, which is the property rule A needs.
The east wall (the only one with clear floor in front of it) stops the capsule
0.44 m from the declared face against a 0.36 m radius, i.e. the bare wall exactly
where declared. The other three stop 0.22–1.05 m early on the bed, the TV crate
and the drawers, which is what a furnished 3 x 3.4 m bedroom does and is not a
rect error.

---

## Found and NOT fixed

### 1. `bugsweep.mjs` cannot photograph a room that is not at y 0 — one line

This is the one thing I would queue first, because **I caused it** and it is a
minute's work in a file item 32 does not name.

`__ct.warp(x, z, yaw, gy, pitch)`'s fourth argument is the floor the walk-up's
stateful picker is told it is on. bugsweep passes a literal `0` at all three of
its room stations — correct for the twelve belt rooms, and it puts the camera
three storeys **below** flat 301, outside the building. `verifyLanded` checks x
and z only, so it does not miss; it passes and photographs brick. Look at
`shots/bug-apt301-entry.png` from my run: sky, and the outside of the walk-up.

`RoomDims.y` now carries the answer (`0` for the belt, `5.4` for apt301). The fix
is the literal in **`scripts/bugsweep.mjs`**, three call sites in the room loop
(≈ lines 148, 167, 175):

```js
-  await shot(`${r.id}-entry`, (a) => window.__ct.warp(a.x, a.z, a.yaw, 0, 0), 500,
-    { x: entryPos.x, z: entryPos.z, yaw: entryYaw });
+  await shot(`${r.id}-entry`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 500,
+    { x: entryPos.x, z: entryPos.z, yaw: entryYaw, gy: r.y });
```

…and the same `gy: r.y` added to the `-far` and `-wide` argument objects. Proven
to work: my walk probe does exactly this warp and lands the eye 1.62 m above the
flat's floor, where `gy: 0` lands it 5.40 m lower.

DONE WHEN: `shots/bug-apt301-entry.png` shows the inside of the flat, and
`verifyLanded` also fails on a y disagreement rather than only on x/z.

### 2. `bugsweep.mjs`'s room-count guard now sleeps — one line

`if (roomDims.length < 12)`. With apt301 in the registry the count is 13, so a
belt room that fails to build now gives 12 and the guard passes. That is exactly
the "check that cannot fail" this project has paid for. It should count the belt,
not the registry: `window.__ct.rooms().length` is still the twelve `int-*.ts`
ids and is the number that guard actually means.

### 3. `seat-facing.mjs` can only catch ONE of the four wrong ways to face this seat

Not a regression, and **not something to fix by loosening a constant** — I am
recording the measurement so nobody re-derives it.

I turned the bed seat at all three other wrong yaws and the check stayed green:

| seat yaw | faces | clear distance | caught? |
|---|---|---|---|
| `Math.PI` | north wall | 1.01 m | **yes**, rule A |
| `-Math.PI/2` | west (window) wall | 1.57 m | no |
| `Math.PI/2` | east (door) wall | 1.49 m | no |

`WALL_MIN = 1.20` was tuned on shop-sized rooms. In a 3.06 x 3.36 m bedroom you
can never be more than 1.7 m from a wall, so two of the three wrong yaws are
outside a rule whose whole premise is "a stride from brick is a defect". Raising
`WALL_MIN` would make it fire on legitimate seats in the twelve belt rooms; that
is the loosening-in-reverse mistake and I did not make it.

Rule B cannot cover the gap either: it needs substantial furniture within
`REACH = 0.80` m, and everything in this flat that the seat could be turned away
from is further off than that (the TV is 2.08 m away). `REACH` is tuned for a
counter you sit **at**, not a bed you sit **on** with a television across the room.

The real fix is the one `seat-facing.mjs`'s own header already names: *"guarding
them needs the seat to declare what it is meant to look at, which is a change to
`ctx.seat`, not to this file."* An optional `lookAt: {x, z}` on `ctx.seat` would
make all four yaws decidable for this seat and would also close the park-bench
gap the header records as unguarded. That is a `ct/ctx.ts` item, not this one.

### 4. Flat 302 and the hall are still unregistered

Only 301 is declared, because only 301 has a seat and only 301 is a rectangle.
The hall is an L-shaped four-storey shaft and any rect for it would be a lie the
registry then hands to every harness. If 302 is ever furnished it should declare
itself the same way — `declareRoom` takes any number of rooms.
