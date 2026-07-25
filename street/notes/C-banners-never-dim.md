# The frontage banners never dim, and I cannot fix it on my side

Builder C, for whoever owns `ct/props.ts`.

## The measurement

A dry evening, stepped through, `mod=lot`, outdoor materials only, each
compared against ITS OWN daylight value:

```
  504 materials dim
   56 hold their full daylight brightness      <- the frontage banners
    2 declared lights (the pole sign halo and its ground pool)
```

The banners read `1.000 -> 1.000`, 0.0%, while the deck, the cars, the brick
and the bunting all fall 88-95%.

## Why

`props.ts`'s `isSelfLit` calls a sheet a light source when more than 8% of its
opaque texels are bright and saturated. The banner sheets:

```
  218x30   hot 13.3%   selfLit
  218x30   hot 72.4%   selfLit
  230x30   hot 80.7%   selfLit
  254x30   hot 13.5%   selfLit
  254x30   hot  0.0%   not selfLit   <- the washed-out ghost sheet, and it DIMS
```

The heuristic is behaving exactly as designed. A banner printed in `#e0a81c`
yellow and `#2f7a4a` green on cream IS a bright saturated sheet. It is simply
not a lit one — it is vinyl cable-tied to a chain-link fence.

## Why I am not fixing it here

**The palette is the user's, and approved.** *"THE VIBE IS APPROVED — pole
sign, bunting, banner copy, palette, all of it lands."* Darkening the banners
to slip under someone's threshold would be changing something the user signed
off in order to satisfy a heuristic, which is the wrong way round.

That is the difference from the bunting, which I did fix in my own file: there
the base red was under the line and my own sun-bleach highlight pushed it one
point over. Backing off my own highlight is a fix. Repainting an approved
palette is not.

## What would fix it

An opt-out a module can set — the same shape as `ctx.wet()`, where a caller
declares what a material IS rather than having it inferred. `isSelfLit` is a
good heuristic and heuristics need an override for the cases they cannot see
from a texture: printed signage and lit signage look identical in pixels and
differ only in whether anything is behind them.

Not proposing the implementation; `ct/props.ts` is not mine.

## The check that found it

`scripts/mods-dim.mjs` — a DELTA test, per material against its own daylight
value, which is the form that survives `MeshBasicMaterial.color` being a tint.
It is **deliberately not registered**: it is red on this finding, and reddening
the shared suite over something I cannot fix would be handing the block my
problem. It goes in the runner the day the banners dim.

It also refuses `selfLit` as an excuse, and that is the point. props sets that
flag from the texture, so a mis-classified prop wears it — a check that excuses
`selfLit` is blind to exactly the bug the heuristic causes. Mine excuses
`userData.cLight`, which I set by hand on the two materials in this module that
really are lights.
