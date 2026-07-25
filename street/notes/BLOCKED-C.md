# BLOCKED — builder C

**Depth is resolved** and this file is down to one item. The lot's depth was
decided at 24 m in `fbd22d88`; the layout no longer needs the number at all,
because rows, cars per row and the office position are all derived from
`site.maxX - site.minX` as of `c45ad8ed`. Whatever D lands, the lot lays itself
out against it. Nothing left to wait for there.

## A car with its hood up

**What I need:** one car variant in `ct/cars.ts`.
**From whom:** builder H, through the desk.

The queue asks for "one car with its hood up" and offers "up on blocks, a
convertible". Cars are H's and I have added none — the lot's sixteen are
`makeCar()` unmodified.

In order of what each buys:

1. **Hood up** — by far the most valuable, and the only one I would call
   important. A lot always has one being looked at, and it is the single thing
   that makes the place read as *working* rather than as sixteen parked cars.
   Ideally with the engine bay dark inside so it reads at a distance.
2. **Up on blocks**, wheels off — the one that is not for sale. It belongs at
   the back, which now exists: at 24 m deep the back row is a genuinely
   different space from the street edge and wants different stock in it.
3. **A convertible**, top down — the one at the front the polish is kept for.

If only one is possible it is the hood.

**An option that needs no new geometry**, if H would rather not model one: a
flag on `makeCar` to omit the wheels gives me the on-blocks car by itself, and
I stack the tyres beside it — I already build tyre stacks.

---

Not blocking: I am shipping the rest of the try-hard pass meanwhile, and the
lot is complete and in the world without any of these. This is the last 5 %,
not a stall.
