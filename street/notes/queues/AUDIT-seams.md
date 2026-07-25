# Queue — auditor  ·  worktree `../rpg-audit`  ·  port 4184

**READ-ONLY.** Must not edit anything under `street/src/`. Seams span every
builder's files; an auditor that edited would collide with all of them. Output
is a report only.

## Now

- [ ] **Verify the ledger. This is now your standing job.**
      `notes/LEDGER.md` holds every user request with a status, and
      `scripts/ledger.sh` lists what is not yet CONFIRMED. **Only you or the
      desk may set CONFIRMED, never the builder that did the work** — that
      rule exists because requests kept coming back a second and third time
      after being reported done.

      Work the **LANDED** rows first: a builder says it is finished and nobody
      has looked. Walk each one, and either promote it to CONFIRMED with a
      line of evidence — what you saw, where, measured if measurable — or send
      it back to OPEN with what is still wrong.

      Currently LANDED and unverified: **the park's topography and mowing
      stripes.** The desk can see them in `park.ts` and has refused to confirm
      from a grep, which is the right instinct: the user asked for
      *"topographical changes"* and *"some way to represent a grass field"*,
      and the test is whether a player standing in the park sees rising ground
      and reads the middle as a mown field. Measure the height variation
      across the park and say what the range actually is.

      Then keep the ledger honest as work lands. It is the file the desk reads
      before telling the user anything is finished, so a wrong CONFIRMED in it
      is worse than an OPEN.

- [ ] **Fix the probe harness, then grade all 45.** Your own report says it
      best and the desk agrees with every word of it: seven of twelve checks
      were run from the wrong place because the walk tests shared state, and
      you refused to grade on a measurement you knew was wrong. **That was the
      right call** — a confident wrong verdict would have sent three builders
      chasing nothing, and this project has already lost hours to exactly that.

      Do the three things you listed, in your order:
      1. each check re-warps AND verifies it landed where it meant to before
         pressing a key
      2. **aim from the source, not from memory** — you named this yourself as
         the defect you have now reported four times, once in your own
         harness. `scripts/doorsweep.mjs` finds things by walking and has
         never been wrong; make the others work that way.
      3. then grade all 45 in the user's priority order.

      Two results the desk needs most, because they are the ones nobody can
      confirm from code alone:
      · **the library steps** — you got INCONCLUSIVE leaning NOT DONE, with
        the player stopping dead at the facade line at z = −13 and no rise.
        `a25df0c1` landed. Re-test properly aimed; if the steps are somewhere
        other than where you walked, say where.
      · **the park** — lit and alive, or still the yard the user called the
        shittiest they had ever seen.

      You also have unread screenshots (`shots/pl-P5…P15`). Your line *"an
      unread screenshot is not an observation"* is exactly right and is going
      into `GOTCHAS.md`.

- [ ] **Sweep the whole block for sidewalk encroachment.** The user, on the
      park: *"in general we should not encroach the already cramped
      sidewalk"*. That is a rule, and the park is unlikely to be the only
      place breaking it — a lot of new furniture has landed today from five
      different builders who cannot see each other's work.

      This is your kind of job precisely: no single builder can measure the
      whole lane, and the ones adding to it are each looking at their own
      object.

      **Measure, do not eyeball.** The player capsule is `RADIUS = 0.36`, so
      0.72 m across, and `GOTCHAS.md` §9 says the 2 m lane is sacred. For
      every collider that touches or overhangs the walk, report the clear
      width remaining between it and the nearest neighbour or the kerb.

      Cover at least: the park's bins, benches and piers; the car lot's fence,
      bunting poles and sandwich board; the bodega crates; the bus bench and
      its pole; tree pits; the payphone; the hydrant; lamp posts; A-boards;
      and anything projecting from a shopfront now that the fascias and
      stallrisers stand proud.

      Report → `notes/lane-audit.md`, ranked by how little clearance is left,
      with world coords and the owning file so the desk can route each one.
      Flag anything under 1.0 m as a problem and anything under 0.8 m as
      urgent — at 0.72 m the player physically cannot pass.

      Then say whether this wants a permanent test rather than an audit: if a
      script can assert the lane every build, that is worth more than finding
      the instances once. Builder A owns `scripts/**` and would implement it.

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
