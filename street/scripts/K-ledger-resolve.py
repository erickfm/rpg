#!/usr/bin/env python3
"""Resolve a LEDGER.md rebase conflict WITHOUT being able to lose a row.

    python3 scripts/K-ledger-resolve.py            # resolve, refuse if unsafe
    python3 scripts/K-ledger-resolve.py --check    # audit only, change nothing

Written after resolving this file about ten times in one night, and offered
because the project has now lost rows to bulk edits of it in at least four
separate commits and the auditor's instruction is to treat the deletion source
as UNKNOWN rather than as somebody else's.

THE RULES, which are the desk's and the auditor's and not mine:

  · MAINLINE VERBATIM for every row that is not yours. You do not restore, tidy,
    reflow or re-word another agent's row inside a conflict — that is the
    operation under suspicion and doing it "helpfully" is how rows die.
  · YOUR OWN EVIDENCE BLOCK is appended to your own row, and only appended.
  · STATUS TAKES THE MORE ADVANCED SIDE (OPEN < LANDED < CONFIRMED), which is
    the queue README's rule, and it can only ever go UP.
  · A ROW ON YOUR SIDE WITH NO MAINLINE TWIN IS KEPT, because that is the shape
    of a row somebody else already dropped.

AND THE GUARD, which is the whole point of this existing:

  · it refuses to write if the result would have FEWER rows than either side
  · it refuses to write if any row would come out at a LOWER status
  · it refuses to write if any row would come out materially SHORTER
  · it exits NON-ZERO on refusal, and it leaves the conflict markers in place

THE ACCIDENT THIS IS REALLY FOR, which I nearly committed myself:

    python3 fix.py; git add LEDGER.md; git rebase --continue

Chained with `;`, the `git add` runs EVEN IF the python threw — staging the file
with `<<<<<<<` markers still in it — and `--continue` commits that. I did
exactly this once tonight and only caught it because I re-read the row count.
Nothing goes red: the build does not read this file. Use `&&`, or use this,
which exits non-zero and stages nothing.
"""
import re
import subprocess
import sys

PATH = 'notes/LEDGER.md'
RANK = {'OPEN': 0, 'LANDED': 1, 'CONFIRMED': 2}
CHECK_ONLY = '--check' in sys.argv
SELFTEST = '--selftest' in sys.argv


def cells(row):
    return row.split('|')


def key(row):
    c = cells(row)
    return (c[2].strip(), c[3].strip()[:45]) if len(c) > 4 else None


def status(row):
    c = cells(row)
    return c[1].strip() if len(c) > 1 else ''


def is_row(row):
    return status(row) in RANK


def closed(row):
    """Every row must end with its cell pipe. A row that lost one merges the
    next column into itself, which is how an evidence cell swallows a status —
    I found one in this state tonight."""
    r = row.rstrip()
    return r if r.endswith('|') else r + ' |'


def rows_of(lines):
    return {key(l): (status(l), len(l)) for l in lines if is_row(l)}


def fail(msg):
    print(f'REFUSED: {msg}', file=sys.stderr)
    print('  conflict markers left in place; nothing staged.', file=sys.stderr)
    if SELFTEST:
        print('SELFTEST: the guard refused the careless resolution', file=sys.stderr)
        sys.exit(0)
    sys.exit(1)


src = open(PATH).read().split('\n')
starts = [i for i, l in enumerate(src) if l.startswith('<<<<<<<')]
if not starts:
    print('no conflict in', PATH)
    sys.exit(0)

i = starts[0]
mid = next(n for n, l in enumerate(src) if l.startswith('=======') and n > i)
end = next(n for n, l in enumerate(src) if l.startswith('>>>>>>>') and n > mid)
head, mine = list(src[i + 1:mid]), src[mid + 1:end]

before_head = rows_of(head)
before_mine = rows_of(mine)
edits = []

for mr in mine:
    if not is_row(mr):
        continue
    k = key(mr)
    tgt = [n for n, hr in enumerate(head) if is_row(hr) and key(hr) == k]
    if not tgt:
        head.append(mr)
        edits.append(f'kept my row with no mainline twin: {k}')
        continue
    n = tgt[0]
    # my own evidence block, appended and never replacing
    j = mr.find(' **>> K')
    if j > 0:
        blk = closed(mr[j:])[:-1].rstrip()
        if blk[:70] not in head[n]:
            head[n] = closed(head[n])[:-1].rstrip() + ' ' + blk + ' |'
            edits.append(f'appended my evidence to {k}')
    hs, ms = status(head[n]), status(mr)
    if RANK[ms] > RANK[hs]:
        head[n] = re.sub(r'^\| *' + hs + r' *\|', '| ' + ms + ' |', head[n], count=1)
        edits.append(f'raised {k}: {hs} -> {ms}')

# THE MUTATION: resolve it the WRONG way — take my side wholesale, which is the
# ordinary careless resolution and the one that has eaten rows all night. The
# guard below must refuse it. A guard that has only ever seen a correct
# resolution is a guard nobody has watched work (GOTCHAS §27), and this one
# CANNOT be tripped by the algorithm above, which is safe by construction — so
# the only way to watch it is to hand it a bad answer on purpose.
if SELFTEST:
    head = list(mine)
    edits = ['--selftest: took MY side wholesale, which is the careless resolution']

after = rows_of(head)

# ── THE GUARD ────────────────────────────────────────────────────────────
if len(after) < max(len(before_head), len(before_mine)):
    fail(f'row count would fall: mainline {len(before_head)}, mine {len(before_mine)}, result {len(after)}')
for k, (st, ln) in before_head.items():
    if k not in after:
        fail(f'a MAINLINE row would be lost: {k}')
    if RANK[after[k][0]] < RANK[st]:
        fail(f'a row would fall in status: {k} {st} -> {after[k][0]}')
    if after[k][1] < ln - 40:
        fail(f'a row would lose evidence: {k} {ln} -> {after[k][1]} chars')
for k in before_mine:
    if k not in after:
        fail(f'a row from MY side would be lost: {k}')

if SELFTEST:
    print('SELFTEST: NOT CAUGHT — the guard accepted a resolution that takes my side'
          ' wholesale. It is decoration.', file=sys.stderr)
    sys.exit(2)

if CHECK_ONLY:
    print(f'would be safe: {len(after)} rows, {len(edits)} edits')
    for e in edits:
        print('   ', e)
    sys.exit(0)

open(PATH, 'w').write('\n'.join(src[:i] + head + src[end + 1:]))
print(f'resolved: {len(after)} rows (mainline had {len(before_head)}, mine {len(before_mine)})')
for e in edits:
    print('   ', e)
if [l for l in open(PATH).read().split('\n') if l.startswith('<<<<<<<')]:
    print('MORE CONFLICT HUNKS REMAIN — run again before staging.')
    sys.exit(2)
subprocess.run(['git', 'add', PATH], check=False)
print('staged.')
