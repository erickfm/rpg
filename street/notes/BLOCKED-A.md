# BLOCKED — builder A

Two things, both needing somebody other than me. Neither is urgent enough to
stall the project; both are small for the person who can do them.

## 1. THE CRITICAL PATH — the last fifth of the facade brief needs D's file

**The desk has just redirected me here** ("go back to the facade work — that is
what the user is looking at"), and this is the only facade work left. Everything
in `tex-world.ts` is done and verified day and night; what remains cannot be
done from my file at all. So this decision is now the thing standing between the
user and the rest of what they asked for.

**What I need:** a bounded mandate for `ct/street.ts`, or a decision that the
current state is enough.
**From whom:** the desk, and probably a word from the user first.

The queue's shopfront item asks for a fascia and stallriser that **project**,
a **projecting blade** sign, and glass **set back** from the brick. What shipped
reads as depth but is painted: `reveal()`, `proud()` and `glazed()` shade the
openings so they look built. At 16 px/m that is the honest fix for a fascia lip
— a 50 mm projection is a third of a texel and modelling it would be invisible.

Three things in the brief are NOT that, because they are 0.3–0.6 m and would
genuinely read as geometry:

- an **awning** over a shopfront
- a **projecting blade sign** at right angles to the facade
- a **recessed doorway** you can actually stand in

All three are meshes, and shopfront meshes are built in `placeBld` /
`placeBldZ` in `ct/street.ts`, which is D's. I can supply the builder from
`ct/tex-world.ts`; the change in D's file is one call per placement function.

**Worth asking the user before spending it.** The complaint was "flat painted
plane", and it no longer reads flat: `shots/ff-diner.png` and `shots/ff-night.png`
are the current state, day and night. If that is what they meant, this item is
DONE and should be closed rather than left open. If they meant literal
projection, the three above are the shape of it and it needs the mandate.

I cannot answer that one myself, which is why it is here rather than in a note.

## 2. `ensureAlive` should be adopted by the shooting scripts

**What I need:** either an owner's edit, or permission for me to make it.
**From whom:** the desk, or whoever owns `verify.mjs` / `bugsweep.mjs` /
`seams*.mjs`.

This environment drops the WebGL context periodically and a dead canvas
screenshots as a white page with the DOM overlay still on it, so it looks like
a real capture. `scripts/shotguard.mjs` (mine, landed) exports `ensureAlive(page)`
to prevent it and audits PNGs after the fact to catch it.

The audit path already works on anyone's output with no edits:

```
npm run sweep && node scripts/shotguard.mjs shots/     # exits non-zero, chains
```

But the shooting scripts still capture blind. Adding one `await ensureAlive(p)`
before each `page.screenshot` in `verify.mjs`, `bugsweep.mjs` and `seams*.mjs`
closes it at the source. Those are other agents' scripts, so per OWNERSHIP.md I
have not touched them.

## Clearing builder D, both halves

`BLOCKED-D.md` had two asks and both are answered:

1. **The five exports — done** (`5b1e8991`). `HI`/`SH`/`DP`, `Band`,
   `reveal`/`proud`/`glazed`/`mullions` are exported, no signature changed.
   Note `Band` was NOT already exported as BLOCKED-D.md assumed; without it the
   five would have blocked again one line later. I exported `SH` and `DP` as
   well as `HI` because they are one set, and exporting one of three invites a
   fourth to be invented locally.
2. **Window lights — I am out of `ct/tex-world.ts`.** D's second ask was for the
   desk to confirm my mandate had closed. It has: my queue's tex-world items are
   all on mainline and I have no further planned edits there. **D can take the
   window-lights item now.** The static pattern is a `litAt(f, c)` hash in
   `facadeTex`, deliberately left static so it can be driven off the night
   curve — that was the handover it was waiting for.

## Not blocked, just waiting on you

`street/dist/artifact.html` is packed and verified, unpublished. Regenerate with
`node scripts/pack-artifact.mjs` immediately before publishing — it builds and
packs in one step now, and any bare `vite build` in between wipes it.

## And the reason this file exists at all

My queue has been byte-identical for three sessions and every item in it is on
mainline. I have not edited it — the README is clear that builders only read —
and the report is the authority, so I have said so in each handoff instead.

The detector that was supposed to surface that could not see my reports:
`desk.sh` matched them by worktree name (`*split2b*`) and mine are named by
builder letter (`A-*`). Fixed in `fb65b1c1`; it was suppressing `civic` and
`entrance` too. **Re-run `scripts/desk.sh` — the board is noisier now and more
of it is true.**
