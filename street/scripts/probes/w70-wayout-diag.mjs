#!/usr/bin/env node
// ITEM 196 — why does the way-out [E] not fire inside the hotel? Print what the
// world thinks is selectable from the spot the room itself publishes, in the
// moved rooms AND in a room that did not move, so the two can be compared.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL'); process.exit(3); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
const dims = await p.evaluate(() => window.__ct.roomDims());
for (const id of ['hotel', 'casino', 'church']) {
  const r = dims.find((d) => d.id === id);
  const D = r.door;
  const px = r.cx + D.x + D.nx * 0.9, pz = r.cz + D.z + D.nz * 0.9;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [px, pz, Math.atan2(-D.nx, D.nz)]);
  await p.waitForTimeout(500);
  const info = await p.evaluate(([x, z]) => ({
    dom: (() => { const d = document.getElementById('ct-prompt'); return d ? { txt: d.textContent, disp: d.style.display } : null; })(),
    near: window.__ct.spots().filter((s) => Math.hypot(s.x - x, s.z - z) < 4)
      .map((s) => ({ label: s.label, ok: s.ok, r: s.r, d: +Math.hypot(s.x - x, s.z - z).toFixed(2) })),
    pos: window.__ct.pos(),
  }), [px, pz]);
  console.log(`\n  ${id}: standing ${px.toFixed(2)},${pz.toFixed(2)}  actual ${info.pos.slice(0, 3).map((n) => +n.toFixed(2))}`);
  console.log(`    prompt DOM: ${JSON.stringify(info.dom)}`);
  for (const s of info.near) console.log(`    ${s.ok ? 'ok ' : '-- '} d=${s.d} r=${s.r}  ${s.label}`);
}
await b.close();
