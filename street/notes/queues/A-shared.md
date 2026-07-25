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

- [ ] **Two bugs in `ct/tex-world.ts`, both found and both small. Do these
      first — they are minutes, and the facade work below sits on top of them.**

      **(a) Lit windows form diagonal stripes.** The user: *"all the lighting
      on the windows goes up and to the right for some reason?"* Ref:
      `shots/user-windiag.png`.

      `facadeTex`, line ~150:

      ```
      const lit = ((f * 7 + c * 3) % 5) === 0;
      ```

      That is a linear congruence in floor and column, so each step up the
      building shifts the lit column by a fixed amount. It cannot produce
      anything BUT diagonal stripes — it is a lattice, not a scatter. The user
      spotted it as a pattern before spotting it as a bug, which is the tell.

      Replace it with a hash of `(f, c)` — the file already has an LCG in
      `clcg`/`treeSprite` you can borrow the shape of — seeded per building so
      two neighbours do not light identically either. Aim for a similar
      proportion lit, roughly 1 in 5, but scattered.

      Note builder D has a queued item to make window lights follow the night
      curve rather than being baked. **Do not build that** — just make the
      static pattern non-diagonal so D has something sane to animate.

      **(b) Tree canopies are see-through in patches.** The user: *"tree looks
      transparent in parts that probably shouldnt be transparent?"* Ref:
      `shots/user-treealpha.png` — you can read brick and a whole window
      through the middle of the crown.

      It is not the material — `board()` uses `alphaTest: 0.5` with no
      `transparent`, which is a hard cutout. It is `treeSprite`: the
      ragged-edge pass runs `globalCompositeOperation = 'destination-out'` and
      bites notches at `d = 0.94 + r() * 0.22`, i.e. centred anywhere from
      **94%** of the radius outward. At 0.94, plus the notch's own radius, it
      is eating into the INTERIOR of the crown and punching alpha-0 holes
      straight through it.

      The intent — *"bite small notches out of the outline so it is never
      smooth"* — is right and the ragged silhouette should stay. Constrain the
      notches to the rim: centres at or beyond the full radius, or re-fill the
      interior after the destination-out pass. Check the result against a
      bright wall, which is where a hole shows.

- [ ] **The shopfronts are not good enough. Bring all of them up, and take
      the special fronts into your file while you do it.** The user:
      *"we need much better facades for the tax service, diner, burger barn,
      thrift shop, casino, and hotel especially."*

      Four of those six are yours or should be. The casino and hotel are
      builder E's and stay there — they are side-street buildings with their
      own brief already queued.

      **First, consolidate.** `burgerFront`, `pawnFront` and `taxFront` live in
      `ct/street.ts` (D's file) while `shopfrontTex` and `facadeTex` live in
      yours. That split is why the specials drifted — the burger barn kept its
      mustard through three "fixes" partly because nobody who owned the
      shopfront system owned it. Move all three painters into
      `ct/tex-world.ts` next to `shopfrontTex`. This is a **bounded cross-file
      mandate**: `tex-world.ts` + `ct/street.ts`, one commit, moving painters
      and nothing else. It also unloads D, who has ten items.

      **Then make them better.** What is actually wrong is that a shopfront is
      a FLAT PAINTED PLANE. Every one of them is brick, a coloured band, a
      name, and a dark rectangle of glass. Real shopfronts have depth, and
      depth is most of what tells a good one from a bad one at a glance:
      · the glass **set back** from the brick, with a visible reveal
      · a **stallriser** below the glass and a **fascia** above it that
        project, rather than being painted stripes
      · a **transom** over the door, mullions dividing the glazing
      · **something IN the window** — a display, shelving, a silhouette of
        the room behind, so the glass is not a black hole
      · signage that is a made object: a projecting blade, a hand-painted
        board, applied letters with a shadow — not text stamped on a band
      · wear where hands and weather reach: dirt at the stallriser, a bent
        security grille, tape on cracked glass

      Give each of the four its own character rather than one template with
      the colour swapped. A diner is chrome and glass block; a thrift store is
      handwritten card and crowded window; a tax office is vertical blinds and
      a gold-leaf window decal; a burger barn is plastic and backlit plexi.

      **Coordinate on the diner:** builder D is moving it to the 12 m slot
      after the alley right now, so its frontage is changing width. Rebase
      before you start and check where it actually is.

      Match the house style: ~8 px/m, muted 1997 palette, no dither on a face
      thinner than ~0.3 m (`GOTCHAS.md` §4). Two failures then delete.

- [ ] **Finish pattern #1 across the files it does not reach. You have a
      one-time cross-file mandate for this, granted by the desk.**

      Your density fix closed **4 of 10** logged instances — the auditor
      re-verified by measurement, not by eye (`notes/audit-seams.md`, Round 3;
      `scripts/density.mjs` reports px/m per mapped face across all 103
      exterior wall faces). All upper walls now measure 8.00 × 8.00 and shop
      bands an exact 2×. That part is right.

      The problem is that the pattern was written as if `tex-world.ts` were the
      only place masonry is painted, and it is not. `bodegaBrick` and the alley
      flanks in `ct/street.ts`, `bayFrontT` on the canted bay, and the ashlar in
      `ct/civic.ts` all still compute their own density and none imports
      `WALL_PPM`.

      **The misses are now more conspicuous than before your fix**, because
      their neighbours were tidied and they were not. The bodega canted bay —
      the corner the user originally complained about — measures 11.5 × 11.7
      against neighbours at a clean 8 × 8, so that seam reads *worse* today.
      That is not a criticism of your change; it is what a per-file fix to a
      cross-file pattern does, and it should be finished rather than left.

      The auditor's restatement, which the desk accepts:

      > Every surface that paints masonry must derive its canvas from the
      > surface's real metres at the world's one density. The defect is not
      > that a painter computes density badly; it is that any painter computes
      > it at all.

      So: one exported helper taking `(widthM, heightM, baseY)` and returning
      the canvas, and every masonry painter goes through it.

      **The mandate, precisely.** This needs `tex-world.ts` (yours),
      `ct/street.ts` (D's) and `ct/civic.ts` (E's) to change together in ONE
      commit — a signature change with all callers, which `OWNERSHIP.md` calls
      a desk operation. The desk is granting it to you because you have the
      context and three builders coordinating would be worse. Conditions:
      · **one commit**, all three files, nothing else in it
      · touch ONLY the density/canvas derivation in D's and E's files. Not
        their geometry, not their placement, not anything else
      · **rebase immediately before you start** — D is mid-way through moving
        the church, E is mid-way through the library courtyard, and both are
        in the files you are about to touch
      · if you cannot do it without changing something else, STOP and tell the
        desk rather than widening the diff
      · new instance to include: `ct/civic.ts` paints library and church ashlar
        at 8.00 × 11.75 px/m — 1.47:1 anisotropic, not commensurate with the
        brick it abuts at every civic-to-shop party wall

      Verify by measurement the way the auditor did, not by eye. The auditor
      will re-verify independently afterwards.

- [ ] ~~**Texture density is computed per-mesh in isolation.**~~ — the
      `tex-world.ts` half is DONE (`be962ea`); see the item above for the rest. This is pattern #1
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
