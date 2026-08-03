# Item 155 — the mail is diegetic. DONE.

**Worker eightynine, 2026-08-03.** Port **4450** (`ss -ltn` clean before binding,
`--strictPort`). Verified on the **built bundle**, build `632a71833`.

Picks up `notes/eightyeight-item155-scoping.md`, which scoped this and released
it un-actioned. **That note was right about essentially everything** and is why
this took one pass — the floor-gate trap, the `SHEET` aspect, the `standoff`,
the degrade-not-fail argument. Where I diverged from it is noted below.

---

## What the user asked, and what "the same sort of thing" actually transfers

*"can we apply the same sort of thing we applied to the atm and apply it to the
mail?"* (2026-08-02, `FEATURE-REQUESTS.md:2857`).

`FEATURE-REQUESTS.md`'s own note on that line flags the problem: **the mail is
not a screen.** Reading mail is holding a letter, not operating a machine.

The transferable part of the ATM ask was never *"paint it on a machine"* — his
words there were *"i want when i hit e here to adjust my position and
perspective and lock it to be looking at the atm and for the screen on the
literal atm be the overlay."* The general form is **lock me in place and put the
interface in the world instead of over my face.** For a letter that means a
sheet of paper at reading distance, which is what this builds.

`ct/tenancy.ts:592` has called its own section *"the letter, held open in front
of you"* since the day it was written, and `ct/hud.ts:459` defines `UI.cloth` as
*"for the panels you HOLD rather than stand at"*. **The intended design was
written down in two places and nothing had made it literal.**

## What changed — `src/proto/ct/tenancy.ts` only

No mechanism was built. The framework already does all of it; this file only
names a mesh. Three edits:

| where | what |
|---|---|
| `:634` | `let sheet: THREE.Mesh \| null` — module state, because `buildPanel()` is module-level and the mesh needs the bank's *measured* face from `register()`. This is exactly the indirection `ScreenSurface.mesh()` is shaped for |
| `:~745` | `surface: { mesh, standoff: 0.42, fov: 55, hot, click }` + `onOpen`/`onClose` on the existing `makePanel` spec |
| `:~900` | the sheet mesh, built in `register()` from `faceX` and `me` |

**The panel's `draw`, `wheel`, `key` and `hint` are untouched.** The existing
page-turn keeps working through the surface with no change, which is w41's own
promise and it held.

### The numbers, and where each came from

- **`standoff: 0.42`** — derived from the intent, not the default. The
  framework's `0.55` is a stand-off for a *machine you step up to*; 0.42 m is
  arm's length. Measured back at runtime: the eye settles **0.420 m** off the
  paper.
- **`fov: 55`** against the world's `FOV_REST = 88` — the eye narrowing onto a
  page. Measured: **88 → 55**.
- **plane 0.28 m wide, height DERIVED** as `0.28 * SHEET.h / SHEET.w`. `SHEET`
  is `{w:192, h:178}` (`:616`), so any other ratio stretches the landlord's
  typewriter. Probe asserts the aspect to 0.005: **1.0787 vs 1.0787**.
- **`rotateZ(0.035)`** — 2° of roll. The first frame read as *a poster somebody
  hung*, not *paper somebody is holding*; this is the whole difference and it
  is visible in `shots/w89-mail-first-open.png` vs `shots/w89-mail-roll-open.png`.
  It is `rotateZ`, about the object's **local** z, which after `rotation.y =
  -π/2` **is the face normal** — so it rolls the page in its own plane and
  cannot move where `poseFor` puts the eye. Setting `rotation.z` instead would
  compose through the Euler order and tilt the face itself.
- **position `(faceX - 0.34, me.y + 0.09, me.z)`** — derived from the bank this
  file already measures, so C moving the boxes moves the paper. Held a little
  *above* the door it came out of so the open box and the post still riding in
  it stay visible under the page.

### The one thing the scoping note left open that mattered

It proposed `onOpen: () => { sheet.visible = true }` unconditionally. **That is
wrong in a world with no focus controller** — the prototype harnesses register
none, `ct/hud.ts:1071` falls back to the screen-space cabinet, and an
unconditional `onOpen` would leave a **blank white sheet hanging in the lobby
behind it**. Gated on `screenFocusReady()`, which is the *exact* predicate
`:1071` decides diegetic-or-not by, so the fallback stays clean.

---

## ⚠ ITEM 150 DOES NOT BLOCK THIS ITEM. The queue says it does.

Item 150: *"`ct/hud.ts` reads `mesh.material` as a single material… **This
blocks 155 and 157** — both hang a panel on an existing mesh that may well be
multi-material."*

**The premise is wrong for 155, and the fix does not depend on 150 at all.** A
letter's surface is not an existing mesh — it is a new sheet, and it carries one
`MeshBasicMaterial` by construction. The probe asserts `!Array.isArray(material)`
so the assumption cannot rot.

**But the danger 150 names is real, and it is one mesh away.** Measured:

- `ct/apartment.ts:1534` — the mailbox **bank carcass** is
  `new THREE.Mesh(BoxGeometry, [mailFrame, texM(mailT), mailFrame, ×4])`, a
  **six-element material array**. Anyone who "obviously" hangs the letter on the
  bank hits 150 head-on.
- `ct/tenancy.ts:761` — the 301 **door** is single-material (`brass`), so that
  one would have been safe.

**And the throw is worse than the row says.** `ct/hud.ts:1091`
(`savedColor = mat.color.getHex()`) is **not inside a try**, and it runs *after*
`gateUp(true)` at `:1066`. So a multi-material surface does not degrade to a
screen-space panel — it **freezes the world with no panel up**. `gate()` at
`:747` has a desync escape for exactly this, so ESC still tears it down, but the
row should say "freezes, recoverable only by ESC", not "throws". **Item 150 is
still worth doing; it is just not a blocker for 155.**

---

## How it was proved

`scripts/probes/w89-mail-diegetic.mjs` (new, committed). **30 checks, 5 runs,
30/30 every time, 0 console errors.** Plus a 6th run at `CLOCK_H=22`.

It reads the world, not the DOM's opinion of it: the sheet's own `visible`,
`material.map` and `material.color`, the camera's `fov` and position from
`__ct.camera()`, and the panel canvas's `display`.

What it establishes, beyond the obvious:

- **the eye actually moves onto the page** — 0.181 m, fov 88 → 55, settling
  0.420 m off the paper along its normal
- **the page turns *in the world*** — the wheel changes the canvas the mesh is
  wearing (18662 → 11490 bytes of PNG). Screenshots at
  `shots/w89-mail-*-open.png` / `-page2.png` show "1 of 3" → "2 of 3"
- **Escape closes from a *turned* page**, restores the mesh's own face, the fov
  and the feet (BUILDER-BRIEF §11)
- **`[E]` closes it too**, and stands the player back up
- **you can walk away afterwards — walked, 0.38 m.** "The panel closed" is not
  the same claim as "the feet work again": the focus controller *seats* the rig
  to freeze it, so a close that failed to unseat would read as closed and still
  be a trap
- **a self-test that the readings are not constants** — visibility, canvas
  `display` and fov are each observed taking *both* values in one run. Three of
  this project's false verdicts came from probes reasoning off a constant

### Two reds on the first run were BOTH my probe, not the world

Worth recording because loosening either assertion would have hidden a real
regression later:

- **fov read 57.45, not 55.** `crosstown.ts:1130` eases the eye in over
  `FOCUS_IN = 0.40 s`; 14 frames after the press catches it *mid-flight*.
- **the panel would not reopen.** `ct/hud.ts:1028` refuses to reopen within
  `DISMISS_LOCKOUT = 500 ms` of closing — by design.

Fixed by *waiting*, not by widening the checks.

### One correction to the existing probe's method

`probes/w88-mail-shot.mjs:41-45` stands the player at `spot.x + 0.8`. The hall
is at **−x** from the face, so that is `faceX + 0.18` — **inside the bank
carcass**. It did not matter when the panel was screen-space (the frame is the
panel), and it matters a lot now the camera locks to a mesh. I did not edit that
file — it is not named by this item. **`w89` warps to the spot exactly and
derives its yaw from the sheet's own position.**

---

## What I found and did NOT fix

1. **Item 150's row text is wrong in two ways** — it does not block 155 (above),
   and the failure is a *frozen world*, not a graceful throw. Worth re-wording
   before someone takes it.
2. **`probes/w88-mail-shot.mjs` stands inside the bank** (above). One line, not
   my item.
3. **The spot's `obj: door` still outlines the mailbox door while the letter is
   up.** The scoping note raised this and I left it: the selection outline is
   drawn for the thing you would press `[E]` on, and `[E]` while reading means
   *leave*, so pointing at the door is arguably right. **Not measured either
   way — if the desk wants a verdict, it needs a look, not a grep.**
4. **The bank fills the frame while reading, and that is inherent.** At the
   1100×680 viewport the horizontal fov works out to ~80°, so at 0.90 m from the
   wall you see ~1.51 m of it — and the bank *is* 1.5 m wide. You cannot get the
   lobby into shot without standing far enough back that it stops being a held
   letter. I judged the close read correct; **it is a taste call and the user
   may disagree**, and the two numbers to turn are `SHEET_W` and `standoff`.

## Inherited reds, untouched by this

`npm run sweep`: **0 STATION MISS, 0 COVERAGE, no console errors.** The
`[interior:hotel] NO BUILDING NAME` warning and the THREE.Clock/Canvas2D/WebGL
warnings are all pre-existing and were there before this change.
`node scripts/health.mjs`: **WORLD OK**, exit 0, on build `632a71833`.
`npx tsc --noEmit`: clean.
