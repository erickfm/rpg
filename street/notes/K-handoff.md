# K — handoff / carry-forward

Builder K, worktree `../rpg-inv`, branch `feat/inv`.
**Owns:** `src/proto/ct/hud.ts` (transferred from D), `src/proto/ct/inventory.ts` (new).
Queue: `notes/queues/K-inventory.md` — the desk writes it, I only read it.

> **Port note for the desk:** my assigned port **4192 is occupied by builder J's
> preview** (`/proc/…/cwd -> ../rpg-civicint/street`, `vite preview --port 4192`).
> Measuring against it would have been GOTCHAS §26 exactly — somebody else's
> build read as my own. I have been using **4292** for my own preview instead.

---

## Landed

### 1. `ct/inventory.ts` — the pockets model, and the newspaper you can take

`ORDER = BUILD.PROPS + 5` (45); joins the world through `ct/world.ts`'s eager
glob via `export function register(ctx)`. No edit to `crosstown.ts`.

- `ItemDef { id, name, stack, blurb }`, `defineItem()`, `itemOf()` — never null,
  an undeclared id gets a plain fallback so `Purse.inv` keys written by other
  modules stay printable.
- **`POCKETS = 6`.** A slot is a KIND, stacking to that item's own `stack`.
  `slots` / `roomFor` / `pocketsFull` / `give` / `takeOne`.
- **`giveRandom(ctx, table?)`** for C — `{ id, def, taken }`.
- `PACKAGE_TABLE`: VHS, TRAINERS, TOASTER, CHEQUES, SOCKS, CATALOGUE, with
  SOCKS and CATALOGUE repeated as the weight (the disappointment is the joke).
- **`takeable(ctx, { obj, id, r?, ok?, lift? })`** — the published call. One line
  in your own file; registers a `ctx.spot()`.
- `dropLast(ctx)` on the **G** key.
- The four folded newspapers are **ADOPTED, not edited in**: `ct/props.ts` is
  B's, and it already stamps `userData.litter`, so this reads that tag. B can
  replace the block with one `takeable()` beside the placement whenever it suits.
- `window.__inv` — read-only test affordance (`pockets`, `slots`, `limit`,
  `roomFor`, `items`, `packageTable`, `takeables`).

### 2. `ct/hud.ts`

- New `note(text, ms?)` on `Hud` + a `#ct-note` div: the transient line that says
  what just HAPPENED. `prompt` is rewritten every frame from what you are looking
  at and cannot hold a result.
- The wallet's left leaf prints **`n/6 pockets`** — above the item list, because
  the world's own caption bar sits over the wallet's bottom edge.
- `makeHud` now calls `bindHud(hud)`. **`hud.ts` imports values from
  `inventory.ts`; `inventory.ts` imports only TYPES from `hud.ts`** —
  deliberately one-directional (GOTCHAS §28).

### 3. `scripts/K-pocket-loop.mjs`, registered in `checks.mjs`

Asserts module registration **in the built bundle** (`__ct.modules()` →
`./inventory.ts`, order 45), a population floor, then the whole loop: take → it
leaves the ground → its `[E]` stops offering → G puts it back at your feet on
your floor → `[E]` live again → takeable a second time. `--selftest` forces the
taken paper back to visible and requires the red; **watched it go red** on
*"the one you took LEFT THE GROUND"*.

### 4. `notes/K-inventory-api.md` — the API for C

`giveRandom(ctx)`, the two things the caller must do (gate the LABEL on
`pocketsFull`, gate destroying the box on `got.taken`), and the answer on full
pockets: **we REFUSE.** Dropping the oldest destroys something the player chose
to carry in response to an action meant to gain something. Visible three ways —
the prompt, the note line, and `n/6` on the wallet.

## Evidence

- `npx tsc --noEmit` clean; `npm run build` clean.
- `K-pocket-loop` all green against my own preview on 4292, `reportWorld`
  confirming the stamp.
- **The world did not move:** fp before/after — `textures=78dfab33` and
  `structure=809593c` IDENTICAL both sides, 7241 objects and 1261 textures both,
  9 places differ and `fpdiff` says itself those are walkers.
- `./scripts/ownership.sh K` — every changed source file is mine.
- `shots/K/{see-it,took-it,wallet,dropped}.png`.

**STATION:** the alley at **(-11.25, -42.05) looking −x** — the newspaper the cat
sits beside. Take it, right-click the wallet, press **G**. Or run
`node scripts/K-pocket-loop.mjs`.

---

## Next, in order

1. **The panel** (queue item 2). Decided, not yet written: a first-person held
   object in the wallet's exact idiom — DOM + 2D canvas, pixel art, slides up,
   thumbs gripping the near corners — drawn as a **cloth panel with six sewn
   pockets**, not a game menu. Opened with **`i`**. It does **not** share the
   wallet's right-click: two different things (money vs things), one gesture
   each, and **opening one closes the other** so they cannot fight for the same
   screen space. Selection on the **mouse wheel** — verified unused anywhere in
   `src/`, and every other key is taken (digits by `main.ts`'s prototype
   switcher, WASD/E/C/shift/space/arrows/Z/X/`[`/`]` by the rig). **G** drops the
   SELECTED item while it is open, falling back to `dropLast` when shut. Needs
   an `icon` on `ItemDef`.
2. **The sleep fade** — a live ledger row, and it **overturns an earlier desk
   ruling of NO FADE**. *"when the player goes to sleep i want the screen to fade
   to black"*. A **general** capability on `hud.ts`, not a sleep-specific one:
   fade out → run a callback → **hold** black → fade in, about a second each way.
   **The clock moves while the screen is black**, not before the fade starts, or
   the fade-in shows a room that already changed and reads as a loading screen.
   No moving or interacting during it — and since `crosstown.ts` and `fp.ts` are
   DESK-OWNED, the plan is a **capture-phase** `window` keydown listener that
   `stopImmediatePropagation()`s (`main.ts`'s own listener is a bubble listener
   on `window`, so capture beats it), plus dispatching synthetic `keyup`s for the
   movement keys on fade start so keys already held get cleared out of
   `main.ts`'s `input.keys`. Publish it in `notes/K-screen-fade.md` for C to call
   from the sleep verb — **do not reach into `ct/apartment.ts`.**
3. **The item list proposal** (queue item 3) — a short note, one line each on
   why, and **route the adoption to their owners**: I publish `takeable`, they
   add the line.
4. **The fist on the watch wrist** (queue item 4) — **almost certainly STALE.**
   `LEDGER.md` already carries that row as **CONFIRMED by H**, the one box is in
   `drawWatch` at `g.fillRect(104, 0, 72, 72)` with the wrist's identical rgba
   shading, and `scripts/live.sh K` does **not** list it. Per the queues README
   the builder's report is the authority and the queue is only the desk's
   belief — so this gets **said, not built a second time**. What is genuinely
   unfinished nearby is `FEATURE-REQUESTS.md`'s "In progress" watch entry:
   `drawWatch` still hardcodes `#c9946a` and never uses `player.sleeve` /
   `player.cuff`, so the forearm has no sleeve. Different, smaller, and the
   desk's to route.

## Open, for the desk — not blocking

`ctx.player` (`PlayerRef`, in DESK-OWNED `ct/ctx.ts`) publishes `x`, `z` and `gy`
but **no facing**, so `dropLast()` puts a dropped object at the player's **feet**
rather than in front of them — you have to look down to see it. One field,
`yaw: () => number`, fixes it. Already written into `notes/K-inventory-api.md`.

— K
