# Every `[E]` above the ground floor is dead — one line, in D's LOS test

**Owner: D.** `crosstown.ts` is not mine, and the LOS test itself is D's — it
came in on the user's *"shouldnt be able to select things through objects
ever"* (`FEATURE-REQUESTS.md:` Inbox, routed to D). So this goes to D with the
patch already tested, not to the desk. It is a hard blocker on the 301 door item and it is
user-facing right now: **you cannot open your own apartment door in the live
world.**

## What is wrong

`crosstown.ts:883`, in the spot-selection loop:

```ts
const eye = new THREE.Vector3(px, 1.6, pz);
```

The eye is pinned to `y = 1.6` regardless of which storey the player is on,
while the thing it aims at is storey-aware:

```ts
aim.set(s.x, groundPick(s.x, s.z) + 1.1, s.z);
```

Stand at room 301's door on floor 3 and the line-of-sight ray is cast from
**1.6 m — inside the ground floor** — up to 6.5 m at the spot. It passes
through the floor slabs at 2.7 and 5.4 on the way, `canSee` returns false, and
the spot is never offered. Nothing throws, nothing logs; the prompt simply
never appears.

Ground floor is unaffected, because there `gy = 0` and 1.6 is correct. That is
why this survived: 425 of 431 interior spots are at `gy 0` and all of them
work.

## Where it came from

`git log -L883,883` blames **4d50e8a1a "Re-entry hysteresis: a door you just
used lets go of you"**, which introduced `eye` when it added the LOS test to
`pickSpot`. Before that commit selection was proximity-only and had no ray, so
storey never entered into it. It is a regression, not an old bug.

## The patch, tested

```diff
-      const eye = new THREE.Vector3(px, 1.6, pz);
+      const eye = new THREE.Vector3(px, apt.gy() + 1.6, pz);
```

`apt.gy()` is already in scope — `crosstown.ts:194` and `:734` both call it,
and it is the same source `pos()[3]` reports.

## Evidence, both directions

Measured on my dev server, `scripts/door301.mjs`:

```
  as it ships      4 of 12 clauses FAIL — every one downstream of the prompt
                     after E, doorway blocked          got false
                     standing in the swing, it offers  got null
                     E from inside the swing shuts it  got false
                     a pace back, prompt offers open   got null
  with the patch   12 of 12 pass
```

Reverted the patch and re-ran to be sure the four came back, and they did —
the same four, unchanged. The structural clauses (leaf on its pivot, doorway
clear at rest, spawn on floor 3) pass either way, so **the handing fix in
`ct/apartment.ts` is verified on its own** and is not waiting on this.

Directly, without the door in the way — warp onto a spot and read the prompt:

```
  room 301 door spot  (199.36, -17.45) gy 5.4   as it ships: NONE
  the sleep spot      (197.40, -15.80) gy 5.4   as it ships: NONE
  a lot chair         ( 24.70,   3.75) gy 0.0   as it ships: [E] sit down
```

The lot chair is the control: selection works fine, it is height that breaks
it.

## Worth checking when it lands

Anything else with storeys. The walk-up is the only multi-storey interior I
own, but if G's hotel has upper floors its `[E]`s are dead the same way, and
nobody would have seen an error there either.

## The blind alley, since it cost the most time

The prompt was null at a spot that `__ct.spots()` reported `ok: true`, and I
spent a long time assuming I had moved the spot somewhere unreachable when I
re-handed the door. `spots()` reports the **predicate**, `sp.ok()` — it says
nothing about range, occlusion, or whether the HUD will offer the thing. A
spot can be `ok: true`, standable, at exactly the coordinate you meant, and
still never selectable. What broke the deadlock was testing a spot in a
completely different module (the lot chair) and finding it worked.
