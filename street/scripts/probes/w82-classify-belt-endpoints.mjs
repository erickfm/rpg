// Item 226, measurement 2 of 2. Reproduce `interiors-walk.mjs` leg 3 for every
// belt room and CLASSIFY each endpoint instead of counting it against a box.
//
// This exists so the replacement predicate is designed against classes that
// actually occur, not classes I imagined. That is item 215's lesson exactly: its
// inherited predicate, generalised as written, reported 21 escapes at the car
// lot, the first several of which were the player standing on real pavement. A
// check that goes red on a world that is fine is the more expensive failure —
// a red nobody believes gets loosened, and then it never fires again.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { installRayFloorQuery, selfTestRayQuery } from '../lib/floors.mjs';

const RADIUS = 0.36;
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 };
const f2 = (n) => +n.toFixed(2);

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) =>
  window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (k, ms) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms);
  await p.keyboard.up(k); await p.waitForTimeout(120);
};

const DIMS = await p.evaluate(() => window.__ct.roomDims());
const PARTY = await p.evaluate(async () => (await import('/src/proto/ct/interior.ts')).PARTY);
console.log('PARTY (read from ct/interior.ts, not copied):', JSON.stringify(PARTY));

// ── RAYCAST, NOT THE AABB BOX. CONVERTED 2026-08-03, ITEM 250 ─────────────
// This probe CLASSIFIES endpoints, so an over-claiming predicate mislabels a
// VOID as FLOORED and the classification it exists to produce is wrong in the
// false-green direction. Item 238: the two predicates agree 97.37% over all
// 731,322 cells, and the 11,948 AABB over-claims are 88.4% on open walkable
// ground. Measured on this world, the AABB pass kept **357 of 7,866 meshes**;
// the ray indexes all of them.
// ⚠⚠ THE QUERY IS ASYNC — GOTCHAS 90. `if (hasFloor(...))` on a Promise is
// always TRUE, which here would report every endpoint FLOORED and zero VOID.
const RAY = await installRayFloorQuery(p);
const hasFloor = RAY.query;                       // (x, z, gy) => Promise<boolean>
const bad = await selfTestRayQuery(p, hasFloor, RAY.tris);
if (bad.length) { console.log('FLOOR PREDICATE FAILED ITS CONTROLS:\n  ' + bad.join('\n  ')); await b.close(); process.exit(3); }
console.log(`floor predicate ok (RAYCAST): ${RAY.tris} triangles from ${RAY.meshes} meshes, road solid, off-world void\n`);

const T = 0.18 + 0.05;
const inRoom = (r, x, z) => Math.abs(x - r.cx) <= r.w / 2 + T && Math.abs(z - r.cz) <= r.d / 2 + T;
const joined = (a, c) => PARTY.some((w) =>
  (w.west === a && w.east === c) || (w.east === a && w.west === c));

const belt = DIMS.filter((d) => d.belt);
const tally = {};
for (const built of belt) {
  const { cx, cz } = built, hw = built.w / 2, hd = built.d / 2;
  const standables = await p.evaluate(([cx, cz, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    const out = [];
    for (let z = -hd + R; z <= hd - R; z += 0.45) {
      for (let x = -hw + R; x <= hw - R; x += 0.45) if (free(cx + x, cz + z)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return out;
  }, [cx, cz, hw, hd, RADIUS]);
  const spread = standables.filter((_, i) => i % Math.max(1, Math.floor(standables.length / 6)) === 0).slice(0, 6);

  const cls = { OWN: 0, PARTY: 0, OTHER: 0, FLOORED: 0, VOID: 0 };
  const notes = [];
  for (const [lx, lz] of spread) {
    for (const key of ['-x', '+x', '-z', '+z']) {
      await warp(cx + lx, cz + lz, YAW[key], built.y);
      await p.waitForTimeout(90);
      await hold('w', 1800);
      const a = await pos();
      if (inRoom(built, a[0], a[2])) { cls.OWN++; continue; }
      const other = DIMS.find((d) => d.id !== built.id && inRoom(d, a[0], a[2]));
      if (other) {
        const k = joined(built.id, other.id) ? 'PARTY' : 'OTHER';
        cls[k]++;
        notes.push(`${k}  ${key} from ${f2(lx)},${f2(lz)} -> ${other.id} at ${f2(a[0])},${f2(a[2])}`);
        continue;
      }
      if (await hasFloor(a[0], a[2], a[3])) {        // AWAIT — GOTCHAS 90
        cls.FLOORED++;
        notes.push(`FLOORED ${key} from ${f2(lx)},${f2(lz)} -> ${f2(a[0])},${f2(a[2])} gy=${f2(a[3])}`);
      } else {
        cls.VOID++;
        notes.push(`VOID    ${key} from ${f2(lx)},${f2(lz)} -> ${f2(a[0])},${f2(a[2])} gy=${f2(a[3])}`);
      }
    }
  }
  tally[built.id] = cls;
  console.log(`${built.id.padEnd(10)} ${spread.length * 4} runs  ` +
    `OWN ${cls.OWN}  PARTY ${cls.PARTY}  OTHER ${cls.OTHER}  FLOORED ${cls.FLOORED}  VOID ${cls.VOID}`);
  for (const n of notes) console.log('           ' + n);
}

const sum = (k) => Object.values(tally).reduce((a, c) => a + c[k], 0);
console.log(`\nTOTAL over ${belt.length} belt rooms: OWN ${sum('OWN')}  PARTY ${sum('PARTY')}  ` +
  `OTHER ${sum('OTHER')}  FLOORED ${sum('FLOORED')}  VOID ${sum('VOID')}`);
await b.close();
