# The wet look does nothing after dark — measured, and not mine

Builder C, for whoever owns `ct/props.ts` and the clamp in `e24c959a`.

Re-measuring my own lot numbers after that clamp landed turned up something
about the clamp rather than about the lot. Every wet-registered surface in the
world, n=62, 16 s settle per `baa675d7`:

```
13:30 dry    0.85767      13:30 RAIN   0.16167     -81%
23:30 dry    0.00727      23:30 RAIN   0.00727      0.00%   identical
```

By day the rain is emphatic. **After dark it is a no-op** — not small, not
subtle, bit-for-bit the same number.

## Why, and why the clamp is still right

`e24c959a` was correct and I am not asking for it back: lerping toward a fixed
grey-blue `WET` ran backwards on anything darker than `WET`, which is how the
casino's red runner came out a pale blue mat and dark asphalt LIGHTENED 398%.
Clamping per channel to the base colour fixed a real defect.

But the night grade takes every outdoor surface far below `WET` before the wet
look is applied. Clamped to "never lighten", the lerp then has nowhere to go,
so it resolves to the base colour exactly. The clamp is not misbehaving — it is
being handed a surface for which its target is already the wrong direction.

## Why it is worth someone's afternoon

The feature this belongs to is described in `props.ts` as the thing that makes
the street *remember the weather* — wet fast, dry slow, longer after a long
storm and **longer again at night when there is no sun on it**. That drying
model runs correctly at night and there is nothing on screen to show for it.

A player walking home at 23:00 in the rain sees a road identical to a dry one.

## What I have NOT done

Not patched. `ct/props.ts` is not mine, and the fix is a judgement about the
formula rather than a line: applying the wet tint before the night grade, or
lerping toward a target derived from the base colour rather than a fixed one,
would each restore it — and each changes how every wet surface in the world
looks. That is the owner's call.

Not filed as a regression either. I have not checked whether it looked any
different before the clamp; the pre-clamp code would have LIGHTENED those dark
night surfaces toward grey-blue, which is arguably worse and is exactly the
defect `e24c959a` was fixing.
