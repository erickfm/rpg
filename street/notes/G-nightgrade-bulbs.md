# nightgrade's one red is my blade-sign bulbs — intended, and the check is flaky

**For the author of `05694164a` (the 52/5 full-suite run), and for B, who owns
`props.ts`.** Measured at `05694164a` on a dev server at 4186, five runs.

## The headline that needs changing

`05694164a` closes with:

> Honest headline: 52 green, 1 flaky, 2 known and explained, 1 correct red
> catching real defects, 1 genuine one-material fault. Only nightgrade
> describes something wrong with the world.

Two corrections, both in my quarter, so this is mine to file.

**`nightgrade` is the second flaky check, not the one solid fault.** Five runs,
identical build, nothing else touching mainline:

| run | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| materials flagged | 1 | 0 | 1 | 0 | 1 |

Same alternation `seats-walk` shows, different mechanism, and the reason is
below. A suite that reports "1 genuine fault" on odd runs and "0" on even ones
is describing its own sampling, not the world.

**And "a degenerate 0.00x0.00" is a misreading of the check's own output.** The
shape field is built at `scripts/nightgrade.mjs:98` from
`g.width`/`g.height`, which only exist on plane- and box-like geometries:

```js
shape: `${(g.width ?? 0).toFixed(2)}x${(g.height ?? 0).toFixed(2)} tex ...`
```

`0.00x0.00` means **the geometry has no width or height parameter at all** — not
that it has zero size. The object is a `SphereGeometry(0.075, 6, 4)`. Nobody
should go looking for a zero-area mesh at 48.8,3.8,-97.7; there isn't one. Worth
a one-line change in the check to print the geometry type when the params are
missing, so the next reader isn't sent after a ghost.

## What it actually is

`ct/vice.ts:442-466` — the chase bulbs shared by GOLDEN ACES' blade and HOTEL
ORPHEUS' porte-cochère. Three shared phase materials plus one dud:

```ts
const PHASES = 3;
const chaseOn = new THREE.Color(0xfff2c0), chaseOff = new THREE.Color(0x6a5a3a);
const phaseM = Array.from({ length: PHASES }, () => new THREE.MeshBasicMaterial({...}));
ticks.push((n, t) => {
  const step = Math.floor(t * 6) % PHASES;
  for (let i = 0; i < PHASES; i++) {
    const on = i === step;
    phaseM[i].color.copy(on ? chaseOn : chaseOff);     // ← absolute, every frame
    phaseM[i].opacity = on ? 1 : 0.55 + 0.30 * n;
  }
});
```

`dimWorld` grades these — they are not skipped, because the only skip is
`isGlass`, which is `m.blending === THREE.AdditiveBlending` (`props.ts:217`) and
these are normal-blended. So props writes a graded colour and my tick overwrites
it a moment later with an absolute one. The bulb colour is therefore **identical
at 13:00 and 23:00 by design**, which is precisely the condition `nightgrade`
tests for.

Sampled over 150 rendered frames at each hour, using `lib/clock.mjs`'s
`setClock` rather than a guessed sleep:

| | 13:00 (night 0) | 23:00 (night 1) |
|---|---|---|
| lit phase | `#fff2c0 @1.00` | `#fff2c0 @1.00` |
| unlit phase | `#6a5a3a @0.55` | `#6a5a3a @0.85` |
| dead socket | `#4a453e @1.00` | `#151310 @1.00` |

**This is the behaviour the brief asks for.** These two buildings are the only
light sources in the world; a bulb that dimmed with the night would be a bulb
that isn't a light. The opacity ramp does fire (0.55 → 0.85, so unlit sockets
read *more* at night), and the dead socket is graded and dims correctly, which is
also right — a dud is a dark object, not a light.

**Why the count alternates.** `nightgrade` samples one instant per hour. Each
phase material is lit one frame in three, so whether a given material looks
"unmoved" depends on where the chase happens to be at the two sample instants.
All three have the same property; between zero and three of them are visible to
any single run. Expected value is about 1.7, observed 1,0,1,0,1.

## The actual gap, which is one line in a file I do not own

The bulbs are self-lit and there is no way to say so. `props.ts:420`:

```ts
const selfLit = isSelfLit(m.map);
```

`isSelfLit` reads texels off a texture. My bulbs are untextured — they are lit by
their driver, not by their artwork — so the heuristic cannot see them and there
is no author-side declaration to fall back on. The comment at `props.ts:421-427`
already describes exactly this problem for the textured case:

> A sheet held at FLOOR_SIGN is graded and deliberately kept bright, which from
> outside is indistinguishable from a sheet that was never graded at all — and
> scripts/nightgrade reports the second as a bug.

An untextured author-driven light is the same situation with no way out of it.

**Suggested, B's call:**

```ts
const selfLit = isSelfLit(m.map) || m.userData.selfLit === true;
```

That is not just check-silencing — it changes real behaviour for the better. It
gives the bulbs `floor: FLOOR_SIGN` and `wetK: 0` instead of a floor computed for
masonry at y 3.8, and drops them out of `pool`, which they currently join
(`poolable` is true for them: y < 4.5 and span 0.15 < 6), so a passing lamp
currently warms a material whose colour is overwritten a frame later.

If B takes it, I set `userData.selfLit = true` on `phaseM` in `vice.ts` in the
same landing and the flake goes away for the right reason.

## What I deliberately did not do

I could have silenced this from inside my own file three ways, and all three are
tricks:

1. **Set `m.userData.selfLit = true` today.** `nightgrade` filters on it and the
   red would vanish. But `props.ts:427` only ever *writes* that flag and never
   reads a pre-existing one, so the dimmer would carry on grading the material
   with a masonry floor. The check would go quiet and nothing would be fixed.
2. **Give the bulbs a texture** bright and saturated enough to trip `isSelfLit`
   (>8% texels with `max>199` and `max-min>26`). `#fff2c0` clears it easily. But
   `MeshBasicMaterial` multiplies colour by map, so I would then be pre-dividing
   my chase colours to cancel a texture that exists only to fool a heuristic.
3. **Make them `AdditiveBlending`** so `isGlass` skips them. That is the one
   supported skip I control, and it is wrong: two-thirds of the bulbs at any
   instant are unlit sockets, and an additive socket is not a socket.

None of these are fixes, so none of them are here.

## Corrections to my own earlier readings in this note's making

- I first reported the ramp as dead — "`n` is 0 at 23:00, the night ramp never
  fires". That was my probe: I called `window.__ct.setHour(23)`, which does not
  exist, through `?.`, so it was silently a no-op and I measured an unchanged
  world twice. The real entry point is `window.__ct.clock(h, m)`, and
  `lib/clock.mjs` already wraps it and waits on rendered frames. GOTCHAS §26 is
  about proving which world you are in; an optional call to a method that isn't
  there is a way to fail that test while looking like you passed it. **An `?.`
  on a world API you did not verify is a silent no-op, not a safety net.**
- I came into this carrying `isGlass` as `m.transparent && !(m.alphaTest > 0)`.
  It is `m.blending === THREE.AdditiveBlending` (`props.ts:217`). My bulbs are
  transparent with no `alphaTest`, so under the remembered version they would
  have been skipped by the dimmer and there would have been nothing to explain —
  I would have closed this as "not mine" in a minute. I checked it only because
  the measurement said `graded: true` and the remembered rule said it could not
  be. **When a remembered rule and a measurement disagree, the rule is the thing
  to go and re-read**; it costs one grep and it was wrong.
