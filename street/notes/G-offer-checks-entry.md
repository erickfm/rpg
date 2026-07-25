# For the owner of `scripts/checks.mjs`: two suites the runner has never seen

**An offer, not an edit.** `OWNERSHIP.md` has `scripts/**` as add-to-not-edit
across owners, so the two lines below are for you to take or refuse.

## The gap

`checks.mjs` runs `mirror-walk`, `D-walk`, `lotwalk`, `park-walk` and
`people-walk`. It does not run `G-rooms-walk` or `G-vice-walk`, and never has.
That is **131 checks** outside the runner:

- **113 room checks** across the casino, hotel, pawn shop and tax office —
  including the three that guard requirements the user asked for in his own
  words: the pawn shop's *"two metres of clear depth"*, the casino having **no**
  window (*"the first real test of the kit"*), and each keeper **looking at you**
  rather than away
- **18 facade checks** on GOLDEN ACES and HOTEL ORPHEUS — the pavement spill, the
  chase running rather than sitting as a static dotted border, and the blade
  signs not reading mirrored

So *"every check passes at HEAD"* has never included any of it. Four of those
checks caught real, shipped defects this session; the keeper one catches the bug
the user reported by hand.

## Why they were not addable until now

Your runner passes `--selftest` and the convention is D-walk's: invert known
truths and require every one to fail. Neither of mine had it. **Both do now.**

```
G-rooms-walk --selftest    three inverted truths, all must fail
  failed    pawn: the customer side is 9 m deep or better, not a corridor
  failed    pawn: you cannot get behind the counter in the middle
  failed    pawn: the keeper is looking at you, not away
  all 3 failed as they must                                     exit 0

G-vice-walk --selftest     two inverted truths, both must fail
  failed    there is a clear band past the frontage furniture
  failed    the two faces of each blade carry the SAME texture
  both failed as they must                                      exit 0
```

The inversions live in the **harness**, not in `src/` — the bar goes to 9 m, a
no-go probe is aimed at open floor, the keeper is looked at from behind, the band
bar goes wider than the pavement, and the blade comparison is asked to find
mirrored faces. Nothing is mutated on disk, so they need no lock and cannot leave
a dirty tree if the run dies.

## The two lines

```js
['G-rooms-walk',  'do G\'s four interiors hold up when you walk them?', true, [], true],
['G-vice-walk',   'do the casino and hotel facades still read from the street?', true, [], true],
```

`slow: true` on both — they walk, so they cost what walking costs: about 3–4
minutes and 1 minute respectively on an idle machine. Both honour `SHOT_URL`, both
call `reportWorld` (so they exit 3 on the wrong world, which your runner already
understands), and both run against a `vite preview` of `dist` as well as the dev
server.

## If you would rather NOT adopt them yet: the EXEMPT lines

**Added after `643ceddd9`, which is the reason this section exists.** That audit
found `checks-registered` red with three entries and named the cause: *"an offered
check is indistinguishable from a forgotten one."* **Two of the three are mine**,
and they went red the moment I gave them selftests without carrying an opt-out —
the offer made the board worse, not better, until you act on it.

So the offer now comes with both halves. Adopt with the two `CHECKS` lines above,
**or** park it visibly with these, in `scripts/checks-registered.mjs`:

```js
'G-rooms-walk': 'offered to checks.mjs with a --selftest — see notes/G-offer-checks-entry.md;
                 walks, so it belongs in the slow tier, which BLOCKED-H reports as
                 not completing',
'G-vice-walk':  'offered to checks.mjs with a --selftest — same note, same tier',
```

Either is a fine answer. **What is not fine is the state they are in now**, which
is the one `checks-registered` exists to catch: self-testing, unregistered, and
running never, with nothing saying whether that is a decision or an oversight.

## What I am not claiming

Adding them makes the slow tier longer, and `BLOCKED-H` has that tier failing to
complete for other reasons. If the answer is "not until the tier is reliable",
that is a fair call — the offer is the two lines and the selftests, not a claim
about your scheduling.
