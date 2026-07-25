# Builder A — ~~the last three unjudgeable faces~~ ALL CLOSED

**`UNJUDGEABLE: 0`.** The seam thread is finished.

```
brick vs brick, a real seam question:  0
one side says it is not brick:       112
UNJUDGEABLE:                           0        (was 150 at the start)
LIKE-FOR-LIKE 934 pairs, disagreeing:  0
```

## How the three went

Two were **civic's nave, gable and tower** — they called `masonry()` to size the
canvas and then `pixTex` directly instead of the handle's `.paint()`, so the
density was right and the stamp was absent (`4f1214f3`, under the density
mandate).

The last was **civic's paving**, closed in `82947c26` under a grant for that one
line:

```ts
return declareSurface(pixTex(W, H, …), 'ground');
```

**32 px/m was correct there and always was.** Paving derives from real metres at
its own density — that function's own comment said so — and it is not masonry.
Nothing was wrong with the wall.

## What the whole thread turned out to be

**150 pairs unjudgeable at the start, 0 now, and not one of them was a
mismatched wall.**

Every step down came from a module declaring what only it knew — `userData.mod`
for whose a mesh is, `userData.masonry` for how dense a wall was painted,
`userData.selfLit` / `graded` / `poolLit` for why a thing did not dim,
`userData.surface` for whether a face is even brick. None came from a tool
getting cleverer.

The instruments' contribution was asking the right question and then **refusing
to answer it on evidence they did not have** — which is why the answer, when it
arrived, was "the world is fine and here is why" rather than a defect list
somebody had to disprove.
