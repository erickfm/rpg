#!/usr/bin/env node
// The CLI front end for scripts/lib/shared-checkout.mjs -- read that file for
// why this exists and how the two facts are measured. Item 243.
//
// Wired into package.json at the three scripts that can actually do harm in the
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
// Deliberately NOT wired into the read-only measurement scripts (`sweep`, `fp`,
// `checks`, `capture`, ...). Those have their own, different problem -- reading
// the wrong world -- and it already has an instrument: scripts/lib/which-world.mjs
// (GOTCHAS 26, 48). Adding a second warning there would blunt this one.
//
// Usage: node scripts/guard-shared-checkout.mjs "<what you were about to do>"
import { treeKind, isSubagent, verdict } from './lib/shared-checkout.mjs';

let msg = null;
try {
  const { kind, top } = treeKind();
  msg = verdict({
    kind,
    subagent: isSubagent(),
    top,
    what: process.argv[2] || 'this command',
  });
} catch {
  msg = null;               // fail open, always. See the lib header.
}

if (msg) { process.stderr.write(`${msg}\n`); process.exit(1); }
