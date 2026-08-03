# w64 — the library PC is on its own CRT

Item 157. Ports used: **4201** (dev) and **4202** (built preview). Both proved
`000` before binding. 4187 was free and used for the first twenty minutes of
item 156 before the queue was rebuilt; it is shut down.

> *"i need the pc in the library to be like the atm too. intergrated overlay.
> realistic setup."*

## Did the framework hold up unchanged? YES — and this tenant is the cheapest yet

**`ct/hud.ts` and `crosstown.ts` are not touched.** The whole diff is
`ct/library-pc.ts`, three probes, and two lines of an existing check.

## The row's one open question, answered: item 150 does NOT bite

The row said *"`ct/hud.ts` THROWS on a multi-material mesh (item 150) — check
the PC's mesh first; if it bites, 150 is the real fix and this should wait."*

**Checked, in the running world, before writing anything**
(`scripts/probes/w64-pc-mesh.mjs`):

```
2 seat(s) labelled "sit at the computer"
SEAT at (1082.60, 5.05) yaw 1.571 h 0.475
 1.02 m PlaneGeometry size [0.3,0.24,0] at (1083.62, 0.94, 5.05) ryaw -1.5708
      mats 1  map 20x16  col #ffffff  graded false
```

**One material, on a real plane, already in the room.** `ct/int-library.ts:1121`
builds it as `new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24), new
THREE.MeshBasicMaterial({ map: screenTex(kind) }))`. So this item did not have to
wait for 150, and — unlike the slots — **this file builds no geometry at all**.
It paints on the CRT that is there and hands it straight back on close.

Two consequences worth having:

1. **`three` is a TYPE-ONLY import here.** `ct/slots.ts` needed a `Raycaster`
   and measured what a runtime edge cost: 1018 of 1458 textures re-hashed,
   because reordering the module graph shifts the `generateUUID` stream
   `scenedump.mjs` seeds (GOTCHAS 75). Nothing here needs a three *object* — a
   plane, a seat yaw and a dot product answer "is it in front of me and looking
   back at me" — so the search is arithmetic over `scene.traverse`.
2. **`fp` is therefore a valid proof for this change**, which it was not for w55.
   It is below.

## The canvas had to be re-cut, 320 x 220 → 320 x 256

w41 and w55 both say it in one line — *"your canvas should be cut to your mesh
face's aspect, or it will stretch"* — and 320/220 = 1.4545 against the glass's
0.30/0.24 = 1.25 is a **16% horizontal smear**.

320 x 256 over 0.30 x 0.24 m is **1066.7 px/m both ways**, square texels
(§7b). It is also the size `ct/slots.ts` (`FACE`) and `ct/blackjack.ts` (`FELT`)
already use, so the three frameless panels now share one face size.

**The 36 new rows are not padding.** At 320 x 220 the Minesweeper board ran to
`MS_Y0 26 + 9 x 22 = 223` on a **220-tall canvas** — the bottom row of squares
was drawn off the canvas entirely, on a board whose cursor could still be moved
onto it. `MS_Y0` is 34 now and the board ends at 232 inside 256; the probe
asserts it (`the bottom-right square ends at y 231 inside a 256-tall canvas`).

**The aspect is COPIED WITH A CITATION, not derived** (§8): the canvas size is a
module constant and the mesh is only resolved at open time, so it cannot be read
from the mesh. What *is* derived is the check — `faceAspect()` measures the live
glass on every open from its **local bounding box** (never
`geometry.parameters`, which lies wherever a rotation was baked in), warns on
the console if the two drift more than 2%, and publishes both through
`__librarypc.face()` so the probe fails on it. The clean fix is a shared export
of the CRT's size out of `int-library.ts`; that is a one-line follow-up in a
file this item does not name.

## What the mouse can do, and the one gap it exposed

Every rectangle is declared **once** (`CLOSE_BOX`, `iconRect`, `FIELD`,
`CLR_BTN`, `FLAG_BTN`, `NEW_BTN`, `msRectOf`) and read by the painter, by `hot`
and by `click` — w55's `DECK` lesson. Clicks route through the **same `onKey`**
the keyboard uses, so a click and a press cannot drift.

- **desktop** — click an icon to open it (`iconSel = i` then `'enter'`).
- **catalogue** — the Win95 **close box** returns to the desktop (`'tab'`); a
  **CLEAR** button empties the field (`'backspace'` held down, so it is the same
  code path the key uses, not a second way to empty it). The query itself is
  typed, which is what a search field is.
- **Minesweeper** — click a square to dig; **NEW** deals (`'r'`); **FLAG** is a
  pointer MODE.

**FLAG is the gap.** `ScreenSurface.click` carries no mouse button, so there is
no right-click to flag with. Same shape as w55's missing bill acceptor: the
affordance the mouse needs and the part the machine was missing are one object.
Worth a line in `ScreenSurface` if a fourth tenant wants it —
`click?: (x, y, button)` would be additive and break nobody.

## Framing: chosen by looking, at three settings

`w64-pc-look.mjs`, frames in `/tmp/w64-pc/{a,b,c}-*.png`:

| standoff / fov | verdict |
|---|---|
| 0.55 / 42 | glass at 52% of frame height and very readable — **and the frame is a monitor against a featureless brown field.** The keyboard falls 7° below the bottom edge and the bench's 0.46 m back panel is all there is behind. A picture of a screen, which is what this whole series exists to stop |
| 0.78 / 50 | desk, keyboard, mouse mat, stair and wall all in shot — and 6 px type down to ~5 screen px. A catalogue you cannot read is not a catalogue |
| **0.68 / 46** | **shipped.** Glass ~42% of frame height, the CRT's own beige case around it, and the keyboard, mouse and desk edge enter the bottom of the frame at −30° against a −32° bottom edge |

The eye lands at **(1082.94, 1.05)** looking **9° down** — measured off the live
camera, not predicted. `crosstown.ts` clamps the eye to 1.05 m and this face's
centre is at 0.94, so the pose comes out as a head at a monitor on its own.

The comparison with the other tenants is a comparison of **object sizes**: the
glass is 0.24 m tall where a slot cabinet's face is 0.91, so the slots' 1.15/58
here would read as a postage stamp across a room.

## How it was proved

All on the **built bundle** (`vite preview`, 4202) as well as dev.

| | |
|---|---|
| `scripts/probes/w64-pc-walk.mjs` | **36/36** — a whole sitting by real page clicks onto the CRT: icons, close box, CLEAR, FLAG, NEW, digging squares; both cursors; **typing `frankenstein` and `emma` through the page with every `e` landing**; ESC from the catalogue; `[E]` from the desktop and from Minesweeper; fov handed back (88°); **feet walk 1.42 m after leaving** |
| `scripts/w2-library-pc.mjs all` | all pass — the catalogue, Minesweeper, and the seat join |
| `scripts/K-no-panel-traps.mjs` | all good — every panel in the world still closes |
| `scripts/w10-caption-double.mjs` | ALL OK — no caption/prompt overlap |
| `scripts/probes/w58-e-closes-machines.mjs` | all six library legs pass, incl. the letter `e`; 1 pre-existing ATM failure, below |
| `node scripts/bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, no new console errors |
| `node scripts/health.mjs` | WORLD OK, exit 0 |
| `npm test` | 17/17 · `npx tsc --noEmit` clean |
| `npm run fp` before/after | **textures IDENTICAL · structure IDENTICAL · tints IDENTICAL**, places 2 of 8422 differ and both have a partner within 5 cm — pigeons, the noise floor |

`objects=8422 uniqueTextures=1473` on both sides. The "before" was taken by
checking out mainline's `ct/library-pc.ts`, rebuilding and re-dumping against the
same preview, so it is the same world with one file swapped.

## My own verdict on the after-images

`/tmp/w64-ship/ship-{1,2,3}-*.png`, built bundle.

**Before:** a 320 x 220 rectangle in the middle of a dimmed room. It is a dialog
box; the user is right that it is not integrated.

**After:** it reads as sitting at a computer. The catalogue frame is the one I
would show him first — a `CARD CATALOG.EXE` window with its blue title bar and
close box on the beige CRT, `Twenty Thousand Leagues Under the Sea · Jules Verne
· 1870` legible on the glass, the keyboard and mouse in the bottom of the frame,
the desk, the stair and the wall behind, and the room undimmed.

Honest reservations, neither worth another round on its own:

1. **The upper half of the frame is a flat brown field** — the bench's own
   0.46 m back panel (`int-library.ts`), seen from 0.68 m. It is a real object
   correctly drawn; it is just featureless.
2. **The caption prints over the keyboard.** w41 filed *"a diegetic panel still
   cannot nominate where its caption goes"* and w55 filed it again; it is still
   true, and this is the third machine to work around it.

## Found and NOT fixed — for the desk to queue

1. **YOU CANNOT SIT AT THE PC. You sit at the amber terminal, or the dead one.**
   This is the biggest thing I found and it is one line in a file this item does
   not name. `ct/int-library.ts` stands three machines on the bank — `'pc'`
   (beige Windows box, blue catalogue screen), `'amber'` (a 1989 serial
   terminal) and `'dead'` (switched off) — and then sets
   `TERM_TAKEN_Z = BZ0 + 0.55`, which is **the `'pc'`**, so the chair loop skips
   registering a seat there (`:1274`). The only two seats carrying
   `'sit at the computer'` are the **amber** one and the **dead** one.

   So today, sitting down paints a Windows 95 teal desktop onto a serial
   terminal's amber glass, or wakes a screen the room describes as switched off.
   **That is the "one object that does not agree with itself" class the user has
   now caught on the bank door, the ATM palette, the ATM fascia and the slot
   faces.** The fix is to move the sitter off the PC — putting them at the
   *amber* machine is also the better joke, since a person parked at the oldest
   box is exactly who would be there. `ct/int-library.ts`, one constant.

2. **`ScreenSurface.click` carries no mouse button**, so no diegetic screen in
   the world can tell a left click from a right one. Worked around here with a
   FLAG mode. Additive fix, `ct/hud.ts`.

3. **`scripts/w8-frameless-panels.mjs` has two OTHER stale expectations, both
   pre-existing and neither mine.** My whole diff is `ct/library-pc.ts`, three
   new probe files and this check's own two library-PC lines, so it cannot have
   caused either:
   - `ATM canvas is exactly its own 300x214 … got {"w":300,"h":205}` —
     `ct/atm.ts:263` reads `const W = 300, H = 205`.
   - `ct-slots canvas is exactly its own 320x256 … got {"w":320,"h":483}` —
     `ct/slots.ts:855` reads `export const FACE = { w: 320, h: 483 }`, which w55
     re-cut deliberately and documented.

   I did **not** update either: I have evidence the world is right for the
   slots (w55's note) but none for the ATM, and quietly re-typing a check's
   expected value to whatever the source currently says is how a guard stops
   guarding (§7). Both are one-line updates for whoever holds those files.

4. **`scripts/probes/w58-e-closes-machines.mjs` is red on one leg**:
   `ATM: could not reach the card screen (landed on thanks)`. Stale after
   mainline `db4f31e5c` — *"ATM: one TAKE CARD press, not two"*. Same family as
   w55's finding 4 about `K-atm-walk.mjs`. All six library-terminal legs pass.

5. **The desktop is very empty at 5:4** — two icons in a large teal field. Left
   alone deliberately: this item is the surface, not new apps, and a branch
   terminal that runs two things is period-true. Say so if he disagrees.

## Derived or copied

- **Derived:** the mesh (found from the seat's own pose by dot products, no
  coordinate typed); the face's aspect at open time (local bounding box); the
  eye pose (`crosstown.ts` off the face's own normal); every hit rect from the
  same constants the painter draws with.
- **Copied, with a citation:** the canvas aspect 5:4, from
  `ct/int-library.ts:1122`'s `PlaneGeometry(0.30, 0.24)`. It cannot be imported
  without editing that file. A runtime check guards the copy and
  `__librarypc.face()` publishes it; a follow-up to hoist the CRT size as a
  shared export would remove it. (§8.)
