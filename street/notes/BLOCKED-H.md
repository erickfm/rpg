# BLOCKED — builder H

Nothing buildable. `scripts/live.sh H` reads **1 live, 1 awaiting a check**, and
both are out of my hands. Declaring BLOCKED rather than WORKING because I am not
building anything and a stale WORKING is a lying declaration; rather than DONE
because live.sh is not empty.

## The live row is not mine to close — and may want splitting

*"i want the people inside the buildings to be as detailed and quake-view like
as the pedestrians on the street"*.

**My half is built and published.** The atlas had only a standing pose, which is
why all ten interiors hand-draw figures — a booth, a stool, a pew and a reading
desk had nothing to call. `seated?: boolean` now exists, verified on all eight
sectors (every painted column drops 6 rows, every one keeps its feet on row 59),
with the origin at the hip so a room places a sitter by **the seat it already
registered**. Call signature: `notes/H-seated-sprite.md`.

**It waits on F and G.** `grep -l citizenSprite src/proto/ct/int-*.ts` returns
**0 of 10**. Until a room calls it, the user's want is not met and I will not
mark the row landed — but as one row it reads as H being late for work in files
I do not own. **Desk: worth splitting into an H row (done) and an F/G row
(open).**

## The check row needs the auditor, not me

The cat looks up when you stand over her. Pose not pitch, near AND above,
hysteresis 1.6/0.9 in and 1.95/0.75 out, verified foreshortened from the
player's eye (`shots/cat-far.png` against `shots/cat-over.png`). Two lines in
`crosstown.ts:801` under the bounded mandate; `buildCatRig`'s signature never
changed and `ct/alley.ts` was never touched. I may not confirm my own work.

## Three others owe me nothing urgent, listed so they are not forgotten

- **D** — the second alley's shell is not in (`crosstown.ts` still has only
  `AZ0/AZ1`). Name the span and I add it to the keep-clear array;
  `notes/H-for-D-second-alley.md` has the three measurements ready.
- **USER** — the pickup's bed floor at 16.2 px/m. Square, so not stretched;
  simply half its neighbours' resolution. Redrawing the ribs is a look change,
  so it wants an eye. Last non-uniform surface on the fleet.
- **B** — a ramp and stripes for the east-end crossing. The graph edge is
  flagged `road` correctly; `ct/tex-ground.ts` flags KRAMP on the bodega corner
  only.

## One structural note, since it recurred three times today

`lit`, `wet`, and now the cat's per-frame need: three leaf modules wanting
something their caller never passed. `b.pose` solves it for anything in the
billboard list, but `lit` and `wet` are different lists. The shape underneath is
that a leaf is **built** with what it needs and never **updated** with what it
needs — `PARALLEL-WORKFLOW.md` §15's registration pattern covers construction
only. The desk has this and asked me to flag instances rather than work around
them.
