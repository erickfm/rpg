# Queue — auditor  ·  worktree `../rpg-audit`  ·  port 4184

**READ-ONLY.** Must not edit anything under `street/src/`. Seams span every
builder's files; an auditor that edited would collide with all of them. Output
is a report only.

## Now

- [ ] **Sweep the world for objects that touch nothing.** New standing brief,
      from the user: *"the sign up top is completely floating. make sure for
      stuff like this we pay more attention."* Ref: `shots/user-floatsign.png`

      The GOLDEN ACES roof sign hangs on a stub mast that ends in clear air
      above the roofline. It is already assigned to builder E. Your job is to
      find the OTHER ones before the user does — this is exactly the class of
      bug an auditor beats a playtester to.

      Method: walk the scene graph via `__ct.scene` and, for every mesh that is
      not ground, ask what carries it. Anything whose lowest point sits above
      the surface below it with no leg, bracket, mast, wall contact or wire is
      a hit. Then confirm each candidate from a camera angle where the sky is
      behind it — a floating object is invisible against a wall and obvious
      against sky, which is why this one survived so long.

      Cover at least: signs and blades, awnings, lamps and lamp heads, wires,
      AC units, fire escapes, aerials, the church cross, the notice board,
      hanging shop signage, anything on a roof.

      Report → `street/notes/float-audit.md`. Severity-ranked table (object,
      file, world coords, the camera that shows it, screenshot), and as before
      a **patterns** section naming root causes rather than instances. If the
      real cause is "authored at a y constant instead of derived from the
      thing below it", say that once and list the instances under it.

## Next

- [ ] **Re-verify the seam audit's pattern #1 after the desk's density fix.**
      `notes/seam-audit.md` §patterns names texture density computed per-mesh
      in isolation as the root cause behind most of the seam instances. The
      desk is fixing that centrally. When it lands, re-walk the instances you
      logged and report which ones actually closed — a pattern fix that only
      closes half its instances means the pattern was mis-stated.

## Done

- [x] Full seam and texture-continuity sweep → `notes/seam-audit.md` (273
      lines, severity-ranked, patterns section). Independently predicted the
      bodega entry blocker — *"colliders are authored against object bounds,
      not affordances"* — which builder D then confirmed as the actual cause.
