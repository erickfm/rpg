# Builder G — blocked

One thing, and it is one room. Everything else in my queue is built, walked and
in mainline.

---

## THE PAWN SHOP is blocked on two other people, and it needs both

`ct/int-pawn.ts` is finished and passes 25/25 on its own walk. It is the only
one of my four rooms you cannot get into, and it needs two one-line changes
neither of which is mine.

### 1. F — `buildPawn(ctx)` is not wired

F wired three of my four when the kit contract changed:

```
crosstown.ts:307   buildThrift(ctx);
crosstown.ts:308   buildCasino(ctx);
crosstown.ts:309   buildHotel(ctx);
crosstown.ts:310   buildTax(ctx);
                   ← buildPawn(ctx) missing, and no `import { buildPawn }`
```

Probably deliberate, since I flagged the room as door-blocked in the same
handoff F would have read. But the room itself is complete and walkable, so it
can land whenever the door does — or before it, since the [E] spot works today
at the convention position.

```diff
+import { buildPawn } from './ct/int-pawn';
@@
   buildTax(ctx);
+  buildPawn(ctx);
```

I do not edit `crosstown.ts`; I wire it locally to run the tests and revert
before committing, every time.

### 2. D — `pawnFront` paints no door

Raised before I built the casino and still true as of this note. `street.ts`'s
`pawnFront` draws a board, a barred window and a stallriser, and no door rect
anywhere. Its three neighbours in the same file all paint one:

| painter | door at |
|---|---|
| `burgerFront` | `W * 0.44` |
| `taxFront` | `W * 0.5` |
| `shopfrontTex` (the block default) | `W * 0.48` |
| **`pawnFront`** | **none** |

So there is no world position for the entrance to be at, and until there is, a
player walks up to blank barred glazing and gets an `[E]` prompt out of nowhere.

**This does not block the room from landing.** `int-pawn.ts` puts its spot where
the house convention would put a door — `W * 0.48` of a 96-texel front, world
`z = -59.06`, within 6 cm of the building centre — and any door drawn to any of
the three conventions above lands inside the spot's 1.05 m trigger. When D
paints one, `DOOR_Z` in `ct/int-pawn.ts` is the single line to change and I will
change it.

`street.ts` is D's. I hold a bounded mandate there for the casino and hotel
exteriors only, which is not this.

---

## Not blocked, for the record

- **The kit's room lights** still cannot be recoloured or suppressed, and it has
  now bitten twice — the casino wanted warm and dim, the tax office wants cool
  fluorescent strips, and the kit's warm blobs read as a different fixture among
  mine. Both rooms shipped anyway because the palette does the work and each
  room owns its own lamps. `light?: {...} | false` on `RoomSpec` would settle
  it. F's file, F's call, and not urgent.
- **`props.ts` was not needed** for the casino/hotel night spill after all, so
  the coordination the desk offered with B is not required. `dimWorld` already
  skips `transparent` materials and `scene.background` already carries the night
  curve, so the two frontages drive themselves. Written up in `ct/vice.ts`.

## State as of this note

| | |
|---|---|
| casino interior | in mainline, wired, 26/26 |
| hotel interior | in mainline, wired, 26/26 |
| tax interior | in mainline, wired, 25/25 |
| pawn interior | in mainline, **not wired**, 25/25 when wired locally |
| casino + hotel exteriors | in mainline, 13/13 |
| F's rooms with all of mine present | 147/147 |
