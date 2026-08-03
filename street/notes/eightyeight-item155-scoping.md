# Item 155 — the diegetic mail: scoping only, NOT started

**Worker eightyeight, 2026-08-03.** Port **4440**. I claimed 155, measured the
current world, resolved the design question the row leaves open, and **released
it with `claim.sh --release 155`** rather than half-build a modal. **No file in
`src/` was changed for this item.** Everything below is measured, not assumed.

---

## 1. The design question IS the item, and `FEATURE-REQUESTS.md:2858` already flagged it

The user, 2026-08-02: *"can we apply the same sort of thing we applied to the atm
and apply it to the mail?"*

The request log's own note on that line says: **"But the mail is NOT a screen —
reading mail is holding a letter, not operating a machine. That is a design
question, not a port."** That is right, and it is why this row is not the
mechanical port the queue text ("call the framework, do not rebuild it") makes it
sound.

**My reading, and I think it is the one that survives contact with his words.**
What he asked for at the ATM was: *"i want when i hit e here to adjust my
position and perspective and lock it to be looking at the atm and for the screen
on the literal atm be the overlay"*. The transferable part is **not** "paint it
on a machine" — it is **lock me in place and put the interface in the world
instead of over my face.** For mail that means the letter becomes **a sheet of
paper held up in the world**, focus-locked, not a rectangle floating over a
dimmed frame.

`ct/tenancy.ts:594` already calls its own section **"the letter, held open in
front of you"**, and `ct/hud.ts:459` already defines `UI.cloth` as *"canvas duck,
for the panels you HOLD rather than stand at"*. **The intended design is written
down in two places; nothing has made it literal.**

## 2. What the world does today — photographed

`shots/w88-mail-before-open.png` (built bundle, `probes/w88-mail-shot.mjs`).

It is **a screen-space rectangle floating in a black void** — the letter reads
correctly (V. OKONKWO, rent $45.00 due in 2 days, `1 of 3 scroll to turn`) but it
is exactly the "dialog box" the user objected to at the ATM. The lobby behind it
is near-black, which makes the floating panel worse, not better.

`ct/tenancy.ts:711` — the panel is `makePanel({ id: 'ct-letter', w: SHEET.w,
h: SHEET.h, chrome: 'none', … })` with **no `surface` field at all**. A previous
builder already did the cheap half of this (frameless, no title, the paper drawn
edge to edge). The remaining half is the surface.

## 3. ⚠ THE TRAP THAT WILL COST YOU 20 MINUTES: the mailbox spot is on a FLOOR GATE

`ct/tenancy.ts:875`:

```ts
ok: () => ctx.player.gy() < 0.5 && ctx.player.x() > 100,
```

**`groundAt` at the bank returns 5.40, not 0** — flat 301 sits directly above the
lobby, and the gate exists precisely so the boxes are not offered to a player
standing in his own kitchen. So:

- `window.__ct.warp(x, z, yaw, groundAt(x, z), 0)` puts you **upstairs**, the
  spot dead and the frame black. My first two runs did exactly this.
- **Pass the lobby floor explicitly: `warp(px, pz, yaw, 0, 0)`.**
- There is **exactly one** spot matching `/mailbox/i`, at `(201.61, −18.53)`,
  `r 0.95`. `spots()` evaluates `ok()` at call time, so it reads `false` until
  you are standing there.

Also: **set the clock.** A game day is 24 real minutes, so an unset clock lands
wherever the wall clock puts it — my first shot came back a black frame at 02:29
with nothing wrong with the world. `window.__ct.clock(12, 30)`.

`probes/w88-mail-shot.mjs` is committed and does all of the above; start from it.

## 4. The implementation, as far as I traced it — it is SMALL

The framework does everything except give you a mesh. `ct/hud.ts:1071-1128`
swaps the mesh's `material.map` for the panel's canvas, forces `color` to white
so the night wash cannot dim what you are reading, drops the backdrop vignette,
exits pointer lock, and hands the focus controller an `escape`. `:1141-1161`
puts the material back **before** anything that can throw. **It degrades rather
than fails: `mesh()` returning `null` gives you today's screen-space panel**, so
this is safe to adopt incrementally.

What is missing is only the sheet. In `ct/tenancy.ts`, all the pieces are in
scope at the interaction site:

| what | where |
|---|---|
| `add()` — adds to the module's own group | `:755` |
| `faceX` — the bank's face plane in x | `:743` |
| `me` — the player's own box cell (`me.z`, `me.y`, `me.h`) | `:744` |
| `STAND_X = faceX - 0.62` — the hall side is **−x** from the face | `:871` |
| `SHEET = { w: 192, h: 178 }` — canvas px, so the plane must carry **192:178** or the letter stretches | `:616` |

Sketch, and it is about forty lines:

```ts
// built once, hidden; MeshBasicMaterial because hud.ts casts to it
sheet = add(new THREE.Mesh(
  new THREE.PlaneGeometry(0.30, 0.30 * SHEET.h / SHEET.w),
  new THREE.MeshBasicMaterial({ transparent: true, color: 0xffffff })));
sheet.rotation.y = -Math.PI / 2;      // default normal is +z; face it at -x, the hall
sheet.position.set(faceX - 0.34, LOBBY_GY + 1.45, me.z);
sheet.visible = false;
```

then on the existing `makePanel` spec:

```ts
surface: {
  mesh: () => sheet,
  standoff: 0.42, fov: 55,
  hot:   () => reading.length > 1,
  click: (x) => { page = (page + (x > SHEET.w / 2 ? 1 : reading.length - 1)) % reading.length;
                  PANEL?.repaint(); },
},
onOpen:  () => { if (sheet) sheet.visible = true;  },
onClose: () => { if (sheet) sheet.visible = false; },
```

`onOpen`/`onClose` are real fields (`ct/hud.ts:539-540`); `onClose` runs on
**every** close.

## 5. What I did NOT establish — do not take these on trust

- **The sheet's pose is a guess.** I did not stand in the lobby and measure eye
  height, nor check that 0.34 m off the face clears the bank's own door swing or
  the `standoff` the focus controller then applies on top. **Walk it.**
- **Whether the lobby is lit enough** for a `MeshBasicMaterial` sheet to read
  well. Basic is unlit so the paper will be bright regardless — the risk is the
  opposite one, a glowing sheet in a black room looking like the dialog box it
  replaced. **Look at the frame.**
- **Escape from every state.** BUILDER-BRIEF §11 — Escape must close it from
  every screen, and standing up must close it too. With three letters and a
  page-turn there are at least three states. `probes/w41-escape-every-screen.mjs`
  is the model to copy.
- **The `obj: door` on the spot** (`:874`) — I did not check whether the
  selection outline now points at the mailbox door while the letter is up, or
  whether it should point at the sheet.

## 6. Do NOT re-do this

- The framework contract is `ct/hud.ts:404-423` (`ScreenSurface`) and
  `:433-447` (`ScreenFocus`). `notes/archive/w41-diegetic-screens.md` §"For item
  100 (slots) and whoever takes it" is the best existing write-up — **`hot`/
  `click` are in YOUR canvas's pixels**, and your keyboard path is untouched, so
  the existing wheel/arrow page-turn keeps working with no change.
- **If you find yourself writing new mechanism, hand it back** — w41's own words:
  that means the seam is wrong, not that you should build a second copy.
