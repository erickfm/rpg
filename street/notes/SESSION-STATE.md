# Where things stand

Snapshot for whoever picks this up next. If it is stale, trust
`./scripts/queues.sh` and `git log` over this file.

## Health

- mainline `add-stick-and-city98` — tsc clean, build clean
- live world on **5177** — verified initialising
- all builders idle, nothing uncommitted, nothing unmerged

## What just landed (the parallelism work)

The entry point `crosstown.ts` was the most-contended file in the project —
580 lines but 23 of the last 120 commits — because it was the **wiring**: every
interactive object registered its `[E]` spot there, and every module's per-frame
work was called there by name. Both are now **registration**:

- `ctx.spot({...})` — a module owns its own interactions
- `ctx.onFrame(fn, ORDER.X)` — a module owns its own per-frame work, with run
  order an explicit property of the hook rather than an accident of build order

Adding a door, or anything that animates, now touches one file: the one that
owns it. Verified structurally identical and behaviourally (doors teleport,
rain still world-locked).

Supporting tooling, all in `scripts/`: `land.sh` (merge train), `queues.sh`
(who is doing what), `ownership.sh` (boundary check), `live-integrate.sh` (the
playable world, typecheck-gated), `doortest.mjs`, `rain-check.mjs`,
`health.mjs`.

## Queued work, by owner

Run `./scripts/queues.sh` for the live view. At the time of writing:

- **B** (`../rpg-ground`) — get green first, then the lighting tint (cars go
  brown under lamps), flat night, remove the van, bus bench geometry, parking
  variance, migrate its `[E]` spots
- **C** (`../rpg-entrance`) — hermit clipping + grime, paper-thin walls, 301
  needs a door leaf, ceiling lamps, migrate its spots
- **D** (`../rpg-alley`) — bodega door legibility, crates need filling with
  produce, church tower removal, three sign bugs, shop resizing, window lights,
  the corporation, migrate its spots
- **auditor** (`../rpg-audit`) — seam sweep round 2 is in
  `notes/seam-audit.md`

## The biggest open item

The seam audit's **pattern #1**: texture density is computed per-mesh in
isolation, so no two neighbours agree on px/m. That is one bug wearing dozens of
faces. `ct/tex-ground.ts` already solves it for the ground (world extents in,
repeat + offset out) and is the model to copy for masonry. This is a desk
operation — it changes a shared contract across every wall painter.

## Not done

- Build stamping (a commit sha in-frame). Stale-build feedback has cost real
  work twice.
- The artifact and GitHub Pages have not been republished in hours.
