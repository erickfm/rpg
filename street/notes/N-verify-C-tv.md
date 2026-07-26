# VERIFY C's "tv off unless i sit down to watch it" — it holds, on every state C listed

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. This is the evidence for whoever does.

Built bundle (`vite preview` 4195, build `a2059390d`), not the dev server —
GOTCHAS §28.

## The predicate, at C's own station

C published `scene.userData.tv.on` and listed the states. All of them:

| state | claimed | measured |
|---|---|---|
| on load | `false` | **`false`** |
| standing at the spawn | `false` | **`false`** |
| standing in front of the set | `false` | **`false`** |
| **seated** | `true` | **`true`** |
| seated, 2.5 s later | on | **on**, and the segment has advanced |
| **after a RESPAWN out of the seat** | `false` | **`false`** |
| out on the street | `false` | **`false`** |

**The respawn case is the one C said a toggle gets wrong, and it is right.** The
sit ends without a stand-up and the set still goes dark — because `on` is
derived from where you are, not remembered from what you pressed.

## The three things you can only see

- **It comes on rather than snapping.** Sampled at 60 ms while sitting:
  `warming` is true for the first six samples (~0.36 s) and false after, with
  `on` true throughout. So there is a real warm-up and it is not a flag nobody
  drives.
- **A fresh shuffled pack each sitting.** On load the pool is at `crosstown
  auto`, index 0; sitting jumped straight to `miracle mop`, index 7. You do not
  resume mid-pool.
- **Off is not black.** Standing in front of it, the glass is a dark grey-green
  with the case's beige plastic and the rabbit ears around it — it reads as a
  switched-off television, not as a hole cut in the wall. `shots/N/tv-e-off-facing.png`.

## And the lamp really is gone

C's strongest claim is the one about *"make the unilluminated stuff darker, it
should feel scarier at night"*: the set used to pool light on the boards of 301
all night because `props.ts`'s `addLamp` registry is build-time only.

Swept every additively-blended mesh in the walk-up above y = 4: eight, and all
eight are the hall/stairwell fixtures at `x = 201.2` plus one at floor-4 height.
**Nothing additive stands at the set's own position on floor 3.** The lamp is
removed, as claimed.

## One finding that is NOT C's, and needs an owner

`__ct.seated()` **goes stale across a teleport.** After warping out of the seat
it still returns `{ x: 197.9, z: -15.58, … }` while C's `tv.on` has correctly
gone false:

```
5 after respawn out of seat   on: false   __ct.seated(): { x: 197.9, z: -15.58, … }
```

That is C's design being *better* than the affordance C could have leaned on —
C's own ledger row says *"`__ct.seated()` exists but is a test affordance on the
entry point; a real `ctx.seated()` is worth asking F for"*, and this is the
concrete reason why. Anything that trusts `seated()` after a transition gets
yes.

`crosstown.ts` is desk-owned, so I have not touched it. Recording rather than
routing (GOTCHAS §23): no player can see this, and the one module that would
have been bitten by it derived its own answer instead.

— N
