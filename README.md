# rpg

rpg on the web. Three independent browser games, each self-contained in its
own subdirectory with its own `package.json` — run npm from inside the one
you want.

| Project | What it is |
| --- | --- |
| [`stick/`](stick/) | **Stick RPG — 3D Remake.** A faithful 3D remake of XGen Studios' Stick RPG (2003) in TypeScript + Three.js. High-angle follow camera, toy-diorama art, walkable interiors for all twelve buildings. |
| [`city98/`](city98/) | **CITY 98.** A first-person low-poly 90s life RPG with drivable cars. |
| [`street/`](street/) | **CROSSTOWN ’97.** A first-person city street built like a 1997 console game — texel-painted facades, 8-angle billboard sprites, hungry fog, kerbs you step up onto. A small hand-authored world grown piece by piece. See its README for the full design journey (style lab → ten studio builds → research → the winning pitch). |

```sh
cd stick && npm install && npm run dev     # http://localhost:5173
cd city98 && npm install && npm run dev    # http://localhost:5175
cd street && npm install && npm run dev    # http://localhost:5177
```

Both share the same shape: a pure, unit-tested logic core (`src/core/`)
with no rendering dependencies, plain-data world definitions
(`src/world/`), Three.js rendering (`src/render/`), and DOM UI (`src/ui/`).
Run `npm test` for the core suite and `npm run typecheck` before
committing; `scripts/smoke.mjs` drives real gameplay headlessly through
Playwright Chromium and takes screenshots for visual checks.
