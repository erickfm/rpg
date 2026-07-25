# The used car lot — builder C

`ct/lot.ts`, mine. Built, wired, walked, landed. This note replaces the one
written when it was still an unwired module.

---

## What it is now

A 23.2 m site on the east side, laid out to the plan the user gave:

- a **drive aisle** straight in from the street to the back
- **stock herringboned either side of it**, nose-out, receding
- **the office across the far end**, facing back down the aisle

That layout is the whole thing. 23.2 m of depth only READS if you look ALONG
something — rows parallel to the street hid the depth behind the first row,
where the pavement could never see it, and the lot looked flat from the one
place everybody stands. It also gives the office a job: at the front corner it
was a hut you walked past, and at the far end it is what you drive toward.

## Verified, and how

Three scripts, all in `scripts/`, all reusable by anyone:

| | |
|---|---|
| `lot.mjs` | 32 shots including three after dark |
| `lotwalk.mjs` | holds W eastward off the pavement at 15 values of z and reports how far the rig gets |
| `seatcheck.mjs` | every seat in the world: is the approach point inside a collider, and does E actually seat you |

**Access.** The opening is clear from z −0.5 to 6.0 — six and a half metres —
and the fence stops you at every other z tested. That check is not optional
and it is not doable from a screenshot: three of my own props were standing in
the driveway and only walking it found them. The best one was the rolling
gate, parked "open" with its leaf and its collider 1.4 m into the gap it was
holding open.

**Seats.** Two chairs by the office door and the three-high tyre stack, all
through F's `ctx.seat()`, all confirmed reachable and sittable.

**The walk is untouched.** Nothing this module builds is west of `x = FACE`.
The barbed arms on the fence lean INTO the lot for that reason.

## Things worth keeping, because each is a rule and not a one-off

| what I built | what it looked like | what it is now |
|---|---|---|
| chain-link on the frontage | **nothing at all from the pavement** — banners hanging in mid-air over a lot with no fence | a fence is not read from its mesh at 15 m, it is read from its FRAMEWORK: rails, line posts, fat terminal posts either side of the opening, barbed arms against the sky. Framework first, mesh second — the order it is built in reality |
| a one-texel wire at 0.3 m per tile | sub-pixel, so alphaTest dropped it entirely | two texels of wire, so enough survives the test to read as a screen |
| `GLYPH` without G H J P Q V X | "BUY HERE PAY HERE" shipped as **"BUY ERE AY ERE"** for several commits | full alphabet, and a missing glyph now draws a solid block — still wrong, but impossible to miss in the first screenshot. A silent blank is indistinguishable from wide kerning |
| the FTC Buyers Guide at fixed coordinates | hanging in mid-air off the rear quarter of a sedan, where there is no glass | it FINDS the lofted cabin in the car H hands back and reads the window off its own bounding box, so it survives H changing the fleet |
| a flag as three panels in a row | three panels each got the whole texture, so the flag flew with **three stars** | one segmented plane with a ripple in its vertices. A tiled texture is not a bent one |
| chairs west of the office | both chair and both approach points inside a solid box: seat registers, prompt appears, you can never walk to it | GOTCHAS §8. `seatcheck.mjs` exists because of this |
| a chair with its back on +x | the seat pose said yaw 0, which is −z, so it sat you square across the arms of your own chair | a model and its seat pose have to agree on which way is front |
| the office name board at 2.05 | lay across the top quarter of the window | both take their height from the same texture now |
| 32 × 24 texels on a 4.6 m office wall | seven per metre — cannot hold a blind slat, let alone a room behind one | 64 × 40, which is what unlocked the blinds, the desk lamp and the room behind them |

## Open, and not mine

**Builder B — the curb cut.** `notes/BLOCKED-C.md` has the ask and the exact
span. The kerb face still stands across the mouth; a car can reach the opening
and cannot drop off the kerb. This is the last piece of "how does a car get on
and off" and it is the only part I could not build.

**~~Builder B — the night dimmer skips transparent materials.~~ WITHDRAWN —
it was mine.** I filed this twice. `props.ts` excluding `transparent: true`
from `dimWorld` is CORRECT: that function owns glass, and blending a graded
colour through a pane is its business. The bug was that a cut-out is not
transparent — `alphaTest` discards the fragment and never blends, so the flag
bought nothing and put six of my own materials on the skip list. Fixed in
`ct/lot.ts` by deleting one flag, `04548554`.

**The rule that IS worth having**, for anyone else: if you set `alphaTest`, do
not also set `transparent`. `scripts/nightgrade.mjs` catches it — average
material colour by class over a world box at noon and at 23:00; everything
should fall except `additive`. Nobody screenshots their own props at 23:00,
so this failure is silent by construction.

**Builder H — three car variants.** Hood up, on a jack with a wheel off, on
blocks. The stock is `makeCar()` unmodified; I have added no vehicle. A flag to
omit one or all wheels would give me two of the three by itself.

**Builder D — the back wall.** With the office against it and cars in front it
is much less of a problem than it was, but from the aisle it is still a tall
blank brick face and it is the thing you look at all the way in. Worth a
painted wall ad or a parapet if it is cheap; it is your surface, not mine.

**Not built, and why.** Privacy slats were on the brief for "the back and side
runs". There are no back or side runs — the site's rear and flanks are D's
brick, and the only chain-link here is the frontage, which exists to show the
stock. If a flank is ever fenced instead of walled, the slats belong there.
