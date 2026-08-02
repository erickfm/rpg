// IS THE APARTMENT IN THE ROOM REGISTRY, AND DOES seat-facing SEE ITS SEATS?
//
// Item 32's hypothesis: `seat-facing.mjs` has never checked an apartment seat.
// That check keys everything off `__ct.roomDims()` — rule A needs the room's
// w/d/cx/cz to find the wall ahead, and rule B is skipped outright when
// `roomOf()` returns null. So "is the apartment registered" and "is its seat
// checked" are the same question, and this asks it directly rather than
// inferring it from a green run.
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/apartment-in-registry.mjs
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(900);

const out = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const roomOf = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  return {
    roomIds: window.__ct.rooms(),
    dims: rooms.map((r) => ({ id: r.id, w: +r.w.toFixed(2), d: +r.d.toFixed(2),
                              cx: +r.cx.toFixed(2), cz: +r.cz.toFixed(2) })),
    seats: window.__ct.seats().map((s) => {
      const r = roomOf(s.pose.x, s.pose.z);
      return { label: s.label, x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2),
               yaw: +s.pose.yaw.toFixed(3), room: r ? r.id : 'outdoor' };
    }),
  };
});
await b.close();

console.log(`rooms(): ${out.roomIds.join(', ')}\n`);
console.log('roomDims():');
for (const r of out.dims)
  console.log(`  ${r.id.padEnd(10)} w ${r.w}  d ${r.d}  cx ${r.cx}  cz ${r.cz}`);

const byRoom = new Map();
for (const s of out.seats) byRoom.set(s.room, (byRoom.get(s.room) ?? 0) + 1);
console.log(`\n${out.seats.length} seats, by the room seat-facing.mjs puts them in:`);
for (const [k, n] of [...byRoom].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${k}`);

// the apartment's own seats, wherever the registry thinks they are
const apt = out.seats.filter((s) => s.x > 100 && s.x < 260);
console.log(`\nseats at the walk-up's address (100 < x < 260): ${apt.length}`);
for (const s of apt)
  console.log(`  (${s.x}, ${s.z}) yaw ${s.yaw}  room=${s.room}  "${s.label}"`);
process.exit(0);
