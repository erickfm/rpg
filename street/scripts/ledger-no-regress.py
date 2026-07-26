#!/usr/bin/env python3
"""Rows that went BACKWARDS: a status that fell, or evidence that shrank.

THE GAP THIS FILLS, and I checked the neighbours before writing it (GOTCHAS 24):

    ledger-lost.py       a row that DISAPPEARED
    ledger-evidence.py   a CONFIRMED row with nothing behind it
    ledger-recover.py    REPAIRS one, once you already suspect it and can name
                         the old revision to merge from

None of them sees the case that actually happened to me: the row never
disappeared and never looked bare. It simply became YOUNGER. `| CONFIRMED | N |`
with 4,953 characters of station, predicate and a verifier's whole verdict came
back as `| OPEN | N |` with the desk's original 349-character brief, because a
ledger conflict was resolved by taking the ancestor.

`ledger-recover.py` already states the mechanism exactly — *"a conflict resolver
that picks ONE SIDE of a row therefore always loses something, and it loses it
silently, because the row still looks fully populated"* — so this is the missing
alarm for a fault the repair tool was written for.

WHY IT IS WORTH AN ALARM RATHER THAN A HABIT. `scripts/live.sh` reads STATUS. A
row that falls to OPEN reappears in a builder's queue as work to do, and a
builder who trusts it rebuilds a confirmed feature. I only caught mine because
I recognised my own row, which is not a control anybody else has.

    python3 scripts/ledger-no-regress.py [how-many-commits] [--shrink N]

Exit 0 clean, 1 a regression, 3 nothing measurable — the family's convention,
and 3 matters here: an unreadable history is a broken query, not a clean bill
of health (GOTCHAS 32).
"""
import subprocess, sys

RANK = {'OPEN': 0, 'LANDED': 1, 'CONFIRMED': 2}
# git log pathspecs are CWD-relative, git show paths are repo-root-relative —
# the same trap ledger-lost.py documents, and it is why that script once printed
# "0 rows ever seen" as though it were a finding.
SHOW = 'street/notes/LEDGER.md'
LOG  = 'notes/LEDGER.md'

argv = [a for a in sys.argv[1:] if not a.startswith('--')]
N = argv[0] if argv else '60'
SHRINK = 0.5          # evidence under half its historic best is a regression
if '--shrink' in sys.argv:
    SHRINK = float(sys.argv[sys.argv.index('--shrink') + 1])


def rows(text):
    """(agent, request-prefix) -> (status, evidence-length). Keyed exactly the
    way ledger-lost.py keys it, so the two agree about what a row IS."""
    out = {}
    for l in text.split('\n'):
        if not l.startswith('| '):
            continue
        f = l.split('|')
        if len(f) < 5 or not f[2].strip() or not f[3].strip():
            continue
        out[(f[2].strip(), f[3].strip()[:56])] = (f[1].strip(), len(l))
    return out


cur = rows(open('notes/LEDGER.md').read())
revs = subprocess.run(['git', 'log', f'-{N}', '--format=%h', '--', LOG],
                      capture_output=True, text=True).stdout.split()

best = {}      # key -> (best rank, best length, the rev each was seen at)
for r in revs:
    t = subprocess.run(['git', 'show', f'{r}:{SHOW}'], capture_output=True, text=True).stdout
    if not t:
        continue
    for k, (st, ln) in rows(t).items():
        rank = RANK.get(st, 0)
        b = best.get(k)
        if b is None:
            best[k] = [rank, ln, r, r]
        else:
            if rank > b[0]:
                b[0], b[2] = rank, r
            if ln > b[1]:
                b[1], b[3] = ln, r

if not best:
    print('CANNOT ANSWER — no historical revision of the ledger was readable.')
    print('  An empty history is a broken query, not a clean bill of health.')
    sys.exit(3)

fell, shrank = [], []
for k, (st, ln) in cur.items():
    b = best.get(k)
    if not b:
        continue                       # new row, nothing to regress from
    if RANK.get(st, 0) < b[0]:
        fell.append((k, st, [s for s, v in RANK.items() if v == b[0]][0], b[2]))
    elif ln < b[1] * SHRINK:
        # only when the status held: a row correctly re-opened by the desk is
        # SUPPOSED to lose its evidence, and calling that a regression would be
        # crying wolf at the one edit that is meant to look like this.
        shrank.append((k, ln, b[1], b[3]))

for (agent, req), st, was, rev in fell:
    print(f'STATUS FELL   {agent:5} {req[:52]}')
    print(f'              now {st}, was {was} at {rev}')
for (agent, req), ln, was, rev in shrank:
    print(f'EVIDENCE LOST {agent:5} {req[:52]}')
    print(f'              now {ln} chars, was {was} at {rev}')

print(f'\n{len(cur)} rows now · {len(best)} keys seen across {len(revs)} commits'
      f' · {len(fell)} fell · {len(shrank)} shrank')
if fell or shrank:
    print('\nDo NOT hand-retype the row. `python3 scripts/ledger-recover.py <rev>`')
    print('merges the older evidence back in without choosing a side.')
sys.exit(1 if (fell or shrank) else 0)
