// DOES A DRIZZLE ACTUALLY LOOK LIKE RAIN? Item 110.
//
// The user: *"rain seems extra intense now. thats fine but i want a drizzle to
// also exist and be more likely than the downpour featured here."*
//
// `scripts/probes/w59-storm-dist.mjs` already answers the SECOND half — the
// histogram over 20000 hours, and it passes. A distribution cannot answer the
// first half. "A drizzle exists" is a claim about what you SEE, and the failure
// mode of dropping a storm floor is that the weakest storms stop reading as
// weather at all — which is the complaint on file in the opposite direction
// (rain too faint), and the reason `STORM_FLOOR` is 0.34 and not 0.
//
// So this forces the lightest and the heaviest storm the world can draw and
// photographs both.
//
// AT THE SAME HOUR OF DAY, which is the whole care in this file. `hourAbs` is
// `floor(totalMin / 60)` (crosstown.ts:1850) and `__ct.clock(h)` sets exactly
// that, so hours 13, 37, 61 … are all 13:00 with DIFFERENT storm draws. Compare
// a storm at 13:00 against one at 03:00 and you are looking at the night wash,
// not at the rain. Both frames here are the same light.
//
// `rainAt` and `stormAt` are read off `scene.userData` (ct/props.ts:240, :293)
// rather than re-derived — two scripts once hand-copied that formula and both
// copies were wrong.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4540/');
const HOUR_OF_DAY = Number(process.env.HOUR || 13);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

// ── find the lightest and heaviest wet hour that fall at HOUR_OF_DAY ─────────
const pick = await p.evaluate(([hod]) => {
  const u = window.__ct.scene().userData;
  if (!u.rainAt || !u.stormAt) return { err: 'rainAt/stormAt not published on scene.userData' };
  const wet = [];
  for (let h = hod; h < 200000; h += 24) if (u.rainAt(h)) wet.push({ h, s: u.stormAt(h) });
  if (!wet.length) return { err: `no wet hour at all at ${hod}:00` };
  wet.sort((a, c) => a.s - c.s);
  return { light: wet[0], heavy: wet[wet.length - 1], n: wet.length };
}, [HOUR_OF_DAY]);
if (pick.err) { console.log(`ABORT  ${pick.err}`); await b.close(); process.exit(3); }

console.log(`${pick.n} wet hours land at ${HOUR_OF_DAY}:00 over 200000 hours`);
console.log(`lightest  hour ${pick.light.h}  stormAt ${pick.light.s.toFixed(3)}`);
console.log(`heaviest  hour ${pick.heavy.h}  stormAt ${pick.heavy.s.toFixed(3)}`);
// POPULATION FLOOR: if the two draws are the same there is no intensity axis
// and both frames below would be the same picture (this is the exact defect
// stormAt was added to fix — "EVERY storm was the same storm").
if (!(pick.heavy.s - pick.light.s > 0.3)) {
  console.log(`ABORT  the range is only ${(pick.heavy.s - pick.light.s).toFixed(3)} — no intensity axis to photograph`);
  await b.close(); process.exit(3);
}

// ── stand on the street. Rain is suppressed at px >= 100 (ct/props.ts:2376) ──
const shoot = async (name, hour) => {
  await p.evaluate(([h]) => {
    // On the pavement looking DOWN the street, not across it at a shopfront —
    // rain is a few hundred thin streaks and a wall two metres away fills the
    // frame with the one surface they are hardest to see against. The first cut
    // of this probe stood at (6, -14) facing a bodega window and the drizzle
    // was legible only in the strip of sky above it.
    window.__ct.warp(3.2, 8, Math.PI, 0, 0.05);
    window.__ct.clock(h % 24, 0);
    return null;
  }, [hour]);
  // the clock verb takes hour-of-day; set the ABSOLUTE hour the draw needs
  await p.evaluate(([h]) => { window.__ct.clock(h, 0); }, [hour]);
  // rainLevel ramps at dt*0.6 per frame — wait for the world to say it is
  // raining rather than sleeping a guessed number of ms (GOTCHAS 30).
  const got = await p.waitForFunction(() => {
    const u = window.__ct.scene().userData;
    return u.rainLevel > 0.97 ? { lvl: u.rainLevel, storm: u.stormNow, heavy: u.rainHeavy } : false;
  }, null, { timeout: 30000 }).then((h2) => h2.jsonValue()).catch(() => null);
  if (!got) { console.log(`  ${name}: rain never established — cannot photograph it`); return null; }
  await waitPainted(p, { quiet: true });
  const path = `shots/w98-rain-${name}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${path}  rainLevel ${got.lvl.toFixed(3)}  stormNow ${got.storm.toFixed(3)}  `
    + `rainHeavy ${got.heavy.toFixed(3)}  black ${black}`);
  return got;
};

const a = await shoot('drizzle', pick.light.h);
const c = await shoot('downpour', pick.heavy.h);

let bad = 0;
const verdict = (n, ok, d) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
console.log('');
verdict('established', !!a && !!c, 'rain came on for both draws');
if (a && c) {
  verdict('distinct', c.storm - a.storm > 0.3,
    `stormNow ${a.storm.toFixed(3)} vs ${c.storm.toFixed(3)} — the two frames are different weather`);
  verdict('latched', Math.abs(a.storm - pick.light.s) < 0.01 && Math.abs(c.storm - pick.heavy.s) < 0.01,
    'the world latched the strength the draw asked for, not some other hour\'s');
  verdict('floor', a.storm >= 0.34,
    `the lightest storm is ${a.storm.toFixed(3)}, at or above STORM_FLOOR 0.34 — not zero rain`);
}
if (errs.length) console.log(`\npage errors: ${errs.length}\n${errs.slice(0, 3).join('\n')}`);
console.log(`\n${bad === 0 ? 'ALL GREEN — now LOOK at the two frames' : `${bad} FAILED`}`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
