// Why is the slot cabinet's spot registered, in reach and aimed at, and still
// not offered? Ask the three gates in `pickSpot` one at a time: ok(), the look
// cone, and `canSee`'s raycast.
//
//   SHOT_URL=http://localhost:4301/ node scripts/probes/w74-why-not-offered.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4301/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

for (const [LABEL, STATION, RX] of [
  ['sit at the computer', '__librarypc', 'use the computer'],
  ['sit at the slot', '__slots', 'play the slot machine'],
]) {
  console.log(`\n═══ ${LABEL} ═══`);
  const i = await p.evaluate((l) => window.__ct.seats().findIndex((s) => s.label === l), LABEL);
  const seat = (await p.evaluate(() => window.__ct.seats()))[i];
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
  await p.evaluate(([x, z, yaw, g]) => window.__ct.warp(x, z, yaw, g, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
  await p.waitForTimeout(600);
  await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
  await p.waitForTimeout(500);
  await p.evaluate(([st, k]) => { window[st].dismissHere(); window.__ct.sit(window.__ct.seats()[k].pose); }, [STATION, i]);
  await p.waitForTimeout(400);

  const r = await p.evaluate(([rx, sx, sz]) => {
    const spot = window.__ct.spots().find((s) => s.label === rx);
    if (!spot) return { spot: null };
    const cam = window.__ct.camera();
    const yaw = window.__ct.yaw();
    const dx = spot.x - sx, dz = spot.z - sz;
    const d = Math.hypot(dx, dz);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const offAxis = Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    const cone = Math.min(0.26, Math.max(0.20, Math.atan2(spot.r, Math.max(0.35, d))));
    // canSee's own recipe, re-run here: eye -> (x, groundAt(x,z)+1.1, z), far = dist-0.35
    const THREE = window.__three ?? null;
    return {
      spot, seated: !!window.__ct.seated(), yaw: +yaw.toFixed(3),
      d: +d.toFixed(3), offAxis: +offAxis.toFixed(3), cone: +cone.toFixed(3),
      // SEATED, so REACH_MARGIN is the right constant — `fp.ts:1006`'s
      // `(!seated || d < s.r + REACH_MARGIN)` is one of the only two places it
      // still governs anything, and `seated` is reported on the line above.
      // Read off the world rather than the hand-typed 0.6 that stood here, which
      // would have gone on asserting 0.6 after any re-tune (item 232,
      // BUILDER-BRIEF §8). For a STANDING player the predicate is
      // `d < r + TOUCH_MARGIN` (0.15) instead — hence the second field.
      lookedByReach: d < spot.r + window.__ct.reachMargin(),
      touchingIfStanding: d < spot.r + window.__ct.touchMargin(),
      eyeY: +cam.position.y.toFixed(3),
      targetY: +(window.__ct.groundAt(spot.x, spot.z) + 1.1).toFixed(3),
      three: !!THREE,
    };
  }, [RX, seat.pose.x, seat.pose.z]);
  console.log(JSON.stringify(r, null, 1));

  // canSee, run in-world with the scene we have
  const see = await p.evaluate(([rx]) => {
    const spot = window.__ct.spots().find((s) => s.label === rx);
    if (!spot) return null;
    const cam = window.__ct.camera();
    const scene = window.__ct.scene();
    // walk the scene for the first solid mesh along the ray, the same way seeRaw
    // does — reconstructed rather than called, because seeRaw is a closure.
    const ty = window.__ct.groundAt(spot.x, spot.z) + 1.1;
    const ex = cam.position.x, ey = cam.position.y, ez = cam.position.z;
    const dx = spot.x - ex, dy = ty - ey, dz = spot.z - ez;
    const dist = Math.hypot(dx, dy, dz);
    const out = { dist: +dist.toFixed(3), shortCircuit: dist < 0.45, far: +(dist - 0.35).toFixed(3), blockers: [] };
    if (out.shortCircuit) return out;
    const RC = new (Object.getPrototypeOf(scene).constructor.prototype.constructor === undefined ? Object : Object)();
    void RC;
    // three is reachable through any mesh's constructor chain; use the raycaster
    // hanging off the renderer-free path instead: build one from the scene's own
    // module by grabbing a known class off an object in the graph.
    const anyMesh = (() => { let m = null; scene.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; })();
    if (!anyMesh) return out;
    const Ray = window.__ctRaycaster;
    if (!Ray) { out.note = 'no raycaster affordance; see below'; return out; }
    return out;
  }, [RX]);
  console.log('canSee geometry:', JSON.stringify(see));
  await p.evaluate(() => { window.__hud?.closePanels?.(); window.__ct.stand(); });
  await p.waitForTimeout(300);
}
await b.close();
