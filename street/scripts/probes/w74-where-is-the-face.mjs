// How far is the face you look at from the seat you sit on, for both machines?
// This is the number a `ctx.spot` on them has to clear (`d < r + REACH_MARGIN`
// while seated, fp.ts:990), and it is READ OFF THE WORLD rather than typed —
// BUILDER-BRIEF §8.
//
//   SHOT_URL=http://localhost:4301/ node scripts/probes/w74-where-is-the-face.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4301/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForTimeout(500);

const cases = [
  ['sit at the computer', '__librarypc', 'screenMesh'],
  ['sit at the slot', '__slots', 'screen'],
];

for (const [LABEL, station, getter] of cases) {
  console.log(`\n═══ ${LABEL} ═══`);
  const idxs = await p.evaluate((l) => window.__ct.seats()
    .map((s, i) => [s.label, i]).filter(([lab]) => lab === l).map(([, i]) => i), LABEL);
  console.log(`${idxs.length} seats`);
  const sample = idxs.slice(0, 6);
  for (const i of sample) {
    const seat = (await p.evaluate(() => window.__ct.seats()))[i];
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
    await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
    await p.waitForTimeout(500);
    await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
    await p.waitForTimeout(450);
    const r = await p.evaluate(([st, g, sx, sz]) => {
      const m = window[st]?.[g]?.();
      if (!m) return { face: null, panel: window.__hud?.panel?.() ?? null };
      m.updateWorldMatrix(true, false);
      const e = m.matrixWorld.elements;
      return {
        panel: window.__hud?.panel?.() ?? null,
        x: +e[12].toFixed(3), y: +e[13].toFixed(3), z: +e[14].toFixed(3),
        d: +Math.hypot(e[12] - sx, e[14] - sz).toFixed(3),
        name: m.name || m.geometry?.type,
      };
    }, [station, getter, seat.pose.x, seat.pose.z]);
    console.log(`  seat ${String(i).padStart(3)} (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)}) yaw ${seat.pose.yaw.toFixed(3)} -> ${JSON.stringify(r)}`);
    await p.evaluate(() => { window.__hud?.closePanels?.(); window.__ct.stand(); });
    await p.waitForTimeout(300);
  }
}
await b.close();
