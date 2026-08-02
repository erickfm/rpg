// LOOK at the bank vault's walls/ceiling and the car lot's parking-bay slabs
// — screenshots for judgement, not proof (CLAUDE.md: screenshots are for
// LOOKING, never for PROVING the world didn't move).
//
//   SHOT_URL=http://localhost:4190/ node scripts/vault-and-lot-look.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);
await p.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p, 6);

const standAt = async (x, z, yaw, tag) => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [x, z, yaw]);
  await afterFrames(p, 8);
  await p.waitForTimeout(200);
  const q = await p.evaluate(() => window.__ct.pos());
  const ok = Math.hypot(q[0] - x, q[2] - z) < 0.6;
  console.log(`${ok ? 'OK ' : 'NO '} stand at (${x}, ${z}) -> got (${q[0].toFixed(2)}, ${q[2].toFixed(2)}) [${tag}]`);
  return ok;
};

const R = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'bank') ?? null);
if (!R) { console.error('ABORT: no room with id "bank"'); await b.close(); process.exit(3); }
console.log(`bank room: ${R.w} x ${R.d} centred (${R.cx}, ${R.cz})`);

// Vault coords, from src/proto/ct/int-bank.ts:
//   V_X1 = -3.60 (east face outside), V_T = 0.28, V_Z1 = -3.00 (front face outside)
//   THROAT_CX = -5.40, THROAT_W = 1.50 -> throat spans x -6.15..-4.65 at z ~ -3.28..-3.00
// room centred at (R.cx, R.cz); local offsets are relative to that centre.
const cx = R.cx, cz = R.cz;

// Camera forward at yaw t is (sin t, -cos t) — GOTCHAS 33. yaw=0 looks toward
// -z, yaw=+PI/2 looks toward +x (east), yaw=PI looks toward +z, yaw=-PI/2
// looks toward -x (west).

// Stand in the lobby, aiming at the vault throat (which sits south of here,
// at lower z) from a few metres out.
await standAt(cx - 5.40, cz + 3.0, 0, 'lobby, facing throat');
await p.screenshot({ path: 'shots/vault-from-lobby.png' });

// Step through the throat, into the vault interior (x -7.0..-3.88, z -3.28..
// -6.0), and look at the east wall — the built, full-height concrete wall.
await standAt(cx - 5.40, cz - 4.5, Math.PI / 2, 'inside vault, facing east wall');
await p.screenshot({ path: 'shots/vault-inside-eastwall.png' });

// Face back out through the throat — shows the open vault door plus both
// built walls flanking the opening.
await standAt(cx - 5.40, cz - 4.5, Math.PI, 'inside vault, facing throat/out');
await p.screenshot({ path: 'shots/vault-inside-throat.png' });

// Look up at the ceiling from the same spot (positive pitch = look up, per
// fp.ts's arrowup binding).
await p.evaluate(([yaw]) => {
  const pos = window.__ct.pos();
  window.__ct.warp(pos[0], pos[2], yaw, undefined, 0.85);
}, [Math.PI / 2]);
await afterFrames(p, 6);
await p.screenshot({ path: 'shots/vault-ceiling.png' });

console.log('vault shots done');

// ── the car lot's parking-bay slabs ────────────────────────────────────────
// From notes/AUDIT-shadow-geometry.md: 12 flat slabs, two rows of six,
// x 7.55..25.1, z 6.45..10.75 and x 8.9..25.1, z -5.55..-1.25.
await standAt(16, 3, 0, 'lot overview, looking north across both rows');
await afterFrames(p, 4);
await p.screenshot({ path: 'shots/lot-bays-overview.png' });

await standAt(12, 9, Math.PI / 2, 'lot, close on north row bay');
await afterFrames(p, 4);
await p.screenshot({ path: 'shots/lot-bays-close.png' });

console.log('lot shots done');

await b.close();
