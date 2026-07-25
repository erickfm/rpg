# Builder D — report

Working from `notes/queues/D-alley.md`: rebase on `add-stick-and-city98`, take
the top unchecked item, commit, re-read. I don't edit the queue — completions
are reported here. Earlier runs are in `notes/archive/feat-alley.md` and
`notes/archive/feat-roster.md`.

Base: `a8dd629`. `scripts/ownership.sh D` clean. Build clean.

---

## `## Now` → **bodega BLOCKER** — already fixed, RE-VERIFIED on this base

Fixed in the previous run and already merged, so there was nothing to commit.
But the tree moved a long way underneath it — `ct/street.ts` 1277 → 878 lines,
church and library out to `ct/civic.ts` — so I re-ran the walk test rather than
assume it survived the split:

| approach | result |
|---|---|
| east along the side-street walk | prompt, **enters** (`rig.pos.x 8 → 241.3`) |
| west along the side-street walk | prompt, **enters** |
| diagonally at the canted face | prompt, **enters** |

Driven with real key input and a real `e` press, not a screenshot. **Safe to
move to `## Done`.**

*Walking straight down the main street past the corner without turning gets no
prompt — correctly. The door faces the crossing diagonally, so you turn toward
it. That is wayfinding, not a blocker.*

**What it actually was** (the queue's diagnosis named the chamfer; it wasn't):
the **fruit-crate collider**, a single 2.2 m box `x 7.5…9.7, z -96.9…-96.2`
spanning the whole canted-bay frontage, with the `[E]` spot at `(8.7, -96.85)`
sitting **inside** it. You were stopped at `x = 7.13` from the east and
`x = 10.07` from the west — exactly the box inflated by the rig's `RADIUS`
(0.36), which is what identified it. Crates moved east and clear of the
doorway; their collider became two boxes, one per crate.

**Door coords, as the item asked:** canted face runs `A (7,-94) → B (9,-96)`,
outward normal `(-1,-1)/√2`, **door centre `(8.0, -95.0)`**. The existing
`[E]` spot `(8.7, -96.85) r 1.1` works and needs no change.

## BURGER BARN → red and beige — DONE (`d7e0b1f`)

**The queue listed this under `## Done` but the change had never reached the
code.** The fascia was still `#c8302a` red with an `#e8a02a` mustard stripe,
`#f2d24a` yellow lettering and an `#e8c26a` interior — the mustard was reading
as the second colour, which is why it kept coming back after being "fixed".

All three moved together and are now named at the top of `burgerFront`, so the
scheme is one place to change: `BB_RED`, `BB_BEIGE`, `BB_INSIDE`.
Shot: `shots/user-burger.png`.

---

## For the desk

**Port 4181 is still not free.** It is held by `/home/erick/projects/rpg`
running `vite preview --port 4177`, which auto-drifted onto it. I verified on
**4184 `--strictPort`** and checked the served bundle hash matched the one I had
just built. This has caught me twice — once a test ran green against another
worktree's build. Worth pinning every worktree with `--strictPort`, or stopping
that drifting server.

**`ct/civic.ts` untouched**, as instructed; the church-tower item is E's.

**Next item — moving the church onto DELI + RECORDS — is understood, not
started.** Two things that will shape it, flagged early so E and the desk can
weigh in before I cut anything:

- It is a **21 m slot against an 18 m nave**. Three metres has to come out of a
  neighbour in the same EAST run, because that run's widths are load-bearing
  (No. 227 sits at a fixed z that `ct/apartment.ts` depends on). I will pay for
  it out of an adjacent shop rather than let the run overflow.
- The church was authored **free-standing**, seen head-on from the side street,
  with its own return walls. On the main block it gets **party walls hard
  against it on both sides**, which will expose those returns and put a brick
  sign band running into stone at both junctions. That is exactly the seam work
  the item calls out, and some of it may need a change inside `ct/civic.ts` —
  E's file, so it goes through the desk.

Still open in my queue: bodega door readability, filling the crates, the church
move, signs (a) and (c), window lights, the corporation, and moving my `[E]`
spots onto `ctx.spot()`.
