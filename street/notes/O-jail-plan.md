# The jail, drawn on paper

**Builder O · written while BLOCKED on the site ruling · no mesh built.**

The site is `notes/O-jail-site.md` and is not settled. **Nothing here depends on
which site wins** except the door's normal and the frontage width — the room
lives in its own 80 m slab at `x ≥ 400` either way (`ct/interior.ts:41`), and
GOTCHAS §45 is explicit that the constraint is *which side the door is on*, not
the dimensions: *"Take the room you need."*

This exists so that when the ruling lands I build rather than think. It is also
the thing to argue with **before** it is geometry, which is cheaper.

---

## The bar

> *"the jail should be extremely try hard"*

The desk's reading, which I am building to: **a 1997 city lock-up, not a fantasy
dungeon and not a modern precinct**, and *"the interesting part of a jail is the
threshold between the public half and the locked half; build that."*

So the room is organised as a sequence, not as a box with things in it. You come
in off the street, and the building tells you three times that you are on the
wrong side of something.

---

## The room, in plan

Local frame, as the kit has it: **`+z` is toward the door**, `-z` is the back
wall, `+x` is your right as you enter. `hd = D/2`, so the front wall is `+hd`
and the back wall is `-hd` — the idiom in `ct/int-tax.ts:61`.

```
  -hd  ┌───────────────────────────────────────────────┐  BACK
       │  cell 3   │  cell 2   │  cell 1   │           │
       │  ▓▓bars▓▓ │  ▓▓bars▓▓ │  ▓▓bars▓▓ │  mop sink │
       ├───────────┴───────────┴───────────┤           │
       │                                               │   ← THE CELL BLOCK
       │            the corridor                       │     (locked half)
       │                                               │
       ╞═══════════╤═══════ barred gate ═══════════════╡   ← THE THRESHOLD
       │  hatch    │                                   │
       │ ┌─────────┴────────── glazed screen ────────┐ │
       │ │        the counter · desk sergeant        │ │   ← THE COUNTER
       │ └───────────────────────────────────────────┘ │
       │                                               │
       │   bench ▂▂▂▂▂▂▂▂       notice   payphone      │   ← THE LOBBY
       │        (someone waiting)  board               │     (public half)
  +hd  └──────────────────  ▓door▓  ────────────────────┘  STREET
```

**Dimensions.** `w` follows the frontage and does not grow — the user's rule,
quoted at `ct/int-casino.ts:144`: *"KEEP THE FRONTAGE WIDTH, GROW THE DEPTH,
hard"*, and growing the width is what got the casino sent back for being 1.96×
the building it sits in. On the east cap the frontage is 14 m, so **`w = 12.8`**
(`roomWidthFor(14)`), **`d = 26`**, **`h = 3.3`**.

`h = 3.3` against the kit's *"2.9 is a shop"*: a civic room is taller and colder
than a shop, and the height is what makes a lobby echo. It is the opposite
decision to the casino's low ceiling and for the same reason — height is
psychology. Not higher than 3.3, because the cell block wants to feel **low**
by contrast and it shares the ceiling.

**One flat floor. No stair, no step, deliberately.** GOTCHAS §7 says a level
change means re-deriving a floor picker and is verified by walking, and §48 is a
whole entry about a probe misreading a 1 m ramp. A lock-up needs neither. The
one place a step would earn itself is the street threshold, and it does not
get one either — see the exterior below.

---

## The three zones, and what is in them

### 1 · The lobby — `lz` +hd … +hd−7

Public, and built to be unpleasant to wait in.

- **A bench against the west wall**, bolted, no back, the seat top at **0.46 m**
  — the height `notes/H-seated-sprite.md` measured 48 of the world's seats at,
  so a sitter's feet reach the floor with no fudge.
- **Someone waiting on it**, seated. `room.person(look, lx, lz, { seated: true,
  y: 0.46 })`. Not a criminal — somebody's mother, coat on, bag on her knees,
  waiting a long time. That single figure does more for the room than the bars
  do.
- **A notice board** — the tax office's `boardT` idiom (`int-tax.ts:266`): tilted
  paper, nothing legible, everything faded. Bail bond cards, a missing notice.
- **A payphone** on the wall, cord hanging.
- **A wall clock**, through `room.clock()` — the kit primitive, so it agrees with
  the wristwatch and every other face in the world. A lobby you wait in needs a
  clock more than any other room in the game.
- **A bin, a radiator, a scuffed floor.** The floor is composition tile with the
  pattern walked off it in a path from the door to the counter, which is the
  detail that says how many people have crossed this room.

### 2 · The counter — the threshold, and the point of the room

Full width bar the hatch. **Glazed screen from counter top to ceiling**, with a
**speak-hole** and a **paper slot** — the two things that make a screen read as a
screen rather than as a window. A **hinged hatch** at one end, closed.

- **The desk sergeant behind it**, standing at the counter, **facing the door** —
  derived from what he faces, in world terms, never copied from a sibling
  (GOTCHAS §33). Uniform: navy jacket, `fit: 'cap'` with a dark accent, `build:
  +1`. The atlas needs no extension for this, which I checked before assuming.
- Behind him: a **key board**, a **radio handset**, a **ledger open on the
  counter**, a **typewriter**, a **wall of forms**. Institutional green to the
  waist, magnolia above.
- The glass is **`transparent`, no `alphaTest`** — GOTCHAS §22 is explicit that
  setting both moves a `DoubleSide` mesh into the sorted queue and buys nothing.
  This is genuine translucency and gets `transparent` alone.

### 3 · The cell block — `lz` −hd+? … −hd

Through the **barred gate** beside the counter. **The gate is open; the cells
are not.** That is the decision I would most like the desk to overrule me on if
it disagrees, so here is the reasoning:

- A player who can see the interesting half and never reach it reads it as
  unfinished, not as forbidden.
- The locked thing should be **the cell**, which is correct and is the whole
  image: you walk the corridor, you look through the bars into a cell you cannot
  enter, and the bunk is made up for somebody.
- **No way to get arrested, per the desk.** The cells are a place, not a
  consequence. Nothing here puts the player on the wrong side of a bar.

Three cells down one side, each with:

- **bars you can actually look through** — vertical bars as geometry on a
  spacing wide enough to see between at ~8 px/m, not a painted bar texture.
  A painted bar plane is the same mistake as the flat waitress.
- a **bunk** with a thin mattress and a folded blanket, a **basin**, a **stool**,
  a **window slot** high in the back wall with its own bars, and daylight
  coming through it at the angle the world's sun is at.
- **one prisoner**, seated on the bunk in the far cell, elbows on knees, and
  the other two cells empty and unmade. Three occupied cells is a set; one
  occupied cell is a place where somebody is.

**Light: `troffer`, with one `dead`.** The kit takes `light: { kind: 'troffer',
dead: [1] }`, and *"a room where every light works is a room that has a
facilities budget, which is a thing some of these places conspicuously do not
have"* (`ct/interior.ts:369`). A jail is that room.

**Wainscot: tiled, `h: 1.35`, institutional green.** The kit's own note says a
commercial room that is plaster to the floor reads as a bedroom, and this is
the most tiled-to-the-waist building type there is.

---

## The exterior

**Civic and unwelcoming — the one building on the block you do not want to
enter.** It closes the vista of the side street, so it is read at 20–60 m as a
silhouette first and as detail second, and it should be legible at both.

| | |
|---|---|
| **mass** | three storeys, ~12.6 m to a solid parapet — heavier and squatter than SEVENS' 13.0 m beside it, so it reads as a different kind of building rather than as more of the block |
| **base** | rusticated stone to the first floor, deeply coursed. Real texture at the block's density, not a flat grey — the queue is explicit: *"A blank grey wall in a jail will read as unfinished, not as institutional"* |
| **above** | dark engineering brick, small windows, deep reveals |
| **windows** | **barred, and the bars are geometry** — small, high, and in a grid too tight to pass. The first-floor windows are the ones that say what the building is from 40 m |
| **door** | a recessed **sally-port**: steel double leaf, no glazing, in a stone portal. `DoorLeaf { clearW: 2.0, h: 2.5, leaves: 2, frame: steel, glazing: 'none' }` — declared once and read by both sides (`ct/doors.ts:70`) |
| **lamp** | one over the door, on at night with the world |
| **plate** | a cast municipal plate over the portal |

**The plate reads `CITY OF CROSSTOWN · HOUSE OF DETENTION`.** Asymmetric on
purpose — GOTCHAS §10 is a `HOTEL` blade sign that shipped mirrored because
`H`, `O` and `T` hide it and only the `E` and `L` gave it away. `HOUSE OF
DETENTION` has `S`, `F` and `N` in it, so a mirror is visible from the first
frame. It goes up as **two back-to-back single-sided planes with the SAME
texture on both** — GOTCHAS §35, and specifically *not* flipped on the rear,
because the rotation has already done the mirroring and flipping it again
un-does it.

**No stoop, and this is a trade rather than an omission.** A civic building
wants two risers up to its door. Two risers is a floor-picker change (GOTCHAS
§7), it is the exact shape GOTCHAS §48 spent an entry on, and
`ct/civic-doors.ts` exists because *"Do NOT leave a flight of steps that leads
to nothing"*. The sill goes flush with the pavement for the first landing. If
the desk wants the stoop it is a clean separate item and I will build it with a
`ctx.ground` registration and walk it up and back down.

---

## Two things I would like but am not building unasked

- **A police cruiser at the kerb outside.** `ct/cars.ts` is H's and has no such
  `CarKind`. It would be worth more than any three details on this list, and it
  is one variant in somebody else's file — so it is a request to route, not a
  thing to reach for.
- **Light spilling out of the lobby door at night.** The lamp is mine; the
  street's night grading is not.

---

## How I will know it is good

The queue's own standard, from `notes/queues/README.md`: *"take screenshots
yourself and grade it and make sure you are impressed with it. be skeptical"* —
and *"if you are not impressed, do not report it done."*

Concretely, and these are the shots I will take before reporting anything:

1. **From 40 m and 20 m down the side street** — does the building end the
   street, and can you tell what it is before you can read the plate?
2. **From the pavement at its foot**, looking up — do the bars read as bars?
3. **Standing at the door**, the moment before pressing E.
4. **Arriving inside**, which is the frame the kit puts you in and the one the
   user will screenshot first.
5. **At the counter**, from where a person actually stands to be spoken to —
   is the sergeant looking at me or past me (GOTCHAS §33: *"stand where a
   player stands and ask, is it looking at me or away from me"*).
6. **Down the corridor, and into a cell through the bars.**
7. **Both sides of the counter and both sides of the gate** — GOTCHAS §41,
   *"the mirror is where the bug hides"*.
8. **At night**, because half this world's rooms have only ever been graded at
   one o'clock in the afternoon.

And the two structural ones, which are not screenshots: `npm run fp` before and
after to prove the module's `rnd()` draws moved nothing in the existing world
(GOTCHAS §2), and a walked check — not a looked-at one — that the door's `[E]`
fires from the pavement, that the way out lands you back on it, and that the
2 m lane past the frontage survives (GOTCHAS §9).

— O
