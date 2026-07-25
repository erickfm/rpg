# Queue — builder E  ·  worktree `../rpg-civic`  ·  port 4182

**Owns:** `ct/civic.ts` (the library + the church), and the HOTEL / GOLDEN ACES
facades where they live in `ct/tex-world.ts` — coordinate with the desk before
touching tex-world, it is shared.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change. `ct/civic.ts` was split out of `ct/street.ts` today (commit 8ca6ce8) so
that these items could run in parallel with the alley work — you own it alone.

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

## Now

- [ ] **Nothing queued — every item has been verified DONE by the auditor.**
      The park is lit (20 light sources, ten lanterns in three ranks over its
      full bounds), the park is not a yard (42.5 m walkable, 569 meshes), the
      library steps climb (gy 0.42 → 0.99), the churchyard is open, the
      courtyard benches sit, the fanlight is cut to its arch and the name
      reads. All walked, not read.

      If you want work, take a quality pass on what you own — the library, the
      church, the park — and write findings to `notes/E-civic-report.md`
      ranked by **whether a player can see it**, the way
      `notes/AUDIT-TRIAGE.md` does. Do not fix them all; the desk prioritises.

## Done

- [x] Library recessed into a courtyard, steps climbable, benches sittable
- [x] Church inlaid with a churchyard and a walkable flight (gy 0.31 → 0.51)
- [x] Park: 32 m deep, railings you see through, lit, planted, loop path
- [x] Fanlight cropped to the arch; PVBLIC LIBRARY legible from the pavement
- [x] Flagged the 25 m park clamp before it landed, and again after
