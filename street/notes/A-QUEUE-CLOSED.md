# Queue A: every item closed, with the evidence — for the desk to retire it

`notes/queues/A-shared.md` has not changed since `bec87e424` and still lists
every item as open. All of them are done. I have been asked to "take the next
item" four times against a queue I have nothing left in, so this is the
item-by-item proof rather than a fourth assertion that it is empty.

**Everything below was re-run on the current tree**, not remembered — mainline
has moved a lot underneath me and a stale "done" is this project's documented
failure mode.

## The `## Now` items

| queue item | closed by | evidence, re-run |
|---|---|---|
| Flip the authority: the INTERIOR declares, the facade follows | `frontage-honours` | 5 declared doors, every one honoured by the facade · **exit 0** |
| Interiors/exteriors agree on HANDEDNESS | `mirror-walk` | all 5 measured rooms mirror — the door swaps sides when you walk through · **exit 0** |
| You can see the pavement THROUGH the shopfronts | `check-seethrough` + `shop-interior` | 16 shopfronts + the bodega bay, 1621 ground surfaces tinted, no pavement visible; 18 backings dark but never black · **exit 0, 0** |
| GRANTED mandate: shopfront geometry (fascia, stallriser, reveal) | `shopfrontRelief` | real projecting boxes per frontage — cornice, bed mould, jambs, cill, plinth — measurable per shop in `A-diner-relief-palette` |
| ~~Make "written but never wired" impossible~~ | STOOD DOWN by the desk | — |
| Export where the door and window ARE | `__frontages` | **16 frontages published, 5 with a room-declared door**, 18 fields incl. `doorWorld`, `glazingLo/HiWorld`, `stallriserH`, `fasciaH` |
| (a) Lit windows form diagonal stripes | `window-lattice` | **exit 0** — `facadeTex` uses an avalanche hash, not the old congruence |
| (b) Tree canopies see-through | `tree-crown` + `A-tree-canopy-opaque` | **exit 0, 0** — and mine catches what tree-crown structurally cannot (tufts, rim pockets) |
| The shopfronts are not good enough — tax, diner, burger barn, thrift | measured, this session | see `A-four-fronts.md`: the two outliers were 234 and 209 against a 149 sky; now 62 and 127 |
| Finish pattern #1 (cross-file density) | `density` | 254 faces carry a `masonry()` stamp, every one mapped within 2 % · **exit 0** |
| ~~Texture density per-mesh~~ | already struck | — |

## The `## Next` items

| queue item | state |
|---|---|
| Stamp the build | **done** — `ct/hud.ts:197` paints `SHA + DIRTY + HH:MM` from `virtual:build-stamp`; visible in every screenshot this session |
| Republish the playable artifact | **packed and verified** — `dist/artifact.html`, 892,625 bytes, build `a432b8e14`; `check-artifact`: `__ct` up, 5154 meshes, mean luminance 61.3, opens standalone. **Handed to the desk to publish**, per the queue's own instruction |

On whether the artifact still earns its keep — the queue asked, so: *marginally,
as a fixed shareable snapshot.* Pages auto-deploys and is current, the user
playtests 5177, and this is a hand-packed 0.9 MB file that goes stale the moment
anything lands. Worth republishing at milestones, not on a queue item. A
recommendation, not a decision.

## Suite state

`checks-registered`: **82 registered, every self-testing script registered or
exempt, 0 unregistered.** `gotchas-numbers`: 43 entries, 1…43, unique and in
order. Twelve queue-mapped checks re-run for this note: all exit 0.

## What I would NOT close, and why

- **D-walk's tier.** 89 s idle, the longest in the fast tier, and ~2× contention
  blows the 180 s ceiling. `lotwalk` was moved to slow at 36 s on the file's own
  rule. Moving D-walk would REMOVE its walked proof from the default run — a
  coverage decision about another builder's check, and the desk's to make. The
  numbers are in `A-checks-deduped.md`.
- **A-1 TAX's navy mouldings** (175° from its cream banner) and **the thrift's
  220-luma window**. Both measure as outliers, both are correct: navy is the tax
  office's identity colour under a cloth banner, and the thrift is bright
  because it is FULL of white price cards. GOTCHAS 23 — real is not the same as
  visible. Recorded, not churned.
- **The diner's mullions** — 3 bays over 8.45 m still looks coarse to me. I have
  no measurement, so it stays a judgement and not a finding.

## Handoff notes from this stretch

`A-diner-facade-look.md` (the diagnosis) · `A-diner-facade-fixed.md` (the three
faults) · `A-four-fronts.md` (the other three named shops) ·
`A-checks-deduped.md` (the dedup, the mutation that slept, the D-walk
retraction). The first three carry a correction banner about three deleted
scripts; their measurements stand.
