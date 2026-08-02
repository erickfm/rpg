# w48 — item 119, the top of the TV ad

**The user:** *"make sure the top of the ad isnt getting cut off by the tv. we
can reduce the bezel a little bit."*

**Root cause, in one line:** the bezel rails never overlapped the glass — all
four abut the aperture exactly — the top of the picture was lost to **parallax**,
because the ads only ever play to a *seated* player whose eye is a fixed 0.538 m
**above** the screen's centre, and a surround standing 0.06 m proud of a recessed
screen cuts a band off the top from that angle.

Port used: **4192**. (I measured on 4190 first and everything it reported was
genuine — re-run on 4192 gives identical numbers — but `checks.mjs` refuses
4190 outright because it is on Chrome's blocked-ports list. Don't use it.)

## The item offered two hypotheses. Both are wrong, and it says to establish which

> (a) the bezel rails genuinely overlap the screen aperture, or (b) the ad canvas
> is drawing content above the safe area and the bezel is innocent.

**(a) is false, measured.** From the world, not the source
(`scripts/probes/w48-tvprobe.mjs`):

| | screen edge | rail edge |
|---|---|---|
| top | y 6.162 | rail underside y 6.162 |
| bottom | y 5.902 | rail top y 5.902 |
| left | x 198.26 | rail inner x 198.26 |
| right | x 198.62 | rail inner x 198.62 |

Zero overlap on all four sides. Head-on, nothing is covered.

**(b) is false too**, or at least it is not the whole cause — the canvas painting
at row 2 only *matters* because something is eating rows 0–2, and nothing in the
canvas explains why the top and not the bottom.

**The real answer is a third one: the recess.** `RAIL_D` was 0.06 — the rails
stand proud of a screen set back behind them. That is fine on-axis and it is
*not* on-axis: `ctx.seat` puts the eye at (198.44, **6.57**, −15.58) and the glass
is centred at (198.44, **6.032**, −17.508), so the player looks **15.6° down** at
the set from 1.928 m. The top rail's front edge then projects down over the
picture; the bottom rail's front edge projects *away* from it, which is exactly
why the complaint is about the top and only the top.

Measured band, marching all 48 canvas rows from the real seated eye against the
real meshes:

| | occluded rows, top | bottom | left | right |
|---|---|---|---|---|
| before (`RAIL_D` 0.06) | **2.5** | 0 | 0 | 0 |
| after (`RAIL_D` 0.04) | **1.6** | 0 | 0 | 0 |

Ten of the 27 spots were visibly cut: `list` put its headline at row 2, `split`
its BEFORE/AFTER at row 2, and `slate` the top rule of its border at row 2.

## Why shrinking the bezel could not have been the fix on its own

**Any recess at all occludes something off-axis.** 0.06 → 2.42 rows, 0.04 → 1.60,
0.03 → 1.19. It approaches zero only as the bezel flattens into the poster the
bezel exists to stop the set being — and `:2502` already states the rule this was
breaking, *"the bezel must frame the glow, not swallow it"*, while `:2507`
records that he likes the set as an object.

So the authorised reduction is spent, and no more: **`RAIL_D` 0.06 → 0.04**, a
third shallower, still a chunky 40 mm surround. The remaining 1.6 rows are
absorbed by a declared safe area instead, which is the half that a *new spot*
cannot reintroduce.

## What changed

`src/proto/ct/apartment.ts`:

1. **`TV_SAFE_T = 3, TV_SAFE_B = 2`** — a declared title-safe area, with the
   measurement and its derivation in the comment above it.
2. **`tvSafeY(y, glyphH)`**, applied inside `tvFit` and `tvAt` — the only two
   functions that draw words. A spot asking for row 0 now gets row 3, and an
   over-tall line is pushed up off the bottom rather than running past it.
   **Backgrounds still bleed**: a full-width accent bar loses nothing by being
   trimmed, and that is correct broadcast behaviour. Only ink is constrained.
3. `slate`'s border rewritten from the safe constants — it is the one piece of
   *non-text* that has to sit inside, because a rule at row 2 lost its top edge
   and read as a three-sided box.
4. **`RAIL_D` 0.06 → 0.04.** The badge, band, buttons and LED all derive their z
   from `RAIL_Z`/`RAIL_D` and followed the face in on their own — nothing retyped.
5. `scene.userData.tv` now publishes `safe: {t, b, rows}` and `minRow` (the
   topmost row any glyph pixel was drawn at, per paint), so the check enforces
   the contract without a second copy of either number.

## Proof

**`scripts/w48-tv-title-safe.mjs`** (registered in `checks.mjs`, marked **slow** —
"all 27" means sitting through the pack, ~150 s, which lands within seconds of
the 180 s per-check budget). Two independent halves, because either can rot alone:

- **geometry** — marches all 48 rows from the real seated eye against the real
  bezel meshes; the band must fit inside the declared safe area.
- **content** — sits through the whole 27-spot pack and requires every spot to
  report `minRow >= safe.t`.

Final run: `all good`, exit 0. `occluded rows: top 2, bottom 0` against a safe
top of 3 — a row of margin. Tightest spots are the `list`/`split`/`order`
formats at row 3, i.e. exactly on the line, which is the clamp working.

**`--selftest` pushes the top rail 0.05 m further proud and pins `minRow` to 0.**
Both halves go red: *"the bezel eats 4 row(s) off the top"* and *"27 of 27"*
spots cut. It is not decoration.

**The world did not move.** The change moves meshes but adds none, so `fp` is
valid here (GOTCHAS 75 bars it only for added/removed geometry — object count is
8457 both sides). `npm run fpdiff`:

- **textures 1460 vs 1460 — IDENTICAL.** Not one texture repainted.
- structure — **exactly 4 differ**, the four rails, `depth=0.06` → `depth=0.04`.
- places — 16 differ, all with a partner within 5 cm: my TV furniture following
  `RAIL_Z` in by 1–2 cm, plus pigeons drifting. fpdiff calls it drift itself.
- tints — 1 differs; fpdiff's own note says the casino chase recolours shared
  materials every frame and this encodes which frame the dump landed on.

`node scripts/bugsweep.mjs` — **0 STATION MISS, 0 COVERAGE**, 96 shots, no new
console errors.

## My verdict on the after-images

I photographed **all 27 spots** from the seat
(`scripts/probes/w48-tvshots.mjs`, `shots/w48-tv/before|after/`) and looked at
them. The before/after on the same spot is unambiguous:

- **MEGA HITS 97 (`list`)** — *before*, the headline is a strip of half-letters
  jammed against the surround, its top row sliced clean off; you can read it only
  because you know what it says. *After*, "MEGA HITS 97" is whole, with clear
  space above it inside the cyan bar. This is the user's complaint exactly.
- **PSA (`slate`)** — *before*, the border is a three-sided "U", top rule missing.
  *After*, a complete four-sided box.
- **BURGER BARN (`split`)** — BEFORE/AFTER now legible with their top rows intact.
- **PIZZA (`order`)** — "ORDER NOW" complete.

The set itself still reads as a chunky 1997 television at 40 mm: the surround,
the badge, the three buttons and the red standby LED all still frame the picture
rather than being swallowed by it. I do not think the reduction is visible as a
loss — I could not tell 0.04 from 0.06 by eye in these frames, only in the
measurement.

**One honest caveat on the images**: the shot script magnifies by *rendering
bigger*, not by zooming. Narrowing the FOV is the obvious way to fill the frame
and it silently does nothing — the rig writes `cam.fov` every frame, so a probe's
value is gone by the next render. My first pass photographed an 88° frame while
believing it was at 11°, and only threw an error once the crop was derived from
the projected rect (the set is 15.6° below the eye line, so a 14° frame does not
contain it at all). Anyone aiming a camera at this world from a probe should
know that.

## Found and NOT fixed

1. **`TV_FRONT` (`apartment.ts:2515`) is dead.** `const TV_FRONT = TV_Z + CASE_D / 2`
   is declared, commented *"the plane of the surround"*, and referenced nowhere.
   It is also now **wrong**: with `RAIL_D` at 0.04 the rails' actual front face is
   at `TV_Z + 0.192`, not `TV_Z + 0.20`. I left it rather than widen the diff, but
   it is a stale constant of exactly the kind BUILDER-BRIEF §8 warns about — the
   next person to use it will place something 8 mm proud of the set. **One-line
   deletion, worth queueing.**
2. **There is a second 64×48 canvas in the world**, a 1.9 × 1.25 m plane at
   x 1070 (nowhere near 301). My first probe found *that* one by searching for
   "the 64×48 canvas" and confidently measured it instead of the television. Any
   future probe must find this screen by size **and** proximity to the seat. Not a
   defect, but a live trap — it cost me a run.
3. **`legal` bypasses the safe helpers.** Its crawl calls `tvText` directly at
   row 41 so it can overrun horizontally *by design*. It is nowhere near the top
   and `minRow` reports 26, so it is safe today — but it is the one path that
   would not be caught by the clamp if someone moved it upward. The check would
   still catch it, which is why the check reads `minRow` rather than trusting the
   helpers.
4. **`checks.mjs` refuses port 4190** as a Chrome blocked port, while Playwright's
   own Chromium opens it happily. So probes and the suite disagree about which
   ports are usable, and a builder can get a full set of *correct* measurements on
   a port the suite will then refuse. Worth a line in GOTCHAS next to §48.

## File I needed that my item did not name

The item named `ct/apartment.ts` only. I also appended one row to
**`scripts/checks.mjs`** to register the check — the same thing w40 did for
`w40-bed-vs-door` — and added `scripts/w48-tv-title-safe.mjs` plus two probes
under `scripts/probes/`. Reporting it per §9; nothing else in `checks.mjs` was
touched.
