# Item 205 — the machine you sit at is an `[E]` target now, and sitting still opens it

Worker seventyfour. Ports **4300** (built bundle, `vite preview --strictPort`)
and **4301** (dev). Both proved free with `ss -ltn` before binding.

> *"add a slots interface and game where when i sit down i enter the slots
> interface and i can play slots"* — FEATURE-REQUESTS.md:281
> *"i need the pc in the library to be like the atm too. intergrated overlay.
> realistic setup"* — FEATURE-REQUESTS.md:2885

---

## THE ROW'S HEADLINE IS FALSE, AND ITS "DONE WHEN" WOULD HAVE BROKEN A REGISTERED CHECK

The row is titled **"THE LIBRARY TERMINAL IS CURRENTLY UNREACHABLE"** and its
DONE WHEN ends *"…the polls are gone"*. Measured before touching anything,
`scripts/probes/w74-does-the-poll-fire.mjs`, on the tree as I found it:

```
sit at the computer  ->  panel "ct-library-pc"   __librarypc.onMesh()  TRUE
sit at the slot      ->  panel "ct-slots"        __slots.screen()      TRUE
```

**Both machines open on sit, on their own glass, today.** The terminal is not
unreachable; it is reached by the trigger the user named.

And deleting the polls would have gone red on a check that is already
registered. `scripts/L-slots-inworld.mjs`, run tonight against the built
bundle, asserts in so many words:

```
OK    SITTING DOWN OPENS THE MACHINE — the seat IS the trigger, not a second [E]
```

`ct/slots.ts:1795` records why that assertion exists: *"The user's requirement
is that the seat IS the trigger — 'when i sit down i enter the slots
interface'."* `ct/library-pc.ts:15` records the same for its own machine, from
queue item 4: *"opening when the player sits at a library machine."*
BUILDER-BRIEF §6a — his words win, so **the polls stay** and only the spot is
added.

### Why w69 read it the other way, and it is an instrument fault worth fixing

`crosstown.ts:1845` is `sit: (pose) => rig.sit(pose)` — it hands the CALLER'S
OBJECT straight to the rig. Both machines match their seat by **identity**:
`ct/library-pc.ts:56` and `ct/slots.ts:1836` both do
`ct.seats().find((s) => s.pose === pose)`.

So a probe that sits with a fresh `{x, z, yaw, h}` literal is sitting on a pose
**no seat in the world recognises**, and neither machine can ever fire. That is
exactly what `scripts/probes/w69-seated-offers.mjs:64` and
`w69-seated-loan.mjs:70` do, and it is why w69 concluded the terminal *"has
NOTHING registered within reach at any heading"* and could not see either poll.

**My own first run made the same mistake and reported both polls dead.** The fix
is one line — `window.__ct.sit(window.__ct.seats()[i].pose)` — and every probe in
this tree that sits should use it.

> **This does NOT invalidate w69's 219/219 headline.** That leg asks what a
> seated `[E]` offers, and a copy pose still seats you; it only blinds the probe
> to anything keyed on seat identity. I re-ran it after my change: still
> **219/219, 0 seats with anything else on offer**.

---

## What changed — one `ctx.spot` per module, re-aimed

Nothing is removed. Each file gains **one** spot whose coordinates are re-aimed
at the machine in front of whichever seat you took.

**One spot, not one per machine.** There are 87 slot stools. Registering a spot
each would put 87 extra `ok()` calls inside `pickSpot`'s per-frame loop, each
running a 219-entry `find`. Only one machine can ever be the one you are sitting
at, so `ok()` is `armedAt !== null && __ct.seated() === armedAt` — two reference
comparisons.

**Seated-only and aim-gated**, so no standing selection can see it: `armedAt` is
set only while seated at a machine seat and cleared the moment you leave.

**Every number is read off the mesh** (BUILDER-BRIEF §8). The radius is the
measured seat-to-face distance, so the spot's circle reaches exactly the seat it
was found from whatever `int-library.ts` or `int-casino.ts` do to their layouts:

| | seat | face | d | seated bound `r + REACH_MARGIN` |
|---|---|---|---|---|
| library CRT | (1082.60, 4.00) | (1083.62, 4.00) | **1.020 m** | 1.620 |
| slot cabinet | (880.68, 13.42) | (880.68, 13.05) | **0.370 m** | 0.970 |

`REACH_MARGIN` is **not imported** into `ct/library-pc.ts`, deliberately: that
file's header is an argument for staying out of the runtime module graph so
`npm run fp` remains valid for it (GOTCHAS 75), and one constant is not worth a
dither reseed. Deriving the radius from the world removes the need for it.

### THE SLOT SPOT HAD TO GO ON THE FACE, AND THE FAILURE WAS SILENT

First cut put it at the cabinet's world **centre**. Every gate downstream
passed — `ok()` true, off-axis **0.000 rad**, `d` 0.670 inside a 1.270 bound —
and **the prompt still never appeared**.

`crosstown.ts:2119`'s `canSee` raycasts eye → spot and stops `dist - 0.35`
short, so the thing itself is not counted as its own occluder. A cabinet is
0.6 m deep, so a centre spot puts 0.30 m of solid machine inside that margin:
**the ray ran 0.382 m at a front face 0.364 m away and the machine blocked the
line to itself.** Nothing threw and nothing logged — the same silent shape
`crosstown.ts:2076` records for the apartment door.

The fix derives the face offset from the same bounding box and face normal
`screenPlane` already uses for the panel's own plane, so the spot and the
picture cannot end up on different sides of the machine.

**Generalises: any `ctx.spot` on a deep object wants the FACE, not the centre.**
Half the object's depth has to fit inside 0.35 m or the spot is invisible.

---

## `dismissHere()` — a test affordance for a state nothing can reach

The spot's whole job is the **dismissed-but-still-seated** state, and **nothing
in the UI reaches it today**: `crosstown.ts:1440`'s `leave()` ends with an
unconditional `if (rig.seated) rig.stand()`, so every diegetic close ejects you
from the seat and the frame hook clears `dismissed` a frame later. Measured, not
assumed — `scripts/probes/w74-after-escape.mjs`:

```
sat        : panel ct-library-pc, seated true
after ESC  : panel null, seated FALSE, prompt "[E] sit at the computer"
```

`ct/slots.ts:2083` already writes this down and keeps its guard anyway, on the
grounds that *"quietly depending on another module's current behaviour for your
own correctness is the thing this project keeps being bitten by."* That is
exactly right, and it is why the spot is worth having: **that removal is queued as item 206**,
*"closing a panel from a chair ejects you from the chair"* — `leave()` is to
re-sit the remembered pose. The day 206 lands, a dismissed machine has no way
back in at all without this spot, and this spot is what makes 206 safe to land.

A capability nobody can exercise is a capability nobody can prove (GOTCHAS 79),
so both modules publish `dismissHere()`, in the same family as `__ct.sit` —
which was itself added because the seated `[E]` contest could not otherwise be
asked of all 219 seats. `dismissed` is written **after** the close (`onClose`
overwrites it) and the caller must re-seat in the **same turn**, before a frame
runs.

---

## The numbers

Everything below is against the **BUILT BUNDLE** on `vite preview` :4300
(GOTCHAS 28), after merging mainline.

| | |
|---|---|
| `scripts/probes/w74-seated-e.mjs` | **2 of 2 machines, all clear.** Sit opens it · on the machine's own face · dismissed-and-seated reached · aimed → `[E] use the computer · [ESC] stand up` / `[E] play the slot machine · [ESC] stand up` · **looked away → `[E] stand up`** · `[E]` opens it on the mesh (fov 46 / 58, eye 1.05) · one ESC closes it and gives the feet back |
| `scripts/probes/w64-pc-walk.mjs` | **35/35 OK, 0 console errors** — the library PC driven entirely by real `page.mouse.click`s through the CRT: icons, Minesweeper dug and flagged, the catalogue searched for *frankenstein* and *emma*, close box, `[E]` and ESC out of every screen |
| `scripts/L-slots-inworld.mjs` | **all checks pass** — including `SITTING DOWN OPENS THE MACHINE`, the assertion the row's "the polls are gone" would have killed. 87 machines, SPACE spins, INSERT moves the one wallet at $0.25/credit, ESC returns 69 credits |
| `scripts/K-no-panel-traps.mjs` | **all good** — 5 of 7 panels opened, each froze the world, closed on ESCAPE, gave the feet back. slots/blackjack skipped, not failed (unchanged) |
| `scripts/probes/w69-seated-offers.mjs` | **219/219 seats, 0 with anything else on offer** — identical to w69's own figure. The regression half |
| `scripts/seats-walk.mjs` | **112/219**, the figure `notes/w69-seated-e.md` records for mainline. 107 FAILs in seven classes — 89 `seated eye is 1.05, expected …`, 5 `sat at X but the seat is at Y`, 5 booth-vs-counter, 4 blackjack `got null`, 2 diner fries, 1 bed, 1 barn burger — **the same seven classes and the same counts as w69's inherited-reds table.** None of them moved |
| `scripts/probes/w55-mouse-walk.mjs` | **all checks pass, 0 page errors** — the slot machine driven by real page clicks: bill acceptor, BET ONE, MAX BET, SPIN, CASH OUT, and the keyboard path still live beside it |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no console errors. The only warnings are the known ones — `[interior:hotel] NO BUILDING NAME` and the Canvas2D/`THREE.Clock` noise |
| `node scripts/health.mjs` | `WORLD OK — __ct initialised`, exit **0** |
| `npx vitest run` | 17/17 |
| `npx tsc --noEmit` | clean |

### It is stable, and it has gone red for a real reason

`w74-seated-e.mjs` ran **five times on unchanged source: 18 ok / 0 fail every
time.** And it is not a check that cannot fail — it caught the centre-vs-face
bug above with three FAILs on a run where every other gate reported healthy, and
its first run printed *"only 0 of 2 machines were exercised"* rather than a
clean sheet when the sit did not take.

### The check has a population floor and a negative case

Both required by the brief, and both are load-bearing here.

- **Population floor.** `w74-seated-e.mjs` counts machines it actually exercised
  and FAILS if either contributed nothing — *"only 0 of 2 machines were
  exercised"* is what it printed on its first run, rather than a clean sheet.
- **Negative case.** Leg 5 turns the head 180° off the machine and requires the
  offer to **disappear** and `[E]` to be the exit again. A spot that simply
  always won would sail through every other leg and die there. It also caught
  the centre-vs-face bug by being the only leg that passed when nothing else
  did.

---

## What I did NOT do, precisely enough to queue

**1. `__ct.sit` should take a seat, not a pose — or every probe should sit by
index.** `crosstown.ts:1845` hands the caller's object to `rig.sit`, and two
files match seats by pose identity, so the affordance silently produces a
player sitting on a chair the world does not recognise. It cost w69 a wrong
finding and cost me one run. **Either publish `__ct.sitAt(i)`, or fix
`w69-seated-offers.mjs:64` and `w69-seated-loan.mjs:70`** — I did not touch
either, they are not named by this item and one is w69's acceptance evidence.

**2. `crosstown.ts:1440` still stands you out of the chair on every close** —
that is **item 206**, already on the board, not mine. This change is what makes
landing it safe: without the spot, 206 turns a dismissed machine into one you
cannot re-open at all.

**3. The prompt is not visible in ordinary play**, and that is honest rather
than a defect: the poll opens the panel on the frame you sit, so the offer only
ever shows in the dismissed state. **This item is architecture and insurance,
not something the user will see change** — worth saying plainly, because the row
sold it as a broken feature.

**4. `notes/OWNERSHIP.md` and the row both say `ct/library-pc.ts` is a collision
site (GOTCHAS 82).** I checked `notes/QUEUE.md` at claim time: items 209, 210,
211 and 175 were DOING and none names either file. Mainline merged clean before
the final commit — no conflict in either file.
