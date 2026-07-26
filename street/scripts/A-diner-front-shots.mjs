// PICTURES OF THE DINER FRONTAGE — an investigation, not an assertion.
//
// The user: "where are we with diner facade changes? looks really bad rn".
// The ledger has the diner BLADE confirmed and the thrift facade confirmed;
// the diner FACADE as a whole is neither, and nobody had stood in front of it
// since shopfrontRelief landed. So: look at it the way a player does, from
// the 2 m pavement, square on and from each end.
//
// Every camera position is DERIVED from `__frontages` (GOTCHAS 20 — aim from
// the source, not from memory). The only hand-typed number is how far out of
// the facade the pavement is, and that comes from ROAD_HALF.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));
await p.waitForTimeout(700);

const f = await p.evaluate(() => (globalThis.__frontages || []).find((q) => q.name === 'DINER'));
if (!f) { console.error('no DINER frontage registered — nothing to look at'); process.exit(3); }
console.log(JSON.stringify(f, null, 1));

const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
const mid = (lo + hi) / 2;
const OUT = f.facePos < 0 ? 1 : -1;          // which way the street is
const face = f.facePos;
// THE RIG'S FORWARD IS `(sin yaw, 0, -cos yaw)`, so aiming at a point is
// `atan2(dx, -dz)`. Both halves of that were wrong on the way here and each
// wrong version still produced a plausible photograph of the wrong thing:
// `atan2(dx,dz)+PI` photographed the PAWN shop across the street, and
// `atan2(dx,dz)` photographed the alley and the THRIFT, because a square-on
// shot has dz = 0 and cannot tell the two apart. That is GOTCHAS 20 twice in
// one script — so this is fitted to two OBSERVED frames, not derived: the
// square shot at -PI/2 faces the west facade, and the north-end shot faces +z
// with the road on the left.
const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));

// pavement runs from the facade out to the kerb at |x| = ROAD_HALF = 5.
const NEAR = face + OUT * 1.7;               // at the kerb, still on the walk
const MIDW = face + OUT * 1.1;               // mid-pavement
const ROAD = face + OUT * 7.5;               // for the whole-elevation context shot

const shots = [
  ['square', NEAR, mid, yawTo(NEAR, mid, face, mid), 0.06],
  ['square-low', MIDW, mid, yawTo(MIDW, mid, face, mid), -0.10],
  // named for the world end, not "north"/"south" — the neighbours are what a
  // reader can check: hi is the ALLEY end, lo is the THRIFT end.
  ['from-alley-end', MIDW, hi + 0.5, yawTo(MIDW, hi + 0.5, face, mid), 0.02],
  ['from-thrift-end', MIDW, lo - 0.5, yawTo(MIDW, lo - 0.5, face, mid), 0.02],
  ['door', MIDW, f.doorWorld, yawTo(MIDW, f.doorWorld, face, f.doorWorld), -0.02],
  ['stallriser', face + OUT * 0.9, mid, yawTo(face + OUT * 0.9, mid, face, mid), -0.42],
  ['elevation', ROAD, mid, yawTo(ROAD, mid, face, mid), 0.10],
];

for (const [tag, x, z, yaw, pitch] of shots) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch), [x, z, yaw, pitch]);
  await p.waitForTimeout(320);
  await p.screenshot({ path: `shots/A-diner-${tag}.png` });
  console.log(`  A-diner-${tag}  from (${x.toFixed(2)}, ${z.toFixed(2)}) yaw ${yaw.toFixed(2)}`);
}
await b.close();
