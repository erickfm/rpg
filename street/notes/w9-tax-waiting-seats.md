# w9 — item 5f: tax office waiting seats face the wall

## Verdict: real bug, but the queued diagnosis had the wrong cause

**Root cause, in one line:** the waiting row's `ctx.seat({ yaw: 0, ... })` was
never wrong — the CHAIR MESH's backrest (`ct/int-tax.ts`, "the back") was built
on the room side of the seat pad instead of the wall side, so from anywhere in
the room you saw three backrests facing you, which reads as "these face the
wall" even though sitting in one actually turns the camera the right way.

## Why the item's own math was backwards

The item claimed *"Forward here is `(sin yaw, cos yaw)`, so yaw 0 faces +z —
into that wall"*. That formula is missing a sign. `fp.ts:299-304` and
`:361-366` (used identically seated or standing) compute the look vector as
`(sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch))` — **note the minus
on `cos`**. At `yaw = 0` that is `(0, 0, -1)`: **-z**, not +z.

`interior.ts:850-851` draws this room's front wall (the one with the door) at
local **z = +hd**, and `WAIT_Z = hd - 0.62` sits right up against it. So
`yaw: 0` on this seat already points **away from that wall, into the room** —
which is exactly what the row's own comment asks for ("A WAITING ROW against
the front wall ... facing the desks").

**Measured live**, not inferred (`scripts/w9-tax-seat-repro.mjs`): warped to
the seat's own approach point, pressed E, read the camera's yaw back out.
Result: `yaw = 0`, look direction `(0, -1)` — squarely at the preparer's desk
(`z = -0.75`), not the wall (`z = +4.25`). **The interactive facing was
correct before this item was even queued.**

## What was actually wrong, and the fix

`ct/int-tax.ts`, the waiting row (~line 440): the backrest box ("the back")
was placed at `WAIT_Z - 0.20` — on the **room** side of the seat pad. For a
person facing -z (into the room), a backrest in front of them, between them
and the desks, is backwards; it belongs on the **wall** side, `WAIT_Z + 0.20`.
Confirmed by the room's own working example two dozen lines up: the desk's
`chair()` closure gives the client's seat (which faces -z, same as this row)
a back offset of `+0.2` for exactly this reason.

**Fix: one sign, `WAIT_Z - 0.20` → `WAIT_Z + 0.20`.** Nothing else needed
correcting — the front rail (`WAIT_Z - 0.18`, a footrest in front of a -z
facing) and the rear support legs (`WAIT_Z + 0.16`, now sitting right beside
the corrected backrest) were already on the sides consistent with facing -z.
So was the shared low table in front of the row (`WAIT_Z - 0.04`) — further
evidence the room was always designed around a -z facing, and only the
backrest's own offset had the wrong sign.

## Verification

- `npx tsc --noEmit` — clean.
- `scripts/w9-tax-look.mjs before|after` — screenshots from inside the room
  looking at the row. **Looked at personally**: before, the tall backrest
  panels face the camera (the room); after, the low seat pads face the camera
  and the backrests sit against the window/wall behind them. Screenshots only
  used for looking, per BUILDER-BRIEF §10, not as proof by themselves.
- `scripts/w9-tax-seat-repro.mjs` — confirms the interactive sit yaw is
  unchanged (still `0`, still facing -z) before and after — this fix never
  touched the seat's `yaw` or its `ok`/`label`, only mesh geometry.
- `scripts/interiors-walk.mjs tax` — 25/26 pass (unchanged from before this
  fix; the one FAIL, "the customer station comes from the world, not from
  memory", is a pre-existing instrument note about a served-spot fallback,
  unrelated to the waiting row).
- `scripts/bugsweep.mjs` — 93 shots, zero STATION MISS, zero console errors.
- `scripts/w9-onetest.mjs` (not committed, throwaway) reproduced
  `seats-walk.mjs`'s exact standable-point + E-press sequence for this seat
  in an otherwise-fresh page and it seated correctly — see below.

## Found but not fixed — flagging for the desk

`scripts/seats-walk.mjs`, run against the full seat list (238 seats,
including the two items already fixed this session), reports **FAIL "E did
not seat you" for every seat from #200 to #238 with no interruption** —
spanning the jail pews, the diner counter and booths, the hotel sofa/armchair/
lobby, the casino table, the library terminal and reading table, and this
room's own "sit down with the preparer" and "sit and wait" seats. That is six
unrelated rooms failing identically and consecutively, which reads as the
harness losing state partway through a 238-seat run, not six simultaneous
real regressions. **Confirmed instrument, not world**: re-running the exact
same standable-point-then-E sequence for the tax waiting seat in isolation
(fresh page, this seat only) succeeds cleanly. I did not have time to find
what breaks around seat #200 of `seats-walk.mjs` itself — flagging for
whoever owns test infrastructure (same theme as QUEUE item 9, `checks.mjs`
killing its own server partway through — a different script, same class of
problem). **Do not read "182 failing seats" as new breakage from this
session's two fixes** — both fixes were independently verified against fresh
page loads.

## Derivation

The fix direction (`+0.2` for a -z-facing seat) is not invented — it is read
straight off the desk's own `chair()` closure a few dozen lines above in the
same file, which already gets this right for the client chair.
