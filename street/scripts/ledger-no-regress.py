#!/usr/bin/env python3
"""Rows that went BACKWARDS: a status that fell, or evidence that shrank.

    STATUS FELL     CONFIRMED or LANDED came back as something lower
    EVIDENCE LOST   the row kept its status and lost its text

Both compare a row against ANOTHER VERSION of itself. A third assertion —
"the status contradicts the row's own evidence" — was written and deleted;
see the block where it used to live for the two false positives that killed
it and why no wording saves it.

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
    python3 scripts/ledger-no-regress.py --fix out.md     # propose, never in place

`--fix` writes a REPAIRED COPY and touches nothing. It only proposes the rows it
can repair without choosing a side:

    SAFE     the current row's evidence is empty, or is contained in the
             historic one. Restoring the historic row loses nothing
    MERGE    both sides carry text the other does not. A blind restore would
             destroy the newer half — which is the exact operation that caused
             this — so these are listed and left alone

That split is not cosmetic. Of the regressions on the file I wrote this for,
most were MERGE: the rows had gained new evidence AFTER the regression, so
"just put the old one back" would have started the next round of this.

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

# A FLAG'S VALUE IS NOT A POSITIONAL. Stripping only the `--word` and leaving
# its argument behind made `--fix out.md` read out.md as the commit count, so
# `git log -out.md` matched nothing and the script exited 3. It failed loudly,
# which is the one thing that went right — a silent 0-findings would have read
# as a repaired ledger (GOTCHAS §34, and §32 on what a 3 means).
VALUED = {'--shrink', '--fix'}
argv, skip = [], False
for a in sys.argv[1:]:
    if skip:
        skip = False
        continue
    if a in VALUED:
        skip = True
        continue
    if a.startswith('--'):
        continue
    argv.append(a)
N = argv[0] if argv else '60'
SHRINK = 0.5          # evidence under half its historic best is a regression
if '--shrink' in sys.argv:
    SHRINK = float(sys.argv[sys.argv.index('--shrink') + 1])


def evidence(l):
    """the row's fifth column onward — everything after | status | agent | request |"""
    return l.split('|', 4)[4].strip() if l.count('|') > 4 else ''


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


def lines(text):
    """the same keys, but keeping the whole line so --fix can propose one"""
    out = {}
    for l in text.split('\n'):
        if not l.startswith('| '):
            continue
        f = l.split('|')
        if len(f) < 5 or not f[2].strip() or not f[3].strip():
            continue
        out[(f[2].strip(), f[3].strip()[:56])] = l
    return out


cur = rows(open('notes/LEDGER.md').read())

# ── WHY THERE IS NO "STATUS CONTRADICTS ITS OWN EVIDENCE" CLAUSE ──────────
#
# I wrote one and deleted it the same hour. It flagged a CONFIRMED row whose
# evidence contained an explicit self-demotion — `MOVED BACK FROM CONFIRMED`,
# `moves to LANDED`, `RE-OPENED BY THE DESK`. On the real file it found two rows
# and BOTH WERE FALSE POSITIVES:
#
#   F  wheel arches   F demoted it, and then *"VERIFIER (A): THE ROW IS
#                     DECIDABLE, and it HOLDS"* and an auditor confirmation
#                     followed IN THE SAME CELL. CONFIRMED is correct.
#   K  sleep fade     *"AUDITOR: status re-applied. My verdict and its evidence
#                     were BOTH removed by a bulk edit … the status was not
#                     reversed by anyone's judgement."* CONFIRMED is correct.
#
# The clause was not mistuned, it was measuring the wrong thing. **A ledger row
# is APPEND-ONLY HISTORY.** GOTCHAS 44 tells authors in as many words to write
# the "after" beside the "before" and to keep the original, so every mature row
# contains the sentences describing states it is no longer in. A substring test
# against that text will always be reading the past and reporting it as the
# present, and no wording of the phrase list fixes it — the signal wanted is
# the LAST verdict in the cell, and picking that out is guesswork.
#
# So: two attempts, then delete (START-HERE). Recorded here rather than removed
# silently, because the check is an obvious one to reach for — I reached for it —
# and the next person deserves the two false positives for free.
#
# The three assertions that remain all compare a row against ANOTHER VERSION of
# itself, which is the only comparison this file supports honestly.

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

# ── the repair, proposed and never applied ────────────────────────────────
FIX = sys.argv[sys.argv.index('--fix') + 1] if '--fix' in sys.argv else None
if FIX:
    cur_l = lines(open('notes/LEDGER.md').read())
    safe, merge = [], []
    hist_cache = {}
    for entry in fell + [(k, None, None, r) for k, _, _, r in
                         [(k, 0, 0, rev) for (k, _, _, rev) in shrank]]:
        k, rev = entry[0], entry[3]
        if rev not in hist_cache:
            hist_cache[rev] = lines(subprocess.run(
                ['git', 'show', f'{rev}:{SHOW}'], capture_output=True, text=True).stdout)
        old = hist_cache[rev].get(k)
        now = cur_l.get(k)
        if not old or not now:
            continue
        ev_now, ev_old = evidence(now), evidence(old)
        if not ev_now or ev_now in ev_old:
            safe.append((k, old))
        else:
            merge.append(k)
    out = []
    repl = dict(safe)
    for l in open('notes/LEDGER.md').read().split('\n'):
        f = l.split('|')
        k = (f[2].strip(), f[3].strip()[:56]) if l.startswith('| ') and len(f) >= 5 else None
        out.append(repl.get(k, l) if k else l)
    open(FIX, 'w').write('\n'.join(out))
    print(f'\nwrote {FIX}: {len(safe)} row(s) restorable without choosing a side')
    for k, _ in safe:
        print(f'  SAFE  {k[0]:5} {k[1][:50]}')
    for k in merge:
        print(f'  MERGE {k[0]:5} {k[1][:50]}   <- both sides have text; do NOT blind-restore')

print(f'\n{len(cur)} rows now · {len(best)} keys seen across {len(revs)} commits'
      f' · {len(fell)} fell · {len(shrank)} shrank')
if fell or shrank:
    print('\nDo NOT hand-retype the row. `python3 scripts/ledger-recover.py <rev>`')
    print('merges the older evidence back in without choosing a side.')
sys.exit(1 if (fell or shrank) else 0)
