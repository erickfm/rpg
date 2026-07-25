# Builder A — "lazy and chopped off at points", and both halves were real

The user, on the thrift store. Routed to me: THRIFT is one of the four fronts
in my facade brief, so this is the brief not being met on that building rather
than a new request. Everything below is `ct/tex-world.ts`, which is mine — no
mandate needed and none taken.

## CHOPPED OFF AT POINTS — two faults, and the second one is the block's

The user's guess in the brief was exact: *"a band, a course, a sign, a fascia
running to the edge of its canvas and stopping mid-feature… it may affect the
neighbours too, since they share your painters."* Both happened.

### 1. The doorcase was stamped over a finished window (thrift only)

`thriftFront` painted the whole display — rail, garments, three price cards,
the taped crack — and then drew the door last, on top. The thrift's door sits
inside the glazed run, so the door frame swallowed the right half of the "50c"
card and cut the clothes rail through the middle of a hanger.

**A sign cut mid-word by something drawn after it is exactly "chopped off".**

Fixed by deciding where the door is FIRST and dressing the glass in the runs
either side of it. Nothing is now painted where something else will cover it.

### 2. `facadeWindows()` counted whole BAYS instead of windows (every building)

A fencepost, and it was in the world for months because it looked like a style.

```
cols  = floor((wMeters - 2*MARGIN) / BAY_M)          // whole bays
slack = (wMeters - 2*MARGIN - cols*BAY_M) / 2        // centred on the bays
```

`n` windows at 2.75 m pitch span `(n-1)*2.75 + 1.5`, not `n*2.75` — the last
bay's trailing gap is not part of the run. So:

- the run was centred on something **1.25 m longer than it was**, which put
  every facade on the block **0.625 m left of centre**, with the right-hand end
  carrying exactly `BAY_M - WIN_W` more blank brick than the left;
- a window that fits was dropped on **nine of nineteen** fronts.

Measured, before:

```
name        w     cols  L-margin  R-margin
DINER      12       3      1.88      3.13
THRIFT   12.5       3      2.13      3.38     <- the one the user photographed
No.227     18       5      2.13      3.38
PAWN       15       4      2.00      3.25
BODEGA     10       2      2.25      3.50
```

**Uniform across all nineteen**, which is why nobody ever read it as wrong —
everything was off in the same direction by the same amount, so nothing stood
out beside anything else. That is the kind of fault a picture cannot show you
and a number can. On THRIFT it was worst in ratio: the right end was 59 % wider
than the left, and only three windows on a 12.5 m front to hold it together.

After: THRIFT has four windows on 1.38 m margins, both ends equal.

### 2b. …and on a wall too narrow, the window ran off the end

`minCols = 2` asks for two windows on a narrow front so it does not read as a
blind wall. On the **bodega's 1.4 m corner pier** — narrower than one 1.5 m
window — it was laying them at negative x and drawing them straight off the
canvas. A window cut by the end of its own wall is the same complaint one more
level down. The run is now clamped to what the wall can hold, which on that
pier is nothing, and a blank corner pier is what it should have been.

## LAZY — the character front was carrying LESS detail than the default

This is the part I did not expect. Comparing `thriftFront` against the block
default in the same file:

| | default | THRIFT, before |
|---|---|---|
| transom over the glazing | yes | **no** |
| panelled stallriser | yes | **flat slab** |
| door handle | yes | **no** |
| mullion bays | `w / 3.4` | `w / 4.5` (fewer) |

The block default is supposed to be the quiet one — a barber, a deli, a laundry
next to the four that have a character. THRIFT is one of the four the user
asked to be BETTER, and it had less built into it than its quiet neighbour.
That is the "lazy" complaint stated precisely, and it is measurable rather than
a matter of taste.

Also, and this is the one worth remembering: **the garments were a rounding
loss, not a taste.**

```
hanger width  m(0.30) -> 5 texels
hanger step   m(0.34) -> 5 texels        at 16 px/m both round to the same
```

Step equalled width, so the rack drew as one unbroken stripe of colour with no
daylight between the hangers. It read as painted-on because it *was* a painted
stripe. The gap is counted in texels now, so it survives.

Added, all of it inside `thriftFront`: transom over the glazing and over the
door, panelled stallriser, door handle, an OPEN card on the door glass, price
stickers stuck straight on the glass, and **a mannequin** — the brief asked for
one by name, and it is the only thing in that window that is a figure rather
than a rectangle. It stands in front of a cleared patch of rack, and its
position is the middle of the widest gap **between the price cards, measured**
rather than picked: a hand-chosen fraction goes stale the moment a card moves,
and a card taped over its head would hide the one silhouette in the window —
which is fault #1 again, one layer up.

The fascia's sun-bleaching had the same fragment-at-the-end shape (a fixed
0.5 m pitch stepped across the canvas overruns onto the brick whenever the
board is not a whole number of steps). It divides the board's own width now.
THRIFT happened to divide exactly; the next width would not have.

## The guard: `scripts/facade-run.mjs`

Registered in `checks.mjs`, with `--selftest`, watched failing on purpose.

```
57 facades judged (1 too narrow for a window, skipped)
   run not centred: 0
   run off the wall: 0
```

It reads `userData.windows`, which now carries `runX0 / runX1 / W` and is
stamped on **both** sheets — the dark facade as well as the lit one. Stamping
only the lit half would have left it blind to exactly the narrow returns and
piers where the run can fall off the end, since those never get a lit sheet.

**It does not re-measure the run off the canvas, deliberately.** The fencepost
survived because the only way to ask "is this composition centred?" was to redo
the arithmetic that was wrong, and re-deriving a wrong number cannot catch it.
So the painter says where its windows start and end, and the check asserts the
property: equal brick at both ends, and the whole run inside the wall. Same
move as `userData.masonry` in `A-density-stamp.md` — whoever knows, says.

The selftest shifts a published run five texels and requires the check to
notice; it does, at `9 texels of brick at one end, 19 at the other`.

## What moved, and what did not

```
textures   954 vs 954 — 56 differ
structure 3489 vs 3489 — same geometry, material colour only
tints     3489 vs 3489 — 3 differ (the casino chase, as always)
places    3489 vs 3489 — 7 differ, every one within 5 cm: pigeons
```

All 56 changed textures are facade-sized (85/104/109/118/123 px tall — 8 px/m
walls) plus the single 200×67 thrift band. **Zero props, zero ground, zero
interiors.** Object count identical, geometry identical — so this adds no
collision and moves no floor, and there is nothing here that needs walking.

## One red in the suite, and it is not this change — but it is mine

`npm run checks`: everything green except `nightgrade`, on

```
1 materials were graded by dimWorld and did not move
   0.096 at 48.8,3.8,-97.7   0.00x0.00   tex ?x?
```

Run on its own, four times in a row, it is **green every time** — `0 materials
did not move`. So it is a flake, and the object is a degenerate 0×0 untextured
mesh out at the casino/hotel end of the side street, nowhere near a facade and
nothing this change touches.

I think I know the mechanism and it is the one that bit me before. The
casino/hotel chase recolours shared phase materials off **frame** time — the
same animation that made my `structure` fingerprint unstable in
`A-fingerprint.md`. `nightgrade` samples a colour at 13:00 and again at 23:00
and asks whether it moved; a material the chase happens to have driven to the
same value at both samples reads as "graded and did not move". The
`translucent` figure bears it out — 0.401 in the red run, 0.253 and 0.521 in
green ones, on identical code.

**I am not fixing it inside a thrift-store commit**, and I am not calling the
suite fully green either. It is my script, it cries wolf, and it belongs on my
queue as its own item: `nightgrade` should exclude materials the chase owns, or
sample them at a pinned frame, the way `scenedump` had to.

## For the desk

Two things worth routing rather than assuming I have covered them:

- **Nine buildings gained a window.** That is the fencepost fix doing what it
  says and I believe it is right — the block reads denser and better composed —
  but it is a visible change to eighteen facades the user did not ask about,
  and it should be in front of them as a change, not smuggled in under a thrift
  store fix.
- **The other three character fronts have not been audited against the default
  the way THRIFT just was.** THRIFT was missing a transom, a panelled
  stallriser and a handle that the quiet default has. I have not checked
  whether `dinerFront`, `burgerFront`, `pawnFront` or `taxFront` have the same
  gaps, and "the character front has less in it than the plain one" is a fault
  that would look like a style from outside — exactly like the fencepost.
