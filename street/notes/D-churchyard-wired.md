# The churchyard IS wired — E's probe is a false negative

For the desk and builder E. Nothing here is blocked; this exists because
`E-yard-walk.mjs` prints *"the churchyard is NOT wired — climb tests skipped"*
and that line has now sent the same task back to me twice.

## Both patches are landed

`notes/E-church-street.patch` landed in `9fa92d57`, written out properly rather
than as E's `void 0;` stub (which was itself marked *"revert before commit"*).
The blanket church footprint survives only as a commented record at
`ct/street.ts:829`. The floor-picker side is landed too: `crosstown.ts:502`
calls `courtGround(x, z)` before the flat-paving fallback, exactly as E asked.

## The probe reads the camera before it has arrived

`E-yard-walk.mjs:44-46`:

```js
const warp = (x, z, yaw, gy = 0.14) => …window.__ct.warp(x, z, yaw, gy, 0)…
await warp(9.2, DOOR_Z, 0);
await page.waitForTimeout(60);
const WIRED = (await pos())[3] > 0.3;
```

The `gy = 0.14` default forces the ground to kerb height, and the camera EASES
to the picked ground instead of snapping. Measured at E's own probe point
(9.2, −79.5):

    gy arg 0.14, waited  60ms -> pos()[3] = 0.140     <- what the probe sees
    gy arg 0.14, waited 300ms -> pos()[3] = 0.140
    gy arg 0.14, waited 900ms -> pos()[3] = 0.550
    gy arg 0,    waited  60ms -> pos()[3] = 0.550
    gy arg 0.55, waited  60ms -> pos()[3] = 0.550
    after one step forward    -> pos()[3] = 0.550

So the answer is 0.55 — well over the 0.3 threshold — and the probe reads
0.14 because it asked 840 ms too early from a forced starting height. Passing
`gy = 0` or taking one step makes it read true immediately. Raising the
timeout alone does **not** fix it at 260 ms; it needs ~900 ms, or a step, or a
different `gy` default.

## You can walk up the church steps

Which is the thing the user actually asked for. Walking east from the pavement
at z −79.9, through the gate, sampling the ground every step:

    x 6.09  gy 0.14      the kerb
    x 6.75  gy 0.14
    x 7.55  gy 0.14
    x 8.20  gy 0.19      the flight starts
    x 8.82  gy 0.44
    x 9.15  gy 0.55      the door sill, and you stop at the wall
    eye height 1.62 throughout — no jolt at any nosing

`scripts/D-walk.mjs` asserts this now: that the ground reaches the sill, that
it rises **gradually** (≥ 2 steps of rise, not one teleport), and that no
single step gains more than 0.34 m — a whole riser, which is the GOTCHAS §7
failure mode where the picker answers tread tops and the camera jolts.

**So "i want to be able to walk up those stairs" is done for both buildings.**
The only thing left is E's probe, and that is E's file — I have not touched it.
