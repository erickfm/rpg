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
