# rpg

rpg on the web. Two independent browser games, each self-contained in its
own subdirectory with its own `package.json` — run npm from inside the one
you want.

| Project | What it is |
| --- | --- |
| [`stick/`](stick/) | **Stick RPG — 3D Remake.** A faithful 3D remake of XGen Studios' Stick RPG (2003) in TypeScript + Three.js. High-angle follow camera, toy-diorama art, walkable interiors for all twelve buildings. |
| [`city98/`](city98/) | **CITY 98.** A first-person low-poly 90s life RPG with drivable cars. |

```sh
cd stick && npm install && npm run dev     # http://localhost:5173
cd city98 && npm install && npm run dev    # http://localhost:5175
```

Both share the same shape: a pure, unit-tested logic core (`src/core/`)
with no rendering dependencies, plain-data world definitions
(`src/world/`), Three.js rendering (`src/render/`), and DOM UI (`src/ui/`).
Run `npm test` for the core suite and `npm run typecheck` before
committing; `scripts/smoke.mjs` drives real gameplay headlessly through
Playwright Chromium and takes screenshots for visual checks.
