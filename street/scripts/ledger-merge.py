#!/usr/bin/env python3
"""Resolve LEDGER.md rebase conflicts.

The ledger is one row per line and every agent appends to the same rows, so a
rebase conflicts on it almost every time. The resolution is always the same
shape and doing it by hand is how evidence gets dropped:

  * start from MAINLINE's row — the builder's account is newer than mine
  * APPEND any auditor segment my side has that mainline's row lacks
  * take the stronger status
  * keep rows only one side has

Evidence is APPEND-ONLY, so never choose a side. Choosing lost a row's evidence
once, and then four passes at a stroke when mainline already carried an older
auditor segment and was already CONFIRMED: my newer, longer line looked like the
weaker candidate and was dropped. The commits then became empty and git silently
skipped them. Nothing looked wrong afterwards - every row still read plausibly
and only the CONFIRMED count moved, 124 to 115.

Run with no arguments after a conflicted rebase, then `git add` and continue.
"""
import re, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'notes/LEDGER.md'

def key(l):
    """Identify a row by (agent, request), taken from the COLUMNS.

    This used a 60-character regex slice, which spills past the request column
    into the builder's evidence - so the same row with newer builder text read
    as a DIFFERENT row and my side got appended as a duplicate instead of
    merged. The selftest caught it; the real file never would have, because a
    duplicated row still reads plausibly."""
    f = l.split('|')
    if len(f) < 4 or not f[1].strip() or not f[2].strip():
        return None
    # THE FULL REQUEST, NOT A 60-CHARACTER SLICE. The slice was left over from
    # the regex version, where it stopped the match spilling into the evidence
    # column. Splitting on `|` already does that — f[3] IS the request — so the
    # truncation bought nothing and cost rows: TWO ROWS WHOSE REQUESTS AGREE FOR
    # SIXTY CHARACTERS COLLAPSED TO ONE KEY IN `mymap`, and the first was
    # silently dropped. Reproduced with a pair differing only after char 60:
    # one survived, one vanished, and the file read perfectly well afterwards.
    #
    # That is the shape the auditor kept reporting — five rows gone, source
    # unknown, "I cannot rule out my own rebase". They were right not to.
    return (f[2].strip(), f[3].strip())

def status(l):
    m = re.match(r'\|\s*(\w+)\s*\|', l)
    return m.group(1) if m else ''

# A SEGMENT IS ANY APPENDED ACCOUNT, NOT ONLY THE AUDITOR'S.
#
# This was the literal string ' — **AUDITOR', so `segments()` returned NOTHING
# for a row appended to by anybody else and the whole append was dropped on the
# next conflict. It cost three of A's verifier segments in one session before
# anyone noticed, and it would have cost every second verifier's evidence
# forever — which is the one thing this file exists to prevent. The docstring
# above already says "never choose a side"; the code chose, by recognising only
# one author.
#
# The boundary is the marker every appender actually writes: " — **" followed by
# a capital. Over-splitting is harmless — every piece is re-joined in order and
# the dedupe is per piece — while under-splitting silently eats an account.
SEG_RE = re.compile(r' — (?=\*\*[A-Z0-9])')

def segments(l):
    parts = SEG_RE.split(l)
    return [' — ' + p for p in parts[1:]]

def base_status_map():
    """Status of every row at the MERGE BASE, from git's stage 1.

    Without this there is no way to tell my new confirmation from mainline's
    deliberate demotion — see merge(). Returns None if the base is unavailable
    (running outside a conflicted rebase, or on a test fixture), and merge()
    then takes the cautious branch rather than guessing.
    """
    import subprocess
    for spec in (f':1:./{PATH}', f':1:{PATH}'):
        r = subprocess.run(['git', 'show', spec], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            m = {}
            for l in r.stdout.split('\n'):
                k = key(l)
                if k is not None and k not in m:
                    m[k] = status(l)
            return m
    return None

def merge(theirs, mine, base_st=None):
    """Mainline's row, plus any auditor segment of mine it does not already
    carry. Never drops either side's account.

    STATUS IS THREE-WAY, AND A DEMOTION IS NEVER RESURRECTED.
    ========================================================
    This used to read "if mine is CONFIRMED and the result is not, force
    CONFIRMED" — described in the docstring as *taking the stronger status*.
    CONFIRMED IS NOT STRONGER. It is only newer or older, and treating it as
    stronger makes this script silently undo other people's work: an owner who
    demotes their own row to OPEN because the evidence stopped holding has that
    demotion reversed by the next agent who rebases. The row goes back to
    CONFIRMED carrying an evidence cell that says, in the owner's own words,
    that nothing can decide it.

    THIS IS THE SECOND TIME I HAVE SHIPPED THIS EXACT FAULT. `ledger-recover.py`
    restored a status as well as evidence and un-rejected the sleep-fade row;
    I fixed it there, wrote down that a tool must never rewrite a status, and
    left the same rule standing here — in the script that runs on EVERY rebase.

    Why the naive fix is wrong too. "Mainline always wins" would drop my own
    fresh confirmation, because during a rebase `mine` is the commit being
    replayed and mainline has not seen it yet. The two lines alone cannot
    distinguish the cases. THE MERGE BASE CAN:

      base CONFIRMED, mainline OPEN   -> mainline demoted deliberately. Keep OPEN.
      base OPEN, mine CONFIRMED       -> I am promoting it now. Keep CONFIRMED.
      both moved, differently         -> mainline wins; my account is appended
                                         anyway, so the demoter can read it.
      base unknown                    -> keep mainline's. Resurrecting a
                                         demotion is the worse of the two errors,
                                         because nobody looks at a CONFIRMED.
    """
    out = theirs.rstrip().rstrip('|').rstrip()
    add = [s for s in segments(mine) if s[:70] not in theirs]
    if add:
        out += ''.join(s.rstrip().rstrip('|').rstrip() for s in add)
    out += ' |'
    st_t, st_m = status(out), status(mine)
    if st_t != st_m:
        if base_st is not None and st_m != base_st and st_t == base_st:
            keep = st_m                      # only my side moved — that is the new fact
        else:
            keep = st_t                      # mainline moved, or we cannot tell
        if keep and keep != st_t:
            out = f'| {keep} |' + out[out.index('|', 1) + 1:]
    return out

def resolve(m):
    ours = [l for l in m.group(1).split('\n') if l.strip()]
    mine = [l for l in m.group(2).split('\n') if l.strip()]
    # NON-ROW LINES ARE NEVER KEYED. `key()` returns None for a heading, a blank
    # or anything malformed, so putting them in a dict collapses every one of
    # them onto the single key None — all but the last are dropped, and a
    # heading in `ours` then matches that survivor and gets merge()d into it.
    # Keep them out of the map and carry them through untouched.
    base = base_status_map()
    mymap = {}
    for l in mine:
        k = key(l)
        if k is not None and k not in mymap:
            mymap[k] = l
    unkeyed = [l for l in mine if key(l) is None]
    out = []
    for l in ours:
        k = key(l)
        alt = mymap.get(k) if k is not None else None
        out.append(merge(l, alt, base.get(k) if base else None) if alt else l)
    seen = {key(x) for x in ours}
    for k, l in mymap.items():
        if k not in seen:
            out.append(l)
    for l in unkeyed:                      # headings and blanks only I have
        if l not in out:
            out.append(l)
    return '\n'.join(out) + '\n'

s = open(PATH).read()
s2, n = re.subn(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', resolve, s, flags=re.S)
open(PATH, 'w').write(s2)
left = s2.count('<<<<<<<')
print(f'  resolved {n} region(s); {left} marker(s) left')
sys.exit(1 if left else 0)
