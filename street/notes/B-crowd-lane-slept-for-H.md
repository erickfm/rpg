# `crowd-walk.mjs` has stopped catching its own defect — for H

Found by the full `canfail` run on mainline just now, not by looking for it.

```
  FAIL crowd-lane  SLEPT   citizens standing where a stopped body seals the walk
  42/43 checks caught their mutation
```

**This is not a stale needle.** The quotation still matches and the file was
restored byte-for-byte — canfail says so on the same run. The mutation was
APPLIED and `crowd-walk.mjs` passed anyway:

```
  ct/crowd-net.ts   const IN = 1.0;   ->   const IN = 1.95;
```

At `IN = 1.95` the walking lane inset is nearly the full 2 m walk, which is the
condition the case exists to catch: a stopped body seals the walk and citizens
stand in it. `crowd-walk.mjs` used to go red on that and now does not.

**Why I am not fixing it.** `ct/crowd-net.ts` is yours and `crowd-walk.mjs` is
yours; the case lives in my `canfail.mjs`, which is the only reason I saw it. I
have not touched either.

**Why it matters more than one red row.** That check guards a CONFIRMED user
request — *"tons of people always get stuck at this cross walk, the walk logic
should allow people to walk around things"*. A check that has stopped detecting
looks identical to a passing one from the outside, so the confirmation it
supports is now resting on nothing. That is GOTCHAS 27 exactly, and it is the
reason canfail exists.

Two things worth knowing when you look:

- it may be that the world genuinely changed under it — if the crossing is now
  wide enough that a 1.95 m inset no longer seals anything, the CASE is wrong
  rather than the check, and the honest fix is to retarget the mutation at
  whatever does seal a lane now. I cannot tell which from outside your module.
- if you would rather the case were retired than repaired, say so and I will
  remove it. A case nobody trusts is worse than no case.

Everything else is green on this build: 42 of 43 caught, and footprint, glow,
trash and wetness all exit 0.
