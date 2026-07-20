# CITY 98

A first-person low-poly life RPG set in a late-90s American city.
You've got a one-room apartment at Maple Court, $140, a boxy orange
hatchback, and rent due every Monday. Do life: work shifts at Video
Palace or Datacorp, eat at the Sunrise Diner, blow quarters at the
Neon Dragon, nap on a park bench, and drive your beater around town.

## Run it

```sh
npm install
npm run dev        # http://localhost:5175
```

Click to lock the mouse. **WASD** move · **Shift** run · **E**
interact / enter & exit the car · in the car **W/S** throttle &
reverse, **A/D** steer, **Space** brake · **Esc** pauses.

One real second is one game minute. Energy and Food drain as you go —
low on either and you drag your feet. Sleeping at home ends the day;
rent ($120) auto-collects Monday mornings and rolls into debt you can
pay down at the landlord's.

## Architecture

- `src/core/` — the pure life-sim (clock, needs, meals, two jobs with
  business hours, rent/debt, saves), fully unit-tested.
- `src/world/` — the city as plain data: a 3×3 block grid, 16
  buildings, props, parked cars, interactables, AABB collision — with
  layout invariant tests.
- `src/render/` — the low-poly look: canvas signage, emissive window
  grids that light at dusk, striped awnings, a diner pylon sign, power
  lines that actually sag, boxy sedans/wagons/pickups, keyframed
  day/night with warm streetlight pools.
- `src/game/` — pointer-lock FP controller with head bob, arcade car
  physics, ambient traffic.
- `src/ui/` — Windows-95-flavored dialogs and HUD (it's 1998, after all).

```sh
npm test                 # sim + world suites
npm run build            # typecheck + bundle
node scripts/smoke.mjs   # headless end-to-end (needs `npm run preview` running)
```
