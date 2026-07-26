# Queue — builder I  ·  worktree `../rpg-lot`  ·  port 4190

**Owns:** `ct/lot.ts` — CROSSTOWN AUTO SALES, the whole used car lot.
**Desk writes this file. Do not edit it.**

You exist because C was carrying 17 live user requests, the largest backlog in
the project, across two areas that have nothing to do with each other: room 301
and the car lot. C keeps the apartment. **The lot is yours.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Keep `notes/status/I` current — one line, `STATE | what I am on | waiting on`.
See `notes/status/README.md`. The desk has a watch on it.

Run `scripts/live.sh I` to see what the LEDGER still owes. Your queue says HOW;
the ledger says WHETHER. If this file lists something the ledger does not, it
is finished — say so, do not build it twice.

## Read first

The lot is not a blank canvas — it is heavily built and the user likes most of
it. **`git log --oneline -- src/proto/ct/lot.ts` before you touch anything**,
and read `notes/C-lot.md` and `notes/C-lot-pass.md`. The user approved the
palette in as many words: *"pole sign, bunting, banner copy, palette, all of it
lands"*. Do not repaint approved work.

His standing brief for the lot: *"do a high effort sleazy used car lot. make it
make sense like how does one even enter, drive a car off the lot. do some
research into what old sleazy used car lots looked like"* — and separately,
*"car lot needs to be deeper. i like your initial aesthetic but i want it
refined and a try hard version of it. get the typical car price signs yknow?"*

## Now

- [ ] **The left row of cars faces backwards.** REPORTED TWICE. This is the
      oldest unresolved item on the user's whole list and it has now been
      routed three times. Take it first, commit it alone.

      Verify BOTH ROWS INDEPENDENTLY. GOTCHAS 27: the mirror is where the bug
      hides, and a fix derived from the right-hand row and mirrored is exactly
      how this got reported a second time. Stand at the lot entrance and look
      down each row in turn: every car should present the same face.

- [ ] **Cars are clipping into each other.** ALSO REPORTED TWICE. The user:
      *"make sure none of the cars in the lot are clipping into each other"*.

      Do not hand-place them apart. There is already a mechanism — the draw
      runs each vehicle through `nudgeClear(...)` against the collider list —
      so the fix is to give it the right boxes to clear against, and then it
      stays fixed when anything moves. Write a check that reports any two lot
      vehicles whose boxes overlap, so it cannot regress quietly.

- [ ] **The chairs outside the office face the wall.** The user: *"the chairs
      are backwards"*. Ref `shots/user-lotchairs.png` — the blue and orange
      chairs outside the CROSSTOWN AUTO SALES office are turned so a person
      sitting in them would face the building. Anything with a front ends up
      backwards (GOTCHAS 23); while you are there, check every other seat,
      sign and board in the lot the same way, by standing where a person would
      use it.

- [ ] **The pole sign should be simpler.** The user wants one message. Keep the
      name; drop the phone number, which is already on the fence. The panel is
      also too small and reads skewed.

      **Do not darken its artwork.** It was deliberately enlarged and
      re-contrasted for legibility from the far kerb, and that trade stands.
      B has landed `m.userData.printed` on materials, which tells the night
      grader *printed, not lit* — apply it to the pole sign, the price cards,
      the windshield stickers, the sandwich boards and the fence banners.
      C measured 39 sheets in this module holding full daylight brightness
      after dark; they are yours now and the opt-out exists. That closes a
      real user request: *"make the unilluminated stuff darker. it should feel
      scarier at night."*

- [ ] **The garlands are disconnected.** They should terminate on real posts
      and chain between them rather than floating.

## Then

Once those land, the lot's standing brief is quality. Take your own
screenshots, in daylight and at night, and grade them skeptically before
reporting — the user asked for that by name: *"take screenshots yourself and
grade it and make sure you are impressed with it. be skeptical."*
