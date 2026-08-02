# w23 — item 34: the 5.260 m jump was the instrument, not the world

**Root cause in one line:** `scripts/jump-walk.mjs` computed the rise as
`apex - (pos()[3] + 1.62)`, but `pos()[3]` is `apt.gy()` — the storey the
hysteretic floor picker last settled on — while `fp.ts` builds the camera from a
different quantity entirely, so every metre the two disagreed by was reported as
jump height.

**Verdict: the world is correct and `fp.ts` is untouched (0 diff lines).** The
collider builder's ~0.57 m reading is the true one. w14's 5.260 m was an
artifact.

## Which reading is true

`fp.ts:452,455` — jump velocity `4.0`, gravity `14`. Analytic apex is
`v²/2g = 16/28 = 0.571 m`. That is the ~0.57 m the collider builder measured and
used, and it is right.

Measured on a settled camera at all seven spots: **0.475–0.525 m**. Nothing
anywhere near 5.26.

## Where 5.260 came from — the arithmetic is exact

`ct/apartment.ts:113-120` — `SPAWN.gy = 2 * ST0 = 5.4` (the walk-up's floor 3),
and the file's own comment at line 104 says **"Eye height lands at 7.02."**

```
7.02  -  (0.14 + 1.62)  =  5.260      <- w14's number, to the millimetre
```

Two faults combined to produce it, both in the instrument:

1. **Wrong quantity as the baseline.** `fp.ts:459-468` computes
   `y = height + groundY(pos.x, pos.z) + airY` — the *true* ground under your
   feet plus any collider top. `pos()[3]` is `apt.gy()`, storey bookkeeping.
   They coincide only when the picker (GOTCHAS §7, explicitly hysteretic)
   happens to agree with the ground.
2. **Unsynchronised sampling.** `Math.max` over `camY()` polled on a 30 ms
   wall-clock timer never checks that a frame rendered.
   `scripts/probes/jump-warp-transient.mjs` records **exactly one frame reading
   7.020 after a warp to the pavement**, then 1.76 thereafter. `Math.max` only
   has to land on that one frame. The pavement is the *first* spot in the list —
   the only one whose "previous" camera is the spawn — which is precisely why it
   alone reported a wild number while all six others read a sane 0.48–0.62.

I could **not** make the full 5.260 reproduce on demand in mainline (I tried
settle times 0–350 ms and CPU throttling ×20 — `scripts/probes/jump-repro-5260.mjs`).
Recording that honestly. But the mechanism is not speculative: I caught the same
fault live at small scale — see below.

## The same fault, caught live at 0.14 m

The first run of my new guard failed the **kerb edge**: `apt.gy()` reads `0.00`
there while `groundAt(-5.1, -20)` is `0.14`. The old code had been reporting the
kerb edge apex as **0.615 m = 0.475 + exactly that 0.14**. That is the 5.260
mechanism in miniature, confirmed on a running world: a picker/ground
disagreement being subtracted straight into the apex.

## What I changed (`scripts/jump-walk.mjs` only)

- Settle waits for **six consecutive stable rendered frames** and throws if the
  camera never settles — `waitForTimeout` cannot promise a frame happened.
- Baseline is the **measured rest camera**, not an assumed one.
- Apex sampled **in-page on rAF**, so it can neither miss the peak nor catch a
  stale frame.
- **No eye-height constant survives in the file.** The rest camera cancels it,
  whatever it is — the hand-typed `1.62` (a copy of `fp.ts:134`'s default) is
  gone. Per BUILDER-BRIEF §8, nothing is retyped: the guard derives the eye
  height from the world at the first spot and requires every later spot to agree.
- New guard: the camera must rest one **consistent** eye height above the
  world's own `groundAt` at every spot. A 7.02-over-0.14 baseline is now
  reported as itself instead of being subtracted into a 9× hop.

Band left at 0.45–0.8. **Not loosened** — it is what caught the mutation.

## Mutation tests (bytes confirmed changed each time, via `git diff --stat`)

| mutation | result |
|---|---|
| `fp.ts` vy `4.0 → 2.0` | apex 0.095–0.120, **7 fails, exit 1** |
| `fp.ts` camera `+0.5 m` off the ground | **4 baseline fails, exit 1** — and the apex still read 0.475, which is the fix working |

Both reverted; `git diff src/proto/fp.ts` is 0 lines.

## Proof

- Green on **dev (4182)** and on the **built bundle** (`vite preview`, 4201,
  build 260e3d19d).
- `node scripts/bugsweep.mjs` against the built bundle: **zero STATION MISS**,
  exit 0, 93 shots. Only pre-existing warnings (THREE.Clock deprecation, Canvas2D
  readback, GL ReadPixels stalls).
- **No `fp`/`fpdiff` run, deliberately:** `git diff 0d1e61de5 HEAD -- street/src/`
  is empty. The world is byte-identical, so there is nothing an after-image could
  show. Only `scripts/` changed.
- Ports: **4182** (dev) and **4201** (preview). 4180–4199 were fully occupied —
  4180 was taken between my scan and my use of it, and **4185 is `jump-walk.mjs`'s
  own hardcoded default**, so anyone running it without `SHOT_URL` tonight is
  measuring somebody else's world.

## Found and NOT fixed — worth rows

1. **jump-walk's three "storey" spots are not in the apartment, or on any upper
   storey.** `(104,-16)`, `(112,-16)`, `(120,-16)` — labelled "inside, ground
   floor", "the apartment stairs", "upstairs". `__ct.roomDims()` puts every
   interior at `cx` 440–1320, and the walk-up is at `APT_X0=200, APT_Z0=-20`.
   `groundAt` reads **0.000** at all three. The file's header says its whole
   purpose is the stacked-storey floor picker (storeys 0 / 2.7 / 5.4 / 8.1) —
   **that has never actually been exercised.** Compounding it, the call is
   `warp(x, z, gy ?? 0)`, which turns the spot list's `null` ("leave the storey
   alone") into an explicit `setGy(0)`, pinning "stairs" and "upstairs" to
   storey 0. I did not move the coordinates: retargeting the spot list is a
   bigger change to a check the whole suite depends on, and it deserves its own
   item with a real walk up the stairs.
2. **The kerb edge picker/ground disagreement** (`apt.gy()` 0.00 vs `groundAt`
   0.14). The camera correctly rests at 1.76, i.e. the *player* is on the
   pavement — it is the picker's bookkeeping that is adrift, not the player.
   That is `ct/apartment.ts`, not this item's file.
3. **`fp.ts:446`'s comment states an apex the world never reaches.** It claims
   "0.571 m apex"; the world delivers 0.475–0.525, and the value is
   **frame-rate dependent** — semi-implicit Euler decrements velocity before the
   position update (`fp.ts:455-456`), losing about `v·dt/2`. Outdoors (heavier
   frames) reads 0.475, indoors 0.52. Nothing a player would feel, but anyone
   who tunes the jump against that comment will be tuning against a number that
   does not exist.

## Probes left behind (`scripts/probes/`, per BUILDER-BRIEF §7a)

`jump-apex-truth.mjs` (baseline-free apex), `jump-repro-5260.mjs` (the
reproduction attempt, incl. CPU starvation), `jump-warp-transient.mjs` (the
one stale 7.020 frame), `jump-spot-storeys.mjs` and `jump-sticky-ground.mjs`
(where the spots actually are).
