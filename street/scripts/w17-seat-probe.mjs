// SCRATCH probe (w17): for every seat, what solid is CLOSEST, and where is it
// relative to the way the seat faces? Not a check — this measures the
// distribution so a threshold can be picked from data instead of taste.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4189/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(900);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 5000)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const a = snap();
  await new Promise((r) => setTimeout(r, 1200));
  const seen = new Set(snap().map(key));
  const cols = a.filter((c) => seen.has(key(c)));

  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const inside = (c, x, z) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
  // closest point of an AABB to (x,z), and the gap to it
  const near = (c, x, z) => {
    const nx = Math.min(Math.max(x, c.minX), c.maxX);
    const nz = Math.min(Math.max(z, c.minZ), c.maxZ);
    return { nx, nz, d: Math.hypot(nx - x, nz - z) };
  };

  return window.__ct.seats().map((s) => {
    const { x, z, yaw } = s.pose;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const r = roomOf(x, z);
    const own = cols.filter((c) => inside(c, x, z));
    const isOwn = (c) => own.some((o) => o.minX === c.minX && o.minZ === c.minZ);

    const ns = cols.filter((c) => !isOwn(c))
      .map((c) => ({ ...near(c, x, z), w: +(c.maxX - c.minX).toFixed(2), h: +(c.maxZ - c.minZ).toFixed(2) }))
      .filter((n) => n.d < 1.6)
      .sort((u, v) => u.d - v.d)
      .slice(0, 3)
      .map((n) => {
        const bx = (n.nx - x) / (n.d || 1), bz = (n.nz - z) / (n.d || 1);
        const dot = bx * fx + bz * fz;                       // 1 = dead ahead
        return { d: +n.d.toFixed(2), w: n.w, h: n.h, deg: +(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(0) };
      });
    return { label: s.label, room: r ? r.id : null, own: own.length,
             x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3), ns };
  });
});
await b.close();

console.log(`${out.length} seats\n`);
// A seat whose NEAREST solid is behind it: the 180 deg signature.
const behind = out.filter((s) => s.ns.length && s.ns[0].deg > 100).sort((a, c) => a.ns[0].d - c.ns[0].d);
console.log(`— seats whose nearest solid is more than 100 deg off the way they face (${behind.length}) —`);
for (const s of behind.slice(0, 40))
  console.log(`  ${s.ns[0].d.toFixed(2)}m at ${String(s.ns[0].deg).padStart(3)}deg  ${s.ns[0].w}x${s.ns[0].h}  ${String(s.room ?? 'outdoor').padEnd(9)} ${s.label.padEnd(28)} (${s.x},${s.z}) yaw ${s.yaw}`);

console.log(`\n— every seat with a solid inside 0.80 m, by bearing —`);
const close = out.filter((s) => s.ns.length && s.ns[0].d < 0.80).sort((a, c) => c.ns[0].deg - a.ns[0].deg);
for (const s of close.slice(0, 45))
  console.log(`  ${s.ns[0].d.toFixed(2)}m ${String(s.ns[0].deg).padStart(3)}deg ${String(s.ns[0].w + 'x' + s.ns[0].h).padEnd(12)} ${String(s.room ?? 'outdoor').padEnd(9)} ${s.label.padEnd(28)} (${s.x},${s.z})`);
console.log(`  (${close.length} seats have a solid inside 0.80 m)`);
