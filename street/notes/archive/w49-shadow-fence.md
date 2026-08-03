# w49 — item 114, the world-wide translucent-plane sweep

**Ports: 4193 (dev) and 4194 (built preview). Both proved free with `curl`
(`000`) before use and shut down at the end.** 4186 answered 404 and was
somebody else's world, so I did not take it.

**In one line:** the user's "shadow fence" is the jail yard fence, and it was a
14 × 2.4 m plane of flat charcoal with **no texture at all** — the only
untextured surface in the frame, which is why the eye read it as a shadow
rather than as a fence.

---

## The item's premise is FALSE, and it is worth saying loudly

The item's "STRONG LEAD" was that `props.ts`'s `dimWorld` **skips any material
with `transparent: true`**, so translucent planes stay bright while the world
dims — citing `ct/lot.ts:159`.

**That has not been true for some time.** `ct/props.ts:414` now reads:

```ts
const isGlass = (m: THREE.MeshBasicMaterial) => m.blending === THREE.AdditiveBlending;
```

The comment above it (`:379-413`) is a full account of the change: the old test
`m.transparent && !(m.alphaTest > 0)` carried three meanings at once, and only
**additive** is excluded now. Measured proof rather than reading: my sweep
reports the jail fence itself as `graded` — the dimmer *was* touching it.

`dimWorld`'s actual skip list is now: additive blending (`:414`), the `noLight`
opt-out (`:721`, `:980`), interiors via `|world x| > 100` (`:937`), and
`wetMats` (which `updateRain` owns). **Nothing is skipped for being merely
transparent.**

**The lead came from a stale comment.** `ct/lot.ts:322-333` still asserts
*"`dimWorld` deliberately leaves transparent materials alone"*, and `:159` and
`ct/street.ts:371`, `ct/vice.ts:27`, `ct/weeds.ts:22` say the same. Those
comments were true when written and are now wrong, and one of them is what
routed this item at the wrong target. **I did not edit them — none of those
files is named by item 114.** See "queue this" below.

So the "glowing ghost that never dims" mechanism is not what the user is
looking at. The defect is much plainer: **a surface with no texture on it.**

## The census — 624 transparent meshes, and what they actually are

`scripts/probes/w49-translucent-sweep.mjs`, run at 13:00 and 21:00. It walks
every mesh with a transparent material and classifies it by **world-space
bounding box**, because that is the only orientation-truthful measure — a
`PlaneGeometry` rotated flat and a 0.02 m box are the same defect and only the
world box says so. (THREE is not on `window`, so the box is computed by hand
from `matrixWorld`.)

| | at 21:00 |
|---|---|
| meshes with a transparent material | 624 |
| of those, **planes** (one dim < 0.12 m, other two > 0.25 m) | 312 |
| **STANDING** sheets (thin axis is X or Z) | 133 |
| FLAT ground decals (thin axis is Y) | 179 |

**Only ONE of the 133 standing sheets was a defect.** The rest sort into three
justified groups:

- **Lit-window overlays** on the shopfront facades — `op=1`, textured, `graded`,
  and `op=0` in daylight. These are the night windows; they are supposed to be
  there and they carry art.
- **Additive lamp glow / pool / wall-splash** — flagged `ADD` in the sweep.
  These are *lights*, driven by `nightLit` on their own curve; grading them
  would fight that, which is exactly what `isGlass` now exists to prevent.
- **Window glass** — the remaining untextured ones, and every single one is at
  `|x| > 100`, i.e. inside a room. They come from one generator,
  `ct/interior.ts:924` (`0x7d8b93`, opacity 0.55), plus `ct/int-bank.ts:983`
  and `ct/apartment.ts:1710`. **Justified in one line: a window pane has to
  blend to be glass at all**, and each is built with a sill, mullions every
  ~2 m and a transom — I looked at `bug-burger-wide.png` and they read
  unmistakably as glazing, not as sheets.
  They are `UNGRADED` because interiors keep their own light (`props.ts:937`),
  **not** because they are transparent — consistent, and correct.

The flat ones are the same story: the 12 `op=0.26` strips at `(10.25, 0.15,
−3.4)` and friends are `PlaneGeometry(0.09, 5.0)` — the car lot's **painted bay
lines** (`ct/lot.ts:581`), which is the same false "12 flat slabs" finding
BUILDER-BRIEF §7 already warns about. The rest are additive pools.

## The one real defect: `ct/jail.ts:841`

```ts
const fenceM = new THREE.MeshBasicMaterial({ color: 0x2a2c2e, transparent: true,
                                             opacity: 0.75, side: THREE.DoubleSide });
const fence = new THREE.Mesh(new THREE.PlaneGeometry(W, FENCE_H), fenceM);
```

14 m × 2.4 m, flat charcoal, **no map**. And the file convicts itself on the
very next line — the posts are commented *"a touch taller than the mesh they
carry"*. **There was no mesh.** What stood in the yard was a translucent grey
sheet with four posts in front of it.

**Why it reads badly, in one line:** standing in the yard it is the only
untextured surface in frame — among grained brick, banded stone and jointed
paving — so the eye reads it as a shadow cast across the back of the yard
rather than as a fence. "Shadow fence" is a literal description of what was
there, not an approximation.

### The fix, which `ct/lot.ts` had already proved

`ct/lot.ts:311-333`'s `linkPanel` writes the cure out in full: **`alphaTest`
WITHOUT `transparent: true`.** A cut-out *discards* the fragment rather than
blending it, so `transparent` buys a chain-link fence nothing and costs it the
sorted transparent queue plus the pale-sheet look. That comment even says its
author "reported that twice as a props.ts problem. It is not."

Dropping the flag has a second effect that matters to this item: the surface
**leaves the translucent population entirely** (624 → 623 meshes, 312 → 311
planes; `74.65` no longer appears in the sweep). There is now no standing
translucent plane on the jail site at all — not a better-looking one.

I also added the **top and bottom rails** `lot.ts:606-610` argues for: a
chain-link fence is not read from its mesh, which is near-invisible at range —
it is read from its **framework**. This had posts and nothing else.

`FENCE_X`, `FENCE_H` and `ctx.obstacle` are untouched.

### Derived, and copied-with-citation

- **Repeat is DERIVED**, per BUILDER-BRIEF §7b:
  `linkT.repeat.set(W / MESH_M, FENCE_H / MESH_M)` — the panel's own run and
  height against a declared 0.3 m mesh pitch. Resize the yard and the diamonds
  stay 0.3 m. The texture is `declareSurface(pixTex(24, 24, …), 'detail')`.
- **The art is COPIED, not imported, and the citation is in the code.**
  `linkT`/`linkPanel` are locals inside `ct/lot.ts`'s build function (`:290`,
  `:311`), not exports; importing them means hoisting them to `ct/paint.ts`,
  which is a `lot.ts` edit item 114 does not name. Per §8 I copied with
  line-number citations and am queueing the hoist below.
- Wire is `#5a626a`, not the lot's galvanised `#7c848d`: weathered
  institutional steel behind a jail, not a dealer's frontage. Against this
  yard's pale concrete the lot-bright wire pulled the eye to the least
  interesting thing in the view.

## My own verdict on the after-images

I looked at all five yard views before and after (`shots/w49-before-*-h19.png`,
`shots/w49-after-*-h19.png`), taken from standing positions in the yard.

- **`yard-head-on`** — before: a flat charcoal rectangle spanning the frame,
  four posts stuck on the front of it, no detail anywhere. After: a chain-link
  fence with sky through it and a hard top-rail line. The single biggest
  improvement, and it is the frame that matches the user's complaint.
- **`yard-close`** — before: a featureless charcoal void filling the screen;
  genuinely the worst image in the set. After: wire diamonds with the sky and
  the ground beyond reading through them.
- **`yard-along`** (grazing angle, where a sheet betrays itself worst) — the
  one I would put in front of the user: the mesh recedes in perspective, the
  top rail runs away with it, the posts read as posts *carrying* something.
- I would call the mesh slightly bright at 1 m range, which is the honest look
  of chain-link against a lit sky and not something I would trade the
  legibility for. If the user dislikes it the lever is one hex value.

## Verification

- **Walked it, not photographed it** — `scripts/probes/w49-fencewalk.mjs`, on
  the **built bundle** (port 4194): stops you 0.47 m short of the panel, you
  reverse 5.01 m out of it (not wedged), and the strip beside it still walks.
  **It exits non-zero on failure and fails in both directions** —
  walked-through *and* did-not-move — so it cannot pass vacuously.
- `node scripts/bugsweep.mjs` on the built bundle → **0 STATION MISS, 0
  COVERAGE**, 96 shots. Console output is the pre-existing `THREE.Clock`
  deprecation, the Canvas2D `willReadFrequently` hints and GPU-stall
  performance messages — no errors, none new.
- `npx tsc --noEmit` clean; `npm run build` clean.
- **`fp` deliberately NOT used.** This change adds geometry (two rails), and
  GOTCHAS 75 / BUILDER-BRIEF §10 are explicit that `scenedump` seeds one global
  `Math.random`, so added meshes shift the UUID stream and repaint every
  dithered texture after them. It would have reported a catastrophe that is not
  there. The sweep's own before/after counts are the structural evidence
  instead.

## Found and NOT fixed — please queue

1. **The stale comments that caused this item.** `ct/lot.ts:159` and `:322-333`,
   `ct/street.ts:371`, `ct/vice.ts:27`, `ct/weeds.ts:22` all still state that
   `dimWorld` skips `transparent: true`. It does not (`props.ts:414`). This is
   not cosmetic — **one of those comments is what aimed item 114 at the wrong
   mechanism**, and they will do it again. A five-line comment fix; I did not
   make it because none of those files is named by my item.
2. **Hoist one shared `linkPanel`.** There are now two chain-link
   implementations, `ct/lot.ts:311` and my `ct/jail.ts`. Moving it to
   `ct/paint.ts` beside `slabTex` — taking wire colour and mesh pitch as
   parameters — would leave one authoring. Small, and it needs `lot.ts`.
3. **76 undeclared texture densities world-wide.** BUILDER-BRIEF §7b cites 343
   texture creations against 267 `declareSurface` calls. My sweep only looked at
   *transparent* materials, so it does not cover this, but it is the same class
   of defect the user keeps finding by eye and nothing checks it.
4. **`ct/apartment.ts:1710`** carries a transparent pane too. It is glass and it
   is fine, but **w48 holds item 119 in that file**, so I did not go near it.

## Out of bounds — please check

**The whole fix is in `ct/jail.ts`, which item 114 does NOT name.** The item
named `props.ts` (from the premise above, which is false) and "the 68
transparent materials". `props.ts` needed no change: the dimmer is already
consistent, and the sweep is what proved it.

No other builder holds `jail.ts` — the only other live claim was w48 on item
119 (`ct/apartment.ts`), checked with `claim.sh --stale` before I started and
avoided in (4) above. The item explicitly commissions a world-wide sweep with
deletions, so I judged the jail edit inside its intent and am flagging it
rather than assuming.
