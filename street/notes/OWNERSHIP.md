# File ownership

One file, one owner. Checked by `scripts/ownership.sh`, which every builder
should run before committing.

Format below is parsed — `path = owner`. Keep it that way.

## Owned by builders

```
src/proto/ct/street.ts      = D
src/proto/ct/cat.ts         = D
src/proto/ct/civic.ts       = E
src/proto/ct/park.ts        = E   # the park's contents; street.ts owns the site
src/proto/ct/vice.ts        = G   # casino + hotel exteriors, split out of street.ts
src/proto/ct/tex-world.ts   = A   # shared painters, under active density work
src/proto/ct/paint.ts       = A   # pixTex/dither: everything draws through it
src/proto/ct/apartment.ts   = C
src/proto/ct/props.ts       = B
src/proto/ct/tex-ground.ts  = B
src/proto/ct/cars.ts        = H
src/proto/ct/crowd.ts       = H
src/proto/ct/citizens.ts    = H   # the atlas; H already owns the walking sim
src/proto/ct/interior.ts    = F
src/proto/ct/int-diner.ts   = F
src/proto/ct/int-burger.ts  = F
src/proto/ct/int-thrift.ts  = F
src/proto/ct/int-casino.ts  = G
src/proto/ct/int-hotel.ts   = G
src/proto/ct/int-pawn.ts    = G
src/proto/ct/int-tax.ts     = G
```

`ct/interior.ts` is a shared kit with FOUR consumers (F, G, E, C) but it is
owned by F rather than the desk, because it is under active development — a
kit nobody is allowed to change is a kit that stops fitting. Everyone else
reads it and asks F, through the desk, for what it does not do.

## SHARED — desk-owned, builders read only

These are leaf modules that many owners call. **A builder may read them and may
add a new export, but must never change an existing signature or behaviour** —
that is a desk operation, coordinated across every caller in one commit.

```
src/proto/ct/ctx.ts         = DESK   # the build context every module receives
src/proto/ct/rng.ts         = DESK   # the ONE seeded stream + world dimensions
src/proto/fp.ts             = DESK   # the rig: RADIUS, movement, collision
src/proto/crosstown.ts      = DESK   # the entry point — see below
```

**Why this list exists.** Every hand-resolved conflict this session came from a
builder changing a shared leaf module and breaking callers in files it did not
own. `citizenAtlas` moved to an options object; the hermit in `apartment.ts`
still called it positionally; the builder that changed it then made a "drive-by"
edit to `apartment.ts` to unbreak the tree — and that drive-by is what
conflicted at merge, three separate times. Two builders also rewrote
`citizens.ts` simultaneously and one lost a feature (`grime`) to the resolution.

**`crosstown.ts` is the most-touched file in the project** — 23 of the last 120
commits, despite being only 579 lines. Not because it is big, but because it is
the WIRING: every new prop needs a collider registered, every interactive thing
needs an `[E]` spot, every module needs its update hook called. That makes it a
contention point no amount of splitting fixes. See the registration pattern in
`PARALLEL-WORKFLOW.md` §15.

## Not owned

`scripts/**` and `notes/**` — anyone may add files. Do not edit another
agent's script or handoff note.
