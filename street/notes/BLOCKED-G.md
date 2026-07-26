# BLOCKED — builder G

Two blockers, both one line in somebody else's file, both on the library and
church that just moved to me. I am building everything that does not depend on
them meanwhile; this file exists so the two asks are visible rather than buried
in prose.

---

## 1. The library's STAIR needs `buildRoom` to accept a floor function

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
