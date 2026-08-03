# Item 265 — the "5.5–6.0 second stall" at (6, −40) is a bench, and it is not a stall

Worker onehundredfive, 2026-08-03. Port **4611**, built bundle under
`vite preview`. Everything below is **walked**, not computed — and where a
number is computed it is checked against a walk, and against the project's own
registered instrument.

---

## The verdict in one line

**Holding W north from (6, −40) does not stall for six seconds. It stops
permanently, after 3.70 m, against the back of the bus-stop bench — because
(6, −40) is 0.09 m inside the street-furniture envelope.**

---

## What the row said, and what is true

| the row's candidates | measured |
|---|---|
| item 207's give-way — a walker backing off a vehicle into his path | **no.** No walker within 6 m on **4 of 5** runs, and he stops in the same 4 cm of z on all five |
| a citizen sealing the lane (item 262's class) | **no.** Same evidence, and the stop is at a fixed z whether anyone is nearby or not |
| an actor collider registered as static | **no.** `__ct.actorColliders()` holds 12 boxes; the blocker is not one of them |
| "a 5.5–6.0 SECOND stall" | **understated.** He never resumes. 14 s of held W, 12.98 s of it standing still |

**Nothing was changed before this was established**, as the row asked.

## What is actually there

One untagged static collider on the line, and only one:

```
x 5.070 … 5.731   z −35.920 … −34.080     0.661 × 1.84 m     not an actor
```

The scene graph names it: **the bus-stop bench** — slat boards tagged
`groundProp`, frame tagged `benchBezel`, and the back panel tagged
`benchAd = "TONY'S PIZZA"`. Authored at **`src/proto/ct/props.ts:2806`**,
`const STOP_Z = -33.5, BENCH_Z = -35.0`.

**The arithmetic of the stop, derived not guessed:**

```
bench maxX          5.731
player radius     + 0.360      (__ct.playerRadius(), read from the world)
                  ───────
envelope edge       6.091      ← walking at x = 6.00 you are 0.09 m inside it
```

## Walked, both directions, five runs

Sweeping the whole pavement width at 0.1 m, holding W for 5 s per lane:

| x | north from z −40 | south from z −30 |
|---|---|---|
| 5.60 – 6.05 | **stopped, 0/5 got past** | **stopped, 0/5 got past** |
| 6.10 – 6.52 | clear, **5/5**, 16.6 m travelled | clear, **5/5**, 16.0 m travelled |

The walked edge (between 6.05 and 6.10) and the computed edge (6.091) agree.
Northbound he stops at z −36.30 = the bench's south face less a radius;
southbound at z −33.58, which is the **bus-stop flag pole** at `STOP_Z = -33.5`,
not the bench — the same envelope, a different piece of it.

**He does not slide.** At x = 6.00 he is 0.09 m from clear air and stands there
for the rest of the hold. That is why this reads as the game hanging: the
difference between "walk forever" and "stop dead" is nine centimetres of lateral
position, with no feedback either way.

## The 2 m lane — the one DONE-WHEN condition I could NOT satisfy

**It is not clear along that stretch. It is 1.15 m.** And this is not my number:
`scripts/laneaudit.mjs`, the registered instrument for exactly this question,
reports it independently and names the same two things —

```
1.15 m — east walk, z −35.8…−34.3 (1.8 m long),
         between (untagged) [props]  x 5.07…5.73  z −35.9…−34.1     ← the bench
         and     facing,sizeW,poolSpan [street]  x 6.88…26.7        ← the shopfront
```

It grades that **"tight (1.00–1.40)"** — 1 of 26 such samples, 1.9% of 1380 —
not URGENT and not PROBLEM. The block has 8 IMPASSABLE samples and **none of
them is here.**

> ### ⚠ MOVING THE BENCH WOULD NOT FIX IT, AND THAT IS THE finding WORTH KEEPING
>
> `laneaudit`'s nominal east walk band is x **5.25 … 7.25**, and the shopfront on
> this stretch bites at **6.88**. So the pavement here is **1.63 m wide before
> any furniture exists at all** — the *building* takes it under 2 m, and the
> bench costs the remaining 0.48 m. Pushing the bench to the kerb cannot buy back
> a 2 m lane; it does not exist to buy. **A fix here is a decision about the
> shopfront line or the lane's definition, which is the desk's to rank, not a
> bench nudge.**

`props.ts:2795-2806` states the authoring standard in its own words — *"the lamp
poles … block out to x ≈ 6.11 …: the bench reaches only 5.66, so it never
becomes the narrowest point on the walk."* **Two of those three numbers have
drifted.** The bench reaches **5.731**, not 5.66, and the lamp envelope is at
most **6.10** (x = 6.10 walked the full 16.6 m past every lamp, 5/5) rather than
6.11. The *conclusion* still holds — the bench is not the narrowest point — but
it holds by 0.01 m, on numbers that no check defends.

## Handed back, not fixed

1. **The stretch is explained, not repaired, and deliberately so.** The stop is
   authored behaviour at a documented pinch the block's own audit already grades
   "tight". Re-siting the bench, the bus flag and the lamp run is a design change
   with a real chance of moving the pinch somewhere less visible.
2. **A follow-up worth ranking: nothing defends the furniture envelope.**
   `props.ts` reasons about "x ≈ 6.11" and "5.66" in a comment, and the world now
   says 6.10 and 5.731. `laneaudit` measures the *result* but never the *claim*,
   so the envelope can drift until it becomes the narrowest point and no check
   will say so. A one-line assertion — no fixture on the east walk may reach past
   the lamp envelope — would have caught this.
3. **No slide on contact.** Worth its own item if the user reports it again: a
   0.66 m-wide bench stops a player who is 0.09 m off-line, indefinitely, with no
   cue. Whether the rig *should* slide is a design call I did not make.
4. **One transient worth recording so it is not mistaken for this.** Southbound
   at x = 6.10, one run of five travelled 11.33 m against 15.8–16.2 m for the
   other four. That IS something moving in the lane — the give-way class the row
   suspected. It costs about 5 m of progress in 1 run of 5; **it does not stop
   anyone, and it is not what happens at (6, −40).**

## Instruments

- `scripts/probes/w105-stall-6-40.mjs` — reproduces it. Per-frame in-page
  sampler (a `page.evaluate` poll would smear a stop into something with no
  edges), reports the longest still-window and who was within 6 m.
- `scripts/probes/w105-what-blocks-36.mjs` — every collider on the line, actor
  vs static, plus a 5 cm lane sweep.
- `scripts/probes/w105-name-the-box.mjs` — walks the scene graph for meshes over
  the footprint. **Deliberately does not filter on `visible`** (GOTCHAS 79/79b):
  the player spawns 98 m past the cull boundary and a filtered census would find
  nothing and say so in green.
- `scripts/probes/w105-walk-the-band.mjs` — the walked verdict. `LANES=` narrows
  it for a five-run answer, unset it sweeps the pavement to find the edge.
