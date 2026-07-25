// Instrument a COPY of seats-walk's seat-1 sequence rather than edit A's file.
// Dump exactly what it feeds standableNear, what that returns, and what the
// prompt element looks like at the moment it reads null.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const RADIUS = 0.36;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(300);
const out = await p.evaluate(async ([RADIUS]) => {
  const seats = window.__ct.seats();
  const s = seats[0];
  // seats-walk's standableNear, verbatim
  const cols = window.__ct.colliders();
  const blocked = (x, z) => cols.some((c) =>
    x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS);
  let chosen = null;
  outer:
  for (let ring = 0.05; ring <= s.r; ring += 0.07) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = s.at.x + Math.cos(a) * ring, z = s.at.z + Math.sin(a) * ring;
      if (!blocked(x, z)) { chosen = { x, z, ring: +ring.toFixed(2) }; break outer; }
    }
  }
  const dump = { label: s.label, at: s.at, r: s.r, pose: s.pose, chosen,
                 nCols: cols.length, weirdCols: cols.filter(c => !isFinite(c.minX) || Math.abs(c.minX) > 500).length };
  if (!chosen) return { ...dump, prompt: null, why: 'standableNear returned null' };
  window.__ct.warp(chosen.x, chosen.z, 0, 0, 0);
  await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
  await new Promise(r=>setTimeout(r,140));
  const d = document.getElementById('ct-prompt');
  return { ...dump,
    pos: window.__ct.pos().map(v=>+v.toFixed(2)),
    elExists: !!d, inlineDisplay: d ? d.style.display : null,
    computed: d ? getComputedStyle(d).display : null,
    text: d ? d.textContent : null,
    promptAsToolReads: d && d.style.display !== 'none' ? d.textContent : null };
}, [RADIUS]);
console.log(JSON.stringify(out, null, 2));
await b.close();
