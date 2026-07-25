# BLOCKED — builder C

Two halves of the car lot item need somebody else. Neither stalls me: the rest
of the item is mine and I am shipping it while these sit.

## 1. How far back can the lot go?

**What I need:** one number — the lot's depth, in metres, from the street line.
**From whom:** builder D, through the desk.

The queue says the lot should run BACK so rows recede and you see cars behind
cars, and that "beyond the facade line is ground the player has never seen, so
whatever closes the far side has to be real".

That far side is not mine. `ct/street.ts`'s `openSite` builds the ground, the
flanks and the **rear elevation**, and it takes `depth` as an option — it is
called with `depth: 8.0` today. So the change is one number in D's file, and
everything I would add depends on it:

- the stock is two rows at x = X0 + 2.9 and X0 + 6.4. At depth 8 that is all
  that fits. Rows recede properly at **12–14 m**, which buys a third row and
  a real back-of-lot.
- the office sits at X0 + 5.6 and would move back with the extra depth
- the floodlight is at X1 − 1.2 and follows the back wall wherever it goes

**I have not guessed.** `placeLot(site)` reads `site.minX`/`site.maxX`, so
whatever D sets, this module already lays itself out against it — but the
row spacing and the office position are tuned for 8 m and I would rather
re-tune them once against the real number than twice.

A useful thing for the desk to decide with D: the park got the same note, and
the two sites are the same object in `openSite`. If they go back the same
distance the block stays legible; if only one does, the street wall gets a
notch on one side only.

## 2. A car with its hood up, and a couple of other variants

**What I need:** three car variants in `ct/cars.ts`.
**From whom:** builder H, through the desk.

The queue asks for "one car with its hood up" and offers "up on blocks, a
convertible". Cars are H's and I have not added my own — the lot's stock is
`makeCar()` unmodified. In rough order of how much each buys:

1. **hood up** — the single most valuable one. A lot always has one being
   looked at, and it is the thing that makes the place read as *working*
   rather than as parked cars. Ideally with the engine bay dark inside.
2. **up on blocks**, wheels off — the one that is not for sale, at the back.
3. **a convertible**, top down — the one at the front of the row that the
   polish is being kept for.

If only one is possible, it is the hood.

An option that needs no new geometry, if H would rather not: a flag on
`makeCar` to omit the wheels would give me the on-blocks car by itself, and I
would stack the tyres beside it — I am building tyre stacks anyway.

---

Everything else in the item — the price signs, the bunting, the sandwich
board, the tyre stacks, the oil, the floodlight and the banner — needs nobody
and is going in now.
