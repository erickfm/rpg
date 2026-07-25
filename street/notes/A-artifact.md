# Builder A — artifact rebuilt, ready for the desk to publish

**`street/dist/artifact.html`** — 668,439 bytes, built from **`1b990d7`**
("Approve B's puddle fix…"). Not committed: `dist/` is gitignored. Per the
queue I have not published it; that is the desk's step.

It carries everything landed up to that commit — the cross-file density fix, the
build stamp, the casino interior, the church on the main block, the library
courtyard, B's puddles.

## Verified, not just packed

Loaded from `file://` in a real browser rather than trusting the byte count:

- `__ct` initialises; **861 scene objects**
- **no failed network requests** — genuinely self-contained, which is the whole
  point of the packed file
- no page errors, no console errors
- interactive: the clock and warp hooks drive it, day → night works
- the corner renders with the density fix — `shots/artifact-corner.png`,
  `shots/artifact-night.png`

The stamp reads **`1b990d7 20:02`** in the bottom-right, with no `+`, so the
tree was clean when it was built. That is the first artifact that says which
build it is.

## Does the artifact still earn its keep?

The queue asked. Short answer: **yes, but only as a milestone snapshot — not as
the thing anyone playtests.** The desk should decide; here are the facts rather
than a preference.

**Against keeping it**

- The GitHub Pages deploy auto-deploys on push to `main` and
  `add-stick-and-city98` (`.github/workflows/pages.yml`), so it is current
  without anyone doing anything. The artifact needs a human to rebuild and
  republish, which is why it has been hours behind twice.
- The user playtests `localhost:5177`, which is ahead of both.
- It is a 668 KB single file that must be regenerated for every change.

**For keeping it**

- It is the only form that works with **no server and no network** — a
  `file://` open, or a link shared to someone without repo access. Pages needs
  the repo public and the workflow green.
- It is a **frozen** snapshot. Pages moves under you; the artifact is a thing
  you can point at and say "this build". With the sha now in-frame, a screenshot
  of it is self-identifying.

**Recommendation:** keep it, publish it at milestones only, and stop treating a
stale artifact as a bug — a milestone snapshot is *supposed* to lag. The staleness
problem the queue describes was really "nobody could tell which build a
screenshot came from", and the build stamp fixes that directly. If the desk
would rather retire it, the Pages URL covers everything except offline sharing.

## For the desk

- Publish `street/dist/artifact.html` to the existing artifact URL when ready.
  If you rebuild it yourself first, the stamp will change to your sha — worth
  keeping this one so the stamp matches what was verified above.
