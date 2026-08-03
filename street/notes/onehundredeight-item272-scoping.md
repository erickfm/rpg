# Item 272 — SCOPED, NOT FIXED. It is cause (2), occlusion, and a billboard cannot be fixed by redrawing it

Worker **onehundredeight**, 2026-08-03. Port **4642**, **built bundle**.
**I released this item rather than finishing it** — see §5. Everything below is
measured or photographed; no `src/` file was changed.

The user: *"people sitting still looks bad because they have no legs??"*

---

## 1. The row's three candidates: (1) and (3) are FALSE, (2) is TRUE

The row was right to refuse to name a cause, and right that the obvious one was
already false. All three are now settled.

### (1) "the flag is not set for these figures" — FALSE

`int-diner.ts:295` passes `{ seated: true, y: 0.45, facing: … }`, and
`interior.ts` forwards it (`o.seated ? { ...look, seated: true } : look`).

**Proved from the world, not from the source.** `citizenPlane` translates the
geometry differently for the two poses, so the composed sprite's world span is a
fingerprint of which pose was built. Measured in the diner:

```
sitter at (761.19, 2.02)   sprite spans y -0.144 … 1.756      <- SEATED origin (hip)
sitter at (762.50, 2.02)   sprite spans y -0.144 … 1.756      <- SEATED origin (hip)
waitress at (758.60, -2.55) sprite spans y -0.115 … 1.728     <- STANDING origin (shoe)
```

−0.144 = 0.45 − 0.594, and 0.594 is exactly the seated translate
(0.95 − (44/64)×1.9). The seated pose is in use.

### (3) "the figure sits too high" — FALSE

The painted shoe is row 59 of 64 over H = 1.9, i.e. 0.148 m above the plane's
bottom edge. From the measured span that puts both sitters' shoes at
**y = 0.005** — on the floor, to within half a centimetre.

**And the item-106 precedent does not repeat here.** I checked it specifically,
because the row asked me to: the diner bench is `BoxGeometry(0.55, 0.45, 1.5)`
placed at `y = 0.225`, so its **top face is 0.45**, and the sitter is placed at
`y: 0.45`. The seat is registered to its top face, not its middle. Measured in
the world: **all 6 bench tops read 0.450.**

### (2) OCCLUSION — TRUE, and here is the controlled experiment

`scripts/probes/w108-272-what-hides-the-legs.mjs` shoots **one camera, two
frames**, changing nothing but the `visible` flag on every bench, backrest and
table in the room:

- `shots/w108-272-before-A-as-built.png` — both sitters are cut off dead level
  with the bench top. Solid red vinyl below. **This is the user's screenshot.**
- `shots/w108-272-before-B-furniture-hidden.png` — **the same camera, same
  sitters: full legs, both feet on the floor.**

The legs are drawn. The bench eats them.

(Using `visible` here is legitimate and is *not* GOTCHAS 79: that entry is about
using a rendering fact to answer an **authoring** question. This IS a rendering
question — "what is in front of what" — and `visible` is the right instrument
for it.)

## 2. Why the bench eats ALL of them, which is the part that matters

The sitter stands at the **centre of the bench box**, and the box is exactly as
tall as the hip:

| | |
|---|---|
| bench | 0.55 (x) × **0.45** (y) × 1.5 (z), top face **0.45** |
| sitter | placed at the bench's centre in x and 0.22 m in from its aisle end |
| seated legs | drawn from the hip at **0.45** down to the shoe at **0.005** |

So the legs occupy 0 … 0.45 m — **precisely the volume of the cushion** — at the
box's own centre. The sprite billboards about a vertical axis through that
point, so **there is no horizontal direction from which the legs are outside the
box.** Not a bad camera angle: every angle.

And the art cannot reach out of it. At FW = 32 over a 0.95 m plane, one texel is
**0.0297 m**. The furthest-forward seated pixel in the whole atlas is the profile
shin at `cx + 7` = **0.21 m** from the hip (`citizens.ts:118`), against a bench
half-depth of **0.275 m**. The side view — the one you get standing in the aisle,
because a booth sitter faces across the table and the aisle runs at right angles
to that — falls **6.5 cm short of the cushion's front edge.** Every other view is
worse: the non-profile branch draws the lap as a wide mass and the shins at
`cx ± 1…5`, i.e. **0.15 m**, straight down.

## 3. Therefore: THIS CANNOT BE FIXED BY REDRAWING THE ATLAS

This is the finding I would most want the desk to have.

The sprite is **one flat plane that billboards about the hip**. A seated person's
lower body is *in front of* their hip in world space — that is the whole reason
it is visible past a seat. A single billboard has one depth, so **any pixel it
paints is at the hip's depth**, and pushing the legs further out in the texture
only moves them sideways on screen, still inside the box.

Redrawing the legs longer would make them stick out *horizontally* and read as a
person doing the splits. I started that change and stopped, because it makes the
picture worse for a reason the picture would not explain.

**Three fixes that would actually work**, cheapest first:

1. **Stand the sitter at the FRONT of the seat, not its centre.** One expression
   in `ct/int-diner.ts` — offset the person (not the registered seat) forward
   along their facing by roughly half the seat depth. The torso then reads as
   leaning to the table, which is what a diner customer does. **Cheapest, and it
   is one line, but it is in a file this item does not name** (BUILDER-BRIEF §9),
   and it fixes the diner only — the church, jail, casino, bank and library all
   place sitters the same way and will all want it.
2. **Move the offset into `ct/citizens.ts`, which is where the item points and
   where the principle already lives.** `citizenPlane`'s own docstring says *"the
   ORIGIN MOVES with this flag … a caller passes the SEAT it already registered,
   never a hand offset"* — this is the same rule one step further: a seated
   sprite should stand at the seat's front edge, offset along `facing`, and
   `citizenSprite` is the only place that knows `facing`. **The obstacle is the
   contract:** the caller sets `mesh.position` *after* `citizenSprite` returns,
   so the offset has to be applied in `update()` (which already rewrites
   `rotation.y` every frame) or the constructor has to start owning position.
   Either is a real change to a primitive that **eleven rooms** call, and it must
   not accumulate across frames. That is what I would do, and it is not a
   twenty-minute job.
3. **Two planes** — torso at the hip, legs on their own plane offset forward.
   Correct, most expensive, and it doubles the draw calls for every person.

## 4. What I would NOT do

**Do not shorten or thin the bench box.** The bench is what the player collides
with and sits on, and item 106 has already been round this loop once. The
geometry is right; the sprite is in the wrong place.

**Do not raise the sitter.** The shoe is at 0.005 m. Lifting the figure to clear
the cushion would float it, which is the exact defect `citizenPlane` was written
to end (the old 12 cm float), and the user would report *that* instead.

## 5. Why I stopped

The row's DONE WHEN asks for *"a seated citizen reads as seated with legs from a
normal standing view"*. Getting there means option 2 — changing the placement
contract of a primitive that eleven rooms call — and then re-checking every one
of them, including the seated work that landed **today**: item 93's
already-occupied seats (church 18/17/1, casino 87/83/4) and item 150b's
sprite-width clearance, both of which the row explicitly warns not to break.

I have the diagnosis, the experiment and the arithmetic, and I do not have the
room left to change a shared primitive and re-walk eleven rooms behind it. A
half-applied offset that fixes the diner and floats the church is worse than not
starting.

**Released, not marked done. Nothing in `src/` was changed for this item.**

## 6. Instruments left behind

- **`scripts/probes/w108-272-what-hides-the-legs.mjs`** — the A/B experiment.
  One camera, furniture visible then hidden, restored afterwards. Also prints
  each sprite's true world span **from its geometry bounding box**, not from
  `position ± h/2` — the plane is translated so its origin is the hip, and the
  naive span is wrong by 0.36 m, which is how my first pass mislabelled a
  correctly-placed sitter as floating.
  **Two bugs of my own it caught, both worth knowing:** a fixed
  `triangles > 3000` gate times out indoors on a perfectly painted frame (a
  small room facing a wall draws a few hundred — use `waitPainted`); and
  `yaw = atan2(dx, dz)` faces you the *opposite* way (`fwd = (sin y, 0, −cos y)`
  needs `atan2(dx, −dz)`), which made both frames come back **byte-identical**
  photographs of a blank wall.
- **`scripts/probes/w108-item272-diner-legs.mjs`** — four frames from normal
  standing vantages, plus the bench/backrest census. `…-before-across.png` is
  the closest thing to the user's own frame.
