// DO THE INTERIOR KEEPERS LOOK AT THE PLAYER, OR THE BACK WALL?
//
// 15f86d64 found TWO of one agent's four keepers facing their back walls — the
// tax preparer spotted by the user, not by a check — and calls it the fourth
// handedness bug of the session. That fix covers four rooms. There are eight.
//
// Same march as seatface.mjs: take the keeper's facing and walk it until
// something static stops you. A keeper looking at brick from half a metre is
// the defect; one with metres of room in front is serving a counter.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX)).map((c) => ({ minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ }));
  const a = snap(); await new Promise(r => setTimeout(r, 1500));
  const seen = new Set(snap().map(key));
  const cols = a.filter((c) => seen.has(key(c)));
  const hit = (x,z) => cols.find(c => x>c.minX && x<c.maxX && z>c.minZ && z<c.maxZ);

  // person-shaped billboards out in the interior belt (x >= 400)
  const people = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const g = o.geometry.parameters, w = g.width ?? 0, h = g.height ?? 0;
    if (!(w > 0.3 && w < 1.2 && h > 1.2 && h < 2.2)) return;      // a standing figure
    const v = o.position.clone(); o.getWorldPosition(v);
    if (v.x < 400) return;                                         // interiors only
    const e = new (o.rotation.constructor)();
    e.setFromQuaternion(o.getWorldQuaternion(new (o.quaternion.constructor)()), 'YXZ');
    people.push({ x:+v.x.toFixed(2), z:+v.z.toFixed(2), y:+v.y.toFixed(2), yaw:+e.y.toFixed(4),
                  mod: o.userData?.mod ?? o.parent?.userData?.mod ?? '', w:+w.toFixed(2), h:+h.toFixed(2) });
  });
  // THE FIX'S OWN TEST, not my proxy for it. 15f86d64: "derive facing from what
  // it faces; test by standing where a player stands and asking whether it is
  // looking at you." A keeper stands at the back and should look INTO the room.
  // So: does its facing point toward the room centre, or away from it?
  const rooms = (typeof window.__ct.roomDims === 'function'
    ? window.__ct.roomDims() : window.__ct.roomDims) || [];
  for (const q of people) {
    const rm = rooms.find((r) => Math.abs(r.cx - q.x) <= r.w / 2 + 1.5);
    q.room = rm ? rm.id : '?';
    if (rm) {
      const fx = Math.sin(q.yaw), fz = -Math.cos(q.yaw);
      const tx = rm.cx - q.x, tz = rm.cz - q.z;
      const len = Math.hypot(tx, tz) || 1;
      q.inward = +((fx * tx + fz * tz) / len).toFixed(2);   // +1 faces centre, -1 faces away
    }
  }
  // march each one along (sin yaw, -cos yaw), skipping whatever it stands in
  for (const q of people) {
    const fx = Math.sin(q.yaw), fz = -Math.cos(q.yaw);
    const own = hit(q.x, q.z);
    const same = (c) => own && c.minX === own.minX && c.minZ === own.minZ;
    q.clear = 8;
    for (let d = 0.3; d < 8; d += 0.05) {
      const c = hit(q.x + fx*d, q.z + fz*d);
      if (c && !same(c)) { q.clear = +d.toFixed(2); break; }
    }
  }
  return people;
});
await b.close();
// keep only the person-sized billboard: 0.95x1.90 is the citizen sprite, the
// same signature that turned up as a false "surface" in the wet sweep. The
// 1.09x2.11 objects at a shared yaw of -0.85, one per room, are door leaves.
const keepers = out.filter((q) => q.w > 0.9 && q.w < 1.0 && q.h > 1.8 && q.h < 2.0);
keepers.sort((a, c) => (a.inward ?? 9) - (c.inward ?? 9));
console.log(`${out.length} standing figures in the interior belt · ${keepers.length} are person-sized (0.95x1.90)\n`);
console.log('  room        inward   clear    yaw      position');
for (const q of keepers)
  console.log(`  ${String(q.room).padEnd(10)} ${String(q.inward).padStart(6)}  ${String(q.clear).padStart(5)} m  ` +
    `${String(q.yaw).padStart(8)}  (${q.x}, ${q.z})`);
const away = keepers.filter((q) => (q.inward ?? 1) < 0);
console.log(`\nfacing AWAY from the room they are in: ${away.length} of ${keepers.length}`);
