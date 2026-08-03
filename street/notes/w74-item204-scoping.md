# Item 204 — SCOPING ONLY, released un-actioned

Worker seventyfour. Claimed after item 205 and released for room, per
BUILDER-BRIEF. **The crate is located, by position, so the next holder does not
have to repeat this.** `scripts/probes/w74-thrift-pavement.mjs` dumps every mesh
within 6 m of the thrift door at y ≤ 1.6 m. Run it against your own port.

> *"get rid of the trash crate in front of the thrift store. or move it
> somewhere else."*

## Where it is

**The THRIFT door spot is at (-6.25, -59.32), r 1.05** — read off
`__ct.spots()`, label `into the THRIFT STORE`. Not retyped from any file, so it
cannot go stale the way `bedcavity.mjs` did (BUILDER-BRIEF §8).

**The crate is a six-mesh cluster centred on (-6.12, -58.2)** — an open-topped
box: four upright side panels, a base, and a ground quad under it.

```
   d      world (x, y, z)          geometry        size
 1.01 m  (-6.25, 0.27, -58.30)  BoxGeometry    [0.36, 0.25, 0.03]
 1.01 m  (-6.02, 0.27, -58.33)  BoxGeometry    [0.03, 0.25, 0.36]
 1.24 m  (-6.23, 0.27, -58.07)  BoxGeometry    [0.03, 0.25, 0.36]
 1.25 m  (-5.99, 0.27, -58.10)  BoxGeometry    [0.36, 0.25, 0.03]
 1.12 m  (-6.12, 0.15, -58.20)  BoxGeometry    [0.36, 0.02, 0.36]   <- the base
 1.12 m  (-6.12, 0.14, -58.20)  PlaneGeometry  [0.42, 0.42]         <- ground quad
```

**0.36 m square, 0.25 m tall, 1.01–1.25 m from the door spot's centre** — it is
standing in the doorway's own approach, which is consistent with his complaint
and with the row's lead that *"shopfronts moved and pavement clutter may not
have moved with them"* (`ct/props.ts:1246`).

All six carry `userData.mod` and **nothing else** — no `sizeW`/`poolSpan`,
unlike the kerb bands and the awning meshes measured beside them in the same
dump. That distinguishes it from its neighbours if you need to find it in
source. `ct/props.ts:447` (`milk crate opaque parts noon 1.000 -> night 0.045`)
and `:1246` are where to look for who builds it. **I did not open either — that
is a lead, not a finding.**

## What is NOT done

Everything the row's DONE WHEN asks for:

- whether it carries a **collider** (`ctx.obstacle`) — matters, because item 198
  is about to feed static boxes into crowd avoidance
- whether **`ct/cat.ts`** places a cat on or beside it
- whether any **`[E]` spot** references it — nothing in `__ct.spots()` within
  6 m does, but I did not check `obj:` references
- the **remove vs relocate** choice, and saying which and why
- **walking the frontage** afterwards to confirm the 2 m lane

**My frontage screenshot faces the wrong way.** `shots/w74-thrift-frontage.png`
was taken at yaw π, which is +z under the rig convention (0 = −z) — it looks
*away* from the crate, down the street. Aim at (-6.12, -58.20) from further
along the pavement instead. I am naming this rather than leaving the image to be
misread as "the pavement is clear": **it is not evidence of anything.**
