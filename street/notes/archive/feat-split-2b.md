# feat/split-2b — finishing the crosstown.ts module split

Pure refactor. Nothing about the world changed.

`crosstown.ts` **1213 → 448 lines**. It is now the entry point only: the ground
planes and kerbs, the shared build context, the collider list, the FPRig, the
`[E]` spots, the `__ct` debug hook, and the sim loop.

## What moved

| module | lines | what's in it |
|---|---|---|
| `ct/ctx.ts` | 31 | the shared build context — `CtxBuild`, `Board`, `WetSurface` |
| `ct/apartment.ts` | 466 | No. 227: hall/stairwell shell, switchback, 301, the hermit, the street entrance, **and `lastGy`** |
| `ct/hud.ts` | 191 | sky/night curves, night wash, watch, wallet, `[E]` prompt |
| `ct/props.ts` | 258 | rain, trees, lamps, hydrant, pigeons + crumbs, payphone |

Everything was lifted by `sed -n 'A,Bp'`, never retyped. A line-level audit of
the original file against the four new ones shows the only lines that did *not*
survive verbatim are the ~50 I deliberately rewrote (the state indirections
below, plus dead imports) — no geometry or texture-painting line changed.

## The three shared-mutable-state problems, and what I did

**`lastGy` → owned by `ct/apartment.ts`.** It is a floor *picker* with
hysteresis, not a value: with four storeys stacked over a 2D walker, "which
floor am I on" is only answerable from the height you were at last frame. The
module exposes `ground(x,z)` (the picker), `gy()` and `setGy(v)`. `setGy`
returns what it was handed, so the street's own `groundY` reads as a chain of
`return apt.setGy(…)` instead of assign-then-return. Outside writers are now
exactly the two the brief predicted — the `__ct.warp` hook and the `groundY`
closure — plus `jumpTo` for the door teleports.

**`boards`, `wetMats`, `propColliders`, `citAvoid`** → hoisted above every
module call and passed down in one `CtxBuild` object. They are appended to
during construction from three different regions, so they cannot be
module-owned and returned; the alternative (each module returning its own list
for the entry point to concatenate) would have changed collider *order*, which
is observable. `obstacle()` stayed in `crosstown.ts` because it writes to two of
those lists and cars/citizens use them directly.

**`cash`/`inv` → a `Purse` handed to the HUD; `walletOpen` → HUD-internal.**
The HUD draws from the purse but owns none of it, so game state stays in the
entry point. `totalMin` also stayed — it is the sim clock, and rain, the hermit,
the sky and the lamps all read it.

## Left coupled, deliberately

- **`wetMats` is built in `crosstown.ts` but tinted in `ct/props.ts`.** The
  `wet()` helper has to exist before the road planes are laid, which is long
  before props builds; the tint belongs with the rain. Splitting it further
  would mean a fifth module for three lines.
- **Construction order is load-bearing and now spans four files.** The seeded
  `rnd()` stream sets tree heights and pigeon placement, and the fingerprint
  harness seeds `Math.random()` to make the painted textures reproducible — so
  the sequence street → apartment → bodega → props → cars → citizens must not be
  shuffled. There is a comment saying so at the top of `ct/props.ts`. This is
  the main thing a second builder could break without noticing.
- **`ct/street.ts` still takes its own loose argument bag** rather than
  `CtxBuild`. It was out of scope for this branch and works fine; worth
  converting next time someone is in there anyway.

## Verification

Fingerprinted after **each** module, not just at the end — all three
intermediate checks were clean, so nothing had to be bisected.

```
                    textures   structure   places
before (baseline)   ad14bd15   615aa120    —
after apartment.ts  ad14bd15   615aa120    6 differ
after hud.ts        ad14bd15   615aa120    6 differ
after props.ts      ad14bd15   615aa120    6 differ
final               ad14bd15   615aa120    5 differ
```

**textures and structure identical at every step** (222 unique textures, 395
objects). The differing places are the 4 pigeons and 2 citizens — the noise
floor, confirmed by fingerprinting the *unmodified* build twice and getting the
same 6.

- `npx tsc --noEmit` clean, `npm run build` clean.
- `node scripts/bugsweep.mjs` — 48 shots, no page errors; only the pre-existing
  THREE.Clock deprecation and the WebGL perf/context warnings.
- `node scripts/verify.mjs` — lobby/stairs/hall3/hermit/room301 all render.

### Walking across floors

Screenshots can't prove the floor picker, and it was the riskiest thing moved,
so I checked it **differentially**: a scripted route driving real `w` key input,
sampling `__ct.pos()` at 25 points, run against a `git worktree` of `HEAD` and
against this branch.

The climb reads `0 → 0.45 → 1.35` up flight A, `1.35 → 2.15 → 2.70` up flight B,
holds `5.40` along the third-floor hall, and descends again. **All 25 `gy`
samples are bit-identical between the two builds.** Two rows differ by 0.1 m in
walked *distance* — and baseline-vs-baseline differs on the same two rows by the
same amount, so that is frame-timing jitter, not the refactor.

The probe scripts were temporary and are not checked in (the brief reserves
`scripts/`). If this turns into a recurring check, `scripts/floortrace.mjs` is
worth adding — ask the desk first.
