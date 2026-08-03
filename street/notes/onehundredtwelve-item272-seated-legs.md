# Item 272 — "people sitting still looks bad because they have no legs??"

**Worker onehundredtwelve, 2026-08-03. Port 4681 (dev) and 4682 (built preview).**

## The cause: (2) OCCLUSION. The legs were painted the whole time.

The desk offered three candidates and asserted none, which was right. It is the
second one, and it is provable by removing one variable at a time from the
running world rather than by reading the drawing code.

**The mechanism, in one line:** `citizenPlane` puts the seated origin at the
HIP, a room places that origin on the SEAT TOP it registered — so the origin row
**is** the seat's top face, and the old seated block drew rows 44…59, i.e.
**100% of the leg, underneath it.**

Measured in the diner (`scripts/probes/w112-seated-legs-census.mjs`):

```
seated sprite (761.19, 0.450, 2.02)
  painted extent   y -0.144 .. 1.756     hip(origin) 0.450
  LEG BAND         y -0.144 .. 0.450     — 0.594 m of sprite, all of it below the seat
  the bench it is on   x ±0.275   z -0.22 .. +1.28   y 0 .. 0.45
```

The bench's top face is 0.450 — the same number as the origin — and its front
face stands **0.22 m nearer the aisle than the sprite plane**. So the seat eats
every painted leg row, in y and in z at once.

**The three candidates, each settled rather than argued**
(`scripts/probes/w112-is-it-occlusion.mjs` renders the same frame three ways):

| candidate | verdict |
|---|---|
| (1) the `seated` flag is not set on these figures | **false** — `ct/int-diner.ts:295` passes `seated: true`, and `shots/w112-occl-lifted.png` shows the seated pose in full |
| (2) occlusion | **TRUE** — hiding only the two bench boxes brings the legs straight back: `shots/w112-occl-nobench.png` |
| (3) the figure sits too high | **false** — the shoe lands at y −0.025 against a floor at 0. `SEAT_DROP` is correct and was not touched |

The precedent the row cited (item 106, benches registering the middle of the
slat) does **not** apply here: the diner bench is `BoxGeometry(…, 0.45, …)` put
at y 0.225, so its top face is exactly 0.45 and the seat is registered `h: 0.45`.
Checked, and clean.

## A second defect found on the way: the seated profile pointed out of his back

`ct/citizens.ts`'s own comment says the unmirrored profile faces LEFT — nose at
`cx−7`, eye at `cx−4`, the standing shoe's toe at `ankle−7`. The seated thigh ran
`cx−2 … cx+8`, to the **right**. GOTCHAS 33's family, and it had never been seen
because the whole thigh was under the bench.

## What changed — `ct/citizens.ts` only, all of it inside a `seated` guard

- thigh drawn **above** the origin row, resting on the seat
- shin drops **forward** of the seat's front edge. Sized from the seats that
  exist, the same way `SEAT_DROP` was: a 0.55 m booth bench puts its front face
  0.275 m ahead of a sitter at the bench centre, which is 9.3 texels at
  1.9 m / 64 rows. `KNEE = 12` clears it; 8 would not
- seated shoes go under their own shin — they used to fall through to the
  standing cases and sit under the hip
- seated arms stop at row 31. They, not the torso, were hiding the new lap:
  jacket plus hand occupy `cx±(tw…tw+3)` down to the seat line, which is exactly
  the texels a thigh has to protrude through
- the profile upper body is set back 3 texels. Without it the thigh lands in the
  **same columns as the shin** and the leg reads as one vertical bar — see
  `shots/w112-zoom-0-try2.png`, kept deliberately as the failure this fixes

`git diff` over the whole change contains no line outside a `seated` guard, so
**standing citizens are untouched.**

## Proof

**The check: `scripts/probes/w112-legs-below-the-seat.mjs`.** It differences two
frames of the same static scene, one with the sitter's mesh `visible` and one
without, so his pixels are identified exactly — black shoes included, which no
colour key can separate from a dark floor. The seat row is his geometry's origin
projected through the live camera; nothing is typed.

```
NEGATIVE CASE (HEAD~1, the old art)   diner (761.19, 2.02)   below the seat     0 px   NO LEG
                                      diner (762.50, 2.02)   below the seat     0 px   NO LEG
                                      FAIL — 2
ON THE FIX                            diner (761.19, 2.02)   below the seat   931 px   ok
                                      diner (762.50, 2.02)   below the seat   895 px   ok
                                      PASS — 0
FIVE RUNS on the fix                  5 PASS / 5.  6-8 sitters judged (spread is the casino)
BUILT BUNDLE (vite preview 4682)      PASS — 0
```

**It reports four states, not two, and every one of them is measured:**

- **TOO NOISY** — a 3-sample noise baseline, worst taken. One sample was not
  enough: a casino stool flipped between `NOT VISIBLE` and `NO LEG BELOW THE
  SEAT` on 1 run in 5 **with the world unchanged**, because the slot reels move
  in bursts and a single baseline pair can land in a still moment and hand 2,743
  px of moving reel to the sprite.
- **IMPLAUSIBLE** — a diff of 636,433 px out of 640,000 is not a 1.9 m sprite two
  metres away. Seen on a jail bench with a noise baseline of 6, so the baseline
  alone does not catch it.
- **NOT VISIBLE** — a sitter this vantage cannot see is *unmeasured*, never
  failed. `shots/w112-room-casino-9-after.png` is the photograph of one: he is
  entirely behind his own slot cabinet. GOTCHAS 34.
- exempt rooms (**library**, **bank**) are named with the reason — a desk hiding
  a reader below the waist is a desk working. An exempt sitter that *does* show
  legs is reported, not failed.

**Population floor 6 judged sitters, and it sits close to the observed 6-8.** If
the casino gets noisier this exits 3 — measured too little to have an opinion —
rather than passing on two rooms.

**Frames, all from a standing player in the aisle.** Before/after pairs:
`shots/w112-zoom-{0,1}-{before,after}.png` (tight crops, the decisive pair),
`shots/w112-booth-{side,face,angle,near}-{before,after}.png`.
`shots/w112-atlas-{0,1}-before.png` is the painted sheet with the seat line
ruled across it — every leg texel is below the line.

**My own verdict on the after frames:** from the aisle he now reads as sitting —
thigh over the seat toward the table, knee, shin dropping into the footwell,
shoe on the checkerboard. Before, the same figure was a torso ending in a flat
cut at the bench with the floor showing through it. Head-on down the aisle the
improvement is real but smaller: what you gain there is the shins under the
table. The strong read is the side view, which is what walking past gives you.

**Not broken:** `w99-item126-diner-seats` PASS (0 seats with no approach),
`w99-item126-booth-prompt` 6/6 booths sat on when faced, `bugsweep` 0 STATION
MISS and no new console errors, `health` WORLD OK, `tsc --noEmit` clean. All on
the built bundle.

## Found and NOT fixed — for the desk to queue

1. **The diner's two customers are the only occupants of eighteen booth seats,
   and both sit in the same booth.** Not a defect; noting it because the room
   reads emptier than the fix makes any one figure look.
2. **`w112-legs-below-the-seat` cannot judge the casino.** Three of its five
   stools come back TOO NOISY or NOT VISIBLE every run — the animated slot
   screens, plus a vantage rule (2 m toward the room centre) that walks into
   cabinets. A per-seat approach vantage taken from the seat's own registered
   `at`/`yaw` would fix it; that is a probe change, not a world one.
3. **`fit: 'coat'` hangs to row 51, seven rows below the seat line.** Harmless
   here because the bench hides it, but a coated sitter on a *stool* would have
   his coat pass through the seat. Not seen in the world today.
