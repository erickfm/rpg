# w18 — item 33, "DEEP and REACH in three hand-typed copies"

**Root cause, one line:** the three copies do not exist — `DEEP` is declared
once and the two `REACH`es are different quantities that share a name, so there
was nothing to hoist; the one genuine duplication in the area is a different
constant in a different file.

## Measured before changing anything

```
$ grep -rnE "(const|let|var|export const)[[:space:]]+(DEEP|REACH)\b" --include=*.ts --include=*.mjs .
scripts/seat-facing.mjs:68:const REACH = 0.80;   // "furniture you are sitting AT" is this close
scripts/seat-facing.mjs:69:const DEEP  = 0.80;   // shallower than this and it is a back, not a table
scripts/A-verify-select-through.mjs:40:const REACH = 0.6;   // D's stated reach margin, over the spot radius
```

- **`DEEP`: one declaration.** Not three. Nothing to hoist.
- **`REACH`: two declarations, and they are not copies of each other.** 0.80 m
  is "how close furniture must be to count as furniture you are sitting at";
  0.6 m is the margin added to a spot's radius. Different quantities, different
  values, same five letters. Hoisting them to "one declaration" would have been
  actively wrong — it would weld together two unrelated numbers.
- The sibling constants of the seat-facing pair (`WALL_MIN`, `BEHIND_DEG`,
  `AHEAD_DEG`) also appear in exactly one file, which is a second confirmation
  that nothing was copied out of it.
- I also checked the **other branches**, since item 30's blocker turned out to be
  unlanded work invisible from here. No `DEEP`/`REACH` declaration exists on
  `worktree-agent-a8a1fd5beffc60b34`, `…ad0271eaabaa38440`,
  `…afedb4cb4a8630b12`, `audit/seams`, `feat/interiors2` or `live` either.

**w17's own handoff already said so**, in `notes/w17-seat-facing.md:154`:
*"No number in the check is a second hand-typed copy of a number the source
owns."* The row's premise is that w17 reported the opposite.

## The one real duplication, which is a different finding

`scripts/A-verify-select-through.mjs:40` hand-types `0.6`. That is
`src/proto/fp.ts:486`:

```ts
export const REACH_MARGIN = 0.6;
```

It is *exported*, so this is a genuine second copy of a number the source owns.
It could not simply be imported: the script is plain-node `.mjs` and `fp.ts` is
TypeScript, and although `crosstown.ts:27` imports `REACH_MARGIN` it does **not**
republish it on `__ct`, so there is no runtime path to it either. That is why it
was typed out, and the previous author was right to say where it came from.

What I did is what BUILDER-BRIEF §8 prescribes for exactly this case — *"copy it
with a line-number citation and queue a follow-up to hoist a shared export"*:
the constant now carries a `fp.ts:486` citation and a note naming the fix.

## Not fixed, and why

**The actual fix is one line, in a file this row does not grant me.** Add to
`crosstown.ts`'s `__ct` surface, beside `camY` and `yaw`:

```ts
reachMargin: () => REACH_MARGIN,
```

`REACH_MARGIN` is already imported there at line 27, so this is a pure
re-export. Then `A-verify-select-through.mjs` reads it off the live world and the
copy is gone for good — and so is the next one, because any future script can
ask instead of type. **Queued, not taken:** my row names "wherever DEEP/REACH are
declared", not `crosstown.ts`, and that file is the world's entry point.

## On the DONE WHEN

It asked for `fp before` / `after` / `fpdiff` to prove a pure refactor. **That
clause does not apply to these constants and I did not run it as theatre.**
`DEEP` and `REACH` live in `scripts/`, which is instrumentation — not in `src/`,
and nothing in `src/` was touched. They cannot move a pixel, so an fpdiff would
have been measuring the noise floor and reporting it as evidence. The stronger
proof is the diff itself:

```
$ git diff -U0 scripts/A-verify-select-through.mjs | grep -E "^[+-]const REACH"
-const REACH = 0.6;    // D's stated reach margin, over the spot radius
+const REACH = 0.6;    // = fp.ts:486 REACH_MARGIN — spot reach, over the spot radius
```

One file, comment-only, value unchanged. I read the clause as written on the
assumption that these were world constants; they are not, and that is worth the
desk knowing before it writes the same clause again.

## Verdict

The row is **satisfied as it stands** — exactly one `DEEP` exists, and the two
`REACH`es must stay separate. No refactor was correct to perform.
