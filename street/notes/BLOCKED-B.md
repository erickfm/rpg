# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

`notes/queues/B-ground.md` — md5 `b5f65064`, last modified 2026-07-24 23:30,
**byte-identical for thirteen rounds**. All 16 items on mainline, each with a
commit in `notes/B-ground-report.md`. `notes/AUDIT-TRIAGE.md` (03:25) routes
nothing new to me: its own re-verify says all four routed items are closed, and
the two of mine on it were already closed before that pass.

Two rounds of work came in from *other people's commit messages* rather than the
queue — 54795f10's `declareSurface` ask and 9e1bce93's routed one-liner — and
both are now done. That channel works. This note is the residue.

---

## The three remaining sub-1.20 m lane stretches are BY DESIGN. Do not route them.

The triage's headline is "15 → 3 stretches under 1.20 m". I checked whether the
last 3 were mine to fix. **Two are mine, both deliberate, and I am not touching
them.** Measured in my own build, not read off the triage:

| where | free span | what pinches it | verdict |
|---|---|---|---|
| east walk z −34.1 | **1.15 m** | my bus-stop bench, x 5.070…5.731 | by design |
| east walk z −92.9 | **1.15 m** | my street lamp base, x 5.15…5.55 | by design |
| side st north x 44.8 | **1.15 m** | nothing — kerb to building face | not encroachment |

The bench is at the kerb facing the road because the user asked for exactly that,
across four passes. The lamp stands `LAMP_OFF = 0.35` off the kerb. The walk
there is 1.70 m wide wall-to-kerb, so a 0.40 m lamp base leaves 1.15 m.

**1.15 m is the floor that street furniture sets, and it is a comfortable one** —
the player capsule is 0.72 m. Getting below it would mean putting the bench and
the lamps in the roadway. The encroachment audit is genuinely closed; the
remaining 3 are what a street with furniture on it measures.

---

## SYSTEMIC: 55 of 60 scripts measure a DIFFERENT WORKTREE

Found while checking the above. `scripts/lane3.mjs` had a bare
`p.goto('http://localhost:4184/')`, and **port 4184 is not this checkout**:

```
pid 2050229  cwd /home/erick/projects/rpg-audit/street   vite preview --port 4184
```

That is the auditor's worktree, sitting on `57f32557`, with its own `dist/`
built at 03:23 — a different commit and a different bundle from mine at 03:56.
`grep -ln localhost:4184 scripts/*.mjs` returns **60 files; 55 never mention
SHOT_URL at all.** Any builder running one of those 55 is measuring the
auditor's tree and reading the result as their own. That is the same failure as
the seven checks that passed on a world they were not looking at, at a scale of
55.

I patched **one line in lane3.mjs** — `process.env.SHOT_URL ?? 'http://localhost:4184/'`,
default unchanged, so nothing that worked before breaks — and mutation-tested it
(a dead port now throws instead of silently falling back). My lane numbers above
are from my own build, and they came out identical to the auditor's, so no
conclusion anyone has drawn from lane3 was wrong. **The other 54 are not mine to
sweep and should be routed.**

**My own seampairs numbers are safe**: `seampairs.mjs` is one of the 5 that does
honour SHOT_URL (`:21`), so the 115 → 48 → 10 in `bf18539e` is my build.

---

## Two reporting bugs in other people's instruments, flagged not fixed

1. **`seampairs.mjs` sub-line contradicts its headline** — reads "UNJUDGEABLE: 10
   / of those, off the 8/16 grid: 110", which cannot be true of a subset.
   `offGrid` (`:151`) filters `mixed`; `unknown` (`:157`) filters `mixed` *and*
   drops pairs whose other face declares a non-brick kind. They were never
   nested. At 115 vs 110 it looked fine; my declarations dropped one and not the
   other, which exposed it. Not my script.
2. **`lane3.mjs`'s port**, above.

---

## Still needing routing, not self-assignment

Unchanged, and none of it is mine to take:

1. **The fog line**, `crosstown.ts:504` — `multiplyScalar(1 - 0.5 * lampNight)`
   leaves grey fog closing off a dark street. `1 - 0.82 * lampNight` fixes it.
   One line, DESK-owned, raised every round since the night pass.
2. **Findings B and D need a verdict.** B ("mid-block dark") I recommend closing
   as superseded by night five. D ("parking never re-rolls") is `ct/rng.ts` and
   `ct/cars.ts`.
3. **The lamp-pool flat top** — measured, deliberately not acted on. At 23:00,
   **77 materials at full daylight, median 1.25 m from a lamp**. It may be right
   — a lit thing should look lit — but it was never an explicit decision, and
   this system has been reverted once for a unilateral change.
4. **A `'light'` kind for `SurfaceKind`** — `ct/paint.ts`, A's call. Five of the
   nine textures I just declared are light, not material, and `'detail'` is the
   closest honest fit rather than the right one. 9e1bce93 raised this first and
   I agree with it.

---

*Updated 2026-07-25 after the declareSurface rounds. Report at
`notes/B-ground-report.md`.*
