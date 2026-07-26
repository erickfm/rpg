#!/usr/bin/env python3
"""Resolve a LEDGER.md conflict WITHOUT LOSING A SEGMENT, and say what it did.

Named for the claim it makes — it keeps the longest — rather than for its
subject, because `scripts/` already holds `ledger-merge.py` and two files named
after the same subject is how a check goes missing (GOTCHAS 24). This does NOT
replace that one; it is a second opinion for the case that one gets wrong, and
whichever you run, run it with your eyes open.

── why this exists ────────────────────────────────────────────────────────────

`ledger-merge.py`'s rule is *"start from MAINLINE's row — the builder's account
is newer than mine"*, and its docstring is honest about why: choosing the longer
side once dropped an auditor segment. That rule is right when mainline's row IS
newer. It is exactly backwards when mainline's row is a REGRESSION — and this
file produces both, on consecutive rebases:

    rebase A   mainline had L's row at OPEN with an EMPTY cell, 87 chars
               against my 7,341. "Start from mainline" adopted the loss.
    rebase B   mainline had L's row at 8,159 chars against my 7,341, and my
               two rows CONFIRMED at 6,854 and 6,009 against my own LANDED
               3,631 and 2,377. Mainline was right about every row.

No fixed preference can be correct across those two. The only rule that is, is
the one `ledger-merge.py`'s own docstring states and then does not follow:
**evidence is APPEND-ONLY, so never choose a side — keep everything.**

── and it FAILS LOUD, which is the whole point ────────────────────────────────

The way I lost 5,168 characters of L's verdict was a resolver printing

    resolved 1 region(s); 0 marker(s) left

which is true and says nothing about whether anything survived. This prints a
line per row with both lengths and the decision, and it **exits 1** if any
chosen row is shorter than a side it rejected, or if a segment marker present on
one side is missing from the winner. A repair tool that can quietly lose work is
worse than no repair tool, because you stop reading the diff.

    python3 scripts/M-ledger-keep-longest.py          # then git add, then --continue

Segment markers are the phrases this project's protocol tells people to write —
`AUDITOR`, `VERIFIER (X)`, `LANDED (X)`, `REPUBLISHED`, `RETRACTED`, `>> X` — and
the check is only that a marker does not VANISH. It cannot tell you a paragraph
was reworded, and it does not pretend to.
"""
import re
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'notes/LEDGER.md'
RANK = {'OPEN': 0, 'LANDED': 1, 'CONFIRMED': 2}
# the phrases the protocol asks people to write into an evidence cell. If one is
# on a side and not on the winner, somebody's account has gone.
MARKERS = [r'AUDITOR', r'VERIFIER \([A-Z+]+\)', r'LANDED \([A-Z+]+\)',
           r'REPUBLISHED', r'RETRACTED', r'WITHDRAW', r'>> [A-Z]']


def key(line):
    """(agent, request) from the COLUMNS, never from a character slice — a slice
    spills into the evidence cell, so the same row with newer text reads as a
    different row. That is `ledger-merge.py`'s own recorded mistake."""
    c = line.split('|')
    return (c[2].strip(), c[3].strip()) if len(c) > 4 else None


def status(line):
    return line.split('|')[1].strip()


def markers(line):
    out = set()
    for m in MARKERS:
        out |= set(x if isinstance(x, str) else x[0] for x in re.findall(m, line))
    return out


def cell(line):
    """The evidence cell: everything after the FOURTH pipe, with a trailing pipe
    stripped if there is one.

    It used `rindex('|')` for the end and that was wrong on a malformed row — and
    a malformed row is exactly what it met. My own verification segment had been
    appended AFTER a row's closing pipe, so the row ran
    `| … | … | … | evidence — L | — **VERIFIER (M) …** — M` with no terminator:
    `rindex` then found the stray middle pipe, the cell came out 3,741 characters
    long instead of 7,251, and my segment was outside it. The tool reported the
    segment as lost and could not graft it, both correctly. `malformed()` below now
    names that class rather than letting it look like a merge fault."""
    a = line.index('|', line.index('|', line.index('|', line.index('|') + 1) + 1) + 1) + 1
    end = len(line)
    while end > a and line[end - 1] in ' \t':
        end -= 1
    if end > a and line[end - 1] == '|':
        end -= 1
    return a, end


def malformed(line):
    """A well-formed row is `| status | agent | request | evidence |` — five pipes
    and no more. An extra one splits the evidence into a phantom column, which
    breaks `ledger.sh`'s counts, every `cut -d'|'` in the repo, and the rendered
    table. Worth naming because I shipped one and it read as a merge fault for
    three rebases."""
    n = line.count('|')
    return None if n == 5 else f'{n} pipes, expected 5'


def repipe(line):
    """Put a single terminating pipe back on a row that lost one."""
    a, end = cell(line)
    return line[:end].rstrip() + ' |'


def graft(win, lose, missing):
    """APPEND the losing side's missing segments onto the winner, rather than
    choosing between them.

    This is the case that broke both resolvers and it is not rare: a row can be
    LONGER and still not be a superset. Somebody confirming a row REPLACED my
    LANDED evidence instead of appending to it, and mainline's row for L had grown
    by a desk note while dropping my VERIFIER segment. Longest-wins is right about
    which row to start from and wrong to stop there.

    A segment starts at the ` — ` that introduces it, which is the delimiter this
    file's own convention uses between accounts, so the graft takes a whole
    account and not a sentence out of the middle of one."""
    ls, le = cell(lose)
    body = lose[ls:le]
    tails = []
    for mk in missing:
        at = body.find(mk)
        if at < 0:
            continue
        cut = body.rfind(' — ', 0, at)
        tails.append(body[cut if cut >= 0 else 0:].strip())
    if not tails:
        return win
    # the longest tail subsumes the others when two markers sit in one account
    tails.sort(key=len, reverse=True)
    keep = [t for k, t in enumerate(tails) if not any(t in u for u in tails[:k])]
    ws, we = cell(win)
    return (win[:we].rstrip() + ' ' + ' '.join(keep)).rstrip() + ' |'


def pick(a, b):
    """Start from the longer cell, take the stronger status, then GRAFT anything
    the other side had that this one does not. Both sides are the same row and
    evidence is append-only, so the answer is never one side — it is the union."""
    win = a if len(a) >= len(b) else b
    lose = b if win is a else a
    st = max(status(a), status(b), key=lambda s: RANK.get(s, 0))
    if status(win) != st:
        win = win.replace(f'| {status(win)} |', f'| {st} |', 1)
    gone = markers(lose) - markers(win)
    if gone:
        win = graft(win, lose, gone)
    return win, lose


src = open(PATH).read()
lines = src.split('\n')
out, i, regions, problems = [], 0, 0, []
while i < len(lines):
    if not lines[i].startswith('<<<<<<<'):
        out.append(lines[i]); i += 1; continue
    m = next(k for k in range(i, len(lines)) if lines[k].startswith('======='))
    j = next(k for k in range(m, len(lines)) if lines[k].startswith('>>>>>>>'))
    regions += 1
    head = {key(l): l for l in lines[i + 1:m] if l.startswith('| ') and key(l)}
    mine = {key(l): l for l in lines[m + 1:j] if l.startswith('| ') and key(l)}
    # ORDER FROM HEAD, then anything only my side has, so mainline's row order
    # survives and a row nobody else has is not dropped
    order = list(head) + [k for k in mine if k not in head]
    print(f'\nregion {regions}: {len(head)} row(s) on HEAD, {len(mine)} on mine')
    for k in order:
        a, b = head.get(k), mine.get(k)
        if a is None or b is None:
            only = a or b
            print(f'  ONE SIDE ONLY  {k[0]:5} {k[1][:40]:42} {len(only):6}  kept')
            out.append(repipe(only)); continue
        for side, l in (('HEAD', a), ('mine', b)):
            bad = malformed(l)
            if bad:
                print(f'  MALFORMED on {side}: {k[0]} {k[1][:34]} — {bad} (repaired)')
        a, b = repipe(a), repipe(b)
        win, lose = pick(a, b)
        gone = markers(lose) - markers(win)
        grafted = markers(b if win.startswith(a[:12]) else a) - markers(a if win.startswith(a[:12]) else b)
        flag = ''
        if not gone and grafted:
            flag = f'  grafted: {", ".join(sorted(grafted))}'
        if len(win) < len(lose):
            flag = '  !! SHORTER THAN THE SIDE IT BEAT'
            problems.append((k, flag))
        if gone:
            flag += f'  !! LOST SEGMENT(S): {", ".join(sorted(gone))}'
            problems.append((k, flag))
        src_name = 'HEAD+' if len(win) > max(len(a), len(b)) else ('HEAD' if len(win) == len(a) else 'mine')
        print(f'  {status(win):9} {k[0]:5} {k[1][:40]:42} '
              f'HEAD {len(a):6} / mine {len(b):6} -> kept {src_name} {len(win):6}{flag}')
        out.append(repipe(win))
    i = j + 1

open(PATH, 'w').write('\n'.join(out))
left = sum(1 for l in out if l.startswith(('<<<<<<<', '=======', '>>>>>>>')))
print(f'\n{regions} region(s) resolved, {left} marker(s) left')
if left or problems:
    for k, f in problems:
        print(f'PROBLEM {k[0]} {k[1][:50]}{f}')
    print('NOT CLEAN — read the rows above before you git add')
    sys.exit(1)
print('no row got shorter and no segment vanished')
