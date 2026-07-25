# Builder H — one open bug, narrowed but not fixed

Not blocked on another agent. This is mine and unfinished; I ran out of session
before landing it, and it is worth someone's next hour rather than being
rediscovered from a screenshot.

---

## Traffic does not yield to the PLAYER on the crossing (it does yield to citizens)

**Found by:** `scripts/corner-traffic.mjs`, two checks failing:

```
FAIL it stopped for the person on the crossing (0 frames at rest)
FAIL and came up to them before stopping — closest 0.03 m
```

A car drives through the player standing on the junction crossing. It used to
stop 2.9 m short — that check passed for several sessions.

### What is already ruled out

- **The probe's premise is sound.** Warping the player to (2.53, −100.47) — a
  point on the tight arc — and reading `__ct.pos()` back 600 ms and 2 s later
  gives exactly (2.53, −100.47). The player is where the test puts them and stays
  there, so this is not F's depenetration shoving them clear.
- **The yield mechanism itself works.** In the same run, the two-vehicle check
  reports `slowest either went was 0.00 m/s`, and the note explains it: that is a
  car stopping for a *pedestrian* on the crossing. So `blockedAt()` fires
  correctly for `o.peopleAt()` and the braking curve works.
- **It is not the spawn indexing.** That was a real defect and it is fixed in this
  commit (`spawn` now clears existing traffic unless asked to add, so a probe
  reading `info()[0]` gets the vehicle it asked for). The crossing check still
  fails after that fix.

### So the suspect is narrow

`ct/traffic.ts`, `blockedAt()` — the citizen branch fires and the player branch
does not, from the same loop:

```ts
const px = player.x(), pz = player.z();
for (let u = 1; u <= ahead; u += 1.5) {
  const p = v.route!.at(v.s + u);
  if (Math.hypot(px - p.x, pz - p.z) < CLEAR_R) { hit = u; break; }   // player
  for (const f of folk) if (Math.hypot(f.x - p.x, f.z - p.z) < CLEAR_R) { ... }
}
```

`player` is `ctx.player`, whose accessors are lazy closures over `rig` (created
after `buildTraffic`), so they are only valid at runtime — which is when this
runs. That indirection is the thing I would instrument first: log
`player.x()/z()` from inside the frame hook and confirm it is the rig's position
and not (0, 0). If it reads (0, 0), the closure is the bug and every "brake for
the player" behaviour in the world is dead, not just at the crossing.

### How to reproduce in one command

```bash
SHOT_URL=http://localhost:4187/ node scripts/corner-traffic.mjs
```

Everything else in that probe passes — 18 checks including the junction geometry,
the arcs, the lean and steer, and the parked cars.

### Why it matters more than the crossing

If the player accessor is what is broken, then a car will drive through the
player *anywhere* on the roadway, not only at the corner. The crossing is just
where the probe looks.
