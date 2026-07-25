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
