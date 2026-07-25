## audit/seams — interior audit: the kit guards structure and leaves finish free

Queue `## Now` → "Walk every interior and audit it as a set" is **done** for the
set that exists. Report: `notes/interior-audit.md`.

Touched:   notes/interior-audit.md (new), notes/audit-seams.md
           scripts/interiors.mjs (region measurement + entry/exit walk tests)
           scripts/interiors2.mjs, scripts/interiors3.mjs (prompt + doorway probes)
           **nothing under street/src/** — verify with
           `git diff --stat $(git merge-base add-stick-and-city98 HEAD)..HEAD -- street/src/`
Verified:  measured, then walked. `scripts/interiors.mjs` reports ceiling, clear
           size, wall thickness, floor/wall px/m, palette luminance, lamp count
           and group discipline per region; the walk tests drive the rig with
           real key input through each entry and exit.
Base:      ea641af

### The headline

**One of the ten rooms exists.** Only `ct/int-diner.ts` is in the tree. So the
set is three — diner (kit), apartment and bodega (both pre-kit) — and the useful
work moved: with nine rooms still unwritten, the defects worth finding are the
ones **the kit does not prevent**, because each lands nine more times.

**The kit guards structure and leaves finish free, and finish is what makes ten
rooms read as one world.** Addressing, wall thickness, jambs, door height, the
collider that cannot swallow the trigger, the exit-gap check — all locked down,
and all correct when tested. Floor density, palette, ceiling treatment — all
free parameters.

Two high findings, both in `ct/interior.ts`, both replicating ten times:

1. **Floor and walls disagree inside every room.** Floor derives from 32 px per
   1.6 m, walls from 32 px per `TILE_M` 2.7 m — two unrelated constants. Diner
   measures floor **18.6 × 18.3**, walls **11.9 × 12.0**: a 1.55 : 1 mismatch in
   the two surfaces that fill the frame. Seam pattern #1, one layer down.
2. **The floor density is not constant.** `round(W/1.6)` rounds the intent away:
   W = 8.6 → 18.6 px/m, W = 8.0 → 20.0, W = 2.4 → **26.7**, W = 2.0 → **16.0**.
   Ten rooms of ten sizes get densities spanning 1.67 : 1.

Fix has the same shape as A's: **one `INTERIOR_PPM`, both surfaces derived from
it, and the floor's repeat computed so the tile count lands on the density
rather than the other way round.**

Also: the ceiling is untextured flat colour (seam finding 24, now institutional);
nothing bounds palette luminance between rooms; a room shorter than 2.15 m
silently loses its door while keeping the collider gap and both `[E]` spots; and
the bodega still has literal paper walls — zero-thickness planes — which is the
exact complaint the kit was written to answer.

### Two false positives I caught before filing

My first walk test reported no prompt at the diner door, and my first exit probe
reported the player unable to move. Both were **my** errors — a bad DOM
visibility check, and a way-out spot I guessed instead of computing from
`dAt`/`hd`. Recomputed and re-run, the kit's door machinery is correct: entry
reachable from all three approaches at 0.21 m against a 1.05 m trigger, prompt
fires, arrival lands with the way-out prompt already up, walking at the doorway
stops in the reveal at z = 3.30, exit landing legal and free 4/4. Recorded in
the report so nobody re-walks them.

### One thing worth adopting as a rule

Diner clear 8.6 + 2 × 0.18 = **8.96 m** against DINER's 9.2 m roster width. A
room should fill its shopfront to within a wall thickness — that is the check to
hold the other nine to, and it is cheap to run.

Left:      Nine rooms unwritten; the set comparison must be re-run when they
           land — the instrument is written and takes one command. Window-vs-
           frontage alignment is a design correspondence I could not verify
           geometrically, only state the rule for. Light measured, not judged
           side by side. Daylight only.
