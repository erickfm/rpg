# seventysix — item 220: the post narrowing the THRIFT west walk

**RELEASED UN-FINISHED, on purpose, with the diagnosis done.** I ran out of room
before I could make a world change and *walk* it both ways, and item 220's own
wording says the walk is the acceptance test. Handing over a solved diagnosis is
worth more than an unwalked edit. Ports used: **4320** dev, **4321** preview.

---

## 1. WHAT THE POST IS — answered

**It is a bishop-crook street lamp**, built in `src/proto/ct/props.ts` at roughly
lines 1835–1875. Measured in the world at x −5.55…−5.15, z −65.2…−64.8
(`scripts/probes/w76-what-is-the-post.mjs`), it is three meshes:

| part | geometry | centre | colour |
|---|---|---|---|
| base | Box 0.28 × **0.50** × 0.28 | (−5.35, 0.39, −65.00) | `#323826` |
| mast | Box **0.14** × 5.00 × 0.14 | (−5.35, 2.64, −65.00) | `#24291f` |
| arm | Box **1.25** × 0.12 × 0.12 | (−4.72, 5.09, −65.00) | `#24291f` |

So: a 0.28 m base 0.5 m tall, a 0.14 m mast 5 m tall, and a 1.25 m outreach arm
at the top carrying the head and lens **out over the road** (+x). It is not a
sign post and not a stanchion — it is lighting, and it is one of 21.

**This decides the fix, exactly as the item said it would: a lamp cannot simply
be deleted, and its head has to stay over the road.** What can move is where the
*mast* stands under that arm.

## 2. THE COLLIDER IS 2.9× THE MAST — real, but NOT the fix

`src/proto/ct/props.ts:1858`:

```ts
obstacle({ minX: bx - 0.2, maxX: bx + 0.2, minZ: bz - 0.2, maxZ: bz + 0.2 });
```

**A 0.40 × 0.40 m collider for a 0.14 m mast on a 0.28 m base.** It over-claims
by 0.26 m against the mast and 0.12 m against the widest solid part.

**Do not go to 0.14.** The base is 0.28 wide and 0.5 m tall — squarely at shin
height — so a 0.14 collider lets the player stand inside visible geometry.
**0.28 is the honest number**, and it buys **0.12 m**. Worth taking, and it is a
one-line change in a file the item does not name, but on its own it moves the
clear west gap from 1.31 m to 1.43 m. It is not the 2 m.

## 3. WHERE THE METRE ACTUALLY WENT — the lamp is 0.56 m off the kerb

`scripts/probes/w76-thrift-west-lane.mjs` sweeps x in 2 cm steps for every z from
−70 to −60 and reports every standable run, so it finds the gap wherever it is
rather than only where I aimed (a property sweep, not a route). Standable is the
world's own predicate: `__ct.colliders()` at the 0.36 m rig radius, plus
`groundAt() !== null`.

```
   z        widest clear run        runs
 -65.75      4.50 m                 -6.50…-2.00
 -65.50      2.78 m                 -6.50…-5.92 (0.58)   -4.78…-2.00 (2.78)
 -65.00      2.78 m                 -6.50…-5.92 (0.58)   -4.78…-2.00 (2.78)
 -64.50      2.78 m                 -6.50…-5.92 (0.58)   -4.78…-2.00 (2.78)
 -64.25      4.50 m                 -6.50…-2.00
```

The lamp blocks exactly five z rows (−65.5 … −64.5) and nothing else on the
stretch does. Backing the 0.36 m rig radius out gives the raw geometry, and it
reproduces the item's numbers exactly:

- walk spans x **−6.86 … −4.59** = **2.27 m** ✓ (the item's figure)
- lamp spans x **−5.55 … −5.15**
- **west of the lamp: 1.31 m** ✓ (the item's 1.32)
- **east of the lamp: 0.56 m**

**That is the whole story: the lamp is not centred, it is sitting 0.56 m in from
the kerb.** A 0.40 m post in a 2.27 m walk can leave at most **1.87 m** clear if
it is pushed flush to one edge. It is leaving 1.31.

**So the recoverable margin is 0.56 m from moving it and 0.12 m from sizing the
collider honestly — 1.31 m → up to 1.99 m.** That reaches the 2 m band almost
exactly, and it does it without deleting anything.

## 4. WHAT THE NEXT HOLDER HAS TO DECIDE — and the trap in it

**Moving the mast +x moves the head with it**, because `arm.position` and
`head.position` are both derived from `bx` in the same block
(`props.ts:1846–1857`). The arm already reaches 1.25 m over the road; pushing the
mast 0.56 m toward the kerb pushes the head 0.56 m further out over the traffic.
Whether that is right is a **look** call, not a measurement — and it may want the
arm shortened by the same amount so the head does not move at all.

**And this code path builds all 21 lamps.** Check whether `bx` here is per-lamp
or shared before changing it: a global nudge moves every lamp on the street, and
`props.ts:471` notes the heads are placed against lamp spacing deliberately
("7 m is chosen against the lamp spacing, not picked"). The lamplight pool model
is planar and keyed off head position (`lampHeads`), so moving heads moves the
pools too.

## 5. TWO THINGS I CONFIRMED SO NOBODY RE-DOES THEM

- **The item's "measure, do not assume the threshold" warning is right, and the
  numbers here are not a trap.** At 1.31 m raw the gap is far above `ct/gap.ts`
  PASSABLE (0.95) — this is comfort and consistency, not a trap. **But the
  walkable corridor after the rig radius is only 0.58 m**, and the rig is 0.72 m
  across, so a player squeezes through with 0.58 m of usable lane. That is the
  number that makes it feel wrong, and it is the one to quote to the user.
- **`0 of 40 sampled z rows are under 2.00 m`** in my sweep's own output — read
  that as the sweep window including the road, NOT as "the walk is fine". I swept
  x −9…−2, which crosses the kerb, so the "widest clear run" merges walk and
  road. The walk-only figures are the raw ones in §3. I am flagging this rather
  than leaving a probe whose headline contradicts the finding: **anyone re-running
  `w76-thrift-west-lane.mjs` must read the per-run columns, not the summary
  line.** Clamping the sweep to the kerb is the first thing to fix in it.

## 6. Suggested order for whoever takes it

1. `props.ts:1858` → `bx ± 0.14`, `bz ± 0.14`, matching the base. +0.12 m,
   no visual change, no head movement. Cheapest honest win.
2. Establish whether `bx` at this lamp is individually placed or shared by all
   21. **This decides whether step 3 is a one-lamp fix or a street-wide one.**
3. If per-lamp: move this mast toward the kerb and shorten `reach` by the same
   amount so the head stays where it is. Then **walk it both ways in both lanes**
   — and check your heading matches your key, which is the mistake item 220
   records seventyseven making (`s` paired with yaw π, 20.81 m walked the wrong
   way while printing success).
4. Re-run `w76-thrift-west-lane.mjs` with the sweep clamped to the walk.

Nothing in `src/` was changed by me under item 220. The two probes are committed.
