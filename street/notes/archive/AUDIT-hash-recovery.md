# Dead commit citations: the recovery table

**Built while the objects still exist.** 138 distinct hashes are cited in
`notes/` and are NOT reachable from `add-stick-and-city98` — they resolve
only in the worktree of whoever wrote them, because the commit was rebased on
its way into mainline and the hash changed.

**132 of the 138 are recoverable**: the same commit is on mainline under a new
hash, matched by exact subject. The remaining 6 are listed at the end.

> **What a prune costs, stated precisely** — my first wording here was too loose.
> This table **survives**, because it is written down. What does not survive is
> the ability to *verify* a mapping by patch-id, and any dead citation created
> after the table was built.
>
> **Verified in this repo, not assumed:**
>
> - `gc.pruneExpire` **unset** → git's two-week default protects anything recent,
>   so `git gc` is the safe one.
> - `gc.auto` unset (default 6700), and
>   `.git/worktrees/rpg-audit/gc.log` **exists** — that file is what suppresses
>   the automatic run, which is why the warning repeats on every commit instead
>   of a gc happening.
>
> **The trap is that the warning tells you to run `git prune`**, and `git prune`
> has no expiry protection — it takes everything unreachable, now. Deleting
> `gc.log` to silence the warning re-arms the automatic run. Neither is urgent;
> both are one keystroke, which is why this is written down.

**The mapping is verified, not inferred.** Matching by subject alone could pair
two different commits that happen to share a message, so I checked with
`git patch-id --stable`: on a 22-mapping sample, **22 of 22 old/new pairs have an
identical patch-id** — the same change, re-hashed by the rebase that landed it.

**Dated, because it cannot be re-derived.** That check ran on **2026-07-25**,
against the objects as they stood then. It is a **sample of 22 of the 132**
recoverable mappings — chosen by stepping through the list, not cherry-picked,
but a sample. The other 110 are matched by **exact subject only**.

After a prune, none of this is repeatable: the old objects are what patch-id
needs, and they are the thing that goes. So a later reader cannot upgrade the
110, cannot re-check the 22, and cannot tell from the table alone whether the
verification happened while the evidence existed. **It did — that is what this
paragraph is for.** Anyone applying a mapping outside the sampled 22 is trusting
a subject match, which was right 22 times out of 22 where it could be tested.

Replace the left column with the right column. Nothing else changes.

## `feat-interiors.md` — 28

| cited | replace with | commit |
|---|---|---|
| `053db46` | `2c1ccf60e` | Put the park and the car lot in the world |
| `0ecfd662` | `d82db101f` | Both civic flights now lead somewhere: the doors answer |
| `10c16a0` | `89a6830c3` | A snappier jump: a little higher, much less hang |
| `1921bc7` | `e02f10223` | Sweep every [E] in the world, not the ones somebody remembered |
| `27c5139` | `0e00db8c8` | Wire the casino, the hotel and the tax office into the world |
| `34167b1` | `3b5acc0d9` | Verify and finish the interior kit and the diner |
| `3474e81` | `30eaf5e6b` | The bodega [E] spot moves onto its drawn door; the descript… |
| `4762f7e` | `8e348e4e9` | The tax office [E] spot lands on its door; pawn declares it… |
| `4ef227e` | `459285dff` | The door swaps sides when you walk through it |
| `53550b6` | `a25df0c18` | Open the library steps: ask ct/civic.ts for the civic floor |
| `55b59c25` | `098269aab` | [E] takes the NEAREST spot, which is what its comment alway… |
| `58cc650` | `4fe23d0f2` | Re-anchor the diner: its prompt was standing outside the bank |
| `635acc0` | `4fa272324` | Derive every door, window and [E] spot from A's frontage de… |
| `650fc90` | `7f3e30f22` | The burger crew and the thrift keeper join the atlas too |
| `768c0b4` | `2efb829e5` | Diner booths: a run along the window, perpendicular, back t… |
| `7b5ded0` | `1698b3cab` | Flip the authority: the ROOM declares its door, the facade … |
| `8d14f83` | `98e6693b5` | The kit's ceiling docstring was wrong, not the casino |
| `9c06410` | `a23915b6c` | Two cards were hanging in mid-air; a tool that finds the rest |
| `9f2b3d2` | `f30160dd4` | A module is in the world because it exists |
| `a171f7a` | `9f4313dae` | The casino dealer joins the atlas — no hand-drawn people le… |
| `b353954` | `6516603b2` | Sitting: ctx.seat(), and 29 seats that use it |
| `b54d3ec` | `35415d0e1` | Stuck protection: resolve penetration instead of only refus… |
| `ba7a82a` | `64cf44b2d` | The bodega, rebuilt on the kit and made crammed |
| `bf9bcf58` | `1746b2f09` | The fingerprint's three spheres are the chase, not a change |
| `c20ba4a` | `9db375689` | ctx.ground(): civic.ts registers its own floor and seats |
| `e931276` | `55011a6be` | room.person(): the diner's waitress joins the 8-angle atlas |
| `edc034d` | `a060ee18c` | The church steps climb after all — I had the diagnosis wrong |
| `f532b6a` | `7be168992` | The library's benches are sittable |

## `D-alley-report.md` — 19

| cited | replace with | commit |
|---|---|---|
| `065a4e53` | `cedf76802` | The windows on at three are not the windows on at nine |
| `06fe7bd3` | `cf1957a30` | The north end-cap stops standing through the bank |
| `120ac459` | `52b33dd67` | Lit sheets say they are self-lit instead of passing for glass |
| `1ce3d303` | `64565b5be` | The bank turns its corner, then admits it is a party wall |
| `1d5c7515` | `453766784` | Bodega bay: one rhythm, drawn with A's vocabulary |
| `1fb7921` | `8a7941f41` | Collision follows geometry: each module registers its own f… |
| `47ce219` | `d05ea62dd` | Bodega: the doorway is a hole, not a painted panel |
| `54905bb9` | `bcb0f816c` | One party-wall painter, for every exposed return on the block |
| `570eb41f` | `379257956` | The last hand-written [E] goes home: ctx carries the purse |
| `5c10e903` | `5ae9f9955` | "Nothing is listening" is not thirty failing checks |
| `713de4b` | `d2e5d02d0` | Signs: give both of them something to stand on |
| `793edfe7` | `9fa92d579` | Apply E's patch: the church stops sealing its own churchyard |
| `8120f44` | `cff1464d5` | DINER and LAUNDRY swap identities, not slots |
| `8447e7c` | `360fbac4b` | Move the church onto the main block, over DELI and RECORDS |
| `a9133e25` | `7630f2580` | CAFE and HARDWARE become a used car lot — the site half |
| `c774de0d` | **not on mainline** | live: rpg-alley |
| `d7e0b1f` | `57d35a0c9` | BURGER BARN: red and beige, not red and mustard |
| `dc0f4e8b` | `5d8a24c13` | Flank uniformity counted allocations, not appearances |
| `e88bbf2` | `e78e5ec1f` | Swap BARBER/THRIFT, and give their 30 m to a park |

## `A-nightgrade.md` — 10

| cited | replace with | commit |
|---|---|---|
| `04548554` | `cfb82c657` | The lot stops glowing at midnight — and it was my flag, not… |
| `0c4f7570` | `ae7c91c92` | nightgrade sees multi-material meshes now — 143 materials i… |
| `5c813dac` | `f386bf719` | Read the selfLit stamp, and stop guessing at fifteen of them |
| `5f958a70` | `9a2a2f47c` | Re-found nightgrade after db76dc26 moved the ground under it |
| `63422e7e` | `a22f6dde6` | Give nightgrade a verdict, and stop it reading the flag at … |
| `78309300` | `4847e79a4` | Have nightgrade hand each cluster back as a command |
| `8c0a0ba7` | `17326d9c6` | nightgrade can fail honestly now: 417 unknowns down to one |
| `b9c0e163` | `dd7a201a5` | Attribute by the author's stamp, not by where a thing stands |
| `c6ed1c9c` | `1dcfef8f9` | A cluster is a place, not an owner — stop inviting the guess |
| `d6eacfa5` | `3650dcdd8` | Stop paging vice.ts for a harm that cannot reach it |

## `A-mirror-harness.md` — 9

| cited | replace with | commit |
|---|---|---|
| `05f3cd99` | `8abad5370` | One reason for three rooms, and it was wrong for two of them |
| `309d84d9` | `64be72f59` | 5 of 5: every declared room verified to mirror, and PAWN wa… |
| `832d2651` | `c1797ce40` | When it cannot measure, say what it saw — and the doorway i… |
| `96d8e049` | `2ff1c1314` | mirror-walk printed "all 5 rooms mirror" having measured no… |
| `994426ea` | `447514cb8` | "All 5 rooms mirror" was a statement about 5, not about the… |
| `bc717cf8` | `83a53c310` | The harness could never have passed: both sides were the sa… |
| `c064a9b2` | `06ca64682` | mirror-walk could not run at all, and its room list was thr… |
| `e7a23bdd` | `252cd7a23` | Find the doorway at last: it is a collider standing proud o… |
| `eedeacff` | `eba406e17` | Record whether a facade's door was declared or guessed — an… |

## `A-seampairs.md` — 6

| cited | replace with | commit |
|---|---|---|
| `3f3c3ddb` | `7fe644b92` | The 42 are a box face index, not a density fault |
| `409d7433` | `f455f4afe` | Give seampairs the live half: masonry meeting what masonry(… |
| `a5a195a8` | `34d12e082` | The off-grid line outlived the population it described |
| `b69f3dd6` | `fe3106652` | seampairs inherited the same box face index; like-for-like … |
| `c15f6b26` | `64dea34cb` | A bounding box is not the shape — pair faces, not boxes |
| `f79d3fc1` | `bfe32e8de` | Masonry is never a cut-out, so stop offering ivy as a brick… |

## `A-face-lib-proposal.md` — 5

| cited | replace with | commit |
|---|---|---|
| `0a525ba0` | `be7ba4fca` | One implementation of where a face is; three scripts now re… |
| `3f3c3ddb` | `7fe644b92` | The 42 are a box face index, not a density fault |
| `785c72de` | `134d7ba2f` | Adopt pairclip's back-to-back test; two adjacency implement… |
| `8d8d23f1` | `97bf09283` | Merge both adjacency tests: each was right about a differen… |
| `c15f6b26` | `64dea34cb` | A bounding box is not the shape — pair faces, not boxes |

## `A-shopfronts.md` — 5

| cited | replace with | commit |
|---|---|---|
| `3f5acc3` | `5cbb16203` | Give the four shopfronts depth and a character each |
| `6292a4f` | `bed0b6900` | Bring the block default up to the same depth |
| `7f9ecfa` | `a3b803cfc` | Lit windows scatter; tree crowns stop being see-through |
| `cbdb0c7` | `e71b1da44` | Rebuild the pawnshop; retire the last legacy-texel painter |
| `d7ff185` | `0a648f747` | Move the three special shopfronts into tex-world.ts |

## `A-shoturl-sweep.md` — 5

| cited | replace with | commit |
|---|---|---|
| `1072e9dc` | `bc0a21a88` | Every script says which world it measured |
| `340650f2` | `f9446d18a` | Finish the sweep: all 148 browser scripts prove their world |
| `810156a5` | `c527acccd` | All 58 remaining scripts respect SHOT_URL |
| `b5818c39` | `9c7a31400` | Note: 55 scripts measured another worktree; swept, and they… |
| `d49d82c0` | `435e5834e` | Converge on reportWorld: 135 scripts prove the world instea… |

## `A-build-stamp.md` — 4

| cited | replace with | commit |
|---|---|---|
| `4c667bb` | `f5aeec8e5` | Handoff: builder A, the build stamp |
| `5190769` | `acbda5189` | Stamp the build with the commit sha, in-frame |
| `69eff4b` | `f281bd867` | Note: record the stamp-freshness measurement |
| `a016178` | `4548ebed7` | Refresh the build stamp per page load, not per file change |

## `A-declaresurface.md` — 4

| cited | replace with | commit |
|---|---|---|
| `2d29dc23` | `a1e67f6dc` | Declare my own nine textures before asking anyone else to |
| `72df901c` | `c9a16d97d` | The missing-faces list was listing faces that were not missing |
| `76df596f` | `54795f106` | declareSurface: let a face say it is brick, and stop guessi… |
| `c0e29ec1` | `e9aaa7f18` | Name the faces that still need declaring, not just how many… |

## `A-frontage.md` — 4

| cited | replace with | commit |
|---|---|---|
| `5b1e8991` | `a4c64a82f` | Export the shopfront depth vocabulary — unblocks builder D |
| `9094ce83` | `1ed9395c8` | desk.sh: blockers were invisible under the name the README … |
| `9c49ef7d` | `b002bea96` | Publish the shopfront's geometry — frontageOf(name, wMeters) |
| `fb65b1c1` | `7863982b6` | desk.sh: the stale-queue detector was blind to letter-named… |

## `AUDIT-INSTRUMENTS.md` — 4

| cited | replace with | commit |
|---|---|---|
| `75e6b5ce` | `fc18e7f51` | CORRECTION: my -83.5% was a jumped clock, and my "confirmat… |
| `9610e25` | **not on mainline** | live: rpg-entrance |
| `c05e445a` | `f2caee166` | Close a blind band in my own sweep, and find vice respondin… |
| `eedeacff` | `eba406e17` | Record whether a facade's door was declared or guessed — an… |

## `A-selftests.md` — 4

| cited | replace with | commit |
|---|---|---|
| `195a66bb` | `0d6d1c037` | Put density in canfail, and record why seethrough cannot go… |
| `57aa9a6c` | `987709b5e` | seampairs can fail now, and has been watched doing it |
| `8a34f98e` | `03d47522c` | Watch my own two checks fail on purpose |
| `f6f09834` | `2eb023230` | check-wiring has now been watched failing too |

## `D-pinned-suite.md` — 3

| cited | replace with | commit |
|---|---|---|
| `4d14341d` | `fa243e427` | A pinned run must not be able to delete another pinned run |
| `8b9264a6` | `7db050f4c` | Let a builder ask about the world the user actually plays |
| `abd5e7b1` | **not on mainline** | A pinned checkout for the tier that has never finished |

## `A-appearance-guard.md` — 2

| cited | replace with | commit |
|---|---|---|
| `6070da66` | `b40ae2340` | Guard the one appearance request that regressed three times |
| `b05dc7c5` | `bf8203196` | Route density's selftest to the source mutation, not the sc… |

## `A-checks-runner.md` — 2

| cited | replace with | commit |
|---|---|---|
| `04e85e53` | `a5fd04cf5` | checks: say which one is running, and time out instead of h… |
| `42d83b39` | `6a599df58` | npm run checks — six tools nobody could find, and two gaps … |

## `A-density-stamp.md` — 2

| cited | replace with | commit |
|---|---|---|
| `3f3c3ddb` | `7fe644b92` | The 42 are a box face index, not a density fault |
| `4701a94c` | `ddd36f8a7` | Stamp what masonry() paints, so density.mjs can stop guessing |

## `A-fingerprint.md` — 2

| cited | replace with | commit |
|---|---|---|
| `9866dd32` | `d3439c87b` | Split colour out of the structure hash; the proof is stable… |
| `c073ccfc` | `35fd62c6b` | The structure fingerprint does not match itself |

## `A-glazing-handoff.md` — 2

| cited | replace with | commit |
|---|---|---|
| `2bde6593` | `61bc425ec` | Export alongU — the conversion that was hand-rolled because… |
| `68713378` | `2bdcf1d8a` | Publish the frontage NAME, so a finding can be routed |

## `A-last-three-faces.md` — 2

| cited | replace with | commit |
|---|---|---|
| `4f1214f3` | `d46fc571a` | Pattern #1, the last three faces: civic's ashlar declares i… |
| `82947c26` | `b0e63b366` | The last unjudgeable face declares itself: UNJUDGEABLE 10 -> 0 |

## `B-ground-report.md` — 2

| cited | replace with | commit |
|---|---|---|
| `42bc42b` | `8a50f971a` | Decals follow the surface they lie on — the gutter puddles … |
| `499df04` | `9a8607d1c` | Clear the library doors: move the payphone and tree 1 |

## `BLOCKED-F.md` — 2

| cited | replace with | commit |
|---|---|---|
| `0ecfd662` | `d82db101f` | Both civic flights now lead somewhere: the doors answer |
| `edc034d` | `a060ee18c` | The church steps climb after all — I had the diagnosis wrong |

## `BLOCKED-H.md` — 2

| cited | replace with | commit |
|---|---|---|
| `a72cfb40` | **not on mainline** | live: rpg-alley |
| `eeb9a3ab` | **not on mainline** | live: rpg-alley |

## `D-integration-optin-exists.md` — 2

| cited | replace with | commit |
|---|---|---|
| `838242af` | **not on mainline** | live: rpg-alley |
| `a72cfb40` | **not on mainline** | live: rpg-alley |

## `feat-entrance.md` — 2

| cited | replace with | commit |
|---|---|---|
| `0e2e29f` | `9f4d2e728` | Register the walk-up's [E] spots from apartment.ts, not the… |
| `1ce9cf5` | `6dded67be` | Furnish 301 — somebody's room, not a hotel room |

## `A-artifact-check.md` — 1

| cited | replace with | commit |
|---|---|---|
| `b30038f2` | `9bb432f47` | Check the artifact OPENS, not only that it is stamped |

## `A-bay-camera.md` — 1

| cited | replace with | commit |
|---|---|---|
| `0796cc62` | `f3b88ba10` | Aim the bay's see-through camera at the bay |

## `A-density-repeat.md` — 1

| cited | replace with | commit |
|---|---|---|
| `7d8c3dbc` | `5e117dc67` | density failed a correct face: I ignored map.repeat, the tr… |

## `A-density.md` — 1

| cited | replace with | commit |
|---|---|---|
| `34fc7b7` | `be962ea05` | One masonry density for every wall (seam pattern #1) |

## `A-frontage-honours.md` — 1

| cited | replace with | commit |
|---|---|---|
| `c9a8ed1a` | `81dd2f602` | Nobody was checking the middle consumer of the frontage con… |

## `A-glassbacking.md` — 1

| cited | replace with | commit |
|---|---|---|
| `6cc58f6a` | `d05ea62dd` | Put a room behind the glass, so the pavement stops at the door |

## `A-pattern1-closed.md` — 1

| cited | replace with | commit |
|---|---|---|
| `4f1214f3` | `d46fc571a` | Pattern #1, the last three faces: civic's ashlar declares i… |

## `A-not-in-doors.md` — 1

| cited | replace with | commit |
|---|---|---|
| `eedeacff` | `eba406e17` | Record whether a facade's door was declared or guessed — an… |

## `C-lot.md` — 1

| cited | replace with | commit |
|---|---|---|
| `04548554` | `cfb82c657` | The lot stops glowing at midnight — and it was my flag, not… |

## `A-relief.md` — 1

| cited | replace with | commit |
|---|---|---|
| `c91bd15b` | `fcfd4e22d` | Shopfronts get real projection: fascia, stallriser, glass r… |

## `A-unretract.md` — 1

| cited | replace with | commit |
|---|---|---|
| `61458cb3` | `62fdb2327` | seampairs calls a declared face UNDECLARED — three meshes s… |

## `seam-audit.md` — 1

| cited | replace with | commit |
|---|---|---|
| `9610e25` | **not on mainline** | live: rpg-entrance |

## `BLOCKED-A.md` — 1

| cited | replace with | commit |
|---|---|---|
| `e4d2141d` | `2de9134d9` | The interiors read world coordinates now, and the deprecate… |

## `C-wet-at-night.md` — 1

| cited | replace with | commit |
|---|---|---|
| `d72d3e3a` | `cd37b59bd` | The weather is periodic: the street is never dry for more t… |

## `E-church-front.md` — 1

| cited | replace with | commit |
|---|---|---|
| `93c3441` | `938a3b898` | The church front, set out in metres so the pillars stop eat… |

## `E-churchyard.md` — 1

| cited | replace with | commit |
|---|---|---|
| `e13e398` | `499892c70` | The church is inlaid, with a churchyard and steps |

## `E-courtyard.md` — 1

| cited | replace with | commit |
|---|---|---|
| `213b495` | `6fbc597a0` | The library gets its courtyard |

## The 6 that are not on mainline under any subject

These were never landed, or landed with an edited subject. They cannot be
repointed — the honest repair is to say in the note that the hash resolves for
nobody, as I did for `9610e25` in `seam-audit.md`.

- `9610e25` — *live: rpg-entrance*  (cited in AUDIT-INSTRUMENTS.md, seam-audit.md)
- `a72cfb40` — *live: rpg-alley*  (cited in BLOCKED-H.md, D-integration-optin-exists.md)
- `eeb9a3ab` — *live: rpg-alley*  (cited in BLOCKED-H.md)
- `c774de0d` — *live: rpg-alley*  (cited in D-alley-report.md)
- `838242af` — *live: rpg-alley*  (cited in D-integration-optin-exists.md)
- `abd5e7b1` — *A pinned checkout for the tier that has never finished*  (cited in D-pinned-suite.md)
