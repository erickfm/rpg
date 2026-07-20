# Stick RPG — 3D Remake

rpg on the web — a faithful 3D remake of XGen Studios' **Stick RPG**
(2003), built with TypeScript + Three.js. You fall asleep on a lazy
afternoon and wake up in the 2 Dimensional World: a floating island with
one crooked crossroads, twelve buildings, and a clock that only moves
when you do something with your life.

## Run it

```sh
npm install
npm run dev        # open the printed localhost URL
```

## The game

Pick a name (**HEYZEUS!!!!** does what it always did) and a lifespan —
15, 40, or 100 days, or Eternity. Then live: raise **STR / INT / CHA**
toward 999, keep your HP up, and mind your **karma** — it tints your
head, gates the evil jobs, and decides which throne you can take.

| Place | What happens there |
| --- | --- |
| Apartment | Sleep to end the day, answering machine, stock market. A certain yellow car is parked outside (INT 350…) |
| New Lines Inc. | The career ladder: Janitor $8/h → CEO $100/h, 6-hour shifts, promotions by INT |
| McSticks | No-questions-asked cook shifts, food that restores HP |
| U of S | Study (free), classes (+2 INT), campus gym |
| Sticky's Liquor | Beer (+2 CHA, −karma), drunken darts, bar fights **to the death** (turn-based: Punch/Kick/Fireball/Pure Energy) |
| Silver Lining Casino | Slots, blackjack (3:2), roulette |
| Bank | 1% nightly interest, $1000 loans, real estate (Bigger Apartment → **Castle**), a very temptable vault |
| Convenience Store | Snacks, smokes, caffeine pills — and a mid-day register worth robbing |
| Pawn Shop | Knife, alarm clock, cell phone, handgun, ammo |
| Bus Depot | Pre-dawn buses to six cities: the cocaine trade (buy at $400/g from Rudy, sell high, don't carry over 50g) |
| Fine Line Furnishings | Eight furnishings for your home, each with a daily use |

Outdoors: Homeless Harold (+karma for $10), the Skater Punk (smokes →
skateboard → tragedy), Rudy pacing between the store and pawn shop, and
traffic that will absolutely run you over.

Endgame: 800+ in every stat, the Castle, the CEO chair, and a fortune
let you run for **President** (positive karma) or seize power as
**Dictator** (negative). Death is permanent. The day limit ends in a
ranked ending.

Controls: WASD move · Shift run · E interact · I inventory · Esc close.
Autosaves on sleep and continuously; clear the `stick-rpg-3d-save`
localStorage key for a hard reset.

## Architecture

- `src/core/` — every game rule as pure functions over an immutable
  `GameState`; no Three.js, no DOM. 79 vitest tests cover payouts,
  promotions, trips, combat, endings.
- `src/world/` — plain-data city plan (tested invariants: nothing
  overlaps, nothing sits on a road, doors reachable) and interior floor
  plans with interaction stations.
- `src/render/` — the toy-diorama Three.js layer: island, bespoke
  facades, day/night, traffic, interiors, stick figures.
- `src/ui/` — HUD, menus, minigame panels, and full-screen flows.
- `src/main.ts` — the loop that wires it all together.

```sh
npm test                 # core + world suites
npm run build            # typecheck + production build
node scripts/smoke.mjs   # headless Chromium end-to-end (needs `vite preview --port 4173`)
```

The city layout and every number that could be sourced (wages, prices,
fares, payouts, requirements) come from the original game via the
[Stick RPG Wiki](https://stickrpg.fandom.com/); unsourced tuning values
are single constants in `src/core/`.
