# BLOCKED — builder B

## Feeding the pigeons cannot move out of `crosstown.ts`

**Queue item:** *"Move your `[E]` spots out of `crosstown.ts`. `ctx.spot()` and
`ctx.player` exist; C, F and H have all done it."*

**Status: I have no `[E]` spots left there to move.** The `SPOTS` array in
`crosstown.ts` now contains exactly two hand-written entries and both are the
bodega shop counter at x ≈ 242 — D's, already documented in `BLOCKED-D.md`.
Nothing of mine is in it.

The one interaction of mine that still lives in the entry point is **feeding the
birds**, and it is blocked twice over.

### 1. It is not a Spot, and cannot be made into one

A `Spot` is `{ x, z, r, ok, label, act }` — an interaction anchored to a
**place**. Feeding happens wherever the player is standing: the cereal is
scattered 1.3 m ahead of whatever direction they are facing. There is no `x`
or `z` to register. It is the global fallback branch of the E key — *"nearest
live spot wins; with nothing near, E feeds the birds"* — which is a different
kind of thing from a spot, and registering it as one at some arbitrary
coordinate would be worse than leaving it where it is.

### 2. It needs `purse` and `hud`, which `ctx` does not carry

```js
} else if ((purse.inv.CEREAL ?? 0) > 0 && px < 100) {
  purse.inv.CEREAL--;
  props.scatter(px + Math.sin(rig.yaw) * 1.3, pz - Math.cos(rig.yaw) * 1.3, apt.gy());
  hud.refreshWallet();
}
```

`ctx` exposes `scene`, `obstacle`, `boards`, `wetMats`, `spot`, `seat`,
`site`, `onFrame`, `player` — and neither the purse nor the HUD. **This is the
same blocker as D's**, whose note says the shop counter stays in the entry
point because it *"needs `purse` and `hud` — neither of which ctx carries"*.
Two builders are now stuck behind one missing pair of accessors.

### What would unblock it — a desk/ctx decision, not a builder's

Both cases want the same thing, and it is small:

- `ctx.purse` — read cash and inventory, and mutate them
- `ctx.hud.refreshWallet()` — or, better, have the purse notify the HUD itself
  so no module needs to know the HUD exists

That is one addition to `ct/ctx.ts` and it retires **both** blocked items.
`ct/ctx.ts` is not mine, so I have not touched it.

Worth adding: whoever does this should consider a **third registration
alongside `spot` and `seat`** — a global action with no position, for exactly
this case. `spot` and `seat` exist because the entry point should not enumerate
what modules own; the bird feed is the same problem in a shape neither of them
fits, and it is the last thing of mine in that file.

**Not stopping on this.** Taking the next item.

---

*Written 2026-07-24 after the queue's `## Now` section was found to be entirely
landed — night five (three pieces), the tree pits, the puddle ribbon, the
footprint rule and the trash set all went in this session.*
