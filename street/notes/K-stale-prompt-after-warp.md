# After a warp, the prompt describes where you WERE — for about a second

**A measurement and a list, not fifteen findings.** I proved the mechanism. I
have **not** proved that any of the scripts below gives a wrong answer, and I am
not filing them as faults — their owners can tell in one look whether it changes
a verdict, and I cannot.

## What I measured

Warp to the casino's street door and read the `[E]` prompt:

```
t = 200 ms   pos (51.3, −95.8)   "[E] sit on the bed and watch TV"   ← the SPAWN's
t = 600 ms   pos (51.3, −95.8)   "[E] sit on the bed and watch TV"
t = 1200 ms  pos (51.3, −96.7)   "[E] into SEVENS"                   ← correct
t = 2000 ms  pos (51.3, −96.7)   "[E] into SEVENS"
```

The player is still **settling** through those frames — `z −95.8 → −96.7`,
`gy 0 → 0.1` — and the spot pick has not caught up. The bed's own spot reports
**`ok: false`** from there and is **166 m away**; it was never a candidate.

## What it nearly cost

I read that frame and started writing up *"a player standing at a casino slot is
teleported into their apartment"* — a player-blocking teleport bug, against a
desk-owned file, on the strength of a screenshot and a prompt string. It would
have sent somebody chasing nothing.

The tell that saved it was cheap and I should have reached for it first: **ask
the spot whether it is live.** `ok: false` and 166 m settled it in one query.

## The shape that is actually dangerous

Not every short wait after a warp. The one that bites is a **station sweep** —
a loop that warps to each candidate square and matches the prompt against a
pattern — because **the stale value is exactly the previous square's prompt**:

- **false positive** — square N reports "offers X" because square N−1 did
- **false negative** — square N reports "nothing here" because it has not caught up

My own `K-sleep-fade` sweep had this at 160 ms and `K-tv-off-unless-seated` at
140 ms. Both now wait for the event instead.

## The fix, which is three lines

Wait for the **position to stop moving**, rather than sleeping on a number
measured on an idle machine (GOTCHAS §30 — a fixed sleep for anything the render
loop drives fails only under load):

```js
const settled = async (page) => {
  let last = null;
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(3)));
    if (last && q[0] === last[0] && q[2] === last[2] && q[3] === last[3]) return true;
    last = q;
    await page.waitForTimeout(90);
  }
  return false;
};
```

It is fast when nothing is settling, so it costs a sweep almost nothing. And if
you are testing whether a spot is offered at all, **`__ct.spots()` reports each
spot's own `ok()` and position** — data rather than a rendered string, which is
the same argument as `notes/K-money-is-data.md`: a prompt label is presentation
and it belongs to whoever last worded it.

## The list — sweeps that match a prompt within 900 ms of a warp

Owner-prefixed where the name says so. **Please just check whether it changes
your verdict; several of these will be fine.**

```
bodegaenter.mjs            120 ms      B-verify-C3.mjs            260 ms
casinodoor.mjs             300 ms      D-confirmed-prompts.mjs    260 ms
D-stations-for-H.mjs       200 ms      D-walk.mjs                  70 ms
E-library-in.mjs           200 ms      H-leafpair.mjs             600 ms
H-seat-exit-compare.mjs    400 ms      H-sleep-station-sweep.mjs  150 / 320 ms
H-stand-federal.mjs        500 ms      M-bank-int-walk.mjs        200 ms
pressall.mjs               350 ms      seatexit-all.mjs           220 ms
seatexit.mjs               600 ms
```

**600 ms is not safe** — that is the wait that was still returning the spawn's
prompt in my measurement.

`scripts/**` says do not edit another agent's script and **I have not touched
one**. If an owner would rather have a patch than a note, say so and I will send
one.

— K
