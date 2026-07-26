# The bodega corner course, walked rather than measured

The row `bodega corner paving: joints run into the canted bay` has been LANDED
since the rejection was fixed, and the auditor's standing note is that a re-filed
row "needs a walk before CONFIRMED, not a status change". So I walked it. I am
not setting the status — that is the desk's or the auditor's.

## What is actually there

Stood off the canted face at 2.9 m at 13:20 and looked at the pavement, then
directly over the band, then cropped both at pixel scale (`shots/bodega-face`,
`-foot`, `-down`, `-band`).

- The course is **present, correctly oriented and legible**. It runs along the
  cut face, 2.83 m, with its own transverse joints one per 0.5 m.
- The field's diagonal joints **die into it** instead of running on under the
  building. That was the user's complaint and it is fixed on screen, not just in
  the assertion.
- It clears the walk properly: course y **0.144**, walk y **0.1298**. 15 mm, so
  it is genuinely drawn rather than z-fighting its way in and out of visibility.

**One reading of mine, withdrawn.** From the first 2.9 m crop I judged the band
"a plain grey strip with no scoring of its own" and was about to raise the joint
contrast for legibility. That was the crop being too coarse, not the band. At
proper magnification the cross-joints read clearly at walking distance, which is
the distance that matters. No change made — the temptation to "improve" a
correct surface on the strength of a bad measurement is how the tint comparison
went wrong a few rounds ago.

## The reference shot is gone, and so are all the others

D's note cites `shots/user-bodega-corner.png` as the picture the complaint came
from. **It does not exist, and neither does any shot I worked from** —
`user-treepit`, `user-apron`, `user-cupsize`, `user-shadowgeom`,
`user-toomanyweeds` are all absent. `shots/` is untracked, so git cannot recover
them; twelve unrelated `user-*` shots remain, so the directory has rotated rather
than been emptied.

Nothing is blocked by this: the fault was described precisely enough in words to
walk. But it means **no landed row citing a user shot can be re-checked against
what the user actually saw**, and the ledger quotes those shots as evidence. If
the desk wants that evidence to survive, the shots need to be tracked or copied
somewhere that is.

## Also verified, since E had just fixed its twin

`dd057a5e9` fixed a sitter who "faced the wall while the bench faced the park".
My bus bench is the same shape of thing and I had only ever checked its yaw
NUMBER. Sat on it: the sitter faces the road — Burger Barn, the diner, the
library across the street. Correct, and now looked at rather than computed.

Two things that bit me while doing it, both mine, both worth knowing:

- `warp` is `(x, z, yaw, gy, pitch)`. I passed yaw into `gy`, so the camera never
  turned and I photographed a different shopfront row twice before noticing.
  Ground level is `gy 0.14`; **pitch is NEGATIVE for down**.
- I walked to the bench for a fixed 2400 ms and overshot it by 3.4 m, so `[E]`
  did nothing and it looked like the prompt was missing. Walking until the seat
  is in range instead of for a fixed time is the only version of that test worth
  running.
