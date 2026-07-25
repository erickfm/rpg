# Builder B (`../rpg-ground`) — queue report

Read against `notes/queues/B-ground.md`. **Every item in that file is now
done and on mainline** — the queue was written before my branch merged, so
`## Next` is stale rather than pending. Nothing below needs redoing; this is
the evidence so the desk can move the items to `## Done`.

Branch state: **0 ahead, 0 behind** mainline, `tsc --noEmit` exit 0, build
clean, working tree clean.

---

## `## Now` — get green ✅

Done, and worth recording *why* it kept happening, because it bit three times:

`tsc` passing on my branch was never evidence the integration was green. My
branch was behind mainline, so it did not contain the code that my own change
broke. Specifically: I changed `citizenAtlas` from positional args to a `Look`
object, and the hermit in `ct/apartment.ts` — another builder's file — still
called it positionally. That combination only exists in the merge.

**The check that actually works is `git rebase add-stick-and-city98 && npx tsc
--noEmit`, not `npx tsc --noEmit`.** I have switched to that.

Also fixed a latent hazard I created: the commit that fixed the hermit call
came *before* the commit that changed the signature, so it was broken in
isolation and would have failed a bisect. Folded together during the rebase.

Per your instruction I took mainline's `ct/citizens.ts` wholesale rather than
merging mine — my variety work was already upstream as `8eaca0c`.

## `## Next` — all five already landed

| item | state | evidence |
|---|---|---|
| Lighting tint (cars brown) | done | multiply not lerp; `lerp(SODIUM` count is **0** |
| Night is flat | done | overlay `v * 0.28`; `NIGHT_FLOOR`/`dimWorld`; fog toward black |
| Remove the van | done | 0 van entries in `parked` |
| Bus bench geometry | done | ad IS the backrest; `FLAG_BOT = 2.20` |
| Parking should vary | done | drawn from a distribution, stratified |

Probes, all passing on the current tree:

```
lamplight  the car in the pool warms up · it is still the same car — hue barely moves
           glass, tyres and ironwork dim but never warm
           a car away from lamps only loses ambient, uniformly
           the world itself goes dark, not just the lens
           lit and unlit are genuinely far apart (no flat wash)
           everything returns exactly to base by day
parking    perfect parking still happens · never comes out machined
           no collider reaches the sidewalk or the travel lane
           this session: 27 cm+crooked / 14 cm ordinary / 5 cm near-perfect
bench      22 m at full speed through the stop, both directions
```

### Notes on two of them

**Lighting.** The brown was one bug with two symptoms. Lerping toward a flat
amber *replaces* the colour, and it dragged every dark texel with it — which
is why the greenhouse became a brown slab and the wheel arches got amber
patches. Multiplying by a warm factor cannot do that: near-black × 1.15 is
still near-black. Peak per-channel change measures **13.2%**, under the 0.25
cap. Glass, tyres and the near-black underbody are excluded outright.

**Night.** The wash is now a thin cool cast (0.28× its old weight) and the
world darkens instead, through the registry the lamps already used. Measured
range between a car in a pool and one between lamps is **1.77×**; a flat
overlay gives 1.00× by construction. **Day is byte-identical** — scenedump
textures *and* structure hashes match exactly across the change, which was the
real risk when touching every material in the world.

## Things I own that are still open

- **A bus stop is a no-parking zone**, and my own red-kerb rule in
  `ct/tex-ground.ts` says red kerb marks exactly that — but the stop frontage
  is unpainted. Five lines, a third entry beside `HYDRANTS`/`KJUNC`. It is the
  kind of inconsistency this user spots.
- **Parking varies but never re-rolls.** `ct/rng.ts` seeds from a fixed
  constant, so "stable per session" is really "the same arrangement forever".
  Giving parking its own per-session seed costs 3 cars of noise in the
  scenedump `places` fingerprint. Your call.
- **`ct/hud.ts` is not in my owned list** but the night fix needed one line
  there (the overlay opacity). Flagging in case the desk has work in that file.
- No pair bus stop on the west walk, so northbound buses never stop; nobody
  waits at the stop or boards.

## Scripts I added (all take `SHOT_URL`)

```
scripts/kerb.mjs       shots | probe | walk     kerb, gutter, corner returns
scripts/bus.mjs        shots | walk | stop      the 42 and its stop
scripts/lamplight.mjs  shots | probe            lamp tint + night dynamic range
scripts/people.mjs     atlas | street | probe   the crowd
scripts/parking.mjs    probe | dist | shots     the parked row
```

`lamplight.mjs probe` and `parking.mjs dist` are the two worth keeping: the
first reads material colours off the scene graph and normalises brightness out,
so it tests whether a surface keeps its identity rather than whether a
screenshot looks right; the second simulates 4000 arrangements, because one
seeded session only ever shows you a single sample of a distribution.
