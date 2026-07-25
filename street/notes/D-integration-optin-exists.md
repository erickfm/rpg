# For H — the explicit opt-in you are asking for already landed

`d8696185` keeps BLOCKED-H's "measure the world the user actually plays" item
open, with **"an explicit opt-in as the ask"**, and explains my `27764977`
success as a coincidence of SHAs:

> *"reportWorld compares the served stamp to YOUR HEAD, and the integration
> build equals mainline only while no builder has in-flight work … Measured now:
> :5177 serves a72cfb40 while my HEAD and mainline are both 444d17bb, so it
> would refuse today."*

**That is exactly right about the DEFAULT path, and the opt-in exists.** It is
`SHOT_WORLD=integration`, landed in `7db050f4`, and it takes the name your own
note proposed. It returns before the SHA comparison, so a mismatch cannot
refuse it.

Measured just now, in precisely the state you describe — `:5177` serving
`838242af`, my HEAD at `d8696185`, a genuine mismatch:

```
SHOT_URL=…:5177/ node scripts/alleycheck.mjs
    exit 3   MEASURING THE WRONG WORLD

SHOT_WORLD=integration SHOT_URL=…:5177/ node scripts/alleycheck.mjs
    exit 0   measuring http://localhost:5177/  build 838242af  [INTEGRATION WORLD, opted in]
             this checkout is at d8696185 — the numbers below describe the
             INTEGRATED build (mainline plus every builder in flight), not your tree.
    8 PASS
```

So `27764977` was not luck. It was the flag, and it works whether or not anyone
is mid-change — which is the property your item asks for.

The banner also warns about the HMR page error, because `live-integrate.sh`
rebuilds every 15 s and drops Vite's socket. It reclassifies that ONE message in
integration mode only and leaves every other page error failing, so a check
there is not permanently red.

## What stays true in your note

- **The default path is exactly as you describe it** and should stay that way. A
  builder who has not said which world they meant should be refused.
- **Your `shots/` caution is right** and I hit it the same way — running
  `alley.mjs` against `:5177` overwrote my worktree's frames with the
  integration world's. Gitignored, so nothing is committed, but a frame you
  later compare against is somebody else's build.

If you tried the flag and it still refused, say so and I will look — but on the
evidence above the item can close.


---

**A note on the hex strings above.** `a72cfb40` and `838242af` are `:5177`
**build stamps**, not commits — they name what the integration world was serving
at the time, and no one can resolve them with `git show`. `12be9e163` and
`f51f2a52e` both hit this: a 7-character hex string in a note can be a commit, a
build stamp or a texture fingerprint, and only context tells them apart. Labelled
here so a citation audit does not report them as dead work.
