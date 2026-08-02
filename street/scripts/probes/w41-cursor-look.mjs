// LOOK at the two cursors, magnified. A screenshot of the world can never show
// them — Playwright does not composite the OS cursor — so the art is rendered
// straight from the same strings `ct/hud.ts` blits, at 14x, on both a light and
// a dark ground so the white fill and the black outline can each be judged.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/proto/ct/hud.ts', import.meta.url), 'utf8');
const grab = (name) => {
  const m = src.match(new RegExp(`${name}_ART = \\[([\\s\\S]*?)\\];`));
  return m[1].trim().split('\n').map((l) => l.trim().replace(/^'/, '').replace(/',?$/, ''));
};
const arts = { ARROW: grab('ARROW'), HAND: grab('HAND') };
for (const [k, v] of Object.entries(arts)) {
  if (v.length !== 16 || v.some((r) => r.length !== 16)) {
    console.log(`FAIL  ${k}_ART is not 16x16 (${v.length} rows, widths ${[...new Set(v.map((r) => r.length))]})`);
    process.exit(1);
  }
  console.log(`OK    ${k}_ART is 16x16`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 420 } });
await page.setContent('<body style="margin:0;background:#555"><canvas id=c width=760 height=420></canvas></body>');
await page.evaluate((arts) => {
  const g = document.getElementById('c').getContext('2d');
  // 16 cells at S must FIT the 380-wide ground twice over with margins, or the
  // second cursor is drawn under the next panel and reads as a clipped hand.
  const S = 10;
  const grounds = ['#c0c0c0', '#1c2026'];       // Win98 grey, and the ATM's bezel
  let gx = 0;
  for (const ground of grounds) {
    g.fillStyle = ground; g.fillRect(gx, 0, 380, 420);
    let x = gx + 20;
    for (const art of [arts.ARROW, arts.HAND]) {
      for (let y = 0; y < 16; y++) {
        for (let i = 0; i < 16; i++) {
          const ch = art[y][i];
          if (ch === ' ') continue;
          g.fillStyle = ch === 'X' ? '#000' : '#fff';
          g.fillRect(x + i * S, 60 + y * S, S, S);
        }
      }
      x += 16 * S + 20;
    }
    gx += 380;
  }
  g.font = 'bold 15px monospace';
  g.fillStyle = '#000'; g.fillText('ARROW', 40, 40); g.fillText('HAND', 220, 40);
  g.fillStyle = '#fff'; g.fillText('ARROW', 420, 40); g.fillText('HAND', 600, 40);
}, arts);
await page.screenshot({ path: '/tmp/w41-cursors.png' });
await browser.close();
console.log('wrote /tmp/w41-cursors.png');
