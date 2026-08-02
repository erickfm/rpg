# w28 — item 56: door301's settle detector was blind

**Root cause, one line, and it is mathematical:** `__leafSig()` returned the sum
of squares of the leaf's world matrix — the Frobenius norm — and a door swinging
on its hinge **cannot change it**, so the "wait for the swing" machinery never
armed and `press()` silently degraded to a fixed 1500 ms sleep.

## Why the norm is constant

The leaf rotates about its own origin. The translation terms `e[12], e[13],
e[14]` therefore never move, and the rotation block's Frobenius norm is 3 at
every angle — an orthonormal basis has unit columns whatever the yaw. The
signature is **incapable** of changing while the door swings.

The tell was sitting in plain sight once the helper printed anything:
`press()` reported **`moved=false` on every press, on runs that PASSED.**

## So what was the flake?

With the start-detector permanently blind, `press()` always waited out its
`START_CAP` and returned. That is a wall-clock 1500 ms:

| | frames in 1500 ms | door finished? |
|---|---|---|
| idle machine | ~36 | yes, by luck — **green** |
| CPU x4 | ~6 | no — **red** |

Which is exactly w26's report: fails inside `checks`, passes on re-run against
byte-identical bytes. The check was never waiting for the door; it was waiting
for a second and a half and hoping.

Reproduced deliberately before changing anything — `DOOR301_CPU=4` failed
**3 runs out of 3, on the same two assertions every time**:
`after E, doorway blocked: false` and `E from inside the swing DOES shut it:
false`.

The bitter part: `press()` carries a long comment explaining that the swing is
driven by the render loop and must be waited on rather than slept through. The
reasoning was right and the instrument did not implement it.

## Five instrument faults, and not one tolerance touched

1. **The signature.** Now transforms the leaf's local `(1,0,0)` into world
   space, carrying the rotation basis as well as the translation, so it moves
   the instant the hinge does. `moved=true` within 2–3 frames.
2. **The instrument was slower than what it measured.** `__leafSig` ran
   `scene().updateMatrixWorld(true)` and traversed **every mesh in the world**
   on every rAF of the settle loop — **2.25 seconds per frame at x4**, so the
   settle loop could not collect its four still frames before the cap. The mesh
   is found once and cached; later calls update only its own branch.
3. **Both caps were wall-clock**, in a loop whose own comment says the swing is
   driven by frames. `START_CAP` 1500 ms was 6 frames at x4; `RUN_CAP` 8000 ms
   was 4. They are frame counts now (90 / 600) and mean the same thing at any
   speed.
4. **`keyboard.press('e')` was a tap** — BUILDER-BRIEF §5, the most documented
   instrument bug in this project, still present here. E is now held across
   three painted frames, and `press()` waits for an `[E]` prompt to be showing
   before sending it, because the callers sleep a fixed 400–500 ms first and at
   x4 that can be two frames — the key arriving before the spot has been picked.
5. **A dead server was reported as a red.** `page.goto` threw, node turned it
   into exit 1, and exit 1 here means "measured, and the door is WRONG". A soak
   scored two reds against a perfectly good door when the preview server was
   reaped out from under it — the same "check nobody can act on" this item is
   about. It exits **3** now (GOTCHAS §32), and the soak runner retakes rather
   than scores it.

`press()` also now always logs `moved / frames / ms`. A flaky check that prints
only its verdict makes the next person reproduce the flake before they can even
see it; that one line is what turned this item from a hunt into a diagnosis.

**No `expect()` tolerance was widened.** The only limit I raised is the
*screenshot* timeout, which feeds no verdict.

## Evidence

| | before the fix | after |
|---|---|---|
| CPU x4 | **0 / 3** — same two assertions every run | **11 passes**, most recently **6 consecutive** |
| CPU x1 | passes, but every press blind (`moved=false`) | 3 / 3, every press `moved=true` |
| `--selftest` (doorway jammed) | caught | **still caught** — 6 FAILs, "SELFTEST PASSED" |

The last six x4 runs were taken while this box sat at **load average 18–21**
(the rest of the fleet), which is a heavier real throttle than the synthetic x4
on top of it. That is the condition the original flake appeared in.

## What I could NOT do, and why

**CPU x8 is not achievable in this sandbox.** It is not the door: at x8 the
headless browser *process itself dies* — `Creation of StagingBuffer's SharedImage
failed`, then `Target page, context or browser has been closed` — because
Chromium here runs `--enable-unsafe-swiftshader`, a software rasteriser, and an
8× CPU throttle on top of software WebGL exhausts it. It died at x8 identically
with screenshots on and off, and before and after my changes. So the DONE WHEN's
"x8" is substituted with **x4 plus a genuinely loaded machine**, and I am saying
so rather than quietly running x2 and calling it x8.

**I did not reach ten consecutive at x4 in one unbroken block.** Eleven runs
passed; the interruptions were a reaped preview server (fault 5 above, now
exits 3) and my own 600 s harness ceiling — a single x4 run at load 20 takes
over ten minutes. **One x4 run exited 1 with no assertion FAIL printed** —
an exception, immediately after I restarted the preview server — and it did not
recur in the eleven runs since. I would rather flag that than round it away.

## Found and NOT fixed

1. **The one unexplained x4 `exit=1`** above. If it recurs, `press()`'s new
   per-press log and the exit-3 guard will now say which it was.
2. **Every caller still sleeps a fixed 350–500 ms after `warp()`** before
   reading. `press()` no longer trusts those, but `prompt()` and `shut()` reads
   outside `press()` still do — e.g. the `waitForTimeout(900)` for `unstick` to
   ease the player clear, which is frame-driven for the same reason. It did not
   fail in any run here, but it is the same latent fault and would be a cheap
   follow-up.
3. **`DOOR301_CPU` / `DOOR301_NOSHOTS` are not wired into `scripts/checks.mjs`.**
   Throttled soaking is exactly what the suite should do to catch this class,
   and nothing in the runner can ask for it.

## Ports

**4180**, built preview (`curl` → `000` before first use; restarted once mid-item
after it was reaped). Shut down at the end, along with the 4181 dev server from
the previous item.
