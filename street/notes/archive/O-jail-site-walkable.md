# The jail site is walkable — the STATION MISS bug, fixed at its source

Written by the builder who fixed `notes/SWEEP-COVERAGE.md`'s finding: *"roughly
two thirds of [the jail] site cannot be stood on."* Owning file: `ct/jail.ts`
(O's, per `OWNERSHIP.md`). A related one-line fix landed in `ct/int-jail.ts`
(also O's). No other builder's file was touched.

## What the collider was actually for

It was exactly the building's own footprint — not oversized, not overlapping
anything by mistake. `ctx.obstacle({minX:56.88, maxX:69, minZ:-110, maxZ:-96})`
matched `FX-PROUD` to `BX` precisely, where `BX = FX + JAIL.DEPTH` (12.0) and
`FX = site.minX`. The building was flush against the site's own front edge and
ran the entire 12 m the old `JAIL.DEPTH` used, across the full 14 m width of
the site (which itself equals the side street's cross-section, because the
building closes the street's dead end and has to span it edge to edge to do
that).

The bug was not a miscalculated rectangle. It was that the site published by
`ct/street.ts` (D's) offered **18 m of depth** ("deeper than the widest shell
on the block… O may take less") and the building used 12 of it, flush at the
front — so of the published site `{57–75}`, two thirds (`57–69`) was
legitimately solid building and the other third (`69–75`) was empty,
**unreachable** land: nothing pinched it down to zero width to get there, but
nothing led there either, because the building sealed the entire street cross
section in front of it. `scripts/bugsweep.mjs`'s site stations are computed as
fixed fractions (18%, 50%, 82%) along a site's own bounding box — correct for
the park and the lot, which really are open ground start to finish — and two
of those three fractions (18%, 50%) landed inside the solid two-thirds.

`fp.ts`'s `unstick()` (desk-owned, read not edited) couldn't always escape a
point that deep inside a single collider within its 0.45 s patience window,
and reverted the whole move to `lastGood` — which, mid-sweep, was wherever the
*previous* shot had left the camera. That's the mechanism behind "landed at
the used car lot, 113 m away": not a special case, just `unstick()`'s
documented last resort, hit because the aim point was inside a building.

## The fix

**Set the building back from the site's own edge, into a real forecourt, and
shorten it so it no longer eats the site's whole offered depth.** The
interior room (`ct/int-jail.ts`) is a wholly separate coordinate space (kit
slab, x ≥ 400) sized on its own terms — a shallower exterior shell costs the
room nothing.

```
JAIL.SITE_X = 57.0      // the site's own front edge (unchanged, validated
                         // against ctx.site('jail').minX)
JAIL.FORE   = 4.0        // NEW — the forecourt depth
JAIL_FACE_X = SITE_X + FORE = 61.0   // the building's own face (was 57.0)
JAIL.DEPTH  = 4.0        // NEW value (was 12.0) — the building's own depth
                         // building now spans x 61…65 (was 57…69)
```

Three ground surfaces now exist where two-thirds of the site used to be one
undifferentiated solid mass:

| x range | what it is | collider |
|---|---|---|
| 57 – 61 | the forecourt — granite plaza paving (`plazaTex`, same painter the library steps use) | none |
| 61 – 65 | the building itself — unchanged facade, sally port, piers, lamps, signage, all still derived from `FX`/`DEP`/`W` so nothing else in the file needed touching | `ctx.obstacle({FX-PROUD, BX, Z_S, Z_N})`, same shape as before, a third the size |
| 65 – 75 | the yard — worn concrete (`walkTex`, the same sheet the sidewalk wears), capped by a low chain-link fence at x ≈ 74.65 | a thin `ctx.obstacle` for the fence only |

The fence started decorative-only (no collider) on the reasoning that "the
site already ends in the void beyond it, a real collider buys nothing" — and
`scripts/O-jail-walk-fix.mjs` caught that reasoning being wrong the first time
it actually walked into the yard on foot: a player walks straight through a
visible fence, which reads as broken geometry. It collides now, thinly (0.1 m
either side), well clear of every one of the sweep's sample points.

`ct/int-jail.ts`'s one line: the interior's "step outside" landing point
(`outX`) used to be the literal `56.0`, derived by hand against the *old*
facade at `56.88`. Left as a literal it would have silently landed a player
5 m from a door that had moved — the exact "typed twice" fault
`JAIL_DOOR`/`DOOR` already exist to avoid (GOTCHAS §20). Now
`outX: JAIL_DOOR.x - 0.88`, same 0.88 m clearance, derived from wherever the
door actually is.

## Why the depth I picked (empirically, not just calculated)

The theoretical "nearest edge" escape distance for `unstick()` didn't match
what the world actually did — a point needing a calculated 3.36 m push away
from the old collider was observed landing 5.8 m away in the full world (523
colliders), and a point needing a calculated 3.32 m push reverted completely
instead. I stopped trusting the arithmetic and measured instead, replacing the
world's jail collider with each candidate box in turn, warping to the sweep's
exact three sample points (with the world's other 522 colliders still in
play, and a "warp somewhere far away first" step so a revert-to-`lastGood`
would be visible rather than mistaken for a clean escape) and reading
`__ct.pos()` after:

```
current (56.88-69):        near d=116.44 MISS · cross d=1.34 · far d=0.00
setback 61-65 (depth 4):   near d=0.00   ok   · cross d=0.00 · far d=0.00
```

`61-65` was the first configuration where none of the three points required
any push at all — they land on open ground outright. That is the shape shipped.

## Walked, not just warped

Per `CLAUDE.md`: *"anything involving movement, collision or floors must be
verified by actually walking it."* `scripts/O-jail-walk-fix.mjs` does, holding
keys rather than teleporting, and checks `__ct.pos()` against where the walk
was aimed:

```
-- 1. walking east into the forecourt --
   stopped at (60.48, -103)
   OK  walked past the old facade line (x 56.88) into the new forecourt,
       stopped near the building's own face (~61)
   jail spots in reach: [{"label":"into the HOUSE OF DETENTION","d":0.23,
       "ok":true,"r":1.05,"near":true}]
   OK  the door prompt is live from where the walk stopped

-- 2. walking the forecourt north/south --
   walked to (59, -80.49)
   walked to (59, -110.6)
   OK  forecourt is walkable across its width — 30.11 m of north/south travel

-- 3. walking the yard behind the jail --
   walked east to (74.18, -103) -- expect to stop near the fence (~74.6)
   walked west to (65.49, -103) -- expect to stop near the building's back
       wall (~65)
   OK  the yard is walkable end to end on foot — 8.69 m, fence to building wall
```

Run against both the dev server (port 4181) and the built preview (`npx vite
preview`, port 4199) — identical results both ways (GOTCHAS §28/§37: dev and
the bundle can resolve circular imports differently; checked, not assumed).

Also re-ran the pre-existing `O-jail-walk.mjs` (my own script, from before
this fix). Its `lane` mode scanned x only up to 60 — right for the old
building at 57, too short for the new one at 61 — so I extended the scan to
70 and updated the comment; all 4 of its checks pass, and the raw walk across
the closed end is now **5.89 m**, not the old 1.88 m. Its `door` mode's first
five checks pass; the sixth (E from inside the room back out to the street)
times out. **Confirmed pre-existing**: reproduced identically on the
unmodified `git stash`-ed code, so it predates this fix and is out of this
brief's scope — filed here rather than silently worked around. It looks like
the interior's own exit trigger, not anything this fix touches; someone
should look at `ct/interior.ts`'s door-out spot logic (desk/F's — shared kit).

## The sweep itself

```
SHOT_URL=http://localhost:4181/ node scripts/bugsweep.mjs
```

**Zero `STATION MISS` lines**, exit 0, both against the dev server and the
built preview (`npx vite preview --port 4199`). `shots/bug-jail-overview.png`
and `shots/bug-jail-cross.png` now show the jail's own door and its own yard,
not the used car lot 113 m away.

## Proof nothing else moved

`npm run fp` (scenedump) captured before (original code, via `git stash`) and
after, both against the same dev server (GOTCHAS §31: never compare dev to
dist). `fpdiff` reported large texture/structure diff counts — expected and
explained by the SAME mechanism GOTCHAS §31 already documents: the new
forecourt/yard textures (`plazaTex`/`walkTex`) draw many more
`Math.random()` calls for their grain, which shifts the shared seeded stream
for every texture painted afterwards in the build. Not a structural
regression — a repaint, the same conclusion §31 reached for the dev/dist gap.

Checked directly rather than taking that on faith: of the dump's 8377/8384
placed objects, **8005 are further than 40 m from the jail site in both
dumps, and every single one of those 8005 has an exact position match (≤5 cm)
between before and after.** Zero unmatched. The only objects that moved,
appeared or disappeared are within the jail site itself — exactly the 7 new
meshes (forecourt plane, yard plane, fence panel, 4 fence posts) plus the
building's own reshaped footprint. `objects=8377→8384` is `+7`, matching
exactly.

## Verification commands, for the next person

```bash
cd street && npx vite --port 4181 &
SHOT_URL=http://localhost:4181/ node scripts/bugsweep.mjs        # 0 STATION MISS
SHOT_URL=http://localhost:4181/ node scripts/O-jail-walk-fix.mjs # on-foot walk, new
SHOT_URL=http://localhost:4181/ node scripts/O-jail-walk.mjs all # pre-existing suite
SHOT_URL=http://localhost:4181/ node scripts/O-jail-door-agree.mjs
node scripts/health.mjs / npx tsc --noEmit / npm run build       # all clean
```

## What's still open, filed rather than fixed

- **`ct/interior.ts`'s door-out trigger for the jail room times out** (see
  above). Pre-existing, reproduced on unmodified code, not caused by this fix.
  Not mine to fix blind — `interior.ts` is shared, F's kit.
