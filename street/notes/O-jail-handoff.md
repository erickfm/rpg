# The jail — handoff

**Builder O · `ct/jail.ts` (outside) + `ct/int-jail.ts` (room) · all four queue
items done.** Nothing blocked. `BLOCKED-O.md` deleted; the desk ruled on all
four asks and every one is landed.

> *"also we need a jail. the jail should be extremely try hard and should be
> somewhere it makes sense. probably over by the casino tbh lol"*

---

## Where to stand to verify it

The queue asks a LANDED row to name where a verifier stands. Six stations, in
the order a player meets them, and none of them needs a coordinate typed:

| | |
|---|---|
| **1** | anywhere in the side street, **facing east**. The building closes the street. You should be able to tell what it is before you can read the plate |
| **2** | on the pavement at its foot, **looking up** at the barred windows |
| **3** | at the door, and press **E** |
| **4** | inside, walking up to the counter — **is the sergeant looking at you or past you** |
| **5** | through the gate, standing in the corridor with bars on both sides |
| **6** | at a cell, looking in through the bars, **and then at a cell on the other side** (GOTCHAS §41) |

And the two that are not looking:

```bash
SHOT_URL=http://localhost:<yours>/ node scripts/O-jail-walk.mjs all
SHOT_URL=http://localhost:<yours>/ node scripts/O-jail-walk.mjs door --selftest
```

11 checks, 0 failed on the built bundle. Registered in `scripts/checks.mjs`.

---

## What is there

**Outside — `ct/jail.ts`.** Three storeys closing the side street's east end:
rusticated granite base, dark engineering brick, string course, cornice, blind
parapet at 13.6 m — 0.6 m over SEVENS and LOANS, because a civic building
closing a street should stand over its neighbours. A recessed sally port with
real jambs and a real soffit, a steel double leaf with rust creeping up off the
threshold, ten barred windows with the bars as **geometry**, two barred slots in
the stone either side of the door, a cast municipal plate, and two lamps that
come up with the night.

**Inside — `ct/int-jail.ts`.** 12.8 × 26 × 3.3, built as a sequence:

- **the lobby** — bolted benches, a woman in a coat who has been waiting, a
  notice board where nothing is legible, a payphone, a bin, a radiator, and a
  clock through `room.clock()` so it agrees with the wristwatch
- **the counter** — glazed to the ceiling, speak-hole, paper slot, the desk
  sergeant behind it facing the door, a key board with hooks that have no key
- **the gate** — open, and the leaf is solid so you walk round it
- **the cell block** — eight cells, four each side, bunks, basins, stools,
  daylight slots that dim with the world, one man in one of them

---

## The site, and why it cost the block nothing

The east cap of the side street, `x = 57`, `z −96 … −110`. **Both roster runs
already stop dead on `x = 57`**, so the cap is on neither cursor: nothing before
it moves and nothing after it moves, and the bodega keeps its corner. The full
argument is `notes/O-jail-site.md`; the desk approved it on that reasoning.

Every coordinate comes from **`ctx.site('jail')`**, which D published. The module
refuses to build at all if the site is missing and warns loudly if it has moved.

**The pavement across the closed end got WIDER**, which is the claim the site was
approved on and it is measured rather than asserted:

```
                       before      after
raw walk, kerb to collider    1.70 m      1.89 m     (0.72 m capsule, GOTCHAS 29)
```

because the jail's footprint is cut to `WALK_PROJECTION` instead of the legacy
0.30 that `crosstown.ts`'s hand-written east-end rectangle carried. That
rectangle is **deleted** — desk ruling, bounded mandate, one line — and the
building registers its own footprint through `ctx.obstacle`.

**And you can now walk north pavement → south pavement across the closed end
without entering the carriageway.** That is the open request at
`FEATURE-REQUESTS.md:217` — *"the east-end crossing is being removed, close the
walkable ring another way instead"* — answered as a place rather than as a graph
patch. **H's call whether to re-flag the `s-east → ne-corner` edge `road: false`
now that there is a pavement and a frontage there; it is H's file and I have not
touched it.**

---

## World-neutrality

`ct/jail.ts` and `ct/int-jail.ts` **never import `ct/rng.ts` and never call
`rnd()`**, so the one seeded stream is untouched by construction and no tree
height or pigeon placement can move (GOTCHAS §2). Fingerprinted anyway, both
sides against the built bundle (GOTCHAS §31):

```
objects 7352 -> 7478 (+126)     LOST 0     GAINED 126, all of it the building
tints   0 differ
places  3 differ, all sub-centimetre drift on moving objects
```

The raw `structure` diff shows 1572 differences and **they are not a
regression** — same geometry, same dimensions, a different slice of the
harness's seeded `Math.random`, because creating objects consumes draws. With
the grain field ignored the loss is zero. Worth knowing before anyone reads that
number as damage.

`nightgrade` over the world: **0 materials break GOTCHAS §22 and are
DoubleSide** — nothing here is at real artifact risk. Every self-lit thing I
added carries `userData.selfLit` so its exclusion from the dimmer is declared
rather than incidental.

---

## Six things I got wrong, and how each was found

None of these was found by reasoning. Every one came from looking at my own
screenshot or watching my own check, which is the only reason to write them
down.

| what | how it was found |
|---|---|
| the plate shipped reading **"ITY OF CROSSTOW / E OF DETEN"** — 18 characters at px 3 wants 324 texels on a 187-texel canvas | the first approach shot. The painter now WARNS instead of clipping silently |
| the stone was `#6e6f68` and read as **near-white cinder block** at 1.8 m, a full value step lighter than every other ground floor on the street | standing at it |
| the single overhead lamp landed at **4.15 m, dead behind a plate centred at 4.175** — two independently reasonable numbers, one inside the other | it was missing from the night shot |
| the corridor was **9.5 m across** — a hall with cells along one wall, photographed as an empty gymnasium | the corridor shot. Fixed by a second run of cells, which is what made the room |
| the walk check waited **six frames** for the door transition instead of waiting for the transition — four reds on a working door under load (GOTCHAS §30) | running it while the rest of this was building |
| the walk check walked the room **down the middle, into the counter**, and reported the room unwalkable — measuring the threshold working and calling it a fault | reading its own output |

Two more that were the instrument and not the world, both in the first run of
`O-jail-walk`: it read `standX`/`standZ`, which do not exist, and compared
against `NaN`; and it invented an `__ct.prompt()` that does not exist, got
`null`, and reported the door as not offering itself **on the line before the
one that pressed E and went inside**. GOTCHAS §48 — an instrument that cannot be
aimed gives a specific, credible, wrong number.

---

## What I did NOT build, deliberately

**No way to get arrested.** The desk was explicit and it is right: he asked for
a jail, not a crime system. The cells are a place, not a consequence. Nothing in
either file puts the player on the wrong side of a bar, and the gate stands open
so the locked thing is the cell rather than the half of the building you were
shown and cannot reach.

**No stoop.** A civic building wants two risers up to its door. Two risers is a
floor-picker change (GOTCHAS §7), it is the exact shape GOTCHAS §48 spent an
entry on, and `ct/civic-doors.ts` exists because *"Do NOT leave a flight of steps
that leads to nothing."* The sill is flush. **Stated as a trade, not omitted —
if the desk wants it, it is a clean separate item and I will walk it up and back
down.**

---

## Two things worth someone else's hour, neither of them mine

- **A police cruiser at the kerb outside.** `ct/cars.ts` is H's and has no such
  `CarKind`. It would be worth more than any three details I could still add to
  this building, and it is one variant in somebody else's file — so it is a
  request to route, not a thing to reach for.
- **The graph edge at the east end**, above. H's.

— O

---

## The jail against "make the exteriors match the interiors"

There is a live desk row asking that of the whole world. The jail is the newest
building on the block, so it is answered for here rather than assumed:
`scripts/O-jail-door-agree.mjs`, registered in `checks.mjs`. **5 checks, 0
disagreed.**

```
the [E] sits 0.000 m from the door's own published stand point
the outward normal is (-1, 0) — west, down the side street
inside, the door is at local x 0.00 — centred, as it is on the facade
declared by FACE: a world point and an outward normal
the trigger spans the declared opening — r 1.05 against a 2.40 m leaf
```

**It asserts only what GOTCHAS §45 says is constrained.** Not floor area, not
depth, not ceiling height, not width against the frontage — enforcing those is
the rule the desk spent a whole entry retracting, and it cost the bodega, the
casino and the hotel their depth. The jail's room is 12.8 × 26 inside a 14 m
frontage and that is *supposed* to be free.

**It carries no selftest, and that is a statement.** Its subject is a
declaration collected at import time; nothing outside the bundle can move it.
The only mutations a harness has — overriding `__ct.doors()` or `__ct.spots()` —
break the check's VIEW while leaving the world intact, which GOTCHAS §34 says
proves nothing. A selftest that passed on one of those would be worse than the
`no selftest` the board now prints, because it would certify the check as
mutation-proof when it is not. **Whoever exposes a writable door registry can
close it**, and that is the one thing that would.
