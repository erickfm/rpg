# Queue — builder A  ·  worktree `../rpg-split2b`  ·  port 4188

**Owns:** the shared texture modules — `ct/tex-world.ts`, `ct/paint.ts` — plus
`scripts/**` and the release chores below. These were desk-owned; the desk is
staying free to route, so they are yours now.
**Desk writes this file. Do not edit it.**

Everything here touches files that many builders call. **Never change an
existing signature and leave a caller broken** — if a change of yours breaks a
file you do not own, STOP and tell the desk. That drive-by fix is what
conflicts at merge; it has happened three times on this project.

## Now

- [ ] **Texture density is computed per-mesh in isolation.** This is pattern #1
      of `notes/seam-audit.md` — the single root cause behind most of the
      seam instances logged there, and the reason no two neighbouring surfaces
      agree on px/m.

      Every painter works out its own repeat from its own dimensions, so two
      surfaces that meet get whatever density each happened to derive. The
      result is brick that changes size across a corner, courses that do not
      line up, and a bond that breaks at every junction.

      **`ct/tex-ground.ts` already shows the fix** and is the model to copy: it
      takes WORLD EXTENTS in and returns repeat + offset, which makes the slab
      grid continuous across neighbouring surfaces rather than restarting at
      each one. Do the same for the wall painters in `ct/tex-world.ts`: one
      density constant for the world, repeat derived from real metres, and
      offset derived from world position so a course that starts on one mesh
      continues onto the next.

      Verify with the fingerprint — this WILL move textures, so the point is
      not that they are identical but that you can account for every change.
      `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`.
      Then walk the corners that `seam-audit.md` lists and check them off.
      The auditor is queued to re-verify your work independently afterwards;
      a pattern fix that only closes half its instances means the pattern was
      mis-stated, and that is worth knowing.

## Next

- [ ] **Stamp the build.** Twice this project has lost real work to feedback
      given against a stale build — someone reports a bug that was fixed
      twenty minutes earlier, and an agent goes looking for it. Put the short
      commit sha and the build time in-frame, small, bottom corner, in the HUD.
      Vite can inject it with `define` at build time. `ct/hud.ts` is shared —
      keep the change to an addition, do not restructure it.

- [ ] **Republish the playable artifact.** It is hours behind the world and the
      user is playtesting against `localhost:5177`, so it is not urgent, but it
      is wrong. `cd street && npm run build && node scripts/pack-artifact.mjs`,
      then the desk publishes `street/dist/artifact.html` to the existing
      artifact URL — hand it back rather than publishing it yourself.

      While you are there: the GitHub Pages deploy at
      https://erickfm.github.io/rpg/ auto-deploys on push and is current.
      Worth telling the desk whether the artifact still earns its keep.

## Done

_(nothing yet under this brief)_
