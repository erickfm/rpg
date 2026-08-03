# w78 — item 219: a prop pushed itself out of its own side panels

Port **4340** (`ss -ltn` clean, `--strictPort`), `vite preview` over `dist/` —
the **built bundle**, GOTCHAS 28 — aimed with `SHOT_URL` on every run.

## Root cause, in one line

**The tag is on the group and the test was on the node.**

`ct/props.ts:1268` skipped a solid with `o.userData?.litter`. `drop()` sets that
tag at `:3519` on the **GROUP** and on nothing inside it, so it is false for
every mesh a piece of litter is actually *made of*. A milk crate's four uprights
landed in `solidsNear`, the group's own box overlapped them by construction, and
the push-out pass shoved each crate clear of its own sides. The `h < 0.25` gate
at `:1271` is why crates alone suffered: cardboard and newspaper lie flatter and
never entered the set.

**Both the row and the source comment blamed the projecting shopfront. Worker
seventyseven proved that wrong under item 204 and I re-measured it from scratch
here.** The comment at the head of the block now says so in the file.

Fixed by walking the parent chain — the test `scripts/footprint.mjs:113` already
uses for the same question — **copied deliberately**, so the placer and the check
agree about what a clip is rather than each having its own opinion.

## Measured, before and after

`scripts/probes/w78-litter-landed.mjs` dumps every litter group's landed world
position plus, per group, how many of its own meshes clear `dimWorld`'s
`h >= 0.25` gate. Built bundle, both runs.

**Before** — 3 of 14 groups carried self-solids, and they were the only litter
in the world standing anywhere other than where it was authored:

| authored | landed before | shift | self-solids |
|---|---|---|---|
| `-12.20, -39.60` | **-11.639** | +0.561 | 4 |
| `-11.55, -40.35` | **-11.016** | +0.534 | 4 |
| `-9.30, -37.45` | **-8.88, -37.541** | +0.42 | 4 |
| 5 × flattened cardboard | authored spot | **0.00** | **0** |
| 4 × folded newspaper | authored spot | **0.00** | **0** |
| coffee cup, fountain cup | authored spot | **0.00** | **0** |

**After the tagging fix** — every crate lands on its authored coordinate, and
all eleven flat pieces are byte-identical to the baseline dump. That is the
whole of `diff before after`: three lines, all crates.

## The desk's ruling, carried out

> *fix the bug, and then EXPLICITLY RESTORE the two alley crates to their
> current positions.*

`ct/props.ts:3597-3598` now reads `-11.639` and `-11.016` — the positions the bug
had been producing, which is what the user has been looking at and what
`ct/cat.ts:239-300` settled over **seven** iterations against his own
screenshots. The comment above them says why they are not free to tidy: **a
composition the user signed off should be stated in the code, not depend on a
defect.**

The final litter dump is byte-identical to the pre-fix baseline **except** for
the third crate, which is seventyseven's item-204 relocation and now lands at its
honest `-9.30, -37.45` instead of the bug-pushed `-8.88, -37.541`. That is the
correct outcome and it is deliberate: seventyseven's note is explicit that the
line was authored with **no compensating offset** precisely so the request would
stay honest once this bug was fixed (BUILDER-BRIEF §8). `footprint.mjs` confirms
the new spot is clear.

## The cat's frame is unchanged — proved structurally, not by pixels

**This cannot be answered by diffing two screenshots** (two runs of identical
code differ ~20% of pixels) and the change moves geometry, so `fp` is not
eligible either (GOTCHAS 75). So `scripts/probes/w78-cat-frame.mjs` warps to the
exact viewpoint `ct/cat.ts:259` names — **(-8.5, -39.5) yaw -0.785** — and lists
every litter group **inside that camera's real frustum**, asked of
`__ct.camera()` rather than reasoned about from a yaw.

**Identical before and after, to three decimals:**

```
6 of 14 litter groups are INSIDE this frame:
  folded newspaper       x    -12.6   z   -42.05
  milk crate             x  -11.639   z    -39.6
  milk crate             x  -11.016   z    -40.35
  flattened cardboard    x    -10.6   z   -41.45
  flattened cardboard    x   -9.332   z    -42.4
  folded newspaper       x    -4.81   z    -68.4
```

The crate that moved is in **neither** list — it is behind the camera. So the
one object in the world whose position changed cannot enter the approved frame,
and everything that can is at the same coordinate it was.

**My verdict on the after image, which I have looked at**
(`shots/w78-cat-frame-after.png`): it reproduces every landmark `ct/cat.ts:259`
names in words — KOBRA on the left wall, SNAK right of the wall corner, **both
crates**, the grate below centre — with the cat standing on the paper. The
dumpster's green flank is in the left edge. It is the frame the note describes.

### ⚠ My first capture was completely BLACK and I nearly filed it

The probe set the clock and then warped; the warp put the hour back and the shot
came out black with the HUD reading `00:35`. **The frustum list was unaffected —
positions do not depend on the light — so the proof was never in danger, but the
picture was worthless**, and a black picture is exactly the kind of evidence that
gets attached to a note without anyone opening it. Caught only by looking at
every image I captured. The probe now sets the clock **after** the warp and says
why in a comment.

`shots/w78-cat-frame-before.png` is the black one and I have deliberately not
re-taken it: it would have cost another stash-and-rebuild cycle to produce a
picture that proves nothing that the frustum list does not already prove better.
**The before/after claim rests on the two frustum listings, which are text.**

## Verification, all on the built bundle at :4340

| | |
|---|---|
| `scripts/footprint.mjs` | all OK — **no litter is inside a building or a prop (0)**, nothing straddles the kerb, nothing below ground |
| `scripts/trash.mjs` | all 6 OK — 14 groups, 14 distinct yaws, all five approved types, nothing unapproved |
| `scripts/probes/w78-litter-landed.mjs` | 14 groups; 11 byte-identical to baseline, 2 restored exactly, 1 intentionally honest |
| `scripts/probes/w78-cat-frame.mjs` | 6 of 14 in frame, identical before and after |
| `npm run sweep` | **96 shots, 0 STATION MISS, 0 COVERAGE**, no new console errors |
| `node scripts/health.mjs` | exit 0, `WORLD OK` |
| `npx tsc --noEmit` | exit 0 |

Pre-existing and not mine: `[interior:hotel] NO BUILDING NAME`, the THREE.Clock
deprecation, the Canvas2D `willReadFrequently` notices, the WebGL ReadPixels
stalls.

## Where my own probe lied, and what I did about it

`w78-litter-landed.mjs`'s first cut read `geometry.boundingBox` — **local space,
before the mesh's own rotation** — where `dimWorld` uses `Box3.setFromObject`,
i.e. the box of the **world-transformed** vertices. It therefore reported a flat
sheet of cardboard lying on the pavement as **0.5 m tall**, because its plane is
0.5 m across in local y and only laid flat by its rotation, and concluded that
**12 of 14** groups were self-pushing.

That is the exact opposite of the finding — flat litter never enters the set, and
that is *why* only crates were being shoved. Corrected to a hand-computed world
AABB, the column reads **3 of 14, four uprights each, every flat piece zero**,
which is what the source says should happen. The wrong version is described in a
comment in the probe rather than quietly deleted.

## Found and NOT fixed

1. **`canfail.mjs:1223-1224` is vacuously green on an unknown `--only` name.**
   Carried over from item 218 and still unrouted — full detail in
   `notes/w78-crowdwalk-identity.md`. `node scripts/canfail.mjs crowd` selects
   zero cases and prints *"0/0 checks caught their mutation"*, exit 0.
   `checks.mjs:52-56` already refuses this deliberately.
2. **No canfail case guards this fix.** `footprint.mjs`'s *"no litter is inside a
   building or a prop"* leg would not have caught the bug — the crate was pushed
   OUT of its own panels, so it ended up in clear pavement and the check was
   right to pass it. **What is unguarded is the invariant this item establishes:
   no prop may appear in its own obstacle set.** The natural mutation is to
   revert `:1268` to the group-only test and require a check to notice the three
   crates leave their authored coordinates — but **no registered check asserts
   authored-vs-landed at all**, so the case has nothing to point at yet. It wants
   a row: a small registered check over `w78-litter-landed.mjs`'s question, then
   the mutation behind it. Without that this fix is one careless edit from
   silently reverting.
3. **`ct/props.ts:1245`'s block comment still opens by describing the shopfront
   as the thing litter must avoid.** I corrected the causal claim inside the
   traverse but left the surrounding prose, which is still *true* — the push-out
   pass does exist for frontages — merely no longer the story of the crate. Read
   the two together.
4. **The 0.40 × 0.40 post in the west walk at x -5.55…-5.15, z -65.2…-64.8**,
   taking that cross-section to 1.32 m. seventyseven's finding, still unrouted,
   restated here so it is not lost with item 204.

## What I derived vs copied

- The **ancestry walk** is copied from `scripts/footprint.mjs:113`, on purpose
  and with the reason stated in the code: the placer and the check must agree
  about what counts as "part of the thing I am placing". I did **not** also copy
  footprint's `groundProp` clause or its alpha-test sprite clause — those change
  which *world* geometry counts as a solid and would move litter that is
  currently fine. The item says not to widen this into a placement rework and it
  is right.
- The **two restored x values are copied**, deliberately and with a citation:
  they are outcomes read off `w78-litter-landed.mjs`'s pre-fix run, not numbers I
  chose. That is the whole point of the desk's ruling.
- **Nothing was compensated with a magic offset.** The third crate was left to
  move, and it is named above rather than quietly pinned.
