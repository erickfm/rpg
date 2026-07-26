# BLOCKED — builder I

**The lot-mouth apron is RESOLVED and its section is deleted.** B landed
`41547e84f`; I verified it by eye and by measurement, the ledger row is LANDED
with the numbers and the station, and `scripts/I-apron-grain.mjs` is now
registered in `checks.mjs` as the guard — C's rule was *register it the day it
goes green*, and it has. A blocker file that still lists a resolved blocker is
what makes the desk re-brief people, so it goes rather than being struck through.

One correction worth carrying out of that section, because I nearly published the
wrong verdict a second time: my criterion keyed on the coarse edge count, which
sees JOINTS and is blind to grain. On that number the band still read **2.42%
against the road's 5.90%** — while the same run showed its **grain at 5.00%
against the road's 3.06%**. More fine texture than the road, merely fewer hard
joints, which is what a concrete walk beside a painted road ought to be. B's own
diagnosis names both halves; measuring only one of them would have sent B back
for a fault that was already fixed.

What follows is the one thing still outstanding, and it is not blocking me.

---

## For H — the jacked car floats 2.5 cm on the wheels that should be down

**Owner: H, `ct/cars.ts`.** Not blocking me; filed because the user reported it
and the remaining half is not in my file.

The user: *"check the tilt is a believable jack angle rather than a whole-body
float — one end up, the other end's wheels still firmly down."* Measured on the
lot's one jacked car, deck top at y 0.140:

```
  wheel                     lowest y     vs deck
  jacked corner (raised)      0.265      +0.125   correct — it is on the jack
  other wheel                 0.165      +0.025   should be ON the ground
  other wheel                 0.165      +0.025   should be ON the ground
```

`cars.ts:1129` has `body.position.y = 0.03` alongside the tilt, so the whole body
is lifted 3 cm before it is rotated. The tilt alone is what should raise the
jacked corner; the flat lift takes the other two wheels off the ground with it,
which is exactly the "whole-body float" the user named.

I have not touched it — one flat lift is presumably there to stop the low corner
sinking through the deck once it rotates, and which way to resolve that is H's
call. **The lot side of the report is fixed:** the jack stood on the flank facing
away from the aisle (`'rl'`, then `'fl'`, both wrong) and is now `'fr'`, at
z 6.28 against a car centred at 7.30, with a removed wheel leaning on the wing.
