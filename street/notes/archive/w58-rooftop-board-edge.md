# w58 — item 136: the rooftop board seen edge-on (the dark sky shape)

Port **4192**. Judged from the user's own station, **x 53.6, z −103.2, yaw π,
pitch 0.62** — w46/w51's `hero`, cited rather than re-guessed so these frames are
comparable with `shots/w51/`.

## Why it read badly, in one line

**From his station the board shows the street only its narrow returns and its
soffit, and in `boardM` (#24222a) those are a black wedge against a pale sky —
at noon, with every socket on it unlit, there is nothing left to say it is a
sign.**

## The row's premise is right, and it is the reason the last three rounds missed

The row says *"it is WORSE BY DAY than by night, so judge it in daylight"*. That
is correct, and it is the whole story:

**Bulbs are the night half, and the night half was already done.** `w51` gave the
leading edge a socket run, a riser and two soffit runs; its own "for the desk to
queue" line asks for *more* of the same (0.35 m pitch instead of 0.5 m) plus
lighting the uprights. But **the uprights are already `steel` (0x35323a), not the
`#09080a` that note describes** — that half had been done since. And **no socket
density whatsoever changes a noon frame**, because none of them are lit. Three
rounds on this building have all been night fixes to a complaint that is worst by
day.

So this is the day half, and it is a **cross-section** change, not a noise change.

## What changed — `ct/vice.ts`, one mesh, no geometry

The same `BoxGeometry(0.5, 6.6, 7.2)`, with its six face groups given three
materials instead of one:

| face | material | why |
|---|---|---|
| ±x | `boardM` (unchanged) | the artwork planes sit just off these; that black is what the lettering is drawn against |
| +y | `boardCap` | the cap, the one face the sky falls on |
| −y, ±z | `boardTrim` | the soffit and the two returns — everything the street can actually see |

**Nothing is added or moved.** The silhouette the user framed is identical; only
its value changes. A real rooftop sign is a painted sheet-metal box with dark
faces, and that is now what this is.

**Both values are derived, not picked:** the sign's own gold `#e8c25a` (its riser
at `:1625` and its lettering at `:1658`) scaled to a painted rather than a lit
value — 45% for the returns, 58% for the cap. No new colour enters this world.

### The soffit went in BECAUSE OF THE AFTER-FRAME, not before it

My first cut repainted only the ±z returns and left the soffit black, reasoning
that its two bulb runs already dressed it. **That is the night argument again,
and the after-frame showed it moved almost nothing.**

Worked back from the geometry: the board's near edge is z −97.9 at y 19.4, and
his eye is z −103.2 at y ≈1.7 — **5.3 m out and about 18 m below it**. At that
angle the 0.5 × 7.2 m **underside** is most of what he can see of this object and
the 0.5 × 6.6 m front return is the sliver. Repainting the sliver and leaving the
big face black was always going to be invisible.

## My own verdict on the after-images

`shots/w58/board-{day,night}-{before,after2}.png` — `after` (the first cut) is
kept deliberately, as the frame that corrected me.

- **Day, `board-day-before` → `board-day-after2`.** This is the one that matters
  and it is a real change. Before: a near-black spike over the middle of the
  frontage, reading as a blade stuck in the roof, with two lit dots on it. After:
  a warm painted wedge in the same gold family as the marquee crown and the
  vertical riser directly below it, reading as the underside of a sign cabinet.
  **It now belongs to the building.** Good.
- **Day, `board-day-after` (first cut).** Almost indistinguishable from before —
  kept as evidence for the paragraph above.
- **Night, `board-night-before` → `board-night-after2`.** Unhurt. The night wash
  keeps it dark, as it should, and the bulb runs still carry it; the body is
  faintly warmer, which is right for painted metal at night rather than a void.
  No regression.

**Honest limit on my verdict:** it is better and it is no longer a hole in the
sky, but it is still a sign showing the street its edge. **The only thing that
would make this board read as a sign from his station is turning it**, and that
would put a second SEVENS three metres above the marquee's — which is precisely
the duplicate-name fault w51 removed the blade for. I do not think it should be
turned, and I did not.

## How it is proved

- `scripts/probes/w58-board-edge.mjs` — the hero station, **day (12:00) and night
  (22:00)**, before/after. Shots are for looking; nothing here is a pixel diff.
- `node scripts/bugsweep.mjs` — **0 STATION MISS, 0 COVERAGE**.
- `scripts/health.mjs` WORLD OK, `tsc --noEmit` clean, on the **built bundle**.
- **`fp`/`fpdiff` is NOT usable as proof here and was not used.** The change adds
  two `MeshBasicMaterial`s, and `generateUUID` draws from the globally seeded
  `Math.random` stream, so every dithered texture built after them repaints
  (GOTCHAS 75 / BUILDER-BRIEF §10). It would report a catastrophe that is not
  there.

## Found and NOT fixed

1. **`w46-facade-shot.mjs`'s `wide` station is still broken** — x 51.2, z −112
   misses its own landing check by 9.12 m. w51 filed it, it is still true, and it
   means **nobody has a whole-frontage wide shot of this building**, which is the
   view that would settle "does the board read" fastest. Not mine; not in this
   item.
2. **`w51`'s remaining recommendation is now partly stale.** It asks for the
   uprights to be lit "in `steel` rather than `#09080a`" — `ct/vice.ts:1596-1602`
   already builds them in `steel`. Anything re-queued off that note should
   re-measure first.
3. **The leading edge is still at 0.5 m socket pitch**, not the 0.35 m w51
   proposed. I did not change it: it is a night-only lever on a complaint that is
   worst by day, and adding sockets would have made the day frame no different
   while making this change impossible to judge on its own.
