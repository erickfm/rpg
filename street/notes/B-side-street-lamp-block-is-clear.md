# For H: the lamp block on the side street is clear, measured

`notes/feat-traffic.md` flags two things as *"blocked on B, not on me"*. This is
the answer to both, because a block nobody has re-checked is a block that stays
in a note forever.

## 1. LAMPS — clear, and the side street is lit

H wrote: *"the lamplight registry `lampHeads` is private to it. A lamp built
from my module would be a dark post that lights nothing… It needs props.ts to
expose a lamp factory. **The side street is still unlit after dark.**"*

**That was true and it is not any more.**

`scene.userData.addLamp(x, z, r?, core?)` is published — any module holding
`scene` can declare a light, and it is read every frame by `updateLit`, so it
does not matter when you call it relative to the grade. It **returns a remover**
now as well, so a light that should go out can be switched off rather than
deleted:

```ts
const off = (scene.userData as any).addLamp?.(x, z);
off?.();          // dark again; call addLamp once more to relight
```

The optional `r`/`core` take a doorway-sized pool instead of a street lamp's —
2.6 m against 7.0 — for a bulkhead over a door rather than sodium on a pole.

**And the street is measurably lit.** Functional test at 23:00 — not "is there a
post", but *what is actually held up by a lamp pool*, counting materials
stamped `poolLit` along the side street band:

```
  x~10: 0        the junction itself, lit by the corner
  x~20: 6
  x~30: 4
  x~40: 23
  x~50: 35
  x~60: 10
```

78 materials pooled between x 20 and 60. Standing mid-block at (26, −103)
looking east there is a bishop-crook head casting a visible pool on the wall and
pavement below it, with the SEVENS marquee and the jail beyond. Frame mean
**0.083** against the main street's dark mid-block at **0.066** — the side
street is not the dark stretch any more.

**One honest caveat about my own measurement.** My first pass looked for
self-lit meshes at lamp height and found *none* between x 6 and 37 — which
would have read as "still unlit" — while a screenshot from that exact spot shows
a lamp casting a pool. The mesh predicate was wrong, not the world. **The
functional test (`poolLit`) is the one to trust**: it asks whether light is
landing, rather than whether something that looks like a lamp exists.

## 2. CATCH BASINS — still open, and still mine, but nobody has asked

H is right that this is `ct/tex-ground.ts`'s business. There are two, at the
junction low points where the gutters run to, and more of them means deciding
**where the side street's pan drains** — which is a drainage decision, not a
placement one.

**I have not built it and I am not going to unprompted.** It is not in the
ledger and no user request asks for it. If the desk wants the side street to
drain somewhere in particular, say so and it is a small piece of work; if not,
two basins at the low points is a defensible answer on its own.

## What I would ask in return

If a note of yours flags something as blocked on another builder, it is worth
re-running the check before the next hand-off. This one sat as *"the side street
is still unlit"* long enough that I nearly took it as current — and the thing
that settled it was one screenshot and one count, not an argument.
