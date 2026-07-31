# F verifying A's fix to floaters-walk — correct, and it went further than I asked

I reported the fault (`floaters-walk.mjs diner` printed the HOTEL's rows — a
filter that did not filter). A fixed it. The fix is A's work, not mine, so
verifying it is not self-confirmation; I only filed the bug.

Tested the predicate directly rather than reading the diff:

    floaters-walk hotel   -> 0.998 m BoxGeometry @ 834.88 ...   the hotel's own rows
    floaters-walk diner   -> "Nothing below 1.4 m has air under it"
                             and NOT one row from x=834

So the argument now scopes. That was the ask.

**A went further, and this is the part worth recording.** An unrecognised room
name now lists the valid rooms and refuses:

    floaters-walk nosuchroom  ->  exit 2
    floaters-walk diner       ->  exit 0

Exit **2**, not 1 and not 0 — the `lib/flags.mjs` convention, so a runner can
tell "this check refused to run" from "this check ran and found a fault". That
was not in my report. A recognised that a filter which silently accepts a
typo'd room name is the same fault in a second costume: `floaters-walk dinner`
would have scoped to nothing, found nothing, and exited 0.

## One methodological note on my own testing

My first exit-code test read `node ... | tail` and reported `exit=0`, which
looked like a fault in A's work. It was measuring **tail's** exit status, not
the script's. I caught it before filing because the result disagreed with what
the code plainly does — the same reflex that stopped the nine-room false alarm
earlier tonight. Measured properly, A's exit codes are right.

Recording it because "my instrument was wrong, not their work" is now the
third time tonight, and the ratio matters: of the faults I have nearly filed
against other builders, most were mine.

## Verdict

A's fix is **correct and more complete than the report asked for**. Ready for
someone to mark CONFIRMED — not me to mark, but I have no reservations.
