#!/usr/bin/env node
// ITEM 165, THE REGRESSION GUARD: the watch still comes up and still goes away.
//
// `hud.watch()` used to write two literal transform strings and now calls one
// `watchTransform(shown)`. That is the kind of refactor that quietly breaks the
// STOW half, because a builder looks down (which is the interesting direction),
// sees the watch, and stops. If the stowed transform ever loses its
// `translateY(140%)` the arm sits across the middle of the frame permanently —
// which would be a far worse version of the complaint this item is about.
//
// Also asserts the tilt is ONE number: shown and stowed must rotate the same,
// or the arm swings as it rises instead of sliding.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w63-arm-stow.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 958 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const look = async (pitch) => {
  await p.evaluate((pi) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], 0, window.__ct.groundAt(q[0], q[2]), pi);
  }, pitch);
  await p.waitForTimeout(700);
  return p.evaluate(() => {
    const w = document.getElementById('ct-watch');
    const r = w.getBoundingClientRect();
    const m = new DOMMatrix(getComputedStyle(w).transform);
    return {
      // the rotation the matrix actually carries, in degrees
      deg: +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(2),
      top: +r.top.toFixed(1),
      onScreen: r.top < 958,
    };
  });
};

const down = await look(-1.25);      // the posture his screenshot is taken in
const up = await look(0.10);         // looking out at the room

let fails = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

console.log(`\n  looking DOWN  ${JSON.stringify(down)}`);
console.log(`  looking UP    ${JSON.stringify(up)}\n`);
ok(down.onScreen, 'looking down brings the watch into frame');
ok(!up.onScreen, 'looking up stows it clear of the bottom edge');
ok(up.top > down.top + 200, `it SLIDES down out of frame (${down.top} -> ${up.top})`);
ok(down.deg === up.deg, `one tilt, both states (${down.deg}° / ${up.deg}°)`);
ok(down.deg <= -12, `the forearm goes down and away, not across (${down.deg}°, was -5°)`);

console.log('');
if (fails) { console.log(`  ${fails} FAILED\n`); await b.close(); process.exit(1); }
console.log('  all good\n');
await b.close();
