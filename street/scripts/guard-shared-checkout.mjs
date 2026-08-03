#!/usr/bin/env node
// The CLI front end for scripts/lib/shared-checkout.mjs -- read that file for
// why this exists and how the facts are measured. Items 243 and 247.
//
// Wired into package.json at the scripts that can actually do harm in the
// shared checkout:
//
//   preinstall  -- npm runs it before `npm install`, the command BUILDER-BRIEF
//                  §0 tells every builder to run, and half of the worst
//                  incident. This is why the whole path fails open: a bug here
//                  would brick installs project-wide.
//   build       -- the other half. `vite build` empties the shared `dist/`,
//                  which is what blinded a preview the worker did not own.
//   dev / live  -- these bind port 5177, the user's live integration world.
//
// ...and, since item 247, into `vite.config.ts` as well, because a bare
// `npx vite --port N` in the shared tree bypasses `package.json` entirely and
// was unguarded. Vite reads its config for dev, build and preview alike, so one
// hook there closes all three.
//
// Deliberately NOT wired into the read-only measurement scripts (`sweep`, `fp`,
// `checks`, `capture`, ...). Those have their own, different problem -- reading
// the wrong world -- and it already has an instrument: scripts/lib/which-world.mjs
// (GOTCHAS 26, 48). Adding a second warning there would blunt this one.
//
// ⚠ THE DESK IS NOT REFUSED, AND THE REASON IS NOT AN ENV VAR. The desk's shell
// and a builder's shell share one environment block and one parent process --
// measured, 65 variables, byte-identical but for `_`, `OLDPWD`, `PWD`, `SHLVL`.
// The separating fact is WHERE THE SHELL WAS STANDING. See the lib header.
//
// Usage: node scripts/guard-shared-checkout.mjs "<what you were about to do>"
import { checkHere } from './lib/shared-checkout.mjs';

const msg = checkHere(process.argv[2] || 'this command');

if (msg) { process.stderr.write(`${msg}\n`); process.exit(1); }
