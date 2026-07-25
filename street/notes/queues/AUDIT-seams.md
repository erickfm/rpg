# Queue — auditor  ·  worktree `../rpg-audit`  ·  port 4184

**READ-ONLY.** Must not edit anything under `street/src/`. Seams span every
builder's files; an auditor that edited would collide with all of them. Output
is a report only.

## Now

- [ ] **Walk every interior and audit it as a set.** Four agents are building
      ten rooms in parallel on a shared kit, which is exactly the condition
      your kind of audit exists for: each builder can only see their own room,
      and the failure will be that the ten do not agree with each other.

      The diner is the reference (`ct/int-diner.ts`). As rooms land, walk each
      one and check it against the others, not against its own brief:
      ceiling heights, doorway widths, wall thickness and jamb reveals, floor
      texel density, light level and colour temperature, how you get back out
      to the street and where you land when you do.

      Then the things a builder cannot see from inside their own room: does
      the interior's window agree with where the building actually stands on
      the street? Does the room's size make sense against the shopfront's
      frontage? Is any room enterable from a spot that a collider swallows
      (`GOTCHAS.md` §8 — that has already happened once)?

      Report → `notes/interior-audit.md`, same shape as your others:
      severity-ranked instances, then a patterns section naming root causes.


## Next

- [ ] **Re-verify pattern #1 AGAIN once builder A's cross-file fix lands.**
      Your restatement was accepted and A has a one-time mandate across
      `tex-world.ts`, `ct/street.ts` and `ct/civic.ts`. The five instances that
      stayed open — 2, 12, 9, 19, 1 — plus the new civic ashlar one are the
      test. Measure, do not eyeball.

## Done

- [x] Full seam and texture-continuity sweep → `notes/seam-audit.md`.
      Independently predicted the bodega entry blocker — *"colliders are
      authored against object bounds, not affordances"* — which D confirmed.
- [x] Float sweep → `notes/float-audit.md`. Found a second floating sign and
      established the known one is worse than reported.
- [x] Re-verify pattern #1 (`c15e136`). 4 of 10 closed, MEASURED via a new
      `scripts/density.mjs` across all 103 exterior wall faces. Restated the
      pattern correctly; the desk accepted the restatement and granted A a
      cross-file mandate on the back of it.

- [x] Full seam and texture-continuity sweep → `notes/seam-audit.md` (273
      lines, severity-ranked, patterns section). Independently predicted the
      bodega entry blocker — *"colliders are authored against object bounds,
      not affordances"* — which builder D then confirmed as the actual cause.
