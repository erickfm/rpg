# BLOCKED — builder G

Two blockers, both one line in somebody else's file, both on the library and
church that just moved to me. I am building everything that does not depend on
them meanwhile; this file exists so the two asks are visible rather than buried
in prose.

---

## 1. UNBLOCKED, THEN BLOCKED AGAIN ONE LAYER DOWN: room levels do not reach the player

**F delivered the field and it works.** `bd3ee7d7a` gave `RoomSpec` a `floor`,
both a level list and a function form, and the kit honours it. Verified from the
library's own flight, asked of the world at local x 5.80:

```
lz 7.5 -> 0      lz 6.4 -> 0.13   lz 5.0 -> 1.01
lz 3.5 -> 1.95   lz 2.0 -> 2.90   lz 0.0 -> 2.90   lz -3.0 -> 2.90
```

That is exactly the ramp the spec describes. `ct/interior.ts` is doing its job
and the ask in the old version of this entry is closed.

**The player does not follow it.** Walking that same line with local x pinned at
5.80 — no drift, checked every 0.5 s — `__ct.groundAt` returns 1.33, then 2.41,
then 2.90, while the player's `y` stays at **1.62 for the whole climb**. 1.62 is
eye height over a floor of zero: they walk the length of the flight and the deck
at ground level.

```
t=0.5s  x 5.80  z  4.49  y 1.62   groundAt 1.33
t=1.0s  x 5.80  z  2.77  y 1.62   groundAt 2.41
t=1.5s  x 5.80  z  1.02  y 1.62   groundAt 2.90
t=3.0s  x 5.80  z -4.34  y 1.62   groundAt 2.90
```

**Where it goes wrong.** `ct/crosstown.ts` resolves the player's floor as a
chain: a loop of registered pickers first, then `interiorGround`, then the rest.
Something in that loop answers non-null for positions inside the interior belt
and short-circuits before `interiorGround` is ever asked — which is consistent
with the world's own `groundAt` knowing the right answer while the player does
not. The library forecourt's `courtGround` is the first thing I would check.

Not mine: `ct/crosstown.ts` is the wiring and `ct/civic.ts` is where the likely
claimant lives.

**What I did about it.** Built the gallery — deck, twelve treads, string wall,
balustrade, a table up there — confirmed the floor function, found the player
walking through all of it, and TOOK THE GEOMETRY BACK OUT. A staircase you walk
through is the church's locked door with a different roof on it. The constants
and the verified floor function are still in `ct/int-library.ts` with the
measurement beside them; it is a dozen lines from working the day the chain is
fixed.

## 1c. The old ask, now closed — `buildRoom` accepting a floor function

**This is the one the desk called the most important part of the item** — *"the
stair matters most; they named it, and a level change is what makes an interior
read as a building"*. I cannot build it, and the reason is one line.

The mechanism already exists and is already per-position. `ct/interior.ts:47`:

```ts
id: string; x0: number; x1: number; gy: (x: number, z: number) => number | null;
```

and `ct/interior.ts:155` asks it for every step the player takes:

```ts
for (const s of SLABS) if (x >= s.x0 && x < s.x1) return s.gy(x, z) ?? 0;
```

`ct/crosstown.ts:533` says this is deliberate, in its own words:

> the interior belt owns its own floors — each room answers for its slab, so a
> builder can put a step or a **mezzanine** in a shop without this file knowing
> anything about it

So the design intends exactly what the library needs. The only thing in the way
is that `buildRoom` hardcodes the answer at `ct/interior.ts:1000`:

```ts
SLABS.push({ id: spec.id, x0, x1, gy: () => 0, w: W, d: D, cx, cz });
```

**The ask, for F:** let a room supply that function — a `gy?` on the room spec,
passed through instead of `() => 0`. Local coordinates would suit a room author
better than world ones, but that is F's call; either works.

`ct/interior.ts` is F's and `OWNERSHIP.md` is explicit that everyone else reads
it and asks through the desk, so this is the ask rather than a patch.

**Why I am not building the stair anyway.** I could draw treads, a gallery deck
and a balustrade as geometry with colliders, and it would look right in a
screenshot. The player could not climb it. That is precisely the fault the user
has just had us fix on the church — *"a flight of steps you climb to a door that
refuses you is worse than no steps"* — and shipping a staircase you cannot use
would be the same mistake with a different roof over it.

**What I am doing instead:** the rest of the library — the dark vestibule, the
tall reading room, the circulation desk facing the door, the stacks in parallel
runs with aisles too narrow to see over. The stair goes in the moment the spec
field exists, and the room is being laid out with its footprint left clear.

---

## 1b. A room deeper than ~20 m loses its way-out door, and I cannot see why

Found while acting on the auditor's casino row. Not blocking that fix — the
casino is landed at 19 m — but it is a real limit on "grow the depth, hard" and
the next person to push a room past it will lose an hour to it as I did.

**The measurement.** Casino at `w 11.0, d 30.0`. Walk toward the way-out door
from anywhere inside and you come to rest at local **z 13.00**, every time, from
either direction:

```
warp z=12   -> after a 1.4 s walk, z 13.00
warp z=13   -> after a 1.4 s walk, z 13.00
warp z=14.2 -> after a 1.4 s walk, z 13.00
```

The way-out spot sits at z 14.45 with r 1.0, so 13.00 is 0.45 m outside it. The
prompt never appears and E does nothing. **You can enter the room and not leave
it on foot** — and it looks fine until you try, because entry drops you inside
the trigger, so the prompt is there the moment you arrive and gone once you walk
away and come back.

**What it is not.** Not collision: the only collider spanning the doorway between
z 12.5 and 16 is the threshold at 15.18–15.36. Not the trigger's size: r 1.75
covers 12.70–16.20 and changed nothing (and breaks the outside landing, which
the kit correctly warns about). Standing in the trigger by warp and pressing E
works and puts you on the street at 52.84,-97.25, so the door itself is sound.

**Not mine to fix.** The way-out spot is placed by `ct/interior.ts` from the room
spec, and that file is F's. This is a report, not an ask — the casino is fine at
19 m and I am not blocked. But "keep the frontage width, grow the depth, hard"
has a ceiling somewhere around 20 m that nobody knew about, and the hotel is at
26 m, so it is worth someone checking that one before it is reported.

## 2. Window numbers for the library and the church

The user's instruction was *"the interior windows must agree with the exterior E
built — ask me for numbers rather than reading E's file"*, so I have asked twice
and am recording it here rather than asking a third time in prose.

**Library — the high arched windows:**

- sill height and head height above the interior floor
- clear width of each opening, and the arch's rise
- how many, on which walls, and their spacing or centres

**Church — the lancets and the rose:**

- lancets: sill and head height, clear width, count per wall, spacing
- the rose: centre height, diameter, and which wall it is in

Everything in both rooms that is not a window is being built now. The openings
are the only thing waiting, and they are the thing that has to agree with what E
already put on the outside.

---

## Not blockers, but still open and not mine

- **`ct/doors.ts` has no owner** and the door-drop class is still live:
  `civic-doors.ts`, `interior.ts` and `world.ts` resolve to an UNDEFINED
  namespace at collection time in the built bundle. Nothing is dropped today —
  `doors-declared` reads 10 of 10 — but the mechanism that lost GOLDEN ACES' door
  once is still there.
- **`props.ts:420`** computes `selfLit` from a material's texture only, so an
  untextured author-driven light cannot declare itself. One line, B's call:
  `const selfLit = isSelfLit(m.map) || m.userData.selfLit === true;`. Measurements
  in `notes/G-nightgrade-bulbs.md`.
