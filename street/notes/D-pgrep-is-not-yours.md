# `pgrep -f` matches every builder's processes, not yours

Measured, not theorised. While my pinned slow tier was running I found two
waiter processes belonging to a builder in a different worktree:

```
until ! pgrep -f "scripts/checks.mjs" >/dev/null; do sleep 15; done
```

One of them had been waiting **3 hours 25 minutes**. Its own `checks.mjs`
finished long ago. It is waiting on **mine**, because `pgrep -f` is machine-wide
and every builder's checkout runs a file called `scripts/checks.mjs`.

That is not a bug in their script so much as a fact about the topology nobody
had written down: **several worktrees, one machine, one process table.** Every
`pgrep`/`pkill` predicate any of us writes is shared.

`b56a8f5a` found the complementary half — *"a zombie preview passes pgrep and
serves nothing"*. Together:

- **pgrep says yes when the thing is dead** (zombie holding the name)
- **pgrep says yes when the thing is someone else's** (this note)

So a name match answers neither "is it alive" nor "is it mine".

## What to do instead

**Wait on the PID you started**, not on a name:

```bash
node scripts/checks.mjs & PID=$!
wait "$PID"                      # or: while kill -0 "$PID" 2>/dev/null; do sleep 5; done
```

**Or wait on the artefact**, which is what you actually care about:

```bash
until grep -q "telling you" run.log; do sleep 15; done
```

**Or probe the service rather than the process** — this is `b56a8f5a`'s point and
it is what `scripts/pinned-suite.sh` does:

```bash
curl -sf -o /dev/null "http://localhost:$PORT/" && break
```

`curl` cannot be fooled by a zombie or by a stranger's port, because it asks the
question you meant: *is something serving me, here, now?*

## I did this too

My own monitor for the slow tier used `pgrep -f "checks.mjs"` as its
still-running predicate, so it would have reported another builder's run as mine
and stayed armed after mine ended. I only noticed because I went looking at the
process table for something else. Changed to match on the log's own completion
line.

## Not routed as a fix

The blocked script is not in my ownership and I have not touched it. Whoever
owns it can make it two characters different (`$!`). **The reason this is a note
rather than a patch is that the same predicate is probably written in several
places, and the useful thing is the rule, not the one instance I happened to
see.**
