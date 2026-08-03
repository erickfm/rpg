// ITEM 268 — DOES THE HOTEL SIT THE SAME WAY ROUND INSIDE AS OUT?
//
// The user: *"the hotel is the right of the casino outside but to the left
// inside. again these interior exterior mismatch."*
//
// This is the VERDICT instrument for that item. It answers one question — is
// the pair handed the same way on both sides of the door — and it must be able
// to answer NO, so it is run against the world both before and after the fix
// and both answers are recorded.
//
// ── HOW IT MEASURES, AND WHY IT DOES NOT ASSUME ──────────────────────────────
//
// LEFT/RIGHT comes from the rig's own convention and nothing else:
// `crosstown.ts` has fwd = (sin yaw, 0, −cos yaw), so with up = +y,
// left = up × fwd = (−cos yaw, 0, −sin yaw). ONE function computes the hand,
// and the outside reading and the inside reading both call it, so the two
// cannot be computed differently — which is the whole failure mode here.
//
// ⚠ THE INSIDE FACING IS **WALKED**, NEVER DERIVED FROM A DOOR NORMAL.
// Worker onehundredfive computed it from the room's published
// `door: {nx, nz}`, took nz = −1 as outward, and got the OPPOSITE answer —
// which made the item look like a no-op. Pressing [E] on the real door stand
// point lands you facing −z. So this probe holds `e` down (BUILDER-BRIEF §5 —
// a tapped key can begin and end inside one frame and never be observed) and
// reads the yaw the player actually ends up with.
//
// ⚠ AND IT DOES NOT MEASURE FROM SPAWN. GOTCHAS 79b: the player spawns in
// apartment 301 at x = 198, past the region cull, so from spawn a probe sees no
// exterior at all. Every reading here warps first.
//
// SELF-TEST: `--selftest` feeds the pure derivation two synthetic worlds that
// differ ONLY in which building is at the greater x, and requires the verdict
// to come back MATCH for one and MISMATCH for the other. A check that cannot
// report both signs has not been shown to measure anything (GOTCHAS 79).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const SHOTS = process.argv.includes('--shots');
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=run').slice(6);

// ── the one hand function ───────────────────────────────────────────────────
//
// The user's sentence is RELATIVE — *"the hotel is [to] the right of the
// casino"* — so the quantity measured is the hand of the casino→hotel vector,
// not the hand of each building from wherever the viewer happens to be. That
// matters: walking into the casino lands you exactly on the casino's own
// centreline, so "which hand is the casino on" is *dead ahead* and a verdict
// built on it is degenerate through no fault of the world. The direction
// between them has an answer from any vantage.
/** which hand does world direction `d = [dx, dz]` lie on, facing `yaw`? +1 left, −1 right */
export const handOf = (yaw, d) => {
  const lx = -Math.cos(yaw), lz = -Math.sin(yaw);      // left = up × fwd, crosstown.ts
  const s = d[0] * lx + d[1] * lz;
  return Math.abs(s) < 1e-6 ? 0 : Math.sign(s);
};
const side = (s) => (s > 0 ? 'LEFT' : s < 0 ? 'RIGHT' : 'in line, no hand');

/**
 * THE VERDICT, as a pure function of the two measured facings and the two
 * measured casino→hotel directions.
 *
 * MATCH means the hotel lies on the same hand of the casino in both readings,
 * which is exactly and only what the user asked for.
 */
export function verdict(outside, inside) {
  const dOut = [outside.hotel[0] - outside.casino[0], outside.hotel[1] - outside.casino[1]];
  const dIn = [inside.hotel[0] - inside.casino[0], inside.hotel[1] - inside.casino[1]];
  const hOut = handOf(outside.yaw, dOut);
  const hIn = handOf(inside.yaw, dIn);
  return {
    hOut, hIn,
    // "in line" on either side is not a pass and not a fail — it is a reading
    // that carries no handedness at all, and saying so beats reporting green
    degenerate: hOut === 0 || hIn === 0,
    match: hOut === hIn,
  };
}

// ── SELF-TEST: it must be able to say MISMATCH and it must be able to say MATCH ─
if (process.argv.includes('--selftest')) {
  // The real geometry: the side street runs along x at z = −96, you stand south
  // of it at z = −97.9 facing +z; inside you arrive facing −z.
  const out = { yaw: Math.PI, hotel: [39.51, -96], casino: [51.29, -96] };
  const inWorld = (hx, cx) => ({ yaw: 0, hotel: [hx, 0], casino: [cx, 0] });

  //  A. hotel at the LOWER x in the belt — the world as it stands today
  const A = verdict(out, inWorld(874.32, 885.68));
  //  B. hotel at the HIGHER x in the belt — the world the fix should build
  const B = verdict(out, inWorld(885.68, 874.32));

  let bad = 0;
  const need = (ok, what) => { if (!ok) { console.log(`  SELFTEST FAIL: ${what}`); bad++; }
                               else console.log(`  ok: ${what}`); };
  need(!A.degenerate && !B.degenerate, 'neither synthetic world is degenerate');
  need(A.match === false, 'hotel at LOWER belt x  ->  MISMATCH  (the negative case)');
  need(B.match === true, 'hotel at HIGHER belt x ->  MATCH     (the positive case)');
  need(A.hOut === -1, 'outside, the hotel is on the casino\'s RIGHT (x 39.51 < 51.29, facing +z)');
  need(A.hIn === 1, 'today, inside, the hotel is on the casino\'s LEFT');
  need(B.hIn === -1, 'after the fix, inside, the hotel is on the casino\'s RIGHT');
  // the derivation must not be a constant: swapping the OUTSIDE order flips it too
  const C = verdict({ ...out, hotel: [51.29, -96], casino: [39.51, -96] }, inWorld(874.32, 885.68));
  need(C.match === true, 'swapping the two frontages outside flips the verdict as well');
  // and a world where the two rooms sit one behind the other has NO handedness
  const D = verdict(out, { yaw: 0, hotel: [880, 5], casino: [880, -5] });
  // `match` is meaningless once `degenerate` is set — the runner exits 3 on it
  // rather than reading `match` at all, so the only thing to require is the flag
  need(D.degenerate === true && D.hIn === 0, 'rooms in line -> DEGENERATE (exit 3), never a silent pass');
  console.log(bad ? `\nSELFTEST: ${bad} FAILED\n` : '\nSELFTEST: 8/8 ok — it can say MATCH, MISMATCH and DEGENERATE\n');
  process.exit(bad ? 1 : 0);
}

mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const painted = async (min = 0) => p.waitForFunction(
  (m) => (window.__ct.painted?.()?.triangles ?? 0) > m, min, { timeout: 20000 });
await painted(0);
await p.evaluate(() => window.__ct.clock(13, 0));

const doors = await p.evaluate(() => window.__ct.doors());
const hd = doors.find((d) => /hotel/i.test(d.building));
const cd = doors.find((d) => /sevens/i.test(d.building));
if (!hd || !cd) { console.error('could not find both doors in __ct.doors()'); process.exit(3); }
console.log(`\nHOTEL ORPHEUS door  world (${hd.point.x.toFixed(2)}, ${hd.point.z.toFixed(2)})`
  + `  outward normal (${hd.point.nx}, ${hd.point.nz})`);
console.log(`SEVENS        door  world (${cd.point.x.toFixed(2)}, ${cd.point.z.toFixed(2)})`
  + `  outward normal (${cd.point.nx}, ${cd.point.nz})`);

// ── OUTSIDE ─────────────────────────────────────────────────────────────────
// Face the way the doors face you: along the INWARD normal. Yaw is solved from
// the rig convention (fwd = (sin y, 0, −cos y)), never typed.
const inward = [-hd.point.nx, -hd.point.nz];
const yawOut = Math.atan2(inward[0], -inward[1]);
const midX = (hd.point.x + cd.point.x) / 2;
const standZ = hd.stand.z - 1.15;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), [midX, standZ, yawOut]);
await painted(3000);
await p.waitForTimeout(400);
if (SHOTS) await p.screenshot({ path: `shots/w108-${TAG}-outside.png` });
const outside = { yaw: yawOut,
                  hotel: [hd.point.x, hd.point.z], casino: [cd.point.x, cd.point.z] };

// ── INSIDE — BY WALKING, WITH A HELD KEY ────────────────────────────────────
// Stand on the casino's own published door stand point and press [E]. Held for
// 90 ms: BUILDER-BRIEF §5, a tap can start and finish inside one frame and the
// dispatch is an edge read once per rendered frame.
const yawIn0 = Math.atan2(-cd.point.nx, cd.point.nz);       // face INTO the building
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), [cd.stand.x, cd.stand.z, yawIn0]);
await painted(3000);
await p.waitForTimeout(250);
// `__ct.pos()` is [x, y, z, gy] and the heading is `__ct.yaw()` — read them
// together in one evaluate so they cannot come from different frames.
const where = () => p.evaluate(() => {
  const [x, y, z] = window.__ct.pos();
  return { x, y, z, yaw: window.__ct.yaw() };
});
const before = await where();
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(600);
const after = await where();
// EVERY FIELD MUST BE A NUMBER BEFORE IT IS COMPARED. `Math.hypot(NaN) < 100`
// is FALSE, so an undefined reading sails through a distance test and the
// probe reports on a world it never measured — the first run of this file did
// exactly that. (GOTCHAS 90's family: a comparison that cannot fail.)
const num = (o, ks) => ks.every((k) => Number.isFinite(o[k]));
if (!num(before, ['x', 'z', 'yaw']) || !num(after, ['x', 'z', 'yaw'])) {
  console.error(`\nNON-NUMERIC POSE: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await b.close(); process.exit(3);
}
if (Math.hypot(after.x - before.x, after.z - before.z) < 100) {
  console.error(`\n[E] DID NOT TELEPORT: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.error('the inside reading would be taken from the pavement — refusing to report.');
  await b.close(); process.exit(3);
}
await painted(3000).catch(() => {});
await p.waitForTimeout(400);
if (SHOTS) await p.screenshot({ path: `shots/w108-${TAG}-inside.png` });

const rooms = await p.evaluate(() => window.__ct.roomDims());
const hr = rooms.find((r) => r.id === 'hotel'), cr = rooms.find((r) => r.id === 'casino');
if (!hr || !cr) { console.error('roomDims() has no hotel/casino'); await b.close(); process.exit(3); }
const inside = { yaw: after.yaw, hotel: [hr.cx, hr.cz], casino: [cr.cx, cr.cz] };

// ── AND THE DECLARATION MUST AGREE WITH THE LAYOUT ──────────────────────────
// `PARTY.west` says which room is in the LOWER slab and which flank each room
// cuts its opening in. If that disagrees with where the rooms actually stand,
// the opening is cut in the wrong walls and the world is worse than before the
// fix — worker onehundredfive's note names this as the reason a bare west/east
// swap was refused. Read it from the world, never from the source text.
const party = await p.evaluate(() => window.__ct.party());
const pw = Array.isArray(party) ? party.find((q) => q.rooms?.includes?.('hotel')
  || q.west === 'hotel' || q.east === 'hotel') : null;
let declOk = null;
if (pw) {
  const lower = hr.cx < cr.cx ? 'hotel' : 'casino';
  const upper = hr.cx < cr.cx ? 'casino' : 'hotel';
  declOk = pw.west === lower && pw.east === upper;
  console.log(`\nDECLARATION  PARTY west='${pw.west}' east='${pw.east}'`
    + `   LAYOUT lower-x='${lower}' upper-x='${upper}'   ->  ${declOk ? 'AGREE' : 'DISAGREE'}`);
} else {
  console.log('\nDECLARATION  __ct.party() published no wall naming the hotel');
}

const v = verdict(outside, inside);
console.log(`\nOUTSIDE  stand (${midX.toFixed(2)}, ${standZ.toFixed(2)})  yaw ${yawOut.toFixed(3)}`
  + `   fwd (${Math.sin(yawOut).toFixed(2)}, ${(-Math.cos(yawOut)).toFixed(2)})`);
console.log(`   the HOTEL is on the casino's ${side(v.hOut)}`);
console.log(`\nINSIDE   walked in through the SEVENS door, arrived`
  + ` (${after.x.toFixed(2)}, ${after.z.toFixed(2)})  yaw ${after.yaw.toFixed(3)}`
  + `   fwd (${Math.sin(after.yaw).toFixed(2)}, ${(-Math.cos(after.yaw)).toFixed(2)})`);
console.log(`   hotel room cx ${hr.cx.toFixed(2)}   casino room cx ${cr.cx.toFixed(2)}`);
console.log(`   the HOTEL is on the casino's ${side(v.hIn)}`);
console.log(`\n   VERDICT: ${v.degenerate ? 'DEGENERATE — a reading is dead ahead or both rooms agree'
  : v.match ? 'MATCH — the pair is handed the same way inside and out'
            : 'MISMATCH — this is the user\'s complaint'}`);
if (errs.length) console.log(`\n   console errors: ${errs.length}\n     ${errs.slice(0, 4).join('\n     ')}`);
await b.close();
if (v.degenerate || declOk === null) process.exit(3);
process.exit(v.match && declOk && errs.length === 0 ? 0 : 1);
