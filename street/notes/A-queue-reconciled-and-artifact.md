# A: queue reconciled, and the artifact is packed and waiting for the desk

`scripts/live.sh A` reads **0 live, 0 awaiting a check**, and the ledger has
**0 LANDED rows left in it at all** — not merely none of mine. So there is
nothing routed to me, and the standing rule applies: anything my queue file
still lists that `live.sh` does not is finished or void, and I say so rather
than build it twice.

## The `## Now` section is stale — all of it

Every item under `## Now` in `notes/queues/A-shared.md` is done and has a
CONFIRMED ledger row behind it. Two I re-checked today rather than trusting the
tick, because the auditor's sweep asked for exactly that:

- *"You can see the pavement THROUGH the shopfronts"* — re-run today:
  **1558 ground surfaces tinted, no pavement visible through any shopfront**,
  exit 0. Written at 1236; the world grew by 322 surfaces and the property held.
- *"Two bugs in `ct/tex-world.ts`"* — both closed, and the guards that cover
  them (`density`, `facade-run`, `window-lattice`) all CAUGHT their mutations
  when I re-ran canfail aimed at a world built from this tree.

## `## Next`, both items

**1. Stamp the build — ALREADY DONE, and I did not do it.** The short sha and
time render in-frame, bottom right: `953d17c08 02:21` is legible in every
screenshot I have taken today, including the artifact boot shot. Ticking it off
rather than building it a second time is the whole point of this reconciliation.

**2. Republish the playable artifact — BUILT AND VERIFIED, NOT PUBLISHED.**
It did not exist at all; `dist/artifact.html` was absent, not stale.

```
npm run build && node scripts/pack-artifact.mjs
packed dist/artifact.html — 1 079 731 bytes, build 953d17c08
```

**Verified standalone rather than assumed**, opened from `file://` with no
server:

```
511 spots · 7820 meshes · spawn (198.6, -16.3) floor 5.4
prompt live: [E] sit on the bed and watch TV
page errors: 0
```

That last line matters more than the others: the `[E]` gate works in the packed
bundle, so D's eye-height fix is in it — an artifact cut before that would have
shipped a flat where nothing could be used. `shots/A-artifact-boot.png`.

> **DESK — it is yours to publish.** `street/dist/artifact.html`, on disk and
> gitignored, so it does not travel with the branch. My queue says hand it back
> rather than publish it myself, and publishing is outward-facing, so I have not
> touched the artifact URL.

**And the question the queue asks alongside it:** GitHub Pages at
https://erickfm.github.io/rpg/ auto-deploys on push and is current, so the
artifact's remaining value is being a single file you can hand to someone who
will not clone a repo. Worth the desk deciding whether that still earns the
step.


---

## Re-packed at mainline `69b5db064` (the earlier one had gone stale)

The merge train landed a great deal after I packed `953d17c08`, so the artifact
was behind again. Re-built and re-packed:

```
packed dist/artifact.html — 1 091 962 bytes, build 69b5db064
```

**Verified standalone from `file://` with no server**, same as before:

```
286 spots · 7821 meshes · spawn (198.6, -16.3) floor 5.4
prompt live: [E] sit on the bed and watch TV
#ct-atm present · #ct-fade present
page errors: 0
```

**One number moved a long way and I checked it rather than shipping it.** Spots
went **511 → 286** between the two packings — a 44% drop, which is exactly the
shape of something lost in packing. It is not: the dev world on 4188 reports
**286** as well, so the artifact is faithful to the world and the change is real
upstream consolidation. (`ok` spots are 53 of 286; the rest are the seats and
package spots that gate on time and place.)

`#ct-atm` and `#ct-fade` are both present in the bundle, so K's ATM interface and
the screen fade are packed in — an artifact cut before those would have shipped
a bank you cannot use.

> **DESK — still yours to publish.** `street/dist/artifact.html`, on disk and
> gitignored. My queue says hand it back rather than publish it myself.


---

## Re-packed again at `af33304a7` — and a note on churn

Mainline moved to `6ee4e503d`, so the `69b5db064` pack was behind. Re-built:

```
packed dist/artifact.html — 1 095 021 bytes, build af33304a7
286 spots · 225 seats · 7821 meshes · spawn (198.6, -16.3) floor 5.4
prompt live · #ct-atm · #ct-fade · page errors: 0
```

**Built from my tree, which is mainline plus one unlanded commit** — and that
commit touches `LEDGER.md` only, no code, so the bundle is functionally mainline.
Saying so rather than letting "build af33304a7" imply otherwise.

The 225 seats is worth one line: it independently confirms the denominator I
used to size the slot-stool trap at *96 of 225 seats, 43% of every seat in the
game*.

**On churn, for the desk to decide:** mainline moves every few minutes, so any
artifact is stale almost immediately and I could re-pack forever. I have packed
it three times now and none has been published. **Unless you want it current at
a particular moment, the useful trigger is you asking** — or a release, not a
commit. I will not keep re-packing on a timer.
