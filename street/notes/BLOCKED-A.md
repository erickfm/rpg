# BLOCKED — builder A

**Nothing is blocking builder A.** The last item — the deprecated `Frontage`
fields — landed in `e4d2141d`. Kept as a record of what it was and how it was
verified; delete it when the desk is satisfied.

---

## ~~Deleting the four `@deprecated` `Frontage` fields~~ — DONE

Landed in `e4d2141d` under a grant for `ct/interior.ts`. The rooms read world
coordinates now:

```
:553  spec.door.at ?? (FW ? localOf(alongU(FW, FW.doorWorld)) : 0)
:563  localOf(alongU(FW, FW.glazingLoWorld)) / …HiWorld
```

The four fields are off the public `Frontage` and onto an internal `Layout` —
the painter still needs local metres to lay out a canvas, and nothing outside
that file has any business with them.

**The fallbacks went with them**, which was the real prize: each read the
painter's own guess when no room had spoken, and that second authority is what
the descriptor existed to remove. Measured never taken — 0 of 227 room meshes
change with them gone.

`tsc` clean, textures `4afd7bb6` and structure `6caac454` identical, ten checks
green, `mirror-walk` still 5 of 5.

## A BLOCK THAT WAS NEVER REAL — the projecting blade, and two more with it

An earlier rewrite of this file (`e377eea8`) said the last fifth of the facade
brief was *"the critical path… standing between the user and the rest of what
they asked for"*, needing a bounded mandate for `ct/street.ts`. It named three
things: an **awning**, a **projecting blade sign**, a **recessed doorway** —
*"all three are meshes, and shopfront meshes are built in `placeBld` in
`ct/street.ts`, which is D's. I cannot do it from my file."*

**That is wrong, and I repeated it to the desk a day later before checking.**

`shopfrontRelief()` is in `ct/tex-world.ts` — my file — and it builds meshes. It
takes the scene, makes its own `THREE.Group`, and adds the cornice, the bed
mould, the jambs, the head, the cill, the plinth and the recessed room plane.
`ct/street.ts` only CALLS it. Anything hung on a shopfront can be built from
here without touching D's file at all.

**The blade is built** (`5d430ba0`) and needed no mandate. The awning and the
recessed doorway are the same shape of problem and are equally unblocked — the
doorway is arguably already done, since the jambs, head and 0.45 m room recess
in that function *are* the reveal, in geometry rather than paint.

I also gave a second false reason for the same block: that a blade would breach
the 0.30 m depth budget. It does not apply — that budget is about things you can
walk into, and the sprite tree in the same file already settles the case ("you
walk UNDER it"). A blade's underside is at 2.45 m.

**The lesson worth keeping:** both times I reasoned about where the code lives
instead of opening it. A block asserted from memory of a file layout is worth
about as much as a check nobody has watched fail — and this one sat here for a
day claiming to be the critical path.

## Resolved since this file was last rewritten

- **the mirror verification** — `mirror-walk` checks all five declared rooms and
  all five mirror. `A-mirror-harness.md`
- **the pawnshop had no way in** — it is enterable and verified mirrored; the
  "6.23 m off centre" I reported was the harness measuring its **back** wall
- **the casino's dropped door** — fixed by its owner in `1e49295b`; it was a
  canted bay all along, so `mirror-walk` now reports **zero** missing
  declarations
- **G's `Room.glazing` urgency** — stood down by `8f21b25c` after the
  measurement showed it was not one line

Not blocking me and still worth someone's minute: `ct/civic.ts` needs one
`declareSurface(tex, 'ground')` to retire the last unjudgeable face
(`A-last-three-faces.md`).
