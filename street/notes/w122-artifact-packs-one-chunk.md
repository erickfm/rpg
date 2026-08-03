# w122 — item 293: the artifact was packed from one chunk of four

**Commit `a2a5e0caa`.** Files: `scripts/pack-artifact.mjs` (named by the item),
`scripts/check-artifact.mjs` and `scripts/checks.mjs` (**not** named — see
"outside the item" below).

## Root cause, one line

`readdirSync('dist/assets').filter(.js)[0]` — **readdir sorts**, so `[0]` was
`hud-*.js`, 19 kB of the 1,185 kB the page needs; the entry, `slots` and
`three.core` were left as separate files a single-file page cannot fetch.

Reproduced on this tree before touching anything, with the old packer:

```
packed dist/artifact.html — 20,156 bytes, build b85494d0f 14:49
artifact: __ct NEVER APPEARED — it does not open
  console: Access to script at 'file:///assets/three.core-erZvyR2f.js' … blocked by CORS policy
  console: Access to script at 'file:///assets/slots-BxTlCJFU.js' … blocked by CORS policy
  THE CANVAS IS BLACK.
```

On `file://` a missing chunk is a **CORS error, not a 404**, which is why this
never looked like a missing file.

**The desk's row was right in every clause** — a rarity worth recording. The
only thing it did not say is *why both guards passed*: they are ceilings ("the
module tag is gone", "a stamp is present somewhere"), and the stamp guard passed
for the worst possible reason — the stamp is painted by `ct/hud.ts`, so it lived
in the one chunk that did get inlined.

## The fix

1. **Build as one chunk.** `codeSplitting: false`, via vite's JS API with
   `configFile: 'vite.config.ts'` so the build-stamp plugin and the
   shared-checkout guard both still apply. `npm run build` and the Pages
   workflow are untouched and stay split, which is correct over HTTP.
2. **Entry from `index.html`'s own script tag**, never from a directory listing.
3. **Floors, not ceilings.** Every file the build emitted must be inlined; the
   page must name no `assets/` path afterwards; the entry's bytes must be
   present in the output. Watched fail — `--no-build` over an ordinary split
   build:

```
THIS BUILD IS SPLIT ACROSS SEVERAL FILES AND CANNOT BE ONE PAGE.
  entry, inlined:  assets/index-BErwCa1U.js  (957,738 bytes)
  page also names:  assets/three.core-erZvyR2f.js   ← would 404 / CORS-fail
  build also emitted: assets/hud-Dz_l8t7v.js  (19,463 bytes)   ← nothing would load it
  … rc=1
```

4. **`--out-dir DIR`**, so a check can pack a scratch copy without touching
   `dist/`.

## What I proved, and how

- `npm run artifact` → `dist/artifact.html`, **1,185,938 bytes**, and loading
  **that file** in chromium: `__ct initialised, 8010 meshes, mean luminance
  64.7`, zero page errors.
- Read world values straight out of the `file://` artifact, not just the check's
  own: `__ct.seats()` gives **4** seats labelled `sit at the blackjack table`,
  and holding W moved the player **4.52 m** —
  `scripts/probes/w122-blackjack-walk-control.mjs`.
- **The dynamic-import chunks survive inlining**, which was the one real risk:
  `probes/L-games-in-artifact.mjs` against the packed file sat the player on a
  slot stool, took a bet and spun (20 → 19 credits), and Escape closed the
  panel. `ct/slots.ts` and `ct/blackjack.ts` reach `ct/hud.ts` through
  `import()` on purpose (GOTCHAS §28), and that is what produced the `hud` and
  `slots` chunks in the first place.
- The suite row goes green **and** red: `checks.mjs --only check-artifact` ✓,
  and `--selftest` ✓ (it corrupts a copy of the packed file and the row fails).
  `dist/` was the ordinary split build for both runs — the row packs its own
  scratch copy, so it does not depend on what is in `dist/`.

## Found and NOT fixed — for the desk to queue

`probes/L-games-in-artifact.mjs` reports **6 FAILED** against the packed
artifact, and **none of them is the packer.** Control:
`w122-blackjack-walk-control.mjs` run against the split build over HTTP and
against the packed `file://` artifact gives **byte-identical** results — 4 seats,
4.52 m walked, same coordinates. Both are pre-existing:

1. **The blackjack stool cannot be walked to.** The probe's approach point
   carries the player **0.00 m** on a held W and leaves him 1.80 m short. It is
   the same in both builds, so it is the world (or the probe's approach point),
   not the pack. Same family as item 289's 7 cm.
2. **Standing up off a slot machine needs a further `[E]` after Escape** — the
   already-known `L-every-stool-seats-you` bug, registered red-on-purpose.

## Outside the item — reported per BUILDER-BRIEF §9

The item named only `scripts/pack-artifact.mjs`, but its DONE WHEN (3) —
"`check-artifact.mjs` runs somewhere that runs by default" — cannot be satisfied
from that file. I edited two more:

- **`scripts/check-artifact.mjs`**: added `--pack`, which packs a scratch copy
  into `dist/artifact-build/`. **Deliberately not `dist/`**: the suite's preview
  serves `dist/` and `vite build` empties its outDir, so packing into `dist/`
  mid-suite would blank the world every other check is reading.
- **`scripts/checks.mjs`**: one row appended at the very end of `CHECKS`
  (smallest possible conflict surface — item 216/240 workers are in other
  files). ~31 s including its build, against the 180 s default-tier ceiling.

Nobody else's queue row names either file; I checked the live QUEUE before
editing.

## Derived vs copied

Everything derived. No filename, size or hash is typed anywhere: the entry comes
from the page, the chunk list from the build's own output directory, the byte
counts from the strings just written.
