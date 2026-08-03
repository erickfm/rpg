# w64 — the sixth "shadow texture" report, and why the detector kept missing it

Item 186. Ports: **4201** (dev), **4202** (built preview). Both `000` before binding.

> *"[screenshot] get rid of shadow texture here pls"* — 2026-08-02, the alley
> mouth by the payphone and the dumpster.

## The root cause in one line, and it is NOT the one on file

**The alley floor is textured, at 24 px/m, with twice the sidewalk's relative
grain — and painted at a third of its brightness, so once the world's
multiplicative grade is applied there is nothing left to see but a black shape
with a straight edge.** That is a painted shadow, and his word is literally
accurate.

`ct/paint.ts:52` holds the standing diagnosis of this class — *"an untextured
quad has no grain for the eye to attach to and no joints to give it scale, so it
reads as a TINT OVER the paving"* — and **it does not apply here.** Measured
(`scripts/probes/w64-alleymouth-shot.mjs`):

| | canvas | mean luminance | sd | relative grain |
|---|---|---|---|---|
| sidewalk paving | 256 x 256 | 123.5 | 12.1 | 9.7% |
| alley floor, before | 158 x 156 | **43.3** | 8.4 | **19.4%** |
| alley floor, after | 158 x 156 | **64.7** | 8.4 | 12.9% |

It had *more* grain than the surface it abuts. What it did not have was any
brightness to show it in. In **his own frame** those numbers rendered as
**49.6 against 14.8** — measured off his PNG — and at 14.8/255 an sd of 8.4 is
about ±3 levels.

**The grade is multiplicative and cannot be argued with.** `ct/props.ts`
multiplies graded materials toward `FLOOR_GROUND = 0.045`, and this floor is
also `wet()`-registered (the alley is roofless) so `updateRain` darkens it
further. Whatever is painted here is *scaled*, never offset. There is no shade
in this world at all — it is entirely `MeshBasic` with no lights — so an alley
is only darker than the street if somebody paints it darker.

**The fix:** base `#2e3034` → `#42454a`, the same blue-grey scaled by 1.43 in
luminance, which lands the floor's mean at 64.7, beside the road's rather than
at a third of the walk's. Rendered from the same camera and clock, the alley
went **45.2 → 67.4** and the step against the sidewalk **0.41 → 0.55**.

**And the nine stains were the other half of the report.** Nine soft black
ellipses at alpha 0.32, up to 2.2 m across on a 6.6 m floor, are
indistinguishable from something's shadow — and nothing in this world casts one,
so the eye hunts for the object and does not find it. They are four visible dark
blobs in `/tmp/w64-alley/before.png` at midday, before any grade. Now 16 marks
at alpha 0.15, at most 1.2 m across, which reads as ground that has been walked
on. Frames: `/tmp/w64-alley/{before,after,before2,after2,ship}.png`.

## The census: registered, ratcheted, and two of its own bugs fixed

`scripts/w5-shadow-census.mjs` has existed since item 0a and was **in no tier of
`npm run checks`** — grep it in `checks.mjs` before today, zero hits. It is
registered now, with a `--selftest` (it strips the map off the alley floor;
BARE goes 62 → 63 and the area 145 → 188 m², exit 1).

**Current count: 62 meshes / 145 m², against B's 123 / 454 quoted in
`ct/paint.ts:56`. 61 of the 62 are INDOOR.** The whole outdoors — street, lot,
park, civic forecourt — has **one** bare ground surface left, 16.7 m² of
`tex-ground` at (6, 2.6).

Two defects in the census itself, both found by running it rather than reading it:

1. **It counted FURNITURE as ground.** A library bench is 0.92 x 3.2 m with a
   horizontal top, its centre sits at y 0.37 inside the [-0.35, 0.55] band, and
   its footprint beats both side areas — so it passed every clause. Fixed with
   `dy <= 0.35`: ground is thin, and the deepest real ground box in the world
   (the sidewalk slab) is 0.10 m.
2. **It measured THE WEATHER.** `updateRain` owns `m.color` on every wet
   surface and rewrites it every frame, so folding the tint into the luminance
   gave 30 and then 31 on two identical runs. It reads the texture canvas only
   now, and `Math.random` is seeded before load exactly as `scenedump.mjs` does
   (`dither()` is unseeded on purpose, so a mean drifts per load). Three
   consecutive runs now agree exactly.

**Ratcheted, not zeroed.** A check demanding zero on a historical backlog is one
that gets weakened until it passes.

## ⚠ THE DETECTOR FOR THE DARK VARIANT DOES NOT EXIST, AND I COULD NOT BUILD IT

This is the part the desk should read. The row's own warning — *"it will come
back a seventh time if you stop there"* — is right, and registering BARE does
**not** answer it, because **BARE was green on the exact surface he reported.**
`!mat.map` is structurally blind to a textured-but-black floor.

I tried twice to build the missing predicate and **both attempts were wrong**.
Written up in the script's header so the next person does not repeat them:

1. **Ratio alone.** I set the threshold at 0.45, arguing the road-against-kerb
   step was 0.50 and so 0.45 sat safely under it. **Measured, the road is 0.36
   to 0.41 of the walk beside it — DARKER than the 0.35 alley floor the user
   rejected.** The complaint and the approved surface are the same number. It
   fired on 77 surfaces.
2. **Ratio plus flush.** Next idea: a kerb is a 0.15 m step, a real object that
   explains a change of tone, while a shadow has no thickness — so require the
   two surfaces to be level. That cut 77 to 28 and removed the nonsense
   pairings, which looked like progress. **Then the selftest went green: the
   alley floor's top is 0.07 m below the walk's, so the clause excludes the very
   surface it was built for.**

So the STEP census **prints and is not gated**. A threshold I have twice shown
myself to be wrong about must not become a red light people learn to ignore
(BUILDER-BRIEF §7, GOTCHAS 58, and the script's own note about `masonry.mjs`
crying wolf on 42 of 109 faces). All 28 rows and their numbers print for whoever
takes the third attempt.

**My untested guess for that attempt:** what separates the road from the alley
is neither tone nor height but that the road is CONTINUOUS and IDENTIFIED — lane
markings, a camber, kerbs both sides — while the alley floor is an isolated
patch with a straight edge and nothing on it. That is a much harder predicate.

## The four complaints B's 123/454 was named for

`ct/paint.ts:58` names four. Measured against the census today:

| complaint | state |
|---|---|
| shadow-geometry patches at the library forecourt | **closed** — no bare outdoor civic ground remains |
| the driveway apron as a large flat grey plane | **closed** — `I-flatground` reports 0 flat-colour surfaces / 0.0 m² in the lot |
| the blank slab in the library INTERIOR | **open** — the biggest indoor hit is still 4.0 m² at (1072.4, −5.8), inside the library slab |
| the park paths reading as road | **closed** in the census's terms; item 89 is the user's *second* rejection of that surface and is a separate open row |

The one remaining outdoor bare surface is 16.7 m² of `tex-ground` at (6, 2.6).

## How it was proved

Built bundle (`vite preview`, 4202) as well as dev.

| | |
|---|---|
| `scripts/w5-shadow-census.mjs` | green at 62/62 meshes, 145/146 m²; `--selftest` exit 1 on both numbers; identical on dev and built |
| three consecutive runs | 62 / 145 / 28 every time — the flapping is gone |
| `scripts/checks-registered.mjs` | no longer lists it (only `texdensity.mjs` remains, item 161's, pre-existing) |
| `scripts/I-flatground.mjs` | 0 flat-colour surfaces in the lot |
| `scripts/A-flat-ground.mjs` | exit 0 |
| `node scripts/bugsweep.mjs` | 0 STATION MISS, 0 COVERAGE |
| `node scripts/health.mjs` | WORLD OK, exit 0 |
| `npx tsc --noEmit` | clean |

`fp` is **not** cited here: this changes a texture's pixels, which is exactly
what the texture fingerprint hashes, so it would report a difference that is the
change itself.

## Found and NOT fixed

1. **The dark-ground detector**, above. The most valuable open thing here.
2. **`scripts/checks-registered.mjs` is red on `texdensity.mjs`** — has a
   `--selftest`, in no tier. Item 161's file, pre-existing, untouched by me.
3. **`scripts/checks-can-fail.mjs` is red on `w40-bed-vs-door`** — registered
   with no declared failing path. Pre-existing, untouched.
4. **The census's indoor 61 are still not attributed** — every one reports
   `(unattributed)`, so nobody can be told which module owns them. They want
   `userData.mod` stamps in the interiors before that number means much.
