# The east-end crossing is gone — the edge, not just the paint

**H, `ct/crowd-net.ts`.** The user does not want paint at the closed east end
(`shots/user-remove-crosswalk.png`). B is removing the stripes; this removes the
graph edge, which is the half that matters.

**Done first, deliberately.** Edge gone + paint still down is harmless — stripes
nobody walks on. Edge present + paint gone is the original fault with the
explanation scraped off, which is worse than either state. So I did not wait for
B; the world can sit safely in the order it is in now.

## What changed

One line: `link(s[s.length - 1], ne, true)` is deleted. No node moved, nothing
was added.

The ring does not need it. The south walk reaches the north walk by the
**side-street crossing at the corner** (`n-bodega` → `s-win1`), which is where
`ct/tex-ground.ts` actually flags KRAMP. `s-east` and `ne-corner` become
**dead-end stubs**, which is what a closed end is. Both still stand on pavement —
`s-east` at z −109 is south of the asphalt, `ne-corner` at z −97 is north of it.
It was only the line between them that lay in the road.

## Evidence, and the control that makes it evidence

`scripts/H-eastend-route.mjs` routes `s-east → ne-corner` and reads the road
flag on every hop:

```
  WITH the old edge:   2 hops,  12.0 m   road hop: s-east->ne-corner (12 m)   <-- in the carriageway
  AFTER the removal:   9 hops, 105.6 m   road hop: s-win1->n-bodega (12.3 m)  <-- the junction crossing
```

**The probe distinguishes**, which is the point — I restored the old edge from
the stash and re-ran it to get the first line rather than quoting it from
memory. Nothing is orphaned: the route exists, so both ends are still reachable.

## The behavioural number, and an honest limit on it

`scripts/H-in-road.mjs`, the same measure the original fault was found with:

```
  AFTER:  7458 walker samples / 240 s
          in the carriageway at all:        531   (all inside a marked crossing)
          outside a marked crossing:          0
```

**The limit:** my first attempt ran 45 s and returned **0 for the before-state
too** — the east end is remote and the original fault was 18 in ~20000 samples
(0.09%), so 1506 samples could not see it. A zero from that run would have been
worthless. At the historical rate, 7458 samples expects ~6.7 hits if the fault
were still there, so **this** zero carries weight; the short one did not.

**That is why the route probe is the primary evidence and the sample count is
the secondary.** The fault is an edge that either exists or does not, and
sampling for a rare traversal is the weaker way to ask.

## For B

Paint can come out whenever you like — the graph already routes nobody there.
Send me the junction crossing coordinates when they land and I will move the
graph's crossing arms onto them, which is the other half the desk routed.

— H
