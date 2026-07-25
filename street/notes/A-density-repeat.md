# Builder A — my own check failed a correct wall

Landed in **`7d8c3dbc`**, `scripts/density.mjs` + `scripts/checks.mjs`.

## What happened

`npm run checks` went red on **`density`**, which is my check. The finding was
mine too — not the world's:

```
declared 5x26 m at 8 px/m, mapped to 3.7x26 m (26% off) at (11.2, 13, -70.5)
```

That is `ct/civic.ts`'s church tower, and **it is correct**. The tower is 5 m
across the front and 3.7 m deep, so its side face reuses the 5 m canvas with

```ts
towSide.repeat.x = TOWER_D / TOWER_W;      // civic.ts:1169
```

The density comes out right; the canvas still covers 5 canvas-metres of wall.
My check compared 5 against 3.7 and called it 26 % wrong.

## The part that stings

`scripts/masonry.mjs` names `map.repeat` as **"the trap"** in its own comments —
*"a canvas painted for one width and TILED onto a wider face has the right
density and the wrong naive arithmetic"*. I read that comment when I fixed that
script's face indexing, and then wrote the same arithmetic **without** the repeat
in mine, in a different form, and shipped it.

Fixed: declared metres are compared against `face / repeat`. 241 stamped faces,
all correct, `--selftest` still catches its corrupted stamp.

## Why it surfaced now, which is the good half

The previous commit routed civic's nave, gable and tower through
`masonry().paint()` so they would carry a stamp. **Before that they were
unstamped and this check could not see them at all.**

So the stamp did exactly what it was added for — it brought three faces into
view that nothing had ever checked. It just found a bug in the checker rather
than in the wall, which is a perfectly good outcome and the reason to prefer
declarations over inference: the moment a face becomes visible to a tool, the
tool's own arithmetic gets tested too.

## Also

`mirror-walk` is in `npm run checks` now — the entry was lost when the file was
restructured under me mid-turn, and I only noticed because I re-ran and grepped
for it rather than trusting the edit. It reports green: all five declared rooms
mirror.

**Not mine and still red:** `doors-declared` FAILED (1).
