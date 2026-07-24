# rpg — CROSSTOWN '97

All user feature requests and playtest feedback get logged to
`street/FEATURE-REQUESTS.md` (Inbox → In progress → Done). Work from that
list constantly; add every new user request to it immediately.

The user playtests the published artifact ("CROSSTOWN ’97 — the small
world"), not the local build — republish after landing changes:
`cd street && npm run build && node scripts/pack-artifact.mjs`, then
publish `street/dist/artifact.html` to the existing artifact URL.

Verify changes visually: `npx vite preview --port 4177` +
`node scripts/verify.mjs` (warp-screenshot sweep into `street/shots/`).

Screenshots are for LOOKING, never for PROVING — two runs of identical code
differ ~20% of pixels (unseeded `Math.random()` in the paint layer, plus the sim
runs during `warp`). To prove a change didn't move the world, fingerprint it:
`node scripts/scenedump.mjs <label>` then `node scripts/fpdiff.mjs a.json
b.json`. Textures + structure must match; 4–6 pigeons drifting is the noise
floor.

When more than one agent is working on this repo, follow
`street/PARALLEL-WORKFLOW.md` — desk + builder topology, worktree isolation,
handoff notes, merge protocol. It is a living doc: update it as we learn.
