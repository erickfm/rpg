// ITEM 183 — IS COLLIDER #204 ACTUALLY LOAD-BEARING?
//
// The row: *"Collider #204 blocks 302's doorway on all four floors… now that
// 109 has cut real openings for 102, 202 and 402, that collider is the ONLY
// thing stopping the player walking into those flats."*
//
// **Measure before you demolish.** Reading `ct/apartment.ts` the claim does not
// obviously hold: the east wall's own collider is pushed as
//
//     { minX: AX(2.40), maxX: AX(2.55), minZ: AZI(0), maxZ: AZI(13.2) }
//
// — **unsplit across the whole run**, where the WEST wall is deliberately split
// into two pieces around its doorway so 301 has a hole to walk through. If the
// east wall is solid across the doorway then #204, which sits at
// `AX(2.25)…AX(2.40)`, is 0.15 m of plug on the SHAFT side of a wall that was
// never open, and removing it opens nothing at all.
//
// That is a difference the row's author could not see from a collider list, and
// it decides the whole item: "justify it in place" and "replace it" are
// different jobs from "it is redundant".
//
// So: WALK INTO THE DOORWAY on every floor, twice — once with #204 present and
// once with it removed at runtime — and report how far east the player gets.
// CLAUDE.md: collision is verified by walking, never from a list.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-flatdoor-plug.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4191/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.warp && window.__ct.colliders, null, { timeout: 60000 });

// The building, from what it publishes — never from coordinates I typed.
const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn) { console.log('ABORT no scene.userData.spawn — cannot locate the walk-up (GOTCHAS §32)'); await b.close(); process.exit(3); }
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7, ST = spawn.gy / 2;
console.log(`walk-up (${APT_X.toFixed(2)}, ${APT_Z.toFixed(2)}), storey ${ST.toFixed(2)} m`);

// Find the two colliders by their published geometry, so the probe keeps
// working if the list is reordered — an index into `colliders()` is exactly the
// kind of citation that goes stale (the row calls it "#204").
const found = await p.evaluate(([ax, az]) => {
  const near = (a, b) => Math.abs(a - b) < 0.02;
  const cs = window.__ct.colliders();
  let plug = -1, eastWall = -1;
  cs.forEach((c, i) => {
    if (near(c.minX, ax + 2.25) && near(c.maxX, ax + 2.40)) plug = i;
    if (near(c.minX, ax + 2.40) && near(c.maxX, ax + 2.55)) eastWall = i;
  });
  return { plug, eastWall, n: cs.length,
    plugBox: plug >= 0 ? cs[plug] : null, wallBox: eastWall >= 0 ? cs[eastWall] : null };
}, [APT_X, APT_Z]);
console.log(`${found.n} colliders; the plug is #${found.plug}, the east wall is #${found.eastWall}`);
if (found.plug < 0) { console.log('ABORT the plug is not in the world — nothing to judge'); await b.close(); process.exit(3); }
console.log(`   plug      z ${found.plugBox.minZ.toFixed(2)} .. ${found.plugBox.maxZ.toFixed(2)}`);
console.log(`   east wall z ${found.wallBox.minZ.toFixed(2)} .. ${found.wallBox.maxZ.toFixed(2)}`
  + (found.wallBox.minZ < found.plugBox.minZ && found.wallBox.maxZ > found.plugBox.maxZ
    ? '   <-- UNSPLIT: it already spans the doorway' : '   <-- split around the doorway'));

/**
 * Stand west of the doorway on floor `f`, FACE east, and walk forward.
 *
 * ⚠ `w`, NOT `d`. The first cut held `d` — strafe — and every one of the eight
 * runs came back at exactly the x it was warped to, 1.600, with and without the
 * plug. Two identical columns look like a clean answer ("the plug does
 * nothing") and were in fact the probe not moving the player at all. `yaw`
 * π/2 already faces +x (`fp.ts`'s look vector is `sin y, ·, −cos y`), so
 * forward IS east and the strafe was pushing him along −z, which this was not
 * even recording. z is recorded now, so a repeat of that mistake shows up.
 */
const pushEast = async (f, ms = 1600) => {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, Math.PI / 2, gy, 0),
    [APT_X + 1.6, APT_Z + 3.5, f * ST]);
  await p.waitForTimeout(400);
  const gy0 = (await p.evaluate(() => window.__ct.pos()))[3];
  const q = await p.evaluate(async (ms) => {
    const ev = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k }));
    ev('keydown', 'w');
    await new Promise((r) => setTimeout(r, ms));
    ev('keyup', 'w');
    await new Promise((r) => setTimeout(r, 200));
    const P = window.__ct.pos();
    return [P[0], P[2]];
  }, ms);
  return { x: q[0], z: q[1], gy: gy0 };
};

const run = async (label) => {
  console.log(`\n${label}`);
  for (let f = 0; f < 4; f++) {
    const r = await pushEast(f);
    const lx = r.x - APT_X, lz = r.z - APT_Z;
    // The wall's inner face is AX(2.40). Getting past it means being inside a
    // flat that does not exist.
    if (Math.abs(lx - 1.6) < 0.02) {
      console.log(`   floor ${f}: DID NOT MOVE (local x still ${lx.toFixed(3)}, z ${lz.toFixed(2)})`
        + ' — this measured NOTHING, not "the wall held"');
      continue;
    }
    console.log(`   floor ${f} (storey ${r.gy.toFixed(2)} m): walked east to local x ${lx.toFixed(3)}`
      + ` (z ${lz.toFixed(2)})`
      + (lx > 2.40 ? '   <-- THROUGH THE WALL, into an unmodelled flat' : '   stopped'));
  }
};

await run('WITH the plug, as shipped:');

// Remove it at runtime — nothing on disk, no source change. The array `__ct`
// publishes IS `fp.ts`'s own list (crosstown.ts:1514 returns it by reference),
// so parking the box far away is the same mutation `setCap` performs every
// frame on the caps that already exist.
const moved = await p.evaluate((i) => {
  const c = window.__ct.colliders()[i];
  c.minX = 9999; c.maxX = 9999; c.minZ = 9999; c.maxZ = 9999;
  return window.__ct.colliders()[i].minX;
}, found.plug);
if (moved !== 9999) { console.log('ABORT could not park the plug — the mutation did not fire, so'
  + ' the run below would be a copy of the one above (a vacuous check)'); await b.close(); process.exit(3); }
await run('WITHOUT the plug (parked at 9999) — THIS is the question the row asks:');

if (errs.length) console.log(`\nPAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
else console.log('\nno page errors');
await b.close();
