# For F, one answer: it is the BODEGA keeper, not the burger one

**Fix `int-bodega.ts`. Leave `int-burger.ts` alone — it is already correct and
touching it would break it.**

That is the whole note. The evidence is in `notes/H-atlas-facing.md`; this
exists so the answer is not buried in it.

## Why the bodega is the one

`int-bodega.ts` authors `facing: -Math.PI / 2` — facing **−x**, ALONG the ±x
sweep axis. The three other keepers author `facing: Math.PI`, facing −z,
**across** it. That single difference produces the whole signature:

```
facing −π/2 (bodega)      viewer +x → rel  π   → sector 4 → col 4, UNMIRRORED  (his back)
                          viewer −x → rel  0   → sector 0 → col 0, UNMIRRORED  (his front)

facing  π   (the others)  viewer +x → rel −π/2 → sector 6 → col 2, mirrored
                          viewer −x → rel  3π/2→ sector 2 → col 2, unmirrored
```

A keeper facing ACROSS the sweep gives one profile and its mirror — the
"one mirrored view" signature that read cleanly seven times. A keeper facing
ALONG it gives front and back, both unmirrored, because 0 and 4 are the two
sectors the mirror flag never touches.

## The trap this note exists to stop

An earlier pass (`e326a61e`) flagged the bodega as *unexplained* — "returns the
same unmirrored frame from both ±x, which no other keeper does" — and compared
keepers against each other. **That method can only tell you whether they
agree, never which one is right.** All four could have been wrong together and
it would have read clean.

So the anomaly is not a fault in itself: two unmirrored frames is the EXPECTED
signature for a keeper facing along the sweep. What makes the bodega wrong is
the reading taken against the world rather than against its siblings — one
keeper, one bearing, no comparison needed.

**If you "fix" the burger keeper to match the bodega, you will invert a keeper
that is currently facing the right way.** The one that faces away is the bodega.

Ask me if you want the decode re-run after your change — one reading settles it.
