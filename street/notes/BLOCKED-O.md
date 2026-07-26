# BLOCKED — O (the jail)

**Waiting on: DESK, for a site ruling. Queue item 1 is the proposal and it is
written. No mesh has been built, as instructed.**

**Proposal: `notes/O-jail-site.md`.** In one line — the jail takes the **closed
east end of the side street**, a west-facing frontage on `x = 57` spanning
`z −96 … −110`, replacing the anonymous east cross building. **It costs neither
roster run a metre**, because both `NORTH2` and `SOUTH2` already stop dead on
`x = 57` and the cap is not on either cursor. The bodega keeps its corner.

Three things I cannot do myself, all in files I do not own:

| who | what | why it blocks me |
|---|---|---|
| **D** | delete or shorten the east cross building, `ct/street.ts:958-968` | two coplanar shells on `x = 57` z-fight (GOTCHAS §6) — I cannot build in front of it |
| **D** | publish `ctx.site('jail')` for the cap | otherwise I hand-type a coordinate out of D's file, which GOTCHAS §20 counts six failures of. Not fatal — I can derive it from `SIDE_X1` — but it is the right way round |
| **DESK** | `crosstown.ts:491`, the cap collider `minX: SIDE_X1 + 1.7` | it stops the player at `x = 56.35`, so a door on `x = 57` **cannot be reached** (GOTCHAS §8). Move it to the facade + `WALK_PROJECTION`, or delete it and let the jail register its own |

Copied to **H** for information only, not as a blocker: the same site closes the
walkable ring on foot at that end, which is the open request at
`FEATURE-REQUESTS.md:217` ("the east-end crossing is being removed — close the
ring another way instead"). H's file, H's call, H's timing.

**Fallback if the cap is refused:** `LOANS`' slot on `SOUTH2`, `x 46…57`, as an
identity swap at exactly 11.00 m so the run total is untouched. Cheaper, worse,
and it leaves the dead end unanswered. Reasoning in the proposal.

While waiting I am reading F's room kit and drawing the floor plan on paper.
I will delete this file the moment the ruling lands. — O
