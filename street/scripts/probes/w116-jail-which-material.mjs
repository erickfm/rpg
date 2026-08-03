// Item 287 — IS THE JAIL LIGHT LEG THE SAME THING AS ITEM 240?
//
// `interiors-walk.mjs` reports `jail: 1/97 interior materials dimmed by the
// night sweep` but prints no coordinate, so "is this item 240?" cannot be
// answered from its output. This runs the same day/dark comparison the leg runs
// and prints WHERE the dimming material is, so the two can be matched rather
// than assumed.
//
// ⚠ ITEM 240 IS SETTLED AND THE COORDINATE IT NAMED WAS WRONG. This header used
// to read "Item 240 names (1006.37, 2.42, -5.60)". **Nothing is at -5.60** — the
// material is at **-9.40**, one slot window along the same cell wall, and it
// grades to `#6c6f76`, the night floor worker seventyone installed. Retired
// under item 295; the whole story is GOTCHAS 92.
//
// It deliberately reuses the leg's own sampling shape — steady over four
// samples at each hour, non-transparent materials with a `color`, bounded to the
// room — so a mismatch means the rooms differ, not that the method does.
//
// ⚠ THIS IS A JS `material.color` READ AND THAT IS EXACTLY ITEM 240's WARNING:
// lamplight moved into POOL_FRAG, and a fragment shader is invisible from JS.
// This probe can therefore say WHICH material the LEG is reacting to. It cannot
// say whether the room looks dim to a player — 240 requires pixels for that.
//
// Usage: SHOT_URL=http://localhost:4720/ node scripts/probes/w116-jail-which-material.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => {
  const q = window.__ct?.painted?.();
  return !!q && q.frames > 0 && q.triangles > 0;
}, { timeout: 30000 });

const jail = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'jail'));
console.log('jail roomDims:', JSON.stringify(jail));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [jail.cx, jail.cz ?? 0]);
await p.waitForTimeout(900);

const sample = () => p.evaluate(([cx, cz, bx, bz]) => {
  const out = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > bx || Math.abs(wp.z - cz) > bz) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || m.transparent) continue;
      out[m.uuid] = { hex: m.color.getHex(), at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)], name: o.name || '(unnamed)' };
    }
  });
  return out;
}, [jail.cx, jail.cz ?? 0, jail.w / 2 + 1, jail.d / 2 + 1]);

const steadyAt = async (h, settle) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(settle);
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await sample()); if (i < 3) await p.waitForTimeout(500); }
  const steady = {};
  for (const u of Object.keys(shots[0])) {
    if (shots.every((s) => s[u] && s[u].hex === shots[0][u].hex)) steady[u] = shots[0][u];
  }
  return steady;
};

const day = await steadyAt(12, 500);
const dark = await steadyAt(2, 900);
const judged = Object.keys(day).filter((u) => dark[u] !== undefined);
const dimmed = judged.filter((u) => dark[u].hex !== day[u].hex);

console.log(`judged ${judged.length} materials, ${dimmed.length} dimmed`);
for (const u of dimmed) {
  console.log(`  DIMMED  ${day[u].name}  at (${day[u].at.join(', ')})`);
  console.log(`          day #${day[u].hex.toString(16).padStart(6, '0')} -> dark #${dark[u].hex.toString(16).padStart(6, '0')}`);
}
// THE LIVE COORDINATE IS -9.40, AND -5.60 IS RETIRED (item 295, GOTCHAS 92).
// This constant was `[1006.37, 2.42, -5.60]` — the figure workers sixtyfour and
// eightytwo both quoted for the dimming material — and **there is nothing
// there**, so this comparison could only ever print "NOT the coordinate item 240
// names" and reopen the argument a fourth time. x and y were right to the
// centimetre; only z was out, by one slot window down the cell wall.
const T = [1006.37, 2.42, -9.40];
const near = dimmed.filter((u) => day[u].at.every((v, i) => Math.abs(v - T[i]) < 0.5));
console.log(`\nthe settled coordinate is (${T.join(', ')}) — ${near.length} of ${dimmed.length} dimmed material(s) match it within 0.5 m`);
console.log(near.length ? 'SAME SUBJECT AS ITEM 240' : 'NOT the settled coordinate');
// AND THE VERDICT THIS PROBE DELIBERATELY CANNOT GIVE IS NOW IN: item 240 was
// settled IN PIXELS by `scripts/probes/w118-item240-jail-pixels.mjs` — jail
// 108.69 at 13:00 and 108.69 at 02:00 against a street control going
// 86.21 -> 34.02. **The jail does not dim and that is correct**
// (`ct/props.ts:978` returns early past x 100; the jail is at x 1000). This
// probe still answers only WHICH material carries the value, never whether the
// room looks dark. GOTCHAS 92.
await b.close();
