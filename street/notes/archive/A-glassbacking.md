# Builder A — the pavement stops at the door now

Landed in **`6cc58f6a`**. `ct/tex-world.ts` + 12 lines of `ct/street.ts`, inside
the shopfront mandate.

## What was actually wrong

The user was right and the desk dropped it. Measured rather than guessed:

D's `57fa55ca` — *"Bodega: the doorway is a hole, not a painted panel"* — gave
the bay front `alphaTest: 0.5` and punched the opening out of the texture.
**That is the right call**: it makes the door read as a way in rather than a
painted rectangle. But:

- **861 of that panel's 3015 texels are discarded** — 29 % of it is a real hole
- the bay is a `PlaneGeometry` with **nothing behind it**
- the sidewalk is one surface running from the kerb straight on **under** the
  buildings

So through the hole you get pavement, and the bodega has a pavement for a
floor. D did half the fix. This is the other half, and it was left as "find out
whose it is" rather than closed.

## The fix, and what it is not

**Not a transparency change.** The glass keeps its depth and the doorway keeps
being a hole. What was missing was something to *see*.

`shopInteriorTex(name, wMeters, hMeters)` paints a room: a lit ceiling falling
off downward, a back wall, shelving with uneven stock, a counter edge catching
the ceiling light, floor in shadow. **Dark but never black** — a black rectangle
is the "glass is a black hole" complaint the depth work existed to fix. Varied
off the shop name so fifteen backings are not one backing fifteen times.

Applied to **every** shopfront through `shopfrontRelief`: one opaque plane
recessed 0.45 m, covering the whole band **including the door light**. On a
solid-box front it is hidden and costs one plane — and that is deliberate. The
moment anyone cuts a real opening in that face, which is exactly what happened
to the bay, there is already a room behind it instead of a view of the pavement.

This is a painted suggestion, not F's real interiors. A shop window has never
needed more.

## Verification

Guessing from grey-on-grey screenshots was not going to settle it, so: **every
ground surface tinted hot magenta** (610 materials), then walk the block and the
side street. Anything magenta inside a shopfront is pavement showing through.

**Result: no ground shows inside any shopfront** — bay, diner, thrift, the side
street, the east side. The magenta stops at the kerb and the building line.

The visible before/after is the **transom over the bodega door**: it showed
through, and now shows shelving.

One honest note: at the cameras I could reach I could not reproduce the exact
"diagonal slab scoring carrying on inside the shop" from the user's frame —
what I found and fixed is the hole that produces it, with the transom as the
proof it was open. If the user still sees pavement anywhere after this lands,
the tinting harness is the way to find it in one shot; say the word and I will
put it in `scripts/`.

## The thing worth remembering

An `alphaTest` cut-out and a surface with nothing behind it are each fine on
their own. It is the pair that fails, and the pair was created by two builders
in two commits, neither of them wrong. That is why it survived being flagged
twice: no single change looks like a bug.
