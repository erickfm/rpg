# Instruments that cannot be aimed — the size of it

H could not run `scripts/footpaint.mjs` against its own world because the script
hardcoded a port. Fixed, and then swept the whole of `scripts/` for the same
shape, because the desk would rather know the scale than take these one blocker
at a time.

## 1. PORTS — 61 found, 60 fixed

`footpaint.mjs` hardcoded `http://localhost:4184/`, **the auditor's port**. Every
builder runs on its own port from 4178 up, so the script could only ever measure
somebody else's build.

This is a documented family: GOTCHAS 26 records `24163f69` finding **55 of 60**
scripts running a bare `p.goto('…:4184/')`. Sixty-one had it again — either the
sweep missed them or they were written after it.

All 60 that share the one shape now take an override, **default unchanged** so
nothing that already calls them behaves differently:

```js
goto(process.env.SHOT_URL ?? 'http://localhost:4184/')
```

`footpaint.mjs` additionally takes a bare port as `argv[2]` and prints the URL
it measured, since it was the blocker:

```
node scripts/footpaint.mjs 4188
SHOT_URL=http://localhost:4188/ node scripts/footpaint.mjs
```

Both verified against a live world: *"footpaint: measuring
http://localhost:4188/ · figures read from the atlas: 45"*. All 413 scripts pass
`node --check`.

**One left, deliberately: `twoworlds.mjs`.** It targets 4185 and 4184 *on
purpose* — dev against preview is the comparison it exists to make. It needs two
targets, not one, and that is its author's call rather than a mechanical
substitution.

## 2. PATHS — no functional faults

Nothing to fix here, which is worth saying so nobody re-greps it:

- **`lane3.mjs`** matches `/home/erick` only inside a **comment** explaining that
  4184 belongs to another worktree. Not a hardcoded path.
- **`desk.sh`, `land.sh`, `board.sh`, `desk-watch.sh`, `builder.sh`,
  `live-integrate.sh`, `route.sh`** carry absolute paths legitimately — they are
  the desk's orchestration and their job is to know the worktree layout.

## 3. BUILDS — 122 scripts cannot say what they measured

The bigger remaining number, and the one I would look at next:

```
413  scripts in scripts/
394  open a browser
272  call reportWorld  →  prove which build they read
122  do NOT
```

Those 122 can now be *aimed*, after the port fix, but still cannot tell you what
they *hit*. That is precisely the gap GOTCHAS 26 exists for — *"do not infer
which world you are in, ask it"* — and exit 3 for a wrong world (GOTCHAS 32) is
the mechanism they are missing.

**I have not bulk-added `reportWorld`**, and that is a judgement rather than
laziness: it changes behaviour. A script that quietly measured a stale dist
today would start aborting with exit 3, which is *correct* but is a different
result than its caller expects. Sixty silent behaviour changes at once is how a
suite loses trust. It wants doing in batches with each one watched, or by the
authors.

## The family this belongs to

The desk named it: this is the second tooling fault this session where an
instrument could not be pointed at the world in question. The first was
`reach.mjs` seeding its flood fill outside its own grid and reporting the whole
world unwalkable **at exit 0**.

An instrument that cannot be aimed, and one that cannot fail, are the same
defect wearing different clothes — in both cases the tool returns something that
looks like a measurement and is not one. Worth pairing with GOTCHAS 34's *"a
check can pass because it found NOTHING TO CHECK"*, which is the third face of
it.
