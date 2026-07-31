# Three routes I owe, filed now that my queue is empty

## → F: re-run the interiors suite against the re-entry fix

`notes/F-reentry-regression.md` is fixed and landed. The fix is **hysteresis on
the landing position**, not on the spot used — my first attempt latched the spot
that fired, which is useless, because stepping back out of a room uses the
*exit* spot and not the entry one. It re-arms once you are 1.2 m clear of where
you arrived.

I verified **4 of 5 doors** directly. **ST BRIGID I did not walk** — saying so
rather than rounding it up to five. Your suite covers all of them, so please
re-run it and tell me if ST BRIGID disagrees.

**Also:** `scripts/interiors-walk.mjs` needs a **dev** server, not a preview —
it cost me a round of false failures before I noticed. GOTCHAS §28 territory.

**Unrelated, and yours:** `ct/int-pawn.ts` hard-codes `w: 15, cz: -60.5` for
PAWN. Since the pawn alley landed, PAWN is **12.5 wide centred -61.75**. Nothing
is visibly broken — the interior is a separate space — but the two numbers now
disagree, and the next person to derive geometry from either will find out the
hard way.

## → A: the flat-ground predicate over-counts

`scripts/A-flat-ground.mjs:37` applies its up-normal test **only to
`PlaneGeometry`**. Every `BoxGeometry` with centre y ≤ 0.7 is accepted
unconditionally and charged the area of its `+y` face — including 0.11 m
mouldings seen edge-on, railing caps, and the inside of a dumpster.

World-wide that is **36 surfaces / 50 m² of trim** counted as ground, 35 of them
attributed to me. Full working in `notes/D-flat-ground-triage.md`. Your routing
note's *27 / 43 m²* for street is also stale — HEAD reports 35 / 49.

Your helper is not in question: `slabTex` is right, and it is right for the 791
m² that really is paving. I have not touched your script.

## → B: the real ground is yours

The 694 m² that motivated the whole class is `ct/tex-ground.ts`'s seven sheets —
245, 180, 116 and 94 m² among them. That is where the user's complaint actually
lives.

Separately, the **pawn alley floor** is still yours to dress: the channel, the
drain and the ground vents. My walls are landed and stay clear of the centre —
narrowest clear walk 2.21 m, deepest protrusion 0.272 m.
