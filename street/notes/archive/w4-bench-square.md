# w4 — item 5e, "park benches are askew, should be in line with the path" — FIXED

## Root cause (one line)
`facingIn` at `ct/park.ts:1030` (old) computed each bench's yaw as
`Math.atan2(loopCx - bx, loopCz - bz)` — a bearing to a POINT, the loop's own
centre — but the loop's legs are straight runs, and a bearing to a point only
equals "square to the run" at the exact midpoint of a leg; everywhere else it
rotates toward the centre and drifts off-square, worse the further from the
midpoint, which is exactly "askew" and exactly why it only became visible
once benches were spread along the full length of each leg (a change from a
prior round, not this one).

## What I did
Replaced the single radial `facingIn` with two axis-derived functions,
`facingAcrossZLeg`/`facingAcrossXLeg`, one per leg orientation (the loop
perimeter is axis-aligned; chamfered corners carry no benches). Each still
derives from the SAME bearing-to-centre principle GOTCHAS §27 asked for —
`Math.atan2(loopCx - bx, 0)` / `Math.atan2(0, loopCz - bz)` — just with the
along-the-run coordinate zeroed instead of left in, rather than going back to
a typed literal per leg (which is the exact mistake that caused the
NINTH orientation bug documented a few lines above this one, in the same
file). Re-cut a leg and every bench on it still re-derives its facing; no
angle is written down anywhere. Left `ctx.seat`'s `Math.PI - yaw` conversion,
the fountain-clearance filter, and the mound bench's own explicit
`Math.PI / 2` (a genuine one-off, not on any leg) all untouched — none of
them needed to change.

## Verification
- **New check, `scripts/w4-bench-square.mjs`** (checked `ls scripts/` first
  for `bench*`/`park*` collisions per GOTCHAS 24 — `E-benchface.mjs` already
  exists and asserts a DIFFERENT, looser thing: "does the sitter face
  roughly toward the park, dot > 0.30" — not touched, not duplicated). This
  one asserts the actual complaint: every perimeter bench's seat yaw is an
  exact multiple of pi/2 (`|sin yaw| < 1e-6` or `|cos yaw| < 1e-6`), i.e.
  genuinely square to its own leg, not merely "roughly facing the right
  half of the world."
- **Mutation-tested per GOTCHAS §27** ("never let a check's tolerance be set
  by an argument — set it by a mutation"): stashed the fix, rebuilt, re-ran
  the new check against the OLD code — **7 of 7 perimeter benches FAIL**,
  with yaws like `1.1997`/`2.0046` instead of a multiple of `pi/2`. Un-stashed,
  rebuilt, re-ran — **7 of 7 PASS**, mound bench correctly skipped as the
  documented exception. The check would have caught the bug it exists for.
- **`E-benchface.mjs` (existing, untouched) still 9/9 PASS** — confirms the
  fix did not regress the "faces the right general direction" property it
  already owned.
- **Looked** at `benchfount.mjs`'s three existing look-angles (not committed,
  `shots/` is gitignored) — bench sits parallel to the path/wall, no overlap
  with the drinking fountain or the bin visible from any of the three. My own
  verdict: clean.
- tsc clean. `npm run build` clean (same two pre-existing chunk-size /
  dynamic-import warnings, unrelated). `bugsweep.mjs` against the built
  preview on :4183 — exit 0, zero STATION MISS, zero new console errors.

## What I did NOT check
Did not re-walk every hour of the day/night lighting cycle over the park —
nothing about lighting changed. Did not re-verify `park.mjs`/`parkcheck.mjs`/
the other dozen `park*` scripts individually; ran the two most directly
relevant (the existing facing check, and my new one) plus the world-wide
health sweep, and judged that sufficient given none of them assert facing
geometry by name apart from `E-benchface.mjs`.

## Derivation
`AXIS_TOL = 1e-6` in the check is a float-precision floor, not a design
number — `atan2` of exact axis-aligned inputs is accurate to within a few
ULP, so any real residual radial component (the bug this replaces) shows up
many orders of magnitude above that floor, as the mutation test confirms
(worst-case FAIL had `|cos yaw| = 0.42`, six orders of magnitude over the
tolerance).
