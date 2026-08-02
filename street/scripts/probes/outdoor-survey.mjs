// WHAT IS ACTUALLY OUT THERE? — survey for QUEUE item 28, before changing anything.
// Lists every OUTDOOR registered seat and every seated citizen sprite, with what
// each is looking at, so the rule can be chosen from the world rather than guessed.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const TARGET = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(TARGET, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, TARGET);
await p.waitForTimeout(1000);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const raw = () => window.__ct.colliders().filter((c) => c && isFinite(c.minX) && isFinite(c.minZ));
  const box = (c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ });
  const first = raw().map(box);
  await new Promise((r) => setTimeout(r, 1200));
  const still = new Set(raw().map(box).map(key));
  const cols = first.filter((c) => still.has(key(c)));

  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const inBox = (c, x, z) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;

  const march = (x, z, fx, fz) => {
    const own = cols.filter((c) => inBox(c, x, z));
    const isOwn = (c) => own.some((o) => o.minX === c.minX && o.minZ === c.minZ
      && o.maxX === c.maxX && o.maxZ === c.maxZ);
    for (let d = 0.05; d < 8; d += 0.02) {
      const c = cols.find((cc) => !isOwn(cc) && inBox(cc, x + fx * d, z + fz * d));
      if (c) return { d: +d.toFixed(2), w: +(c.maxX - c.minX).toFixed(2), h: +(c.maxZ - c.minZ).toFixed(2) };
    }
    return { d: null };
  };

  const seats = window.__ct.seats().map((s) => {
    const { x, z, yaw } = s.pose;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const r = roomOf(x, z);
    return { label: s.label, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3),
             room: r ? r.id : null,
             ahead: march(x, z, fx, fz), behind: march(x, z, -fx, -fz) };
  });

  // seated citizens, via the userData citizens.ts now publishes
  const people = [];
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const c = o.userData;
    if (typeof c.citizenFacing !== "number") return;
    
    // world position straight off the matrix — no THREE constructor needed in
    // page scope, and it is the same numbers getWorldPosition would copy out
    const e = o.matrixWorld.elements, wx = e[12], wz = e[14];
    const fx = Math.sin(c.citizenFacing), fz = -Math.cos(c.citizenFacing);        // seat convention
    const gx = Math.sin(c.citizenFacing), gz = Math.cos(c.citizenFacing);         // citizens convention
    people.push({ seated: !!c.seated, facing: +c.citizenFacing.toFixed(3),
                  x: +wx.toFixed(2), z: +wz.toFixed(2),
                  room: roomOf(wx, wz)?.id ?? null,
                  aheadSeatConv: march(wx, wz, fx, fz),
                  aheadCitConv: march(wx, wz, gx, gz) });
  });

  return { seats, people };
});
await b.close();

const { seats, people } = out;
const outdoor = seats.filter((s) => !s.room);
console.log(`${seats.length} seats · ${outdoor.length} OUTDOOR\n`);
console.log('OUTDOOR SEATS — what is ahead / behind:');
for (const s of outdoor)
  console.log(`  ${s.label.padEnd(24)} (${s.x}, ${s.z}) yaw ${s.yaw}` +
    `  ahead ${s.ahead.d ?? '-'}${s.ahead.d ? ` (${s.ahead.w}x${s.ahead.h})` : ''}` +
    `  behind ${s.behind.d ?? '-'}${s.behind.d ? ` (${s.behind.w}x${s.behind.h})` : ''}`);

console.log(`\n${people.length} citizen sprites · ${people.filter((q) => q.seated).length} SEATED`);
for (const q of people.filter((x) => x.seated).slice(0, 40))
  console.log(`  ${q.room ?? 'outdoor'} (${q.x}, ${q.z}) facing ${q.facing}` +
    `  seatConv ahead ${q.aheadSeatConv.d ?? '-'}  citConv ahead ${q.aheadCitConv.d ?? '-'}`);
