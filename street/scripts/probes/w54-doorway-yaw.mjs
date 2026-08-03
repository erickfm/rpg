// ITEM 140 — *"still feels weird to look around at the door frame to my room …
// its just from looking around."*
//
// THE SUBJECT IS YAW, SO YAW IS THE ONLY THING THAT MOVES. The player stands
// still at one station in flat 301 and sweeps through 360 degrees; the literal
// text of `#ct-prompt` is read at every step. A prompt that swaps three times
// while you turn once is the complaint, even if each individual answer is
// defensible.
//
// THE ORACLE IS THE DOM, not `pickSpot` — the same rule approach-band.mjs
// states. Tier attribution IS computed from the world's own `fp.ts` values
// (imported, never retyped) but only to EXPLAIN a swap the DOM already showed.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w54-doorway-yaw.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4185/');
const STEP = Number(process.env.YAW_STEP ?? 3);      // degrees

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

// ── enter flat 301 the way w40's probes do ────────────────────────────────
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(700);

const spots = await p.evaluate(() =>
  window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210 && s.z > -22 && s.z < -10));
console.log('\nSPOTS IN FLAT 301');
for (const s of spots) console.log(`  ${s.label.padEnd(34)} (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  r${s.r}`);

const door = spots.find((s) => /the door/i.test(s.label));
if (!door) { console.log('no door spot found — cannot site the station'); await b.close(); process.exit(1); }

// THE STATION IS THE DOORWAY, and "the doorway" is where the player stands when
// he is at his own door frame: on the door spot's own stand-point, plus two
// stations stepped back into the room along the bed direction, because the
// complaint is about looking around *at* the frame, not about one exact point.
const bed = spots.find((s) => /bed/i.test(s.label));
const stations = [{ name: 'ON the door stand-point', x: door.x, z: door.z }];
if (bed) {
  const ux = (bed.x - door.x), uz = (bed.z - door.z);
  const L = Math.hypot(ux, uz) || 1;
  for (const back of [0.5, 1.0]) {
    stations.push({ name: `${back.toFixed(1)} m off the door, toward the bed`,
      x: door.x + (ux / L) * back, z: door.z + (uz / L) * back });
  }
}

// READ OFF `__ct`, NOT IMPORTED (item 232). `await import('/src/proto/fp.ts')`
// works on the dev server and 404s on `vite preview`, where the bundle serves
// `dist/` and that path does not exist — so on the build the user actually
// ships, this read returned nothing. Published at `crosstown.ts:1618`/`:1629`.
// This probe deliberately reads BOTH constants, which is still right: it
// compares the two predicates against each other.
const fp = await p.evaluate(() => ({
  TOUCH_MARGIN: window.__ct.touchMargin(), REACH_MARGIN: window.__ct.reachMargin(),
}));
if (![fp.TOUCH_MARGIN, fp.REACH_MARGIN].every((v) => typeof v === 'number' && isFinite(v))) {
  console.error(`ABORT: margins did not resolve off __ct — ${JSON.stringify(fp)}`);
  await b.close(); process.exit(3);
}
console.log(`\nfp.ts: TOUCH_MARGIN=${fp.TOUCH_MARGIN} REACH_MARGIN=${fp.REACH_MARGIN}`);

let worstSwaps = 0;
for (const st of stations) {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [st.x, st.z, gy]);
  await p.waitForTimeout(400);
  const got = await p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`STATION: ${st.name}`);
  console.log(`  asked (${st.x.toFixed(2)}, ${st.z.toFixed(2)})  actually at (${got.x.toFixed(2)}, ${got.z.toFixed(2)})`);
  for (const s of spots) {
    const d = Math.hypot(s.x - got.x, s.z - got.z);
    console.log(`    d=${d.toFixed(2)}  touch<${(s.r + fp.TOUCH_MARGIN).toFixed(2)}  ${d < s.r + fp.TOUCH_MARGIN ? 'TOUCHING' : '        '}  ${s.label}`);
  }

  const seq = [];
  for (let deg = 0; deg < 360; deg += STEP) {
    // YAW ONLY. Position is re-asserted at every step so a stray nudge cannot
    // turn a turning test into a walking one.
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
      [got.x, got.z, (deg * Math.PI) / 180, gy]);
    await p.waitForTimeout(90);
    seq.push({ deg, t: await prompt() });
  }

  // runs of identical prompt, around the circle
  const runs = [];
  for (const e of seq) {
    const last = runs[runs.length - 1];
    if (last && last.t === e.t) last.to = e.deg;
    else runs.push({ from: e.deg, to: e.deg, t: e.t });
  }
  // the circle wraps: join the last run to the first if they match
  if (runs.length > 1 && runs[0].t === runs[runs.length - 1].t) {
    runs[0].from = runs[runs.length - 1].from - 360;
    runs.pop();
  }
  console.log(`\n  YAW -> PROMPT  (step ${STEP}°)`);
  for (const r of runs) {
    const w = r.to - r.from + STEP;
    console.log(`    ${String(r.from).padStart(4)}° … ${String(r.to).padStart(4)}°  (${String(w).padStart(3)}° wide)  ${r.t ?? '—'}`);
  }
  const swaps = runs.length;
  console.log(`\n  SWAPS PER FULL TURN: ${swaps}`);
  // A NARROW RUN IS THE FLICKER. Anything under 20° wide is a band the player
  // passes through in a fraction of a mouse flick — it reads as a flash.
  const narrow = runs.filter((r) => r.to - r.from + STEP <= 20);
  if (narrow.length) {
    console.log(`  NARROW BANDS (<=20° — these are what "flicker" means):`);
    for (const r of narrow) console.log(`    ${String(r.from).padStart(4)}° … ${String(r.to).padStart(4)}°  ${r.t ?? '—'}`);
  }
  // changed AND CHANGED BACK: A -> B -> A
  let ab = 0;
  for (let i = 1; i + 1 < runs.length; i++) if (runs[i - 1].t === runs[i + 1].t) ab++;
  console.log(`  A->B->A reversals: ${ab}`);
  worstSwaps = Math.max(worstSwaps, swaps);
}

console.log(`\nWORST SWAPS PER TURN over ${stations.length} stations: ${worstSwaps}`);
await b.close();
