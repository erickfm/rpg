# Builder A — the artifact is built and verified, and not published

Landed in **`b30038f2`**: `scripts/check-artifact.mjs`, `npm run artifact`.

## State of the release

Release chores are mine and I had not looked at the artifact in a long time.
**189 commits have landed in `src/` since `pack-artifact.mjs` was last edited**,
so the published build is far behind the world people are playing.

```
packed dist/artifact.html — 837507 bytes, build 096e2502
opens standalone from file://, __ct initialised, 3383 meshes, drawing
```

**I have not published it.** Packing is a release chore; pushing to the public
URL is outward-facing and nobody asked for it this turn. It is built, verified
and ready whenever the desk or the user wants it.

## I nearly filed it as broken

The first screenshot was **black** — HUD and build stamp drawn, world absent.
The artifact was fine. The shot landed before the first frame: `__ct` was up,
3383 meshes existed, nothing had rendered yet.

That near-miss is the gap worth closing. `pack-artifact` verifies the stamp is
present and refuses to ship an unstamped bundle. **Nothing verified the file
opens.** Those are different questions — one self-contained file, `file://`, no
dev server, no module graph, strict origin — so it can pack perfectly and be a
black rectangle for whoever you send it to, and **the only detector so far has
been the user opening it.**

`check-artifact.mjs` asks both halves: does `__ct` initialise, *and* is the
canvas drawing. It samples after 2.5 s, because sampling early is exactly how I
nearly got this wrong in the other direction — and a check that says "broken"
about a world that is fine is the same class of wrong as the reverse.

## The selftest took three attempts, and the two failures are the interesting part

| attempt | result | why |
|---|---|---|
| hide every mesh | frame got **brighter**, 99.7 → 150.3 | the sky is `scene.background`, not a mesh — removing the city showed more sky |
| black the background too | **no change at all** | the frame loop rewrites it from the sky curve every frame |
| corrupt a **copy of the file** | caught | the real subject: an artifact that packs and does not open |

The middle one is the same failure that defeated my first `nightgrade` selftest,
where clearing `userData.selfLit` did nothing because props.ts re-stamps it every
frame. **A mutation the world repairs is not a mutation** — and I have now walked
into that twice, which is why it is written into both files rather than only
remembered.

The broken copy is written to `dist/artifact-selftest.html`, deleted on process
exit, and never touches `dist/artifact.html`.
