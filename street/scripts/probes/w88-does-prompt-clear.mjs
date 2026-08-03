// Item 232 — is the prompt element STALE, or is the jail door really offered?
//
// The flip probe reports the player standing 1.34 m from the jail door, facing
// 180 deg away, with `[E] into the HOUSE OF DETENTION` on screen. The aim-free
// bound is 1.20 m, so either the world offers it by some path other than
// `pickSpot`'s `touching`, or the prompt on screen is left over from a previous
// position. Distinguish them the cheap way: walk far away and see if it clears.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const frames = async (n) => { for (let i = 0; i < n; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r))); };
const read = () => p.evaluate(() => {
  const v = window.__ct.pos();
  return { x: +v[0].toFixed(2), z: +v[2].toFixed(2),
           prompt: (document.getElementById('ct-prompt')?.textContent ?? '').trim() || null };
});

const jail = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /DETENTION/i.test(q.label ?? ''));
  return { x: s.x, z: s.z, r: s.r };
});
console.log(`jail door spot at (${jail.x.toFixed(2)}, ${jail.z.toFixed(2)}) r ${jail.r}`);
console.log(`aim-free bound r+0.15 = ${(jail.r + 0.15).toFixed(2)} m\n`);

// 1. stand ON it — the prompt must appear
await p.evaluate(([x, z]) => { window.__ct.warp(x + 0.3, z, 0); }, [jail.x, jail.z]);
await frames(6);
console.log(`on the spot        : ${JSON.stringify(await read())}`);

// 2. warp 60 m away — the prompt MUST clear if the element tracks the world
await p.evaluate(() => { window.__ct.warp(20, -103, 0); });
await frames(6);
const far = await read();
console.log(`60 m up the street : ${JSON.stringify(far)}`);

// 2b. …and now NUDGE him with a real movement key. If the prompt only clears
// here, then `warp` alone never refreshes the HUD and every probe that warps
// and reads #ct-prompt has been reading the previous position's answer.
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })));
await frames(3);
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' })));
await frames(3);
console.log(`after a 'w' nudge  : ${JSON.stringify(await read())}`);

// 3. back into the band, facing away, re-aimed from the landed position
const d = jail.r + 0.30;                       // 1.35 m — inside the band
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * Math.PI * 2;
  await p.evaluate(([x, z]) => { window.__ct.warp(x, z, 0); }, [jail.x + d * Math.cos(a), jail.z + d * Math.sin(a)]);
  await frames(3);
  await p.evaluate(([sx, sz]) => {
    const v = window.__ct.pos();
    window.__ct.warp(v[0], v[2], Math.atan2(sx - v[0], -(sz - v[2])) + Math.PI);
  }, [jail.x, jail.z]);
  await frames(4);
  const now = await p.evaluate(([jx, jz]) => {
    const v = window.__ct.pos();
    const yaw = window.__ct.yaw?.();
    const dx = jx - v[0], dz = jz - v[2];
    const dd = Math.hypot(dx, dz);
    const fx = Math.sin(yaw ?? 0), fz = -Math.cos(yaw ?? 0);
    const off = Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz)) * 180 / Math.PI;
    return { d: +dd.toFixed(3), offDeg: +off.toFixed(1),
             prompt: (document.getElementById('ct-prompt')?.textContent ?? '').trim() || null };
  }, [jail.x, jail.z]);
  if (now.d > jail.r + 0.15 && now.d < jail.r + 0.6) {
    console.log(`in the band        : d ${now.d} m, ${now.offDeg} deg off axis, prompt ${JSON.stringify(now.prompt)}`);
    break;
  }
}
console.log(`\nIf the 60 m reading still showed the jail, the element is STALE and`);
console.log(`every "offered" verdict taken from it is worthless.`);
await b.close();
