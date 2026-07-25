# The "twelve mirrored blades" are the car lot's bunting, not east shopfronts

`notes/request-audit.md` routes a finding to me:

> These are on the **east shopfronts**, so `ct/street.ts` (D) unless the
> shopfront furniture has moved to another module since.

They are not shopfront furniture and they are not in my file. Checked before
touching anything, because the fix it proposes (re-hand the artwork, or go
`FrontSide` plus a second plane) is the right fix for the wrong objects.

## What they actually are

`ct/lot.ts` — **builder C** — the used car lot's bunting swags:

    ct/lot.ts:194   const pennantT = pixTex(64, 20, …)      <- the audit's canvas
    ct/lot.ts:564   new THREE.PlaneGeometry(len, 0.62)
    ct/lot.ts:565   transparent, alphaTest 0.35, side: DoubleSide
    ct/lot.ts:566   position (FENCE_X, …)                   <- x ≈ 7.18
    ct/lot.ts:567   rotation.y = Math.PI / 2                <- normal ±x

Everything the audit measured matches: the 64 × 20 canvas, the ±x normal, the
0.18 m proud of the east building line, the head-to-fascia height, and the
z-span. **That z-span is the tell** — the audit gives z = +13.2 … −8.0, and
the car lot is z = −9 … 14.2. It is the lot's frontage, exactly. There are no
east shopfronts in that stretch; that is why the lot is there.

## How much of it is a real defect

Less than it sounds, and this is worth saying before anyone spends a day on it.

- **The bunting is symmetric.** `rotation.y = +π/2` points the front face into
  the lot, so the street does see the back — but a pennant is a triangle strip
  in two alternating colours, and its mirror is itself. There is nothing
  handed to read backwards. GOTCHAS §10 is about ARTWORK, and this artwork has
  no handedness.
- **The text banners are already the right way round.** `ct/lot.ts:803-810`
  hangs 'BUY HERE PAY HERE', '99 DOWN' and 'SE HABLA ESPANOL' at
  `rotation.y = -π/2`, normal −x, front face to the street. Those are the ones
  where a mirror would actually show — reversed letters, the HOTEL-sign bug —
  and they are correct.

So the finding is accurate about the geometry and overstates the consequence.
If C wants it tidy, `FrontSide` + a second plane (the `twoSided()` pattern in
`ct/vice.ts:968`) removes the wrong-facing back at the cost of twelve more
quads. That is C's call on C's file.

## What I have NOT done

Touched `ct/lot.ts`. Coordination with C goes through the desk.

One thing the audit flags that IS worth passing on regardless: it measured the
canvases as **non-square texels** (31 × 19 px/m on the taller family). That is
a separate defect from the mirroring and it is in the same file.
