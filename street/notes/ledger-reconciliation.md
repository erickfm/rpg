# Reconciling FEATURE-REQUESTS against LEDGER

**Nine user requests had no ledger row. They are now filed as OPEN.**

## Why I did this

Two untracked requests turned up today by accident, one after the other:

- **the diner facade** — the ledger held `diner blade illegible` CONFIRMED and
  nothing for the facade, so *"looks really bad rn"* had no line to sit on and
  the neighbouring green read as if it covered both;
- **the bodega corner** — D added its row themselves after finding the request
  had sat in `FEATURE-REQUESTS.md` since the block was re-cast.

Both were found by someone tripping over them. **A request with no row is
invisible to a process built on rows**, and the ledger exists precisely because
requests kept coming back a second and third time. A gap in it is not a
bookkeeping problem, it is the failure mode the file was created to prevent.

So I checked the whole file instead of waiting for the third one.

## Method

220 items parsed out of `FEATURE-REQUESTS.md`, 93 ledger rows. Matched on word
overlap after dropping stopwords, then **hand-checked every candidate** — the
matcher is fuzzy and its raw output was not trustworthy:

- 120 of the 220 items carry an actual user quote. The rest are the historical
  done-log at the foot of the file (short entries like *"Raindrops smaller"*),
  which are records, not open requests.
- Of those 120, 20 scored below threshold. **Eleven were false alarms** — the bus
  bench scored 0.29 and I had confirmed it an hour earlier; the pickup tyres
  scored 0.25 and are tracked as *"tyres clip into the bed cavity"*. Fuzzy
  matching finds candidates; it does not find faults.
- The remaining nine I verified by grepping the ledger for each one's
  distinctive term and getting **zero hits**.

## The nine, now filed as OPEN

| owner | request | FR line |
|---|---|---|
| B | *"tree in the dirt looks janky … make the dirt patch a lil bigger on the curb side"* | 365 |
| B | *"i like the thought, to make a drive entrance. however it looks graphically bugged"* | 364 |
| B | *"make wetness last a lil after it stops raining"* | 689 |
| C | *"i want to be able to close this door and also what is this poster on the wall?"* | 424 |
| F | *"the entrence to the tax service is not aligned with the door of the facade"* | 433 |
| F | *"I WANT TO BE ABLE TO WALK UP THOSE STAIRS"* | 435 |
| F | *"im literally stuck here. i think we need some sort of stuck protection …"* | 604 |
| H | *"what is this black stripe on the back of the pick up truck"* | 449 |
| H | *"whats up with this kids face? its multi color?"* | 456 |

**All filed as OPEN, deliberately.** Some may already be done — several are old.
But a status is a claim about the world, and I have not walked these. If one is
finished it costs a walk to confirm; if I had guessed CONFIRMED to tidy the
count, a wrong CONFIRMED is worse than an OPEN. `im literally stuck here` is the
one to look at first: it is a collision report, and the only kind of fault here
that can strand a player.

## For the desk

This reconciliation should not need an auditor. **The two files are kept by hand
and drift silently**, and the drift is invisible until someone trips over a
specific request. A script that lists FEATURE-REQUESTS items with no matching
ledger row would catch it every build — the matching above is ~30 lines, and its
output is a *candidate list for a human*, never a verdict. Builder A owns
`scripts/**`.

One caveat for whoever writes it: **the threshold matters more than the
algorithm.** At 0.30 I got 20 candidates of which 9 were real. Tightening it to
cut the false alarms would have dropped the bus bench — and also, at some
setting, one of the nine.
