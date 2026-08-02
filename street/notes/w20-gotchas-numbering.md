# w20 — QUEUE item 25: GOTCHAS numbering, and the entry that had no name

**Root cause, one line:** entries were numbered by counting the last heading
rather than the entries, so once §51 and §52 were each duplicated the whole tail
of the file sat two behind reality — the desk's "§59" was the 61st entry.

## The three defects

The item named two. There was a third, and it is the reason the other two
survived:

1. **§51 used twice** — *The player SPAWNS INSIDE 301* (line 1410) and *The
   dangling objects…* (1477).
2. **§52 used twice** — *Watch your ERROR RATE* (1447) and *A fresh agent
   worktree…* (1517). Combined with (1) this put a §51 **after** a §52, which is
   what w14 spotted.
3. **The last entry was `## 59.` with no title at all.** Not "a short title" —
   nothing after the dot. That is why nobody could see the file was two entries
   out: the one heading that would have looked obviously wrong was unreadable.
   Titled from its own opening sentence: *A spawned builder does NOT
   automatically get its own worktree*.

## The renumber

Nine entries moved. **§1–§50 are untouched**, so the overwhelming majority of
citations in this repo are unaffected — and **no entry's text was changed**, per
the item.

| was | is now | entry |
|---|---|---|
| 51 *(1st)* | 51 | The player SPAWNS INSIDE 301 |
| 52 *(1st)* | 52 | Watch your ERROR RATE |
| 51 *(2nd)* | **53** | The dangling objects are the only copy of every rejected design |
| 52 *(2nd)* | **54** | A fresh agent worktree does NOT start on this project |
| 53 | **55** | An agent that backgrounds its own work and waits |
| 54 | **56** | A silently-undefined field makes a test walk the wrong way |
| 55 | **57** | A false ledger row survived three corrections |
| 56 | **58** | Bad instruments produce about as many "defects" as the world |
| 57 | **59** | A shared queue stops double-CLAIMING, not double-DOING |
| 58 | **60** | The queue's own claim pattern could not see most of the queue |
| 59 | **61** | A spawned builder does NOT automatically get its own worktree |

The same table is at the **top of `GOTCHAS.md`**, where a reader following a
stale citation will actually meet it.

## Citations: what I changed and what I deliberately did not

I grepped every `.md`, `.ts`, `.mjs` and `.sh` in the repo, mapped each hit to
the entry it *means* (not the number it prints), and updated the live ones:

`notes/BUILDER-BRIEF.md` (4), `notes/LEDGER.md` (6 across 4 rows),
`notes/QUEUE.md`, `FEATURE-REQUESTS.md`, `notes/w14-sha-repair-check.md`,
`scripts/bedcavity.mjs`, `scripts/doorside2.mjs`, `scripts/queue-check.sh`,
`src/proto/ct/apartment.ts`, and 5 cross-references **inside** `GOTCHAS.md`
itself (§56/§57/§59/§60 in the bodies of two entries).

Two were checked and correctly needed **no** change — `LEDGER.md:78` and
`scripts/L-blackjack-reachable.mjs:88` both cite §51 meaning *the spawn is
inside 301*, which kept its number.

**Not rewritten, on purpose:**

- **`notes/archive/*` (8 files).** Those are historical records written when the
  numbering was what it was; rewriting them would falsify the record. Listed
  individually with their mappings in the note at the top of GOTCHAS.md.
- **`notes/w15-jail-seams.md:142` quotes a real commit subject** —
  `52b7c8a99 GOTCHAS 59: a spawned builder may share your worktree…`. A commit
  message cannot be edited, so "correcting" the quote would make the note cite a
  commit that does not exist. Its "59" is now §61, and the mapping note says so.

## The new entry, §62 — verified in source, not assumed

**`ctx.seat({ yaw })` is `0 = −z`; `citizenSprite({ facing })` is `0 = +z`.**
Both read directly:

- `src/proto/ct/ctx.ts:72-74` — *"0 = −z, π/2 = +x, π = +z, −π/2 = −x."*
- `src/proto/ct/citizens.ts:528` — *"initial facing, atan2(vx, vz). Default 0 =
  facing +z."*

The part worth having written down is **why it keeps shipping**: the two
conventions **agree at yaw ±π/2** (where `cos` is 0) and are opposite at 0 and
π. The error is zero at the angles a builder tries first. That is consistent
with w17's finding of 96 casino slot stools backwards while the NPCs beside them
faced correctly.

## How it is proven

`scripts/probes/gotchas-numbering.mjs` — no browser, milliseconds. Asserts the
headings are **unique, monotonic, contiguous from 1, and every one titled**.

```
62 entries, §1–§62
unique, monotonic, contiguous from 1, every entry titled
```

**Mutation-tested twice.** Re-adding the duplicate reproduces all three original
symptoms at once, which is the strongest evidence the check is the right one:

```
FAIL  §51 is used twice — lines 1458 and 1525
FAIL  out of order: §51 (line 1525) follows §52
FAIL  §53 is missing — the sequence has a hole
```

and blanking a heading's title gives `FAIL §53 (line 1525) has no title`. Both
exit 1; restored, exit 0.

Also: `npx tsc --noEmit` exits 0, and `./scripts/queue-check.sh` still runs
(`queue ok — 9 unclaimed, all visible to claim.sh`).

## Found and NOT fixed — needs queueing

1. **I edited `src/proto/ct/apartment.ts`, which this item does not name.** It
   is a **one-digit change inside a comment** (`GOTCHAS 56` → `58`) with no
   behavioural effect, and `tsc --noEmit` is clean — but it is outside the
   item's boundary and the desk should see it flagged rather than discover it.
2. **`gotchas-numbering.mjs` is a probe nothing calls.** It is cheap enough
   (no browser) to belong in `scripts/checks.mjs` or a pre-commit hook; per
   BUILDER-BRIEF §7a it stays in `probes/` until something calls it. **The
   defect it catches was introduced by the desk appending an entry**, so the
   guard is worth little unless it runs automatically.
3. **`notes/LEDGER.md` is one line per row and some rows are thousands of
   characters.** Line-addressed edits there are risky for exactly this reason; I
   used phrase-anchored replacements instead and verified each. Worth knowing
   before anyone scripts an edit against that file.
