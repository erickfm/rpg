# The jail landing was never boxed in — the harness was aiming into the building

Filed against O by the auditor's run on `75e2d610e`:

```
FAIL  jail: the landing is not boxed in — out to the road ...... moved 0.39 m
 ok   jail: the landing is not boxed in — up the walk .......... moved 6.65 m
 ok   jail: the landing is not boxed in — down the walk ........ moved 6.69 m
```

Read as "a player who walks out of the jail door gets 0.39 m before something
stops them — pinned against their own building." Measured instead of guessed,
per the brief and GOTCHAS §20/27: **it was not.**

## Which collider was "stopping" the player — none. It was direction.

`ct/jail.ts` (mine) sets the building back into a forecourt (`d8987737e`,
already CONFIRMED). The building's own footprint collider is
`ctx.obstacle({minX: 60.88, maxX: 65, minZ: -110, maxZ: -96})` — exactly the
building, nothing more.

`ct/street.ts` says the jail's door is **west-facing**, and `JAIL_DOOR` in
`ct/jail.ts` agrees: `nx: -1`. The road is at **decreasing x** from the door.

`scripts/interiors-walk.mjs`'s "out to the road" check picks a walk direction
from `room.east`: `room.east ? -Math.PI/2 : Math.PI/2`. For nine of the ten
rooms in its list, `room.east` is computed automatically from a `front:`
tuple the room declares (`if (side > 0) r.east = true;`, line 251). **The
jail has no `front:` tuple** — its door is read from `ct/doors.ts` via
`chamfer: true`, the same path the bodega's 45° corner door uses — so
`room.east` was silently `undefined`, and the check defaulted to `+x`:
**into the building**, not out to the road.

Measured directly (`scripts/O-jail-landing-probe.mjs`), warping to the
landing point (60.12, -100.8) the harness itself computes:

```
yaw +x (what the unpatched harness walked)   moved 0.35–0.37 m, stopped on
                                              the building's own collider
                                              (minX 60.88)
yaw -x (the door's actual outward normal)    moved 6.19–6.58 m, clean, out
                                              past the site edge onto the
                                              road (landing gy 0.14 -> road
                                              gy 0)
```

Same numbers, same shape, on both the dev server (4186) and the built
preview (`vite preview`, 4199) — GOTCHAS §28/§37 checked, not assumed.

**Nothing in `ct/jail.ts` or `ct/int-jail.ts` changed.** The forecourt has
been open the whole time; `d8987737e`'s fix was correct. The collider that
was "stopping" the player was the building itself, encountered only because
the check walked the player at it.

## The fix

One field added to the jail's entry in `scripts/interiors-walk.mjs`'s
`ROOMS` array: `east: true`, with a comment explaining why it can't be
derived automatically for this room (no `front:` tuple) and citing the
measurement above. This is the same shared-harness file nine other rooms'
entries already live in, and the jail's own entry has been hand-edited
before for the same class of reason (`367a777c1`, its label regex).

As a side effect — same root cause, not a second fix — this also turned a
**pre-existing, previously-unreported FAIL** green: "you can reach the door
straight at the door from the kerb" used the same `room.east`-derived
heading and was walking the kerb-approach test into the building too
(observed stopping at x=65.39, the building's back face, before this
change).

## Verification

```
SHOT_URL=http://localhost:4186/ node scripts/interiors-walk.mjs jail
```

```
 ok   jail: the landing is not boxed in — out to the road      moved 6.66 m
 ok   jail: the landing is not boxed in — up the walk          moved 6.65 m
 ok   jail: the landing is not boxed in — down the walk        moved 6.67 m
 ok   jail: you can reach the door straight at the door from the kerb   (was FAIL, now incidentally fixed)
24/25 passed   (only remaining FAIL is the night-light item below, unrelated)
```

Repeated against the built bundle (`npm run build && npx vite preview
--port 4199`) using `O-jail-landing-probe.mjs` and `O-jail-walk-fix.mjs`
directly — `interiors-walk.mjs` itself cannot run against `vite preview` at
all, for any room: it dynamically imports raw TS source
(`import('/src/proto/ct/doors.ts')`) to read door declarations, which does
not exist in a built bundle. Reproduced on the unmodified tree (`git
stash`), so this is a pre-existing limitation of the harness, not something
this change caused or is in scope to fix. The walk itself was re-measured
directly against the built preview and matches dev exactly (see numbers
above).

`node scripts/bugsweep.mjs` against both 4186 and 4199: **zero `STATION
MISS`**, exit clean.

The yard behind the building and the forecourt's north/south walkability
(the things this brief said not to re-break) were re-checked with the
pre-existing `scripts/O-jail-walk-fix.mjs`, both servers: forecourt
30–34 m of north/south travel, yard 8.7–8.8 m fence-to-wall, both clean.

`npx tsc --noEmit` and `npm run build`: clean.

## Walk evidence — the distance actually travelled, door to road

From the landing (60.12, -100.8), walking west (the true "out to the
road" direction): **6.19–6.58 m** of clean travel before the harness's
warp-and-hold loop stopped sampling (not because anything blocked it — it
ran off the site's south edge onto the road surface itself, `gy` dropping
from the raised walk's 0.14 to the road's 0). Confirmed separately with
`O-jail-walk-fix.mjs`'s own dedicated forecourt-width walk: 30–34 m
north/south with the building's own face never touched.

## The second, smaller item — reported, not fixed

```
FAIL  jail: the room keeps its own light after dark
        6/501 interior materials dimmed by the night sweep
```

Investigated with `scripts/O-jail-night-probe.mjs`, which reproduces the
harness's own sampling and prints exactly which materials moved. All six
are the **same shared material** (`slotM`, `int-jail.ts`) — the "daylight
slot" at the back of every cell, i.e. the barred window each cell has onto
the outside. It is not reached by the world's night sweep at all:
`props.ts`'s `dimWorld` returns early for anything with `|world x| > 100`,
and this room sits at world x ≈ 993–1006. The colour change is the room's
**own**, deliberate `ctx.onFrame` handler, three lines above where the
material is declared:

```ts
// the daylight slot at the back of every cell. It DIMS WITH THE WORLD —
// a bright window at two in the morning is the tell that a room is a set.
const slotM = new THREE.MeshBasicMaterial({ color: 0xdfe6ea });
slotM.userData.selfLit = true;
ctx.onFrame(({ night }) => {
  slotM.color.setRGB(0.87 - 0.72 * night, 0.90 - 0.74 * night, 0.92 - 0.74 * night);
});
```

**This is not a defect — it is the room correctly simulating a window.**
"The jail interior should hold its own light after dark" is the right rule
for electric room lighting (and the room's actual lighting does hold — the
rest of the room's ~495 other sampled materials are unchanged). It is the
wrong rule for a barred slit onto the outside, which is supposed to go dark
when the sun does; a window that stays bright at 2 a.m. is exactly the
"looks like a set" tell the comment is written to avoid. `interiors-walk.mjs`'s
check (§6, "the room keeps its light after dark") doesn't distinguish a
room's electric lighting from a window showing exterior daylight — it flags
any colour change in anything non-transparent near the room centre. Same
shape as GOTCHAS §22/23: a real, measured difference that is not a bug.

I did not touch the behaviour: removing it would delete the intentional
detail and reintroduce the actual defect the room is written to avoid.

The `userData.selfLit = true` on `slotM` is mislabelled — nothing in this
codebase reads `selfLit` on an interior material (dimWorld never reaches
x > 100, and `interior.ts`/`paint.ts` don't read it either; it appears to
be a copied convention from the exterior lamp fixtures in the same two
files), so it is inert either way. Left it alone rather than make a second,
unrequested edit to explain a flag that currently does nothing.

If the desk wants this test to actually pass, the fix belongs in the shared
`interiors-walk.mjs` check itself (exempt materials tagged e.g.
`userData.daylight` or similar from the "keeps its light" sample, the same
way `isGlass` already exempts glass from `dimWorld`) — not in `int-jail.ts`.
Flagging rather than doing it, since it is a shared-harness change with
scope beyond the jail.

## Files touched

- `street/scripts/interiors-walk.mjs` — one field (`east: true`) added to
  the jail's `ROOMS` entry, with a comment. No other room's entry changed.
- `street/scripts/O-jail-landing-probe.mjs` — new, investigation script
  (measures the landing's clearance in both x directions and lists nearby
  colliders).
- `street/scripts/O-jail-night-probe.mjs` — new, investigation script
  (reproduces the night-light sample and names which materials moved).
- **`ct/jail.ts` and `ct/int-jail.ts` — unchanged.** The forecourt/yard fix
  from hours earlier (`d8987737e`) was correct and remains untouched.
