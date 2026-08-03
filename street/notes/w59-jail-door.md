# w59 — item 104, the jail's front door was see-through

**Port used: 4187** (probed `000` before starting; 4183 and 4191 were already
serving other builders' worlds). Verified on the **built bundle** via
`npx vite preview --port 4187`, not on dev.

## Root cause, one line

The leaves were **buried inside the recess-back stone with their front face
exactly coplanar with its front face — Δ 0.0000 m** — so two opaque surfaces
fought for the same depth and the stone won wherever the tie broke its way.

## What was actually wrong

`ct/jail.ts` centred each leaf at `DOOR_FACE + 0.045`. A leaf is 0.09 m through,
so it spanned `DOOR_FACE … DOOR_FACE + 0.09`. But `DOOR_FACE` **is** the front
face of the recess-back stone box built ~30 lines earlier
(`shell(DEP - RECESS, LINT_Y, DOOR_W, FX + RECESS + (DEP - RECESS)/2, …)`,
spanning `x 61.55 … 65.00`). The door was not hanging in the recess; it was
sunk into the wall behind it, flush.

Two opaque `FrontSide` faces at one depth have no winner. The depth test then
resolves per fragment and per view angle, which is why:

- **head-on** the door mostly won, but stone-coloured speckle punched through
  the panels and ate the panel borders;
- **obliquely** the stone won outright and the **left leaf disappeared into the
  wall's coursing altogether** — `shots/w59/before-d220-oblique.png` is the
  clearest frame of it.

**This one fault is also both symptoms of the original report.** The *"diagonal
hatching that does not match its own panelling"* is the tear pattern between two
dithered canvases; the leaves that *"do not align"* are in fact geometrically
identical, mirrored about `CZ` to the millimetre (`z -104.19…-103.01` and
`-102.99…-101.81`) — it was the tie breaking differently on each leaf.

## The desk's lead was wrong, and so was mine at first

**⛔ `ct/interior.ts:924`'s `opacity: 0.55` is a room WINDOW, not a door leaf.**
It is inside the `if (hasWindow)` branch and builds the glass pane, sill,
mullions and transom. It cannot reach an exterior door.

More decisively, **transparency was never the mechanism at all**: `flat()` is
`new THREE.MeshBasicMaterial({ map })` (`src/proto/crosstown.ts:92`) with no
`transparent` flag, and the probe read the built world back —
`transparent=false opacity=[1]` on both leaves. An opaque material cannot be
see-through. The hypothesis in the item ("the exterior leaf never reads that
declaration and is glazed at 0.55") is **disproved**: the exterior leaf never
consults `DoorLeaf` at all, it uses `jailLeafTex()` directly, and it does not
need to.

To answer the item's structural question directly: **a declaration in an
`int-*.ts` file *can* reach an exterior door** — `doorLeafFor(building)` is
exported from `ct/doors.ts` and reads the registry — but `ct/jail.ts` chooses
not to use it, deliberately and with the reasoning written out at
`jail.ts:185-215`: a `DoorLeaf` carries four adjectives, and panels, kick plate
and leaf count are what the eye reads. Both faces share `jailLeafTex()`, the
same memoised `THREE.Texture`. That is single-sourced, and it is not the defect.

## The fix

The whole door assembly moves forward by exactly one leaf thickness. Every part
is now derived from a named `LEAF_FRONT = DOOR_FACE - LEAF_T` instead of from
the stone plane behind it, so the meeting stile still stands 0.01 proud and the
handles 0.05 — the appearance is unchanged, only the depth. Clearance to the
facade is `RECESS - LEAF_T` = 0.46 m: still a recessed sally port, still
projecting nothing onto the pavement, so the 2 m walk is untouched.

**Derived, not retyped.** `LEAF_T` is the one new constant and the leaf box, the
stile and the handles all read it. Nothing in the fix copies a number that
another module owns.

## Proof

| | before | after |
|---|---|---|
| `scripts/probes/w59-jaildoor-zfight.mjs` | **FAIL**, exit 1, `Δfront 0.0000` on both leaves | **PASS**, exit 0, `Δfront 0.0900` |
| leaf density (§7b) | 20.3 px/m across, 21.1 up | unchanged |
| `node scripts/bugsweep.mjs` | — | **0 STATION MISS**, 0 COVERAGE, 96 shots, no console errors |
| `npm run typecheck` | — | clean |
| walked in and entered | — | **PASS** — walked 4.01 m on `W`, `[E]` prompt appeared, held `E`, landed in the interior |

The check was **red before the change and green after**, which is the only
version of that claim worth anything here.

Frames, all from the user's own approach at 13:00, identical camera positions
before and after: `shots/w59/{before,after}-d075-at-the-prompt.png`,
`-d220-arriving.png`, `-d500-on-the-walk.png`, `-d220-oblique.png`.

**My own verdict on the after-images:** the door now reads as one solid steel
double leaf from every one of the four positions. Panel borders are continuous
where they were broken and eaten before; the pull handles are visible at the
close approach for the first time; and at the oblique approach — the frame that
showed the fault worst — both leaves are fully present with no coursing running
through them. The two leaves match each other.

`fp`/`fpdiff` was **not** used and would not have been valid: nothing was added
or removed, but nothing needed the texture hash either, and the claim under test
is positional, which `fpdiff` reports positionally (BUILDER-BRIEF §10).

## Found and NOT fixed

1. **The jail's interior leaves stand OPEN while the street's pair is shut.**
   Measured from inside after walking in: two meshes at `x 998.80` and
   `x 1000.20`, `z 12.27`, each with a bounding box of `1.00 × 3.00 × 0.61`.
   That is not a thin slab — a 1.18 m leaf (the same width as the exterior pair)
   canted about 31° gives exactly that footprint. So from the street the sally
   port is closed and from the lobby it is open. **`ct/int-jail.ts` is not named
   by item 104, so I did not touch it** (BUILDER-BRIEF §9). It may well be
   deliberate; the desk should decide, and item 105 already landed on this file.

2. **I could not frame the interior face.** Two attempts to shoot it by warping
   to a guessed spot in the room came back flat blank — the camera was inside a
   wall. `scripts/aim.mjs` exists to prevent exactly that and this probe does not
   use it. **So the inside face of this door is unmeasured, not cleared.**

3. **`scripts/masonry.mjs` still cannot see this door.** The fault was two
   coplanar opaque faces, and nothing in the project checks for that — the
   density sweep only visits faces tagged `userData.masonry`, and a door leaf is
   not masonry. My probe covers the jail leaves only. A general
   "no two same-facing opaque faces at one depth" check would be a real
   instrument and does not exist; worth queueing, since this class is invisible
   in a screenshot until you happen to stand off-axis.

4. **The leaf's 0.09 m edge faces draw at ~267 px/m**, because one material is
   applied to all six faces of the box. I left it: those edges sit 0.01 m from
   the jamb and are covered by the meeting stile in the middle, so nothing can
   see them — the same reasoning the threshold below already carries in a
   comment. Noting it so nobody "finds" it later thinking it is live.

## Two instrument traps this item cost, both worth knowing

**The world culls by region, and a probe that does not stand near its subject
measures nothing.** My first run of the coplanarity check reported *"no jail
leaf found"* from the spawn point — the jail is not in the scene at all until
you are near it. A `MISS` there would have been read as "the door is fine".

**The first warp+screenshot after page load renders a 100% BLACK canvas** while
the DOM HUD paints normally, so the frame shows `[E] into the HOUSE OF
DETENTION` over nothing. This cost me a false *"my fix blacked out the door"* —
and the only reason I did not report it as one is that I stashed the fix,
rebuilt mainline, and reproduced the black frame **at a different x**, which
proved it was shot ORDER and not position. Both probes now throw the first frame
away. This is GOTCHAS 76 wearing a new hat.

**And a signature is a hypothesis too.** `24×64` is not a fingerprint for
`jailLeafTex` — `ct/int-bank.ts:583` paints a 24×64 arch, and the first cut of
the interior probe matched two of them **566 m away** and printed a confident
`PASS` about meshes in a different building. Selecting by `x > 400` "because
interiors live past 400" identifies nothing, since every interior does. Both
filters are now shape- and proximity-bound, with the trap written down.

## Files

- `src/proto/ct/jail.ts` — the fix (claimed by item 104)
- `scripts/probes/w59-jaildoor-zfight.mjs` — the standing check; red before, green after
- `scripts/probes/w59-jaildoor-shot.mjs` — before/after frames
- `scripts/probes/w59-jaildoor-walk.mjs` — walk in and enter
- `scripts/probes/w59-jail-inside-leaf.mjs` — the interior measurement above
- `scripts/probes/w59-jaildoor-dump.mjs`, `w59-jaildoor-sweep.mjs`,
  `w59-jail-blackframe.mjs` — the exploratory probes, kept because the notes
  above cite them

`ct/doors.ts` and `ct/interior.ts` were named by the item but **needed no
change** — the defect was entirely in `ct/jail.ts`.
