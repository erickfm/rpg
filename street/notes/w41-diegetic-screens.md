# w41 — the diegetic screen framework, and the ATM as its first tenant

Item 86. Port used: **4187** (dev) and **4199** (built preview). 4186, 4188,
4191, 4196 were all already serving somebody else's world — check, don't assume.

> *"this doesnt look integrated. i want when i hit e here to adjust my position
> and perspective and lock it to be looking at the atm and for the screen on the
> literal atm be the overlay that i can use my mouse to click through. the mouse
> cursor should be like a lil hand almost like win98 cursor"*

## What changed, and the design in one line

**A panel is now allowed to be painted onto a mesh instead of over the camera,**
and the ATM is the first machine to say so — one field, `surface`, on the
`PanelSpec` it already had.

- `ct/hud.ts` — `ScreenSurface` + `ScreenFocus` + `surface` on `PanelSpec`. The
  panel's own canvas becomes a `CanvasTexture` on the named mesh, the gate reads
  mousemove/mousedown on their way past and raycasts them onto it, and a
  pixel-drawn Win98 arrow/hand replaces the OS cursor while it is up.
- `crosstown.ts` — implements the focus controller, because it owns the camera,
  the rig and the frame loop, none of which `hud.ts` can see. Registered into
  the HUD rather than imported by it: every module already imports the HUD.
- `ct/atm.ts` — names its mesh, hit-tests its own buttons, gains a clickable PIN
  pad. It draws what it always drew, re-cut to the face it is now on.

**`ct/bank.ts` is not touched, not imported, and none of its numbers are
copied.** The pose is derived from the mesh's own world normal, and the mesh is
found by the `userData.atmPart` tag bank.ts already writes.

## The item's stated cause was wrong in one place

The row said *"`ct/atm.ts` already draws a real raked screen on the machine in
the world"*. It does not — `ct/atm.ts` only ever drew a DOM panel. The raked
screen is `ct/bank.ts`'s `atmNiche`/`atmPanelTex`, a file the item does not
name. That mattered: it is the difference between "re-point an existing texture"
and "find someone else's mesh without editing their file". The rest of the row's
measurement (DOM panel framework, no raycasting, no seat on the ATM) was right.

## Three bugs found on the way, all mine except one

1. **`cam.fov` had two owners.** The lock set 60° and `crosstown.ts`'s own
   scroll-zoom smoother dragged it back toward the resting 88° every frame; they
   met at a stable 66° that read as an ease that had not finished. The lock wins
   while it is on and hands the fov back on `leave`.
2. **`main.ts:30` re-takes pointer lock on the canvas's `click` event**, and
   `BLOCKED` only listed `mousedown`. So the button press was blocked and the
   click sailed past and grabbed the pointer anyway — and **a locked pointer
   stops reporting `clientX/clientY`**, so the first click on a machine froze the
   cursor and every click after it missed. It presented as "ENTER is broken".
   `click` is in `BLOCKED` now. I had assumed rather than read the source
   (§7); a hot-band sweep proved the hit-test was already perfect, and watching
   `document.pointerLockElement` flip on exactly the click that broke it gave
   the real cause.
3. **The canvas background rendered black on the mesh.** An untouched canvas is
   `rgba(0,0,0,0)` and a `MeshBasicMaterial` with no `transparent` flag shows
   that as flat black. Fine floating over a page, wrong on an object.

## My own verdict on the after-images

`/tmp/w41-atm-open-final.png` (built bundle), against
`/tmp/w41-atm-open-before.png`.

Before: a big flat screen-space rectangle over a dimmed world — the user is
completely right, it reads as a dialog box and nothing else.

After: it reads as a machine you are standing at. You can see the cut niche with
its lit head and shadowed jamb, the gunmetal fascia, the tube in perspective
with the rake, the **real** 12-key pad below it and the cash mouth's lip under
that. The world behind is not dimmed. The PIN pad shot
(`/tmp/w41-pad-debug.png`) is the one I would show him first — a phosphor
keypad on the tube, in the cabinet's own green.

Honest reservations: the fascia is a touch dark and busy at the corners where
the tube's bezel meets the body, and `click a button, or press its number ·
ESC` sits over the physical keypad — legible, but it is text on a machine.
Neither is worth another round on its own.

Cursors: `/tmp/w41-cursors.png`, rendered at 10x on Win98 grey and on the ATM's
own bezel colour. The arrow is the classic pointer exactly; the hand reads
unmistakably as the Win98 link hand and holds up on both grounds.

## Found and NOT fixed — for the desk to queue

1. **The fascia re-arranges when you step up to it.** Unfocused, bank.ts's baked
   texture shows `[ CRT | card slot down the right edge ]`. Focused, my live
   canvas shows `[ 4 soft keys | CRT | 4 soft keys ]` and no card slot. So the
   machine's face visibly changes layout on `[E]`. The fix is in **`ct/bank.ts`**
   (not my item): draw the two soft-key columns into the idle screen texture, and
   I will put the card slot back into the live one to match. This is the same
   "one object that does not agree with itself" fault the user caught on the bank
   door and on the ATM palette, so he will probably spot it.
2. **The real 12-key pad in 3-D is not clickable**, which is why the PIN pad is
   drawn on the tube instead. Its layout is literals inside a closure in
   `ct/bank.ts`; hit-testing it would need those rects exported, or each key as
   its own tagged mesh. Would be the prettier answer and would let the on-screen
   pad go away.
3. **The ATM palette duplication cannot be fixed the way `bank.ts` suggests.**
   A hoisted `ATM_PALETTE` (bank.ts:62) and invited `ct/atm.ts` to import it —
   but `ct/bank.ts:8` already imports `openAtm` from `./atm`, so that closes an
   import cycle, and **GOTCHAS §28 is that a module in a cycle can be silently
   dropped from the BUILT BUNDLE ONLY**. Dev would look perfect and the ATM would
   not exist in the artifact. The real fix is a third module neither file
   imports. I corrected the now-misleading comment in `ct/atm.ts` and left the
   twelve literals, verified identical value-for-value.
4. `hint()` text sits over the physical keypad; a diegetic panel might want to
   nominate where its caption goes.

## For item 100 (slots) and whoever takes it

The seam is `PanelSpec.surface` and it is deliberately shaped for you:

```ts
surface: {
  mesh: () => THREE.Object3D | null,   // resolved per open; null = old panel
  standoff?: number,                   // metres off the face, default 0.55
  fov?: number,                        // default 60
  hot?: (x, y) => boolean,             // canvas pixels — YOUR layout
  click?: (x, y) => void,              // canvas pixels — YOUR layout
}
```

- **`hot`/`click` are in your canvas's own pixels**, the same coordinates you
  drew in. `BET ONE`/`MAX BET`/`SPIN`/`CASH OUT` answer for themselves; you do
  not register rectangles with the framework and the framework never learns your
  layout. This is the point of the seam.
- **Your keyboard path is untouched.** `PanelSpec.key` still works exactly as it
  did, so SPACE/B/M/I/C keep working. Route clicks *through* your key handler
  the way `ct/atm.ts` does — one dispatch, so a click and a press cannot drift.
- **You get Escape, the freeze, one-at-a-time and `release` for free**, because a
  diegetic panel is the same `makePanel` with one extra field. Do not reimplement
  any of it.
- Your canvas should be cut to your mesh face's aspect, or it will stretch.
- If you find yourself writing new mechanism, hand it back — that means the seam
  is wrong, not that you should build a second copy.

## How it was proved

All on the **built bundle** as well as dev.

| | |
|---|---|
| `scripts/probes/w41-focus-walk.mjs` | 17/17 — walked in on `W`, pose square to the glass, look locked, feet frozen, Escape gives movement and mouse-look back, machine's own face restored |
| `scripts/probes/w41-mouse-walk.mjs` | 17/17 — a whole session (card, PIN, balance, $40, conservation) by **real page clicks onto the mesh**, plus both cursors |
| `scripts/probes/w41-escape-every-screen.mjs` | 11/11 — **all ten screens**, each proving panel down + unseated + fov released + cursor released + **feet actually move** |
| `scripts/K-atm-walk.mjs` (existing) | 28/28 — the keyboard machine is untouched |
| `npm run fpdiff` | textures, structure, tints **IDENTICAL**; 3 pigeons drifted — noise floor |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |
| `node scripts/health.mjs` | WORLD OK, exit 0 |

`w41-pad-debug.mjs`, `w41-hot-scan.mjs`, `w41-screen-mesh.mjs` and
`w41-cursor-look.mjs` are the one-shot measurements behind the findings above,
in `scripts/probes/` per §7a.

**Derived, not retyped:** the pose comes from the mesh's world normal; the mesh
from bank.ts's own `userData` tag; `SIT_EYE` is imported from `fp.ts`; the eye
height at entry is read off the live camera. The only copied values in this work
are the twelve palette literals that were already there, and finding 3 explains
why they must stay for now.
