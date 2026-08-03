// What does a storm of strength X actually LOOK like from the street?
//
// Calibration for item 110. The item asks for a floor low enough that a real
// drizzle exists but high enough that the weakest storm is still "plainly
// rain" — the complaint the 0.62 floor was put there to fix. That is a
// judgement about what the eye reads, so it has to be looked at, not reasoned
// about from an opacity number.
//
// Targets are reached by picking a real ABSOLUTE HOUR, not by poking the
// renderer: `crosstown.ts:1598` sets `totalMin = h*60`, and `:1883` derives
// `hourAbs = floor(totalMin/60)`, so `__ct.clock(H, 0)` puts the world in
// storm H exactly as play would meet it. Hours are filtered to H % 24 == 13 so
// every frame is the same daylight and only the rain differs.
//
//   node scripts/probes/w59-storm-look.mjs <tag> [t1 t2 t3 ...]
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const TAG = process.argv[2] || 'storm';
const TARGETS = process.argv.slice(3).map(Number);
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const DIR = 'shots/w59';
mkdirSync(DIR, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

// an open stretch of the side street with sky in frame — rain against a bright
// sky is the hardest case to read, which is the case worth judging
const STAND = [58.8, -103, -Math.PI / 2];

// warm up: the first frame after load renders black (see w59-jaildoor-shot.mjs)
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), STAND);
await p.waitForTimeout(1500);
await p.screenshot();

const pick = async (target) => p.evaluate((t) => {
  const u = window.__ct.scene().userData;
  let best = null;
  for (let H = 13; H < 200000; H += 24) {          // H % 24 == 13, always daylight
    if (!u.rainAt(H)) continue;
    const s = u.stormAt(H);
    if (!best || Math.abs(s - t) < Math.abs(best.s - t)) best = { H, s };
    if (best && Math.abs(best.s - t) < 0.002) break;
  }
  return best;
}, target);

for (const t of TARGETS) {
  const hit = await pick(t);
  if (!hit) { console.log(`target ${t}: no wet hour found`); continue; }
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.14, 0), STAND);
  await p.evaluate((H) => window.__ct.clock(H, 0), hit.H);
  // rainLevel ramps at dt*0.6 and settles ~0.999 in about 11 real seconds
  // (ct/props.ts:2245). One real second is one game minute, so 14 s of waiting
  // is 14 game minutes — safely inside the hour, so the storm cannot change
  // underneath the shot.
  await p.waitForTimeout(14000);
  const live = await p.evaluate(() => {
    const u = window.__ct.scene().userData;
    return { stormNow: u.stormNow, heavy: u.rainHeavy };
  });
  const name = `${DIR}/${TAG}-s${String(Math.round(hit.s * 100)).padStart(3, '0')}.png`;
  writeFileSync(name, await p.screenshot());
  console.log(`target ${t.toFixed(2)}  hour ${hit.H}  stormAt ${hit.s.toFixed(3)}  live stormNow ${(+live.stormNow).toFixed(3)} heavy ${(+live.heavy).toFixed(3)}  -> ${name}`);
}
await b.close();
