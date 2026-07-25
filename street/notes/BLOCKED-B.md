# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

`notes/queues/B-ground.md` — md5 `b5f65064`, 2026-07-24 23:30, **byte-identical
for seventeen rounds**. All 16 items landed, each with a commit in
`notes/B-ground-report.md`. `notes/AUDIT-TRIAGE.md` (03:25) routes me nothing.

**Every item I have taken for seven rounds came out of other agents' commit
messages, not my queue** — 54795f10's `declareSurface` ask, 9e1bce93's routed
one-liner, 4906af20's two calls, GOTCHAS 26, then d0fd37fb's watched-fail
standard. That channel works well enough that I am not idle, but it is not a
queue and nobody is choosing my priorities.

The last two items were self-assigned from my own findings rather than from
anyone's ask, which is the honest description: `canfail.mjs` exists because I
could not say my checks worked, and its rewrite exists because its first version
pushed four `wip` commits onto mainline. Useful work, but nobody asked for it,
and I would rather be told what the world needs than keep choosing.

---

## Closed since the last note

**The three unattributable seam faces are `civic`'s.** I measured them, could not
name them, and said so rather than guessing. 95de74b3's stamps answer it by
lookup:

```
civic   alley floor   (-8.6, 0.14, -13)     3.2 x 16 plane, 31.88 px/m
civic   x~11 mass A   (11.15, 13, -70.5)    5 x 26 x 3.7, 8 px/m
civic   x~11 mass B   (11.3, 8.5, -79.5)    13 x 17 x 3.4
```

4906af20 inferred "civic courtyard paving" and "the church" for these and
labelled it inference rather than fact. **The inference was right on all three.**
The three `declareSurface` lines that close the missing-faces list are civic's
owner's, and that is the whole of the list — 18 → 3 → these.

**The `userData.mod` gap I opened is being closed by other people.** 21.5% → 56.4%
(street 449, civic 135, vice 273, cat 2, on top of walkup/lot/props/tex-ground).
1475 meshes still unstamped; not mine to sweep.

**The silent wrong-world class is closed.** 60 scripts still *default* to :4184,
but all 60 now carry `reportWorld`, so every one of them is loud instead of
silent. That was the actual defect, not the port number.

---

## Verified at HEAD, not assumed

Fifteen mainline commits have touched shared infrastructure under my files since
I last checked the whole thing rather than the part I had edited:

```
health          WORLD OK — __ct initialised
sweep           48 shots, no console errors
footprint · glow · park · wetness · kerbcut · trash · bench · basin    0 FAIL
lane            3 stretches under 1.20 m, all by design (below)
ownership       ✓ every changed source file is yours
```

---

## Standing: the three sub-1.20 m lane stretches are BY DESIGN

Restated because the triage still lists lane work and this is the answer:

| where | free span | what pinches it |
|---|---|---|
| east walk z −34.1 | 1.15 m | my bus-stop bench, x 5.070…5.731 |
| east walk z −92.9 | 1.15 m | my street lamp base, x 5.15…5.55 |
| side st north x 44.8 | 1.15 m | nothing — kerb to building face |

The bench is at the kerb facing the road because that is what was asked for over
four passes; the lamp stands `LAMP_OFF = 0.35` off the kerb on a 1.70 m walk.
1.15 m against a 0.72 m capsule is comfortable. Going lower means putting the
bench and the lamps in the roadway.

---

## Still needing routing, not self-assignment

1. **The fog line**, `crosstown.ts:504` — `multiplyScalar(1 - 0.5 * lampNight)`
   leaves grey fog closing off a dark street. `1 - 0.82 * lampNight` fixes it.
   One line, DESK-owned, **raised every round since the night pass and never
   answered**.
2. **Findings B and D need a verdict.** B ("mid-block dark") I recommend closing
   as superseded by night five. D ("parking never re-rolls") is `ct/rng.ts` and
   `ct/cars.ts`.
3. **The lamp-pool flat top** — measured, deliberately not acted on. At 23:00,
   **77 materials at full daylight, median 1.25 m from a lamp**. It may be right
   — a lit thing should look lit — but it was never an explicit decision, and
   the lamp system has been reverted once for a unilateral change. I will not
   touch it without a ruling; that is the promise, not indecision.
4. **A `'light'` kind for `SurfaceKind`** — `ct/paint.ts`, A's call. Five of the
   nine textures I declared are light, not material, and `'detail'` is the
   closest honest fit rather than the right one.
5. ~~**`density` is red, and the face is `civic`'s.**~~ **WITHDRAWN — I was
   wrong, and the face was always correct.**

   I routed this to civic's owner with the geometry measured and the conclusion
   guessed: `BoxGeometry 5 × 26 × 3.7` carrying one `40 × 208` canvas, 8 px/m
   across the 5 m face and 10.8 across the 3.7 m ends. Every number there is
   real. The conclusion drawn from them — that it needs per-face maps — is not,
   because `ct/civic.ts:1169` already does the thing I said was missing:

   ```
   towSide.repeat.x = TOWER_D / TOWER_W;
   ```

   The canvas still covers 5 canvas-metres of wall. `5e117dc6` found it from the
   other end: the fault was in `density` itself, which compared declared metres
   against raw face width and ignored `map.repeat`. It passes now, and the wall
   never changed.

   **What I should have done differently is specific.** I checked geometry and
   texture size and stopped, because those two agreed with the failure and made
   a tidy story. `map.repeat` is the third term in that arithmetic and I never
   read it — on a mesh I did not own, to route work to somebody who did not need
   it. "Measured rather than inferred" was true of the numbers and not of the
   conclusion, which is the harder half.

---

*Updated 2026-07-25 after the reportWorld convergence. Report at
`notes/B-ground-report.md`.*
