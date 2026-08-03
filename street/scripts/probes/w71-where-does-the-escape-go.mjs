// Item 222 — WHEN THE CASINO/HOTEL "ESCAPE", WHERE DOES THE PLAYER END UP?
//
// `interiors-walk.mjs:869-876` calls it an escape when the player finishes
// outside its OWN room's declared box:
//
//     const ex = Math.abs(a[0] - cx) > hw + 0.18 + 0.05;
//     const ez = Math.abs(a[2])      > hd + 0.18 + 0.05;
//
// That is a per-room box test. It cannot tell "walked out of the world" from
// "walked next door", and item 196 gave exactly these two rooms a doorway to
// next door. So before anything in ct/vice.ts is touched, this reproduces the
// check's own runs and CLASSIFIES each endpoint:
//
//   IN-OWN     still inside its own room
//   NEXT-DOOR  inside the partner room — that is the party doorway, a feature
//   STREET     out of the front door onto the pavement
//   VOID       no floor under it and no room around it — the real bug
//
// Only VOID is BUILDER-BRIEF §11's "left the world". The others are doors.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-where-does-the-escape-go.mjs [room…]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4270/');
const ASK = process.argv.slice(2);
const RADIUS = 0.36;
const YAW = { '-x': -Math.PI / 2, '+x': Math.PI / 2, '-z': 0, '+z': Math.PI };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(700);

const rooms = await p.evaluate(() => window.__ct.roomDims());
const want = ASK.length ? rooms.filter((r) => ASK.includes(r.id)) : rooms;
const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([a, c, y, g]) => window.__ct.warp(a, c, y, g, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
const f2 = (v) => (+v).toFixed(2);

for (const r of want) {
  const hw = r.w / 2, hd = r.d / 2, cx = r.cx;
  const standables = await p.evaluate(([c, w, d, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((q) =>
      x > q.minX - R && x < q.maxX + R && z > q.minZ - R && z < q.maxZ + R);
    const out = [];
    for (let z = -d + R; z <= d - R; z += 0.45) {
      for (let x = -w + R; x <= w - R; x += 0.45) if (free(c + x, z)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return out;
  }, [cx, hw, hd, RADIUS]);
  const spread = standables.filter((_, i) => i % Math.max(1, Math.floor(standables.length / 6)) === 0).slice(0, 6);

  const tally = { 'IN-OWN': 0, 'NEXT-DOOR': 0, STREET: 0, VOID: 0 };
  const detail = [];
  for (const [lx, lz] of spread) {
    for (const key of ['-x', '+x', '-z', '+z']) {
      await warp(cx + lx, lz, YAW[key], 0);
      await p.waitForTimeout(90);
      await hold('w', 1800);
      const a = await pos();
      const out = Math.abs(a[0] - cx) > hw + 0.23 || Math.abs(a[2] - r.cz) > hd + 0.23;
      if (!out) { tally['IN-OWN']++; continue; }
      const cls = await p.evaluate(([x, z, rms, self]) => {
        const inRoom = rms.find((q) => q.id !== self
          && Math.abs(x - q.cx) <= q.w / 2 + 0.25 && Math.abs(z - q.cz) <= q.d / 2 + 0.25);
        if (inRoom) return { k: 'NEXT-DOOR', id: inRoom.id };
        const g = window.__ct.groundAt(x, z);
        // the interior belt is parked far east of the street; if we are out
        // there with no floor, that is the void.
        return { k: g === null || g === undefined ? 'VOID' : (Math.abs(x) < 100 ? 'STREET' : 'VOID'), g };
      }, [a[0], a[2], rooms, r.id]);
      tally[cls.k]++;
      if (detail.length < 8) detail.push(`    ${key} from local ${f2(lx)},${f2(lz)} -> (${f2(a[0] - cx)}, ${f2(a[2])})  ${cls.k}${cls.id ? ' ' + cls.id : ''}${cls.g !== undefined ? ' ground=' + cls.g : ''}`);
    }
  }
  const runs = spread.length * 4;
  console.log(`\n=== ${r.id}  w ${r.w} x d ${r.d}  centre (${cx}, ${r.cz})   ${runs} runs`);
  console.log(`    IN-OWN ${tally['IN-OWN']}   NEXT-DOOR ${tally['NEXT-DOOR']}   STREET ${tally.STREET}   VOID ${tally.VOID}`);
  for (const d of detail) console.log(d);
  if (tally.VOID > 0) console.log(`    >> ${tally.VOID} runs left the world — that is the real bug`);
}
await b.close();
