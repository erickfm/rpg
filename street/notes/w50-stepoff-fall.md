# w50 — item 112: stepping off a surface teleports you straight down

**The user:** *"when i jump off of stuff i teleport straight down. please fix this."*

**Root cause, in one line:** `airY` is height ABOVE THE GROUND and world Y is
`groundY(x, z) + airY`, so clearing the edge of a car took `groundY` from 1.415
to 0.000 in a single frame and carried the camera with it — **the player was
never falling; the floor moved out from under him and took him along.**

Port used: **4187** (dev) and **4188** (`vite preview`, the built bundle).
Both proved free with `curl` first — 4186 was already serving somebody's world.

---

## The desk's diagnosis was RIGHT — verified before building on it

Item 112 is one of the roughly two-thirds where the stated cause holds, so this
note records the confirmation rather than a correction. Measured on the unmodified
world with `scripts/probes/w50-stepoff.mjs`, walking off the pickup bed floor:

| | before |
|---|---|
| biggest single-frame drop | **0.514 m** — 87% of a 0.590 m descent |
| gravity budget for a first clamped frame | 0.035 m (`g*dt²`, g = 14, dt ≤ 0.05) |
| camera, frame to frame | `… 2.11 2.10 **1.59** 1.58 …` |

The second effect the item flagged is real too and was measured, not assumed:
pressing jump the instant you step off granted a **fresh 4.0 m/s jump in mid-air**
(camera rose 0.310 m), because the gate at `fp.ts:549` is `airY === 0 && vy === 0`
and a step-off left both at zero.

---

## The fix

`src/proto/fp.ts`, one block in `update()` plus four fields. When the floor drops
away, **add the lost height to `airY`**: world Y (`gy + airY`) is unchanged this
frame, so nothing jumps, and `airY` is now positive so the existing integrator
brings you down at the same 14 m/s² a jump uses.

**Both halves of the item come out of that one line** — the mid-air second jump
disappears with no separate change, because the player is now genuinely in the
air and the `airY === 0` gate is false. That is what the item predicted.

Three deliberate restrictions, each one load-bearing:

- **Drops only, never rises.** A rise is a *landing*, and landing already works:
  `standTop` credits a top only once your feet are within `TOP_EPS` (0.08 m), so
  the pop is bounded by that and settles as `airY` runs out. Making it symmetric
  would re-time every climb in `w21-roof-climb.mjs` for a defect nobody reported.
- **Off a collider top only, never off terrain.** This is what leaves the kerb
  *bit-for-bit* as it was — `heldByTop` is false for every kerb, stoop, stair and
  storey change, so the block does not execute for any of them. The item's
  "walking off a kerb still feels as it does now" is satisfied by **not touching
  the path**, not by re-tuning it.
- **Only if you walked there.** `this.run` is 42 m/s, so the furthest any legal
  frame can carry you is `run * dt` — **derived from the field, not typed**, so it
  still holds if the speed is retuned. Anything further is a teleport (`__ct.warp`,
  a door, a seat exit) where the floor changing is the point, and without this a
  probe that warps off a roof is handed a phantom 1.4 m fall.

`sit()` and `stand()` clear the state as well: getting up moves you by up to the
1.4 m search ring, and the first frame back on your feet would otherwise compare
this spot's floor against the one you sat down from.

## Nothing else reads `airY`

Checked before changing its meaning, as the item asked. `airY`, `support`,
`heldByTop` and `lastWorldY` are all `private` and confined to `fp.ts`; the only
outside mentions are probe scripts that *model* the integrator (`jump-walk.mjs`,
`probes/w25-jump-apex.mjs`) and comments citing line numbers. The kerb, the
stairs and the storey picker all deal in `groundY` terrain, which this change
does not touch — proved below rather than argued.

---

## Proof

**`npm run stepoff`** (`scripts/stepoff-walk.mjs`) — six cases, all **WALKED**,
never warped. You cannot warp onto a tier: `warp` writes x/z but not height, so
it drops you inside the car's box and `unstick()` shoves you out sideways — a
check that skipped the climb would be asserting "did you come down" about a
player who was always on the ground.

**The bound is derived per frame, never typed.** A body leaving a surface of
height `h` cannot exceed `sqrt(2gh)`, so a frame lasting `dt` cannot lose more
than `sqrt(2gh)·dt + g·dt²/2`. Frame durations are recorded alongside the heights
so the bound is computed against the frames that actually happened — the mistake
that once produced a "0.1632 m apex" below a floor the physics cannot go under.

**IT CAN FAIL — proved, not asserted.** Reverting `fp.ts` to its parent commit
and re-running gives **exit 1, 5 of 6 cases failing**, worst case losing 1.273 m
in a 22 ms frame against a 0.163 m bound. This matters here specifically: six
checks in this project were found printing failure and exiting 0.

```
  OK   1. walked off the pickup BED FLOOR   — 0.590 m over 48 frames
  OK   2. JUMPED off the pickup BED FLOOR   — 1.020 m over 46 frames
  OK   3. no second jump in mid-air         — camera rose 0.000 m
  OK   4. walked off the pickup CAB ROOF    — 1.454 m over 177 frames
  OK   5. walked off the SEDAN BOOT LID     — 0.975 m over 158 frames
  OK   6. kerb unchanged — the 0.140 m kerb still goes down in one 0.153 m frame
```

**Case 6 passes in BOTH worlds, and that is the point of it.** It pins the
*current* kerb feel as a change detector, not as an endorsement: if someone later
decides terrain drops should fall too, it fails and makes them say so out loud
rather than changing the feel of every pavement in the world silently.

**On the BUILT bundle** (`npm run build` + `vite preview` on 4188), not only dev.

### Regressions, all green on the built bundle

| | |
|---|---|
| `w21-roof-climb.mjs` | PASS — every tier at its own height, off the roof all four ways, hop margin still 1 spare frame at the dt clamp |
| `w29-sedan-climb.mjs` | PASS — road → deck → boot lid → street, off it three ways |
| `jump-walk.mjs` | PASS — every apex in band, **stairs, half landing and upstairs all land on the floor they left** (the storey picker is untouched) |
| `npm run test` | 17/17 |
| `node scripts/bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, 96 shots, no new console errors |

### The world did not move

`fp` is legitimate here and only here: **this change adds no geometry at all**, so
GOTCHAS 75 does not bite. `textures`, `structure` and `tints` are **IDENTICAL**;
`places` differs by exactly 2 entries, both with a partner within 5 cm, which
`fpdiff` itself classifies as *"DRIFT (pigeons), not a move"*.

**My own verdict on the after-image:** I opened `shots/w21-on-the-roof.png`. From
the cab roof the view reads properly elevated — you see over the truck down the
street, storefronts, markings, pigeons and a citizen all intact. No corruption.

---

## Two INSTRUMENT faults found while writing the check — not world bugs

Half of all "defects" here are the instrument, and both of these would have been
reported as regressions:

1. **The kerb case first measured HEAD BOB.** It asked only for "a drop over
   0.05 m in some direction"; `bob` is 0.035 (`fp.ts:207`), so walking swings the
   camera 0.07 peak-to-peak and cleared that bar with no kerb in sight. It
   reported *"THE KERB CHANGED"* about a code path that provably cannot run for
   terrain. It now locates a real pavement→road step via `groundAt` and judges
   against **the kerb's own height**.
2. **The strafe onto the bed rail ignored facing.** `w21-roof-climb.mjs:159` has
   the correct formula; mine used only which side of the truck the rail is on, so
   it strafed off the far side and case 4 measured nothing.

A third, milder one: the climbs are genuinely flaky (chained hops), and a missed
climb was being reported as a failed step-off. Those are **opposite findings**, so
both climbs now retry three times, as `w21-roof-climb` already did.

---

## Found and NOT fixed — for the desk to queue

1. **Landing on a surface pops the camera up before it settles.** The mirror of
   this bug, and it is pre-existing, not introduced here. `standTop` credits a top
   once your feet are within `TOP_EPS` of it, and world Y is `gy + airY`, so the
   frame you are credited the roof your remaining `airY` is added *on top of the
   new floor* — you overshoot upward by up to that leftover `airY` and then settle
   as it runs out. Bounded and brief, and no user has reported it. The symmetric
   fix (subtract on a rise) is one line next to mine, but it re-times every climb,
   so it wants its own item and its own run of `w21-roof-climb`. **I deliberately
   left it: the item said drops.**
2. **Terrain drops are still instant, at any height.** A kerb is 0.14 m so nobody
   notices, but `groundAt` finds terrain steps of **0.237 m** (around x −9, z −14)
   and one of **0.99 m** — walking off those still warps you down. The item
   required the kerb to feel unchanged, so I did not touch terrain; whether a
   1 m terrain ledge should fall is a real question and a user call.
   `scripts/probes/w50-kerb-find.mjs` lists every step it can find.
3. **`scripts/interiors-walk.mjs` cannot run against a built bundle.** It
   `import()`s `src/proto/ct/doors.ts`, so against `vite preview` it dies with
   *"Failed to fetch dynamically imported module"* — it is dev-server-only, which
   nothing says. Not mine to fix; worth a line in its header or a `--dev` guard.

## Files

- `src/proto/fp.ts` — the fix (the item's named file, and the only source file touched)
- `scripts/stepoff-walk.mjs` — the acceptance check, wired as `npm run stepoff`
- `scripts/probes/w50-stepoff.mjs` — the before/after measurement
- `scripts/probes/w50-tops.mjs` — every standable collider top, by tag
- `scripts/probes/w50-kerb-find.mjs` — where the terrain steps are
