# w4 — item 0d, "remove the on-screen HUD text" — NOT FIXED, wrong file named

## Root cause (one line)
The item names `ct/hud.ts`, but that file has nothing to do with this text —
it only builds `#ct-prompt` (the `[E]` prompt, correctly left alone) and a
diegetic in-world wristwatch face (`CROSSTOWN QUARTZ`, drawn on a canvas
texture, also correctly left alone). The bottom-left overlay the user means —
the `CROSSTOWN '97 1/1` title, the *"The small world — one hand-made
street"* line, and the whole controls strip — is built entirely in
**`src/main.ts:90-93`**, which writes it into `#style-hud`:

```ts
hud.innerHTML =
  `<b>${current.name}</b>  <span class="hint">${currentIndex + 1}/${REGISTRY.length}</span><br>` +
  `${current.feel}<br>` +
  `<span class="hint">click to look · WASD walk · Shift run · C crouch · Space jump · E feed · look down = watch · right-click = wallet</span>`;
```

`current.name` / `current.feel` are set in `src/proto/crosstown.ts:892-894`
(`key: 'crosstown', name: 'CROSSTOWN ’97', feel: 'The small world — one
hand-made street. We grow it from here.'`). The `#style-hud` element and its
CSS (position, font, background pill) are declared in **`index.html`**.

## What I did
Nothing to the world. Verified by reading the source (grep for the exact
strings), not by guessing: `CROSSTOWN '97`, `hand-made street`, and the
controls line all resolve only in `src/main.ts` / `src/proto/crosstown.ts` /
`index.html` — zero hits in `ct/hud.ts`.

## Per BUILDER-BRIEF §9
The item grants `ct/hud.ts`; it does not grant `src/main.ts`, `index.html`,
or `src/proto/crosstown.ts` (the latter is desk-owned anyway per
`OWNERSHIP.md`'s SHARED list). I am releasing this item rather than editing
files it doesn't name.

## For the desk
Re-file this item's file column as `src/main.ts` + `index.html` (and note
`crosstown.ts:892-894` is where `name`/`feel` originate, in case a future fix
wants to change what's passed rather than how it's rendered). The actual fix
is small: clear `hud.innerHTML` (or stop writing to `#style-hud` at all) in
`load()`, keep `#ct-prompt` untouched — it is a wholly separate DOM element
owned by `ct/hud.ts` and unaffected by this change. `#style-hud`'s CSS block
in `index.html` can stay (harmless if unused) or be removed together.

Checked `src/protos.ts`: `REGISTRY` has exactly one entry (`crosstown`), so
there is no other prototype relying on `#style-hud` — safe to delete the
block outright rather than gate it per-proto.
