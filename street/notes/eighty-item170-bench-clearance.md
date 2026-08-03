# Item 170 — every park bench stood ON the path

Worker **eighty**, 2026-08-03. Port **4360**, `vite preview` over `dist/` — the
**built bundle**. Landed as `20e235c27`.

> *"bench is a lil too close to the path. also the path looks awful."*
> *"benches need space away from the path."* — the second time, plural.

---

## Root cause, in one line

**Two hand-typed offsets, neither named, and both put the bench collider inside
the path.**

The bench's registered solid is `SEAT_D` deep either side of its centre, so the
clearance from the path edge to what a walker can actually hit is
`offset − PATH_W/2 − SEAT_D`:

| | offset | clearance |
|---|---|---|
| the two **z** legs | `lx ± (PATH_W/2 + 0.42)` | **−0.04 m** — inside the path |
| the two **x** legs | `lz ± 1.05` | **−0.16 m** — inside the path |

Every bench in the park, not just the one he photographed. That is his screenshot
exactly: front legs on the kerb, seat overhanging, weeds in the joint.

## The figure is derived from the player, not chosen

```
BENCH_CLEAR = RADIUS + TOUCH_MARGIN = 0.36 + 0.15 = 0.51 m
```

**A walker is entitled to the WHOLE path.** His centre may reach its very edge,
and his body then overhangs that edge by his own collision radius — so `RADIUS`
(`fp.ts:87`) is the distance at which a bench starts being something he collides
with *while still legitimately on the path*. The margin on top is `TOUCH_MARGIN`
(`fp.ts:764`), the world's own smallest meaningful gap, so that passing a bench is
not **brushing** it (BUILDER-BRIEF §10).

**Imported from `fp.ts`, not retyped.** Re-tune the player's radius and every
bench in the park steps back with it. `fp.ts` imports only three and a type, so
this cannot make a cycle; `no-import-cycles` is registered and green.

All four legs now derive one `BENCH_OFFSET`, and `SEAT_D` is **hoisted** so the
placement and the bench builder cannot drift apart again — two copies of that
number drifting is how the clearance went negative in the first place.

## WALKED, because the item says this is a walking problem

`scripts/probes/w80-walk-the-benches.mjs`, two legs:

**1. The whole loop, geometrically, at walker scale.** 858 stations round the
circuit on **three lanes** — the centreline and both shoulders, each inset by
`RADIUS` so the capsule itself stays on the path:

```
closest a walker's capsule ever comes to a bench collider   0.51 m
stations where the capsule would INTERSECT a bench          0
```

**2. Then walked for real, past every one.** 1.6 s of **held** `w` (§5) from
2.5 m before each bench, on the shoulder **nearest** it — the lane where a walker
would actually be brushed:

```
8 of 8 benches:  4.37–5.38 m travelled   0.000 m sideways drift
                 0 pushed off the lane   0 blocked
```

**3. Sitting.** No seated pose in the park is inside the loop path.

### That probe lied to me twice, and both are written into it

- **`window.__ct.step?.('w', 0.05)` — there is no `step` on `__ct`.** The
  optional call was a silent no-op, sixty times per bench, and the probe would
  have reported a clean walk having moved nobody. GOTCHAS 79's family exactly.
  It is a real held keypress now, like `D-walk.mjs:90`.
- **`atan2(ux, uz)` where this world's forward is `(sin yaw, −cos yaw)`**
  (`fp.ts:947`). The three z-leg benches were walked **3.8–5.4 m backwards** while
  the probe printed `BLOCKED`. It could not show up on the four x-leg benches,
  where `uz` is 0 and both spellings agree — 3 of 8 wrong, the mirror-instance
  trap. **Caught only because `along` is a SIGNED projection onto the leg**; a
  distance would have made a backwards walk look like a good one, which is the
  probe that walked 20.81 m the wrong way and printed success.

## The guard: `scripts/bench-clearance.mjs`, registered

Default tier, ~2 s. Three legs: population floors; **every bench stands the full
clearance off every walked surface**; and **the benches are still on the
circuit**, so the fix cannot be made green by exiling them.

- It measures the **collider**, not the woodwork — they differ by 0.20 m here and
  it is the collider a walker hits.
- `ct/park.ts` **banks what it built** — `userData.parkBench`,
  `userData.parkGround`/`parkRect`, and `userData.parkLoop` — so the check reads
  the surfaces that were actually laid. A check that rebuilt the loop from
  `lx0/lx1/lz0/lz1` would be a second copy of the layout.
- `crosstown.ts` now publishes **`playerRadius()`**, so the guard re-derives
  `RADIUS + TOUCH_MARGIN` **independently of the module it is judging**. Reading
  the clearance out of `ct/park.ts` would have made it agree with itself.
- `--selftest` puts one bench back **0.04 m into the path** — the *smaller* of
  the two real defects, so the mutation is the hard case — and requires the
  clearance leg to go red. It does.

### Two things the first cut got wrong, both kept in the file

- **It found 2 walked surfaces in a park with a 110 m circuit**, because the loop
  is an octagonal `band()`, not a `lay()` rectangle — every bench on it then
  measured 7–9 m "clear". **That version would have passed the user's own
  screenshot.** The loop banks its centreline and half-width now.
- **The upper bound was pointed the wrong way.** A ceiling on distance accused
  the mound bench, which `ct/park.ts` puts 6.19 m off the loop *on purpose* —
  *"the mound gets the one thing worth walking off the path for"*. It is a floor
  on the near ones now: a deliberately-remote bench is not a runaway fix.

**The 1 mm slack in the comparison is not a loosening.** `ct/park.ts` places at
exactly `PATH_W/2 + RADIUS + TOUCH_MARGIN + SEAT_D` and the check re-derives the
same sum by a different route, so three of eight came out at
`0.50999999999999995` against `0.51`. The rule is a **minimum** and a bench
sitting on it satisfies it; 1 mm against 510 is below the precision of anything
here, and nowhere near the 40 mm the real defect was.

---

## Found and NOT fixed

1. **`scripts/crosstown.ts` is a file this item does not name, and I edited it**
   — one additive line, `playerRadius: () => RADIUS`, for the reason above. Same
   shape as the `touchMargin()` I added under item 223. Reported per §9.
2. **The path itself is untouched.** The item says treat *"the path looks awful"*
   as satisfied unless walking says otherwise; walking it says otherwise about
   nothing.
3. **BENCHES MOVED 0.55–0.67 m OUTWARD — item 106 should know** (bench texture
   and sit pose). Every bench's world position changed; none of its geometry did.
4. **`scripts/park.mjs` is RED and it is not mine.** `loop straights found: NONE`.
   Proved pre-existing: stashed my change, rebuilt, and mainline gives the
   identical failure. My change moves furniture, not the loop.

## Verification run

| | |
|---|---|
| `tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0 |
| `scripts/footprint.mjs` | exit 0, **0 FAIL** — nothing the benches now stand on clips a kerb or sits in a building |
| `bench-clearance` | 3/3, and its `--selftest` reddens the leg it targets, through the runner |
| `checks-registered` | exit 0 |
| `checks-can-fail` | exit 1 — same three names as mainline, no new accusation |
| `scripts/park.mjs` | exit 1 — pre-existing, proved above |
