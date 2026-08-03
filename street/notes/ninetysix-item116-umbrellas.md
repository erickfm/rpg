# Item 116 — umbrellas in the rain

Worker ninetysix. Port **4520**, built bundle. Six street citizens raise an
umbrella when it rains and furl it when it stops.

> *"give people umbrellas if they're out walking and it rains."*

---

## The one design decision, and why it is not a shortcut

**The umbrella is a prop beside the atlas, not a sixth view inside it.**

`CITIZEN-STYLE.md` is emphatic that a PERSON must come from `citizenAtlas` —
four cardboard people got into this world hand-drawn beside it. That rule is
about people, and it exists because a body looks different from five angles. **An
umbrella does not: a canopy is a dome, so it presents the same silhouette from
every horizontal angle.** That is the entire reason the atlas's five painted
views are unnecessary here.

It composes correctly for free. The citizen sprite is a billboard turned to the
camera every frame; this is a billboard at the same position given the *same*
rotation, so the two stack like a 2D overlay at every angle — including the
mirrored half of the sheet, which I checked (GOTCHAS 41,
`shots/w96-umbrella-behind.png`).

Painting it into the atlas would have meant repainting six canvases on every
weather change, and a new `Look` field that ten interior callers would have to
learn to leave alone. **`ct/citizens.ts` is untouched.**

## What it reads, and what it does not re-derive

`ct/props.ts:2389` publishes `scene.userData.rainHeavy = rainLevel · stormNow`,
and its own comment says re-deriving "how heavy is it right now" from a
material's alpha is how an earlier reading came out wrong. So this reads that
number rather than forming a second opinion about the weather.

**Hysteresis, because the rain does not switch.** `rainLevel` eases toward its
target at `dt·0.6` — about 1.7 s to cross — so it passes through any single
threshold slowly, and six umbrellas flickering on the way into a shower is the
one way this could look worse than no umbrellas. Raise at 0.12, lower below 0.05.

**Opening, not fading.** `alphaTest` and `transparent` together is GOTCHAS 22, so
the open/shut is a scale ease. It also just looks more like an umbrella.

## Density is derived, not chosen

The citizen sheet is `FW` 32 texels across a 0.95 m plane = **33.7 px/m**. The
umbrella is 38 texels across 1.14 m = **33.3 px/m**. An umbrella whose pixels are
a fifth larger than the pixels of the hand holding it is exactly the seam
BUILDER-BRIEF §7b is about.

## Two things the first cut got wrong, both caught by LOOKING

The pass/fail only ever knew whether the canopy was *up*. It could not see either
of these, and both are in `shots/`:

1. **It sat on the wearer's head like a mushroom cap.** The hem landed 2.7 cm
   *below* the crown. Now the offset is DERIVED from where the hem is in the
   sheet (`UMB_HEM_M`) so it clears the crown by a stated 0.10 m, instead of
   being a lift chosen by eye.
2. **At 0.95 m it read as a hat, not a brolly** — a canopy has to be wider than
   the shoulders it is keeping dry. Now 1.14 m.

Also fixed while there: the row positions in the painter were hard-coded for a
32 px sheet, so resizing the canopy would silently have moved the hem back into
the wearer's face. They are fractions of `UMB_PX` now.

**And the shaft was coplanar with the torso.** Two billboards at the same
position have undefined draw order and flicker as the camera moves; the umbrella
is nudged 6 cm along the view direction so it is reliably in front.

## Verification

`scripts/probes/w96-umbrellas.mjs` — **BOTH SIGNS, and that is the point.** A
check that only visits a wet hour cannot tell "the umbrellas track the weather"
from "the umbrellas are always up", and always-up is one inverted comparison
away. It walks the clock and fails unless it sees both kinds of hour:

```
26 hours:  10 with all six up,  16 with all six furled,  0 mixed
```

10/26 = 38% wet, against the ~33% of hours `notes/w59-rain-drizzle.md` measured
independently. `umb` is published on `crowd.walkers()` because **there is no
weather readout on `__ct` at all** and `crosstown.ts` is held by item 251 — so
without it the only way to ask "did they go up?" is to look at a picture, and a
picture cannot be a regression test.

- typecheck **clean**, build clean.
- `node scripts/health.mjs` → **WORLD OK**, exit 0.
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**, exit 0.
- `scripts/crowd-walk.mjs` → **all crowd checks pass**.
- Looked at: `shots/w96-umbrella-rain.png` (front, on the street),
  `shots/w96-umbrella-behind.png` (rear/mirrored), `shots/w96-umbrella-dry.png`
  (furled).

## Gotcha worth having, cost me two empty photographs

**It never rains while the player is indoors, and the player SPAWNS indoors.**
`updateRain` gates on `px < 100` (`ct/props.ts:2376`) and the interiors are
parked far out along +x, so a probe that sets the clock to a wet hour without
first `warp`-ing to the street reports "never found a wet hour" against a
perfectly working world. Both umbrella probes now warp out of apartment 301
first and say why.

## Not done, for the desk

- **Interior people get no umbrella**, correctly — they are indoors — but the
  ones the shops place outdoors, if any ever are, would not get one either:
  this lives in `ct/crowd.ts` and covers only the six street citizens.
  `citizenSprite` callers would need the same treatment, and that is
  `ct/citizens.ts`, which this item does not name.
- **They carry it while standing still too.** I read *"out walking"* as "out on
  the street" rather than "currently in motion" — a person who stops at a shop
  window in the rain does not furl their umbrella, and making it depend on
  motion would pop it every time somebody paused. Say if the other reading was
  meant.
- `scripts/probes/w96-umbrella-closeup.mjs` is **unreliable and I have not cited
  it as evidence**: chasing a walker to photograph it loses (they move at up to
  1.55 m/s), and even standing still the near field can be occluded by a street
  tree. The two shots I did use came from `w96-umbrellas.mjs`.
