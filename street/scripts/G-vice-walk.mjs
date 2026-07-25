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
import { reportWorld } from './lib/which-world.mjs';

const KERB_H = 0.14, RADIUS = 0.36;   // the player capsule, for the geometric band
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4186/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4186/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(110); };
// ── ASK where the two doors are ─────────────────────────────────────────
//
// These were literals — 51.29 and 39.51 — and they passed even after the spots
// drifted 0.25 m in 095c7d63, because the trigger radius is wider than the
// error. A check that types the number it is verifying verifies nothing.
// `doorStandFor` publishes where a player is meant to stand and the rooms and
// the facade painter read the same declaration, so these three cannot disagree.
const STAND = {};
for (const nm of ['GOLDEN ACES', 'HOTEL ORPHEUS']) {
  // Through `__ct.doors()`, NOT `import('/src/proto/ct/doors.ts')`. That source
  // path only exists on the dev server, so the old form made this suite
  // dev-only — and dev is precisely where the door-drop bug (1e49295b) is
  // invisible. A check that cannot be pointed at the built bundle cannot see
  // anything the bundler does. The runtime API says the same thing and works in
  // both, so `SHOT_URL=<a vite preview> node scripts/G-vice-walk.mjs` now runs.
  const d = await p.evaluate((name) => {
    const e = window.__ct.doors().find((q) => q.building === name);
    return e && e.stand && e.point
      ? { sx: e.stand.x, sz: e.stand.z, px: e.point.x, pz: e.point.z } : null;
  }, nm);
  if (!d) { console.error(`no declaration for ${nm}`); process.exit(2); }
  STAND[nm] = d;
}
const ACES = STAND['GOLDEN ACES'], ORPH = STAND['HOTEL ORPHEUS'];
// The facade plane, derived rather than typed. A door POINT sits on the facade
// by definition — `doorStandFor` is that point pushed out along the outward
// normal by the standoff — so the declaration gives the wall's z for free. The
// walk band and the building-line assertions below used to carry -96.66 and
// -96.9 as literals, which is a number ct/street.ts owns and could move under
// them; the same fault as the door literals in d955a0fc.
const FACADE_Z = ACES.pz;

// ── --selftest: prove this suite can still fail ─────────────────────────
//
// checks.mjs's convention for a walking suite (D-walk's): invert known truths
// and require every one to fail. Two inversions here, both in the harness rather
// than in src/, so nothing has to be mutated or restored.
//
// The band bar goes to 3 m — wider than the whole 2 m pavement, so no frontage
// can satisfy it — and the blade comparison is asked to find MIRRORED faces where
// the world has identical ones. Both target checks that caught real defects: the
// band flagged a blocked walk, and the blade check fails either way of mirroring.
const SELFTEST = process.argv.includes('--selftest');
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

/** runEast's mirror. Same retry, same reason — see the note on the westward
 *  band check. Keeps the BEST (lowest x) reached across tries. */
const runWest = async (z, from, to, tries = 3) => {
  let best = from;
  for (let a = 0; a < tries && best > to; a++) {
    if (a) await p.waitForTimeout(1500);     // citizens are obstacles too
    await warp(from, z, WEST, KERB_H);
    await p.waitForTimeout(180);
    let last = from;
    for (let i = 0; i < 12; i++) {
      await hold('w', 700);
      const c = await pos();
      if (last - c[0] < 0.15) break;
      last = c[0];
      if (c[0] < to) break;
    }
    best = Math.min(best, last);
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
// Measured from x = 30, WEST of the hotel, not from 42. Starting at 42 only
// covered the eastern porte-cochère column and the lamp beyond it; the western
// column at 36.61 and the whole hotel approach were outside the probe. That was
// a coverage gap I introduced when I replaced the two fixed lanes, and B has
// since put lamps on this walk at x 20 and 45 (mainline d896c64f), so the run
// now has four things on it and the band has to be the band past ALL of them.
console.log('the north side-street walk — measuring the clear band eastward:');
const BAND_MIN = SELFTEST ? 3.0 : 0.25;   // 3 m is wider than the pavement

// MEASURED OFF THE STATIC COLLIDERS, not by walking each lane.
//
// This walked ten lanes and called a lane clear if the walker got past the door.
// A pedestrian standing in one lane makes it read as blocked, and it failed three
// times on worlds whose geometry was provably identical — dev clear at
// z -97.0…-96.7, one dist run at -96.8…-96.7, another with no clear lane at all,
// while the fingerprint showed placement matching to within pigeon drift. The
// question this check asks is how wide the BUILT lane is; a citizen standing on
// it is a different question and mainline already keeps the two apart
// (7c13237f measures the built lane with movers dropped and reports the
// pedestrian case as its own number).
//
// Movers are identified the way scripts/lane3.mjs does it: snapshot the collider
// list twice, and keep only the boxes that are byte-identical in both. Anything
// that moved between the snapshots is a citizen or a vehicle.
//
// THAT IDIOM HAS A KNOWN HOLE and it is the one that just made the auditor
// retract a finding (3f7b2623: "the mid-walk post was a stopped citizen"). A
// pedestrian who happens to stand still across the whole window is byte-identical
// in both snapshots and gets counted as furniture, which would narrow this band
// and read as a defect in the frontage.
//
// So I measured it rather than assuming the window is long enough. Comparing the
// 1.5 s static set against one taken over a further 8 s, on this walk:
//
//   total 216 · static by 1.5 s 210 · still static after 9.5 s 210
//   boxes the short window called static but that moved later: 0
//   band 0.44 m from both sets, z -97.08 … -96.66 either way
//
// Zero ghosts, so nothing standing on the side street was mistaken for a post at
// this HEAD. It is a property of these six movers and this walk, not a guarantee:
// if this check ever reports a band that is narrow by exactly one citizen's
// width, take the long-window measurement again before believing it.
//
// The walking checks below are unchanged and still walk — geometry says the gap
// exists, walking says a body can get through it, and I want both.
const statics = await (async () => {
  const snap = () => p.evaluate(() => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map((c) => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));
  const a1 = await snap();
  await p.waitForTimeout(1500);
  const a2 = new Set((await snap()).map((c) => c.join('|')));
  const stat = a1.filter((c) => a2.has(c.join('|')));
  console.log(`  ${a1.length} colliders, ${stat.length} static (${a1.length - stat.length} moving — dropped)`);
  return stat;
})();

// A lane at height z is clear if no static box blocks the corridor from x = 30 to
// the casino door, inflated by the player's radius in both axes.
const X0 = 30.0, X1 = ACES.px;
const laneClear = (z) => !statics.some(([mnX, mxX, mnZ, mxZ]) =>
  z > mnZ - RADIUS && z < mxZ + RADIUS && mxX + RADIUS > X0 && mnX - RADIUS < X1);
const clear = [];
for (let z = FACADE_Z - 1.4; z <= FACADE_Z - 0.60; z += 0.02) {
  if (laneClear(+z.toFixed(2))) clear.push(+z.toFixed(2));
}
for (const z of clear.length ? [Math.min(...clear), Math.max(...clear)] : [])
  console.log(`  clear lane edge at z=${z.toFixed(2)}`);
const band = clear.length ? (Math.max(...clear) - Math.min(...clear)) + 0.02 : 0;
check('there is a clear band past the frontage furniture, wide enough to walk',
  band >= BAND_MIN,
  clear.length
    ? `${f2(band)} m of centre band, z ${f2(Math.min(...clear))} … ${f2(Math.max(...clear))}, `
      + `x 30 → past the casino door (main-street lamps leave 0.23 m)`
    : 'NO lane runs the frontage from x 30 to the casino door');

// …and westward too, because a one-way frontage is still a broken one
// Through runWest for the same reason the eastward sweep goes through runEast:
// this was the other inline single walk, and I converted only half the pair in
// edc0f7f4. It duly failed on the next run — a pedestrian in the lane, on an
// unchanged world — which is what a half-applied fix earns.
//
// Its message was also useless: it read "walked the middle of the band back to
// the hotel end" whether the walker reached the hotel or never moved, so the one
// time it failed it said nothing about why. A check that cannot report its own
// measurement cannot be diagnosed from a log.
const backWest = clear.length ? await runWest(clear[Math.floor(clear.length / 2)], 52.0, 30.0) : 52.0;
check('the same band runs back west past both columns',
  clear.length > 0 && backWest < 33.0,
  `walked the middle of the band from x 52 back to x=${f2(backWest)} (want < 33.0)`);

// the outer lanes SHOULD stop at a column — that is what a column is
//
// `tries` was 1 here and that was a mistake that took a while to show itself:
// this check FAILED once reporting x = 34.00, its own start point, and probing
// the lane by hand immediately afterwards reached 36.06 — the column, exactly
// where it belongs. Nothing was wrong with the world; a citizen was standing in
// the lane for that one run.
//
// runEast takes the MAX over its tries, so for a check of the form "you get this
// far and no further" a retry can only ever correct a wanderer blocking the
// start. There was never a reason to disable it, and disabling it turned a
// citizen into a facade defect. The default 3 is right.
//
// The upper bound is what makes this check mean something, so it stays: if the
// column vanished the walker would sail past 36.6 and this fails.
{
  const got = await runEast(-97.5, 34.0, 47.0);
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
for (const [nm, x] of [['the porte-cochère', ORPH.px], ['the marquee', ACES.px]]) {
  let deepest = -99, moved = 0;
  for (let a = 0; a < 3 && deepest < FACADE_Z - 0.9; a++) {
    if (a) await p.waitForTimeout(1500);
    await warp(x, FACADE_Z - 1.8, Math.PI, KERB_H);
    await p.waitForTimeout(180);
    const a0 = await pos();
    await hold('w', 1100);
    const c = await pos();
    deepest = Math.max(deepest, c[2]);
    moved = Math.max(moved, Math.hypot(c[0] - a0[0], c[2] - a0[2]));
  }
  check(`you can walk in under ${nm} to the building line`,
    deepest > FACADE_Z - 0.9 && moved > 0.3,
    `reached z=${f2(deepest)}, facade at ${f2(FACADE_Z)} — within ${f2(FACADE_Z - deepest)} m of it`);
}

// ── 3. the doors the facades were redrawn around still work ─────────────
for (const [nm, x, re] of [
  ['GOLDEN ACES', ACES.px, /GOLDEN ACES/],
  ['HOTEL ORPHEUS', ORPH.px, /ORPHEUS/],
]) {
  await warp(x, FACADE_Z - 1.8, Math.PI, KERB_H);
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
// This check was named "the lit parts are not dimmed by the night sweep" and
// asserted `day.lit.length > 0` — a PRESENCE COUNT that never compared the two
// samples. The name claimed the thing the assertion did not test. Renamed to what
// it does, and the claim it was pretending to make is now tested below, where it
// can be made properly.
//
// A blanket "no transparent material dims" would be wrong here, not just weak:
// the chase ticks on (n, t) and its phase materials are a different colour every
// frame by design, so day-vs-night on those compares animation phase. The lit
// elements that ARE monotone in the night factor are the ground sheets, so that
// is what gets asserted.
check('there are lit (transparent) materials on the two frontages at all',
  day.lit.length > 0, `${day.lit.length} transparent (lit) materials found`);

// ── 5. the pavement in front of them is actually coloured at night ──────
//
// The queue asked for this in as many words — "at night they should spill onto
// the street … so the pavement in front of them is coloured" — and nothing
// checked it. It is the headline of the whole item: these two are the only
// buildings in the world that are light SOURCES, and the evidence for that claim
// is light landing on ground they do not own.
//
// The mechanism is a per-frame tick reading the night factor off the scene
// background, so it can fail silently and completely — the sheets would just sit
// at their daylight opacity and the street would stay grey. Nothing about the
// geometry would look wrong, which is why a fingerprint cannot see it either.
// STAND WHERE YOU CAN SEE THEM FIRST. The night factor is computed in a
// `driverHost.onBeforeRender` hanging off the casino marquee (ct/vice.ts:1047),
// so it only runs on frames where that mesh is actually RENDERED. The checks
// above leave the player inside the hotel at x 756, where the facade is far
// outside the frustum — every tick freezes at its initial daylight value.
//
// Written without this, the check FAILED reporting noon and 23:00 opacities
// identical to three decimals, which reads exactly like "the spill is dead" and
// would have been filed as a defect in the user's headline item. The world was
// fine; the camera was 700 m away and pointed at a wall. A per-frame value can
// only be sampled from a viewpoint that causes the frame.
const sheets = (h, m) => p.evaluate(async ([h, m]) => {
  window.__ct.warp(45, -103, Math.PI, 0, 0);        // in the road, facing the pair
  window.__ct.clock(h, m);
  await new Promise((r) => setTimeout(r, 800));
  const out = [];
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let mod = null;
    for (let q = o; q; q = q.parent) if (q.userData && q.userData.mod) { mod = q.userData.mod; break; }
    if (mod !== 'vice') return;
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mt || !mt.transparent) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.y - bb.min.y > 0.2 || bb.min.y > 0.9) return;        // flat, and on the ground
    out.push({ x: +((bb.min.x + bb.max.x) / 2).toFixed(2), op: +mt.opacity.toFixed(3) });
  });
  return out.sort((a, c) => a.x - c.x);
}, [h, m]);
const sDay = await sheets(13, 0), sNite = await sheets(23, 0);
check('the two buildings put light on the pavement, and only after dark',
  sDay.length >= 4 && sDay.length === sNite.length
    && sDay.every((d, i) => sNite[i].op >= d.op * 2)
    && Math.min(...sNite.map((q) => q.op)) >= 0.25,
  sDay.length
    ? `${sDay.length} ground sheets; noon ${sDay.map((q) => q.op).join('/')} → 23:00 ${sNite.map((q) => q.op).join('/')}`
    : 'NO ground-level lit sheets found in front of either building');

// ── 6. the blades still read forwards, from both ends ───────────────────
//
// This is the bug the user reported personally and GOTCHAS §10 says has shipped
// twice. It cannot be checked from a screenshot and it cannot be checked by
// walking, so it is checked as an invariant on the construction.
//
// THE INVARIANT IS THE OPPOSITE OF WHAT MY QUEUE ITEM PRESCRIBED, and that is
// the whole reason this check is worth having. The item said: "two single-sided
// planes back to back, a hair apart, with the texture flipped horizontally on
// the rear one." The last clause is wrong. Rotating a plane to ry = +π/2 instead
// of -π/2 ALREADY reverses where its u axis points in the world: at -π/2 the u
// axis runs along +z, at +π/2 along -z, and each is the screen-right of a viewer
// standing on that side. So the same texture reads correctly from both ends, and
// flipping the rear one applies a second mirror that cancels the first. That is
// exactly the bug I shipped and then fixed by REMOVING a flip.
//
// So: back-to-back sign faces must carry the IDENTICAL texture, and anybody
// following the written instruction will fail this and be told why.
const blades = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const cands = [];
  s.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    let mod = null;
    for (let q = o; q; q = q.parent) if (q.userData && q.userData.mod) { mod = q.userData.mod; break; }
    if (mod !== 'vice') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.map || !m.map.image) return;
    if (Math.abs(Math.abs(o.rotation.y) - Math.PI / 2) > 0.02) return;   // faces along the street
    if (m.blending === 2) return;              // additive glow sheets carry no lettering
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    cands.push({ m, x: (bb.min.x + bb.max.x) / 2, h: bb.max.y - bb.min.y, ry: o.rotation.y });
  });
  const read = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, img.width, img.height).data;
  };
  const pairs = [], used = new Set();
  for (let i = 0; i < cands.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < cands.length; j++) {
      if (used.has(j)) continue;
      const a = cands[i], c = cands[j];
      if (Math.abs(a.x - c.x) > 0.6 || Math.sign(a.ry) === Math.sign(c.ry) || Math.abs(a.h - c.h) > 0.1) continue;
      used.add(i); used.add(j);
      const ia = a.m.map.image, ic = c.m.map.image;
      // A texture can be mirrored two ways and the pixel compare below only sees
      // one of them. `repeat.x = -1` with `offset.x = 1` flips the SAMPLING and
      // leaves the canvas untouched, so it would sail through a pixel-identical
      // check. Compare the sampling transform as well or this guards half the bug.
      const xf = (t) => [t.repeat.x, t.repeat.y, t.offset.x, t.offset.y, t.rotation, t.center.x, t.center.y].join(',');
      const rec = { x: +a.x.toFixed(2), h: +a.h.toFixed(2),
        sameSize: ia.width === ic.width && ia.height === ic.height,
        sameXf: xf(a.m.map) === xf(c.m.map), xf: xf(a.m.map), same: null };
      if (rec.sameSize) {
        const A = read(ia), C = read(ic);
        let same = 0, n = 0;
        for (let y = 0; y < ia.height; y++) for (let x = 0; x < ia.width; x++) {
          const q = (y * ia.width + x) * 4; n++;
          if (A[q] === C[q] && A[q + 1] === C[q + 1] && A[q + 2] === C[q + 2]) same++;
        }
        rec.same = +(same / n).toFixed(4);
      }
      pairs.push(rec);
      break;
    }
  }
  return { pairs, orphans: cands.filter((_, i) => !used.has(i)).map((q) => `${q.h.toFixed(1)}m at x${q.x.toFixed(1)}`) };
});
check('every street-facing sign is a back-to-back PAIR, none left single',
  blades.pairs.length >= 3 && blades.orphans.length === 0,
  `${blades.pairs.length} pairs; unpaired: ${blades.orphans.length ? blades.orphans.join(', ') : 'none'}`);
check('the two faces of each blade carry the SAME texture, not a mirrored one',
  blades.pairs.length > 0 && blades.pairs.every((q) => q.sameSize && q.sameXf
    && (SELFTEST ? q.same !== 1 : q.same === 1)),
  blades.pairs.map((q) => `${q.h}m@x${q.x}: ${!q.sameXf ? 'MIRRORED BY TRANSFORM ' + q.xf : q.sameSize ? (q.same * 100).toFixed(1) + '% identical' : 'DIFFERENT SIZE'}`).join('; '));

// ── 7. the chase RUNS, and some of it is broken on purpose ──────────────
//
// Two requirements from the item, neither of them checked until now:
//
//   "a marquee with chase lights round the edge that actually run — a sequence,
//    not a static dotted border"
//   "one dead bulb in the chase"
//
// The first is the one that would embarrass us. A static dotted border looks
// entirely plausible in a screenshot and in a fingerprint, and the chase is
// driven by the same per-frame tick as the spill, so it stops the same way and
// leaves no trace. Nothing here has ever asserted that a bulb changes colour.
//
// The second is a detail a refactor erases silently: regenerate the bulb loop
// without carrying the dead material across and the building just looks newer
// than the brief asked for, with nothing to show for it.
//
// Sampled at IRREGULAR intervals on purpose. Even spacing can alias against the
// chase period and report a running sequence as frozen — a sampling artefact
// dressed as a defect, which is the mistake I made with the spill check when I
// sampled from where the driver was not running.
const chase = await p.evaluate(async () => {
  const seen = new Map();                                  // material uuid -> Set of colours
  const s = window.__ct.scene();
  window.__ct.warp(45, -103, Math.PI, 0, 0);               // where the marquee renders
  window.__ct.clock(23, 0);
  for (const wait of [700, 180, 260, 330, 210, 290, 240]) {
    await new Promise((r) => setTimeout(r, wait));
    s.updateMatrixWorld(true);
    s.traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'SphereGeometry') return;
      let mod = null;
      for (let q = o; q; q = q.parent) if (q.userData && q.userData.mod) { mod = q.userData.mod; break; }
      if (mod !== 'vice') return;
      if ((o.geometry.parameters.radius ?? 1) > 0.2) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.color) return;
      if (!seen.has(m.uuid)) seen.set(m.uuid, { cols: new Set(), n: 0, counted: false });
      const rec = seen.get(m.uuid);
      rec.cols.add(m.color.getHexString());
      if (!rec.counted) rec.n++;
    });
    for (const rec of seen.values()) rec.counted = true;   // count bulbs once, not per sample
  }
  const lum = (h) => { const v = parseInt(h, 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const mats = [...seen.values()].map((r) => ({ n: r.n, cols: [...r.cols], varied: r.cols.size > 1, maxLum: Math.max(...[...r.cols].map(lum)) }));
  return { mats, bulbs: mats.reduce((a, c) => a + c.n, 0) };
});
const moving = chase.mats.filter((m) => m.varied);
const brightest = Math.max(...chase.mats.map((m) => m.maxLum));
const deadMats = chase.mats.filter((m) => !m.varied && m.maxLum < brightest * 0.6);
const deadBulbs = deadMats.reduce((a, c) => a + c.n, 0);
check('the marquee chase actually RUNS a sequence, not a static dotted border',
  moving.length >= 2 && brightest > 0.5,
  `${chase.bulbs} bulbs; ${moving.length} of ${chase.mats.length} bulb materials changed colour across 7 samples, brightest ${brightest.toFixed(2)}`);
check('…and some bulbs never light, because it is 1997 and past it',
  deadBulbs >= 1 && deadBulbs < chase.bulbs * 0.1,
  `${deadBulbs} permanently dark of ${chase.bulbs} (${(100 * deadBulbs / chase.bulbs).toFixed(1)}%) — the brief asked for "one dead bulb in the chase"`);

console.log('');
for (const [ok, n, d] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${n}\n        ${d}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);

if (SELFTEST) {
  const INVERTED = ['there is a clear band past the frontage furniture, wide enough to walk',
    'the two faces of each blade carry the SAME texture, not a mirrored one'];
  const missed = INVERTED.filter((n) => { const r = results.find((q) => q[1] === n); return !r || r[0]; });
  console.log('\nSELFTEST — two inverted truths, both must fail:');
  for (const n of INVERTED) {
    const r = results.find((q) => q[1] === n);
    console.log(`  ${!r ? 'MISSING ' : r[0] ? 'STILL OK' : 'failed  '}  ${n}`);
  }
  console.log(missed.length ? `\n${missed.length} did NOT fail — a check here cannot fail`
    : '\nboth failed as they must');
  await b.close();
  process.exit(missed.length ? 1 : 0);
}
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 4).join('\n  '));
await b.close();
process.exit(bad ? 1 : 0);
