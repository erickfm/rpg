# Checking YOUR ROOM in the artifact — three commands, and it works today

GOTCHAS §37 says everything the user opens is one of two builds and neither is
the dev server, that `scripts/slow-pinned.sh` cannot start its server since Vite
started bolding the port number, and that *"the whole slow tier is unrunnable
and nobody is checking the bundle."* It also says `check-artifact.mjs` is the
only artifact check and stops at *"it opens standalone and draws"* — it would
pass just as happily with a whole module missing.

**I ran two of my own checks against the packed artifact and they work
unmodified.** Any check that honours `SHOT_URL` does. So the gap is not tooling,
it is that nobody has pointed an existing check at the artifact — and there are
nine other rooms in that file, each owned by somebody, none of them checked
there.

## The three commands

```bash
npm run build && node scripts/pack-artifact.mjs
npx vite preview --port 4201 --strictPort --outDir dist &
SHOT_URL=http://localhost:4201/artifact.html node scripts/<yours>.mjs
```

`reportWorld` prints the build the artifact was packed from, so the run says
which world it measured (GOTCHAS §26) — mine printed `build 8f12682d3` from the
artifact and the same SHA from my preview, which is how you know you compared
like with like.

## Why it is worth doing for a ROOM specifically

GOTCHAS §28: `ct/doors.ts` collects `export const DOOR` from an eager glob, and
a module in an import cycle can resolve to an **undefined namespace at
collection time** — its declaration silently dropped. That fault is *present in
the built output and absent from the dev server*, which is the worst way round.
GOLDEN ACES lost its door to exactly this.

So a room that declares anything through the glob — a `DOOR`, and now a
`DOOR.leaf`, which the kit builds the door's whole geometry from — has a real
failure mode that dev cannot show you. The library's opening is 2.50 × 4.00 in
the artifact, so its declaration survives the bundle. **I could not have learnt
that from the dev server or from my own preview alone.**

## What it found for the library: nothing, and that is the result

```
J-library-door   in the artifact   3 PASS   opening 2.50 m, kit leaf hidden, no console errors
J-gallery-walk   in the artifact   5 PASS   climb 0.00 -> 2.90, 10.17 m of 10.52 walked,
                                            balustrade holds, and back down
```

Both identical to their preview runs. That is the honest outcome and it is still
worth having: the claim *"the library holds in the file the user opens"* did not
exist before and now it does.

## And §22, over my own box, which that entry tells you to do and I had not

```
SHOT_URL=… node scripts/nightgrade.mjs 910 930 -11 11      # the library's slab
  0 materials break GOTCHAS §22 AND are DoubleSide — real artifact risk
  no DoubleSide cut-out is sitting in the transparent sort queue
```

The doorcase is the one thing in the room that could have broken it — it is a
cut-out (`alphaTest: 0.5`) and §22's whole point is that adding `transparent`
beside it moves the mesh into the sorted queue where a `DoubleSide` neighbour
starts painting over it. It does not set `transparent`, and the tool confirms
it rather than me asserting it.

Note the tool also reports *"127 others were never offered to dimWorld at
all — interiors and anything built outside its reach. That is not a fault, it
is scope."* Do not read that as 127 faults; §22 warns that world-wide this is a
tally and not a verdict.

— J, 2026-07-25
