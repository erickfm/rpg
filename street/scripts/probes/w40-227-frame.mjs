// THE CASE w9 GUARDED, MEASURED RATHER THAN QUOTED.
//
// notes/archive/w9-interaction-reach.md defends the near tier with: "A door you
// were STANDING IN stopped being offered because something across the street
// was nearer the centre of the screen — measured, at the No. 227 frame". Any
// facing gate on the near tier has to answer that, so: what IS across the
// street from the No. 227 frame, how far, and at what angle?
//
// If the competitor is far and off-axis, a gate keyed on `looked` costs nothing
// there. If it is squarely aimed at and close, the gate re-opens w9's bug and
// the shape has to change. This decides which.
//
// ── RUNS ON THE BUNDLE NOW (item 237) ────────────────────────────────────────
// The tier table below used to be built from `await import('/src/proto/fp.ts')`
// inside the page. That resolves on `vite dev` and **404s on `vite preview`**,
// and there is no try/catch here, so against the built bundle this probe threw
// `Failed to fetch dynamically imported module` on its very first pose and
// measured NOTHING — not a fallback, an uncaught abort. Both values it wanted
// are published on `__ct` now: `touchMargin()` (item 223) and `lookTolerance()`
// (item 237). Same arithmetic, same source of truth, and it works on the world
// the user actually ships.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

// GOTCHAS 32: a missing hook means the check never ran, and that is not the same
// news as a world that is wrong. Say which, and exit 3.
const hooks = await p.evaluate(() => ({
  lookTolerance: typeof window.__ct.lookTolerance, touchMargin: typeof window.__ct.touchMargin,
}));
if (hooks.lookTolerance !== 'function' || hooks.touchMargin !== 'function') {
  console.error(`ABORT: __ct is missing a hook — ${JSON.stringify(hooks)}`);
  await b.close(); process.exit(3);
}

const target = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /227/.test(q.label));
  return s ? { x: s.x, z: s.z, r: s.r, label: s.label } : null;
});
if (!target) { console.error('no No. 227 spot'); await b.close(); process.exit(3); }
console.log(`"${target.label}" at (${target.x.toFixed(2)}, ${target.z.toFixed(2)}) r${target.r}`);

const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [target.x, target.z]);

// stand ON the spot and sweep the full circle; at each heading, what wins, and
// what is competing? The 1.15 m offset w9 names (the facade cushion pushing you
// off the wall) is sampled too — that is the pose that has a real offAxis.
for (const off of [0, 1.15]) {
  console.log(`\n=== standing ${off.toFixed(2)} m from the spot centre ===`);
  for (let i = 0; i < 8; i++) {
    const heading = (i / 8) * Math.PI * 2;
    // step away along +x (into the street) when offset, which is w9's "pushed
    // off the wall by the facade cushion"
    const px = target.x + off, pz = target.z;
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [px, pz, heading, gy]);
    await p.waitForTimeout(200);
    const won = await prompt();
    const rows = await p.evaluate(([x, z, yaw]) => {
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      const TOUCH = window.__ct.touchMargin();
      return window.__ct.spots().filter((s) => s.ok).map((s) => {
        const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz);
        const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
        return { label: s.label, d, offAxis,
          near: d < s.r + TOUCH,
          looked: d < 6 && offAxis < window.__ct.lookTolerance(s.r, d) };
      }).filter((q) => q.near || q.looked).sort((a, c) => a.d - c.d);
    }, [px, pz, heading]);
    console.log(`  yaw ${(heading * 180 / Math.PI).toFixed(0).padStart(3)}deg -> [E] ${won ?? '(none)'}`);
    for (const q of rows) {
      console.log(`      ${q.near ? 'NEAR' : '    '} ${q.looked ? 'LOOK' : '    '}  d=${q.d.toFixed(2)} off=${(q.offAxis * 180 / Math.PI).toFixed(0)}deg  ${q.label}`);
    }
  }
}
await b.close();
