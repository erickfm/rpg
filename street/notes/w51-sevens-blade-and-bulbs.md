# w51 — item 132, the SEVENS blade and the bulb chase

> The user, on the now-legible facade: *"casino sign still a lil janky. maybe we
> get rid of the one on the side here? add more flair to the bulbs themselves
> instead?"*

File: `src/proto/ct/vice.ts` only. Port **4183** (`vite preview`, the built
bundle) — 4183 was probed free (`000`) before use and is shut down at the end.

## Root cause, one line each

- **The blade:** it stood edge-on to the road, so from his station the only
  thing it ever showed him was its 0.34 m cabinet laid down the left third of
  the elevation — halving the parapet run and hiding the west chevron outright.
- **The bulbs:** the chase had exactly one behaviour and had had it since it was
  built — every third socket alight, marching one step at 6 Hz, forever, on both
  buildings. There was nothing to notice twice.

---

## Part 1 — the blade. Removed, and the premise it was ranked on is false

He phrased it as a question, so it was answered with a frame before it was
answered with a deletion. `scripts/probes/w51-frontage-without-blade.mjs` hides
the blade **at runtime** and shoots three stations, so the answer cost nothing
while it was still a question. It selects the blade by footprint — x 55.75..56.35,
above 5 m, and standing *proud* of the facade (`bbox.min.z < -96.5`). That last
clause is load-bearing: without it the selection also strips the cornice run
passing behind at z −96.16, and you end up judging a frontage with its parapet
lights turned off. It caught **43 meshes: 1 cabinet, 4 arms, 4 stays, 2 art
faces, 1 riser, 31 bulbs** — the blade exactly, nothing else.

**Verdict from his own station: not close.** `shots/w51/blade-off-hero.png`
against `blade-on-hero.png`. Off, the frontage reads as one lit rectangle —
CASINO, the framed name, 777 between two chevrons, the marquee — which is the
composition item 97 built and which the blade had been standing in front of.

### THE ITEM'S STATED COST IS WRONG, AND IT WAS THE REASON TO KEEP IT

The item says *"the blade is the tallest thing on the building and reads from
down the street, so removing it may leave the frontage flat from a distance"*.
Measured:

| | top |
|---|---|
| the blade | **21.4 m** |
| the rooftop board | **26.0 m** |

**The blade was never the tallest thing on the building — the rooftop board
clears it by 4.6 m**, and that board carries SEVENS in bulb-outlined letters on
both faces. The skyline mark was never the blade's job, and the source has said
so all along: the pylon's own comment reads *"still the skyline mark at 26 m …
the blade below it does a different job"*. So there is nothing to propose as a
replacement for the height; the height did not move.

What the long view actually loses is visible in `shots/w51/blade-on-far.png` →
`blade-off-far.png`: a second SEVENS three metres from the first, crowding
HOTEL ORPHEUS' blade for the same corner. `blade-on-down.png` → `blade-off-down.png`
is the clearest of the three — with the blade in, the building says its own name
twice within 3 m in two different typefaces.

**Two things went with it, because they only existed because of it:**

1. **Its ground spill** — a 4.0 × 3.4 m red wash at x 56.05. A spill is the
   ground's account of what is lit above it; left in, it is a red pool thrown by
   nothing.
2. **The east riser inset.** The east pair sat at 1.35/2.05 m rather than the
   west's 0.55/1.25 *solely* because the blade occluded that corner — the source
   said so. Restored to 0.55/1.25, so the elevation is symmetrical again.

**ITEM 121 IS UNAFFECTED.** It gives HOTEL ORPHEUS' blade the same leading-edge
fix. ORPHEUS is a different building, the user has not commented on it, and its
blade does not duplicate a name painted two metres away. Nothing here cancels it.
Item 97's leading-edge idiom is also not retired — `riser`'s `z`/`w` parameters
stay and the rooftop board still uses both.

---

## Part 2 — the bulbs. The real ask

At 8 px/m a bulb is one or two texels, so **there is no detail to add to a bulb**
— the only thing a sign at this resolution can vary is what the light *does*.
The chase became a **program on the existing clock**, using the existing
materials at the existing draw cost. A mode only changes which phase classes are
lit this frame:

```
chase 3.6s | alt 1.6s | chase 2.4s | flash 1.6s | back 3.2s | on 0.8s   = 13.2 s
```

- **chase** — a two-socket comet running along every run
- **alt** — odd and even sockets trading at 5 Hz, the shimmer
- **flash** — every socket on *both* buildings on and off together, four times
- **back** — the comet, running the other way
- **on** — everything held lit, to end the loop

Three decisions worth keeping:

- **`PHASES` 3 → 6, and it must stay EVEN.** A bulb's parity is
  `(i % PHASES) % 2`, which equals `i % 2` only for even `PHASES`; at 3 the odds
  and evens never separate and `alt` reads as a stutter.
- **`COMET = 2` of 6 holds the same 1/3 duty the 3-phase version had**, so the
  building did not get darker in order to get livelier — the light is gathered
  into a travelling pair instead of spread as an even stipple.
- **The comet steps off the global clock, never off time-within-mode.** Otherwise
  returning to `chase` after a flash snaps every run in the world back to socket
  0 at once. `flash` is the one mode that wants mode-local time: a blink has to
  start on its own beat.

Dud sockets are untouched and still never light, **including through `flash` and
`on`** — that is the whole point of a dud. `deadEvery` is 23/19/17 at the three
runs that use it, all coprime with 6, so no dud rate collapses onto one class.

---

## Proof

**`scripts/probes/w51-chase-program.mjs` is the check that can fail.** It reads
the lit pattern off one real run of sockets for a full loop and asserts every
mode was observed. On this build: **PASS, exit 0** — 205 comet / 59 alt / 29
all-lit / 15 all-dark / **0 unclassifiable**, comet travelling 56 steps forward
and 22 backward, on the casino's 27-socket crown run with its 1 dud.

**Positive control, by mutation:** `PROGRAM` collapsed to a single
`['chase', 13.2]`, rebuilt, re-run → **exit 1**, naming *no `alt`*, *no all-lit*,
*no all-dark*, *comet never travelled backward*. Source restored from a copy and
rebuilt; `git diff` clean against the committed version.

Deterministic per-mode frames, `shots/w51/mode-*.png`, with the socket pattern
printed alongside each:

```
comet       ..##....##....##....##....#
alt         #.#.#.#.#.#.#.#.#.#.#.#.#.#
flash-on    ###################.#######      <- position 19 is the dud
flash-off   ...........................
back        ...##....##....##....##....
hold-on     ###################.#######
```

- `npx tsc --noEmit` clean, `npm run build` clean.
- `node scripts/bugsweep.mjs` on the built bundle: **0 STATION MISS, 0 COVERAGE**,
  96 shots, exit 0.
- `node scripts/health.mjs`: `WORLD OK`, exit 0.
- **`node scripts/G-vice-walk.mjs`: 18/18 passed** — the frontage *walked* to
  z −96.7, both `[E]` doors still agree with their painted entrances and still
  put you inside, the pavement light still ramps, every street-facing sign is
  still a back-to-back pair (3 now, not 4), and the chase and dud checks pass.
  Nothing this change touched is below 5.6 m except a ground decal, so the 2 m
  lane is untouched — and it was walked rather than assumed.
- Night frames from his own station: `shots/w46/w51-before-hero.png` →
  `w51-after-hero.png`. Day at `w51-day-hero.png`.
- **`fp`/`fpdiff` deliberately not used**: this change removes 43 meshes and adds
  three phase materials, which is precisely the case GOTCHAS 75 says the texture
  hash cannot survive.

### My own verdict on the after-images

`w51-after-hero.png` is the shot I would defend. The frontage is now one lit
rectangle read top to bottom instead of a composition with a black-and-red post
through its left third, and both chevrons are visible for the first time from
this station. The corner risers being symmetric is a smaller thing than I
expected it to be and still right.

The flair is real and I checked it as an image, not just as a number:
`shots/w51/parapet-strip.png` stacks all six modes on the same run of sockets.
`flash-on` → `flash-off` is a genuine blackout, not a dim-down, and it is the
beat that will make him look up. The comet reads as a travelling pair rather
than a stipple, which is the improvement to the *resting* state — it matters
more than the events, because it is what the sign is doing most of the time.

What I am least sure of: **13.2 s may be too long a loop.** Standing there, you
wait about 7 s from a cold start for the first flash. I would rather he saw it
sooner, but a marquee that flashes every four seconds reads as a fault, not as
flair. If he says it feels static, shorten `['chase', 3.6]` first.

---

## The dark angular shape — IDENTIFIED, not fixed

It is the **rooftop board's cabinet**: `frame`, a `BoxGeometry(0.5, 6.6, 7.2)`
at x 51.23, **y 19.4 .. 26.0**, z −97.9 .. −90.7, in near-black `boardM`. It is
not the blade top and it is not unattached.

Located by **raycast-equivalent projection through the pixels it occupies** in
his own hero frame (`scripts/probes/w51-what-is-the-sky-shape.mjs`) rather than
by a bounding-box signature sweep — w46's method searches for "tall and thin
near the facade" and **cannot see this at all**, because the thing is against the
sky.

**Why it reads as floating, geometrically:**

- Its artwork is on the two ±x faces (184×148). From the road you see its
  **0.5 m × 6.6 m −z end**, which is unlit board.
- Its supports — two uprights at z −95.5/−93.1 and two raked braces — are
  `#09080a`, **near-black**, and sit **2.4 to 4.8 m behind its leading edge and
  2.2 m below it**. At the steep upward angle from the pavement the board's own
  mass occludes them completely. So the structure that would explain it is both
  hidden and the same colour as the sky.

This is the *same defect class* item 97 fixed on the blade, and w46 already
treated it once — there is a riser and a soffit bulb run on it. What is left is
that the leading edge gets ~12 sockets over 6.6 m against the blade's 31 over
15.8 m, less than half the density, on a face half again as wide.

**I did not fix it.** It is a geometry change on an object the item did not name,
and the item asked for it to be *identified*. It does get better for free: those
sockets now participate in `flash` and `on`, so twice a loop the board's whole
outline lights at once, which reads as an object far better than a 1/3-lit
stipple did.

**For the desk to queue**, precisely: give the rooftop board's −z leading edge
the blade's socket density (~0.35 m pitch rather than 0.5 m), and light its two
uprights — either in `steel` rather than `#09080a`, or with a tube — so the sign
has visible legs. It is worse by **day** than by night (`w51-day-hero.png`): a
black wedge against a pale grey sky, with no lit sockets to break it up at all.

---

## Found and NOT fixed

1. **The rooftop board**, above.
2. **`w46-facade-shot.mjs`'s `wide` station is still broken and it is not mine.**
   x 51.2, z −112 fails its own warp-landed-where-I-asked check by **9.12 m**,
   identically before and after this change, so it is pre-existing and unrelated.
   w46 filed it too (its note, item 3) and it has not been picked up. It refuses
   to file the frame rather than photograph somewhere else, so it costs
   correctness nothing — but it means **nobody has a whole-frontage wide shot of
   this building**, which is the one view that would have settled the blade
   question fastest. Something is pushing the camera out of that point.
3. **Two instrument faults I hit and fixed inside my own probes**, both now
   documented in their headers, because both are general:
   - Grouping bulbs by *material reference* recovers the six phase classes but in
     **arbitrary order**, and every question worth asking (contiguous? travelling?
     which way? parity?) is a question about class order. It reported 209 of 330
     samples unclassifiable against a world that was working correctly. The fix is
     to recover the order **physically** — along any straight run, consecutive
     sockets are consecutive classes.
   - A screenshot triggered by `waitForFunction` on world state still lands
     **50–200 ms after** the trigger, which is longer than a `flash` half-beat, so
     two frames came out **with their labels swapped**. Freezing
     `performance.now()` — the program is a pure function of it — makes the
     capture deterministic and lets the frame be chosen rather than caught.
4. **Values copied, not derived:** the `PROGRAM` table is duplicated into
   `w51-mode-frames.mjs` to pick the freeze times. It is a module-local `const`
   inside `placeSigns` with no export, so it cannot be imported without editing a
   file this item does not name (BUILDER-BRIEF §8). It is cited by name in that
   probe's header. A follow-up could export it; nothing else needs it yet.
