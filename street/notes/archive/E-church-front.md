# Handoff — builder E · the church west front

Queue item: **Church buttresses foul the lancet windows.** Both faults fixed.
Commit `93c3441` on `feat/civic`, `ct/civic.ts` only, `ownership.sh E` clean.

Shots: `shots/E-church/` (15, from `scripts/E-church.mjs`). The two to look at
are **`user-angle.png`** — the same angle as `shots/user-churchpillars.png`,
for a before/after — and **`head-on-up.png`**, the whole front.

---

## Fault 1 — the overlap, and why it was never going to miss

The buttresses were real boxes placed in metres at `gxm ± 3.4`; the lancets
were painted into the nave texture at `NW * 0.19` and `NW * 0.81`, in texels.
Two coordinate spaces, no relationship between them, and nowhere in the file
did it say where a *bay* was. They overlapped by **0.82 m of a 2.0 m window,
each side** — about 40% of each lancet behind a pillar.

The front is now set out **once, in metres**, before anything is drawn:

```
BUT_W = 0.92      four buttress centre lines: 0.46, 3.14, 9.86, 12.54
bays  : 0.92–2.68   3.60–9.40   10.32–12.08     (1.76 m, 5.80 m, 1.76 m)
centres: 1.80        6.50        11.20
```

Everything else derives from those: `mx()`/`wx()` convert metres to texels, and
the doorway, both lancets and the rose are centred on bay centres and sized to
fit their bay. The margins are written into the file so the next person can see
at a glance whether the front is overcrowded:

- side bays — 1.76 m clear, lancet 1.30 → **0.23 m each side**
- centre bay — 5.80 m clear, doorway 5.50 → **0.15 m each side**

The doorway is untouched at 5.5 m; the user has seen it and it is the best
thing on the building. The lancets narrow 2.0 m → 1.3 m, which is what the bay
allows and also what a lancet actually is — the old ones were stubby.

**The general point, since it will happen again:** any time this codebase
places geometry in metres and paints the thing it has to line up with in
texels, it is one edit away from this bug. Two of my three items this session
were that shape (the other: courtyard planters placed in metres against a
collision budget nobody had written down). Where a module owns both, the
metres should come first and the texels should be computed.

## Fault 2 — buttresses that died in mid-air

One slab, 0 → 12.5 m, stopping under a flat cap 4.5 m below the eaves. Four
stages now, each stepping back under a sloped set-off, dying into the wall at
15.4 m under 17 m eaves.

Two things constrain this and both are worth knowing:

- **The pavement caps the projection at 0.30 m.** The church is on the main
  block now, the walk is 2 m, and the facade collider reserves 0.3 m (§9). The
  ground stage was already at that limit, so the stages step mostly in WIDTH
  (0.92 → 0.76 → 0.60) and only slightly in projection (0.30 → 0.24 → 0.17 →
  0.10). No pinnacles: with neighbours hard against both flanks and the gable
  behind, there is nothing for one to silhouette against — the queue allowed
  either, and landing under the eaves is the one this site supports.
- **A tilted slab reaches past the end of its slope.** Its lowest outer corner
  is `(T/2)·sin θ` further out than the slope end — 0.08 m on the steep plinth
  set-off, which would have hung over the pavement. Every set-off is pulled
  back by exactly that; nothing on this facade now reaches past 0.30 m.

And the same lesson the courtyard steps taught, which I think is the most
reusable thing in either item: **in a MeshBasic world, contrast is painted,
not lit.** 0.06 m of projection change cannot read on its own — the first cut
had four stages and you could see none of them. Each set-off now oversails
0.16 m sideways and has a **dark underside**. From the pavement you are always
looking *up* at these, so the shadow line under the slab is the entire cue.

## One thing I fixed that was not in the queue

The **rose window was an oval** — 5.5 m wide, 3.7 m tall. `roseWin` took a
single radius in texels, and the nave texture is 8 px/m across but 11.76 px/m
up. It works in normalised radius now, so every ring and spoke is the same
thickness in metres either way round, and it is round. It is in the same
texture and the same five lines as the lancets, and it is visible in the shot
the user sent, so I did it rather than queue it. Diameter 3.7 m, which fits
the centre bay with 0.6 m to spare.

Flagging it because it is a **class** of bug, not a one-off: `pixTex` canvases
in this file are not square, so anything drawn with `Math.hypot(dx, dy)` or a
single radius comes out stretched. `roseWin` was the only one in `ct/civic.ts`;
I have not audited the other painters.

## Interaction with D's move

D moved the church onto the main block while I was on the courtyard — built
into a `THREE.Group` and turned, so `placeChurch` still works in its own local
frame and this item needed no coordination. It now stands **facade on x = 7.0
looking west, nave z −86…−73, tower z −73…−68**, PAWN to the north and BODEGA
to the south, hard against both.

That changed one thing about the buttress work and confirmed another: the
corner buttresses are now against neighbours rather than free-standing (no
pinnacles, above), and the 0.3 m projection limit became real, since on the
side street there was no pavement rule to answer to.

**Not a problem yet, but it will be:** the church's flanks are its own stone
and the neighbours' are flat `endM` brown, meeting at the party line. It reads
fine because everything is flush. If the church is ever set back, or a
neighbour is demolished or shortened, that seam becomes the same flat-brown
slab the library courtyard had to face — the party-wall painter added for the
courtyard is in this file and is the thing to reuse.

## Verification

- `scripts/E-church.mjs` — 15 shots: the reported angle, an oblique low one,
  head-on at two pitches, each lancet with the buttresses that used to cross
  it, the rose, four raking views for the stages, from across the street, from
  down the block, and one at 21:40 (the night tint picks up all the new
  geometry).
- `bugsweep`: no console errors. `health.mjs`: world initialises.
- No `rnd()` draws added — the seeded stream is untouched, so no tree height
  or pigeon moved (§2).

## Queue state

`## Now` is clear. Next under `## Next` is the **GOLDEN ACES roof sign**, which
lives in `ct/tex-world.ts` — desk-owned and shared, and my queue says to
coordinate before touching it. Tell me how you want that handled and I will
take it.

Still outstanding from my last item: the courtyard needs
`notes/E-courtyard-crosstown.patch` or D's collision work to be walk-into-able,
and the payphone wants moving to z ≈ −6.4 (`notes/E-courtyard.md`).
