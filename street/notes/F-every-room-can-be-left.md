# Every room can be left — the jail "timeout" was a test artifact, not a dead exit

Builder F, working `notes/SESSION-STATE.md`'s jail-interior-exit-timeout item
(filed by O in `notes/O-jail-site-walkable.md`: *"the sixth [check] ... times
out ... someone should look at `ct/interior.ts`'s door-out spot logic"*).

## 1. Reproduction, on foot, before touching anything

Dev server on port 4184 (`cd street && npx vite --port 4184`). Walked in
through the jail's street door (east cap of the side street, HOUSE OF
DETENTION), across the room, back to the door, pressed E.

Confirmed O's finding first: re-ran `scripts/O-jail-walk.mjs door` against
unmodified `add-stick-and-city98` (commit `cfd0aaecf`) several times in a row.
**It reproduces** — roughly 3 of 4 runs report `ABORT: E from inside did not
leave within 25 s`, one run passes clean. Flaky, not deterministic, which was
the first real clue.

## 2. The three candidates the brief named, checked in order

Instrumented `canSee`/`pickSpot`/the E-dispatch in `crosstown.ts` with
temporary `console.log`s (reverted before committing — see §4) and drove the
exact failing sequence by hand: warp to the door, walk in for real, walk 21 m
into the room for real, warp back to the entrance point, press E.

- **Is the exit spot registered at all?** Yes. `ct.spots()` always lists
  `{x:1000, z:12.45, r:1, label:'out to the street', ok:true}` at the jail's
  slab, in every trial, pass or fail.
- **Is it registered but unreachable** (`lookTolerance` cone, `TOUCH_MARGIN`,
  `canSee` occlusion)? No. Distance from the landing point to the spot is
  0.78 m, inside `s.r + TOUCH_MARGIN` (1.15 m), so selection is aim-free
  ("touching"). `canSee`'s raycast reported **CLEAR on every single frame**,
  in both the runs that succeeded and the runs that timed out — logged
  continuously across a 6-second stall in one failing trial with zero
  blocked hits. `pickSpot`'s own `active` result correctly resolved to
  `"out to the street"` throughout every failing trial too. This candidate is
  ruled out directly, not by elimination.
- **Does the handler fire but the warp-out land inside a collider and get
  reverted by `fp.ts`'s `unstick()`** — the brief's "live right now"
  candidate, since O's own note flagged the jail site as newly walkable and
  worried the exit might still aim into solid mass? **No, and this is checked
  directly rather than assumed.** In every failing trial, `__ct.pos()` never
  changed AT ALL for the full multi-second observation window — not a single
  metre of movement, let alone a warp-then-revert bounce. That rules out
  `unstick()` entirely: there was no landing to revert, because `act()` was
  never invoked in the first place. Separately, the geometry is fine on its
  own terms: `outX = JAIL_DOOR.x - 0.88 = 60.12`, and the building collider
  (post O's forecourt fix) starts at `FX - PROUD ≈ 60.88`. 60.12 is
  comfortably outside it, and every successful exit lands there cleanly with
  no revert.

## 3. The actual cause

**`crosstown.ts`'s E-dispatch is edge-triggered once per rendered frame**
(`feedDown && !feedHeld`, where `feedDown = input.keys.has('e')`, fed by
plain keydown/keyup listeners in `src/main.ts`). Playwright's
`page.keyboard.press('e')` dispatches a keydown immediately followed by a
keyup with an effectively-zero delay. When that whole down-and-up round trip
completes inside the gap between two `requestAnimationFrame` callbacks — which
is a coin flip, not a function of distance, occlusion, or anything about the
jail specifically — the render loop's per-frame read of `input.keys` never
observes `'e'` as true, `feedDown` is false on every frame it actually runs,
and the edge is silently missed. Nothing else happens: no revert, no
mis-selection, just zero frames in which the dispatch's own precondition was
ever true.

Confirmed the fix for the mechanism, not just its absence: switching from a
bare tap to a **held** key — `keydown`, wait 3 rendered frames (~50 ms), then
`keyup` — made the exact same sequence succeed 3 of 3 times. And the
project's own calibrated suite, `scripts/interiors-walk.mjs`, already holds
E for 90 ms (`down`, wait 90 ms, `up`, wait 260 ms) rather than tapping — and
it reports the jail's exit **passing, twice**, in two full independent runs
(see §5). FPS was not the story: measured ~50-60 fps standing at both the
entrance and the exit spot, so this isn't the exit spot being farther from a
"standing on it" fast path costing extra per-frame raycast time — it's purely
CDP-round-trip-vs-rAF phase alignment for an unrealistically instantaneous
synthetic tap.

**A real human keypress is not instantaneous.** A tap is commonly 50-200 ms+
of actual down time, many multiples of this world's ~16-20 ms frame period, so
this race essentially cannot occur from a real keyboard. This is a **test
harness artifact**, not a dead exit: O's `door` mode used a bare `.press()`
throughout, which is why it reproduced identically on unmodified code and
will keep doing so for anyone who reruns it the same way. Not filing this
against O's script — `scripts/**` is anyone-may-add, don't-edit-another's,
and it isn't broken, it's just measuring with an unrealistically instant tap.

## 4. The fix — none needed in my files, and nothing landed outside them

`interior.ts`'s exit-spot registration, radius, and position are all correct
and already verified reliable under any input that resembles a real press.
There is no code change to make in `interior.ts` or `doors.ts`.

The mechanism that makes a *synthetic* instant tap racy lives in
`src/main.ts` (the keydown/keyup listeners) and `crosstown.ts` (the
edge-triggered E dispatch) — both desk-owned, not mine. **Reported to the
desk, not fixed by me**, per the brief and per `OWNERSHIP.md`:

- File: `src/proto/crosstown.ts`, the E-dispatch block around
  `feedDown && !feedHeld` (currently ~line 982-1015), fed by `input.keys` in
  `src/main.ts`.
- What it would take to close the theoretical race entirely (optional
  hardening, not a bug fix — I do not think this is worth an agent's time
  given real presses cannot trigger it): latch "was 'e' pressed at any point
  since the last frame" in the keydown listener itself, rather than sampling
  `input.keys` instantaneously once per `requestAnimationFrame`.
- I used temporary `console.log` instrumentation in both files to chase this
  down and **reverted both to clean before committing** — confirmed via
  `git diff --stat src/main.ts src/proto/crosstown.ts` showing no changes.
  Only my own new scripts under `scripts/F-diag-*.mjs` are new/uncommitted
  work, and those are mine to keep.

## 5. The twelve-room enter-and-leave table

Ran `SHOT_URL=http://localhost:4184/ node scripts/interiors-walk.mjs` (the
project's calibrated suite — held 90 ms presses, not taps) against the
**clean, reverted** build. Full run, all twelve rooms, 305/312 checks passed.

| room | enter | leave | notes |
|---|---|---|---|
| bank | PASS | PASS | 26/26, clean |
| bodega | PASS | PASS | 28/28, clean, keeper faces the customer |
| burger | PASS | PASS | clean |
| casino | PASS | PASS | one unrelated FAIL: no `buy/order/serve/till/counter`-labelled spot published, so the keeper-facing check falls back to its authored station rather than the world's — a metadata completeness gap, not an exit fault |
| church | PASS | PASS | clean |
| diner | PASS | PASS | clean |
| hotel | PASS | PASS | same unrelated "customer station" FAIL as casino |
| jail | PASS | PASS | exit fully reliable (see §1-3); one approach-angle sub-check ("straight at the door from the kerb") false-misses because `interiors-walk.mjs`'s hand-written room table doesn't tag jail `sideStreet: true`, so it applies block-frontage approach geometry to a side-street chamfer door — the OTHER two approach directions (walking north/south up the walk) both find the door fine, so this is a harness gap, not a door that's hard to reach; also 6 of 501 room materials don't dim at night (pre-existing, unrelated to the exit) |
| library | PASS | PASS | clean |
| pawn | PASS | PASS | **previously trapped the player** — `notes/archive/F-verify-G-rooms.md` found *"no way-out prompt anywhere at the inside face of the pawn shop's door, and pressing E does nothing"*. Re-walked it directly: fixed. `git log -- src/proto/ct/int-pawn.ts` shows `44b36e46b`, "the pawn door was eating its own prompt." Reconfirming here since nobody had re-walked it since |
| tax | PASS | PASS | same unrelated "customer station" FAIL as casino |
| thrift | PASS | PASS | clean, including its density floor and three named aisles |

**Twelve for twelve.** Every room you can walk into, you can walk back out
of, and a second E on the landing never sucks you straight back in. The only
FAILs in the full run are (a) one cosmetic metadata gap repeated across
casino/hotel/pawn/tax that does not touch reachability, and (b) two
jail-specific items already explained above, neither of which is about
getting out.

## 6. Final checks

- `npx tsc --noEmit` — clean.
- `npm run build` — clean (two pre-existing rollup INEFFECTIVE_DYNAMIC_IMPORT
  warnings on `hud.ts`/`slots.ts`, not from this work).
- `SHOT_URL=http://localhost:4184/ node scripts/bugsweep.mjs` (dev, port
  4184 as instructed) — **zero STATION MISS**, exit 0, 93 shots, no new
  console errors (generic Canvas2D/GL-driver perf warnings only, present
  before this work too).
- Same bugsweep repeated against the **built bundle**
  (`npm run build && npx vite preview --port 4291 --strictPort`, then
  `SHOT_URL=http://localhost:4291/ node scripts/bugsweep.mjs`) —
  **zero STATION MISS**, exit 0, same result. GOTCHAS §28/§37: a bundler can
  resolve circular imports differently than the dev server, so this was
  checked rather than assumed.
- `SHOT_URL=http://localhost:4291/ node scripts/O-jail-walk.mjs door` against
  the built bundle — the exit itself passes (`E from inside puts you back on
  the STREET`); one unrelated FAIL from that script's own stale `FX=57.0`
  pavement-bound constant (jail's forecourt now runs to x=61, from O's own
  earlier fix), not mine to edit.
- `scripts/interiors-walk.mjs` cannot run against the built bundle — it
  dynamically imports raw `.ts` source modules from the page
  (`/src/proto/ct/doors.ts`) to read published door declarations, which the
  dev server serves unbundled and a production preview does not. That's a
  property of the script, not a defect; its full twelve-room pass in §5 was
  run against dev, and the jail exit itself was independently confirmed
  against the bundle via `O-jail-walk.mjs` above.
- `git diff --stat src/main.ts src/proto/crosstown.ts` — empty. No
  desk-owned files were touched in the final commit.

## What's left, if anyone wants to chase the theoretical hardening

Nothing urgent. If the desk ever wants to close even the synthetic-tap race
(§4) for its own sake — e.g. some future macro/assistive-input path that
really could tap faster than a frame — that's a `crosstown.ts`/`main.ts`
change, not mine to make. I don't think it's worth an agent's time on its own
merits; flagging only because the brief asked for a precise name-the-file
report rather than silence.
