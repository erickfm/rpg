#!/usr/bin/env node
// ITEM 192, the finding the fixed check surfaced: leg 6 is now RED on the JAIL
// at a stable 1/97, and the flaky by-index version could never have said so.
// WHICH material is it? Same sampling rule as interiors-walk leg 6 — by
// material uuid, four samples at each hour so animation cannot be mistaken for
// the night sweep — but it reports the offender instead of counting it.
//
//   SHOT_URL=http://localhost:4201/ node scripts/probes/w64-jail-dimmed.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const ROOM = process.env.W64_ROOM || 'jail';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);
const room = await p.evaluate((id) => window.__ct.roomDims().find((d) => d.id === id) ?? null, ROOM);
if (!room) { console.error(`no room '${ROOM}'`); await b.close(); process.exit(3); }
const cx = room.cx;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, 0, y), [cx, room.cz, room.y]);
await p.waitForTimeout(700);

const sample = () => p.evaluate((cx) => {
  const out = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || m.transparent) continue;
      out[m.uuid] = { hex: m.color.getHex(),
        at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        geo: o.geometry.type,
        size: o.geometry.parameters ? JSON.stringify(o.geometry.parameters) : null,
        graded: !!(m.userData && m.userData.graded),
        selfLit: !!(m.userData && m.userData.selfLit),
        name: o.name || '' };
    }
  });
  return out;
}, cx);

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
const night = await steadyAt(2, 900);
const bad = Object.keys(day).filter((u) => night[u] && night[u].hex !== day[u].hex);
console.log(`\n  room '${ROOM}' at cx ${cx}:  ${Object.keys(day).length} steady materials at noon,`
  + ` ${bad.length} dimmed by the night sweep\n`);
for (const u of bad) {
  const d = day[u], n = night[u];
  console.log(`  #${d.hex.toString(16).padStart(6, '0')} -> #${n.hex.toString(16).padStart(6, '0')}`
    + `   at (${d.at.join(', ')})  ${d.geo}`);
  console.log(`      userData.graded=${d.graded}  selfLit=${d.selfLit}  name="${d.name}"`);
  console.log(`      geometry: ${d.size}`);
}
await b.close();
process.exit(0);
