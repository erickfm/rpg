// Side-by-side light comparison across ALL rooms in the world. Matched station
// in each: 1.5 m in from the front wall, on the centreline, looking at the back
// wall, same pitch — so brightness and colour are comparable by eye rather than
// by a ceiling-material luminance figure, which round 7 showed is the wrong
// statistic (it misses the additive glow, which is what the eye reads).
//
// Slabs are assigned by sorted filename since 0b6d6630:
//   burger 0 · casino 1 · diner 2 · hotel 3 · pawn 4 · tax 5 · thrift 6
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const R = [
  { id: '0-burger', cx: 440, hd: 4.25 },
  { id: '1-casino', cx: 520, hd: 4.5  },
  { id: '2-diner',  cx: 600, hd: 3.5  },
  { id: '3-hotel',  cx: 680, hd: 4.5  },
  { id: '4-pawn',   cx: 760, hd: 4.0  },
  { id: '5-tax',    cx: 840, hd: 4.25 },
  { id: '6-thrift', cx: 920, hd: 3.25 },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const stats = [];
for (const r of R) {
  await p.evaluate((a) => window.__ct.warp(a[0], a[1], 0, 0, 0.02), [r.cx, r.hd - 1.5]);
  await p.waitForTimeout(300);
  const buf = await p.screenshot({ path: `shots/light-${r.id}.png` });
  // mean luminance of the rendered frame, excluding the HUD strip at the bottom
  const lum = await p.evaluate(async () => {
    const cv = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = cv.width; g.height = Math.round(cv.height * 0.8);
    g.getContext('2d').drawImage(cv, 0, 0);
    const d = g.getContext('2d').getImageData(0, 0, g.width, g.height).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { s += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]; n++; }
    return +(s / n / 255).toFixed(3);
  });
  stats.push({ room: r.id, frameLuminance: lum });
}
console.log('mean rendered frame luminance, matched camera:');
for (const s of stats.sort((a, b2) => b2.frameLuminance - a.frameLuminance))
  console.log(`  ${s.room.padEnd(10)} ${String(s.frameLuminance).padStart(6)}`);
const v = stats.map(s => s.frameLuminance);
console.log(`\n  spread: ${Math.min(...v)} … ${Math.max(...v)}  =  ${(Math.max(...v)/Math.min(...v)).toFixed(2)} : 1`);
await b.close();
