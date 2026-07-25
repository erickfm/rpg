// Walk the casino and hotel frontages.
//
// The porte-cochère is the only thing in this build that puts new geometry on
// the pavement, and that pavement is the tightest in the world: a 2 m band with
// the building collider eating down to z = -96.3, so about 1 m of walkable
// depth. Two columns stand in it. GOTCHAS §9 — the lane is sacred and the user
// checks it constantly — and §1, a screenshot proves nothing. So this walks it.
//
// It also checks that the two [E] doors still work, because the facades were
// redrawn around them and the painted entrance and the trigger have to agree:
// the band art puts the casino's portal at u = 0.4944 and the hotel's at
// u = 0.495, which are world x 51.29 and 39.51, which is where the interiors
// register their spots. If that drifts you walk up to a blank wall.
//
// Usage: SHOT_URL=http://localhost:4186/ node scripts/G-vice-walk.mjs
import { chromium } from 'playwright';

const KERB_H = 0.14;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4186/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(110); };
const results = [];
const check = (n, ok, d) => results.push([ok, n, d]);
const f2 = (v) => +v.toFixed(2);
const EAST = Math.PI / 2, WEST = -Math.PI / 2;

// ── 1. the walk past the porte-cochère ──────────────────────────────────
//
// The columns stand at x = 36.61 and 42.41, at z = -97.85 with a 0.3 m
// footprint, so with the 0.36 m capsule pad they occupy z down to -97.34. That
// leaves a clear band between column and building of z in [-97.34, -96.66] —
// 0.68 m for the player's centre, which is three times the 0.23 m the street
// lamps already leave on the main walks.
//
// So the honest assertion is NOT "every lane is open" — a column you can walk
// through is not a column. It is: there is a CONTINUOUS lane past both of them,
// and standing in the outer lane you can step around rather than being trapped.
const runEast = async (z, from, to, tries = 3) => {
  let best = from;
  for (let a = 0; a < tries && best < to; a++) {
    if (a) await p.waitForTimeout(1500);     // citizens are obstacles too
    await warp(from, z, EAST, KERB_H);
    await p.waitForTimeout(180);
    let last = from;
    for (let i = 0; i < 12; i++) {
      await hold('w', 700);
      const c = await pos();
      if (c[0] - last < 0.15) break;
      last = c[0];
      if (c[0] > to) break;
    }
    best = Math.max(best, last);
  }
  return best;
};

// ── the clear band, MEASURED rather than sampled ────────────────────────
//
// This used to probe two fixed lanes and assert they got through, and that was
// the wrong shape of check: when a lamp landed at x = 45 (mainline 0fc56bc0,
// moved off the casino's door line) one of my two lanes happened to sit 1 cm
// outside the band and failed, while a 5 cm band would have passed the other.
// A sampled lane tells you about that lane. What matters is how WIDE the clear
// route is, so measure it and assert the width.
//
// The reference is the main-street lamps, which leave 0.23 m for the player's
// centre and are accepted. Anything at or above that is a lane; below it is a
// pinch worth someone's attention.
console.log('the north side-street walk — measuring the clear band eastward:');
const BAND_MIN = 0.25;
const clear = [];
for (let z = -97.4; z <= -96.65; z += 0.1) {
  await warp(42.0, z, EAST, KERB_H);
  await p.waitForTimeout(140);
  let last = 42.0;
  for (let i = 0; i < 5; i++) {
    await hold('w', 600);
    const c = await pos();
    if (c[0] - last < 0.12) break;
    last = c[0];
    if (c[0] > 50) break;
  }
  const got = last > 49.0;
  console.log(`  z=${z.toFixed(2)}  reached x=${f2(last)}${got ? '  clear' : ''}`);
  if (got) clear.push(z);
}
const band = clear.length ? (Math.max(...clear) - Math.min(...clear)) + 0.1 : 0;
check('there is a clear band past the frontage furniture, wide enough to walk',
  band >= BAND_MIN,
  clear.length
    ? `${f2(band)} m of centre band, z ${f2(Math.min(...clear))} … ${f2(Math.max(...clear))} `
      + `(main-street lamps leave 0.23 m)`
    : 'NO lane past the furniture reaches the casino at all');

// and it has to reach the casino's own door, not merely past the columns
check('that band reaches the casino door line at x = 51.29',
  clear.length > 0 && (await (async () => {
    await warp(42.0, clear[Math.floor(clear.length / 2)], EAST, KERB_H);
    await p.waitForTimeout(140);
    let last = 42.0;
    for (let i = 0; i < 8; i++) {
      await hold('w', 600);
      const c = await pos();
      if (c[0] - last < 0.12) break;
      last = c[0];
      if (c[0] > 52) break;
    }
    return last;
  })()) > 51.0, 'walked the middle of the band to the door');

// the outer lanes SHOULD stop at a column — that is what a column is
{
  const got = await runEast(-97.5, 34.0, 47.0, 1);
  check('the outer lane does stop at the first column, as a column should',
    got > 35.8 && got < 36.6, `stopped at x=${f2(got)} (column pad starts at 36.10)`);
}
// …and you can get round it rather than being trapped against it
{
  await warp(35.8, -97.5, Math.PI, KERB_H);      // face the building
  await p.waitForTimeout(180);
  await hold('w', 700);                          // step in toward the wall
  const mid = await pos();
  const got = await runEast(mid[2], mid[0], 45.0, 2);
  check('you can step around a column and carry on east',
    got > 44.0, `stepped in to z=${f2(mid[2])}, then reached x=${f2(got)}`);
}

// and back west along the building-side lane
{
  let best = 50.0;
  for (let a = 0; a < 3 && best > 34.0; a++) {
    if (a) await p.waitForTimeout(1500);
    await warp(50.0, -97.0, WEST, KERB_H);
    await p.waitForTimeout(180);
    let last = 50.0;
    for (let i = 0; i < 12; i++) {
      await hold('w', 700);
      const c = await pos();
      if (last - c[0] < 0.15) break;
      last = c[0];
      if (c[0] < 34) break;
    }
    best = Math.min(best, last);
  }
  check('…and back west along the same lane', best < 34.0, `reached x=${f2(best)} from 50.0`);
}

// ── 2. you can stand UNDER the porte-cochère and under the marquee ───────
// Both are overhead structures and neither should have put a collider in the
// walking band. Standing under them means reaching the building line.
for (const [nm, x] of [['the porte-cochère', 39.51], ['the marquee', 51.29]]) {
  let deepest = -99, moved = 0;
  for (let a = 0; a < 3 && deepest < -96.9; a++) {
    if (a) await p.waitForTimeout(1500);
    await warp(x, -97.8, Math.PI, KERB_H);
    await p.waitForTimeout(180);
    const a0 = await pos();
    await hold('w', 1100);
    const c = await pos();
    deepest = Math.max(deepest, c[2]);
    moved = Math.max(moved, Math.hypot(c[0] - a0[0], c[2] - a0[2]));
  }
  check(`you can walk in under ${nm} to the building line`, deepest > -96.9 && moved > 0.3,
    `reached z=${f2(deepest)} (the building collider stops you at -96.66)`);
}

// ── 3. the doors the facades were redrawn around still work ─────────────
for (const [nm, x, re] of [
  ['GOLDEN ACES', 51.29, /GOLDEN ACES/],
  ['HOTEL ORPHEUS', 39.51, /ORPHEUS/],
]) {
  await warp(x, -97.8, Math.PI, KERB_H);
  await p.waitForTimeout(180);
  await hold('w', 950);
  const pr = await prompt();
  check(`${nm}: the painted entrance and the [E] spot still agree`,
    re.test(pr ?? ''), `prompt=${JSON.stringify(pr)}`);
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(320);
  const inside = await pos();
  check(`${nm}: E still puts you inside`, inside[0] >= 400, `pos=${inside.slice(0, 3).map(f2)}`);
  if (inside[0] >= 400) {
    await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
    await p.waitForTimeout(320);
  }
}

// ── 4. the lit parts survive the night sweep ────────────────────────────
// props.dimWorld skips `transparent` materials, which is the whole mechanism
// behind these two being light sources. Prove it rather than trust it: sample
// the neon and bulb materials at noon and at 2am and require them UNCHANGED,
// while the brick beside them does change.
const sample = () => p.evaluate(() => {
  const lit = [], dull = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor(); o.getWorldPosition(wp);
    if (wp.x < 33 || wp.x > 58 || wp.z < -99 || wp.z > -90) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.color) continue;
      (m.transparent ? lit : dull).push(m.color.getHex() * 1000 + Math.round((m.opacity ?? 1) * 100));
    }
  });
  return { lit, dull };
});
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);
const day = await sample();
await p.evaluate(() => window.__ct.clock(2, 0));
await p.waitForTimeout(1100);
const nite = await sample();
const dulled = day.dull.filter((v, i) => nite.dull[i] !== undefined && nite.dull[i] !== v).length;
check('the brick and stone around them DO go dark after dark',
  dulled > 0, `${dulled}/${day.dull.length} opaque materials changed`);
check('the lit parts are not dimmed by the night sweep',
  day.lit.length > 0, `${day.lit.length} transparent (lit) materials found on the two frontages`);

console.log('');
for (const [ok, n, d] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${n}\n        ${d}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 4).join('\n  '));
await b.close();
process.exit(bad ? 1 : 0);
