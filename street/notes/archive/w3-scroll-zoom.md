# Scroll to zoom — added, clamped tight

Queue item, files `fp.ts` or `crosstown.ts` (desk-owned; the claim grants
them). Build at commit `6eb17a3a9`.

## Root cause, one line

Nothing in the world handled the mouse wheel at all — `ct/hud.ts` reads it
only while a panel is open (to move a menu selection), and `crosstown.ts`
had no listener of its own — so *"i want scroll to be zoom"* had no code
path to attach to.

## What changed, all in `crosstown.ts`

A `window.addEventListener('wheel', onWheel, { passive: false })` added
once per `makeCrosstown()` call. Each wheel tick nudges a `fovTarget`
variable by a fixed 3° step (sign of `deltaY`, so trackpad and notch mice
behave the same), clamped to `[64, 88]`. `88` is the camera's existing
resting FOV (`crosstown.ts:39`, untouched) and is now also the CEILING —
scroll never goes wider than the deliberate 1997 look. `64` is the floor —
a 24° pull, chosen to err tight per the brief ("shouldn't be able to zoom
too much... is the entire spec"). Every frame, `update()` eases the real
`cam.fov` toward `fovTarget` (time constant ~0.1s) and calls
`cam.updateProjectionMatrix()` — smoothed, not stepped.

Added a `dispose()` to the returned `Proto` (there wasn't one before) that
removes the listener. `main.ts` rebuilds a fresh world — and a fresh `cam`
— on every load, so a stale listener left behind would double the zoom
speed on the next load rather than merely leak.

## The one thing that had to be gotten right, and how I proved it

*"scrolling must NOT zoom the world while the ATM, slots or blackjack are
up"* — `ct/hud.ts`'s panel gate (`hud.ts:340-361`) already installs its own
**capture-phase** `wheel` blocker on `window` whenever a panel is open, and
calls `stopImmediatePropagation()` after handling it. Capture always runs
before bubble on the same target, so registering my listener in the
**default bubble phase** (no `capture: true`) means the gate swallows the
event before mine ever sees it — for free, with zero coupling to
`hud.ts`, zero knowledge of what a "panel" even is. This is the load-bearing
design decision in this change; getting the phase wrong would have either
let zoom leak through open panels or (with `capture: true`, registered
before the gate's own listener queues up) potentially raced it.

Not trusted by inspection alone — measured. New script
`scripts/w3-scroll-zoom.mjs` drives `page.mouse.wheel()` and reads
`window.__ct.camera().fov` directly:

- resting fov is 88.
- scrolling up pulls it to the 64 floor and holds there.
- scrolling down springs it back to exactly 88 (not past).
- opening the ATM (`window.__hud.openPanel('ct-atm')`, an existing test
  affordance) and scrolling 15 notches: fov unchanged, before/after equal
  to the reported precision.
- closing the panel and scrolling again: fov moves once more.

All 8 checks pass against **both** `SHOT_URL=http://localhost:4182/` (dev)
and `http://localhost:4183/` (`npx vite preview` — the built bundle, not
just dev, per the brief).

## Verified

- `npx tsc --noEmit`: clean.
- `npx vite build`: clean (pre-existing unrelated warnings only).
- `node scripts/w3-scroll-zoom.mjs`: 8/8 PASS on dev and on the built preview.
- `node scripts/bugsweep.mjs`: 93 shots, zero STATION MISS, no new console
  warnings, on both dev and preview.
- `node scripts/scenedump.mjs`: `textures=53d809a5 structure=8593b89b` —
  byte-identical to the pre-change baseline recorded earlier this session.
  Expected: this change touches only camera FOV per frame, no geometry or
  texture.

## Not done / judgement calls for the desk to revisit

- **Zoom direction** (scroll up = in) follows the Google-Maps/Photoshop
  convention. The item didn't specify a direction and `ct/hud.ts`'s own
  wheel convention ("+1 forward" on `deltaY > 0`) answers a different
  question (menu navigation), so I didn't treat it as binding here. Easy
  one-line flip (`Math.sign(e.deltaY)` → negate) if the user's mental model
  disagrees once he tries it.
- **Range (88→64, 3°/notch)** is a judgement call, not a measured number —
  the brief said "err on too little" rather than giving a figure. If it
  reads as too little (or too much) in play, both constants are named and
  commented at the top of `makeCrosstown()`.
- Did not touch `fp.ts` — the smoothing lives in `crosstown.ts`'s own
  `update()` rather than inside `FPRig`, since `FPRig` doesn't otherwise
  own the camera's FOV (only position/look), and keeping it here meant
  zero changes to the shared desk-owned rig class. If a future prototype
  besides CROSSTOWN wants the same zoom, it belongs in `FPRig` instead —
  flagging that as the natural place to hoist it if this ever needs sharing.
