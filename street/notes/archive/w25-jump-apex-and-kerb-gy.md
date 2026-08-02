# w25 — item 43: the jump apex comment, and the kerb-edge `gy` drift

Port used: **4182** (the only free port in 4180–4199; `ss -ltnp` shows 4177 and
4180–4199 all listening except it). Verified on the BUILT bundle via
`npx vite preview --outDir dist --port 4182 --strictPort`.

Both halves are comment-only. No behaviour changed, and `jump-walk.mjs` reports
the identical seven rows before and after.

---

## (1) The jump apex — the item is right, and the defect is bigger than line 446

**Root cause, one line: the loop is semi-implicit (symplectic) Euler and
decrements `vy` BEFORE integrating position, which costs exactly `v0*dt/2` of
height, so the analytic `v0^2/2g` is a dt → 0 limit the world approaches from
below and never reaches.**

The item says line 446 quotes an unreachable 0.571 m. True — but **every figure
in that comment block is analytic and none is reachable.** Checked all six:

| quoted | `v0^2/2g` | `2*v0/g` |
|---|---|---|
| 3.6 / 11 → 0.589 m apex, 0.655 s hang | 0.589 | 0.655 |
| 4.0 / 13 → 0.615 m apex, 0.615 s hang | 0.615 | 0.615 |
| 4.0 / 14 → 0.571 m apex, 0.571 s hang | 0.571 | 0.571 |

Every one is the closed form to three decimals. So the whole block was arithmetic
presented as measurement, not one stale line.

### The correct expression

Summing the discrete steps to the sign change gives

```
apex(dt) = v0^2/(2g) - v0*dt/2  =  0.5714 - 2*dt      (v0 = 4, g = 14)
```

`src/main.ts:107` is `const dt = Math.min(clock.getDelta(), 0.05)`, so dt is
clamped and the hop has a **hard floor of 0.475 m** — an exact reachable value,
not the bottom of a noise band.

Simulating the integrator verbatim agrees with the closed form and with the
world: dt = 0.05 → 0.4750, dt = 1/60 → 0.5383.

### Measured (`scripts/probes/w25-jump-apex.mjs`, built bundle)

```
run 1: apex 0.5383 m   62 fps (dt 0.0162)   formula 0.5390
run 2: apex 0.4850 m   23 fps (dt 0.0444)   formula 0.4826
run 3: apex 0.4789 m   21 fps (dt 0.0472)   formula 0.4770
run 4: apex 0.4848 m   21 fps (dt 0.0472)   formula 0.4770
run 5: apex 0.4823 m   23 fps (dt 0.0444)   formula 0.4826
run 6: apex 0.4750 m   20 fps (dt 0.0500)   formula 0.4715
```

Range **0.4750 – 0.5383 m**, every hop within **0.008 m** of the formula
evaluated on the frames that produced it. The 62 fps run lands on 0.5383, which
is the simulated 60 fps value to four decimals.

**The comment now states 0.475 m to about 0.538 m plus the formula, and a fresh
run reproduces it** — the item's DONE WHEN for this half.

The item's own estimate of "0.475–0.525" was slightly low at the top: 0.525
corresponds to ~43 fps, and a 60 Hz display actually sees ~0.538.

### An instrument fault found on the way, worth its own paragraph

My first version of the probe waited a fixed 1100 ms after the keypress and
reported a **0.1632 m apex** on one run — *below a floor the physics cannot go
under*, which is how I knew it was the instrument and not the world.

At the dt clamp the hop needs ~12 physics steps; under load those 12 frames span
well over a second of wall clock, so the window closed mid-ascent and I measured
a truncated rise. The probe now waits for the hop to **end** (take off, then rest
for 4 consecutive frames). GOTCHAS §30, committed again in a new place.

**`scripts/jump-walk.mjs` still has the same fixed `waitForTimeout(1100)`** and
is exposed to the identical truncation. It has not misreported in my runs, but it
is one slow frame away from doing so. Not fixed — it is not a file this item
names. See "not fixed" below.

---

## (2) The kerb edge — the item's symptom is real, its LOCATION is wrong

**Root cause, one line: `groundPick` is a query with a side effect — every one of
its returns goes through `apt.setGy` — and `canSee` calls it once per candidate
`[E]` spot every frame at the SPOT's coordinates, so `lastGy` ends each frame
describing the last spot the prompt-aimer probed rather than the ground under the
player.**

The item files this against `ct/apartment.ts`. **`apartment.ts` is the victim, not
the cause, and there is nothing to fix in it.** `setGy` is
`(v) => (lastGy = v)` — it stores exactly what it is handed — and
`crosstown.ts:780`'s `groundPick` routes *every* return through it. Two functions
that agree by construction cannot disagree about one coordinate.

Confirmed there is no positional confound: at the kerb edge the rig stands at
exactly (-5.100, -20.000), **drift 0.000 m**, and

```
apt.gy() = 0.000   groundAt(aimed) = 0.140   groundAt(actual) = 0.140   camY = 1.760
```

The camera is right (1.620 eye + 0.140 ground), which is why nobody sees this in
play.

### The mechanism, demonstrated

`groundPick` has exactly three callers (`crosstown.ts` 766, 984, 1125). **Only
766 passes the player's position.** 1125 is
`aim.set(s.x, groundPick(s.x, s.z) + 1.1, s.z)` inside `canSee`, per frame, per
spot. On the pavement the last spot probed happens to sit at 0.14 and it looks
correct; at the kerb edge it is a road-level spot at 0.00 and it does not.

Measured — standing still on the pavement, **one** `groundAt` call about a
different coordinate:

```
standing at (-6.000, -20.000)  apt.gy() = 0.140
asked groundAt(-2.00, -20.00) -> 0.000   (the player did not move, 0.000000 m)
apt.gy() immediately after, same tick: 0.000
one frame later, the loop has rewritten it: 0.140
```

**This is only visible inside a single tick.** Sampling across two `evaluate`
calls shows nothing wrong, because `rig.update` → `groundPick(player)` repairs it
every frame. My own first attempt at this test was fooled exactly that way and
reported "OK, it is a pure read". That is the reason the drift has survived: the
damage is repaired before anyone looks, and it is only observable at the one
moment — end of frame — when `pos()` happens to be sampled.

`groundAt` being the exposed test affordance (`crosstown.ts:984`) means **every
probe in `scripts/` that calls `groundAt` mutates world state as it measures.**
That is the wider finding.

### Consequences today

Small but non-zero. `gy()` gates the No. 227 entry spot (`lastGy < 1`), the
respawn band, and — most interestingly — `crosstown.ts:1120`'s
`const eye = new THREE.Vector3(px, apt.gy() + 1.6, pz)`, the height the `[E]`
line-of-sight ray is cast from. A 0.14 m error there is harmless; the same
mechanism on a stairwell, where candidates are a storey apart, would not be.

DONE WHEN asked for "fixed **or** explained with its cause named". It is
explained, the cause is named in `apartment.ts` beside `gy()` where the next
reader will meet it, and the header's "exactly one writer of record" claim now
says why one writer is not enough.

**I did not fix it: the fix is in `crosstown.ts`, which this item does not name**
(BUILDER-BRIEF §9). The shape is one line — give `canSee` and the `groundAt`
affordance a pure ground query, and leave the `setGy` side effect on the single
call at 766 that passes the player's position.

### The item's "a new guard already catches it" — I could not find one

- `jump-walk.mjs`'s baseline guard compares the camera against **`groundAt`**,
  not `apt.gy()`, so it passes.
- `A-eye-height-holds.mjs` does read `apt.gy()`, but its tolerance is **0.5 m**
  and the error is 0.14 m. Run on the built bundle: *"places where the gate's eye
  is more than 0.5 m from the player's: 0 of 14"*. It passes.

If such a guard exists it is in a tree that has not landed here.
`scripts/probes/w25-kerb-gy.mjs` is now one: it FAILS on current `main`, by
design, and its failure is the finding.

---

## Verification

- `npx tsc --noEmit` clean.
- `scripts/jump-walk.mjs` — seven spots, identical before and after, *"jump lands
  you on the floor you left, everywhere"*.
- `scripts/A-eye-height-holds.mjs` — MEASURED FINE, 0 of 14.
- `node scripts/bugsweep.mjs` — 93 shots, **zero STATION MISS**. Remaining console
  lines are pre-existing warnings (THREE.Clock deprecation, Canvas2D
  `willReadFrequently`, WebGL teardown), no errors.
- Both new probes were run against the BUILT bundle, and `reportWorld` refused a
  stale one twice and made me rebuild — working as intended.

## Found and NOT fixed — for the desk to queue

1. **`crosstown.ts:1125` / `:984` — the actual kerb fix.** Make ground queries
   pure; keep the `setGy` write on the player path at 766 only. Named here rather
   than done because item 43 does not name `crosstown.ts`. **This is the one real
   code change the item implies.**
2. **`scripts/jump-walk.mjs` still waits a fixed 1100 ms** for a hop whose
   duration is frame-rate dependent. Same truncation that gave me a 0.1632 m
   apex. Replace with a wait for the hop to end.
3. **Every `scripts/*` caller of `groundAt` mutates the world it is measuring.**
   Consequence of (1); worth a sweep once `groundAt` is pure.
4. **`checks.mjs:857` cites `L-games-in-artifact.mjs` at the wrong path** (it is
   in `scripts/probes/`). Carried over from item 45.
5. **The 4180–4199 port range is exhausted** — 19 of 20 listening, several held
   by long-dead agents' orphaned vite processes. The next builder will find none.

## Derived vs copied

`v0 = 4.0`, `g = 14` and the `0.05` dt clamp are **copied** into
`w25-jump-apex.mjs` as named constants with line citations
(`fp.ts:452-458`, `main.ts:107`) — they cannot be imported into a node probe
without pulling the Three.js module graph in. Everything else is derived: seat
and spot coordinates from the world at runtime, the apex from the camera, the
build SHA from `which-world.mjs`. The probe recomputes the formula rather than
quoting a result, so if either constant moves the probe moves with it and the
comment's numbers are what goes stale — which is why the comment now carries the
formula as well as the range.
