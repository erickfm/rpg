// Item 232 — WHY is the jail door offered at 1.42 m with the player facing away?
// The aim-free pass is d < r + 0.15 = 1.20, so at 1.42 m it should be silent.
// Either the player is not actually facing away, or more than one spot carries
// that label, or the door is offered by something other than pickSpot.
// Measure all three rather than guess.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const all = await p.evaluate(() => window.__ct.spots()
  .map((s, i) => ({ i, label: s.label, x: s.x, z: s.z, r: s.r, ok: s.ok }))
  .filter((s) => /DETENTION/i.test(s.label ?? '')));
console.log(`spots carrying the DETENTION label: ${all.length}`);
for (const s of all) console.log(`  [${s.i}] "${s.label}" at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r ${s.r} ok=${s.ok}`);

const target = all[0];
const d = target.r + 0.15 + (0.6 - 0.15) / 2;
// stand at d, then re-aim away from the LANDED position
const px = target.x + d, pz = target.z;
await p.evaluate(([x, z]) => { window.__ct.warp(x, z, 0); }, [px, pz]);
await p.waitForTimeout(150);
await p.evaluate(([sx, sz]) => {
  const v = window.__ct.pos();
  window.__ct.warp(v[0], v[2], Math.atan2(sx - v[0], -(sz - v[2])) + Math.PI);
}, [target.x, target.z]);
await p.waitForTimeout(200);

const out = await p.evaluate(() => {
  const v = window.__ct.pos();
  const yaw = window.__ct.yaw ? window.__ct.yaw() : null;
  const prompt = (document.getElementById('ct-prompt')?.textContent ?? '').trim() || null;
  // every live spot, with its distance and off-axis angle from the player
  const fx = Math.sin(yaw ?? 0), fz = -Math.cos(yaw ?? 0);
  const spots = window.__ct.spots().filter((s) => s.ok).map((s) => {
    const dx = s.x - v[0], dz = s.z - v[2];
    const dd = Math.hypot(dx, dz);
    const off = dd < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    return { label: s.label, d: +dd.toFixed(3), r: s.r, offDeg: +(off * 180 / Math.PI).toFixed(1) };
  }).filter((s) => s.d < 7).sort((a, c) => a.d - c.d);
  return { pos: [v[0], v[2]], yaw, prompt, spots };
});
console.log(`\nplayer at (${out.pos[0].toFixed(2)}, ${out.pos[1].toFixed(2)})  yaw ${out.yaw?.toFixed?.(3) ?? out.yaw}`);
console.log(`prompt: ${out.prompt}`);
console.log(`\nlive spots within 7 m, by distance:`);
for (const s of out.spots) {
  const touch = s.d < s.r + 0.15, reach = s.d < s.r + 0.6;
  console.log(`  d ${String(s.d).padEnd(7)} r ${String(s.r).padEnd(5)} off ${String(s.offDeg).padStart(6)} deg`
    + `  touch=${touch ? 'Y' : 'n'} reach=${reach ? 'Y' : 'n'}  ${s.label}`);
}
await b.close();
