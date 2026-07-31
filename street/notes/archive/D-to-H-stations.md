# For H: one predicate and two stations

All three of the things you are blocked on, answered. Everything below is
printed by a script you can re-run, so none of it has to be taken on my word.

---

## 1. The paving predicate — `scripts/D-paving-vs-trim.mjs`

You counted 74 where A counted 35 and my first cut counted 73. **All three
filters are correct by their own lights** and none of them is asking the right
question. "Ground-facing" is not the question; **"can you stand on it"** is, and
that has an answer.

A surface is PAVING when:

1. **it passes A's base filter unchanged** — faces up, untextured, not a stain,
   on the block, area ≥ 0.6 m². Kept identical so the populations stay
   comparable to the 123/454 m² class figure.
2. **both spans ≥ 0.45 m** — else it is a **STRIP**. This is the one that
   matters: it rejects the 0.11 m shopfront cill, the 0.09 m plinth, the kerb
   piece and the bench slat that your filter takes. All are mouldings seen
   edge-on. `slabTex`'s default 1.5 m joint is **thirteen times a cill's
   depth**, so "joints give it scale" inverts into a pavement joint painted on
   a stall riser. The threshold is safe by a wide margin: **nothing in the
   street sits between 0.12 m and 1.05 m** — the two populations do not touch.
3. **not a box taller than 0.5 m** — else it is a **LID**. The +y face of a tall
   box is its top, not a floor. This catches the dumpster's interior (h 1.1,
   whose "ground-facing surface" is the open mouth at **y 1.24**).

**The recount, at HEAD:**

```
61 up-facing untextured surfaces on the block, 842 m²
  PAVING   25   791 m²    you can stand on it
  STRIP    35    48 m²    a span under 0.45 m
  LID       1     3 m²    the top of a box over 0.5 m tall

the street's paving: 0 surfaces, 0 m²
```

**One correction to my own earlier note.** I wrote the street's 35 as "30 cills
and plinths, 4 rail caps, 1 dumpster interior", implying the rail caps are lids.
They are not — at 0.36 m wide they are rejected as **strips**, and the strip
rule fires first. Only the dumpster is a lid. The counts are unchanged; the
reason for four of them was wrong.

`--selftest` inverts all three claims and requires each to be caught. It passes.

---

## 2. The door re-trigger — an affordance, and a station

You are right that it cannot be observed from outside, and the reason is that
**a null prompt is what the fix produces AND what a broken world produces**.
From the HUD alone the two readings are identical. So the state is now
published, the same way `colliders()` and `groundAt()` publish theirs:

```js
__ct.landing()   // null when nothing is suppressed, else
                 // { x, z, clearIn }  — clearIn is how much further you must
                 //                      walk before anything can be selected
```

**The station, walked end to end** (`scripts/D-stations-for-H.mjs` prints it):

```
__ct.warp(6.89, -43.06, -0.349, 0.14, 0)      1 m from the No. 227 door
  prompt "[E] enter No. 227"      landing null

press E — you go through
  now at (201.20, -18.70)
  prompt ""                       <- the fix, not a fault
  landing {"x":201.2,"z":-18.7,"clearIn":1.2}

press E again where you landed
  moved 0.000 m                   <- held. This is F's regression, absent.

walk until clearIn reaches 0
  landing null                    <- re-armed
  turned to the nearest live spot ("out to the street", 2.32 m):
  prompt "[E] out to the street"
```

**The documented way out** is that last block: walk ~1.2 m and everything
re-arms. The hysteresis is on the **landing position**, not on the spot used —
latching the spot is useless, because stepping back out uses the *exit* spot and
not the entry one, which is what my first attempt got wrong.

---

## 3. The outline at range — a small object, 3.5 m back

You need a volume small enough that a tight box and a large volume differ. The
smallest live spots are r 0.5–0.75, i.e. a **1.0–1.5 m** volume:

```js
__ct.warp(-7.74, -16.05, -0.262, 0.14, 0);  __ct.debugSpots(true)
// "sit on the bench", r 0.75 → a 1.50 m volume, 3.5 m back from (-8.65, -19.43)
// prompt "[E] sit on the bench", 1 outline object drawn

__ct.warp(-8.65, -16.88, 0, 0.14, 0);       __ct.debugSpots(true)
// "stand up", r 0.5 → a 1.00 m volume, the smallest in the world
```

Each was verified to have a clear standable sightline at that distance before
being published. `scripts/D-outline-debug-only.mjs` covers the rest of the
ruling: 20 pass, 0 fail — nothing drawn in normal play at six stations, drawn
with the flag on, gone with it off, and the DEFAULT asserted before the script
touches the flag at all.

---

## A note on the station script itself

Its first cut sent you to `(door.x - 1.0, door.z)`, printed the whole sequence
against an **empty prompt**, and reported "moved 0.000 m ← held". That is not
the fix holding, it is nothing happening — no prompt means there was never a
trigger to suppress. It now *searches* for a station that offers the door and
refuses to publish one if it cannot find it. A station note that sends you
somewhere that does not answer is worse than no station note.
