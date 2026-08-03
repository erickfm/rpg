# Item 185 — the loan application is on the paper now

Worker sixtysix. Port **4220** (proved `000` before binding). Measured against
the built bundle at `vite preview`, not only at dev.

> *"the load [loan] application process should also be like atm and whatnot. you
> sit and its the loan process as an integrated overlay."*

---

## The decision this reverses, and the note the desk asked for

`ct/int-bank.ts`'s own block comment says the loan was built as three `[E]`s in
the room *"rather than as a screen over it, because every other verb in this
world is an `[E]` on an object you can walk up to and this one should not be the
exception."*

**That reasoning was good and it is now overruled by request.** The comment is
left standing rather than deleted, because the half of it that explains WINDOW 2
is still true and still the design: the officer approves, the teller counts it
out, and the two halves of the room stay one system. A pointer to this note sits
at the reversal so nobody reads a comment that contradicts the code and assumes
the code is the mistake.

**Scope read the same way the row reads it**, and I agree with it: acts (1) and
(2) — read the form, hand it over — go onto the sheet; act (3), collecting and
repaying at Window 2, stays in the room. Collapsing the bank into one panel
would throw away the only reason the counter has a job.

---

## The whole change is one field and the shape of a canvas

**`ct/hud.ts` and `crosstown.ts` are not touched.** Hanging the picture on a
mesh, easing the eye onto it, locking the look, freezing the feet, raycasting
the pointer back into canvas pixels, the Win98 hand, ESC always closing, giving
the fov and the feet back, putting the paper's own face back — every one of
those is w41's, called. w55 reported the same and it held a third time.

**And the mesh was already in the room, which is the nice part.** w41 had to find
somebody else's plane; w55 had to build one, because a slot cabinet is a
six-material box and `ct/hud.ts:1091` still calls `.color.getHex()` on
`mesh.material` — item 150, still open, still a throw. This room already draws
**THE APPLICATION FORM** as a single-material `PlaneGeometry(0.30, 0.40)` lying
face up on the blotter. So the overlay is not a screen standing in for the
paper: **it is the paper.**

**The canvas is cut to that plane's own face, from its own geometry.**
`300 × 400` at **1000 px/m both ways** — square texels, BUILDER-BRIEF §7b stated
for a canvas. The width is unchanged from the screen-space sheet, so every
horizontal measurement was already tuned; only the vertical spacing is re-cut,
and re-*spaced* rather than scaled (w55's rule).

**The amount became a row of five tick boxes.** It was a caret row that `W`/`S`
walked. That is fine for a keyboard and nothing at all for a pointer — the same
gap w41 found on the ATM (no clickable PIN pad) and w55 found on the slots (no
bill acceptor). Both times the answer was that the affordance the mouse needs
and the part the object was missing are the same object, and a 1997 loan
application asks you to tick the amount you want. Declared once and read by both
the painter and the hit test, so a box cannot be drawn where a click does not
land.

**The two acts survive.** The row asks that the spirit of the aim rule —
*"you read the form, then you look up and hand it over"* — be kept. It is: you
tick, and then you travel to the foot of the sheet and **SIGN & HAND IT OVER**.
Signing moves no money; the teller still counts it out.

**The keyboard is untouched**, which is w41's promise to its tenants. `W`/`S`,
the arrows, `ENTER` and the wheel all do what they did — they now go through
`setAmount`, the one function the tick boxes call, so a pointer and a keyboard
cannot drift.

---

## THE FINDING THAT COST THE MOST, and it is new to this tenant

**A diegetic panel on a HORIZONTAL surface raises the player's own wristwatch
over its bottom edge.**

`crosstown.ts:1352 poseFor` puts the eye a standoff along the face's own normal.
This face's normal points at the ceiling — it is a sheet of paper on a desk — so
the pose looks **straight down**, which that file explicitly anticipates
(`flat.lengthSq() < 1e-6` → *"a screen facing straight up"*). And
`crosstown.ts:1891` is `hud.watch(rig.pitch < -0.95, …)`: **checking the time in
this world is looking steeply down.** So the pose that makes the form readable
is the same pose that lifts a wristwatch across it.

Every earlier tenant is a vertical screen and none of them can hit this. My first
draft put SIGN at canvas y 306–352 and **the button was behind a wristwatch** —
photographed, not deduced (`/tmp/w66-loan-2-open.png`, first version).

Fixed here, not in the framework: every LIVE band ends by canvas y 300, the
standoff went 0.55 → 0.60 for margin, and the decorative footer takes the
occlusion. Which turns out to be right rather than merely tolerable — **the part
now behind your wrist is the signature line**, and your wrist is where a hand
signing a form would be.

**Derived, not retyped:** the eye lands at y 1.354 over a form at 0.754, exactly
`0.754 + 0.60`, so the 1.05–1.75 m clamp is not biting and the standoff is still
doing what it says. Measured, not assumed.

---

## How it was proved

| | |
|---|---|
| `scripts/probes/w66-loan-mouse.mjs` | **15/15** — a whole application by REAL PAGE CLICKS onto the mesh: three tick boxes each becoming the only one ticked, SIGN stamping the sheet green, the sheet staying up so you read your answer on the paper you signed, ESC standing you up, the feet moving, and `[E]` closing it too |
| `scripts/probes/w66-loan-look.mjs` | the pose and the frame — `canvasHidden: true` (it really is diegetic, not the silent degrade), eye 1.354, fov 45, seated, 0 console errors |
| `M-bank-int-walk` (existing, 54 claims) | **ok**, 36 s — the room, the vault, and the loan mechanic end to end |
| `K-atm-walk` (existing) | **ok** — the money is the same money; the ATM still agrees |
| `K-no-panel-traps` (existing) | **ok** — every panel in the world still lets go of the player |
| `npx tsc --noEmit` | clean |

**A page click, not a call to `click()`.** Calling the hit test proves my
rectangles; clicking a page coordinate proves the raycast, the camera, the uv
mapping and my rectangles *together*, which is the chain that actually breaks.
The probe projects a canvas pixel through the live camera by hand (the world
publishes `scene` and `camera` but not three), and **waits for the camera to
stop moving first** — w55 lost an hour to a probe that projected through one
frame and clicked through another, and its earlier passes were luck of timing.

**Both of this probe's own reds were the instrument, at BUILDER-BRIEF §7's rate.**

1. `Math.abs(undefined - 0.30) > 1e-6` is `NaN > 1e-6`, which is **false** — so
   every geometry with no `width` sailed through the sheet filter, the first was
   adopted, and the probe reported *"could not project"* six times about a mesh
   it had found and discarded. The world was never wrong.
2. *"the feet do not move"* — you stand up from this panel **facing the desk**,
   because the pose was derived looking down at a form lying on it, so `W` alone
   walks into a collider and reads 0.00 m on a player who is entirely free. It
   tries all four directions now and gets 1.55 m. w55 hit this exact thing on the
   slot stools and its note is right that a believable number is worse than a zero.

---

## My own verdict on the after-images

`/tmp/w66-mouse-3-signed.png`, and it is the one I would show him.

**Before:** a 300 × 214 rectangle floating over a dimmed room. It is a dialog box.

**After:** you are leaning over a form on a banker's desk. The letterhead, the
tick boxes, the terms with their dotted leaders, the security-against-cash
comparison and a green **APPROVED · COLLECT AT WINDOW 2** stamped across the
middle are on the actual sheet of paper, at its own angle, with the desk's veneer
and the pen on its bead chain either side of it and your own wrist at the foot of
the page. The world behind is not dimmed.

**Honest reservations.** Two, neither worth another round on its own:

- A dark object at the top of the frame clips the corner of `FIRST FEDERAL` in
  the letterhead. It is something already standing on or over the desk, between
  a straight-down eye and the paper — pre-existing furniture, not drawn by me.
- Once stamped, the band where SIGN was is empty, so a signed sheet has more
  white space than an unsigned one.

---

## Found and NOT fixed — for the desk to queue

1. **`hud.watch` should stand down while a panel is up.** The cause above is one
   line in `crosstown.ts:1891` — `rig.pitch < -0.95` — and a diegetic panel is
   the one case where looking down is not the player asking for the time. I
   designed around it because `crosstown.ts` is desk-owned and outside this
   item's named file, but the next horizontal surface will have the same
   conversation, and it will present as "the button does not work".
2. **`ct/hud.ts` still throws on a multi-material mesh** (item 150, filed by w55,
   still open at `hud.ts:1091`). This tenant dodged it by luck — the form happens
   to be a single-material plane. The fourth and fifth tenants will not all be
   lucky.
3. **A diegetic panel still cannot nominate where its caption goes** — w41 filed
   it, w55 re-filed it, and it is still true. Here the caption lands across the
   wristwatch, which is legible but is text over a watch face.
4. **Sitting in the client chair still opens nothing.** `ctx.seat` has no
   `onSit`, so the chair and the application are two separate acts: pressing
   `[E]` on the form or the officer seats you at the sheet (the framework's own
   `rig.sit`), and sitting in the chair by itself gets you a chair. w55 asked the
   desk for `onSit`/`onStand` and it has not landed; `ct/slots.ts` works around it
   by polling `__ct.seated()` for its seat label. **I did not add a second copy of
   that poll**, because a room that opens a panel from two unrelated mechanisms is
   how they drift. One field on `ctx.seat` closes it for both rooms at once, and
   that is `crosstown.ts`.
5. **A fresh worktree cannot run several checks at all** — `shots/` is gitignored
   and absent, and `writeFileSync('shots/…')` throws ENOENT *after* the verdict
   prints, so a green world exits 1 with a stack trace. Also filed under item 161.
