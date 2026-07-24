# rpg

**CROSSTOWN ’97** — a first-person city street built like a 1997 console
game — texel-painted facades, 8-angle billboard sprites, hungry fog, kerbs
you step up onto. A small hand-authored world grown piece by piece. See
[`street/`](street/)'s README for the full design journey (style lab → ten
studio builds → research → the winning pitch).

```sh
cd street && npm install && npm run dev    # http://localhost:5177
```

The shape: a pure, unit-tested logic core (`src/core/`) with no rendering
dependencies, plain-data world definitions (`src/world/`), Three.js
rendering (`src/render/`), and DOM UI (`src/ui/`). Run `npm test` for the
core suite and `npm run typecheck` before committing; `scripts/smoke.mjs`
drives real gameplay headlessly through Playwright Chromium and takes
screenshots for visual checks.
