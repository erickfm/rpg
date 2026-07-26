#!/usr/bin/env python3
"""Resolve a LEDGER.md rebase conflict without losing anybody's evidence.

    python3 scripts/H-resolve-ledger.py [ref]     # default add-stick-and-city98

WHY THIS IS A FILE AND NOT A SNIPPET. I resolved these conflicts by pasting the
same logic inline, turn after turn, with my own evidence markers listed in the
snippet. Every time I wrote a NEW kind of evidence I forgot to add its phrase to
the list, so the next rebase kept the base's row and appended nothing — and
eight of my own segments went missing before an audit of my own marks found
them. `ledger-intact.mjs` could not see it either: it compares my copy to the
base, and my text was absent from both.

The list of markers has to live in ONE place that gets updated when a marker is
added. That is the whole reason this file exists.

HOW IT RESOLVES, and the order matters:

  · every conflicted row is rebuilt from the REF's version, never from
    whichever side of the hunk won. During a rebase the "HEAD" side is the
    partially-applied new base, so it can be an OLDER copy of a row than the
    ref holds — take it verbatim and you revert whatever landed in between.
  · then each of MY segments is re-appended, bounded at the next contribution
    marker rather than to end-of-line. Taking to end-of-line re-appends other
    people's paragraphs as if they were mine; I did that once and added 19k
    characters of somebody else's evidence to a row.
  · a row CONFIRMED on either side stays CONFIRMED.
  · rows are keyed on the EXACT title, field 3. Matching by substring picked
    the wrong row for me three times, because several requests share an
    opening.

Afterwards run `npm run ledger`, which is the only thing that will tell you
whether this worked.
"""
import re
import subprocess
import sys

REF = sys.argv[1] if len(sys.argv) > 1 else 'add-stick-and-city98'
LEDGER = 'notes/LEDGER.md'

# Every opening phrase I have ever used to introduce evidence. ADD TO THIS LIST
# whenever you write a new one, or the next rebase will silently drop it.
MARKS = [
    "**CONFIRMED by H (verifier), and I pushed harder",
    "**H (verifier — I filed the original report",
    "**CONFIRMED by H (verifier) at C's own station, and C's fix #1",
    "**H (verifier): C'S STRUCTURAL FINDING HOLDS",
    "**H (2nd verifier): RE-RAN THE SWEEP INDEPENDENTLY",
    "**H (verifier): NOT GRADED, and left LANDED",
    "**H (verifier): NOT re-grading the fade",
    "**H (verifier): L'S CHECKS ALL PASS",
    "**H, 2026-07-26 — THIS ROW'S HEADLINE NUMBER IS STALE",
    "**H, 2026-07-26 — WITHDRAWING MY OWN",
    "**REPUBLISHED BY H, 2026-07-26",
    "**RE-EVIDENCED by H, 2026-07-26",
    "**CONFIRMED by H (verifier), at C's own published station",
    "**H (2nd verifier), corroborating and registering",
    "**2nd VERIFIER (H) — both rooms at G's station",
    "**CONFIRMED by H (verifier), at O's own stations",
    "**CONFIRMED by H (verifier), my own tree — and I watched it go black",
    "**CONFIRMED by H (verifier), my own tree — both interfaces",
]

# where one account ends and the next begins
BOUND = re.compile(r'\s(?:\|\||—\s+\*\*|\*\*[A-Z][A-Za-z]{0,9}\s*\(?(?:verifier|2nd|FOLLOW))')


def title(line):
    f = line.split('|')
    return f[3].strip() if len(f) >= 5 else None


def main():
    try:
        base_text = subprocess.run(
            ['git', 'show', f'{REF}:street/notes/LEDGER.md'],
            capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        print(f'could not read {REF}:street/notes/LEDGER.md — nothing resolved')
        return 2

    ref_rows = {}
    for line in base_text.split('\n'):
        if line.startswith('| ') and title(line):
            ref_rows[title(line)] = line.rstrip()

    lines = open(LEDGER, encoding='utf-8').read().split('\n')
    if not any(l.startswith('<<<<<<<') for l in lines):
        print('no conflict markers — nothing to do')
        return 0

    out, i, hunks, kept = [], 0, 0, 0
    while i < len(lines):
        if not lines[i].startswith('<<<<<<<'):
            out.append(lines[i])
            i += 1
            continue
        mid = next(j for j in range(i, len(lines)) if lines[j].startswith('======='))
        end = next(j for j in range(mid, len(lines)) if lines[j].startswith('>>>>>>>'))
        rows = [x for x in (lines[i + 1:mid] + lines[mid + 1:end])
                if x.startswith('| ') and title(x)]
        hunks += 1
        done = set()
        for r in rows:
            t = title(r)
            if t in done:
                continue
            done.add(t)
            same = [x for x in rows if title(x) == t]
            base = ref_rows.get(t) or max(same, key=len)
            segs = []
            for cand in same:
                for m in MARKS:
                    if m not in cand:
                        continue
                    st = cand.index(m)
                    b = BOUND.search(cand, st + len(m))
                    seg = cand[st:b.start()] if b else cand[st:]
                    if seg[:70] in base or any(seg[:70] in s for s in segs):
                        continue
                    segs.append(seg)
            line = base.rstrip() + ((' ' + ' '.join(segs)) if segs else '')
            if any(x.startswith('| CONFIRMED |') for x in same) and line.startswith('| LANDED |'):
                line = line.replace('| LANDED |', '| CONFIRMED |', 1)
            kept += len(segs)
            out.append(line)
        i = end + 1

    text = '\n'.join(out)
    # NEVER hand back a file that still has markers in it. My rebase loop ran
    # `git add -A` unconditionally, so on a turn where this script was not yet
    # on disk it staged the markers and committed them - two marker lines, three
    # duplicated rows and two shrunk cells reached the base. Refusing here means
    # the caller's `git add` has nothing to stage.
    left = sum(1 for l in out if l.startswith(('<<<<<<<', '=======', '>>>>>>>')))
    if left:
        print(f'REFUSING TO WRITE — {left} marker line(s) would remain. Nothing changed.')
        return 1
    open(LEDGER, 'w', encoding='utf-8').write(text)
    print(f'resolved {hunks} hunk(s) from {REF}; re-appended {kept} of my segment(s)')
    print('now run:  npm run ledger')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
